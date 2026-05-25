import type { NextApiRequest, NextApiResponse } from "next";
import {
  ISSUE_REPORT_EMAIL_MAX_LENGTH,
  ISSUE_REPORT_MESSAGE_MAX_LENGTH,
  ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH,
  ISSUE_REPORT_USER_AGENT_MAX_LENGTH,
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
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

  const message = toTrimmedString(req.body?.message, ISSUE_REPORT_MESSAGE_MAX_LENGTH);
  if (!message) {
    return res.status(400).json({ error: "Please describe the issue you ran into." });
  }

  const sourcePath = toTrimmedString(req.body?.sourcePath, ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH);
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
