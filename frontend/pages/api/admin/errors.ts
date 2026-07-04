/**
 * Admin API: fetch grouped app error incidents for operator triage.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APP_ERROR_LOGS_MISSING_REASON =
  "app_error_logs is unavailable; apply sql/create_app_error_logs_table.sql.";

type IncidentQuery = {
  eq: (column: string, value: string) => IncidentQuery;
  gte: (column: string, value: string) => IncidentQuery;
  not: (column: string, operator: string, value: string) => IncidentQuery;
  or: (filters: string) => IncidentQuery;
};

type ListQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type CountQueryResult = {
  count: number | null;
  error: { message: string } | null;
};

type AdminErrorsHealth = {
  degraded: boolean;
  reason: string | null;
};

const PROVIDER_FLAGGED_SENSITIVE_MESSAGE_PATTERN = "%flagged%as%sensitive%";

const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const asFilterValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
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

const countOrZero = (result: CountQueryResult): number => Number(result.count ?? 0);

const hasQueryError = (result: CountQueryResult): boolean => Boolean(result.error);

const isMissingErrorsTableError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  if (!normalized.includes("app_error_logs")) return false;
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache")
  );
};

const buildDegradedErrorsPayload = (params: { perPage: number; reason: string }) => ({
  errors: [],
  summary: {
    openCount: 0,
    highSeverityOpenCount: 0,
    last24hCount: 0,
    appOpenCount: 0,
    generationOpenCount: 0,
  },
  health: {
    degraded: true,
    reason: params.reason,
  },
  pagination: {
    page: 1,
    perPage: params.perPage,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
});

const applyIncidentFilters = (
  query: IncidentQuery,
  filters: { status: string; severity: string; source: string; scope: string; search: string }
): IncidentQuery => {
  let next = query;
  if (filters.status && filters.status !== "all") {
    next = next.eq("status", filters.status);
  }
  if (filters.severity && filters.severity !== "all") {
    next = next.eq("severity", filters.severity);
  }
  if (filters.source && filters.source !== "all") {
    next = next.eq("source", filters.source);
  }
  if (filters.scope && filters.scope !== "all") {
    next = next.eq("scope", filters.scope);
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/\s+/g, "%")}%`;
    const clauses = [
      `message.ilike.${pattern}`,
      `user_email.ilike.${pattern}`,
      `endpoint.ilike.${pattern}`,
      `route.ilike.${pattern}`,
      `request_id.ilike.${pattern}`,
      `source.ilike.${pattern}`,
      `fingerprint.ilike.${pattern}`,
    ];
    if (UUID_PATTERN.test(filters.search)) {
      clauses.push(`id.eq.${filters.search}`);
      clauses.push(`user_id.eq.${filters.search}`);
    }
    next = next.or(clauses.join(","));
  }
  return next;
};

const applyAdminQueueVisibilityFilters = (query: IncidentQuery): IncidentQuery => {
  return query.not("message", "ilike", PROVIDER_FLAGGED_SENSITIVE_MESSAGE_PATTERN);
};

const applyVisibleIncidentFilters = (
  query: IncidentQuery,
  filters: { status: string; severity: string; source: string; scope: string; search: string }
): IncidentQuery => applyIncidentFilters(applyAdminQueueVisibilityFilters(query), filters);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/errors.auth",
    });
    return res.status(500).json({ error: "Unable to load admin errors." });
  }
  if (!adminUser) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const page = asPositiveInt(req.query.page, 1);
    const limit = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    const filters = {
      status: asFilterValue(req.query.status),
      severity: asFilterValue(req.query.severity),
      source: asFilterValue(req.query.source),
      scope: asFilterValue(req.query.scope),
      search: normalizeSearchTerm(req.query.search),
    };

    const logsQuery = applyVisibleIncidentFilters(
      supabaseAdmin
        .from("app_error_logs")
        .select(
          "id, fingerprint, source, scope, severity, status, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, first_seen_at, last_seen_at, occurrences_count"
        )
        .order("last_seen_at", { ascending: false })
        .range(offset, offset + limit - 1) as unknown as IncidentQuery,
      filters
    ) as unknown as Promise<ListQueryResult>;

    const filteredCountQuery = applyVisibleIncidentFilters(
      supabaseAdmin.from("app_error_logs").select("id", {
        count: "exact",
        head: true,
      }) as unknown as IncidentQuery,
      filters
    ) as unknown as Promise<CountQueryResult>;

    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const openCountQuery = applyAdminQueueVisibilityFilters(
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true }) as unknown as IncidentQuery
    ).eq("status", "open") as unknown as Promise<CountQueryResult>;
    const highSeverityOpenQuery = applyAdminQueueVisibilityFilters(
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true }) as unknown as IncidentQuery
    )
      .eq("status", "open")
      .eq("severity", "high") as unknown as Promise<CountQueryResult>;
    const appOpenCountQuery = applyAdminQueueVisibilityFilters(
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true }) as unknown as IncidentQuery
    )
      .eq("status", "open")
      .eq("scope", "app") as unknown as Promise<CountQueryResult>;
    const generationOpenCountQuery = applyAdminQueueVisibilityFilters(
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true }) as unknown as IncidentQuery
    )
      .eq("status", "open")
      .eq("scope", "generation") as unknown as Promise<CountQueryResult>;
    const last24hQuery = applyAdminQueueVisibilityFilters(
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true }) as unknown as IncidentQuery
    ).gte("last_seen_at", sinceIso) as unknown as Promise<CountQueryResult>;

    const [
      logsResult,
      filteredCountResult,
      openCountResult,
      highSeverityOpenResult,
      appOpenCountResult,
      generationOpenCountResult,
      last24hResult,
    ] = await Promise.all([
      logsQuery,
      filteredCountQuery,
      openCountQuery,
      highSeverityOpenQuery,
      appOpenCountQuery,
      generationOpenCountQuery,
      last24hQuery,
    ]);

    if (logsResult.error) {
      if (isMissingErrorsTableError(logsResult.error.message)) {
        return res.status(200).json(
          buildDegradedErrorsPayload({
            perPage: limit,
            reason: APP_ERROR_LOGS_MISSING_REASON,
          })
        );
      }
      await logApiRouteException({
        req,
        error: logsResult.error,
        routeLabel: "admin/errors.list",
        user: adminUser,
      });
      return res
        .status(500)
        .json({ error: logsResult.error.message || "Unable to load admin errors." });
    }

    let logs = logsResult.data ?? [];
    const logRowsCount = Array.isArray(logs) ? logs.length : 0;
    const fallbackLikelyHasNextPage = logRowsCount === limit;
    const hasFilteredCountError = hasQueryError(filteredCountResult);
    const totalCount = hasFilteredCountError
      ? offset + logRowsCount + (fallbackLikelyHasNextPage ? 1 : 0)
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
      const fallbackLogsResult = (await applyVisibleIncidentFilters(
        supabaseAdmin
          .from("app_error_logs")
          .select(
            "id, fingerprint, source, scope, severity, status, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, first_seen_at, last_seen_at, occurrences_count"
          )
          .order("last_seen_at", { ascending: false })
          .range(fallbackOffset, fallbackOffset + limit - 1) as unknown as IncidentQuery,
        filters
      )) as unknown as ListQueryResult;
      if (fallbackLogsResult.error) {
        await logApiRouteException({
          req,
          error: fallbackLogsResult.error,
          routeLabel: "admin/errors.list",
          user: adminUser,
        });
        return res.status(500).json({ error: fallbackLogsResult.error.message });
      }
      logs = fallbackLogsResult.data ?? [];
    }

    const health: AdminErrorsHealth = {
      degraded:
        hasFilteredCountError ||
        hasQueryError(openCountResult) ||
        hasQueryError(highSeverityOpenResult) ||
        hasQueryError(appOpenCountResult) ||
        hasQueryError(generationOpenCountResult) ||
        hasQueryError(last24hResult),
      reason:
        hasFilteredCountError ||
        hasQueryError(openCountResult) ||
        hasQueryError(highSeverityOpenResult) ||
        hasQueryError(appOpenCountResult) ||
        hasQueryError(generationOpenCountResult) ||
        hasQueryError(last24hResult)
          ? "Some admin error summary metrics are temporarily unavailable."
          : null,
    };
    if (health.degraded) {
      await logApiRouteException({
        req,
        error: new Error("Admin error summary query degraded."),
        routeLabel: "admin/errors.summary",
        user: adminUser,
        metadata: {
          filtered_count_error: filteredCountResult.error?.message ?? null,
          open_count_error: openCountResult.error?.message ?? null,
          high_severity_open_error: highSeverityOpenResult.error?.message ?? null,
          app_open_count_error: appOpenCountResult.error?.message ?? null,
          generation_open_count_error: generationOpenCountResult.error?.message ?? null,
          last_24h_count_error: last24hResult.error?.message ?? null,
        },
      });
    }

    return res.status(200).json({
      errors: logs,
      summary: {
        openCount: countOrZero(openCountResult),
        highSeverityOpenCount: countOrZero(highSeverityOpenResult),
        last24hCount: countOrZero(last24hResult),
        appOpenCount: countOrZero(appOpenCountResult),
        generationOpenCount: countOrZero(generationOpenCountResult),
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
    if (isMissingErrorsTableError(message)) {
      const perPage = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
      return res.status(200).json(
        buildDegradedErrorsPayload({
          perPage,
          reason: APP_ERROR_LOGS_MISSING_REASON,
        })
      );
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/errors",
      user: adminUser,
      metadata: {
        status_filter: typeof req.query.status === "string" ? req.query.status : null,
        severity_filter: typeof req.query.severity === "string" ? req.query.severity : null,
        source_filter: typeof req.query.source === "string" ? req.query.source : null,
        scope_filter: typeof req.query.scope === "string" ? req.query.scope : null,
        search_filter: typeof req.query.search === "string" ? req.query.search : null,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load admin errors.",
    });
  }
}
