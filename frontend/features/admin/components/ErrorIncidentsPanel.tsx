/**
 * Admin error incidents panel.
 * Renders summary cards, filters, and grouped incident rows for operator triage.
 */
import type {
  AdminErrorEventIncidentFilter,
  AdminErrorLogRow,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorEventsHealth,
  AdminErrorEventSummary,
  AdminErrorSummary,
  AdminPagination,
  AdminErrorStatus,
} from "../types";
import { useAdminErrorIncidentsPanelState } from "../logic/useAdminErrorIncidentsPanelState";
import { ErrorEventsStreamSection } from "./ErrorEventsStreamSection";
import { ErrorIncidentsOverviewSection } from "./ErrorIncidentsOverviewSection";

type ErrorIncidentsPanelProps = {
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
  errorPagination: AdminPagination;
  statusUpdatingErrorId: string | null;
  bulkIncidentStatusUpdating: "resolved" | "ignored" | null;
  bulkIncidentStatusResult: string | null;
  testIncidentSubmittingScope: "app" | "generation" | null;
  testIncidentResult: string | null;
  onErrorStatusFilterChange: (value: "open" | "all") => void;
  onErrorScopeFilterChange: (value: "all" | "app" | "generation") => void;
  onErrorSeverityFilterChange: (value: "all" | "high" | "medium" | "low") => void;
  onErrorSourceFilterChange: (value: string) => void;
  onErrorEventSyntheticFilterChange: (value: "all" | "exclude" | "only") => void;
  onErrorEventSignalFilterChange: (value: AdminErrorEventSignalFilter) => void;
  onErrorEventIncidentFilterChange: (value: AdminErrorEventIncidentFilter) => void;
  onErrorSearchChange: (value: string) => void;
  onUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => Promise<void>;
  onUpdateErrorEventStatus: (eventId: string, status: AdminErrorStatus) => Promise<void>;
  onBulkUpdateListedErrorStatus: (status: "resolved" | "ignored") => Promise<void>;
  onTriggerTestIncident: (scope: "app" | "generation") => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onEventPrevPage: () => void;
  onEventNextPage: () => void;
  onRefresh: () => void;
};

/**
 * Displays operator-focused app incident telemetry.
 */
export function ErrorIncidentsPanel({
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
  errorPagination,
  statusUpdatingErrorId,
  bulkIncidentStatusUpdating,
  bulkIncidentStatusResult,
  testIncidentSubmittingScope,
  testIncidentResult,
  onErrorStatusFilterChange,
  onErrorScopeFilterChange,
  onErrorSeverityFilterChange,
  onErrorSourceFilterChange,
  onErrorEventSyntheticFilterChange,
  onErrorEventSignalFilterChange,
  onErrorEventIncidentFilterChange,
  onErrorSearchChange,
  onUpdateErrorStatus,
  onUpdateErrorEventStatus,
  onBulkUpdateListedErrorStatus,
  onTriggerTestIncident,
  onPrevPage,
  onNextPage,
  onEventPrevPage,
  onEventNextPage,
  onRefresh,
}: ErrorIncidentsPanelProps) {
  const {
    copiedIncidentId,
    copiedEventId,
    selectedEvent,
    selectedIncidentId,
    errorSourceOptions,
    visibleEvents,
    listedOpenIncidentCount,
    resolveVisibleTargetCount,
    bulkResolveSubmitting,
    bulkResolveResult,
    eventMetadataText,
    openSelectedEvent,
    closeSelectedEvent,
    handleCopyIncident,
    handleCopyEvent,
    handleResolveEventRow,
    handleIgnoreEventRow,
    resolveVisibleEvents,
  } = useAdminErrorIncidentsPanelState({
    errors,
    errorEvents,
    errorEventsLoading,
    errorEventsPagination,
    errorEventIncidentFilter,
    onEventNextPage,
    onUpdateErrorStatus,
    onUpdateErrorEventStatus,
  });

  return (
    <>
      <ErrorIncidentsOverviewSection
        errors={errors}
        errorsLoading={errorsLoading}
        errorsError={errorsError}
        errorSummary={errorSummary}
        errorEventsHealth={errorEventsHealth}
        errorStatusFilter={errorStatusFilter}
        errorScopeFilter={errorScopeFilter}
        errorSeverityFilter={errorSeverityFilter}
        errorSourceFilter={errorSourceFilter}
        errorEventSyntheticFilter={errorEventSyntheticFilter}
        errorEventIncidentFilter={errorEventIncidentFilter}
        errorSearch={errorSearch}
        errorPagination={errorPagination}
        listedOpenIncidentCount={listedOpenIncidentCount}
        bulkIncidentStatusUpdating={bulkIncidentStatusUpdating}
        bulkIncidentStatusResult={bulkIncidentStatusResult}
        testIncidentSubmittingScope={testIncidentSubmittingScope}
        testIncidentResult={testIncidentResult}
        statusUpdatingErrorId={statusUpdatingErrorId}
        copiedIncidentId={copiedIncidentId}
        errorSourceOptions={errorSourceOptions}
        onErrorStatusFilterChange={onErrorStatusFilterChange}
        onErrorScopeFilterChange={onErrorScopeFilterChange}
        onErrorSeverityFilterChange={onErrorSeverityFilterChange}
        onErrorSourceFilterChange={onErrorSourceFilterChange}
        onErrorEventSyntheticFilterChange={onErrorEventSyntheticFilterChange}
        onErrorEventIncidentFilterChange={onErrorEventIncidentFilterChange}
        onErrorSearchChange={onErrorSearchChange}
        onBulkUpdateListedErrorStatus={onBulkUpdateListedErrorStatus}
        onTriggerTestIncident={onTriggerTestIncident}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onRefresh={onRefresh}
        onUpdateErrorStatus={onUpdateErrorStatus}
        onCopyIncident={(row) => {
          void handleCopyIncident(row);
        }}
      />
      <ErrorEventsStreamSection
        errorEvents={errorEvents}
        errorEventsLoading={errorEventsLoading}
        errorEventsError={errorEventsError}
        errorEventsSummary={errorEventsSummary}
        errorEventsHealth={errorEventsHealth}
        errorEventsPagination={errorEventsPagination}
        errorEventSignalFilter={errorEventSignalFilter}
        errorEventIncidentFilter={errorEventIncidentFilter}
        visibleEvents={visibleEvents}
        resolveVisibleTargetCount={resolveVisibleTargetCount}
        bulkResolveSubmitting={bulkResolveSubmitting}
        bulkResolveResult={bulkResolveResult}
        copiedEventId={copiedEventId}
        selectedEvent={selectedEvent}
        selectedIncidentId={selectedIncidentId}
        eventMetadataText={eventMetadataText}
        statusUpdatingErrorId={statusUpdatingErrorId}
        onErrorEventSignalFilterChange={onErrorEventSignalFilterChange}
        onEventPrevPage={onEventPrevPage}
        onEventNextPage={onEventNextPage}
        onResolveVisibleEvents={() => {
          void resolveVisibleEvents();
        }}
        onCopyEvent={(row) => {
          void handleCopyEvent(row);
        }}
        onOpenSelectedEvent={openSelectedEvent}
        onCloseSelectedEvent={closeSelectedEvent}
        onResolveEventRow={(row) => {
          void handleResolveEventRow(row);
        }}
        onIgnoreEventRow={(row) => {
          void handleIgnoreEventRow(row);
        }}
        onUpdateErrorStatus={onUpdateErrorStatus}
        onUpdateErrorEventStatus={onUpdateErrorEventStatus}
      />
    </>
  );
}
