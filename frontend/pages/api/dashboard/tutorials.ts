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

const DASHBOARD_TUTORIALS_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";
const DASHBOARD_TUTORIALS_SERVER_CACHE_TTL_MS = 60_000;

let cachedDashboardTutorials: {
  loadedAt: number;
  tutorials: DashboardTutorial[];
} | null = null;
let dashboardTutorialsReadPromise: Promise<DashboardTutorial[]> | null = null;

const shouldUseDashboardTutorialsServerCache = () => process.env.NODE_ENV !== "test";

const readCachedActiveDashboardTutorials = async (): Promise<DashboardTutorial[]> => {
  if (!shouldUseDashboardTutorialsServerCache()) {
    return readActiveDashboardTutorials(getSupabaseAdmin(), undefined, {
      usePublicDeliveryUrls: true,
    });
  }

  const now = Date.now();
  if (
    cachedDashboardTutorials &&
    now - cachedDashboardTutorials.loadedAt < DASHBOARD_TUTORIALS_SERVER_CACHE_TTL_MS
  ) {
    return cachedDashboardTutorials.tutorials;
  }

  if (!dashboardTutorialsReadPromise) {
    dashboardTutorialsReadPromise = readActiveDashboardTutorials(getSupabaseAdmin(), undefined, {
      usePublicDeliveryUrls: true,
    })
      .then((tutorials) => {
        cachedDashboardTutorials = {
          loadedAt: Date.now(),
          tutorials,
        };
        return tutorials;
      })
      .finally(() => {
        dashboardTutorialsReadPromise = null;
      });
  }

  return dashboardTutorialsReadPromise;
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
    const tutorials = await readCachedActiveDashboardTutorials();
    res.setHeader("Cache-Control", DASHBOARD_TUTORIALS_CACHE_CONTROL);
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
