import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  fetchActiveCreatePulseBuiltInCatalog,
  getSeededCreatePulseBuiltInDefinitions,
  saveCreatePulseBuiltInCatalog,
} from "../../../../lib/server/api/createPulseBuiltInControlPlane";
import { normalizeCreatePulseBuiltInPresetDefinitions } from "../../../../features/ai-studio/components/create/createPulsePresets";

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
        "Each Pulse built-in must have a unique preset id, label, description, artifact target, and system instructions.",
    };
  }
  return { ok: true, builtInDefinitions: normalized };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  if (req.method === "GET") {
    try {
      const activeCatalog = await fetchActiveCreatePulseBuiltInCatalog();
      return res.status(200).json({
        builtInDefinitions:
          activeCatalog?.builtInDefinitions ?? getSeededCreatePulseBuiltInDefinitions(),
        updatedAt: activeCatalog?.updatedAt ?? null,
        updatedByEmail: activeCatalog?.updatedByEmail ?? null,
        source: activeCatalog ? "control_plane" : "seed",
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/pulse-builtins",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to load Pulse built-ins." });
    }
  }

  if (req.method === "PUT") {
    const parsed = validateBuiltInDefinitionsPayload(req.body?.builtInDefinitions);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }

    try {
      const savedCatalog = await saveCreatePulseBuiltInCatalog({
        builtInDefinitions: parsed.builtInDefinitions,
        actorUserId: adminUser.id,
        actorEmail: adminUser.email ?? null,
      });
      return res.status(200).json({
        builtInDefinitions: savedCatalog.builtInDefinitions,
        updatedAt: savedCatalog.updatedAt,
        updatedByEmail: savedCatalog.updatedByEmail,
        source: "control_plane",
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/pulse-builtins",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to save Pulse built-ins." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
