import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  CreatePulseBuiltInCatalogVersionMismatchError,
  resolveCreatePulseBuiltInCatalogForAdmin,
  saveCreatePulseBuiltInCatalog,
} from "../../../../lib/server/api/createPulseBuiltInControlPlane";
import {
  CREATE_PULSE_BUILT_IN_PRESET_ID_REQUIREMENT,
  isCreatePulseRetiredPresetId,
  isValidCreatePulseBuiltInPresetId,
  normalizeCreatePulseBuiltInPresetDefinitions,
  type CreatePulseArtifactTarget,
  type CreatePulsePublicationStatus,
} from "../../../../lib/model-runtime/createPulseBuiltIns";

const VALID_ARTIFACT_TARGETS: ReadonlySet<string> = new Set([
  "image_prompt",
  "video_prompt",
  "storyboard",
  "text_artifact",
]);

const readTrimmedString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
};

const isCreatePulsePublicationStatus = (value: string): value is CreatePulsePublicationStatus =>
  value === "published" || value === "draft";

const createSafePulsePresetId = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64)
    .replace(/^[-_]+|[-_]+$/g, "");

const resolveUniquePresetId = (basePresetId: string, seenPresetIds: Set<string>): string => {
  const base = basePresetId || "built_in_pulse";
  let candidate = base.slice(0, 64).replace(/^[-_]+|[-_]+$/g, "") || "built_in_pulse";
  let suffix = 2;
  while (seenPresetIds.has(candidate)) {
    const suffixText = `_${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 64 - suffixText.length))}${suffixText}`.replace(
      /^[-_]+|[-_]+$/g,
      ""
    );
    suffix += 1;
  }
  return candidate;
};

const inferArtifactTarget = (label: string, prompt: string): CreatePulseArtifactTarget => {
  const searchable = `${label} ${prompt}`.toLowerCase();
  if (/\bimage\s+prompts?\b|\bimages?\s+only\b/.test(searchable)) return "image_prompt";
  if (/\bvideo\b|\bshot\b|\bmotion\b|\bcamera\b|\bscene\b/.test(searchable)) return "video_prompt";
  if (/\bimage\b|\bphoto\b|\bvisual\b|\billustration\b/.test(searchable)) return "image_prompt";
  if (/\bstoryboard\b|\bstory board\b/.test(searchable)) return "storyboard";
  return "text_artifact";
};

const buildDefaultDescription = (label: string): string => `Built-in guided Pulse for ${label}.`;

const normalizeAdminBuiltInDefinitionRecord = (
  value: unknown,
  index: number,
  seenPresetIds: Set<string>
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: `Pulse slot ${index + 1} must be an object.` };
  }
  const record = value as Record<string, unknown>;
  const label =
    readTrimmedString(record, "label") ||
    readTrimmedString(record, "title") ||
    readTrimmedString(record, "name");
  const systemInstructions =
    readTrimmedString(record, "systemInstructions") || readTrimmedString(record, "prompt");

  if (!label) return { ok: false, message: `Pulse slot ${index + 1} needs a title.` };
  if (!systemInstructions) {
    return { ok: false, message: `Pulse "${label}" needs a prompt.` };
  }

  const suppliedPresetId = readTrimmedString(record, "presetId");
  if (suppliedPresetId && !isValidCreatePulseBuiltInPresetId(suppliedPresetId)) {
    return {
      ok: false,
      message: `${CREATE_PULSE_BUILT_IN_PRESET_ID_REQUIREMENT} Invalid preset id: ${suppliedPresetId}`,
    };
  }
  if (suppliedPresetId && isCreatePulseRetiredPresetId(suppliedPresetId)) {
    return {
      ok: false,
      message: `Pulse preset id "${suppliedPresetId}" is retired. Choose a new safe preset id for this built-in Pulse.`,
    };
  }
  if (suppliedPresetId && seenPresetIds.has(suppliedPresetId)) {
    return { ok: false, message: `Pulse preset id "${suppliedPresetId}" is duplicated.` };
  }
  const presetId = suppliedPresetId
    ? suppliedPresetId
    : resolveUniquePresetId(createSafePulsePresetId(label), seenPresetIds);
  seenPresetIds.add(presetId);

  if (record.pulseKind !== undefined && record.pulseKind !== "guided_workflow") {
    return { ok: false, message: `Pulse "${presetId}" must use pulseKind "guided_workflow".` };
  }
  if (record.runtimeMode !== undefined && record.runtimeMode !== "workflow_gpt") {
    return { ok: false, message: `Pulse "${presetId}" must use runtimeMode "workflow_gpt".` };
  }
  if (record.activationMode !== undefined && record.activationMode !== "activate_and_start") {
    return {
      ok: false,
      message: `Pulse "${presetId}" must use activationMode "activate_and_start".`,
    };
  }
  if (record.outputMode !== undefined && record.outputMode !== "chat_reply") {
    return { ok: false, message: `Pulse "${presetId}" must use outputMode "chat_reply".` };
  }
  if (record.memoryPolicy !== undefined && record.memoryPolicy !== "session") {
    return { ok: false, message: `Pulse "${presetId}" must use memoryPolicy "session".` };
  }

  const suppliedArtifactTarget = readTrimmedString(record, "artifactTarget");
  if (suppliedArtifactTarget && !VALID_ARTIFACT_TARGETS.has(suppliedArtifactTarget)) {
    return { ok: false, message: `Pulse "${presetId}" needs a valid artifact target.` };
  }
  const suppliedPublicationStatus = readTrimmedString(record, "publicationStatus");
  if (suppliedPublicationStatus && !isCreatePulsePublicationStatus(suppliedPublicationStatus)) {
    return {
      ok: false,
      message: `Pulse "${presetId}" publication status must be "published" or "draft".`,
    };
  }
  const publicationStatus = suppliedPublicationStatus || "published";
  const artifactTarget = (suppliedArtifactTarget ||
    inferArtifactTarget(label, systemInstructions)) as CreatePulseArtifactTarget;

  return {
    ok: true,
    value: {
      ...record,
      presetId,
      label,
      description: readTrimmedString(record, "description") || buildDefaultDescription(label),
      starterAssistantMessage: null,
      workflowStageHints: null,
      artifactTarget,
      systemInstructions,
      pulseKind: "guided_workflow",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      outputMode: "chat_reply",
      memoryPolicy: "session",
      publicationStatus,
    },
  };
};

const validateBuiltInDefinitionsPayload = (
  value: unknown
):
  | {
      ok: true;
      builtInDefinitions: ReturnType<typeof normalizeCreatePulseBuiltInPresetDefinitions>;
    }
  | { ok: false; message: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, message: "builtInDefinitions must be an array." };
  }
  const seenPresetIds = new Set<string>();
  const hydratedDefinitions: Record<string, unknown>[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const hydrated = normalizeAdminBuiltInDefinitionRecord(value[index], index, seenPresetIds);
    if (!hydrated.ok) return { ok: false, message: hydrated.message };
    hydratedDefinitions.push(hydrated.value);
  }
  const normalized = normalizeCreatePulseBuiltInPresetDefinitions(hydratedDefinitions);
  if (normalized.length !== value.length) {
    return {
      ok: false,
      message:
        "Each built-in guided workflow must have a unique safe preset id, label, description, artifact target, and system instructions.",
    };
  }
  return { ok: true, builtInDefinitions: normalized };
};

const validateExpectedUpdatedAt = (
  value: unknown
): { ok: true; expectedUpdatedAt: string | null } | { ok: false; message: string } => {
  if (value === undefined) {
    return {
      ok: false,
      message:
        "expectedUpdatedAt is required so non-live catalog content cannot overwrite live built-ins.",
    };
  }
  if (value === null) {
    return { ok: true, expectedUpdatedAt: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "expectedUpdatedAt must be a string or null." };
  }
  const normalized = value.trim();
  return { ok: true, expectedUpdatedAt: normalized.length > 0 ? normalized : null };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/admin/agent-instructions/pulse-builtins.auth",
    });
    return res.status(500).json({ error: "Failed to load built-in guided workflows." });
  }
  if (!adminUser) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "GET") {
    try {
      const activeCatalog = await resolveCreatePulseBuiltInCatalogForAdmin();
      return res.status(200).json({
        builtInDefinitions: activeCatalog.builtInDefinitions,
        updatedAt: activeCatalog.updatedAt,
        updatedByEmail: activeCatalog.updatedByEmail,
        source: activeCatalog.source,
        degraded: activeCatalog.degraded,
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/pulse-builtins",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to load built-in guided workflows." });
    }
  }

  if (req.method === "PUT") {
    const parsed = validateBuiltInDefinitionsPayload(req.body?.builtInDefinitions);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }
    const expectedUpdatedAt = validateExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (!expectedUpdatedAt.ok) {
      return res.status(400).json({ error: expectedUpdatedAt.message });
    }

    try {
      const savedCatalog = await saveCreatePulseBuiltInCatalog({
        builtInDefinitions: parsed.builtInDefinitions,
        expectedUpdatedAt: expectedUpdatedAt.expectedUpdatedAt,
        actorUserId: adminUser.id,
        actorEmail: adminUser.email ?? null,
      });
      return res.status(200).json({
        builtInDefinitions: savedCatalog.builtInDefinitions,
        updatedAt: savedCatalog.updatedAt,
        updatedByEmail: savedCatalog.updatedByEmail,
        source: "control_plane",
        degraded: false,
      });
    } catch (error) {
      if (error instanceof CreatePulseBuiltInCatalogVersionMismatchError) {
        return res.status(409).json({
          error: "The global Pulse catalog changed. Reload the latest stored set and try again.",
          code: "CATALOG_STALE",
        });
      }
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/pulse-builtins",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to save built-in guided workflows." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
