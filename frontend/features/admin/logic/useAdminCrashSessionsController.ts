/**
 * Controller for the Admin Crash Logs page.
 * Owns loading, filters, pagination, and refresh behavior for crash sessions.
 */
import React from "react";
import type { AdminCrashSessionRow, AdminPagination } from "../types";
import {
  CRASH_SESSIONS_PER_PAGE,
  fetchAdminCrashSessions,
  type AdminCrashSessionStatusFilter,
} from "./adminCrashSessionsApi";

const SEARCH_DEBOUNCE_MS = 250;
const REFRESH_INTERVAL_MS = 30_000;

type UseAdminCrashSessionsControllerParams = {
  enabled: boolean;
  liveRefreshEnabled: boolean;
};

type UseAdminCrashSessionsControllerResult = {
  sessions: AdminCrashSessionRow[];
  loading: boolean;
  error: string | null;
  pagination: AdminPagination;
  statusFilter: AdminCrashSessionStatusFilter;
  search: string;
  handleStatusFilterChange: (value: AdminCrashSessionStatusFilter) => void;
  handleSearchChange: (value: string) => void;
  handlePrevPage: () => void;
  handleNextPage: () => void;
  refresh: () => Promise<void>;
};

/**
 * Coordinates Admin Crash Logs data loading.
 */
export const useAdminCrashSessionsController = ({
  enabled,
  liveRefreshEnabled,
}: UseAdminCrashSessionsControllerParams): UseAdminCrashSessionsControllerResult => {
  const [sessions, setSessions] = React.useState<AdminCrashSessionRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] =
    React.useState<AdminCrashSessionStatusFilter>("needs_review");
  const [search, setSearch] = React.useState("");
  const [pagination, setPagination] = React.useState<AdminPagination>({
    page: 1,
    perPage: CRASH_SESSIONS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const loadCrashSessions = React.useCallback(
    async (nextPage: number) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdminCrashSessions({
          page: nextPage,
          status: statusFilter,
          search,
        });
        setSessions(result.rows);
        setPagination(result.pagination);
        setPage(result.pagination.page);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load crash sessions.");
      } finally {
        setLoading(false);
      }
    },
    [enabled, search, statusFilter]
  );

  React.useEffect(() => {
    if (!enabled) return;
    const timeoutId = window.setTimeout(() => {
      void loadCrashSessions(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [enabled, loadCrashSessions, search, statusFilter]);

  React.useEffect(() => {
    if (!enabled || !liveRefreshEnabled) return;
    const intervalId = window.setInterval(() => {
      void loadCrashSessions(page);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled, liveRefreshEnabled, loadCrashSessions, page]);

  const handleStatusFilterChange = React.useCallback((value: AdminCrashSessionStatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleSearchChange = React.useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handlePrevPage = React.useCallback(() => {
    if (!pagination.hasPrevPage || loading) return;
    const nextPage = Math.max(1, page - 1);
    setPage(nextPage);
    void loadCrashSessions(nextPage);
  }, [loadCrashSessions, loading, page, pagination.hasPrevPage]);

  const handleNextPage = React.useCallback(() => {
    if (!pagination.hasNextPage || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    void loadCrashSessions(nextPage);
  }, [loadCrashSessions, loading, page, pagination.hasNextPage]);

  const refresh = React.useCallback(async () => {
    await loadCrashSessions(page);
  }, [loadCrashSessions, page]);

  return {
    sessions,
    loading,
    error,
    pagination,
    statusFilter,
    search,
    handleStatusFilterChange,
    handleSearchChange,
    handlePrevPage,
    handleNextPage,
    refresh,
  };
};
