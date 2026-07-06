/**
 * Admin Crash Logs route.
 * Hosts account-linked browser crash and freeze session evidence for operator triage.
 */
import { AdminCrashLogsPanel } from "../../features/admin/components/AdminCrashLogsPanel";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminCrashSessionsController } from "../../features/admin/logic/useAdminCrashSessionsController";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminCrashesPage() {
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: adminEnabled,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({
    enabled: Boolean(user),
    userId: user?.id ?? null,
  });
  const {
    sessions,
    loading: crashSessionsLoading,
    error: crashSessionsError,
    pagination,
    viewMode,
    statusFilter,
    reviewStatusFilter,
    search,
    updatingReviewSessionId,
    handleViewModeChange,
    handleStatusFilterChange,
    handleReviewStatusFilterChange,
    handleSearchChange,
    handleUpdateReviewStatus,
    handlePrevPage,
    handleNextPage,
    refresh,
  } = useAdminCrashSessionsController({
    enabled: Boolean(user && adminEnabled),
    liveRefreshEnabled: Boolean(user && adminEnabled),
  });

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Crash Logs"
      metaDescription="Admin browser crash and freeze session logs."
      pageTitle="Crash logs"
      pageDescription="Inspect account-linked browser freeze, crash, close, and stale-heartbeat evidence."
      userEmail={user?.email}
      currentPath="/admin/crashes"
      hideSubNav
    >
      <AdminCrashLogsPanel
        sessions={sessions}
        loading={crashSessionsLoading}
        error={crashSessionsError}
        pagination={pagination}
        viewMode={viewMode}
        statusFilter={statusFilter}
        reviewStatusFilter={reviewStatusFilter}
        search={search}
        updatingReviewSessionId={updatingReviewSessionId}
        onViewModeChange={handleViewModeChange}
        onStatusFilterChange={handleStatusFilterChange}
        onReviewStatusFilterChange={handleReviewStatusFilterChange}
        onSearchChange={handleSearchChange}
        onUpdateReviewStatus={(sessionId, status, note) => {
          void handleUpdateReviewStatus(sessionId, status, note);
        }}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onRefresh={refresh}
      />
    </AdminRouteShell>
  );
}
