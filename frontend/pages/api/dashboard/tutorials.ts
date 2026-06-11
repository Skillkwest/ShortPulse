/**
 * Public dashboard tutorial read route.
 * Returns active globally managed tutorial cards for public and signed-in dashboards.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  readActiveDashboardTutorials,
  type DashboardTutorial,
} from "../../../lib/server/api/dashboardTutorials";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type DashboardTutorialsResponse = {
  tutorials: DashboardTutorial[];
};

type DashboardTutorialsErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardTutorialsResponse | DashboardTutorialsErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const tutorials = await readActiveDashboardTutorials(supabaseAdmin);
    return res.status(200).json({ tutorials });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "dashboard/tutorials",
      user: null,
      metadata: {
        source: "api.dashboard.tutorials",
      },
    });
    return res.status(500).json({ error: "Unable to load dashboard tutorials." });
  }
}
