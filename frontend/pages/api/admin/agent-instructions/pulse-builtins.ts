import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  CreatePulseBuiltInCatalogVersionMismatchError,
  resolveCreatePulseBuiltInCatalogForAdmin,
  saveCreatePulseBuiltInCatalog,
} from "../../../../lib/server/api/createPulseBuiltInControlPlane";
import { normalizeCreatePulseBuiltInPresetDefinitions } from "../../../../lib/model-runtime/createPulseBuiltIns";

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
  const normalized = normalizeCreatePulseBuiltInPresetDefinitions(value);
  if (normalized.length !== value.length) {
    return {
      ok: false,
      message:
        "Each built-in guided workflow must have a unique preset id, label, description, artifact target, and system instructions.",
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
        "expectedUpdatedAt is required so fallback catalog content cannot overwrite live built-ins.",
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
