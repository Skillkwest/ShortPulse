import type { NextApiRequest, NextApiResponse } from "next";
import type { AdminBillingDiagnosticsResponse } from "../../../features/admin/types";
import {
  AdminBillingDiagnosticsServiceError,
  isAdminBillingDiagnosticsUserId,
  resolveAdminBillingDiagnostics,
} from "../../../lib/server/api/adminBillingDiagnostics";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../lib/server/api/auth";

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | AdminBillingDiagnosticsResponse>
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
      routeLabel: "admin/billing-diagnostics.auth",
    });
    return res.status(500).json({ error: "Failed to load billing diagnostics." });
  }
  if (!adminUser) return;

  const userId = asSingleString(req.query.userId).trim();
  if (!isAdminBillingDiagnosticsUserId(userId)) {
    return res.status(400).json({ error: "A valid user id is required." });
  }

  try {
    const diagnostics = await resolveAdminBillingDiagnostics({
      userId,
      logStripeLookupException: async ({ error, metadata }) => {
        await logApiRouteException({
          req,
          error,
          routeLabel: "admin/billing-diagnostics",
          user: adminUser,
          metadata,
        });
      },
    });
    return res.status(200).json(diagnostics);
  } catch (error) {
    if (error instanceof AdminBillingDiagnosticsServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/billing-diagnostics",
      user: adminUser,
      metadata: {
        user_id: userId,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load billing diagnostics.",
    });
  }
}
