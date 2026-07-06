/**
 * Admin API: mark tester reports as reviewed by Hybervees.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  HYBERVEES_REVIEW_ARTIFACT_PATH_MAX_LENGTH,
  HYBERVEES_REVIEW_SUMMARY_MAX_LENGTH,
  isHyberveesReviewStatus,
  normalizeTesterReportText,
  normalizeTesterReportUuid,
} from "../../../lib/testerReports";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

const REVIEW_COLUMNS =
  "id, hybervees_review_status, hybervees_reviewed_at, hybervees_reviewed_by, hybervees_insight_summary, hybervees_insight_artifact_path, updated_at";

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const mapErrorToStatus = (message: string): number => {
  if (
    message === "reportId is required." ||
    message === "Invalid Hybervees review status." ||
    message === "summary is too long." ||
    message === "insightArtifactPath is too long."
  ) {
    return 400;
  }
  if (message === "Tester report not found.") return 404;
  return 500;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.admin.tester-reports-review.auth",
    });
    return res.status(500).json({ error: "Unable to update tester report review." });
  }
  if (!adminUser) return;

  try {
    const body = toObject(req.body);
    const reportId = normalizeTesterReportUuid(body.reportId);
    const status = isHyberveesReviewStatus(body.status) ? body.status : null;
    const summary = normalizeTesterReportText(
      body.summary,
      HYBERVEES_REVIEW_SUMMARY_MAX_LENGTH,
      true
    );
    const insightArtifactPath = normalizeTesterReportText(
      body.insightArtifactPath,
      HYBERVEES_REVIEW_ARTIFACT_PATH_MAX_LENGTH,
      true
    );

    if (!reportId) throw new Error("reportId is required.");
    if (!status) throw new Error("Invalid Hybervees review status.");
    if (typeof body.summary === "string" && body.summary.trim() && summary === null) {
      throw new Error("summary is too long.");
    }
    if (
      typeof body.insightArtifactPath === "string" &&
      body.insightArtifactPath.trim() &&
      insightArtifactPath === null
    ) {
      throw new Error("insightArtifactPath is too long.");
    }

    const updatePayload =
      status === "reviewed"
        ? {
            hybervees_review_status: status,
            hybervees_reviewed_at: new Date().toISOString(),
            hybervees_reviewed_by: "hybervees",
            hybervees_insight_summary: summary || null,
            hybervees_insight_artifact_path: insightArtifactPath || null,
          }
        : {
            hybervees_review_status: status,
            hybervees_reviewed_at: null,
            hybervees_reviewed_by: null,
            hybervees_insight_summary: summary || null,
            hybervees_insight_artifact_path: insightArtifactPath || null,
          };

    const { data, error } = await getSupabaseAdmin()
      .from("tester_report_runs")
      .update(updatePayload)
      .eq("id", reportId)
      .select(REVIEW_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Tester report not found.");

    return res.status(200).json({ ok: true, report: data });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.admin.tester-reports-review.update",
      user: adminUser,
    });
    const message =
      error instanceof Error ? error.message : "Unable to update tester report review.";
    return res.status(mapErrorToStatus(message)).json({ error: message });
  }
}
