/**
 * Admin API: fetch raw app error events (every occurrence) for operator forensics.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_TOTAL_15M_THRESHOLD = 40;
const DEFAULT_HIGH_15M_THRESHOLD = 8;
const DEFAULT_GENERATION_15M_THRESHOLD = 20;
const APP_ERROR_EVENTS_MISSING_REASON =
  "app_error_events is unavailable; apply sql/migrations/015_add_app_error_events.sql.";
const TELEMETRY_SOURCE_PREFIX = "telemetry.";
const CHARACTER_MODE_TELEMETRY_SOURCE = "telemetry.character_mode";
const CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT = "character_mode_reference_refresh_empty";
const CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT =
  "character_mode_injection_fallback.bundle_unavailable";

type EventQuery = {
  eq: (column: string, value: string) => EventQuery;
  like: (column: string, value: string) => EventQuery;
  not: (column: string, operator: string, value: string) => EventQuery;
  gte: (column: string, value: string) => EventQuery;
  or: (filters: string) => EventQuery;
};

type ListQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type CountQueryResult = {
  count: number | null;
  error: { message: string } | null;
};

type EventRow = {
  id?: string;
  incident_id?: string | null;
  [key: string]: unknown;
};

type IncidentStatusRow = {
  id: string;
  status: "open" | "resolved" | "ignored";
};

type SyntheticFilterValue = "all" | "only" | "exclude";
type SignalFilterValue =
  | "all"
  | "character_mode_reference_refresh_empty"
  | "character_mode_bundle_unavailable_fallback";
type ErrorEventsHealth = {
  eventsTableAvailable: boolean;
  degraded: boolean;
  reason: string | null;
};

type EnrichedEventsResult = {
  events: unknown[];
  degraded: boolean;
  reason: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const asFilterValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const asSyntheticFilter = (value: unknown): SyntheticFilterValue => {
  const normalized = asFilterValue(value);
  if (normalized === "only" || normalized === "exclude") return normalized;
  return "all";
};

const asSignalFilter = (value: unknown): SignalFilterValue => {
  const normalized = asFilterValue(value);
  if (normalized === "character_mode_reference_refresh_empty") return normalized;
  if (normalized === "character_mode_bundle_unavailable_fallback") return normalized;
  return "all";
};

const normalizeSearchTerm = (value: unknown): string => {
  const normalized = asFilterValue(value);
  if (!normalized) return "";
  return normalized
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
};

const asThreshold = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const countOrZero = (result: CountQueryResult): number => Number(result.count ?? 0);

const countErrorMessage = (result: CountQueryResult): string | null =>
  result.error?.message ?? null;

const isMissingEventsTableError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  if (!normalized.includes("app_error_events")) return false;
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table") ||
    (normalized.includes("relation") && normalized.includes("does not exist"))
  );
};

const degradedHealth = (reason: string): ErrorEventsHealth => ({
  eventsTableAvailable: false,
  degraded: true,
  reason,
});

const healthyState = (): ErrorEventsHealth => ({
  eventsTableAvailable: true,
  degraded: false,
  reason: null,
});

const buildDegradedEventsPayload = (params: {
  perPage: number;
  total15mThreshold: number;
  high15mThreshold: number;
  generation15mThreshold: number;
  reason: string;
}) => ({
  events: [],
  summary: {
    last15mCount: 0,
    high15mCount: 0,
    generation15mCount: 0,
    lastHourCount: 0,
    last24hCount: 0,
    app24hCount: 0,
    generation24hCount: 0,
    high24hCount: 0,
    characterModeReferenceRefreshEmptyLastHourCount: 0,
    characterModeReferenceRefreshEmptyLast24hCount: 0,
    characterModeBundleUnavailableFallbackLastHourCount: 0,
    characterModeBundleUnavailableFallbackLast24hCount: 0,
    total15mThreshold: params.total15mThreshold,
    high15mThreshold: params.high15mThreshold,
    generation15mThreshold: params.generation15mThreshold,
    total15mBreached: false,
    high15mBreached: false,
    generation15mBreached: false,
  },
  health: degradedHealth(params.reason),
  pagination: {
    page: 1,
    perPage: params.perPage,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
});

const applyEventFilters = (
  query: EventQuery,
  filters: {
    scope: string;
    severity: string;
    source: string;
    search: string;
    synthetic: SyntheticFilterValue;
    signal: SignalFilterValue;
    excludeTelemetrySources: boolean;
  }
): EventQuery => {
  let next = query;
  if (filters.scope && filters.scope !== "all") {
    next = next.eq("scope", filters.scope);
  }
  if (filters.severity && filters.severity !== "all") {
    next = next.eq("severity", filters.severity);
  }
  if (filters.source && filters.source !== "all") {
    next = next.eq("source", filters.source);
  }
  if (filters.synthetic === "only") {
    next = next.like("source", "admin.synthetic_test.%");
  } else if (filters.synthetic === "exclude") {
    next = next.not("source", "like", "admin.synthetic_test.%");
  }
  if (filters.excludeTelemetrySources) {
    next = next.not("source", "like", `${TELEMETRY_SOURCE_PREFIX}%`);
  }
  if (filters.signal === "character_mode_reference_refresh_empty") {
    next = next
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq("message", CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT);
  } else if (filters.signal === "character_mode_bundle_unavailable_fallback") {
    next = next
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq("message", CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT);
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/\s+/g, "%")}%`;
    next = next.or(
      [
        `message.ilike.${pattern}`,
        `user_email.ilike.${pattern}`,
        `user_id.ilike.${pattern}`,
        `endpoint.ilike.${pattern}`,
        `route.ilike.${pattern}`,
        `request_id.ilike.${pattern}`,
        `source.ilike.${pattern}`,
        `fingerprint.ilike.${pattern}`,
        `incident_id.ilike.${pattern}`,
      ].join(",")
    );
  }
  return next;
};

const enrichEventsWithIncidentStatus = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  rows: unknown[] | null
): Promise<EnrichedEventsResult> => {
  const events = Array.isArray(rows) ? (rows as EventRow[]) : [];
  const incidentIds = Array.from(
    new Set(
      events
        .map((row) => (typeof row.incident_id === "string" ? row.incident_id : null))
        .filter((value): value is string => Boolean(value && UUID_PATTERN.test(value)))
    )
  );
  if (!incidentIds.length) {
    return {
      events: events.map((row) => ({ ...row, incident_status: null })),
      degraded: false,
      reason: null,
    };
  }

  try {
    const { data: incidentRowsRaw, error } = await supabaseAdmin
      .from("app_error_logs")
      .select("id, status")
      .in("id", incidentIds);
    if (error) {
      return {
        events: events.map((row) => ({ ...row, incident_status: null })),
        degraded: true,
        reason: "Unable to enrich event rows with incident status.",
      };
    }

    const incidentRows = (incidentRowsRaw as IncidentStatusRow[] | null) ?? [];
    const statusByIncidentId = new Map<string, "open" | "resolved" | "ignored">();
    for (const row of incidentRows) {
      if (!row?.id) continue;
      statusByIncidentId.set(row.id, row.status);
    }

    return {
      events: events.map((row) => {
        const incidentId = typeof row.incident_id === "string" ? row.incident_id : null;
        const incidentStatus = incidentId ? (statusByIncidentId.get(incidentId) ?? null) : null;
        return {
          ...row,
          incident_status: incidentStatus,
        };
      }),
      degraded: false,
      reason: null,
    };
  } catch {
    return {
      events: events.map((row) => ({ ...row, incident_status: null })),
      degraded: true,
      reason: "Unable to enrich event rows with incident status.",
    };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const page = asPositiveInt(req.query.page, 1);
    const limit = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    const filters = {
      scope: asFilterValue(req.query.scope),
      severity: asFilterValue(req.query.severity),
      source: asFilterValue(req.query.source),
      search: normalizeSearchTerm(req.query.search),
      synthetic: asSyntheticFilter(req.query.synthetic),
      signal: asSignalFilter(req.query.signal),
      excludeTelemetrySources: false,
    };
    const summaryFilters: {
      scope: string;
      severity: string;
      source: string;
      search: string;
      synthetic: SyntheticFilterValue;
      signal: SignalFilterValue;
      excludeTelemetrySources: boolean;
    } = {
      scope: "all",
      severity: "all",
      source: "all",
      search: "",
      // Operational summaries should reflect real traffic, not operator test events.
      synthetic: "exclude",
      signal: "all",
      excludeTelemetrySources: true,
    };
    const nowMs = Date.now();
    const since15mIso = new Date(nowMs - 15 * 60 * 1000).toISOString();
    const sinceHourIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
    const since24hIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    const total15mThreshold = asThreshold(
      process.env.SHORTPULSE_ADMIN_ALERT_TOTAL_15M,
      DEFAULT_TOTAL_15M_THRESHOLD
    );
    const high15mThreshold = asThreshold(
      process.env.SHORTPULSE_ADMIN_ALERT_HIGH_15M,
      DEFAULT_HIGH_15M_THRESHOLD
    );
    const generation15mThreshold = asThreshold(
      process.env.SHORTPULSE_ADMIN_ALERT_GENERATION_15M,
      DEFAULT_GENERATION_15M_THRESHOLD
    );

    const eventsQuery = applyEventFilters(
      supabaseAdmin
        .from("app_error_events")
        .select(
          "id, incident_id, fingerprint, source, scope, severity, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, occurred_at, created_at"
        )
        .order("occurred_at", { ascending: false })
        .range(offset, offset + limit - 1) as unknown as EventQuery,
      filters
    ) as unknown as Promise<ListQueryResult>;

    const filteredCountQuery = applyEventFilters(
      supabaseAdmin.from("app_error_events").select("id", {
        count: "exact",
        head: true,
      }) as unknown as EventQuery,
      filters
    ) as unknown as Promise<CountQueryResult>;

    const [
      eventsResult,
      filteredCountResult,
      last15mCountResult,
      high15mCountResult,
      generation15mCountResult,
      lastHourCountResult,
      last24hCountResult,
      app24hCountResult,
      generation24hCountResult,
      high24hCountResult,
      characterModeReferenceRefreshEmptyLastHourCountResult,
      characterModeReferenceRefreshEmptyLast24hCountResult,
      characterModeBundleUnavailableFallbackLastHourCountResult,
      characterModeBundleUnavailableFallbackLast24hCountResult,
    ] = await Promise.all([
      eventsQuery,
      filteredCountQuery,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", since15mIso) as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", since15mIso)
          .eq("severity", "high") as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", since15mIso)
          .eq("scope", "generation") as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", sinceHourIso) as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", since24hIso) as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", since24hIso)
          .eq("scope", "app") as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", since24hIso)
          .eq("scope", "generation") as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", since24hIso)
          .eq("severity", "high") as unknown as EventQuery,
        summaryFilters
      ) as unknown as Promise<CountQueryResult>,
      supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", sinceHourIso)
        .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
        .eq(
          "message",
          CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT
        ) as unknown as Promise<CountQueryResult>,
      supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", since24hIso)
        .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
        .eq(
          "message",
          CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT
        ) as unknown as Promise<CountQueryResult>,
      supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", sinceHourIso)
        .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
        .eq(
          "message",
          CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT
        ) as unknown as Promise<CountQueryResult>,
      supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", since24hIso)
        .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
        .eq(
          "message",
          CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT
        ) as unknown as Promise<CountQueryResult>,
    ]);

    if (eventsResult.error) {
      if (isMissingEventsTableError(eventsResult.error.message)) {
        return res.status(200).json(
          buildDegradedEventsPayload({
            perPage: limit,
            total15mThreshold,
            high15mThreshold,
            generation15mThreshold,
            reason: APP_ERROR_EVENTS_MISSING_REASON,
          })
        );
      }
      return res.status(500).json({
        error: eventsResult.error.message || "Unable to load error events.",
      });
    }

    let events = eventsResult.data ?? [];
    const eventRowsCount = Array.isArray(events) ? events.length : 0;
    const fallbackLikelyHasNextPage = eventRowsCount === limit;
    const hasFilteredCountError = Boolean(filteredCountResult.error);
    const totalCount = hasFilteredCountError
      ? offset + eventRowsCount + (fallbackLikelyHasNextPage ? 1 : 0)
      : Number(filteredCountResult.count ?? 0);
    const totalPages = hasFilteredCountError
      ? Math.max(1, page + (fallbackLikelyHasNextPage ? 1 : 0))
      : Math.max(1, Math.ceil(totalCount / limit));
    const resolvedPage = hasFilteredCountError
      ? page
      : totalCount > 0
        ? Math.min(page, totalPages)
        : 1;

    if (!hasFilteredCountError && resolvedPage !== page) {
      const fallbackOffset = (resolvedPage - 1) * limit;
      const fallbackResult = (await applyEventFilters(
        supabaseAdmin
          .from("app_error_events")
          .select(
            "id, incident_id, fingerprint, source, scope, severity, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, occurred_at, created_at"
          )
          .order("occurred_at", { ascending: false })
          .range(fallbackOffset, fallbackOffset + limit - 1) as unknown as EventQuery,
        filters
      )) as unknown as ListQueryResult;
      if (fallbackResult.error) {
        return res.status(500).json({ error: fallbackResult.error.message });
      }
      events = fallbackResult.data ?? [];
    }

    const enrichedEventsResult = await enrichEventsWithIncidentStatus(supabaseAdmin, events);
    const summaryErrorMessages = [
      countErrorMessage(last15mCountResult),
      countErrorMessage(high15mCountResult),
      countErrorMessage(generation15mCountResult),
      countErrorMessage(lastHourCountResult),
      countErrorMessage(last24hCountResult),
      countErrorMessage(app24hCountResult),
      countErrorMessage(generation24hCountResult),
      countErrorMessage(high24hCountResult),
      countErrorMessage(characterModeReferenceRefreshEmptyLastHourCountResult),
      countErrorMessage(characterModeReferenceRefreshEmptyLast24hCountResult),
      countErrorMessage(characterModeBundleUnavailableFallbackLastHourCountResult),
      countErrorMessage(characterModeBundleUnavailableFallbackLast24hCountResult),
    ].filter((value): value is string => Boolean(value));

    const healthReasons: string[] = [];
    if (hasFilteredCountError) {
      healthReasons.push("Event pagination totals are estimated.");
    }
    if (summaryErrorMessages.length > 0) {
      healthReasons.push("Some event summary metrics are temporarily unavailable.");
    }
    if (enrichedEventsResult.degraded && enrichedEventsResult.reason) {
      healthReasons.push(enrichedEventsResult.reason);
    }
    const health = healthReasons.length
      ? {
          eventsTableAvailable: true,
          degraded: true,
          reason: healthReasons.join(" "),
        }
      : healthyState();

    return res.status(200).json({
      events: enrichedEventsResult.events,
      summary: {
        last15mCount: countOrZero(last15mCountResult),
        high15mCount: countOrZero(high15mCountResult),
        generation15mCount: countOrZero(generation15mCountResult),
        lastHourCount: countOrZero(lastHourCountResult),
        last24hCount: countOrZero(last24hCountResult),
        app24hCount: countOrZero(app24hCountResult),
        generation24hCount: countOrZero(generation24hCountResult),
        high24hCount: countOrZero(high24hCountResult),
        characterModeReferenceRefreshEmptyLastHourCount: countOrZero(
          characterModeReferenceRefreshEmptyLastHourCountResult
        ),
        characterModeReferenceRefreshEmptyLast24hCount: countOrZero(
          characterModeReferenceRefreshEmptyLast24hCountResult
        ),
        characterModeBundleUnavailableFallbackLastHourCount: countOrZero(
          characterModeBundleUnavailableFallbackLastHourCountResult
        ),
        characterModeBundleUnavailableFallbackLast24hCount: countOrZero(
          characterModeBundleUnavailableFallbackLast24hCountResult
        ),
        total15mThreshold,
        high15mThreshold,
        generation15mThreshold,
        total15mBreached: countOrZero(last15mCountResult) >= total15mThreshold,
        high15mBreached: countOrZero(high15mCountResult) >= high15mThreshold,
        generation15mBreached: countOrZero(generation15mCountResult) >= generation15mThreshold,
      },
      health,
      pagination: {
        page: resolvedPage,
        perPage: limit,
        totalCount,
        totalPages,
        hasNextPage: hasFilteredCountError ? fallbackLikelyHasNextPage : resolvedPage < totalPages,
        hasPrevPage: resolvedPage > 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isMissingEventsTableError(message)) {
      const total15mThreshold = asThreshold(
        process.env.SHORTPULSE_ADMIN_ALERT_TOTAL_15M,
        DEFAULT_TOTAL_15M_THRESHOLD
      );
      const high15mThreshold = asThreshold(
        process.env.SHORTPULSE_ADMIN_ALERT_HIGH_15M,
        DEFAULT_HIGH_15M_THRESHOLD
      );
      const generation15mThreshold = asThreshold(
        process.env.SHORTPULSE_ADMIN_ALERT_GENERATION_15M,
        DEFAULT_GENERATION_15M_THRESHOLD
      );
      const perPage = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
      return res.status(200).json(
        buildDegradedEventsPayload({
          perPage,
          total15mThreshold,
          high15mThreshold,
          generation15mThreshold,
          reason: APP_ERROR_EVENTS_MISSING_REASON,
        })
      );
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/error-events",
      user: adminUser,
      metadata: {
        scope_filter: typeof req.query.scope === "string" ? req.query.scope : null,
        severity_filter: typeof req.query.severity === "string" ? req.query.severity : null,
        source_filter: typeof req.query.source === "string" ? req.query.source : null,
        search_filter: typeof req.query.search === "string" ? req.query.search : null,
        synthetic_filter: typeof req.query.synthetic === "string" ? req.query.synthetic : null,
        signal_filter: typeof req.query.signal === "string" ? req.query.signal : null,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load error events.",
    });
  }
}
