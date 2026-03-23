/**
 * Admin errors and events controller.
 * Owns errors/events filters, loading, mutation, refresh, and synthetic incident flows.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  buildAdminErrorEventsParams,
  buildAdminErrorsParams,
  DEFAULT_ERROR_EVENTS_HEALTH,
  DEFAULT_ERROR_EVENTS_SUMMARY,
  ERROR_EVENTS_PER_PAGE,
  ERRORS_PER_PAGE,
  normalizeAdminErrorEventsResponse,
  normalizeAdminErrorsResponse,
} from "./adminErrorsEventsApi";
import type {
  AdminErrorEventIncidentFilter,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorEventsHealth,
  AdminErrorEventSummary,
  AdminErrorLogRow,
  AdminErrorStatus,
  AdminErrorSummary,
  AdminPagination,
} from "../types";
const SEARCH_DEBOUNCE_MS = 250;
const ERROR_REFRESH_INTERVAL_MS = 30000;

type ErrorLoadOverrides = {
  page?: number;
  status?: "open" | "all";
  scope?: "all" | "app" | "generation";
  severity?: "all" | "high" | "medium" | "low";
  source?: string;
  search?: string;
};

type ErrorEventsLoadOverrides = {
  page?: number;
  scope?: "all" | "app" | "generation";
  severity?: "all" | "high" | "medium" | "low";
  source?: string;
  synthetic?: "all" | "exclude" | "only";
  signal?: AdminErrorEventSignalFilter;
  incident?: AdminErrorEventIncidentFilter;
  search?: string;
};

type UseAdminErrorsEventsControllerParams = {
  enabled: boolean;
  liveRefreshEnabled: boolean;
};

type UseAdminErrorsEventsControllerResult = {
  errors: AdminErrorLogRow[];
  errorsLoading: boolean;
  errorsError: string | null;
  errorSummary: AdminErrorSummary;
  errorEvents: AdminErrorEventRow[];
  errorEventsLoading: boolean;
  errorEventsError: string | null;
  errorEventsSummary: AdminErrorEventSummary;
  errorEventsHealth: AdminErrorEventsHealth;
  errorEventsPagination: AdminPagination;
  errorStatusFilter: "open" | "all";
  errorScopeFilter: "all" | "app" | "generation";
  errorSeverityFilter: "all" | "high" | "medium" | "low";
  errorSourceFilter: string;
  errorEventSyntheticFilter: "all" | "exclude" | "only";
  errorEventSignalFilter: AdminErrorEventSignalFilter;
  errorEventIncidentFilter: AdminErrorEventIncidentFilter;
  errorSearch: string;
  errorsPagination: AdminPagination;
  errorStatusUpdatingId: string | null;
  bulkIncidentStatusUpdating: "resolved" | "ignored" | null;
  bulkIncidentStatusResult: string | null;
  testIncidentSubmittingScope: "app" | "generation" | null;
  testIncidentResult: string | null;
  handleErrorStatusFilterChange: (value: "open" | "all") => void;
  handleErrorScopeFilterChange: (value: "all" | "app" | "generation") => void;
  handleErrorSeverityFilterChange: (value: "all" | "high" | "medium" | "low") => void;
  handleErrorSourceFilterChange: (value: string) => void;
  handleErrorEventSyntheticFilterChange: (value: "all" | "exclude" | "only") => void;
  handleErrorEventSignalFilterChange: (value: AdminErrorEventSignalFilter) => void;
  handleErrorEventIncidentFilterChange: (value: AdminErrorEventIncidentFilter) => void;
  handleErrorSearchChange: (value: string) => void;
  handleUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => Promise<void>;
  handleUpdateErrorEventStatus: (eventId: string, status: AdminErrorStatus) => Promise<void>;
  handleBulkUpdateListedErrorStatus: (status: "resolved" | "ignored") => Promise<void>;
  handleTriggerTestIncident: (scope: "app" | "generation") => Promise<void>;
  handleErrorsPrevPage: () => void;
  handleErrorsNextPage: () => void;
  handleErrorEventsPrevPage: () => void;
  handleErrorEventsNextPage: () => void;
  refreshErrorData: () => Promise<void>;
};

/**
 * Compose route-local admin incident telemetry behavior behind a controller boundary.
 */
export const useAdminErrorsEventsController = ({
  enabled,
  liveRefreshEnabled,
}: UseAdminErrorsEventsControllerParams): UseAdminErrorsEventsControllerResult => {
  const [errors, setErrors] = React.useState<AdminErrorLogRow[]>([]);
  const [errorsLoading, setErrorsLoading] = React.useState(false);
  const [errorsError, setErrorsError] = React.useState<string | null>(null);
  const [errorEvents, setErrorEvents] = React.useState<AdminErrorEventRow[]>([]);
  const [errorEventsLoading, setErrorEventsLoading] = React.useState(false);
  const [errorEventsError, setErrorEventsError] = React.useState<string | null>(null);
  const [errorEventsSummary, setErrorEventsSummary] = React.useState<AdminErrorEventSummary>(
    DEFAULT_ERROR_EVENTS_SUMMARY
  );
  const [errorEventsHealth, setErrorEventsHealth] = React.useState<AdminErrorEventsHealth>(
    DEFAULT_ERROR_EVENTS_HEALTH
  );
  const [errorEventsPage, setErrorEventsPage] = React.useState(1);
  const [errorEventsPagination, setErrorEventsPagination] = React.useState<AdminPagination>({
    page: 1,
    perPage: ERROR_EVENTS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [errorStatusUpdatingId, setErrorStatusUpdatingId] = React.useState<string | null>(null);
  const [bulkIncidentStatusUpdating, setBulkIncidentStatusUpdating] = React.useState<
    "resolved" | "ignored" | null
  >(null);
  const [bulkIncidentStatusResult, setBulkIncidentStatusResult] = React.useState<string | null>(
    null
  );
  const [testIncidentSubmittingScope, setTestIncidentSubmittingScope] = React.useState<
    "app" | "generation" | null
  >(null);
  const [testIncidentResult, setTestIncidentResult] = React.useState<string | null>(null);
  const [errorSummary, setErrorSummary] = React.useState<AdminErrorSummary>({
    openCount: 0,
    highSeverityOpenCount: 0,
    last24hCount: 0,
    appOpenCount: 0,
    generationOpenCount: 0,
  });
  const [errorStatusFilter, setErrorStatusFilter] = React.useState<"open" | "all">("open");
  const [errorScopeFilter, setErrorScopeFilter] = React.useState<"all" | "app" | "generation">(
    "all"
  );
  const [errorSeverityFilter, setErrorSeverityFilter] = React.useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [errorSourceFilter, setErrorSourceFilter] = React.useState<string>("all");
  const [errorEventSyntheticFilter, setErrorEventSyntheticFilter] = React.useState<
    "all" | "exclude" | "only"
  >("exclude");
  const [errorEventSignalFilter, setErrorEventSignalFilter] =
    React.useState<AdminErrorEventSignalFilter>("all");
  const [errorEventIncidentFilter, setErrorEventIncidentFilter] =
    React.useState<AdminErrorEventIncidentFilter>("actionable");
  const [errorSearch, setErrorSearch] = React.useState("");
  const [debouncedErrorSearch, setDebouncedErrorSearch] = React.useState("");
  const [errorsPage, setErrorsPage] = React.useState(1);
  const [errorsPagination, setErrorsPagination] = React.useState<AdminPagination>({
    page: 1,
    perPage: ERRORS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const loadErrors = React.useCallback(
    async (overrides?: ErrorLoadOverrides) => {
      setErrorsLoading(true);
      setErrorsError(null);
      try {
        const activePage = overrides?.page ?? errorsPage;
        const activeStatus = overrides?.status ?? errorStatusFilter;
        const activeScope = overrides?.scope ?? errorScopeFilter;
        const activeSeverity = overrides?.severity ?? errorSeverityFilter;
        const activeSource = overrides?.source ?? errorSourceFilter;
        const activeSearch = overrides?.search ?? debouncedErrorSearch;

        const params = buildAdminErrorsParams({
          page: activePage,
          status: activeStatus,
          scope: activeScope,
          severity: activeSeverity,
          source: activeSource,
          search: activeSearch,
        });

        const response = await fetchWithAuth(`/api/admin/errors?${params.toString()}`, {
          method: "GET",
        });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details?.error || "Failed to load error incidents.");
        }
        const data = (await response.json()) as {
          errors?: unknown[];
          summary?: AdminErrorSummary;
          pagination?: Partial<AdminPagination>;
        };
        const normalized = normalizeAdminErrorsResponse(data, activePage);

        setErrors(normalized.rows);
        setErrorSummary(normalized.summary);
        setErrorsPagination(normalized.pagination);
        if (normalized.pagination.page !== errorsPage) {
          setErrorsPage(normalized.pagination.page);
        }
      } catch (error) {
        setErrorsError(error instanceof Error ? error.message : "Failed to load error incidents.");
      } finally {
        setErrorsLoading(false);
      }
    },
    [
      debouncedErrorSearch,
      errorScopeFilter,
      errorSeverityFilter,
      errorSourceFilter,
      errorStatusFilter,
      errorsPage,
    ]
  );

  const loadErrorEvents = React.useCallback(
    async (overrides?: ErrorEventsLoadOverrides) => {
      setErrorEventsLoading(true);
      setErrorEventsError(null);
      try {
        const activePage = overrides?.page ?? errorEventsPage;
        const activeScope = overrides?.scope ?? errorScopeFilter;
        const activeSeverity = overrides?.severity ?? errorSeverityFilter;
        const activeSource = overrides?.source ?? errorSourceFilter;
        const activeSynthetic = overrides?.synthetic ?? errorEventSyntheticFilter;
        const activeSignal = overrides?.signal ?? errorEventSignalFilter;
        const activeIncident = overrides?.incident ?? errorEventIncidentFilter;
        const activeSearch = overrides?.search ?? debouncedErrorSearch;

        const params = buildAdminErrorEventsParams({
          page: activePage,
          scope: activeScope,
          severity: activeSeverity,
          source: activeSource,
          synthetic: activeSynthetic,
          signal: activeSignal,
          incident: activeIncident,
          search: activeSearch,
        });

        const response = await fetchWithAuth(`/api/admin/error-events?${params.toString()}`, {
          method: "GET",
        });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details?.error || "Failed to load error events.");
        }
        const data = (await response.json()) as {
          events?: unknown[];
          summary?: AdminErrorEventSummary;
          health?: Partial<AdminErrorEventsHealth>;
          pagination?: Partial<AdminPagination>;
        };
        const normalized = normalizeAdminErrorEventsResponse(data, activePage);

        setErrorEvents(normalized.rows);
        setErrorEventsSummary(normalized.summary);
        setErrorEventsHealth(normalized.health);
        setErrorEventsPagination(normalized.pagination);
        if (normalized.pagination.page !== errorEventsPage) {
          setErrorEventsPage(normalized.pagination.page);
        }
      } catch (error) {
        setErrorEventsError(
          error instanceof Error ? error.message : "Failed to load error events."
        );
        setErrorEventsHealth(DEFAULT_ERROR_EVENTS_HEALTH);
      } finally {
        setErrorEventsLoading(false);
      }
    },
    [
      debouncedErrorSearch,
      errorEventSyntheticFilter,
      errorEventSignalFilter,
      errorEventIncidentFilter,
      errorEventsPage,
      errorScopeFilter,
      errorSeverityFilter,
      errorSourceFilter,
    ]
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedErrorSearch(errorSearch), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [errorSearch]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadErrors();
  }, [enabled, loadErrors]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadErrorEvents();
  }, [enabled, loadErrorEvents]);

  const handleUpdateErrorStatus = React.useCallback(
    async (errorId: string, status: AdminErrorStatus) => {
      setErrorStatusUpdatingId(errorId);
      setErrorsError(null);
      setErrorEventsError(null);
      try {
        const response = await fetchWithAuth("/api/admin/errors-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorId, status }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Failed to update incident status.");
        }
        await Promise.all([loadErrors(), loadErrorEvents()]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update incident status.";
        setErrorsError(message);
        setErrorEventsError(message);
      } finally {
        setErrorStatusUpdatingId((current) => (current === errorId ? null : current));
      }
    },
    [loadErrorEvents, loadErrors]
  );

  const handleUpdateErrorEventStatus = React.useCallback(
    async (eventId: string, status: AdminErrorStatus) => {
      setErrorStatusUpdatingId(eventId);
      setErrorsError(null);
      setErrorEventsError(null);
      try {
        const response = await fetchWithAuth("/api/admin/errors-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, status }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Failed to update event status.");
        }
        await Promise.all([loadErrors(), loadErrorEvents()]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update event status.";
        setErrorsError(message);
        setErrorEventsError(message);
      } finally {
        setErrorStatusUpdatingId((current) => (current === eventId ? null : current));
      }
    },
    [loadErrorEvents, loadErrors]
  );

  const handleBulkUpdateListedErrorStatus = React.useCallback(
    async (status: "resolved" | "ignored") => {
      const openIncidentIds = errors
        .filter((row) => row.status === "open")
        .map((row) => row.id)
        .filter((value, index, source) => source.indexOf(value) === index);

      if (!openIncidentIds.length) {
        setBulkIncidentStatusResult("No open incidents are listed on this page.");
        return;
      }

      setBulkIncidentStatusUpdating(status);
      setBulkIncidentStatusResult(null);
      setErrorsError(null);
      setErrorEventsError(null);

      try {
        const response = await fetchWithAuth("/api/admin/errors-status-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorIds: openIncidentIds, status }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          summary?: {
            requestedCount?: number;
            updatedCount?: number;
            failedCount?: number;
          };
        };
        if (!response.ok) {
          throw new Error(data?.error || "Failed to update listed incidents.");
        }

        await Promise.all([loadErrors(), loadErrorEvents()]);
        const updatedCount = Number(data.summary?.updatedCount ?? 0);
        const failedCount = Number(data.summary?.failedCount ?? 0);
        const statusLabel = status === "resolved" ? "resolved" : "ignored";
        if (failedCount > 0) {
          setBulkIncidentStatusResult(
            `Bulk update completed with partial success: ${updatedCount} ${statusLabel}, ${failedCount} failed.`
          );
          return;
        }
        setBulkIncidentStatusResult(
          `Bulk update complete: ${updatedCount} incident${updatedCount === 1 ? "" : "s"} ${statusLabel}.`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update listed incidents.";
        setErrorsError(message);
        setErrorEventsError(message);
        setBulkIncidentStatusResult(message);
      } finally {
        setBulkIncidentStatusUpdating((current) => (current === status ? null : current));
      }
    },
    [errors, loadErrorEvents, loadErrors]
  );

  const refreshErrorData = React.useCallback(async () => {
    await Promise.all([loadErrors(), loadErrorEvents()]);
  }, [loadErrorEvents, loadErrors]);

  React.useEffect(() => {
    if (!liveRefreshEnabled) return;

    const refreshIfEligible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (errorsLoading || errorEventsLoading || testIncidentSubmittingScope !== null) {
        return;
      }
      void refreshErrorData();
    };

    const intervalId = window.setInterval(() => {
      refreshIfEligible();
    }, ERROR_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      refreshIfEligible();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    errorEventsLoading,
    errorsLoading,
    liveRefreshEnabled,
    refreshErrorData,
    testIncidentSubmittingScope,
  ]);

  const handleTriggerTestIncident = React.useCallback(
    async (scope: "app" | "generation") => {
      setTestIncidentSubmittingScope(scope);
      setTestIncidentResult(null);
      setErrorsError(null);
      try {
        const response = await fetchWithAuth("/api/admin/errors-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            severity: "high",
            statusCode: scope === "generation" ? 502 : 500,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Failed to create synthetic incident.");
        }

        setErrorStatusFilter("open");
        setErrorScopeFilter("all");
        setErrorSeverityFilter("all");
        setErrorSourceFilter("all");
        setErrorEventSyntheticFilter("exclude");
        setErrorEventSignalFilter("all");
        setErrorEventIncidentFilter("actionable");
        setErrorSearch("");
        setDebouncedErrorSearch("");
        setErrorsPage(1);
        setErrorEventsPage(1);
        await Promise.all([
          loadErrors({
            page: 1,
            status: "open",
            scope: "all",
            severity: "all",
            source: "all",
            search: "",
          }),
          loadErrorEvents({
            page: 1,
            scope: "all",
            severity: "all",
            source: "all",
            synthetic: "exclude",
            signal: "all",
            incident: "actionable",
            search: "",
          }),
        ]);
        setTestIncidentResult(
          `Synthetic ${scope} incident logged${data?.incidentId ? ` (${String(data.incidentId).slice(0, 8)}…)` : ""}.`
        );
      } catch (error) {
        setTestIncidentResult(
          error instanceof Error ? error.message : "Failed to create synthetic incident."
        );
      } finally {
        setTestIncidentSubmittingScope((current) => (current === scope ? null : current));
      }
    },
    [loadErrorEvents, loadErrors]
  );

  const handleErrorStatusFilterChange = React.useCallback((value: "open" | "all") => {
    setErrorStatusFilter(value);
    setErrorsPage(1);
  }, []);

  const handleErrorScopeFilterChange = React.useCallback((value: "all" | "app" | "generation") => {
    setErrorScopeFilter(value);
    setErrorsPage(1);
    setErrorEventsPage(1);
  }, []);

  const handleErrorSeverityFilterChange = React.useCallback(
    (value: "all" | "high" | "medium" | "low") => {
      setErrorSeverityFilter(value);
      setErrorsPage(1);
      setErrorEventsPage(1);
    },
    []
  );

  const handleErrorSourceFilterChange = React.useCallback((value: string) => {
    setErrorSourceFilter(value);
    setErrorEventSignalFilter("all");
    setErrorsPage(1);
    setErrorEventsPage(1);
  }, []);

  const handleErrorEventSyntheticFilterChange = React.useCallback(
    (value: "all" | "exclude" | "only") => {
      setErrorEventSyntheticFilter(value);
      setErrorEventsPage(1);
    },
    []
  );

  const handleErrorEventSignalFilterChange = React.useCallback(
    (value: AdminErrorEventSignalFilter) => {
      setErrorEventSignalFilter(value);
      setErrorSourceFilter("all");
      setErrorEventsPage(1);
    },
    []
  );

  const handleErrorEventIncidentFilterChange = React.useCallback(
    (value: AdminErrorEventIncidentFilter) => {
      setErrorEventIncidentFilter(value);
      setErrorEventsPage(1);
    },
    []
  );

  const handleErrorSearchChange = React.useCallback((value: string) => {
    setErrorSearch(value);
    setErrorsPage(1);
    setErrorEventsPage(1);
  }, []);

  const handleErrorsPrevPage = React.useCallback(() => {
    setErrorsPage((value) => Math.max(1, value - 1));
  }, []);

  const handleErrorsNextPage = React.useCallback(() => {
    setErrorsPage((value) => value + 1);
  }, []);

  const handleErrorEventsPrevPage = React.useCallback(() => {
    setErrorEventsPage((value) => Math.max(1, value - 1));
  }, []);

  const handleErrorEventsNextPage = React.useCallback(() => {
    setErrorEventsPage((value) => value + 1);
  }, []);

  return {
    errors,
    errorsLoading,
    errorsError,
    errorSummary,
    errorEvents,
    errorEventsLoading,
    errorEventsError,
    errorEventsSummary,
    errorEventsHealth,
    errorEventsPagination,
    errorStatusFilter,
    errorScopeFilter,
    errorSeverityFilter,
    errorSourceFilter,
    errorEventSyntheticFilter,
    errorEventSignalFilter,
    errorEventIncidentFilter,
    errorSearch,
    errorsPagination,
    errorStatusUpdatingId,
    bulkIncidentStatusUpdating,
    bulkIncidentStatusResult,
    testIncidentSubmittingScope,
    testIncidentResult,
    handleErrorStatusFilterChange,
    handleErrorScopeFilterChange,
    handleErrorSeverityFilterChange,
    handleErrorSourceFilterChange,
    handleErrorEventSyntheticFilterChange,
    handleErrorEventSignalFilterChange,
    handleErrorEventIncidentFilterChange,
    handleErrorSearchChange,
    handleUpdateErrorStatus,
    handleUpdateErrorEventStatus,
    handleBulkUpdateListedErrorStatus,
    handleTriggerTestIncident,
    handleErrorsPrevPage,
    handleErrorsNextPage,
    handleErrorEventsPrevPage,
    handleErrorEventsNextPage,
    refreshErrorData,
  };
};
