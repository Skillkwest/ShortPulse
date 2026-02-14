/**
 * Admin API: fetch raw app error events (every occurrence) for operator forensics.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

const normalizeSearchTerm = (value: unknown): string => {
  const normalized = asFilterValue(value);
  if (!normalized) return "";
  return normalized
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
};

const applyEventFilters = (
  query: EventQuery,
  filters: {
    scope: string;
    severity: string;
    source: string;
    search: string;
    synthetic: SyntheticFilterValue;
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
): Promise<unknown[]> => {
  const events = Array.isArray(rows) ? (rows as EventRow[]) : [];
  const incidentIds = Array.from(
    new Set(
      events
        .map((row) => (typeof row.incident_id === "string" ? row.incident_id : null))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (!incidentIds.length) {
    return events.map((row) => ({ ...row, incident_status: null }));
  }

  const { data: incidentRowsRaw, error } = await supabaseAdmin
    .from("app_error_logs")
    .select("id, status")
    .in("id", incidentIds);
  if (error) {
    throw new Error(error.message);
  }

  const incidentRows = (incidentRowsRaw as IncidentStatusRow[] | null) ?? [];
  const statusByIncidentId = new Map<string, "open" | "resolved" | "ignored">();
  for (const row of incidentRows) {
    if (!row?.id) continue;
    statusByIncidentId.set(row.id, row.status);
  }

  return events.map((row) => {
    const incidentId = typeof row.incident_id === "string" ? row.incident_id : null;
    const incidentStatus = incidentId ? (statusByIncidentId.get(incidentId) ?? null) : null;
    return {
      ...row,
      incident_status: incidentStatus,
    };
  });
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
    };
    const summaryFilters = { ...filters, search: "" };
    const nowMs = Date.now();
    const sinceHourIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
    const since24hIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

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
      lastHourCountResult,
      last24hCountResult,
      app24hCountResult,
      generation24hCountResult,
      high24hCountResult,
    ] = await Promise.all([
      eventsQuery,
      filteredCountQuery,
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
    ]);

    if (
      eventsResult.error ||
      filteredCountResult.error ||
      lastHourCountResult.error ||
      last24hCountResult.error ||
      app24hCountResult.error ||
      generation24hCountResult.error ||
      high24hCountResult.error
    ) {
      const detail = [
        eventsResult.error?.message,
        filteredCountResult.error?.message,
        lastHourCountResult.error?.message,
        last24hCountResult.error?.message,
        app24hCountResult.error?.message,
        generation24hCountResult.error?.message,
        high24hCountResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Unable to load error events." });
    }

    const totalCount = Number(filteredCountResult.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const resolvedPage = totalCount > 0 ? Math.min(page, totalPages) : 1;
    let events = eventsResult.data ?? [];

    if (resolvedPage !== page) {
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

    const enrichedEvents = await enrichEventsWithIncidentStatus(supabaseAdmin, events);

    return res.status(200).json({
      events: enrichedEvents,
      summary: {
        lastHourCount: Number(lastHourCountResult.count ?? 0),
        last24hCount: Number(last24hCountResult.count ?? 0),
        app24hCount: Number(app24hCountResult.count ?? 0),
        generation24hCount: Number(generation24hCountResult.count ?? 0),
        high24hCount: Number(high24hCountResult.count ?? 0),
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
      routeLabel: "admin/error-events",
      user: adminUser,
      metadata: {
        scope_filter: typeof req.query.scope === "string" ? req.query.scope : null,
        severity_filter: typeof req.query.severity === "string" ? req.query.severity : null,
        source_filter: typeof req.query.source === "string" ? req.query.source : null,
        search_filter: typeof req.query.search === "string" ? req.query.search : null,
        synthetic_filter: typeof req.query.synthetic === "string" ? req.query.synthetic : null,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load error events.",
    });
  }
}
