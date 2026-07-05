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
  isValidCreatePulseBuiltInPresetId,
  normalizeCreatePulseBuiltInPresetDefinitions,
} from "../../../../lib/model-runtime/createPulseBuiltIns";

const VALID_ARTIFACT_TARGETS = new Set([
  "image_prompt",
  "video_prompt",
  "storyboard",
  "text_artifact",
]);

const readTrimmedString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
};

const resolveBuiltInDefinitionPayloadIssue = (
  value: unknown,
  index: number,
  seenPresetIds: Set<string>
): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `Pulse slot ${index + 1} must be an object.`;
  }
  const record = value as Record<string, unknown>;
  const presetId = readTrimmedString(record, "presetId");
  if (!presetId) return `Pulse slot ${index + 1} is missing a preset id.`;
  if (!isValidCreatePulseBuiltInPresetId(presetId)) {
    return `${CREATE_PULSE_BUILT_IN_PRESET_ID_REQUIREMENT} Invalid preset id: ${presetId}`;
  }
  if (seenPresetIds.has(presetId)) {
    return `Pulse preset id "${presetId}" is duplicated.`;
  }
  seenPresetIds.add(presetId);
  if (!readTrimmedString(record, "label")) return `Pulse "${presetId}" is missing a name.`;
  if (!readTrimmedString(record, "description")) {
    return `Pulse "${presetId}" is missing a description.`;
  }
  if (!readTrimmedString(record, "starterAssistantMessage")) {
    return `Pulse "${presetId}" needs a starter assistant message so kickoff can never be blank.`;
  }
  if (!readTrimmedString(record, "systemInstructions")) {
    return `Pulse "${presetId}" is missing system instructions.`;
  }
  if (record.pulseKind !== undefined && record.pulseKind !== "guided_workflow") {
    return `Pulse "${presetId}" must use pulseKind "guided_workflow".`;
  }
  if (record.runtimeMode !== undefined && record.runtimeMode !== "workflow_gpt") {
    return `Pulse "${presetId}" must use runtimeMode "workflow_gpt".`;
  }
  if (record.activationMode !== undefined && record.activationMode !== "activate_and_start") {
    return `Pulse "${presetId}" must use activationMode "activate_and_start".`;
  }
  if (record.outputMode !== undefined && record.outputMode !== "chat_reply") {
    return `Pulse "${presetId}" must use outputMode "chat_reply".`;
  }
  if (record.memoryPolicy !== undefined && record.memoryPolicy !== "session") {
    return `Pulse "${presetId}" must use memoryPolicy "session".`;
  }
  const artifactTarget = readTrimmedString(record, "artifactTarget");
  if (!VALID_ARTIFACT_TARGETS.has(artifactTarget)) {
    return `Pulse "${presetId}" needs a valid artifact target.`;
  }
  return null;
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
  for (let index = 0; index < value.length; index += 1) {
    const issue = resolveBuiltInDefinitionPayloadIssue(value[index], index, seenPresetIds);
    if (issue) return { ok: false, message: issue };
  }
  const normalized = normalizeCreatePulseBuiltInPresetDefinitions(value);
  if (normalized.length !== value.length) {
    return {
      ok: false,
      message:
        "Each built-in guided workflow must have a unique safe preset id, label, description, starter message, artifact target, and system instructions.",
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
