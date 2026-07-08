import type { NextApiRequest, NextApiResponse } from "next";
import { ISSUE_REPORT_PAGE_SIZE, isIssueReportStatus } from "../../../lib/issueReports";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { loadIssueReportScreenshotsByReportId } from "../../../lib/server/api/issueReportScreenshots";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

const DEFAULT_LIMIT = ISSUE_REPORT_PAGE_SIZE;
const MAX_LIMIT = 100;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReportsQuery = {
  eq: (column: string, value: string) => ReportsQuery;
  neq: (column: string, value: string) => ReportsQuery;
  or: (filters: string) => ReportsQuery;
  order: (
    column: string,
    options: { ascending: boolean }
  ) => {
    range: (from: number, to: number) => Promise<ListQueryResult>;
  };
};

type ListQueryResult = {
  data: unknown[] | null;
  count: number | null;
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

const applyListFilters = (
  query: ReportsQuery,
  filters: { status: string; search: string }
): ReportsQuery => {
  let next = query;
  if (filters.status === "open") {
    next = next.neq("status", "resolved");
  } else if (filters.status && filters.status !== "all" && isIssueReportStatus(filters.status)) {
    next = next.eq("status", filters.status);
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/\s+/g, "%")}%`;
    const clauses = [
      `submitter_email.ilike.${pattern}`,
      `message.ilike.${pattern}`,
      `source_path.ilike.${pattern}`,
    ];
    if (UUID_V4_PATTERN.test(filters.search)) {
      clauses.push(`user_id.eq.${filters.search}`);
      clauses.push(`reviewed_by_user_id.eq.${filters.search}`);
    }
    next = next.or(clauses.join(","));
  }
  return next;
};

const countOrZero = (result: CountQueryResult): number => Number(result.count ?? 0);

const hasQueryError = (result: CountQueryResult): boolean => Boolean(result.error);

const attachScreenshotsToReports = (
  reports: unknown[],
  screenshotsByReportId: Awaited<ReturnType<typeof loadIssueReportScreenshotsByReportId>>
): unknown[] =>
  reports.map((report) => {
    const row = report && typeof report === "object" ? (report as Record<string, unknown>) : {};
    const reportId = typeof row.id === "string" ? row.id : "";
    return {
      ...row,
      screenshots: screenshotsByReportId.get(reportId) ?? [],
    };
  });

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
      routeLabel: "api.admin.reports.auth",
    });
    return res.status(500).json({ error: "Unable to load reports right now." });
  }
  if (!adminUser) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requestedPage = asPositiveInt(req.query.page, 1);
    const limit = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
    const filters = {
      status: asFilterValue(req.query.status),
      search: normalizeSearchTerm(req.query.search),
    };

    const loadPage = async (page: number): Promise<ListQueryResult> => {
      const offset = (page - 1) * limit;
      const query = applyListFilters(
        supabaseAdmin
          .from("user_issue_reports")
          .select(
            "id, user_id, submitter_email, message, status, admin_notes, source_path, user_agent, reviewed_at, reviewed_by_user_id, created_at, updated_at",
            { count: "exact" }
          ) as unknown as ReportsQuery,
        filters
      );
      return query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    };

    let listResult = await loadPage(requestedPage);
    if (listResult.error) {
      await logApiRouteException({
        req,
        error: listResult.error,
        routeLabel: "api.admin.reports.list",
        user: adminUser,
      });
      return res.status(500).json({
        error: listResult.error.message || "Unable to load reports.",
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
          routeLabel: "api.admin.reports.list",
          user: adminUser,
        });
        return res.status(500).json({
          error: listResult.error.message || "Unable to load reports.",
        });
      }
    }

    const [totalCountResult, newCountResult, reviewingCountResult, resolvedCountResult] =
      await Promise.all([
        supabaseAdmin.from("user_issue_reports").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("user_issue_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabaseAdmin
          .from("user_issue_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "reviewing"),
        supabaseAdmin
          .from("user_issue_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "resolved"),
      ]);

    const healthDegraded =
      hasQueryError(totalCountResult) ||
      hasQueryError(newCountResult) ||
      hasQueryError(reviewingCountResult) ||
      hasQueryError(resolvedCountResult);
    if (healthDegraded) {
      await logApiRouteException({
        req,
        error: new Error("Issue report summary count query failed."),
        routeLabel: "api.admin.reports.summary",
        user: adminUser,
        metadata: {
          total_count_error: totalCountResult.error?.message ?? null,
          new_count_error: newCountResult.error?.message ?? null,
          reviewing_count_error: reviewingCountResult.error?.message ?? null,
          resolved_count_error: resolvedCountResult.error?.message ?? null,
        },
      });
    }

    const reports = listResult.data ?? [];
    const screenshotsByReportId = await loadIssueReportScreenshotsByReportId(
      supabaseAdmin,
      reports
        .map((report) =>
          report && typeof report === "object" && "id" in report
            ? String((report as { id?: unknown }).id ?? "")
            : ""
        )
        .filter(Boolean),
      {
        onSignError: ({ error, reportId, screenshotId }) =>
          logApiRouteException({
            req,
            error,
            routeLabel: "api.admin.reports.screenshot-sign",
            user: adminUser,
            metadata: {
              report_id: reportId,
              screenshot_id: screenshotId,
            },
          }),
      }
    );

    return res.status(200).json({
      reports: attachScreenshotsToReports(reports, screenshotsByReportId),
      summary: {
        totalCount: healthDegraded ? 0 : countOrZero(totalCountResult),
        openCount: healthDegraded
          ? 0
          : countOrZero(newCountResult) + countOrZero(reviewingCountResult),
        newCount: healthDegraded ? 0 : countOrZero(newCountResult),
        reviewingCount: healthDegraded ? 0 : countOrZero(reviewingCountResult),
        resolvedCount: healthDegraded ? 0 : countOrZero(resolvedCountResult),
      },
      pagination: {
        page,
        perPage: limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.admin.reports",
      user: adminUser,
    });
    return res.status(500).json({ error: "Unable to load reports right now." });
  }
}
