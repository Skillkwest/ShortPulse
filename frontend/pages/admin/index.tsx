/**
 * Admin dashboard.
 * Lists user/credit state and actionable app error incidents for operators.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { CloudSlash, ShieldCheck, UserCircle } from "phosphor-react";
import { ErrorIncidentsPanel } from "../../features/admin/components/ErrorIncidentsPanel";
import {
  ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH,
  useAdminAnnouncementsController,
} from "../../features/admin/logic/useAdminAnnouncementsController";
import { useAdminErrorsEventsController } from "../../features/admin/logic/useAdminErrorsEventsController";
import {
  ADMIN_DASHBOARD_ADJUSTMENT_PRESETS,
  ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT,
  useAdminUsersCreditsController,
} from "../../features/admin/logic/useAdminUsersCreditsController";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";

const planLabel = (planId: string | null): string => {
  if (!planId) return "—";
  // Handle legacy plan names
  if (planId === "creative_suite" || planId === "creative") return "Business";
  if (planId === "pro") return "Studio";
  if (planId === "business") return "Business";
  if (planId === "studio") return "Studio";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
};

const formatCreditDelta = (changeCents: number): string =>
  `${changeCents > 0 ? "+" : ""}${Math.trunc(changeCents).toLocaleString()}`;

const formatUsd = (value: number | null): string => (value == null ? "—" : `$${value.toFixed(2)}`);

export default function AdminDashboardPage() {
  const { loading, user } = useProtectedRoute(true);
  const [activeTab, setActiveTab] = useState<"overview" | "errors" | "announcements">("overview");
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: adminEnabled,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({
    enabled: Boolean(user),
  });
  const {
    announcementCurrent,
    announcementTitle,
    announcementMessage,
    announcementLoading,
    announcementPublishing,
    announcementClearing,
    announcementResult,
    announcementError,
    setAnnouncementTitle,
    setAnnouncementMessage,
    loadCurrentAnnouncement,
    handlePublishAnnouncement,
    handleClearAnnouncement,
  } = useAdminAnnouncementsController({
    enabled: Boolean(user && adminEnabled && activeTab === "announcements"),
  });
  const {
    userSearch,
    usersPagination,
    userSearchLimited,
    users,
    usersLoading,
    usersError,
    selectedUserId,
    adjustment,
    adjustSubmitting,
    adjustResult,
    creditLedgerRows,
    creditLedgerLoading,
    creditLedgerError,
    activeUsersCount,
    pendingCreditsCount,
    usersResultStart,
    usersResultEnd,
    setSelectedUserId,
    loadUsers,
    loadCreditLedger,
    handleUserSearchChange,
    handlePreviousUsersPage,
    handleNextUsersPage,
    handleAdjustmentChange,
    applyAdjustmentPreset,
    handleCreditAdjust,
  } = useAdminUsersCreditsController({
    enabled: Boolean(user && adminEnabled),
  });
  const {
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
  } = useAdminErrorsEventsController({
    enabled: Boolean(user && adminEnabled),
    liveRefreshEnabled: Boolean(user && adminEnabled && activeTab === "errors"),
  });

  const overview = useMemo(
    () => ({
      activeUsers: activeUsersCount,
      openIssues: errorSummary.openCount,
      pendingCredits: pendingCreditsCount,
    }),
    [activeUsersCount, errorSummary.openCount, pendingCreditsCount]
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
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "announcements" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("announcements")}
          >
            Announcements
          </button>
          <Link href="/admin/user-health" className="ghost-btn mini">
            User health
          </Link>
          <Link href="/admin/user-health-fleet" className="ghost-btn mini">
            Fleet health
          </Link>
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
                  onChange={(event) => handleUserSearchChange(event.target.value)}
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
                    onClick={handlePreviousUsersPage}
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
                    onClick={handleNextUsersPage}
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
                    onChange={(event) => handleAdjustmentChange(event.target.value)}
                    placeholder="+500 or -100"
                  />
                  <div className={styles.manualAdjustPresets}>
                    {ADMIN_DASHBOARD_ADJUSTMENT_PRESETS.map((preset) => (
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
                  <Link
                    href={
                      selectedUserId
                        ? `/admin/user-health?lookup=${encodeURIComponent(
                            selectedUserId
                          )}&lookupMode=user_id`
                        : "/admin/user-health"
                    }
                    className="ghost-btn mini"
                  >
                    Open health check
                  </Link>
                </div>
              </div>
              {adjustResult ? <p className="tiny subdued">{adjustResult}</p> : null}

              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Credit transaction log</p>
                  <p className="tiny subdued">
                    Latest {ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT} ledger rows for the selected user,
                    including billed vs raw pricing metadata when available.
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
        ) : activeTab === "errors" ? (
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
            bulkIncidentStatusUpdating={bulkIncidentStatusUpdating}
            bulkIncidentStatusResult={bulkIncidentStatusResult}
            testIncidentSubmittingScope={testIncidentSubmittingScope}
            testIncidentResult={testIncidentResult}
            onErrorStatusFilterChange={handleErrorStatusFilterChange}
            onErrorScopeFilterChange={handleErrorScopeFilterChange}
            onErrorSeverityFilterChange={handleErrorSeverityFilterChange}
            onErrorSourceFilterChange={handleErrorSourceFilterChange}
            onErrorEventSyntheticFilterChange={handleErrorEventSyntheticFilterChange}
            onErrorEventSignalFilterChange={handleErrorEventSignalFilterChange}
            onErrorEventIncidentFilterChange={handleErrorEventIncidentFilterChange}
            onErrorSearchChange={handleErrorSearchChange}
            onUpdateErrorStatus={handleUpdateErrorStatus}
            onUpdateErrorEventStatus={handleUpdateErrorEventStatus}
            onBulkUpdateListedErrorStatus={handleBulkUpdateListedErrorStatus}
            onTriggerTestIncident={handleTriggerTestIncident}
            onPrevPage={handleErrorsPrevPage}
            onNextPage={handleErrorsNextPage}
            onEventPrevPage={handleErrorEventsPrevPage}
            onEventNextPage={handleErrorEventsNextPage}
            onRefresh={refreshErrorData}
          />
        ) : (
          <section className={styles.adminSection}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">Current announcement</p>
                <p className="tiny subdued">
                  Publish one global announcement shown to all signed-in dashboard users.
                </p>
              </div>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void loadCurrentAnnouncement()}
                disabled={announcementLoading || announcementPublishing || announcementClearing}
              >
                {announcementLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className={styles.announcementFormGrid}>
              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">
                  Title ({announcementTitle.trim().length}/
                  {ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH})
                </span>
                <input
                  className={styles.searchInput}
                  type="text"
                  value={announcementTitle}
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                  maxLength={ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH}
                  placeholder="Platform notice"
                  disabled={announcementPublishing || announcementClearing}
                />
              </label>
              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">
                  Message ({announcementMessage.trim().length}/
                  {ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH})
                </span>
                <textarea
                  className={styles.announcementMessageInput}
                  value={announcementMessage}
                  onChange={(event) => setAnnouncementMessage(event.target.value)}
                  maxLength={ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH}
                  placeholder="Tell users what changed and what to expect next."
                  rows={5}
                  disabled={announcementPublishing || announcementClearing}
                />
              </label>
            </div>

            <div className={styles.announcementActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void handlePublishAnnouncement()}
                disabled={announcementPublishing || announcementClearing || announcementLoading}
              >
                {announcementPublishing ? "Publishing…" : "Publish"}
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void handleClearAnnouncement()}
                disabled={announcementClearing || announcementPublishing || announcementLoading}
              >
                {announcementClearing ? "Clearing…" : "Clear active announcement"}
              </button>
            </div>

            {announcementError ? (
              <p className={styles.announcementError}>{announcementError}</p>
            ) : null}
            {announcementResult ? (
              <p className={styles.announcementResult}>{announcementResult}</p>
            ) : null}

            <div className={styles.announcementPreview}>
              <p className="eyebrow">Live dashboard payload</p>
              {announcementCurrent ? (
                <>
                  <p className={styles.announcementPreviewTitle}>{announcementCurrent.title}</p>
                  <p className={styles.announcementPreviewMessage}>{announcementCurrent.message}</p>
                  <p className="tiny subdued">
                    Published{" "}
                    {announcementCurrent.publishedAt
                      ? new Date(announcementCurrent.publishedAt).toLocaleString()
                      : "—"}
                  </p>
                </>
              ) : (
                <p className="tiny subdued">
                  No active announcement. Dashboard users will see fallback helper copy.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
