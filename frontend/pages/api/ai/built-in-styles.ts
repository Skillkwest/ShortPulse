import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { resolveRuntimeBuiltInStyleCatalog } from "../../../lib/server/api/builtInStyleControlPlane";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const builtInCatalog = await resolveRuntimeBuiltInStyleCatalog({ bypassCache: true });
    return res.status(200).json({
      styleDefinitions: builtInCatalog.styleDefinitions,
      source: builtInCatalog.source,
      updatedAt: builtInCatalog.updatedAt,
      updatedByEmail: builtInCatalog.updatedByEmail,
      degraded: builtInCatalog.degraded,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/ai/built-in-styles",
      user,
    });
    return res.status(500).json({ error: "Failed to load built-in Styles." });
  }
}
