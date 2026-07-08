/**
 * Admin error incidents panel.
 * Renders the grouped incident handoff queue for Codex triage.
 */
import type {
  AdminErrorEventIncidentFilter,
  AdminErrorLogRow,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorEventsHealth,
  AdminErrorEventSummary,
  AdminErrorIncidentViewMode,
  AdminErrorSummary,
  AdminPagination,
  AdminErrorStatus,
  AdminErrorStatusUpdateOptions,
} from "../types";
import { useAdminErrorIncidentsPanelState } from "../logic/useAdminErrorIncidentsPanelState";
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
  errorIncidentViewMode: AdminErrorIncidentViewMode;
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
  onErrorIncidentViewModeChange: (value: AdminErrorIncidentViewMode) => void;
  onErrorStatusFilterChange: (value: "open" | "all") => void;
  onErrorScopeFilterChange: (value: "all" | "app" | "generation") => void;
  onErrorSeverityFilterChange: (value: "all" | "high" | "medium" | "low") => void;
  onErrorSourceFilterChange: (value: string) => void;
  onErrorEventSyntheticFilterChange: (value: "all" | "exclude" | "only") => void;
  onErrorEventSignalFilterChange: (value: AdminErrorEventSignalFilter) => void;
  onErrorEventIncidentFilterChange: (value: AdminErrorEventIncidentFilter) => void;
  onErrorSearchChange: (value: string) => void;
  onUpdateErrorStatus: (
    errorId: string,
    status: AdminErrorStatus,
    options?: AdminErrorStatusUpdateOptions
  ) => Promise<void>;
  onUpdateErrorEventStatus: (
    eventId: string,
    status: AdminErrorStatus,
    options?: AdminErrorStatusUpdateOptions
  ) => Promise<void>;
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
  errorEvents,
  errorEventsLoading,
  errorEventsPagination,
  errorEventIncidentFilter,
  errorIncidentViewMode,
  errorSearch,
  errorPagination,
  statusUpdatingErrorId,
  onErrorIncidentViewModeChange,
  onErrorSearchChange,
  onUpdateErrorStatus,
  onUpdateErrorEventStatus,
  onPrevPage,
  onNextPage,
  onEventNextPage,
  onRefresh,
}: ErrorIncidentsPanelProps) {
  const {
    copiedIncidentId,
    copiedVisibleNewIncidentCount,
    inProgressIncidentIds,
    visibleNewIncidentCount,
    handleCopyIncident,
    handleCopyVisibleNewIncidents,
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
        errorIncidentViewMode={errorIncidentViewMode}
        errorSearch={errorSearch}
        errorPagination={errorPagination}
        copiedIncidentId={copiedIncidentId}
        copiedVisibleNewIncidentCount={copiedVisibleNewIncidentCount}
        inProgressIncidentIds={inProgressIncidentIds}
        visibleNewIncidentCount={visibleNewIncidentCount}
        statusUpdatingErrorId={statusUpdatingErrorId}
        onErrorIncidentViewModeChange={onErrorIncidentViewModeChange}
        onErrorSearchChange={onErrorSearchChange}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onRefresh={onRefresh}
        onCopyIncident={(row) => {
          void handleCopyIncident(row);
        }}
        onCopyVisibleNewIncidents={() => {
          void handleCopyVisibleNewIncidents();
        }}
        onResolveIncident={(row) => {
          void onUpdateErrorStatus(row.id, "resolved");
        }}
        onResolveWatchIncident={(row, note) => {
          void onUpdateErrorStatus(row.id, "resolved", { note, watch: true });
        }}
      />
    </>
  );
}
