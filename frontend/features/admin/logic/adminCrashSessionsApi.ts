/**
 * Admin crash-session API client and response normalizers.
 * Keeps `/admin/crashes` route code focused on state orchestration and display.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type {
  AdminCrashSessionConfidence,
  AdminCrashSessionRow,
  AdminCrashSessionReviewStatus,
  AdminCrashSessionStatus,
  AdminPagination,
} from "../types";

export const CRASH_SESSIONS_PER_PAGE = 50;

export type AdminCrashSessionStatusFilter = AdminCrashSessionStatus | "all" | "needs_review";
export type AdminCrashSessionReviewStatusFilter =
  | AdminCrashSessionReviewStatus
  | "reviewed"
  | "all";
export type AdminCrashSessionsViewMode = "needs_review" | "history" | "all_evidence";

export type NormalizedAdminCrashSessionsResponse = {
  rows: AdminCrashSessionRow[];
  pagination: AdminPagination;
};

const toObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const toMetadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toStatus = (value: unknown): AdminCrashSessionStatus => {
  if (
    value === "clean_closed" ||
    value === "possible_ungraceful_exit" ||
    value === "probable_freeze_or_crash" ||
    value === "confirmed_crash"
  ) {
    return value;
  }
  return "active";
};

const toConfidence = (value: unknown): AdminCrashSessionConfidence => {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "none";
};

const toReviewStatus = (value: unknown): AdminCrashSessionReviewStatus => {
  if (value === "resolved" || value === "ignored") return value;
  return "open";
};

const buildPagination = (pagination: Partial<AdminPagination> | undefined): AdminPagination => {
  const page = toFiniteNumber(pagination?.page, 1);
  const perPage = toFiniteNumber(pagination?.perPage, CRASH_SESSIONS_PER_PAGE);
  const totalCount = toFiniteNumber(pagination?.totalCount, 0);
  const totalPages = toFiniteNumber(pagination?.totalPages, 1);
  return {
    page,
    perPage,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

export const buildAdminCrashSessionsParams = (overrides: {
  page?: number;
  status?: AdminCrashSessionStatusFilter;
  reviewStatus?: AdminCrashSessionReviewStatusFilter;
  search?: string;
}): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", String(overrides.page ?? 1));
  params.set("limit", String(CRASH_SESSIONS_PER_PAGE));
  if (overrides.status && overrides.status !== "all") params.set("status", overrides.status);
  if (overrides.reviewStatus && overrides.reviewStatus !== "open") {
    params.set("reviewStatus", overrides.reviewStatus);
  }
  if (overrides.search?.trim()) params.set("search", overrides.search.trim());
  return params;
};

export const normalizeAdminCrashSessionsResponse = (data: {
  sessions?: unknown[];
  pagination?: Partial<AdminPagination>;
}): NormalizedAdminCrashSessionsResponse => ({
  rows: (data.sessions ?? []).map((item) => {
    const value = toObjectRecord(item);
    return {
      id: String(value.id ?? ""),
      browserSessionId: String(value.browser_session_id ?? ""),
      userId: toStringOrNull(value.user_id),
      userEmail: toStringOrNull(value.user_email),
      status: toStatus(value.status),
      confidence: toConfidence(value.confidence),
      effectiveStatus: toStatus(value.effective_status ?? value.status),
      effectiveConfidence: toConfidence(value.effective_confidence ?? value.confidence),
      isStale: Boolean(value.is_stale),
      lastEvent: String(value.last_event ?? "unknown"),
      route: toStringOrNull(value.route),
      buildId: toStringOrNull(value.build_id),
      clientRelease: toStringOrNull(value.client_release),
      clientEnvironment: toStringOrNull(value.client_environment),
      userAgent: toStringOrNull(value.user_agent),
      host: toStringOrNull(value.host),
      vercelId: toStringOrNull(value.vercel_id),
      metadata: toMetadataRecord(value.metadata),
      reviewStatus: toReviewStatus(value.review_status),
      reviewedAt: toStringOrNull(value.reviewed_at),
      reviewedBy: toStringOrNull(value.reviewed_by),
      reviewedByEmail: toStringOrNull(value.reviewed_by_email),
      reviewNote: toStringOrNull(value.review_note),
      startedAt: toStringOrNull(value.started_at),
      lastSeenAt: toStringOrNull(value.last_seen_at),
      endedAt: toStringOrNull(value.ended_at),
      suspectedAt: toStringOrNull(value.suspected_at),
      createdAt: toStringOrNull(value.created_at),
      updatedAt: toStringOrNull(value.updated_at),
    };
  }),
  pagination: buildPagination(data.pagination),
});

export const fetchAdminCrashSessions = async (overrides: {
  page?: number;
  status?: AdminCrashSessionStatusFilter;
  reviewStatus?: AdminCrashSessionReviewStatusFilter;
  search?: string;
}): Promise<NormalizedAdminCrashSessionsResponse> => {
  const params = buildAdminCrashSessionsParams(overrides);
  const response = await fetchWithAuth(`/api/admin/crashes?${params.toString()}`, {
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof data.error === "string" ? data.error : "Unable to load crash sessions.");
  }
  const data = (await response.json()) as {
    sessions?: unknown[];
    pagination?: Partial<AdminPagination>;
  };
  return normalizeAdminCrashSessionsResponse(data);
};

export const updateAdminCrashSessionReviewStatus = async (params: {
  sessionId: string;
  status: AdminCrashSessionReviewStatus;
  note?: string;
}): Promise<void> => {
  const response = await fetchWithAuth("/api/admin/crashes-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(
      typeof data.error === "string" ? data.error : "Unable to update crash session."
    );
  }
};
