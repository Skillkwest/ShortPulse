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
      documentTitle="ShortPulse · Admin Tester Reports"
      metaDescription="Admin tester-agent run report log for persona reports and engineering handoffs."
      pageTitle="Tester reports"
      pageDescription="Review automated tester runs, the short pulse account tested, and both reports produced by each run."
      userEmail={user?.email}
      currentPath="/admin/tester-reports"
    >
      <AdminTesterReportsPanel
        testerReports={testerReports}
        testerReportsLoading={testerReportsLoading}
        testerReportsError={testerReportsError}
        testerReportSummary={testerReportSummary}
        testerReportsPagination={testerReportsPagination}
        testerReportStatusFilter={testerReportStatusFilter}
        testerReportTesterFilter={testerReportTesterFilter}
        testerReportSearch={testerReportSearch}
        onTesterReportStatusFilterChange={handleTesterReportStatusFilterChange}
        onTesterReportTesterFilterChange={handleTesterReportTesterFilterChange}
        onTesterReportSearchChange={handleTesterReportSearchChange}
        onPrevPage={handleTesterReportsPrevPage}
        onNextPage={handleTesterReportsNextPage}
        onRefresh={refreshTesterReports}
      />
    </AdminRouteShell>
  );
}
