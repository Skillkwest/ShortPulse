/**
 * Admin error incidents panel.
 * Renders summary cards, filters, and grouped incident rows for operator triage.
 */
import React, { useMemo } from "react";
import { WarningCircle } from "phosphor-react";
import type { AdminErrorLogRow, AdminErrorSummary, AdminPagination } from "../types";
import styles from "../../../styles/admin.module.css";

type ErrorIncidentsPanelProps = {
  errors: AdminErrorLogRow[];
  errorsLoading: boolean;
  errorsError: string | null;
  errorSummary: AdminErrorSummary;
  errorStatusFilter: "open" | "all";
  errorSeverityFilter: "all" | "high" | "medium" | "low";
  errorSourceFilter: string;
  errorSearch: string;
  errorPagination: AdminPagination;
  onErrorStatusFilterChange: (value: "open" | "all") => void;
  onErrorSeverityFilterChange: (value: "all" | "high" | "medium" | "low") => void;
  onErrorSourceFilterChange: (value: string) => void;
  onErrorSearchChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const sourceLabel = (value: string): string =>
  value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");

/**
 * Displays operator-focused app incident telemetry.
 */
export function ErrorIncidentsPanel({
  errors,
  errorsLoading,
  errorsError,
  errorSummary,
  errorStatusFilter,
  errorSeverityFilter,
  errorSourceFilter,
  errorSearch,
  errorPagination,
  onErrorStatusFilterChange,
  onErrorSeverityFilterChange,
  onErrorSourceFilterChange,
  onErrorSearchChange,
  onPrevPage,
  onNextPage,
  onRefresh,
}: ErrorIncidentsPanelProps) {
  const errorSourceOptions = useMemo(() => {
    const values = new Set(errors.map((row) => row.source));
    return ["all", ...Array.from(values).sort()];
  }, [errors]);

  const resultStart = errorPagination.totalCount === 0 ? 0 : (errorPagination.page - 1) * errorPagination.perPage + 1;
  const resultEnd = Math.min(errorPagination.page * errorPagination.perPage, errorPagination.totalCount);

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Errors</p>
          <p className="tiny subdued">Actionable app/runtime failures grouped by fingerprint and user.</p>
        </div>
        <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={errorsLoading}>
          {errorsLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <section className={styles.adminGrid}>
        <div className={`${styles.adminCard} ${styles.alert}`}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Open incidents</span>
            <WarningCircle size={18} />
          </div>
          <p className={styles.adminMetric}>{errorSummary.openCount}</p>
          <p className={styles.adminSubtext}>Grouped unresolved fingerprints</p>
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
          value={errorSeverityFilter}
          onChange={(event) => onErrorSeverityFilterChange(event.target.value as "all" | "high" | "medium" | "low")}
        >
          <option value="all">Severity: All</option>
          <option value="high">Severity: High</option>
          <option value="medium">Severity: Medium</option>
          <option value="low">Severity: Low</option>
        </select>

        <select className={styles.searchInput} value={errorSourceFilter} onChange={(event) => onErrorSourceFilterChange(event.target.value)}>
          {errorSourceOptions.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "Source: All" : `Source: ${sourceLabel(value)}`}
            </option>
          ))}
        </select>

        <input
          className={styles.searchInput}
          type="search"
          value={errorSearch}
          onChange={(event) => onErrorSearchChange(event.target.value)}
          placeholder="Search message, user, endpoint, request id, source"
        />
      </div>
      <div className={styles.searchRow}>
        <p className="tiny subdued">
          Showing {resultStart}-{resultEnd} of {errorPagination.totalCount}
        </p>
        <div className={styles.tabRow}>
          <button type="button" className="ghost-btn mini" onClick={onPrevPage} disabled={errorsLoading || !errorPagination.hasPrevPage}>
            Prev
          </button>
          <span className="tiny subdued">
            Page {errorPagination.page} of {errorPagination.totalPages}
          </span>
          <button type="button" className="ghost-btn mini" onClick={onNextPage} disabled={errorsLoading || !errorPagination.hasNextPage}>
            Next
          </button>
        </div>
      </div>

      <div className={styles.adminTable}>
        <div className={styles.adminErrorsHead}>
          <span>Severity</span>
          <span>Source</span>
          <span>User</span>
          <span>Error</span>
          <span>Location</span>
          <span>Hits</span>
          <span>Last seen</span>
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
          </div>
        ) : (
          errors.map((row) => (
            <div
              key={row.id}
              className={`${styles.adminErrorsRow} ${
                row.severity === "high" ? styles.severityHigh : row.severity === "low" ? styles.severityLow : styles.severityMedium
              }`}
            >
              <span className={`${styles.pill} ${row.severity === "high" ? styles.pillWarn : styles.pillOk}`}>{row.severity}</span>
              <span>{sourceLabel(row.source)}</span>
              <div className={styles.errorCell}>
                <span>{row.userEmail ?? "Unknown user"}</span>
                <span className="tiny subdued">{row.userId ?? "No user id"}</span>
              </div>
              <div className={styles.errorCell}>
                <span>{row.message}</span>
                <span className="tiny subdued">
                  {row.httpStatus ? `HTTP ${row.httpStatus}` : "No HTTP status"}
                  {row.requestId ? ` · req ${row.requestId}` : ""}
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
            </div>
          ))
        )}
      </div>
    </section>
  );
}
