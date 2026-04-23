import { WarningCircle } from "phosphor-react";
import type {
  AdminErrorEventIncidentFilter,
  AdminErrorEventsHealth,
  AdminErrorLogRow,
  AdminErrorSummary,
  AdminPagination,
  AdminErrorStatus,
} from "../types";
import { formatDateTime, sourceLabel } from "../logic/errorIncidentViewUtils";
import styles from "../../../styles/admin.module.css";

type ErrorIncidentsOverviewSectionProps = {
  errors: AdminErrorLogRow[];
  errorsLoading: boolean;
  errorsError: string | null;
  errorSummary: AdminErrorSummary;
  errorEventsHealth: AdminErrorEventsHealth;
  errorStatusFilter: "open" | "all";
  errorScopeFilter: "all" | "app" | "generation";
  errorSeverityFilter: "all" | "high" | "medium" | "low";
  errorSourceFilter: string;
  errorEventSyntheticFilter: "all" | "exclude" | "only";
  errorEventIncidentFilter: AdminErrorEventIncidentFilter;
  errorSearch: string;
  errorPagination: AdminPagination;
  listedOpenIncidentCount: number;
  bulkIncidentStatusUpdating: "resolved" | "ignored" | null;
  bulkIncidentStatusResult: string | null;
  testIncidentSubmittingScope: "app" | "generation" | null;
  testIncidentResult: string | null;
  statusUpdatingErrorId: string | null;
  copiedIncidentId: string | null;
  errorSourceOptions: string[];
  onErrorStatusFilterChange: (value: "open" | "all") => void;
  onErrorScopeFilterChange: (value: "all" | "app" | "generation") => void;
  onErrorSeverityFilterChange: (value: "all" | "high" | "medium" | "low") => void;
  onErrorSourceFilterChange: (value: string) => void;
  onErrorEventSyntheticFilterChange: (value: "all" | "exclude" | "only") => void;
  onErrorEventIncidentFilterChange: (value: AdminErrorEventIncidentFilter) => void;
  onErrorSearchChange: (value: string) => void;
  onBulkUpdateListedErrorStatus: (status: "resolved" | "ignored") => Promise<void>;
  onTriggerTestIncident: (scope: "app" | "generation") => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
  onUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => Promise<void>;
  onCopyIncident: (row: AdminErrorLogRow) => void;
};

export function ErrorIncidentsOverviewSection({
  errors,
  errorsLoading,
  errorsError,
  errorSummary,
  errorEventsHealth,
  errorStatusFilter,
  errorScopeFilter,
  errorSeverityFilter,
  errorSourceFilter,
  errorEventSyntheticFilter,
  errorEventIncidentFilter,
  errorSearch,
  errorPagination,
  listedOpenIncidentCount,
  bulkIncidentStatusUpdating,
  bulkIncidentStatusResult,
  testIncidentSubmittingScope,
  testIncidentResult,
  statusUpdatingErrorId,
  copiedIncidentId,
  errorSourceOptions,
  onErrorStatusFilterChange,
  onErrorScopeFilterChange,
  onErrorSeverityFilterChange,
  onErrorSourceFilterChange,
  onErrorEventSyntheticFilterChange,
  onErrorEventIncidentFilterChange,
  onErrorSearchChange,
  onBulkUpdateListedErrorStatus,
  onTriggerTestIncident,
  onPrevPage,
  onNextPage,
  onRefresh,
  onUpdateErrorStatus,
  onCopyIncident,
}: ErrorIncidentsOverviewSectionProps) {
  const resultStart =
    errorPagination.totalCount === 0 ? 0 : (errorPagination.page - 1) * errorPagination.perPage + 1;
  const resultEnd = Math.min(
    errorPagination.page * errorPagination.perPage,
    errorPagination.totalCount
  );
  const telemetryHealthLabel = errorEventsHealth.degraded ? "Degraded" : "Healthy";
  const telemetryHealthSubtext = errorEventsHealth.degraded
    ? "Event stream fallback active"
    : "Event stream available";

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Errors</p>
          <p className="tiny subdued">
            Actionable app/runtime failures grouped by fingerprint and user.
          </p>
        </div>
        <div className={styles.tabRow}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => onTriggerTestIncident("app")}
            disabled={errorsLoading || testIncidentSubmittingScope !== null}
          >
            {testIncidentSubmittingScope === "app" ? "Creating…" : "Trigger app test"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => onTriggerTestIncident("generation")}
            disabled={errorsLoading || testIncidentSubmittingScope !== null}
          >
            {testIncidentSubmittingScope === "generation" ? "Creating…" : "Trigger generation test"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onRefresh}
            disabled={errorsLoading}
          >
            {errorsLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <section className={styles.adminGrid}>
        <div className={`${styles.adminCard} ${styles.alert}`}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Open incidents</span>
            <WarningCircle size={18} />
          </div>
          <p className={styles.adminMetric}>{errorSummary.openCount}</p>
          <p className={styles.adminSubtext}>
            {`App ${errorSummary.appOpenCount} · Generation ${errorSummary.generationOpenCount}`}
          </p>
        </div>
        <div className={styles.adminCard}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>High severity open</span>
          </div>
          <p className={styles.adminMetric}>{errorSummary.highSeverityOpenCount}</p>
          <p className={styles.adminSubtext}>Needs immediate attention</p>
        </div>
        <div className={`${styles.adminCard} ${styles.warning}`}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Seen in last 24h</span>
          </div>
          <p className={styles.adminMetric}>{errorSummary.last24hCount}</p>
          <p className={styles.adminSubtext}>Recent activity volume</p>
        </div>
        <div className={`${styles.adminCard} ${errorEventsHealth.degraded ? styles.warning : ""}`}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Telemetry health</span>
          </div>
          <p className={styles.adminMetric}>{telemetryHealthLabel}</p>
          <p className={styles.adminSubtext}>{telemetryHealthSubtext}</p>
        </div>
      </section>

      <div className={styles.filterGrid}>
        <select
          className={styles.searchInput}
          value={errorStatusFilter}
          onChange={(event) => onErrorStatusFilterChange(event.target.value as "open" | "all")}
        >
          <option value="open">Status: Open</option>
          <option value="all">Status: All</option>
        </select>

        <select
          className={styles.searchInput}
          value={errorScopeFilter}
          onChange={(event) =>
            onErrorScopeFilterChange(event.target.value as "all" | "app" | "generation")
          }
        >
          <option value="all">Scope: All</option>
          <option value="app">Scope: App</option>
          <option value="generation">Scope: Generation</option>
        </select>

        <select
          className={styles.searchInput}
          value={errorSeverityFilter}
          onChange={(event) =>
            onErrorSeverityFilterChange(event.target.value as "all" | "high" | "medium" | "low")
          }
        >
          <option value="all">Severity: All</option>
          <option value="high">Severity: High</option>
          <option value="medium">Severity: Medium</option>
          <option value="low">Severity: Low</option>
        </select>

        <select
          className={styles.searchInput}
          value={errorSourceFilter}
          onChange={(event) => onErrorSourceFilterChange(event.target.value)}
        >
          {errorSourceOptions.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "Source: All" : `Source: ${sourceLabel(value)}`}
            </option>
          ))}
        </select>

        <select
          className={styles.searchInput}
          value={errorEventSyntheticFilter}
          onChange={(event) =>
            onErrorEventSyntheticFilterChange(event.target.value as "all" | "exclude" | "only")
          }
        >
          <option value="all">Events: Real + synthetic</option>
          <option value="exclude">Events: Real only</option>
          <option value="only">Events: Synthetic only</option>
        </select>

        <select
          className={styles.searchInput}
          value={errorEventIncidentFilter}
          onChange={(event) =>
            onErrorEventIncidentFilterChange(event.target.value as AdminErrorEventIncidentFilter)
          }
        >
          <option value="actionable">Events: Actionable</option>
          <option value="all">Events: All incident states</option>
          <option value="open">Events: Open incidents</option>
          <option value="resolved">Events: Resolved incidents</option>
          <option value="ignored">Events: Ignored incidents</option>
          <option value="unlinked">Events: Unlinked only</option>
        </select>

        <input
          className={styles.searchInput}
          type="search"
          value={errorSearch}
          onChange={(event) => onErrorSearchChange(event.target.value)}
          placeholder="Search message, user, endpoint, request id, fingerprint, source"
        />
      </div>
      <div className={styles.searchRow}>
        <p className="tiny subdued">
          Showing {resultStart}-{resultEnd} of {errorPagination.totalCount}
        </p>
        <div className={styles.tabRow}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => {
              void onBulkUpdateListedErrorStatus("resolved");
            }}
            disabled={listedOpenIncidentCount === 0 || bulkIncidentStatusUpdating !== null}
          >
            {bulkIncidentStatusUpdating === "resolved"
              ? "Resolving listed…"
              : `Resolve listed open (${listedOpenIncidentCount})`}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => {
              void onBulkUpdateListedErrorStatus("ignored");
            }}
            disabled={listedOpenIncidentCount === 0 || bulkIncidentStatusUpdating !== null}
          >
            {bulkIncidentStatusUpdating === "ignored"
              ? "Ignoring listed…"
              : `Ignore listed open (${listedOpenIncidentCount})`}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onPrevPage}
            disabled={errorsLoading || !errorPagination.hasPrevPage}
          >
            Prev
          </button>
          <span className="tiny subdued">
            Page {errorPagination.page} of {errorPagination.totalPages}
          </span>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onNextPage}
            disabled={errorsLoading || !errorPagination.hasNextPage}
          >
            Next
          </button>
        </div>
      </div>
      {bulkIncidentStatusResult ? <p className="tiny subdued">{bulkIncidentStatusResult}</p> : null}
      {testIncidentResult ? <p className="tiny subdued">{testIncidentResult}</p> : null}

      <div className={styles.adminTable}>
        <div className={styles.adminErrorsHead}>
          <span>Severity</span>
          <span>Source</span>
          <span>User</span>
          <span>Error</span>
          <span>Location</span>
          <span>Hits</span>
          <span>Last seen</span>
          <span>Actions</span>
        </div>

        {errorsError ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityMedium}`}>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">{errorsError}</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
          </div>
        ) : errors.length === 0 ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityLow}`}>
            <span className="subdued">None</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">No incidents matched the current filters.</span>
            <span className="subdued">—</span>
            <span className="subdued">0</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
          </div>
        ) : (
          errors.map((row) => (
            <div
              key={row.id}
              className={`${styles.adminErrorsRow} ${
                row.severity === "high"
                  ? styles.severityHigh
                  : row.severity === "low"
                    ? styles.severityLow
                    : styles.severityMedium
              }`}
            >
              <span
                className={`${styles.pill} ${
                  row.severity === "high"
                    ? styles.pillCritical
                    : row.severity === "medium"
                      ? styles.pillWarn
                      : styles.pillOk
                }`}
              >
                {row.severity}
              </span>
              <div className={styles.errorCell}>
                <span>{sourceLabel(row.source)}</span>
                <span className="tiny subdued">{`Scope ${row.scope}`}</span>
              </div>
              <div className={styles.errorCell}>
                <span>{row.userEmail ?? "Unknown user"}</span>
                <span className="tiny subdued">{row.userId ?? "No user id"}</span>
              </div>
              <div className={styles.errorCell}>
                <span>{row.message}</span>
                <span className="tiny subdued">
                  {`Status ${row.status}`}
                  {" · "}
                  {row.httpStatus ? `HTTP ${row.httpStatus}` : "No HTTP status"}
                  {row.requestId ? ` · req ${row.requestId}` : ""}
                  {row.fingerprint ? ` · fp ${row.fingerprint.slice(0, 10)}` : ""}
                </span>
              </div>
              <div className={styles.errorCell}>
                <span>{row.endpoint ?? row.route ?? "Unknown route"}</span>
                <span className="tiny subdued">{row.route ?? "No route context"}</span>
              </div>
              <span className="mono">{row.occurrencesCount.toLocaleString()}</span>
              <div className={styles.errorCell}>
                <span>{formatDateTime(row.lastSeenAt)}</span>
                <span className="tiny subdued">First: {formatDateTime(row.firstSeenAt)}</span>
              </div>
              <div className={styles.errorActions}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => onCopyIncident(row)}
                  disabled={statusUpdatingErrorId === row.id}
                >
                  {copiedIncidentId === row.id ? "Copied" : "Copy triage"}
                </button>
                {row.status === "open" ? (
                  <>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => onUpdateErrorStatus(row.id, "resolved")}
                      disabled={statusUpdatingErrorId === row.id}
                    >
                      {statusUpdatingErrorId === row.id ? "Updating…" : "Resolve"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => onUpdateErrorStatus(row.id, "ignored")}
                      disabled={statusUpdatingErrorId === row.id}
                    >
                      Ignore
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => onUpdateErrorStatus(row.id, "open")}
                    disabled={statusUpdatingErrorId === row.id}
                  >
                    {statusUpdatingErrorId === row.id ? "Updating…" : "Reopen"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
