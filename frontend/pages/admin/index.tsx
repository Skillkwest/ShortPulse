/**
 * Admin dashboard.
 * Lists user/credit state and actionable app error incidents for operators.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CloudSlash, ShieldCheck, UserCircle } from "phosphor-react";
import { ErrorIncidentsPanel } from "../../features/admin/components/ErrorIncidentsPanel";
import type {
  AdminErrorLogRow,
  AdminErrorStatus,
  AdminErrorSummary,
  AdminPagination,
  AdminUserRow,
} from "../../features/admin/types";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";
import { fetchWithAuth } from "../../lib/authenticatedFetch";

const isAdminUser = (user: unknown): boolean => {
  const record = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const appMetadata =
    record.app_metadata && typeof record.app_metadata === "object"
      ? (record.app_metadata as Record<string, unknown>)
      : {};
  const roles = [appMetadata.role, ...(Array.isArray(appMetadata.roles) ? appMetadata.roles : [])]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return roles.includes("admin") || roles.includes("operator");
};

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
const SEARCH_DEBOUNCE_MS = 250;
const ADJUSTMENT_PRESETS = [100, 500, -100, -500] as const;

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
  const [errors, setErrors] = useState<AdminErrorLogRow[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [errorsError, setErrorsError] = useState<string | null>(null);
  const [errorStatusUpdatingId, setErrorStatusUpdatingId] = useState<string | null>(null);
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
  const [serverDenied, setServerDenied] = useState(false);
  const [serverValidated, setServerValidated] = useState(false);

  const roleBasedAdmin = isAdminUser(user);
  const adminEnabled = roleBasedAdmin || serverValidated;

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
        if (response.status === 403) {
          setServerDenied(true);
          setServerValidated(false);
          setUsers([]);
          setUsersPagination({
            page: 1,
            perPage: USERS_PER_PAGE,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          });
          setUserSearchLimited(false);
          setUsersError(null);
          return;
        }
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || "Failed to load users.");
      }
      const data = (await response.json()) as {
        users?: AdminUserRow[];
        pagination?: Partial<AdminPagination>;
        search?: { limited?: boolean };
      };
      const resolvedPage = Number(data.pagination?.page ?? usersPage);
      setServerDenied(false);
      setServerValidated(true);
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
      setServerDenied(false);
      setUsersError(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [debouncedUserSearch, usersPage]);

  const loadErrors = useCallback(async () => {
    setErrorsLoading(true);
    setErrorsError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(errorsPage));
      params.set("limit", String(ERRORS_PER_PAGE));
      params.set("status", errorStatusFilter);
      if (errorScopeFilter !== "all") params.set("scope", errorScopeFilter);
      if (errorSeverityFilter !== "all") params.set("severity", errorSeverityFilter);
      if (errorSourceFilter !== "all") params.set("source", errorSourceFilter);
      if (debouncedErrorSearch.trim()) params.set("search", debouncedErrorSearch.trim());

      const response = await fetchWithAuth(`/api/admin/errors?${params.toString()}`, {
        method: "GET",
      });
      if (!response.ok) {
        if (response.status === 403) {
          setServerDenied(true);
          setServerValidated(false);
          setErrors([]);
          setErrorsPagination({
            page: 1,
            perPage: ERRORS_PER_PAGE,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          });
          return;
        }
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || "Failed to load error incidents.");
      }
      const data = (await response.json()) as {
        errors?: unknown[];
        summary?: AdminErrorSummary;
        pagination?: Partial<AdminPagination>;
      };
      const resolvedPage = Number(data.pagination?.page ?? errorsPage);

      const rows = (data.errors ?? []).map((item) => {
        const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          id: String(value.id ?? ""),
          fingerprint: String(value.fingerprint ?? ""),
          source: String(value.source ?? "unknown"),
          scope: value.scope === "generation" ? "generation" : "app",
          severity:
            value.severity === "high" || value.severity === "low" ? value.severity : "medium",
          status: value.status === "resolved" || value.status === "ignored" ? value.status : "open",
          message: String(value.message ?? "Unknown error"),
          stack: typeof value.stack === "string" ? value.stack : null,
          route: typeof value.route === "string" ? value.route : null,
          endpoint: typeof value.endpoint === "string" ? value.endpoint : null,
          requestId: typeof value.request_id === "string" ? value.request_id : null,
          httpStatus: Number.isFinite(Number(value.http_status)) ? Number(value.http_status) : null,
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
  }, [
    debouncedErrorSearch,
    errorScopeFilter,
    errorSeverityFilter,
    errorSourceFilter,
    errorStatusFilter,
    errorsPage,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserSearch(userSearch), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedErrorSearch(errorSearch), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [errorSearch]);

  useEffect(() => {
    if (!user) return;
    loadUsers();
  }, [loadUsers, user]);

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
    loadErrors();
  }, [adminEnabled, loadErrors, user]);

  const overview = useMemo(
    () => ({
      activeUsers: usersPagination.totalCount,
      openIssues: errorSummary.openCount,
      pendingCredits: users.filter((row) => row.credits <= 0).length,
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
      await loadUsers();
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
        await loadErrors();
      } catch (error) {
        setErrorsError(
          error instanceof Error ? error.message : "Failed to update incident status."
        );
      } finally {
        setErrorStatusUpdatingId((current) => (current === errorId ? null : current));
      }
    },
    [loadErrors]
  );

  if (loading) {
    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <p className="subdued">Checking your session…</p>
      </main>
    );
  }

  if (!adminEnabled) {
    if (roleBasedAdmin === false && !serverDenied && usersLoading) {
      return (
        <main className={`page page-wide ${styles.adminPage}`}>
          <p className="subdued">Verifying admin access…</p>
        </main>
      );
    }
    if (roleBasedAdmin === false && !serverDenied) {
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
                {usersError ?? "We could not verify admin access right now. Retry in a moment."}
              </p>
              <div className={styles.searchRow}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={loadUsers}
                  disabled={usersLoading}
                >
                  {usersLoading ? "Retrying…" : "Retry access check"}
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
                  <span>Credits</span>
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
                      <span className="mono">{row.credits.toLocaleString()}</span>
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
                  <span className="tiny subdued">Credit increment</span>
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
            </section>
          </>
        ) : (
          <ErrorIncidentsPanel
            errors={errors}
            errorsLoading={errorsLoading}
            errorsError={errorsError}
            errorSummary={errorSummary}
            errorStatusFilter={errorStatusFilter}
            errorScopeFilter={errorScopeFilter}
            errorSeverityFilter={errorSeverityFilter}
            errorSourceFilter={errorSourceFilter}
            errorSearch={errorSearch}
            errorPagination={errorsPagination}
            statusUpdatingErrorId={errorStatusUpdatingId}
            onErrorStatusFilterChange={(value) => {
              setErrorStatusFilter(value);
              setErrorsPage(1);
            }}
            onErrorScopeFilterChange={(value) => {
              setErrorScopeFilter(value);
              setErrorsPage(1);
            }}
            onErrorSeverityFilterChange={(value) => {
              setErrorSeverityFilter(value);
              setErrorsPage(1);
            }}
            onErrorSourceFilterChange={(value) => {
              setErrorSourceFilter(value);
              setErrorsPage(1);
            }}
            onErrorSearchChange={(value) => {
              setErrorSearch(value);
              setErrorsPage(1);
            }}
            onUpdateErrorStatus={handleUpdateErrorStatus}
            onPrevPage={() => setErrorsPage((value) => Math.max(1, value - 1))}
            onNextPage={() => setErrorsPage((value) => value + 1)}
            onRefresh={loadErrors}
          />
        )}
      </main>
    </>
  );
}
