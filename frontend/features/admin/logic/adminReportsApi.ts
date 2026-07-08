import type { IssueReportStatus } from "../../../lib/issueReports";
import { ISSUE_REPORT_PAGE_SIZE, isIssueReportStatus } from "../../../lib/issueReports";
import type {
  AdminIssueReportFilter,
  AdminIssueReportRow,
  AdminIssueReportSummary,
  AdminPagination,
} from "../types";

type AdminReportsLoadOverrides = {
  page?: number;
  status?: AdminIssueReportFilter;
  search?: string;
};

type NormalizedAdminReportsResponse = {
  rows: AdminIssueReportRow[];
  summary: AdminIssueReportSummary;
  pagination: AdminPagination;
};

export const DEFAULT_ADMIN_ISSUE_REPORT_SUMMARY: AdminIssueReportSummary = {
  totalCount: 0,
  openCount: 0,
  newCount: 0,
  reviewingCount: 0,
  resolvedCount: 0,
};

const toObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const toStatus = (value: unknown): IssueReportStatus =>
  isIssueReportStatus(value) ? value : "new";

const normalizeScreenshots = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = toObjectRecord(item);
    return {
      id: String(row.id ?? ""),
      storagePath: String(row.storage_path ?? ""),
      signedUrl: toStringOrNull(row.signed_url),
      unavailableReason: toStringOrNull(row.unavailable_reason),
      originalFilename: String(row.original_filename ?? "screenshot"),
      contentType: String(row.content_type ?? ""),
      fileSizeBytes: toFiniteNumber(row.file_size_bytes, 0),
      width: toFiniteNumberOrNull(row.width),
      height: toFiniteNumberOrNull(row.height),
      displayOrder: toFiniteNumber(row.display_order, 0),
      createdAt: String(row.created_at ?? ""),
    };
  });
};

const buildPagination = (
  pagination: Partial<AdminPagination> | undefined,
  page: number
): AdminPagination => ({
  page: toFiniteNumber(pagination?.page, page),
  perPage: toFiniteNumber(pagination?.perPage, ISSUE_REPORT_PAGE_SIZE),
  totalCount: toFiniteNumber(pagination?.totalCount, 0),
  totalPages: toFiniteNumber(pagination?.totalPages, 1),
  hasNextPage: Boolean(pagination?.hasNextPage),
  hasPrevPage: Boolean(pagination?.hasPrevPage),
});

export const buildAdminReportsParams = (overrides: AdminReportsLoadOverrides): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", String(overrides.page ?? 1));
  params.set("limit", String(ISSUE_REPORT_PAGE_SIZE));
  if (overrides.status && overrides.status !== "all") {
    params.set("status", overrides.status);
  }
  if (overrides.search?.trim()) {
    params.set("search", overrides.search.trim());
  }
  return params;
};

export const normalizeAdminReportsResponse = (
  data: {
    reports?: unknown[];
    summary?: Partial<AdminIssueReportSummary>;
    pagination?: Partial<AdminPagination>;
  },
  activePage: number
): NormalizedAdminReportsResponse => ({
  rows: (data.reports ?? []).map((item) => {
    const value = toObjectRecord(item);
    return {
      id: String(value.id ?? ""),
      userId: toStringOrNull(value.user_id),
      submitterEmail: String(value.submitter_email ?? "Unknown"),
      message: String(value.message ?? ""),
      adminNotes: String(value.admin_notes ?? ""),
      status: toStatus(value.status),
      sourcePath: toStringOrNull(value.source_path),
      userAgent: toStringOrNull(value.user_agent),
      reviewedAt: toStringOrNull(value.reviewed_at),
      reviewedByUserId: toStringOrNull(value.reviewed_by_user_id),
      createdAt: String(value.created_at ?? ""),
      updatedAt: String(value.updated_at ?? ""),
      screenshots: normalizeScreenshots(value.screenshots),
    };
  }),
  summary: {
    totalCount: toFiniteNumber(data.summary?.totalCount, 0),
    openCount: toFiniteNumber(data.summary?.openCount, 0),
    newCount: toFiniteNumber(data.summary?.newCount, 0),
    reviewingCount: toFiniteNumber(data.summary?.reviewingCount, 0),
    resolvedCount: toFiniteNumber(data.summary?.resolvedCount, 0),
  },
  pagination: buildPagination(data.pagination, activePage),
});
