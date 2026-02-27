/**
 * Admin dashboard.
 * Lists user/credit state and actionable app error incidents for operators.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CloudSlash, ShieldCheck, UserCircle } from "phosphor-react";
import { ErrorIncidentsPanel } from "../../features/admin/components/ErrorIncidentsPanel";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import type {
  AdminCreditLedgerRow,
  AdminErrorEventIncidentFilter,
  AdminErrorLogRow,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorEventsHealth,
  AdminErrorEventSummary,
  AdminErrorStatus,
  AdminErrorSummary,
  AdminPagination,
  AdminUserRow,
} from "../../features/admin/types";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";
import { fetchWithAuth } from "../../lib/authenticatedFetch";

const planLabel = (planId: string | null): string => {
  if (!planId) return "—";
  // Handle legacy plan names
  if (planId === "creative_suite" || planId === "creative") return "Business";
  if (planId === "pro") return "Studio";
  if (planId === "business") return "Business";
  if (planId === "studio") return "Studio";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
};

const USERS_PER_PAGE = 50;
const ERRORS_PER_PAGE = 50;
const ERROR_EVENTS_PER_PAGE = 50;
const CREDIT_LEDGER_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 250;
const ERROR_REFRESH_INTERVAL_MS = 30000;
const ADJUSTMENT_PRESETS = [100, 500, -100, -500] as const;
const DEFAULT_ERROR_EVENTS_SUMMARY: AdminErrorEventSummary = {
  last15mCount: 0,
  high15mCount: 0,
  generation15mCount: 0,
  lastHourCount: 0,
  last24hCount: 0,
  app24hCount: 0,
  generation24hCount: 0,
  high24hCount: 0,
  characterModeReferenceRefreshEmptyLastHourCount: 0,
  characterModeReferenceRefreshEmptyLast24hCount: 0,
  characterModeBundleUnavailableFallbackLastHourCount: 0,
  characterModeBundleUnavailableFallbackLast24hCount: 0,
  total15mThreshold: 40,
  high15mThreshold: 8,
  generation15mThreshold: 20,
  total15mBreached: false,
  high15mBreached: false,
  generation15mBreached: false,
};
const DEFAULT_ERROR_EVENTS_HEALTH: AdminErrorEventsHealth = {
  eventsTableAvailable: true,
  degraded: false,
  reason: null,
};
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

const sanitizeSignedIntegerInput = (rawValue: string): string => {
  const compact = rawValue.replace(/\s+/g, "");
  if (!compact.length) return "";
  const sign = compact.startsWith("+") || compact.startsWith("-") ? compact.charAt(0) : "";
  const digits = compact.slice(sign ? 1 : 0).replace(/\D/g, "");
  return `${sign}${digits}`;
};

const parseAdjustmentInput = (rawValue: string): number | null => {
  const normalized = sanitizeSignedIntegerInput(rawValue);
  if (!normalized || normalized === "+" || normalized === "-") return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const whole = Math.trunc(parsed);
  if (whole === 0) return null;
  return whole;
};

const formatCreditDelta = (changeCents: number): string =>
  `${changeCents > 0 ? "+" : ""}${Math.trunc(changeCents).toLocaleString()}`;

const formatUsd = (value: number | null): string => (value == null ? "—" : `$${value.toFixed(2)}`);

export default function AdminDashboardPage() {
  const { loading, user } = useProtectedRoute(true);
  const [activeTab, setActiveTab] = useState<"overview" | "errors">("overview");
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState<AdminPagination>({
    page: 1,
    perPage: USERS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [userSearchLimited, setUserSearchLimited] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [adjustment, setAdjustment] = useState<string>("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustResult, setAdjustResult] = useState<string | null>(null);
  const [creditLedgerRows, setCreditLedgerRows] = useState<AdminCreditLedgerRow[]>([]);
  const [creditLedgerLoading, setCreditLedgerLoading] = useState(false);
  const [creditLedgerError, setCreditLedgerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<AdminErrorLogRow[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [errorsError, setErrorsError] = useState<string | null>(null);
  const [errorEvents, setErrorEvents] = useState<AdminErrorEventRow[]>([]);
  const [errorEventsLoading, setErrorEventsLoading] = useState(false);
  const [errorEventsError, setErrorEventsError] = useState<string | null>(null);
  const [errorEventsSummary, setErrorEventsSummary] = useState<AdminErrorEventSummary>(
    DEFAULT_ERROR_EVENTS_SUMMARY
  );
  const [errorEventsHealth, setErrorEventsHealth] = useState<AdminErrorEventsHealth>(
    DEFAULT_ERROR_EVENTS_HEALTH
  );
  const [errorEventsPage, setErrorEventsPage] = useState(1);
  const [errorEventsPagination, setErrorEventsPagination] = useState<AdminPagination>({
    page: 1,
    perPage: ERROR_EVENTS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [errorStatusUpdatingId, setErrorStatusUpdatingId] = useState<string | null>(null);
  const [testIncidentSubmittingScope, setTestIncidentSubmittingScope] = useState<
    "app" | "generation" | null
  >(null);
  const [testIncidentResult, setTestIncidentResult] = useState<string | null>(null);
  const [errorSummary, setErrorSummary] = useState<AdminErrorSummary>({
    openCount: 0,
    highSeverityOpenCount: 0,
    last24hCount: 0,
    appOpenCount: 0,
    generationOpenCount: 0,
  });
  const [errorStatusFilter, setErrorStatusFilter] = useState<"open" | "all">("open");
  const [errorScopeFilter, setErrorScopeFilter] = useState<"all" | "app" | "generation">("all");
  const [errorSeverityFilter, setErrorSeverityFilter] = useState<"all" | "high" | "medium" | "low">(
    "all"
  );
  const [errorSourceFilter, setErrorSourceFilter] = useState<string>("all");
  const [errorEventSyntheticFilter, setErrorEventSyntheticFilter] = useState<
    "all" | "exclude" | "only"
  >("exclude");
  const [errorEventSignalFilter, setErrorEventSignalFilter] =
    useState<AdminErrorEventSignalFilter>("all");
  const [errorEventIncidentFilter, setErrorEventIncidentFilter] =
    useState<AdminErrorEventIncidentFilter>("actionable");
  const [errorSearch, setErrorSearch] = useState("");
  const [debouncedErrorSearch, setDebouncedErrorSearch] = useState("");
  const [errorsPage, setErrorsPage] = useState(1);
  const [errorsPagination, setErrorsPagination] = useState<AdminPagination>({
    page: 1,
    perPage: ERRORS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: adminEnabled,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({
    enabled: Boolean(user),
  });

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(usersPage));
      params.set("perPage", String(USERS_PER_PAGE));
      if (debouncedUserSearch.trim()) {
        params.set("search", debouncedUserSearch.trim());
      }

      const response = await fetchWithAuth(`/api/admin/users?${params.toString()}`, {
        method: "GET",
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || "Failed to load users.");
      }
      const data = (await response.json()) as {
        users?: AdminUserRow[];
        pagination?: Partial<AdminPagination>;
        search?: { limited?: boolean };
      };
      const resolvedPage = Number(data.pagination?.page ?? usersPage);
      setUsers(data.users ?? []);
      setUsersPagination({
        page: resolvedPage,
        perPage: Number(data.pagination?.perPage ?? USERS_PER_PAGE),
        totalCount: Number(data.pagination?.totalCount ?? 0),
        totalPages: Number(data.pagination?.totalPages ?? 1),
        hasNextPage: Boolean(data.pagination?.hasNextPage),
        hasPrevPage: Boolean(data.pagination?.hasPrevPage),
      });
      setUserSearchLimited(Boolean(data.search?.limited));
      if (resolvedPage !== usersPage) {
        setUsersPage(resolvedPage);
      }
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [debouncedUserSearch, usersPage]);

  const loadCreditLedger = useCallback(async () => {
    if (!selectedUserId) {
      setCreditLedgerRows([]);
      setCreditLedgerError(null);
      return;
    }

    setCreditLedgerLoading(true);
    setCreditLedgerError(null);
    try {
      const params = new URLSearchParams();
      params.set("userId", selectedUserId);
      params.set("limit", String(CREDIT_LEDGER_LIMIT));

      const response = await fetchWithAuth(`/api/admin/credits/ledger?${params.toString()}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        transactions?: unknown[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load credit transactions.");
      }

      const rows = Array.isArray(payload.transactions)
        ? payload.transactions.map((item) => {
            const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
            const breakdownValue =
              value.pricingBreakdown && typeof value.pricingBreakdown === "object"
                ? (value.pricingBreakdown as Record<string, unknown>)
                : null;
            return {
              id: String(value.id ?? ""),
              userId: String(value.userId ?? selectedUserId),
              changeCents: Number(value.changeCents ?? 0),
              reason: typeof value.reason === "string" ? value.reason : "",
              source: typeof value.source === "string" ? value.source : "system",
              sourceRef: typeof value.sourceRef === "string" ? value.sourceRef : null,
              pricingBreakdown: breakdownValue
                ? {
                    usdRaw: Number.isFinite(Number(breakdownValue.usdRaw))
                      ? Number(breakdownValue.usdRaw)
                      : null,
                    rawCredits: Number.isFinite(Number(breakdownValue.rawCredits))
                      ? Number(breakdownValue.rawCredits)
                      : null,
                    billedCredits: Number.isFinite(Number(breakdownValue.billedCredits))
                      ? Number(breakdownValue.billedCredits)
                      : null,
                    billedUsd: Number.isFinite(Number(breakdownValue.billedUsd))
                      ? Number(breakdownValue.billedUsd)
                      : null,
                  }
                : null,
              createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
            };
          })
        : [];
      setCreditLedgerRows(rows);
    } catch (error) {
      setCreditLedgerError(
        error instanceof Error ? error.message : "Failed to load credit transactions."
      );
      setCreditLedgerRows([]);
    } finally {
      setCreditLedgerLoading(false);
    }
  }, [selectedUserId]);

  const loadErrors = useCallback(
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

        const params = new URLSearchParams();
        params.set("page", String(activePage));
        params.set("limit", String(ERRORS_PER_PAGE));
        params.set("status", activeStatus);
        if (activeScope !== "all") params.set("scope", activeScope);
        if (activeSeverity !== "all") params.set("severity", activeSeverity);
        if (activeSource !== "all") params.set("source", activeSource);
        if (activeSearch.trim()) params.set("search", activeSearch.trim());

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
        const resolvedPage = Number(data.pagination?.page ?? activePage);

        const rows = (data.errors ?? []).map((item) => {
          const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            id: String(value.id ?? ""),
            fingerprint: String(value.fingerprint ?? ""),
            source: String(value.source ?? "unknown"),
            scope: value.scope === "generation" ? "generation" : "app",
            severity:
              value.severity === "high" || value.severity === "low" ? value.severity : "medium",
            status:
              value.status === "resolved" || value.status === "ignored" ? value.status : "open",
            message: String(value.message ?? "Unknown error"),
            stack: typeof value.stack === "string" ? value.stack : null,
            route: typeof value.route === "string" ? value.route : null,
            endpoint: typeof value.endpoint === "string" ? value.endpoint : null,
            requestId: typeof value.request_id === "string" ? value.request_id : null,
            httpStatus: Number.isFinite(Number(value.http_status))
              ? Number(value.http_status)
              : null,
            userId: typeof value.user_id === "string" ? value.user_id : null,
            userEmail: typeof value.user_email === "string" ? value.user_email : null,
            metadata:
              value.metadata && typeof value.metadata === "object"
                ? (value.metadata as Record<string, unknown>)
                : null,
            firstSeenAt: typeof value.first_seen_at === "string" ? value.first_seen_at : null,
            lastSeenAt: typeof value.last_seen_at === "string" ? value.last_seen_at : null,
            occurrencesCount: Number.isFinite(Number(value.occurrences_count))
              ? Number(value.occurrences_count)
              : 1,
          };
        }) as AdminErrorLogRow[];

        setErrors(rows);
        setErrorSummary({
          openCount: Number(data.summary?.openCount ?? 0),
          highSeverityOpenCount: Number(data.summary?.highSeverityOpenCount ?? 0),
          last24hCount: Number(data.summary?.last24hCount ?? 0),
          appOpenCount: Number(data.summary?.appOpenCount ?? 0),
          generationOpenCount: Number(data.summary?.generationOpenCount ?? 0),
        });
        setErrorsPagination({
          page: resolvedPage,
          perPage: Number(data.pagination?.perPage ?? ERRORS_PER_PAGE),
          totalCount: Number(data.pagination?.totalCount ?? 0),
          totalPages: Number(data.pagination?.totalPages ?? 1),
          hasNextPage: Boolean(data.pagination?.hasNextPage),
          hasPrevPage: Boolean(data.pagination?.hasPrevPage),
        });
        if (resolvedPage !== errorsPage) {
          setErrorsPage(resolvedPage);
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

  const loadErrorEvents = useCallback(
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

        const params = new URLSearchParams();
        params.set("page", String(activePage));
        params.set("limit", String(ERROR_EVENTS_PER_PAGE));
        if (activeScope !== "all") params.set("scope", activeScope);
        if (activeSeverity !== "all") params.set("severity", activeSeverity);
        if (activeSource !== "all") params.set("source", activeSource);
        if (activeSynthetic !== "all") params.set("synthetic", activeSynthetic);
        if (activeSignal !== "all") params.set("signal", activeSignal);
        if (activeIncident !== "all") params.set("incident", activeIncident);
        if (activeSearch.trim()) params.set("search", activeSearch.trim());

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
        const resolvedPage = Number(data.pagination?.page ?? activePage);
        const rows = (data.events ?? []).map((item) => {
          const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            id: String(value.id ?? ""),
            incidentId: typeof value.incident_id === "string" ? value.incident_id : null,
            incidentStatus:
              value.incident_status === "resolved" || value.incident_status === "ignored"
                ? value.incident_status
                : value.incident_status === "open"
                  ? "open"
                  : null,
            fingerprint: String(value.fingerprint ?? ""),
            source: String(value.source ?? "unknown"),
            scope: value.scope === "generation" ? "generation" : "app",
            severity:
              value.severity === "high" || value.severity === "low" ? value.severity : "medium",
            message: String(value.message ?? "Unknown error event"),
            stack: typeof value.stack === "string" ? value.stack : null,
            route: typeof value.route === "string" ? value.route : null,
            endpoint: typeof value.endpoint === "string" ? value.endpoint : null,
            requestId: typeof value.request_id === "string" ? value.request_id : null,
            httpStatus: Number.isFinite(Number(value.http_status))
              ? Number(value.http_status)
              : null,
            userId: typeof value.user_id === "string" ? value.user_id : null,
            userEmail: typeof value.user_email === "string" ? value.user_email : null,
            metadata:
              value.metadata && typeof value.metadata === "object"
                ? (value.metadata as Record<string, unknown>)
                : null,
            occurredAt: typeof value.occurred_at === "string" ? value.occurred_at : null,
            createdAt: typeof value.created_at === "string" ? value.created_at : null,
          };
        }) as AdminErrorEventRow[];

        setErrorEvents(rows);
        setErrorEventsSummary({
          last15mCount: Number(data.summary?.last15mCount ?? 0),
          high15mCount: Number(data.summary?.high15mCount ?? 0),
          generation15mCount: Number(data.summary?.generation15mCount ?? 0),
          lastHourCount: Number(data.summary?.lastHourCount ?? 0),
          last24hCount: Number(data.summary?.last24hCount ?? 0),
          app24hCount: Number(data.summary?.app24hCount ?? 0),
          generation24hCount: Number(data.summary?.generation24hCount ?? 0),
          high24hCount: Number(data.summary?.high24hCount ?? 0),
          characterModeReferenceRefreshEmptyLastHourCount: Number(
            data.summary?.characterModeReferenceRefreshEmptyLastHourCount ?? 0
          ),
          characterModeReferenceRefreshEmptyLast24hCount: Number(
            data.summary?.characterModeReferenceRefreshEmptyLast24hCount ?? 0
          ),
          characterModeBundleUnavailableFallbackLastHourCount: Number(
            data.summary?.characterModeBundleUnavailableFallbackLastHourCount ?? 0
          ),
          characterModeBundleUnavailableFallbackLast24hCount: Number(
            data.summary?.characterModeBundleUnavailableFallbackLast24hCount ?? 0
          ),
          total15mThreshold: Number(data.summary?.total15mThreshold ?? 40),
          high15mThreshold: Number(data.summary?.high15mThreshold ?? 8),
          generation15mThreshold: Number(data.summary?.generation15mThreshold ?? 20),
          total15mBreached: Boolean(data.summary?.total15mBreached),
          high15mBreached: Boolean(data.summary?.high15mBreached),
          generation15mBreached: Boolean(data.summary?.generation15mBreached),
        });
        setErrorEventsHealth({
          eventsTableAvailable: Boolean(data.health?.eventsTableAvailable ?? true),
          degraded: Boolean(data.health?.degraded ?? false),
          reason: typeof data.health?.reason === "string" ? data.health.reason : null,
        });
        setErrorEventsPagination({
          page: resolvedPage,
          perPage: Number(data.pagination?.perPage ?? ERROR_EVENTS_PER_PAGE),
          totalCount: Number(data.pagination?.totalCount ?? 0),
          totalPages: Number(data.pagination?.totalPages ?? 1),
          hasNextPage: Boolean(data.pagination?.hasNextPage),
          hasPrevPage: Boolean(data.pagination?.hasPrevPage),
        });
        if (resolvedPage !== errorEventsPage) {
          setErrorEventsPage(resolvedPage);
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserSearch(userSearch), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedErrorSearch(errorSearch), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [errorSearch]);

  useEffect(() => {
    if (!user || !adminEnabled) return;
    loadUsers();
  }, [adminEnabled, loadUsers, user]);

  useEffect(() => {
    if (!users.length) {
      if (selectedUserId) setSelectedUserId("");
      return;
    }
    const selectedStillExists = users.some((row) => row.id === selectedUserId);
    if (!selectedUserId || !selectedStillExists) {
      setSelectedUserId(users[0].id);
    }
  }, [selectedUserId, users]);

  useEffect(() => {
    if (!user || !adminEnabled) return;
    void loadCreditLedger();
  }, [adminEnabled, loadCreditLedger, user]);

  useEffect(() => {
    if (!user || !adminEnabled) return;
    loadErrors();
  }, [adminEnabled, loadErrors, user]);

  useEffect(() => {
    if (!user || !adminEnabled) return;
    loadErrorEvents();
  }, [adminEnabled, loadErrorEvents, user]);

  const overview = useMemo(
    () => ({
      activeUsers: usersPagination.totalCount,
      openIssues: errorSummary.openCount,
      pendingCredits: users.filter((row) => row.spendableCredits <= 0).length,
    }),
    [errorSummary.openCount, users, usersPagination.totalCount]
  );

  const usersResultStart =
    usersPagination.totalCount === 0 ? 0 : (usersPagination.page - 1) * usersPagination.perPage + 1;
  const usersResultEnd = Math.min(
    usersPagination.page * usersPagination.perPage,
    usersPagination.totalCount
  );

  const handleCreditAdjust = async () => {
    const normalized = parseAdjustmentInput(adjustment);
    if (!selectedUserId || normalized === null) {
      setAdjustResult("Pick a user and enter a non-zero credit amount.");
      return;
    }

    setAdjustSubmitting(true);
    setAdjustResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          changeCents: normalized,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Credit adjustment failed.");
      }

      setAdjustment("");
      setAdjustResult("Credit adjustment applied.");
      await Promise.all([loadUsers(), loadCreditLedger()]);
    } catch (error) {
      setAdjustResult(error instanceof Error ? error.message : "Credit adjustment failed.");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const applyAdjustmentPreset = useCallback((delta: number) => {
    setAdjustment((current) => {
      const parsed = parseAdjustmentInput(current);
      const base = parsed ?? 0;
      return String(base + delta);
    });
  }, []);

  const handleUpdateErrorStatus = useCallback(
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

  const handleUpdateErrorEventStatus = useCallback(
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

  const refreshErrorData = useCallback(async () => {
    await Promise.all([loadErrors(), loadErrorEvents()]);
  }, [loadErrorEvents, loadErrors]);

  useEffect(() => {
    if (!user || !adminEnabled || activeTab !== "errors") return;

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
    activeTab,
    adminEnabled,
    errorEventsLoading,
    errorsLoading,
    refreshErrorData,
    testIncidentSubmittingScope,
    user,
  ]);

  const handleTriggerTestIncident = useCallback(
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

  if (loading) {
    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <p className="subdued">Checking your session…</p>
      </main>
    );
  }

  if (!adminEnabled) {
    if (isAdminAccessLoading) {
      return (
        <main className={`page page-wide ${styles.adminPage}`}>
          <p className="subdued">Verifying admin access…</p>
        </main>
      );
    }
    if (adminAccessStatus === "error") {
      return (
        <>
          <Head>
            <title>ShortPulse · Admin</title>
          </Head>
          <main className={`page page-wide ${styles.adminPage}`}>
            <section className={styles.adminSection}>
              <p className="eyebrow">Admin</p>
              <h1 className={styles.adminTitle}>Unable to verify access</h1>
              <p className="tiny subdued">
                {adminAccessError ??
                  "We could not verify admin access right now. Retry in a moment."}
              </p>
              <div className={styles.searchRow}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={refreshAdminAccess}
                  disabled={isAdminAccessLoading}
                >
                  {isAdminAccessLoading ? "Retrying…" : "Retry access check"}
                </button>
                <Link href="/dashboard" className="ghost-btn mini">
                  Back to dashboard
                </Link>
              </div>
            </section>
          </main>
        </>
      );
    }
    return (
      <>
        <Head>
          <title>ShortPulse · Admin</title>
        </Head>
        <main className={`page page-wide ${styles.adminPage}`}>
          <section className={styles.adminSection}>
            <p className="eyebrow">Admin</p>
            <h1 className={styles.adminTitle}>Access restricted</h1>
            <p className="tiny subdued">This page is available to operator accounts only.</p>
            <Link href="/dashboard" className="ghost-btn mini">
              Back to dashboard
            </Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>ShortPulse · Admin</title>
        <meta
          name="description"
          content="Admin dashboard for monitoring users, credits, and errors."
        />
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <header className={styles.adminHeader}>
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1 className={styles.adminTitle}>Operations overview</h1>
            <p className="tiny subdued">
              Monitor plan allocations, credits, and actionable app failures.
            </p>
          </div>
          <div className={styles.adminUserPill}>
            <ShieldCheck size={18} weight="fill" />
            <span>{user?.email ?? "Admin"}</span>
          </div>
        </header>

        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "overview" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "errors" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("errors")}
          >
            Errors
          </button>
          <Link href="/admin/generation-trace" className="ghost-btn mini">
            Generation trace
          </Link>
        </div>

        {activeTab === "overview" ? (
          <>
            <section className={styles.adminGrid}>
              <div className={styles.adminCard}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Tracked users</span>
                  <UserCircle size={18} />
                </div>
                <p className={styles.adminMetric}>{overview.activeUsers}</p>
                <p className={styles.adminSubtext}>From Supabase Auth</p>
              </div>

              <div className={`${styles.adminCard} ${styles.alert}`}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Open failures</span>
                  <CloudSlash size={18} />
                </div>
                <p className={styles.adminMetric}>{overview.openIssues}</p>
                <p className={styles.adminSubtext}>Unique unresolved app incidents</p>
              </div>

              <div className={`${styles.adminCard} ${styles.warning}`}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Low credit users</span>
                </div>
                <p className={styles.adminMetric}>{overview.pendingCredits}</p>
                <p className={styles.adminSubtext}>Current result page</p>
              </div>
            </section>

            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Users & credits</p>
                  <p className="tiny subdued">
                    Adjust balances manually when support requests come in.
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={loadUsers}
                  disabled={usersLoading}
                >
                  {usersLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              <div className={styles.searchRow}>
                <label htmlFor="user-search" className="tiny subdued">
                  Search users
                </label>
                <input
                  id="user-search"
                  className={styles.searchInput}
                  type="search"
                  value={userSearch}
                  onChange={(event) => {
                    setUserSearch(event.target.value);
                    setUsersPage(1);
                  }}
                  placeholder="Search by email"
                />
              </div>

              <div className={styles.adminTable}>
                <div className={styles.adminTableHead}>
                  <span>User</span>
                  <span>Plan</span>
                  <span>Spendable</span>
                  <span>Subscription</span>
                  <span>Created</span>
                </div>
                {usersError ? (
                  <div className={styles.adminTableRow}>
                    <span className="subdued">{usersError}</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                  </div>
                ) : users.length === 0 ? (
                  <div className={styles.adminTableRow}>
                    <span className="subdued">No users match.</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                  </div>
                ) : (
                  users.map((row) => (
                    <div key={row.id} className={styles.adminTableRow}>
                      <span>{row.email ?? row.id}</span>
                      <span>{planLabel(row.planId)}</span>
                      <span className={styles.adminCreditCell}>
                        <span className="mono">{row.spendableCredits.toLocaleString()}</span>
                        <span className={styles.adminCreditMeta}>
                          avail {row.availableCredits.toLocaleString()} · holds{" "}
                          {row.reservedCredits.toLocaleString()}
                        </span>
                      </span>
                      <span className="subdued">{row.subscriptionStatus ?? "inactive"}</span>
                      <span className="subdued">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className={styles.searchRow}>
                <p className="tiny subdued">
                  Showing {usersResultStart}-{usersResultEnd} of {usersPagination.totalCount}
                  {userSearchLimited ? " (search limited to the first 10,000 users scanned)" : ""}
                </p>
                <div className={styles.tabRow}>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => setUsersPage((value) => Math.max(1, value - 1))}
                    disabled={usersLoading || !usersPagination.hasPrevPage}
                  >
                    Prev
                  </button>
                  <span className="tiny subdued">
                    Page {usersPagination.page} of {usersPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => setUsersPage((value) => value + 1)}
                    disabled={usersLoading || !usersPagination.hasNextPage}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Manual adjustment</p>
                  <p className="tiny subdued">
                    Use positive numbers to add credits, negative to remove.
                  </p>
                </div>
              </div>
              <div className={styles.manualAdjustGrid}>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Target user</span>
                  <select
                    className={styles.searchInput}
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                  >
                    {users.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.email ?? row.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Credit adjustment</span>
                  <input
                    className={styles.searchInput}
                    type="text"
                    value={adjustment}
                    pattern="[+-]?[0-9]*"
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(event) =>
                      setAdjustment(sanitizeSignedIntegerInput(event.target.value))
                    }
                    placeholder="+500 or -100"
                  />
                  <div className={styles.manualAdjustPresets}>
                    {ADJUSTMENT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => applyAdjustmentPreset(preset)}
                        disabled={adjustSubmitting}
                      >
                        {preset > 0 ? `+${preset}` : String(preset)}
                      </button>
                    ))}
                  </div>
                </label>
                <div className={styles.manualAdjustActions}>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={handleCreditAdjust}
                    disabled={adjustSubmitting}
                  >
                    {adjustSubmitting ? "Applying…" : "Apply"}
                  </button>
                </div>
              </div>
              {adjustResult ? <p className="tiny subdued">{adjustResult}</p> : null}

              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Credit transaction log</p>
                  <p className="tiny subdued">
                    Latest {CREDIT_LEDGER_LIMIT} ledger rows for the selected user, including billed
                    vs raw pricing metadata when available.
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={loadCreditLedger}
                  disabled={creditLedgerLoading || !selectedUserId}
                >
                  {creditLedgerLoading ? "Refreshing…" : "Refresh log"}
                </button>
              </div>

              <div className={styles.adminTable}>
                <div className={styles.adminLedgerHead}>
                  <span>Time</span>
                  <span>Source</span>
                  <span>Change</span>
                  <span>Pricing</span>
                  <span>Reason / Ref</span>
                </div>
                {creditLedgerError ? (
                  <div className={styles.adminLedgerRow}>
                    <span className="subdued">{creditLedgerError}</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                  </div>
                ) : !selectedUserId ? (
                  <div className={styles.adminLedgerRow}>
                    <span className="subdued">Pick a user to inspect transactions.</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                  </div>
                ) : creditLedgerRows.length === 0 ? (
                  <div className={styles.adminLedgerRow}>
                    <span className="subdued">No recent credit transactions.</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                  </div>
                ) : (
                  creditLedgerRows.map((row) => (
                    <div key={row.id} className={styles.adminLedgerRow}>
                      <span className="subdued">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                      </span>
                      <span className="mono">{row.source}</span>
                      <span
                        className={
                          row.changeCents < 0 ? styles.ledgerChangeDebit : styles.ledgerChangeCredit
                        }
                      >
                        {formatCreditDelta(row.changeCents)}
                      </span>
                      <span className={styles.ledgerPricing}>
                        {row.pricingBreakdown ? (
                          <>
                            <span className={styles.ledgerPricingLine}>
                              billed {row.pricingBreakdown.billedCredits ?? "—"} cr (
                              {formatUsd(row.pricingBreakdown.billedUsd)})
                            </span>
                            <span className={styles.ledgerPricingLine}>
                              raw {row.pricingBreakdown.rawCredits ?? "—"} cr (
                              {formatUsd(row.pricingBreakdown.usdRaw)})
                            </span>
                          </>
                        ) : (
                          <span className="subdued">—</span>
                        )}
                      </span>
                      <span className={styles.ledgerReason}>
                        <span>{row.reason || "—"}</span>
                        {row.sourceRef ? (
                          <span className={styles.ledgerRef}>ref: {row.sourceRef}</span>
                        ) : null}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <ErrorIncidentsPanel
            errors={errors}
            errorsLoading={errorsLoading}
            errorsError={errorsError}
            errorSummary={errorSummary}
            errorEvents={errorEvents}
            errorEventsLoading={errorEventsLoading}
            errorEventsError={errorEventsError}
            errorEventsSummary={errorEventsSummary}
            errorEventsHealth={errorEventsHealth}
            errorEventsPagination={errorEventsPagination}
            errorStatusFilter={errorStatusFilter}
            errorScopeFilter={errorScopeFilter}
            errorSeverityFilter={errorSeverityFilter}
            errorSourceFilter={errorSourceFilter}
            errorEventSyntheticFilter={errorEventSyntheticFilter}
            errorEventSignalFilter={errorEventSignalFilter}
            errorEventIncidentFilter={errorEventIncidentFilter}
            errorSearch={errorSearch}
            errorPagination={errorsPagination}
            statusUpdatingErrorId={errorStatusUpdatingId}
            testIncidentSubmittingScope={testIncidentSubmittingScope}
            testIncidentResult={testIncidentResult}
            onErrorStatusFilterChange={(value) => {
              setErrorStatusFilter(value);
              setErrorsPage(1);
            }}
            onErrorScopeFilterChange={(value) => {
              setErrorScopeFilter(value);
              setErrorsPage(1);
              setErrorEventsPage(1);
            }}
            onErrorSeverityFilterChange={(value) => {
              setErrorSeverityFilter(value);
              setErrorsPage(1);
              setErrorEventsPage(1);
            }}
            onErrorSourceFilterChange={(value) => {
              setErrorSourceFilter(value);
              setErrorEventSignalFilter("all");
              setErrorsPage(1);
              setErrorEventsPage(1);
            }}
            onErrorEventSyntheticFilterChange={(value) => {
              setErrorEventSyntheticFilter(value);
              setErrorEventsPage(1);
            }}
            onErrorEventSignalFilterChange={(value) => {
              setErrorEventSignalFilter(value);
              setErrorSourceFilter("all");
              setErrorEventsPage(1);
            }}
            onErrorEventIncidentFilterChange={(value) => {
              setErrorEventIncidentFilter(value);
              setErrorEventsPage(1);
            }}
            onErrorSearchChange={(value) => {
              setErrorSearch(value);
              setErrorsPage(1);
              setErrorEventsPage(1);
            }}
            onUpdateErrorStatus={handleUpdateErrorStatus}
            onUpdateErrorEventStatus={handleUpdateErrorEventStatus}
            onTriggerTestIncident={handleTriggerTestIncident}
            onPrevPage={() => setErrorsPage((value) => Math.max(1, value - 1))}
            onNextPage={() => setErrorsPage((value) => value + 1)}
            onEventPrevPage={() => setErrorEventsPage((value) => Math.max(1, value - 1))}
            onEventNextPage={() => setErrorEventsPage((value) => value + 1)}
            onRefresh={refreshErrorData}
          />
        )}
      </main>
    </>
  );
}
