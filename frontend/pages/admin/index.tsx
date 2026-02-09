/**
 * Admin dashboard.
 * Lists user/credit state and actionable app error incidents for operators.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CloudSlash, ShieldCheck, UserCircle } from "phosphor-react";
import { ErrorIncidentsPanel } from "../../features/admin/components/ErrorIncidentsPanel";
import type { AdminErrorLogRow, AdminErrorSummary, AdminUserRow } from "../../features/admin/types";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";
import { fetchWithAuth } from "../../lib/authenticatedFetch";

const isAdminUser = (user: any): boolean => {
  const roles = [
    user?.app_metadata?.role,
    user?.user_metadata?.role,
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
    ...(Array.isArray(user?.user_metadata?.roles) ? user.user_metadata.roles : []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return roles.includes("admin") || roles.includes("operator");
};

const planLabel = (planId: string | null): string => {
  if (!planId) return "—";
  if (planId === "creative_suite") return "Creative Suite";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
};

export default function AdminDashboardPage() {
  const { loading, user } = useProtectedRoute(true);
  const [activeTab, setActiveTab] = useState<"overview" | "errors">("overview");
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [adjustment, setAdjustment] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustResult, setAdjustResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<AdminErrorLogRow[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [errorsError, setErrorsError] = useState<string | null>(null);
  const [errorSummary, setErrorSummary] = useState<AdminErrorSummary>({
    openCount: 0,
    highSeverityOpenCount: 0,
    last24hCount: 0,
  });
  const [errorStatusFilter, setErrorStatusFilter] = useState<"open" | "all">("open");
  const [errorSeverityFilter, setErrorSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [errorSourceFilter, setErrorSourceFilter] = useState<string>("all");
  const [errorSearch, setErrorSearch] = useState("");
  const [serverDenied, setServerDenied] = useState(false);
  const [serverValidated, setServerValidated] = useState(false);

  const roleBasedAdmin = isAdminUser(user);
  const adminEnabled = roleBasedAdmin || serverValidated;

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const response = await fetchWithAuth("/api/admin/users", { method: "GET" });
      if (!response.ok) {
        if (response.status === 403) {
          setServerDenied(true);
          setServerValidated(false);
          setUsers([]);
          setUsersError(null);
          return;
        }
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || "Failed to load users.");
      }
      const data = (await response.json()) as { users?: AdminUserRow[] };
      setServerDenied(false);
      setServerValidated(true);
      setUsers(data.users ?? []);
      if (!selectedUserId && data.users?.length) {
        setSelectedUserId(data.users[0].id);
      }
    } catch (error) {
      setServerDenied(false);
      setUsersError(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [selectedUserId]);

  const loadErrors = useCallback(async () => {
    setErrorsLoading(true);
    setErrorsError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "120");
      params.set("status", errorStatusFilter);
      if (errorSeverityFilter !== "all") params.set("severity", errorSeverityFilter);
      if (errorSourceFilter !== "all") params.set("source", errorSourceFilter);

      const response = await fetchWithAuth(`/api/admin/errors?${params.toString()}`, { method: "GET" });
      if (!response.ok) {
        if (response.status === 403) {
          setServerDenied(true);
          setServerValidated(false);
          setErrors([]);
          return;
        }
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || "Failed to load error incidents.");
      }
      const data = (await response.json()) as {
        errors?: unknown[];
        summary?: AdminErrorSummary;
      };

      const rows = (data.errors ?? []).map((item) => {
        const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          id: String(value.id ?? ""),
          source: String(value.source ?? "unknown"),
          scope: value.scope === "generation" ? "generation" : "app",
          severity: value.severity === "high" || value.severity === "low" ? value.severity : "medium",
          status: value.status === "resolved" || value.status === "ignored" ? value.status : "open",
          message: String(value.message ?? "Unknown error"),
          stack: typeof value.stack === "string" ? value.stack : null,
          route: typeof value.route === "string" ? value.route : null,
          endpoint: typeof value.endpoint === "string" ? value.endpoint : null,
          requestId: typeof value.request_id === "string" ? value.request_id : null,
          httpStatus: Number.isFinite(Number(value.http_status)) ? Number(value.http_status) : null,
          userId: typeof value.user_id === "string" ? value.user_id : null,
          userEmail: typeof value.user_email === "string" ? value.user_email : null,
          metadata: value.metadata && typeof value.metadata === "object" ? (value.metadata as Record<string, unknown>) : null,
          firstSeenAt: typeof value.first_seen_at === "string" ? value.first_seen_at : null,
          lastSeenAt: typeof value.last_seen_at === "string" ? value.last_seen_at : null,
          occurrencesCount: Number.isFinite(Number(value.occurrences_count)) ? Number(value.occurrences_count) : 1,
        };
      }) as AdminErrorLogRow[];

      setErrors(rows);
      setErrorSummary({
        openCount: Number(data.summary?.openCount ?? 0),
        highSeverityOpenCount: Number(data.summary?.highSeverityOpenCount ?? 0),
        last24hCount: Number(data.summary?.last24hCount ?? 0),
      });
    } catch (error) {
      setErrorsError(error instanceof Error ? error.message : "Failed to load error incidents.");
    } finally {
      setErrorsLoading(false);
    }
  }, [errorSeverityFilter, errorSourceFilter, errorStatusFilter]);

  useEffect(() => {
    if (!user) return;
    loadUsers();
  }, [loadUsers, user]);

  useEffect(() => {
    if (!user || !adminEnabled) return;
    loadErrors();
  }, [adminEnabled, loadErrors, user]);

  const overview = useMemo(
    () => ({
      activeUsers: users.length,
      openIssues: errorSummary.openCount,
      pendingCredits: users.filter((row) => row.credits <= 0).length,
    }),
    [errorSummary.openCount, users],
  );

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((row) => (row.email ?? "").toLowerCase().includes(query));
  }, [userSearch, users]);

  const handleCreditAdjust = async () => {
    const normalized = Number(adjustment);
    if (!selectedUserId || !Number.isFinite(normalized) || normalized === 0) {
      setAdjustResult("Pick a user and enter a non-zero credit amount.");
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustResult("Add a reason for this adjustment.");
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
          changeCents: Math.trunc(normalized),
          reason: adjustReason.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Credit adjustment failed.");
      }

      setAdjustment("");
      setAdjustReason("");
      setAdjustResult("Credit adjustment applied.");
      await loadUsers();
    } catch (error) {
      setAdjustResult(error instanceof Error ? error.message : "Credit adjustment failed.");
    } finally {
      setAdjustSubmitting(false);
    }
  };

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
                <button type="button" className="ghost-btn mini" onClick={loadUsers} disabled={usersLoading}>
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
        <meta name="description" content="Admin dashboard for monitoring users, credits, and errors." />
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <header className={styles.adminHeader}>
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1 className={styles.adminTitle}>Operations overview</h1>
            <p className="tiny subdued">Monitor plan allocations, credits, and actionable app failures.</p>
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
                <p className={styles.adminSubtext}>Users at 0 or below</p>
              </div>
            </section>

            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Users & credits</p>
                  <p className="tiny subdued">Adjust balances manually when support requests come in.</p>
                </div>
                <button type="button" className="ghost-btn mini" onClick={loadUsers} disabled={usersLoading}>
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
                  onChange={(event) => setUserSearch(event.target.value)}
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
                ) : filteredUsers.length === 0 ? (
                  <div className={styles.adminTableRow}>
                    <span className="subdued">No users match.</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                  </div>
                ) : (
                  filteredUsers.map((row) => (
                    <div key={row.id} className={styles.adminTableRow}>
                      <span>{row.email ?? row.id}</span>
                      <span>{planLabel(row.planId)}</span>
                      <span className="mono">{row.credits.toLocaleString()}</span>
                      <span className="subdued">{row.subscriptionStatus ?? "inactive"}</span>
                      <span className="subdued">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</span>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Manual adjustment</p>
                  <p className="tiny subdued">Use positive numbers to add credits, negative to remove.</p>
                </div>
              </div>
              <div className={styles.searchRow}>
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
                <input
                  className={styles.searchInput}
                  type="number"
                  value={adjustment}
                  onChange={(event) => setAdjustment(event.target.value)}
                  placeholder="+500 or -100"
                />
                <input
                  className={styles.searchInput}
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  placeholder="Reason (required)"
                />
                <button type="button" className="ghost-btn mini" onClick={handleCreditAdjust} disabled={adjustSubmitting}>
                  {adjustSubmitting ? "Applying…" : "Apply"}
                </button>
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
            errorSeverityFilter={errorSeverityFilter}
            errorSourceFilter={errorSourceFilter}
            errorSearch={errorSearch}
            onErrorStatusFilterChange={setErrorStatusFilter}
            onErrorSeverityFilterChange={setErrorSeverityFilter}
            onErrorSourceFilterChange={setErrorSourceFilter}
            onErrorSearchChange={setErrorSearch}
            onRefresh={loadErrors}
          />
        )}
      </main>
    </>
  );
}
