/**
 * Admin API: fetch grouped app error incidents for operator triage.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type IncidentQuery = {
  eq: (column: string, value: string) => IncidentQuery;
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
      ].join(",")
    );
  }
  return next;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
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

    const logsQuery = applyIncidentFilters(
      supabaseAdmin
        .from("app_error_logs")
        .select(
          "id, fingerprint, source, scope, severity, status, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, first_seen_at, last_seen_at, occurrences_count"
        )
        .order("last_seen_at", { ascending: false })
        .range(offset, offset + limit - 1) as unknown as IncidentQuery,
      filters
    ) as unknown as Promise<ListQueryResult>;

    const filteredCountQuery = applyIncidentFilters(
      supabaseAdmin.from("app_error_logs").select("id", {
        count: "exact",
        head: true,
      }) as unknown as IncidentQuery,
      filters
    ) as unknown as Promise<CountQueryResult>;

    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("severity", "high"),
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("scope", "app"),
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("scope", "generation"),
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true })
        .gte("last_seen_at", sinceIso),
    ]);

    if (logsResult.error) {
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
      const fallbackLogsResult = (await applyIncidentFilters(
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
