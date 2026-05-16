import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { resolveRuntimeExpertEditSystemPresetCatalog } from "../../../lib/server/api/expertEditSystemPresetControlPlane";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const catalog = await resolveRuntimeExpertEditSystemPresetCatalog();
    return res.status(200).json({
      presetDefinitions: catalog.presetDefinitions,
      source: catalog.source,
      updatedAt: catalog.updatedAt,
      updatedByEmail: catalog.updatedByEmail,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/ai/expert-edit-system-presets",
      user,
    });
    return res.status(500).json({ error: "Failed to load global Edit system presets." });
  }
}
