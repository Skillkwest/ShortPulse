import type { NextApiRequest, NextApiResponse } from "next";
import {
  ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH,
  isIssueReportStatus,
} from "../../../../lib/issueReports";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

const toTrimmedString = (value: unknown, maxLength: number, allowEmpty = false): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) return null;
  if (!normalized && !allowEmpty) return null;
  return normalized;
};

const getReportId = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.admin.reports.[reportId].auth",
    });
    return res.status(500).json({ error: "Unable to verify report access." });
  }
  if (!adminUser) {
    return;
  }

  const reportId = getReportId(req.query.reportId);
  if (!reportId) {
    return res.status(400).json({ error: "Missing report id." });
  }

  if (req.method === "GET") {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from("user_issue_reports")
        .select(
          "id, user_id, submitter_email, message, status, admin_notes, source_path, user_agent, reviewed_at, reviewed_by_user_id, created_at, updated_at"
        )
        .eq("id", reportId)
        .maybeSingle();

      if (error) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "api.admin.reports.[reportId].get",
          user: adminUser,
          metadata: {
            report_id: reportId,
          },
        });
        return res.status(500).json({ error: "Unable to load that report right now." });
      }
      if (!data) {
        return res.status(404).json({ error: "Report not found." });
      }

      return res.status(200).json({ report: data });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api.admin.reports.[reportId].get",
        user: adminUser,
      });
      return res.status(500).json({ error: "Unable to load that report right now." });
    }
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const nextStatus = req.body?.status;
  if (typeof req.body?.adminNotes !== "undefined" && typeof req.body.adminNotes !== "string") {
    return res.status(400).json({ error: "Admin notes must be a string." });
  }
  if (
    typeof req.body?.adminNotes === "string" &&
    req.body.adminNotes.trim().length > ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH
  ) {
    return res.status(400).json({
      error: `Admin notes must be ${ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH} characters or fewer.`,
    });
  }
  const nextAdminNotes =
    req.body && "adminNotes" in req.body
      ? toTrimmedString(req.body.adminNotes, ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH, true)
      : null;

  if (typeof nextStatus !== "undefined" && !isIssueReportStatus(nextStatus)) {
    return res.status(400).json({ error: "Invalid report status." });
  }

  if (typeof nextStatus === "undefined" && typeof req.body?.adminNotes === "undefined") {
    return res.status(400).json({ error: "No report changes were provided." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const updateValues: Record<string, unknown> = {
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: adminUser.id,
    };

    if (typeof nextStatus !== "undefined") {
      updateValues.status = nextStatus;
    }
    if (typeof req.body?.adminNotes !== "undefined") {
      updateValues.admin_notes = nextAdminNotes ?? "";
    }

    const { data, error } = await supabaseAdmin
      .from("user_issue_reports")
      .update(updateValues)
      .eq("id", reportId)
      .select(
        "id, user_id, submitter_email, message, status, admin_notes, source_path, user_agent, reviewed_at, reviewed_by_user_id, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api.admin.reports.[reportId].patch",
        user: adminUser,
        metadata: {
          report_id: reportId,
        },
      });
      return res.status(500).json({ error: "Unable to update that report right now." });
    }
    if (!data) {
      return res.status(404).json({ error: "Report not found." });
    }

    return res.status(200).json({ report: data });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.admin.reports.[reportId].patch",
      user: adminUser,
      metadata: {
        report_id: reportId,
      },
    });
    return res.status(500).json({ error: "Unable to update that report right now." });
  }
}
