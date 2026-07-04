/**
 * Admin API: tester-run report log for the /admin/tester-reports workspace.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  TESTER_REPORT_MAX_PAGE_SIZE,
  TESTER_REPORT_PAGE_SIZE,
  isTesterReportStatus,
  normalizeTesterReportSearch,
  normalizeTesterSlug,
} from "../../../lib/testerReports";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

const TESTER_REPORT_COLUMNS =
  "id, external_run_id, tester_slug, tester_display_name, shortpulse_user_id, shortpulse_user_email, scenario, status, run_started_at, run_finished_at, duration_minutes, credits_spent, production_surface, persona_report_title, persona_report_body, engineering_report_title, engineering_report_body, report_artifact_paths, evidence, created_by_source, created_by_user_id, created_by_email, created_at, updated_at";

type TesterReportQuery = {
  eq: (column: string, value: string) => TesterReportQuery;
  or: (filters: string) => TesterReportQuery;
  order: (column: string, options: { ascending: boolean }) => TesterReportQuery;
  range: (from: number, to: number) => PromiseLike<ListQueryResult>;
};

type ListQueryResult = {
  data: unknown[] | null;
  count: number | null;
  error: { message?: string } | null;
};

type CountQueryResult = {
  count: number | null;
  error: { message?: string } | null;
};

const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const firstQueryValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const normalizeStatusFilter = (value: unknown): "all" | string => {
  if (value === "all" || typeof value === "undefined") return "all";
  return isTesterReportStatus(value) ? value : "all";
};

const applyListFilters = (
  query: TesterReportQuery,
  filters: { status: string; tester: string | null; search: string }
): TesterReportQuery => {
  let next = query;
  if (filters.status !== "all") {
    next = next.eq("status", filters.status);
  }
  if (filters.tester) {
    next = next.eq("tester_slug", filters.tester);
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/\s+/g, "%")}%`;
    next = next.or(
      [
        `external_run_id.ilike.${pattern}`,
        `tester_display_name.ilike.${pattern}`,
        `shortpulse_user_email.ilike.${pattern}`,
        `scenario.ilike.${pattern}`,
        `production_surface.ilike.${pattern}`,
        `persona_report_title.ilike.${pattern}`,
        `engineering_report_title.ilike.${pattern}`,
      ].join(",")
    );
  }
  return next;
};

const countOrZero = (result: CountQueryResult): number => Number(result.count ?? 0);

const hasQueryError = (result: CountQueryResult): boolean => Boolean(result.error);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.admin.tester-reports.auth",
    });
    return res.status(500).json({ error: "Unable to load tester reports right now." });
  }
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requestedPage = asPositiveInt(firstQueryValue(req.query.page), 1);
    const limit = Math.min(
      TESTER_REPORT_MAX_PAGE_SIZE,
      asPositiveInt(firstQueryValue(req.query.limit), TESTER_REPORT_PAGE_SIZE)
    );
    const filters = {
      status: normalizeStatusFilter(firstQueryValue(req.query.status)),
      tester: normalizeTesterSlug(firstQueryValue(req.query.tester)),
      search: normalizeTesterReportSearch(firstQueryValue(req.query.search)),
    };

    const loadPage = async (page: number): Promise<ListQueryResult> => {
      const offset = (page - 1) * limit;
      const filteredQuery = applyListFilters(
        supabaseAdmin
          .from("tester_report_runs")
          .select(TESTER_REPORT_COLUMNS, { count: "exact" }) as unknown as TesterReportQuery,
        filters
      );
      return (await filteredQuery
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)) as ListQueryResult;
    };

    let listResult = await loadPage(requestedPage);
    if (listResult.error) {
      await logApiRouteException({
        req,
        error: listResult.error,
        routeLabel: "api.admin.tester-reports.list",
        user: adminUser,
      });
      return res.status(500).json({
        error: listResult.error.message || "Unable to load tester reports.",
      });
    }

    const totalCount = Number(listResult.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const page = totalCount > 0 ? Math.min(requestedPage, totalPages) : 1;

    if (page !== requestedPage) {
      listResult = await loadPage(page);
      if (listResult.error) {
        await logApiRouteException({
          req,
          error: listResult.error,
          routeLabel: "api.admin.tester-reports.list",
          user: adminUser,
        });
        return res.status(500).json({
          error: listResult.error.message || "Unable to load tester reports.",
        });
      }
    }

    const [
      totalCountResult,
      completedCountResult,
      blockedCountResult,
      failedCountResult,
      partialCountResult,
    ] = await Promise.all([
      supabaseAdmin.from("tester_report_runs").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("tester_report_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabaseAdmin
        .from("tester_report_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "blocked"),
      supabaseAdmin
        .from("tester_report_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabaseAdmin
        .from("tester_report_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "partial"),
    ]);

    const healthDegraded =
      hasQueryError(totalCountResult) ||
      hasQueryError(completedCountResult) ||
      hasQueryError(blockedCountResult) ||
      hasQueryError(failedCountResult) ||
      hasQueryError(partialCountResult);

    if (healthDegraded) {
      await logApiRouteException({
        req,
        error: new Error("Tester report summary count query failed."),
        routeLabel: "api.admin.tester-reports.summary",
        user: adminUser,
        metadata: {
          total_count_error: totalCountResult.error?.message ?? null,
          completed_count_error: completedCountResult.error?.message ?? null,
          blocked_count_error: blockedCountResult.error?.message ?? null,
          failed_count_error: failedCountResult.error?.message ?? null,
          partial_count_error: partialCountResult.error?.message ?? null,
        },
      });
    }

    return res.status(200).json({
      reports: listResult.data ?? [],
      summary: {
        totalCount: healthDegraded ? 0 : countOrZero(totalCountResult),
        completedCount: healthDegraded ? 0 : countOrZero(completedCountResult),
        blockedCount: healthDegraded ? 0 : countOrZero(blockedCountResult),
        failedCount: healthDegraded ? 0 : countOrZero(failedCountResult),
        partialCount: healthDegraded ? 0 : countOrZero(partialCountResult),
      },
      pagination: {
        page,
        perPage: limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filters,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.admin.tester-reports",
      user: adminUser,
    });
    return res.status(500).json({ error: "Unable to load tester reports right now." });
  }
}
