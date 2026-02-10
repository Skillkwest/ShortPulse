/**
 * Admin API: fetch grouped app error incidents for operator triage.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../_utils/auth";
import { getSupabaseAdmin } from "../_utils/supabaseAdmin";
import { logApiRouteException } from "../_utils/appErrorLogs";

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

const applyIncidentFilters = (
  query: IncidentQuery,
  filters: { status: string; severity: string; source: string; search: string }
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
        .gte("last_seen_at", sinceIso),
    ]);

    if (
      logsResult.error ||
      filteredCountResult.error ||
      openCountResult.error ||
      highSeverityOpenResult.error ||
      last24hResult.error
    ) {
      const detail = [
        logsResult.error?.message,
        filteredCountResult.error?.message,
        openCountResult.error?.message,
        highSeverityOpenResult.error?.message,
        last24hResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Unable to load admin errors." });
    }

    const totalCount = Number(filteredCountResult.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const resolvedPage = totalCount > 0 ? Math.min(page, totalPages) : 1;
    let logs = logsResult.data ?? [];

    if (resolvedPage !== page) {
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

    return res.status(200).json({
      errors: logs,
      summary: {
        openCount: Number(openCountResult.count ?? 0),
        highSeverityOpenCount: Number(highSeverityOpenResult.count ?? 0),
        last24hCount: Number(last24hResult.count ?? 0),
      },
      pagination: {
        page: resolvedPage,
        perPage: limit,
        totalCount,
        totalPages,
        hasNextPage: resolvedPage < totalPages,
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
        search_filter: typeof req.query.search === "string" ? req.query.search : null,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load admin errors.",
    });
  }
}
