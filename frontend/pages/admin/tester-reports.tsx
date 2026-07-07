import { AdminTesterReportsPanel } from "../../features/admin/components/AdminTesterReportsPanel";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminTesterReportsController } from "../../features/admin/logic/useAdminTesterReportsController";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminTesterReportsPage() {
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
    testerReports,
    testerReportsLoading,
    testerReportsError,
    hyberveesReviewSavingId,
    hyberveesReviewError,
    testerReportSummary,
    testerReportsPagination,
    testerReportStatusFilter,
    testerReportReviewFilter,
    testerReportTesterFilter,
    testerReportSearch,
    handleTesterReportStatusFilterChange,
    handleTesterReportReviewFilterChange,
    handleTesterReportTesterFilterChange,
    handleTesterReportSearchChange,
    handleTesterReportsPrevPage,
    handleTesterReportsNextPage,
    markHyberveesReviewed,
    refreshTesterReports,
  } = useAdminTesterReportsController({
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
      documentTitle="ShortPulse · Agent Tester Reports"
      metaDescription="Admin tester-agent run report log for persona reports and engineering handoffs."
      pageTitle="Agent Tester Reports"
      pageDescription="Review automated tester runs, the short pulse account tested, and both reports produced by each run."
      userEmail={user?.email}
      currentPath="/admin/tester-reports"
    >
      <AdminTesterReportsPanel
        testerReports={testerReports}
        testerReportsLoading={testerReportsLoading}
        testerReportsError={testerReportsError}
        hyberveesReviewSavingId={hyberveesReviewSavingId}
        hyberveesReviewError={hyberveesReviewError}
        testerReportSummary={testerReportSummary}
        testerReportsPagination={testerReportsPagination}
        testerReportStatusFilter={testerReportStatusFilter}
        testerReportReviewFilter={testerReportReviewFilter}
        testerReportTesterFilter={testerReportTesterFilter}
        testerReportSearch={testerReportSearch}
        onTesterReportStatusFilterChange={handleTesterReportStatusFilterChange}
        onTesterReportReviewFilterChange={handleTesterReportReviewFilterChange}
        onTesterReportTesterFilterChange={handleTesterReportTesterFilterChange}
        onTesterReportSearchChange={handleTesterReportSearchChange}
        onPrevPage={handleTesterReportsPrevPage}
        onNextPage={handleTesterReportsNextPage}
        onMarkHyberveesReviewed={markHyberveesReviewed}
        onRefresh={refreshTesterReports}
      />
    </AdminRouteShell>
  );
}
