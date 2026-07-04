/**
 * Internal API: ingest completed tester-run reports into the admin tester log.
 */
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  TESTER_REPORT_BODY_MAX_LENGTH,
  TESTER_REPORT_EMAIL_MAX_LENGTH,
  TESTER_REPORT_EXTERNAL_RUN_ID_MAX_LENGTH,
  TESTER_REPORT_SCENARIO_MAX_LENGTH,
  TESTER_REPORT_SURFACE_MAX_LENGTH,
  TESTER_REPORT_TESTER_DISPLAY_NAME_MAX_LENGTH,
  TESTER_REPORT_TITLE_MAX_LENGTH,
  normalizeTesterReportStatus,
  normalizeTesterReportText,
  normalizeTesterReportUuid,
  normalizeTesterSlug,
} from "../../../../lib/testerReports";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type IngestErrorResponse = {
  error: string;
};

type IngestSuccessResponse = {
  ok: true;
  reportRunId: string | null;
  externalRunId: string;
};

const secureCompare = (left: string, right: string): boolean => {
  try {
    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  } catch {
    return false;
  }
};

const readHeader = (req: NextApiRequest, name: string): string | null => {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
};

const readBearerToken = (req: NextApiRequest): string | null => {
  const authHeader = readHeader(req, "authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.trim().toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length ? trimmed : null;
};

const isAuthorized = (req: NextApiRequest): boolean => {
  const expected = process.env.SHORTPULSE_TESTER_REPORT_INGEST_SECRET?.trim();
  if (!expected) return false;

  const headerSecret = readHeader(req, "x-shortpulse-tester-report-secret");
  const bearerToken = readBearerToken(req);
  return [headerSecret, bearerToken].some((candidate) =>
    candidate ? secureCompare(candidate, expected) : false
  );
};

const toObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toOptionalIsoString = (
  value: unknown,
  fieldName: string
): { value: string | null; error: string | null } => {
  if (typeof value === "undefined" || value === null || value === "") {
    return { value: null, error: null };
  }
  if (typeof value !== "string") {
    return { value: null, error: `${fieldName} must be an ISO timestamp string.` };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, error: `${fieldName} must be a valid ISO timestamp.` };
  }
  return { value: parsed.toISOString(), error: null };
};

const toOptionalNonNegativeInteger = (
  value: unknown,
  fieldName: string
): { value: number | null; error: string | null } => {
  if (typeof value === "undefined" || value === null || value === "") {
    return { value: null, error: null };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, error: `${fieldName} must be a non-negative number.` };
  }
  return { value: Math.trunc(parsed), error: null };
};

const toArtifactPaths = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
};

const toEvidence = (value: unknown): Record<string, unknown> => toObject(value) ?? {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IngestSuccessResponse | IngestErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = toObject(req.body);
  if (!body) {
    return res.status(400).json({ error: "Expected a JSON object payload." });
  }

  const externalRunId = normalizeTesterReportText(
    body.externalRunId,
    TESTER_REPORT_EXTERNAL_RUN_ID_MAX_LENGTH
  );
  const testerSlug = normalizeTesterSlug(body.testerSlug);
  const testerDisplayName = normalizeTesterReportText(
    body.testerDisplayName,
    TESTER_REPORT_TESTER_DISPLAY_NAME_MAX_LENGTH
  );
  const shortpulseUserId = normalizeTesterReportUuid(body.shortpulseUserId);
  const shortpulseUserEmail = normalizeTesterReportText(
    body.shortpulseUserEmail,
    TESTER_REPORT_EMAIL_MAX_LENGTH,
    true
  );
  const scenario = normalizeTesterReportText(body.scenario, TESTER_REPORT_SCENARIO_MAX_LENGTH);
  const status = normalizeTesterReportStatus(body.status);
  const productionSurface = normalizeTesterReportText(
    body.productionSurface,
    TESTER_REPORT_SURFACE_MAX_LENGTH,
    true
  );
  const personaReportTitle =
    normalizeTesterReportText(body.personaReportTitle, TESTER_REPORT_TITLE_MAX_LENGTH, true) ??
    "Persona report";
  const personaReportBody = normalizeTesterReportText(
    body.personaReportBody,
    TESTER_REPORT_BODY_MAX_LENGTH
  );
  const engineeringReportTitle =
    normalizeTesterReportText(body.engineeringReportTitle, TESTER_REPORT_TITLE_MAX_LENGTH, true) ??
    "Engineering handoff";
  const engineeringReportBody = normalizeTesterReportText(
    body.engineeringReportBody,
    TESTER_REPORT_BODY_MAX_LENGTH
  );
  const startedAt = toOptionalIsoString(body.runStartedAt, "runStartedAt");
  const finishedAt = toOptionalIsoString(body.runFinishedAt, "runFinishedAt");
  const durationMinutes = toOptionalNonNegativeInteger(body.durationMinutes, "durationMinutes");
  const creditsSpent = toOptionalNonNegativeInteger(body.creditsSpent, "creditsSpent");

  if (!externalRunId) return res.status(400).json({ error: "externalRunId is required." });
  if (!testerSlug) return res.status(400).json({ error: "testerSlug is required." });
  if (!testerDisplayName) {
    return res.status(400).json({ error: "testerDisplayName is required." });
  }
  if (body.shortpulseUserId && !shortpulseUserId) {
    return res.status(400).json({ error: "shortpulseUserId must be a valid UUID." });
  }
  if (!shortpulseUserId && !shortpulseUserEmail) {
    return res.status(400).json({ error: "A tested ShortPulse account is required." });
  }
  if (!scenario) return res.status(400).json({ error: "scenario is required." });
  if (!status) return res.status(400).json({ error: "Invalid tester report status." });
  if (!personaReportBody) {
    return res.status(400).json({ error: "personaReportBody is required." });
  }
  if (!engineeringReportBody) {
    return res.status(400).json({ error: "engineeringReportBody is required." });
  }
  if (startedAt.error) return res.status(400).json({ error: startedAt.error });
  if (finishedAt.error) return res.status(400).json({ error: finishedAt.error });
  if (durationMinutes.error) return res.status(400).json({ error: durationMinutes.error });
  if (creditsSpent.error) return res.status(400).json({ error: creditsSpent.error });
  if (startedAt.value && finishedAt.value && finishedAt.value < startedAt.value) {
    return res.status(400).json({ error: "runFinishedAt must be after runStartedAt." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("tester_report_runs")
      .upsert(
        {
          external_run_id: externalRunId,
          tester_slug: testerSlug,
          tester_display_name: testerDisplayName,
          shortpulse_user_id: shortpulseUserId || null,
          shortpulse_user_email: shortpulseUserEmail || null,
          scenario,
          status,
          run_started_at: startedAt.value,
          run_finished_at: finishedAt.value,
          duration_minutes: durationMinutes.value,
          credits_spent: creditsSpent.value,
          production_surface: productionSurface || null,
          persona_report_title: personaReportTitle,
          persona_report_body: personaReportBody,
          engineering_report_title: engineeringReportTitle,
          engineering_report_body: engineeringReportBody,
          report_artifact_paths: toArtifactPaths(body.reportArtifactPaths),
          evidence: toEvidence(body.evidence),
          created_by_source: "tester_agent",
        },
        { onConflict: "external_run_id" }
      )
      .select("id, external_run_id")
      .single();

    if (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api.internal.tester-reports.ingest.upsert",
      });
      return res.status(500).json({ error: "Unable to save tester report run." });
    }

    return res.status(200).json({
      ok: true,
      reportRunId: typeof data?.id === "string" ? data.id : null,
      externalRunId,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.internal.tester-reports.ingest",
    });
    return res.status(500).json({ error: "Unable to save tester report run." });
  }
}
