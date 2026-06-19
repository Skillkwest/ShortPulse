import type { NextApiRequest, NextApiResponse } from "next";
import {
  ISSUE_REPORT_EMAIL_MAX_LENGTH,
  ISSUE_REPORT_MESSAGE_MAX_LENGTH,
  ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH,
  ISSUE_REPORT_USER_AGENT_MAX_LENGTH,
  normalizeIssueReportSourcePath,
} from "../../lib/issueReports";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../lib/server/api/auth";
import { enforceApiRateLimit } from "../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../lib/server/api/supabaseAdmin";

const REPORT_ISSUE_RATE_LIMIT_MAX_REQUESTS = 5;
const REPORT_ISSUE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const toTrimmedString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const toRequiredMessage = (value: unknown): { value: string | null; tooLong: boolean } => {
  if (typeof value !== "string") {
    return { value: null, tooLong: false };
  }
  const normalized = value.trim();
  if (!normalized) {
    return { value: null, tooLong: false };
  }
  if (normalized.length > ISSUE_REPORT_MESSAGE_MAX_LENGTH) {
    return { value: null, tooLong: true };
  }
  return { value: normalized, tooLong: false };
};

const toOptionalSourcePath = (
  value: unknown
): {
  value: string | null;
  tooLong: boolean;
  invalid: boolean;
} => {
  if (typeof value !== "string") {
    return { value: null, tooLong: false, invalid: false };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { value: null, tooLong: false, invalid: false };
  }

  if (normalized.length > ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH) {
    return { value: null, tooLong: true, invalid: false };
  }

  const sourcePath = normalizeIssueReportSourcePath(normalized);
  if (!sourcePath) {
    return { value: null, tooLong: false, invalid: true };
  }

  return { value: sourcePath, tooLong: false, invalid: false };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.report-issue.auth",
    });
    return res.status(500).json({ error: "Unable to save your report right now." });
  }
  if (!user) {
    return;
  }

  if (
    !enforceApiRateLimit(req, res, {
      keyPrefix: `report-issue:${user.id}`,
      maxRequests: REPORT_ISSUE_RATE_LIMIT_MAX_REQUESTS,
      windowMs: REPORT_ISSUE_RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return;
  }

  const submitterEmail = toTrimmedString(user.email, ISSUE_REPORT_EMAIL_MAX_LENGTH);
  if (!submitterEmail) {
    return res
      .status(400)
      .json({ error: "Your account needs a valid email address to submit a report." });
  }

  const { value: message, tooLong: messageTooLong } = toRequiredMessage(req.body?.message);
  if (!message) {
    if (messageTooLong) {
      return res.status(400).json({
        error: `Issue reports must be ${ISSUE_REPORT_MESSAGE_MAX_LENGTH} characters or fewer.`,
      });
    }
    return res.status(400).json({ error: "Please describe the issue you ran into." });
  }

  const {
    value: sourcePath,
    tooLong: sourcePathTooLong,
    invalid: sourcePathInvalid,
  } = toOptionalSourcePath(req.body?.sourcePath);
  if (sourcePathTooLong) {
    return res.status(400).json({
      error: `Issue context paths must be ${ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH} characters or fewer.`,
    });
  }
  if (sourcePathInvalid) {
    return res.status(400).json({
      error: "Issue context paths must be a valid ShortPulse route.",
    });
  }

  const userAgent = toTrimmedString(req.headers["user-agent"], ISSUE_REPORT_USER_AGENT_MAX_LENGTH);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("user_issue_reports")
      .insert({
        user_id: user.id,
        submitter_email: submitterEmail,
        message,
        source_path: sourcePath,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api.report-issue.insert",
        user,
      });
      return res.status(500).json({ error: "Unable to save your report right now." });
    }

    return res.status(200).json({
      ok: true,
      reportId: typeof data?.id === "string" ? data.id : null,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.report-issue",
      user,
    });
    return res.status(500).json({ error: "Unable to save your report right now." });
  }
}
