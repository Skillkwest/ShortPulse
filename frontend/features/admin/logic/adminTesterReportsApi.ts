/**
 * Helpers for the admin tester-reports API contract.
 */
import {
  TESTER_REPORT_PAGE_SIZE,
  isHyberveesReviewStatus,
  isTesterReportStatus,
  type HyberveesReviewStatus,
  type TesterReportStatus,
} from "../../../lib/testerReports";
import type { AdminPagination, AdminTesterReportRunRow, AdminTesterReportSummary } from "../types";

type AdminTesterReportsLoadOverrides = {
  page?: number;
  status?: "all" | TesterReportStatus;
  tester?: string;
  search?: string;
};

type NormalizedAdminTesterReportsResponse = {
  rows: AdminTesterReportRunRow[];
  summary: AdminTesterReportSummary;
  pagination: AdminPagination;
};

export const DEFAULT_ADMIN_TESTER_REPORT_SUMMARY: AdminTesterReportSummary = {
  totalCount: 0,
  completedCount: 0,
  blockedCount: 0,
  failedCount: 0,
  partialCount: 0,
};

const toObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const toStatus = (value: unknown): TesterReportStatus =>
  isTesterReportStatus(value) ? value : "completed";

const toHyberveesReviewStatus = (value: unknown): HyberveesReviewStatus =>
  isHyberveesReviewStatus(value) ? value : "unreviewed";

const toCreatedBySource = (value: unknown): "tester_agent" | "automation" | "admin" => {
  if (value === "automation" || value === "admin") return value;
  return "tester_agent";
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

const buildPagination = (
  pagination: Partial<AdminPagination> | undefined,
  page: number
): AdminPagination => ({
  page: toFiniteNumber(pagination?.page, page),
  perPage: toFiniteNumber(pagination?.perPage, TESTER_REPORT_PAGE_SIZE),
  totalCount: toFiniteNumber(pagination?.totalCount, 0),
  totalPages: toFiniteNumber(pagination?.totalPages, 1),
  hasNextPage: Boolean(pagination?.hasNextPage),
  hasPrevPage: Boolean(pagination?.hasPrevPage),
});

export const buildAdminTesterReportsParams = (
  overrides: AdminTesterReportsLoadOverrides
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", String(overrides.page ?? 1));
  params.set("limit", String(TESTER_REPORT_PAGE_SIZE));
  if (overrides.status && overrides.status !== "all") {
    params.set("status", overrides.status);
  }
  if (overrides.tester?.trim()) {
    params.set("tester", overrides.tester.trim());
  }
  if (overrides.search?.trim()) {
    params.set("search", overrides.search.trim());
  }
  return params;
};

export const normalizeAdminTesterReportsResponse = (
  data: {
    reports?: unknown[];
    summary?: Partial<AdminTesterReportSummary>;
    pagination?: Partial<AdminPagination>;
  },
  activePage: number
): NormalizedAdminTesterReportsResponse => ({
  rows: (data.reports ?? []).map((item) => {
    const value = toObjectRecord(item);
    return {
      id: String(value.id ?? ""),
      externalRunId: String(value.external_run_id ?? ""),
      testerSlug: String(value.tester_slug ?? ""),
      testerDisplayName: String(value.tester_display_name ?? "Unknown tester"),
      shortpulseUserId: toStringOrNull(value.shortpulse_user_id),
      shortpulseUserEmail: toStringOrNull(value.shortpulse_user_email),
      scenario: String(value.scenario ?? ""),
      status: toStatus(value.status),
      runStartedAt: toStringOrNull(value.run_started_at),
      runFinishedAt: toStringOrNull(value.run_finished_at),
      durationMinutes: toNullableNumber(value.duration_minutes),
      creditsSpent: toNullableNumber(value.credits_spent),
      productionSurface: toStringOrNull(value.production_surface),
      personaReportTitle: String(value.persona_report_title ?? "Persona report"),
      personaReportBody: String(value.persona_report_body ?? ""),
      engineeringReportTitle: String(value.engineering_report_title ?? "Engineering handoff"),
      engineeringReportBody: String(value.engineering_report_body ?? ""),
      reportArtifactPaths: toStringArray(value.report_artifact_paths),
      evidence: toObjectRecord(value.evidence),
      hyberveesReviewStatus: toHyberveesReviewStatus(value.hybervees_review_status),
      hyberveesReviewedAt: toStringOrNull(value.hybervees_reviewed_at),
      hyberveesReviewedBy: toStringOrNull(value.hybervees_reviewed_by),
      hyberveesInsightSummary: toStringOrNull(value.hybervees_insight_summary),
      hyberveesInsightArtifactPath: toStringOrNull(value.hybervees_insight_artifact_path),
      createdBySource: toCreatedBySource(value.created_by_source),
      createdByUserId: toStringOrNull(value.created_by_user_id),
      createdByEmail: toStringOrNull(value.created_by_email),
      createdAt: String(value.created_at ?? ""),
      updatedAt: String(value.updated_at ?? ""),
    };
  }),
  summary: {
    totalCount: toFiniteNumber(data.summary?.totalCount, 0),
    completedCount: toFiniteNumber(data.summary?.completedCount, 0),
    blockedCount: toFiniteNumber(data.summary?.blockedCount, 0),
    failedCount: toFiniteNumber(data.summary?.failedCount, 0),
    partialCount: toFiniteNumber(data.summary?.partialCount, 0),
  },
  pagination: buildPagination(data.pagination, activePage),
});
