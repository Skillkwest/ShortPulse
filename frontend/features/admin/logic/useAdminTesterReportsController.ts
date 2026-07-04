/**
 * Admin tester-reports controller.
 * Loads and filters the operator tester-run report log.
 */
import React from "react";
import { TESTER_REPORT_PAGE_SIZE, type TesterReportStatus } from "../../../lib/testerReports";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  DEFAULT_ADMIN_TESTER_REPORT_SUMMARY,
  buildAdminTesterReportsParams,
  normalizeAdminTesterReportsResponse,
} from "./adminTesterReportsApi";
import type { AdminPagination, AdminTesterReportRunRow, AdminTesterReportSummary } from "../types";

const SEARCH_DEBOUNCE_MS = 250;

type UseAdminTesterReportsControllerParams = {
  enabled: boolean;
};

type UseAdminTesterReportsControllerResult = {
  testerReports: AdminTesterReportRunRow[];
  testerReportsLoading: boolean;
  testerReportsError: string | null;
  testerReportSummary: AdminTesterReportSummary;
  testerReportsPagination: AdminPagination;
  testerReportStatusFilter: "all" | TesterReportStatus;
  testerReportTesterFilter: string;
  testerReportSearch: string;
  handleTesterReportStatusFilterChange: (value: "all" | TesterReportStatus) => void;
  handleTesterReportTesterFilterChange: (value: string) => void;
  handleTesterReportSearchChange: (value: string) => void;
  handleTesterReportsPrevPage: () => void;
  handleTesterReportsNextPage: () => void;
  refreshTesterReports: () => Promise<void>;
};

export const useAdminTesterReportsController = ({
  enabled,
}: UseAdminTesterReportsControllerParams): UseAdminTesterReportsControllerResult => {
  const [testerReports, setTesterReports] = React.useState<AdminTesterReportRunRow[]>([]);
  const [testerReportsLoading, setTesterReportsLoading] = React.useState(false);
  const [testerReportsError, setTesterReportsError] = React.useState<string | null>(null);
  const [testerReportSummary, setTesterReportSummary] = React.useState<AdminTesterReportSummary>(
    DEFAULT_ADMIN_TESTER_REPORT_SUMMARY
  );
  const [testerReportStatusFilter, setTesterReportStatusFilter] = React.useState<
    "all" | TesterReportStatus
  >("all");
  const [testerReportTesterFilter, setTesterReportTesterFilter] = React.useState("");
  const [testerReportSearch, setTesterReportSearch] = React.useState("");
  const [debouncedTesterReportSearch, setDebouncedTesterReportSearch] = React.useState("");
  const [testerReportsPage, setTesterReportsPage] = React.useState(1);
  const [testerReportsPagination, setTesterReportsPagination] = React.useState<AdminPagination>({
    page: 1,
    perPage: TESTER_REPORT_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const loadTesterReports = React.useCallback(
    async (overrides?: {
      page?: number;
      status?: "all" | TesterReportStatus;
      tester?: string;
      search?: string;
    }) => {
      setTesterReportsLoading(true);
      setTesterReportsError(null);
      try {
        const activePage = overrides?.page ?? testerReportsPage;
        const activeStatus = overrides?.status ?? testerReportStatusFilter;
        const activeTester = overrides?.tester ?? testerReportTesterFilter.trim();
        const activeSearch = overrides?.search ?? debouncedTesterReportSearch;
        const params = buildAdminTesterReportsParams({
          page: activePage,
          status: activeStatus,
          tester: activeTester,
          search: activeSearch,
        });
        const response = await fetchWithAuth(`/api/admin/tester-reports?${params.toString()}`, {
          method: "GET",
        });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details?.error || "Failed to load tester reports.");
        }
        const data = (await response.json()) as {
          reports?: unknown[];
          summary?: Partial<AdminTesterReportSummary>;
          pagination?: Partial<AdminPagination>;
        };
        const normalized = normalizeAdminTesterReportsResponse(data, activePage);
        setTesterReports(normalized.rows);
        setTesterReportSummary(normalized.summary);
        setTesterReportsPagination(normalized.pagination);
        if (normalized.pagination.page !== testerReportsPage) {
          setTesterReportsPage(normalized.pagination.page);
        }
      } catch (error) {
        setTesterReportsError(
          error instanceof Error ? error.message : "Failed to load tester reports."
        );
      } finally {
        setTesterReportsLoading(false);
      }
    },
    [
      debouncedTesterReportSearch,
      testerReportStatusFilter,
      testerReportTesterFilter,
      testerReportsPage,
    ]
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedTesterReportSearch(testerReportSearch.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [testerReportSearch]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadTesterReports({
      page: 1,
      status: testerReportStatusFilter,
      tester: testerReportTesterFilter.trim(),
      search: debouncedTesterReportSearch,
    });
  }, [
    debouncedTesterReportSearch,
    enabled,
    loadTesterReports,
    testerReportStatusFilter,
    testerReportTesterFilter,
  ]);

  const handleTesterReportStatusFilterChange = React.useCallback(
    (value: "all" | TesterReportStatus) => {
      setTesterReportStatusFilter(value);
      setTesterReportsPage(1);
    },
    []
  );

  const handleTesterReportTesterFilterChange = React.useCallback((value: string) => {
    setTesterReportTesterFilter(value);
    setTesterReportsPage(1);
  }, []);

  const handleTesterReportSearchChange = React.useCallback((value: string) => {
    setTesterReportSearch(value);
    setTesterReportsPage(1);
  }, []);

  const handleTesterReportsPrevPage = React.useCallback(() => {
    if (!testerReportsPagination.hasPrevPage) return;
    const nextPage = Math.max(1, testerReportsPagination.page - 1);
    setTesterReportsPage(nextPage);
    void loadTesterReports({ page: nextPage });
  }, [loadTesterReports, testerReportsPagination.hasPrevPage, testerReportsPagination.page]);

  const handleTesterReportsNextPage = React.useCallback(() => {
    if (!testerReportsPagination.hasNextPage) return;
    const nextPage = testerReportsPagination.page + 1;
    setTesterReportsPage(nextPage);
    void loadTesterReports({ page: nextPage });
  }, [loadTesterReports, testerReportsPagination.hasNextPage, testerReportsPagination.page]);

  const refreshTesterReports = React.useCallback(async () => {
    if (!enabled) return;
    await loadTesterReports();
  }, [enabled, loadTesterReports]);

  return {
    testerReports,
    testerReportsLoading,
    testerReportsError,
    testerReportSummary,
    testerReportsPagination,
    testerReportStatusFilter,
    testerReportTesterFilter,
    testerReportSearch,
    handleTesterReportStatusFilterChange,
    handleTesterReportTesterFilterChange,
    handleTesterReportSearchChange,
    handleTesterReportsPrevPage,
    handleTesterReportsNextPage,
    refreshTesterReports,
  };
};
