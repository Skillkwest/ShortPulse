import React from "react";
import { ISSUE_REPORT_PAGE_SIZE } from "../../../lib/issueReports";
import type { IssueReportStatus } from "../../../lib/issueReports";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  buildAdminReportsParams,
  DEFAULT_ADMIN_ISSUE_REPORT_SUMMARY,
  normalizeAdminReportsResponse,
} from "./adminReportsApi";
import type {
  AdminIssueReportFilter,
  AdminIssueReportRow,
  AdminIssueReportSummary,
  AdminPagination,
} from "../types";

const SEARCH_DEBOUNCE_MS = 250;

type UseAdminReportsControllerParams = {
  enabled: boolean;
};

type UseAdminReportsControllerResult = {
  reports: AdminIssueReportRow[];
  reportsLoading: boolean;
  reportsError: string | null;
  reportSummary: AdminIssueReportSummary;
  reportsPagination: AdminPagination;
  reportStatusFilter: AdminIssueReportFilter;
  reportSearch: string;
  reportUpdatingId: string | null;
  handleReportStatusFilterChange: (value: AdminIssueReportFilter) => void;
  handleReportSearchChange: (value: string) => void;
  handleReportsPrevPage: () => void;
  handleReportsNextPage: () => void;
  handleUpdateReport: (
    reportId: string,
    updates: {
      status?: IssueReportStatus;
      adminNotes?: string;
    }
  ) => Promise<AdminIssueReportRow | null>;
  refreshReports: () => Promise<void>;
};

export const useAdminReportsController = ({
  enabled,
}: UseAdminReportsControllerParams): UseAdminReportsControllerResult => {
  const [reports, setReports] = React.useState<AdminIssueReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = React.useState(false);
  const [reportsError, setReportsError] = React.useState<string | null>(null);
  const [reportSummary, setReportSummary] = React.useState<AdminIssueReportSummary>(
    DEFAULT_ADMIN_ISSUE_REPORT_SUMMARY
  );
  const [reportStatusFilter, setReportStatusFilter] =
    React.useState<AdminIssueReportFilter>("open");
  const [reportSearch, setReportSearch] = React.useState("");
  const [debouncedReportSearch, setDebouncedReportSearch] = React.useState("");
  const [reportsPage, setReportsPage] = React.useState(1);
  const [reportsPagination, setReportsPagination] = React.useState<AdminPagination>({
    page: 1,
    perPage: ISSUE_REPORT_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [reportUpdatingId, setReportUpdatingId] = React.useState<string | null>(null);

  const loadReports = React.useCallback(
    async (overrides?: { page?: number; status?: AdminIssueReportFilter; search?: string }) => {
      setReportsLoading(true);
      setReportsError(null);
      try {
        const activePage = overrides?.page ?? reportsPage;
        const activeStatus = overrides?.status ?? reportStatusFilter;
        const activeSearch = overrides?.search ?? debouncedReportSearch;
        const params = buildAdminReportsParams({
          page: activePage,
          status: activeStatus,
          search: activeSearch,
        });
        const response = await fetchWithAuth(`/api/admin/reports?${params.toString()}`, {
          method: "GET",
        });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details?.error || "Failed to load issue reports.");
        }
        const data = (await response.json()) as {
          reports?: unknown[];
          summary?: Partial<AdminIssueReportSummary>;
          pagination?: Partial<AdminPagination>;
        };
        const normalized = normalizeAdminReportsResponse(data, activePage);
        setReports(normalized.rows);
        setReportSummary(normalized.summary);
        setReportsPagination(normalized.pagination);
        if (normalized.pagination.page !== reportsPage) {
          setReportsPage(normalized.pagination.page);
        }
      } catch (error) {
        setReportsError(error instanceof Error ? error.message : "Failed to load issue reports.");
      } finally {
        setReportsLoading(false);
      }
    },
    [debouncedReportSearch, reportStatusFilter, reportsPage]
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedReportSearch(reportSearch.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reportSearch]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadReports({
      page: 1,
      status: reportStatusFilter,
      search: debouncedReportSearch,
    });
  }, [debouncedReportSearch, enabled, loadReports, reportStatusFilter]);

  const handleReportStatusFilterChange = React.useCallback((value: AdminIssueReportFilter) => {
    setReportStatusFilter(value);
    setReportsPage(1);
  }, []);

  const handleReportSearchChange = React.useCallback((value: string) => {
    setReportSearch(value);
    setReportsPage(1);
  }, []);

  const handleReportsPrevPage = React.useCallback(() => {
    if (!reportsPagination.hasPrevPage) return;
    const nextPage = Math.max(1, reportsPagination.page - 1);
    setReportsPage(nextPage);
    void loadReports({ page: nextPage });
  }, [loadReports, reportsPagination.hasPrevPage, reportsPagination.page]);

  const handleReportsNextPage = React.useCallback(() => {
    if (!reportsPagination.hasNextPage) return;
    const nextPage = reportsPagination.page + 1;
    setReportsPage(nextPage);
    void loadReports({ page: nextPage });
  }, [loadReports, reportsPagination.hasNextPage, reportsPagination.page]);

  const refreshReports = React.useCallback(async () => {
    if (!enabled) return;
    await loadReports();
  }, [enabled, loadReports]);

  const handleUpdateReport = React.useCallback(
    async (
      reportId: string,
      updates: {
        status?: IssueReportStatus;
        adminNotes?: string;
      }
    ): Promise<AdminIssueReportRow | null> => {
      setReportUpdatingId(reportId);
      setReportsError(null);
      try {
        const response = await fetchWithAuth(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details?.error || "Failed to update issue report.");
        }
        const data = (await response.json()) as { report?: unknown };
        const normalized = normalizeAdminReportsResponse(
          {
            reports: data.report ? [data.report] : [],
          },
          reportsPagination.page
        ).rows[0];
        if (!normalized) return null;

        setReports((current) =>
          current.map((report) => (report.id === normalized.id ? normalized : report))
        );
        await loadReports({
          page: reportsPagination.page,
          status: reportStatusFilter,
          search: debouncedReportSearch,
        });
        return normalized;
      } catch (error) {
        setReportsError(error instanceof Error ? error.message : "Failed to update issue report.");
        return null;
      } finally {
        setReportUpdatingId(null);
      }
    },
    [debouncedReportSearch, loadReports, reportStatusFilter, reportsPagination.page]
  );

  return {
    reports,
    reportsLoading,
    reportsError,
    reportSummary,
    reportsPagination,
    reportStatusFilter,
    reportSearch,
    reportUpdatingId,
    handleReportStatusFilterChange,
    handleReportSearchChange,
    handleReportsPrevPage,
    handleReportsNextPage,
    handleUpdateReport,
    refreshReports,
  };
};
