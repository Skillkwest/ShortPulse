/**
 * Admin API route for one selected user's support analytics detail payload.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { AdminUserAnalyticsResponse } from "../../../../../features/admin/types";
import { isAdminBillingDiagnosticsUserId } from "../../../../../lib/server/api/adminBillingDiagnostics";
import { resolveAdminUserAnalytics } from "../../../../../lib/server/api/adminUserAnalytics";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | AdminUserAnalyticsResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/users/analytics.auth",
    });
    return res.status(500).json({ error: "Failed to load user analytics." });
  }
  if (!adminUser) return;

  const userId = asSingleString(req.query.userId).trim();
  if (!isAdminBillingDiagnosticsUserId(userId)) {
    return res.status(400).json({ error: "A valid user id is required." });
  }

  try {
    const analytics = await resolveAdminUserAnalytics({
      userId,
      logStripeLookupException: async ({ error, metadata }) => {
        await logApiRouteException({
          req,
          error,
          routeLabel: "admin/users/analytics.stripe",
          user: adminUser,
          metadata,
        });
      },
    });
    return res.status(200).json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "User not found.") {
      return res.status(404).json({ error: message });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/users/analytics",
      user: adminUser,
      metadata: {
        user_id: userId,
      },
    });
    return res.status(500).json({
      error: message || "Failed to load user analytics.",
    });
  }
}
