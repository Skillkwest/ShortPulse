import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeExpertEditSystemPresetDefinitions } from "../../../../lib/model-runtime/expertEditPresetDomain";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  ExpertEditSystemPresetCatalogVersionMismatchError,
  resolveExpertEditSystemPresetCatalogForAdmin,
  saveExpertEditSystemPresetCatalog,
} from "../../../../lib/server/api/expertEditSystemPresetControlPlane";

const validatePresetDefinitions = (
  value: unknown
):
  | { ok: true; presetDefinitions: ReturnType<typeof normalizeExpertEditSystemPresetDefinitions> }
  | { ok: false; message: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, message: "presetDefinitions must be an array." };
  }
  const presetDefinitions = normalizeExpertEditSystemPresetDefinitions(value);
  if (presetDefinitions.length === 0) {
    return { ok: false, message: "presetDefinitions cannot be empty." };
  }
  return { ok: true, presetDefinitions };
};

const validateExpectedUpdatedAt = (
  value: unknown
): { ok: true; expectedUpdatedAt: string | null } | { ok: false; message: string } => {
  if (value === undefined) {
    return {
      ok: false,
      message:
        "expectedUpdatedAt is required so non-live catalog content cannot overwrite live Edit presets.",
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
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "GET") {
    try {
      const resolvedCatalog = await resolveExpertEditSystemPresetCatalogForAdmin();
      return res.status(200).json({
        presetDefinitions: resolvedCatalog.presetDefinitions,
        updatedAt: resolvedCatalog.updatedAt,
        updatedByEmail: resolvedCatalog.updatedByEmail,
        source: resolvedCatalog.source,
        degraded: resolvedCatalog.degraded,
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/edit-system-presets",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to load global Edit system presets." });
    }
  }

  if (req.method === "PUT") {
    const parsed = validatePresetDefinitions(req.body?.presetDefinitions);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }
    const expectedUpdatedAt = validateExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (!expectedUpdatedAt.ok) {
      return res.status(400).json({ error: expectedUpdatedAt.message });
    }

    try {
      const savedCatalog = await saveExpertEditSystemPresetCatalog({
        presetDefinitions: parsed.presetDefinitions,
        expectedUpdatedAt: expectedUpdatedAt.expectedUpdatedAt,
        actorUserId: adminUser.id,
        actorEmail: adminUser.email ?? null,
      });
      return res.status(200).json({
        presetDefinitions: savedCatalog.presetDefinitions,
        updatedAt: savedCatalog.updatedAt,
        updatedByEmail: savedCatalog.updatedByEmail,
        source: "control_plane",
        degraded: false,
      });
    } catch (error) {
      if (
        error instanceof ExpertEditSystemPresetCatalogVersionMismatchError ||
        (error instanceof Error &&
          error.name === "ExpertEditSystemPresetCatalogVersionMismatchError")
      ) {
        return res.status(409).json({
          code: "CATALOG_STALE",
          error: "The Edit preset catalog changed since you loaded it. Reload and try again.",
        });
      }
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/edit-system-presets",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to save global Edit system presets." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
