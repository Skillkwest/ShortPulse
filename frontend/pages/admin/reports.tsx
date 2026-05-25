import { AdminReportsPanel } from "../../features/admin/components/AdminReportsPanel";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminReportsController } from "../../features/admin/logic/useAdminReportsController";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminReportsPage() {
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
  } = useAdminReportsController({
    enabled: Boolean(user && adminEnabled),
  });

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Reports"
      metaDescription="Admin issue-report queue for reviewing signed-in user problem reports."
      pageTitle="Issue reports"
      pageDescription="Read user-reported issues, capture review notes, and move reports through manual triage."
      userEmail={user?.email}
      currentPath="/admin/reports"
    >
      <AdminReportsPanel
        reports={reports}
        reportsLoading={reportsLoading}
        reportsError={reportsError}
        reportSummary={reportSummary}
        reportsPagination={reportsPagination}
        reportStatusFilter={reportStatusFilter}
        reportSearch={reportSearch}
        reportUpdatingId={reportUpdatingId}
        onReportStatusFilterChange={handleReportStatusFilterChange}
        onReportSearchChange={handleReportSearchChange}
        onPrevPage={handleReportsPrevPage}
        onNextPage={handleReportsNextPage}
        onRefresh={refreshReports}
        onUpdateReport={handleUpdateReport}
      />
    </AdminRouteShell>
  );
}
