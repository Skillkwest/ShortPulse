import { AppMessage } from "../../../components/AppMessage";
import type { AdminErrorLogRow, AdminPagination } from "../types";
import { formatDateTime, sourceLabel } from "../logic/errorIncidentViewUtils";
import styles from "../../../styles/admin.module.css";

type ErrorIncidentsOverviewSectionProps = {
  errors: AdminErrorLogRow[];
  errorsLoading: boolean;
  errorsError: string | null;
  errorSearch: string;
  errorPagination: AdminPagination;
  copiedIncidentId: string | null;
  inProgressIncidentIds: Set<string>;
  statusUpdatingErrorId: string | null;
  onErrorSearchChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
  onCopyIncident: (row: AdminErrorLogRow) => void;
  onResolveIncident: (row: AdminErrorLogRow) => void;
};

export function ErrorIncidentsOverviewSection({
  errors,
  errorsLoading,
  errorsError,
  errorSearch,
  errorPagination,
  copiedIncidentId,
  inProgressIncidentIds,
  statusUpdatingErrorId,
  onErrorSearchChange,
  onPrevPage,
  onNextPage,
  onRefresh,
  onCopyIncident,
  onResolveIncident,
}: ErrorIncidentsOverviewSectionProps) {
  const resultStart =
    errorPagination.totalCount === 0 ? 0 : (errorPagination.page - 1) * errorPagination.perPage + 1;
  const resultEnd = Math.min(
    errorPagination.page * errorPagination.perPage,
    errorPagination.totalCount
  );

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Errors</p>
          <p className="tiny subdued">Copy one error packet, then paste it into Codex.</p>
        </div>
        <button
          type="button"
          className="ghost-btn mini"
          onClick={onRefresh}
          disabled={errorsLoading}
        >
          {errorsLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className={styles.adminErrorsToolbar}>
        <input
          className={styles.searchInput}
          type="search"
          value={errorSearch}
          onChange={(event) => onErrorSearchChange(event.target.value)}
          placeholder="Search errors"
        />
        <p className="tiny subdued">
          Showing {resultStart}-{resultEnd} of {errorPagination.totalCount}
        </p>
        <div className={styles.tabRow}>
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

      <div className={styles.adminTable}>
        <div className={styles.adminErrorsHead}>
          <span>Status</span>
          <span>Severity</span>
          <span>Error</span>
          <span>Source</span>
          <span>Last seen</span>
          <span>Action</span>
        </div>

        {errorsError ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityMedium}`}>
            <span className="subdued">Unavailable</span>
            <span className="subdued">-</span>
            <span>
              <AppMessage tone="error" mode="compact" message={errorsError} />
            </span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
          </div>
        ) : errors.length === 0 ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityLow}`}>
            <span className="subdued">Clear</span>
            <span className="subdued">-</span>
            <span className="subdued">No errors matched the current search.</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
          </div>
        ) : (
          errors.map((row) => {
            const isInProgress = inProgressIncidentIds.has(row.id);
            const isUpdatingStatus = statusUpdatingErrorId === row.id;
            const canResolve = row.status === "open";
            return (
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
                  className={`${styles.pill} ${isInProgress ? styles.pillWarn : styles.pillOk}`}
                >
                  {isInProgress ? "In progress" : "New"}
                </span>
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
                  <span>{row.message}</span>
                  <span className="tiny subdued">
                    {row.httpStatus ? `HTTP ${row.httpStatus}` : "No HTTP status"}
                    {row.requestId ? ` · req ${row.requestId}` : ""}
                    {row.userEmail ? ` · ${row.userEmail}` : ""}
                  </span>
                </div>
                <div className={styles.errorCell}>
                  <span>{sourceLabel(row.source)}</span>
                  <span className="tiny subdued">
                    {row.endpoint ?? row.route ?? "Unknown route"}
                  </span>
                </div>
                <div className={styles.errorCell}>
                  <span>{formatDateTime(row.lastSeenAt)}</span>
                  <span className="tiny subdued">
                    {row.occurrencesCount.toLocaleString()} hit
                    {row.occurrencesCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className={styles.errorActions}>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => onCopyIncident(row)}
                    disabled={isUpdatingStatus}
                  >
                    {copiedIncidentId === row.id ? "Copied" : "Copy triage"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => onResolveIncident(row)}
                    disabled={!canResolve || isUpdatingStatus}
                  >
                    {isUpdatingStatus ? "Resolving..." : canResolve ? "Resolve" : "Resolved"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
