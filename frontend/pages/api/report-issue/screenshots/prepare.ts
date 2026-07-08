/**
 * Authenticated API for preparing direct customer issue-report screenshot uploads.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../../lib/server/api/auth";
import {
  cleanupStaleIssueReportScreenshotUploadsForUser,
  IssueReportScreenshotError,
  prepareIssueReportScreenshotUpload,
  type PreparedIssueReportScreenshotUpload,
} from "../../../../lib/server/api/issueReportScreenshots";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

const SCREENSHOT_PREPARE_RATE_LIMIT_MAX_REQUESTS = 15;
const SCREENSHOT_PREPARE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type PrepareScreenshotResponse = {
  target: PreparedIssueReportScreenshotUpload;
};

type PrepareScreenshotErrorResponse = {
  error: string;
  details?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PrepareScreenshotResponse | PrepareScreenshotErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.report-issue.screenshots.prepare.auth",
    });
    return res.status(500).json({ error: "Unable to prepare screenshot upload." });
  }
  if (!user) {
    return;
  }

  if (
    !enforceApiRateLimit(req, res, {
      keyPrefix: `report-issue-screenshot-prepare:${user.id}`,
      maxRequests: SCREENSHOT_PREPARE_RATE_LIMIT_MAX_REQUESTS,
      windowMs: SCREENSHOT_PREPARE_RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as { sourceMimeType?: unknown; sourceSize?: unknown };
    const supabaseAdmin = getSupabaseAdmin();
    try {
      await cleanupStaleIssueReportScreenshotUploadsForUser(supabaseAdmin, { userId: user.id });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api.report-issue.screenshots.prepare.cleanup",
        user,
      });
    }
    const target = await prepareIssueReportScreenshotUpload(supabaseAdmin, {
      userId: user.id,
      sourceMimeType: body.sourceMimeType,
      sourceSize: body.sourceSize,
    });
    return res.status(200).json({ target });
  } catch (error) {
    if (error instanceof IssueReportScreenshotError) {
      return res.status(error.status).json({ error: error.message, details: error.details });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "api.report-issue.screenshots.prepare",
      user,
    });
    return res.status(500).json({ error: "Unable to prepare screenshot upload." });
  }
}
