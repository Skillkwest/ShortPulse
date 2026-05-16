import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { resolveRuntimeCreatePulseBuiltInCatalog } from "../../../lib/server/api/createPulseBuiltInControlPlane";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const builtInCatalog = await resolveRuntimeCreatePulseBuiltInCatalog();
    return res.status(200).json({
      builtInDefinitions: builtInCatalog.builtInDefinitions,
      source: builtInCatalog.source,
      updatedAt: builtInCatalog.updatedAt,
      updatedByEmail: builtInCatalog.updatedByEmail,
      degraded: builtInCatalog.degraded,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/ai/create-pulse-builtins",
      user,
    });
    return res.status(500).json({ error: "Failed to load Create Pulse built-ins." });
  }
}
