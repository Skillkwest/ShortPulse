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
  AdminErrorSummary,
  AdminPagination,
  AdminErrorStatus,
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
  errorEvents,
  errorEventsLoading,
  errorEventsPagination,
  errorEventIncidentFilter,
  errorSearch,
  errorPagination,
  statusUpdatingErrorId,
  onErrorSearchChange,
  onUpdateErrorStatus,
  onUpdateErrorEventStatus,
  onPrevPage,
  onNextPage,
  onEventNextPage,
  onRefresh,
}: ErrorIncidentsPanelProps) {
  const { copiedIncidentId, inProgressIncidentIds, handleCopyIncident } =
    useAdminErrorIncidentsPanelState({
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
        errorSearch={errorSearch}
        errorPagination={errorPagination}
        copiedIncidentId={copiedIncidentId}
        inProgressIncidentIds={inProgressIncidentIds}
        statusUpdatingErrorId={statusUpdatingErrorId}
        onErrorSearchChange={onErrorSearchChange}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onRefresh={onRefresh}
        onCopyIncident={(row) => {
          void handleCopyIncident(row);
        }}
        onResolveIncident={(row) => {
          void onUpdateErrorStatus(row.id, "resolved");
        }}
      />
    </>
  );
}
