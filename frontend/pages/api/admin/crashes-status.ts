/**
 * Admin browser crash-session review API.
 * Updates operator review state while preserving crash evidence rows.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  updateBrowserCrashSessionReviewStatus,
  type BrowserCrashSessionReviewStatusRequest,
} from "../../../lib/server/api/browserCrashSessions";

const mapErrorToStatus = (error: unknown): number => {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "A browser crash session id is required." ||
    message === "status must be one of open, resolved, ignored."
  ) {
    return 400;
  }
  if (message === "Crash session not found.") return 404;
  return 500;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/crashes-status.auth",
    });
    return res.status(500).json({ error: "Unable to update crash session." });
  }
  if (!adminUser) return;

  try {
    const payload = (
      typeof req.body === "object" && req.body ? req.body : {}
    ) as BrowserCrashSessionReviewStatusRequest;
    const session = await updateBrowserCrashSessionReviewStatus({
      user: adminUser,
      payload,
    });
    return res.status(200).json({ ok: true, session });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/crashes-status.update",
      user: adminUser,
    });
    return res
      .status(mapErrorToStatus(error))
      .json({ error: error instanceof Error ? error.message : "Unable to update crash session." });
  }
}
