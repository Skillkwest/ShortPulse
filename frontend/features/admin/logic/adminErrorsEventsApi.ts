import type {
  AdminErrorEventIncidentFilter,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorEventsHealth,
  AdminErrorEventSummary,
  AdminErrorLogRow,
  AdminErrorSummary,
  AdminPagination,
} from "../types";

export const ERRORS_PER_PAGE = 50;
export const ERROR_EVENTS_PER_PAGE = 50;
export const DEFAULT_ERROR_EVENTS_SUMMARY: AdminErrorEventSummary = {
  admissionDeniedTelemetry: {
    last15m: {
      total: 0,
      byTier: { video_long: 0, image_heavy: 0, image_standard: 0, unknown: 0 },
      byReason: { global_limit: 0, tier_limit: 0, global_and_tier_limit: 0, unknown: 0 },
      byScope: { per_user: 0, shared_provider: 0, unknown: 0 },
    },
    lastHour: {
      total: 0,
      byTier: { video_long: 0, image_heavy: 0, image_standard: 0, unknown: 0 },
      byReason: { global_limit: 0, tier_limit: 0, global_and_tier_limit: 0, unknown: 0 },
      byScope: { per_user: 0, shared_provider: 0, unknown: 0 },
    },
    last24h: {
      total: 0,
      byTier: { video_long: 0, image_heavy: 0, image_standard: 0, unknown: 0 },
      byReason: { global_limit: 0, tier_limit: 0, global_and_tier_limit: 0, unknown: 0 },
      byScope: { per_user: 0, shared_provider: 0, unknown: 0 },
    },
  },
  last15mCount: 0,
  high15mCount: 0,
  generation15mCount: 0,
  providerRunningTimeout15mCount: 0,
  lastHourCount: 0,
  last24hCount: 0,
  app24hCount: 0,
  generation24hCount: 0,
  high24hCount: 0,
  characterModeReferenceRefreshEmptyLastHourCount: 0,
  characterModeReferenceRefreshEmptyLast24hCount: 0,
  characterModeBundleUnavailableFallbackLastHourCount: 0,
  characterModeBundleUnavailableFallbackLast24hCount: 0,
  projectWorkspaceRepairPendingLastHourCount: 0,
  projectWorkspaceRepairPendingLast24hCount: 0,
  total15mThreshold: 40,
  high15mThreshold: 8,
  generation15mThreshold: 20,
  providerRunningTimeout15mThreshold: 2,
  total15mBreached: false,
  high15mBreached: false,
  generation15mBreached: false,
  providerRunningTimeout15mBreached: false,
};

export const DEFAULT_ERROR_EVENTS_HEALTH: AdminErrorEventsHealth = {
  eventsTableAvailable: true,
  degraded: false,
  reason: null,
};

type ErrorLoadOverrides = {
  page?: number;
  status?: "open" | "all";
  scope?: "all" | "app" | "generation";
  severity?: "all" | "high" | "medium" | "low";
  source?: string;
  search?: string;
};

type ErrorEventsLoadOverrides = {
  page?: number;
  scope?: "all" | "app" | "generation";
  severity?: "all" | "high" | "medium" | "low";
  source?: string;
  synthetic?: "all" | "exclude" | "only";
  signal?: AdminErrorEventSignalFilter;
  incident?: AdminErrorEventIncidentFilter;
  search?: string;
};

type NormalizedAdminErrorsResponse = {
  rows: AdminErrorLogRow[];
  summary: AdminErrorSummary;
  pagination: AdminPagination;
};

type NormalizedAdminErrorEventsResponse = {
  rows: AdminErrorEventRow[];
  summary: AdminErrorEventSummary;
  health: AdminErrorEventsHealth;
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

const toMetadataRecordOrNull = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toScope = (value: unknown): "app" | "generation" =>
  value === "generation" ? "generation" : "app";

const toSeverity = (value: unknown): "low" | "medium" | "high" =>
  value === "high" || value === "low" ? value : "medium";

const toStatus = (value: unknown): "open" | "resolved" | "ignored" =>
  value === "resolved" || value === "ignored" ? value : "open";

const toIncidentStatus = (value: unknown): "open" | "resolved" | "ignored" | null =>
  value === "resolved" || value === "ignored" ? value : value === "open" ? "open" : null;

const buildPagination = (
  pagination: Partial<AdminPagination> | undefined,
  page: number,
  perPage: number
): AdminPagination => ({
  page: toFiniteNumber(pagination?.page, page),
  perPage: toFiniteNumber(pagination?.perPage, perPage),
  totalCount: toFiniteNumber(pagination?.totalCount, 0),
  totalPages: toFiniteNumber(pagination?.totalPages, 1),
  hasNextPage: Boolean(pagination?.hasNextPage),
  hasPrevPage: Boolean(pagination?.hasPrevPage),
});

export const buildAdminErrorsParams = (overrides: ErrorLoadOverrides): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", String(overrides.page ?? 1));
  params.set("limit", String(ERRORS_PER_PAGE));
  params.set("status", overrides.status ?? "open");
  if (overrides.scope && overrides.scope !== "all") params.set("scope", overrides.scope);
  if (overrides.severity && overrides.severity !== "all") {
    params.set("severity", overrides.severity);
  }
  if (overrides.source && overrides.source !== "all") params.set("source", overrides.source);
  if (overrides.search?.trim()) params.set("search", overrides.search.trim());
  return params;
};

export const buildAdminErrorEventsParams = (
  overrides: ErrorEventsLoadOverrides
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", String(overrides.page ?? 1));
  params.set("limit", String(ERROR_EVENTS_PER_PAGE));
  if (overrides.scope && overrides.scope !== "all") params.set("scope", overrides.scope);
  if (overrides.severity && overrides.severity !== "all") {
    params.set("severity", overrides.severity);
  }
  if (overrides.source && overrides.source !== "all") params.set("source", overrides.source);
  if (overrides.synthetic && overrides.synthetic !== "all") {
    params.set("synthetic", overrides.synthetic);
  }
  if (overrides.signal && overrides.signal !== "all") params.set("signal", overrides.signal);
  if (overrides.incident && overrides.incident !== "all") {
    params.set("incident", overrides.incident);
  }
  if (overrides.search?.trim()) params.set("search", overrides.search.trim());
  return params;
};

export const normalizeAdminErrorsResponse = (
  data: {
    errors?: unknown[];
    summary?: Partial<AdminErrorSummary>;
    pagination?: Partial<AdminPagination>;
  },
  activePage: number
): NormalizedAdminErrorsResponse => ({
  rows: (data.errors ?? []).map((item) => {
    const value = toObjectRecord(item);
    return {
      id: String(value.id ?? ""),
      fingerprint: String(value.fingerprint ?? ""),
      source: String(value.source ?? "unknown"),
      scope: toScope(value.scope),
      severity: toSeverity(value.severity),
      status: toStatus(value.status),
      message: String(value.message ?? "Unknown error"),
      stack: toStringOrNull(value.stack),
      route: toStringOrNull(value.route),
      endpoint: toStringOrNull(value.endpoint),
      requestId: toStringOrNull(value.request_id),
      httpStatus: Number.isFinite(Number(value.http_status)) ? Number(value.http_status) : null,
      userId: toStringOrNull(value.user_id),
      userEmail: toStringOrNull(value.user_email),
      metadata: toMetadataRecordOrNull(value.metadata),
      firstSeenAt: toStringOrNull(value.first_seen_at),
      lastSeenAt: toStringOrNull(value.last_seen_at),
      occurrencesCount: toFiniteNumber(value.occurrences_count, 1),
    };
  }),
  summary: {
    openCount: toFiniteNumber(data.summary?.openCount, 0),
    highSeverityOpenCount: toFiniteNumber(data.summary?.highSeverityOpenCount, 0),
    last24hCount: toFiniteNumber(data.summary?.last24hCount, 0),
    appOpenCount: toFiniteNumber(data.summary?.appOpenCount, 0),
    generationOpenCount: toFiniteNumber(data.summary?.generationOpenCount, 0),
  },
  pagination: buildPagination(data.pagination, activePage, ERRORS_PER_PAGE),
});

export const normalizeAdminErrorEventRow = (item: unknown): AdminErrorEventRow => {
  const value = toObjectRecord(item);
  return {
    id: String(value.id ?? ""),
    incidentId: toStringOrNull(value.incident_id),
    incidentStatus: toIncidentStatus(value.incident_status),
    fingerprint: String(value.fingerprint ?? ""),
    source: String(value.source ?? "unknown"),
    scope: toScope(value.scope),
    severity: toSeverity(value.severity),
    message: String(value.message ?? "Unknown error event"),
    stack: toStringOrNull(value.stack),
    route: toStringOrNull(value.route),
    endpoint: toStringOrNull(value.endpoint),
    requestId: toStringOrNull(value.request_id),
    httpStatus: Number.isFinite(Number(value.http_status)) ? Number(value.http_status) : null,
    userId: toStringOrNull(value.user_id),
    userEmail: toStringOrNull(value.user_email),
    metadata: toMetadataRecordOrNull(value.metadata),
    occurredAt: toStringOrNull(value.occurred_at),
    createdAt: toStringOrNull(value.created_at),
  };
};

export const normalizeAdminErrorEventsResponse = (
  data: {
    events?: unknown[];
    summary?: Partial<AdminErrorEventSummary>;
    health?: Partial<AdminErrorEventsHealth>;
    pagination?: Partial<AdminPagination>;
  },
  activePage: number
): NormalizedAdminErrorEventsResponse => ({
  rows: (data.events ?? []).map((item) => normalizeAdminErrorEventRow(item)),
  summary: {
    admissionDeniedTelemetry:
      data.summary?.admissionDeniedTelemetry ??
      DEFAULT_ERROR_EVENTS_SUMMARY.admissionDeniedTelemetry,
    last15mCount: toFiniteNumber(data.summary?.last15mCount, 0),
    high15mCount: toFiniteNumber(data.summary?.high15mCount, 0),
    generation15mCount: toFiniteNumber(data.summary?.generation15mCount, 0),
    providerRunningTimeout15mCount: toFiniteNumber(data.summary?.providerRunningTimeout15mCount, 0),
    lastHourCount: toFiniteNumber(data.summary?.lastHourCount, 0),
    last24hCount: toFiniteNumber(data.summary?.last24hCount, 0),
    app24hCount: toFiniteNumber(data.summary?.app24hCount, 0),
    generation24hCount: toFiniteNumber(data.summary?.generation24hCount, 0),
    high24hCount: toFiniteNumber(data.summary?.high24hCount, 0),
    characterModeReferenceRefreshEmptyLastHourCount: toFiniteNumber(
      data.summary?.characterModeReferenceRefreshEmptyLastHourCount,
      0
    ),
    characterModeReferenceRefreshEmptyLast24hCount: toFiniteNumber(
      data.summary?.characterModeReferenceRefreshEmptyLast24hCount,
      0
    ),
    characterModeBundleUnavailableFallbackLastHourCount: toFiniteNumber(
      data.summary?.characterModeBundleUnavailableFallbackLastHourCount,
      0
    ),
    characterModeBundleUnavailableFallbackLast24hCount: toFiniteNumber(
      data.summary?.characterModeBundleUnavailableFallbackLast24hCount,
      0
    ),
    projectWorkspaceRepairPendingLastHourCount: toFiniteNumber(
      data.summary?.projectWorkspaceRepairPendingLastHourCount,
      0
    ),
    projectWorkspaceRepairPendingLast24hCount: toFiniteNumber(
      data.summary?.projectWorkspaceRepairPendingLast24hCount,
      0
    ),
    total15mThreshold: toFiniteNumber(data.summary?.total15mThreshold, 40),
    high15mThreshold: toFiniteNumber(data.summary?.high15mThreshold, 8),
    generation15mThreshold: toFiniteNumber(data.summary?.generation15mThreshold, 20),
    providerRunningTimeout15mThreshold: toFiniteNumber(
      data.summary?.providerRunningTimeout15mThreshold,
      2
    ),
    total15mBreached: Boolean(data.summary?.total15mBreached),
    high15mBreached: Boolean(data.summary?.high15mBreached),
    generation15mBreached: Boolean(data.summary?.generation15mBreached),
    providerRunningTimeout15mBreached: Boolean(data.summary?.providerRunningTimeout15mBreached),
  },
  health: {
    eventsTableAvailable: Boolean(data.health?.eventsTableAvailable ?? true),
    degraded: Boolean(data.health?.degraded ?? false),
    reason: typeof data.health?.reason === "string" ? data.health.reason : null,
  },
  pagination: buildPagination(data.pagination, activePage, ERROR_EVENTS_PER_PAGE),
});
