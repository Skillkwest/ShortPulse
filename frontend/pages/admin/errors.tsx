/**
 * Admin errors route.
 * Hosts the operator incident triage and raw event-stream workflows.
 */
import { ErrorIncidentsPanel } from "../../features/admin/components/ErrorIncidentsPanel";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminErrorsEventsController } from "../../features/admin/logic/useAdminErrorsEventsController";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminErrorsPage() {
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
    liveRefreshEnabled: Boolean(user && adminEnabled),
    loadEventStreamEnabled: false,
  });

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Errors"
      metaDescription="Simple admin error handoff queue for Codex triage."
      pageTitle="Error queue"
      pageDescription="Copy an error packet, paste it into Codex, and work one item at a time."
      userEmail={user?.email}
      currentPath="/admin/errors"
    >
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
    </AdminRouteShell>
  );
}
