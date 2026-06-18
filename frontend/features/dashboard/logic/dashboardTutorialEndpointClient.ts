/**
 * Client-side reader for the public dashboard tutorial endpoint.
 * Shares in-flight requests across dashboard surfaces to avoid duplicate hydration work.
 */
import type { DashboardTutorial } from "../components/DashboardTutorialGrid";
import { asDashboardTutorials } from "./dashboardTutorialPayload";

const DASHBOARD_TUTORIALS_CLIENT_CACHE_TTL_MS = 60_000;

let cachedDashboardTutorials: {
  loadedAt: number;
  tutorials: DashboardTutorial[];
} | null = null;
let dashboardTutorialsRequestPromise: Promise<DashboardTutorial[]> | null = null;

const shouldUseDashboardTutorialsClientCache = () => process.env.NODE_ENV !== "test";

const fetchDashboardTutorials = async (): Promise<DashboardTutorial[]> => {
  const response = await fetch("/api/dashboard/tutorials", {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error("Failed to load dashboard tutorials.");
  }
  const payload = (await response.json().catch(() => ({}))) as {
    tutorials?: unknown;
  };
  return asDashboardTutorials(payload.tutorials);
};

export const readDashboardTutorialsFromPublicEndpoint = async (): Promise<DashboardTutorial[]> => {
  if (!shouldUseDashboardTutorialsClientCache()) {
    return fetchDashboardTutorials();
  }

  const now = Date.now();
  if (
    cachedDashboardTutorials &&
    now - cachedDashboardTutorials.loadedAt < DASHBOARD_TUTORIALS_CLIENT_CACHE_TTL_MS
  ) {
    return cachedDashboardTutorials.tutorials;
  }

  if (!dashboardTutorialsRequestPromise) {
    dashboardTutorialsRequestPromise = fetchDashboardTutorials()
      .then((tutorials) => {
        cachedDashboardTutorials = {
          loadedAt: Date.now(),
          tutorials,
        };
        return tutorials;
      })
      .finally(() => {
        dashboardTutorialsRequestPromise = null;
      });
  }

  return dashboardTutorialsRequestPromise;
};
