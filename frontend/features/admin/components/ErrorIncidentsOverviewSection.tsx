import { useState } from "react";
import { AppMessage } from "../../../components/AppMessage";
import type { AdminErrorIncidentViewMode, AdminErrorLogRow, AdminPagination } from "../types";
import { formatDateTime, sourceLabel } from "../logic/errorIncidentViewUtils";
import styles from "../../../styles/admin.module.css";

const MAX_WATCH_NOTE_LENGTH = 400;

type ErrorIncidentsOverviewSectionProps = {
  errors: AdminErrorLogRow[];
  errorsLoading: boolean;
  errorsError: string | null;
  errorIncidentViewMode: AdminErrorIncidentViewMode;
  errorSearch: string;
  errorPagination: AdminPagination;
  copiedIncidentId: string | null;
  copiedVisibleIncidentCount: number | null;
  inProgressIncidentIds: Set<string>;
  visibleIncidentCount: number;
  statusUpdatingErrorId: string | null;
  onErrorIncidentViewModeChange: (value: AdminErrorIncidentViewMode) => void;
  onErrorSearchChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
  onCopyIncident: (row: AdminErrorLogRow) => void;
  onCopyVisibleIncidents: () => void;
  onResolveIncident: (row: AdminErrorLogRow) => void;
  onResolveWatchIncident: (row: AdminErrorLogRow, note: string) => void;
};

export function ErrorIncidentsOverviewSection({
  errors,
  errorsLoading,
  errorsError,
  errorIncidentViewMode,
  errorSearch,
  errorPagination,
  copiedIncidentId,
  copiedVisibleIncidentCount,
  inProgressIncidentIds,
  visibleIncidentCount,
  statusUpdatingErrorId,
  onErrorIncidentViewModeChange,
  onErrorSearchChange,
  onPrevPage,
  onNextPage,
  onRefresh,
  onCopyIncident,
  onCopyVisibleIncidents,
  onResolveIncident,
  onResolveWatchIncident,
}: ErrorIncidentsOverviewSectionProps) {
  const [watchDraft, setWatchDraft] = useState<{ row: AdminErrorLogRow; note: string } | null>(
    null
  );
  const resultStart =
    errorPagination.totalCount === 0 ? 0 : (errorPagination.page - 1) * errorPagination.perPage + 1;
  const resultEnd = Math.min(
    errorPagination.page * errorPagination.perPage,
    errorPagination.totalCount
  );
  const isHistoryView = errorIncidentViewMode === "history";
  const submitWatchDraft = () => {
    if (!watchDraft) return;
    onResolveWatchIncident(watchDraft.row, watchDraft.note.trim());
    setWatchDraft(null);
  };

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Errors</p>
          <p className="tiny subdued">Copy one error packet, then paste it into Codex.</p>
        </div>
        <div className={styles.adminSectionActions}>
          <div
            className={styles.adminIncidentViewToggle}
            role="tablist"
            aria-label="Error rows view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isHistoryView}
              className={`${styles.tabButton} ${!isHistoryView ? styles.tabActive : ""}`}
              onClick={() => onErrorIncidentViewModeChange("queue")}
            >
              Queue
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isHistoryView}
              className={`${styles.tabButton} ${isHistoryView ? styles.tabActive : ""}`}
              onClick={() => onErrorIncidentViewModeChange("history")}
            >
              History
            </button>
          </div>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onCopyVisibleIncidents}
            disabled={errorsLoading || visibleIncidentCount === 0}
            title={`Copy triage packets for all ${visibleIncidentCount} visible error row${
              visibleIncidentCount === 1 ? "" : "s"
            }`}
          >
            {copiedVisibleIncidentCount ? `Copied ${copiedVisibleIncidentCount}` : "Copy all"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onRefresh}
            disabled={errorsLoading}
          >
            {errorsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
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
            const isInProgress = row.status === "open" && inProgressIncidentIds.has(row.id);
            const isUpdatingStatus = statusUpdatingErrorId === row.id;
            const canResolve = row.status === "open";
            const statusLabel = isInProgress
              ? "In progress"
              : row.status === "open"
                ? "New"
                : row.status === "ignored"
                  ? "Ignored"
                  : "Resolved";
            const statusPillClass = isInProgress
              ? styles.pillWarn
              : row.status === "open"
                ? styles.pillOk
                : styles.pillNeutral;
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
                <span className={`${styles.pill} ${statusPillClass}`}>{statusLabel}</span>
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
                  {row.watchItem ? (
                    <span className="tiny subdued">
                      <span className={`${styles.pill} ${styles.pillWarn}`}>Watch</span>
                      {row.watchNote ? ` ${row.watchNote}` : ""}
                    </span>
                  ) : null}
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
                    {isUpdatingStatus ? "Resolving..." : canResolve ? "Resolve" : statusLabel}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => setWatchDraft({ row, note: "" })}
                    disabled={!canResolve || isUpdatingStatus}
                  >
                    Resolve + Watch
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {watchDraft ? (
        <div className={styles.adminModalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.adminModalCard}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">Resolve + Watch</p>
                <h3>{watchDraft.row.message}</h3>
                <p className="tiny subdued">
                  {watchDraft.row.endpoint ?? watchDraft.row.route ?? "Unknown route"} ·{" "}
                  {formatDateTime(watchDraft.row.lastSeenAt)}
                </p>
              </div>
            </div>
            <textarea
              className={styles.reportNotesInput}
              value={watchDraft.note}
              maxLength={MAX_WATCH_NOTE_LENGTH}
              onChange={(event) =>
                setWatchDraft((current) =>
                  current ? { ...current, note: event.target.value } : current
                )
              }
              placeholder="Add a short watch note for history"
            />
            <div className={styles.errorActions}>
              <button type="button" className="primary-btn mini" onClick={submitWatchDraft}>
                Resolve + watch
              </button>
              <button type="button" className="ghost-btn mini" onClick={() => setWatchDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
