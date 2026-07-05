/**
 * Admin Crash Logs panel.
 * Displays account-linked browser freeze/crash session rows and compact evidence packets.
 */
import { useState } from "react";
import { AppMessage } from "../../../components/AppMessage";
import type {
  AdminCrashSessionConfidence,
  AdminCrashSessionRow,
  AdminCrashSessionStatus,
  AdminPagination,
} from "../types";
import type { AdminCrashSessionStatusFilter } from "../logic/adminCrashSessionsApi";
import { copyToClipboard } from "../logic/copyToClipboard";
import { formatDateTime } from "../logic/errorIncidentViewUtils";
import styles from "../../../styles/admin.module.css";

type AdminCrashLogsPanelProps = {
  sessions: AdminCrashSessionRow[];
  loading: boolean;
  error: string | null;
  pagination: AdminPagination;
  statusFilter: AdminCrashSessionStatusFilter;
  search: string;
  onStatusFilterChange: (value: AdminCrashSessionStatusFilter) => void;
  onSearchChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
};

const STATUS_OPTIONS: Array<{ value: AdminCrashSessionStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "probable_freeze_or_crash", label: "Probable freeze/crash" },
  { value: "possible_ungraceful_exit", label: "Possible ungraceful exit" },
  { value: "confirmed_crash", label: "Confirmed crash" },
  { value: "active", label: "Active" },
  { value: "clean_closed", label: "Clean closed" },
];

const statusLabel = (status: AdminCrashSessionStatus): string => {
  if (status === "clean_closed") return "Clean closed";
  if (status === "possible_ungraceful_exit") return "Possible exit";
  if (status === "probable_freeze_or_crash") return "Probable freeze";
  if (status === "confirmed_crash") return "Confirmed crash";
  return "Active";
};

const confidenceLabel = (confidence: AdminCrashSessionConfidence): string => {
  if (confidence === "none") return "No crash signal";
  return `${confidence} confidence`;
};

const statusClassName = (status: AdminCrashSessionStatus): string => {
  if (status === "confirmed_crash" || status === "probable_freeze_or_crash") {
    return styles.pillCritical;
  }
  if (status === "possible_ungraceful_exit") return styles.pillWarn;
  return styles.pillOk;
};

const evidenceText = (row: AdminCrashSessionRow): string => {
  const pressure = row.metadata.pressure_level;
  const stall = row.metadata.stall_duration_ms ?? row.metadata.max_input_stall_ms;
  const heap = row.metadata.heap_usage_ratio;
  const parts = [
    typeof pressure === "number" ? `pressure ${pressure}` : null,
    typeof stall === "number" ? `stall ${Math.round(stall)}ms` : null,
    typeof heap === "number" ? `heap ${Math.round(heap * 100)}%` : null,
  ].filter(Boolean);
  if (row.isStale) parts.unshift("heartbeat stale");
  return parts.length ? parts.join(" · ") : row.lastEvent.replaceAll("_", " ");
};

const browserLabel = (userAgent: string | null): string => {
  if (!userAgent) return "Unknown browser";
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("Chrome/")) return "Chrome";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Safari/")) return "Safari";
  return userAgent.slice(0, 40);
};

const buildCrashPacket = (row: AdminCrashSessionRow): string =>
  JSON.stringify(
    {
      shortpulseCrashSessionVersion: 1,
      packetType: "browser_crash_session",
      session: {
        id: row.id,
        browserSessionId: row.browserSessionId,
        status: row.effectiveStatus,
        confidence: row.effectiveConfidence,
        lastEvent: row.lastEvent,
        userId: row.userId,
        userEmail: row.userEmail,
        route: row.route,
        startedAt: row.startedAt,
        lastSeenAt: row.lastSeenAt,
        suspectedAt: row.suspectedAt,
        browser: row.userAgent,
        buildId: row.buildId,
        clientRelease: row.clientRelease,
        clientEnvironment: row.clientEnvironment,
        metadata: row.metadata,
      },
    },
    null,
    2
  );

/**
 * Renders the browser crash-session investigation table.
 */
export function AdminCrashLogsPanel({
  sessions,
  loading,
  error,
  pagination,
  statusFilter,
  search,
  onStatusFilterChange,
  onSearchChange,
  onPrevPage,
  onNextPage,
  onRefresh,
}: AdminCrashLogsPanelProps) {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const resultStart =
    pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const resultEnd = Math.min(pagination.page * pagination.perPage, pagination.totalCount);

  const copyPacket = async (row: AdminCrashSessionRow) => {
    const copied = await copyToClipboard(buildCrashPacket(row));
    if (copied) setCopiedSessionId(row.id);
  };

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Crash Logs</p>
          <p className="tiny subdued">
            Browser sessions with freeze, crash, close, and stale-heartbeat evidence.
          </p>
        </div>
        <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className={styles.adminErrorsToolbar}>
        <input
          className={styles.searchInput}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search user, route, session, browser"
        />
        <select
          className={styles.searchInput}
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as AdminCrashSessionStatusFilter)
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="tiny subdued">
          Showing {resultStart}-{resultEnd} of {pagination.totalCount}
        </p>
        <div className={styles.tabRow}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onPrevPage}
            disabled={loading || !pagination.hasPrevPage}
          >
            Prev
          </button>
          <span className="tiny subdued">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onNextPage}
            disabled={loading || !pagination.hasNextPage}
          >
            Next
          </button>
        </div>
      </div>

      <div className={styles.adminTable}>
        <div className={styles.adminCrashSessionsHead}>
          <span>Status</span>
          <span>User</span>
          <span>Last seen</span>
          <span>Browser</span>
          <span>Route</span>
          <span>Evidence</span>
          <span>Action</span>
        </div>

        {error ? (
          <div className={`${styles.adminCrashSessionsRow} ${styles.severityMedium}`}>
            <span className="subdued">Unavailable</span>
            <span>
              <AppMessage tone="error" mode="compact" message={error} />
            </span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className={`${styles.adminCrashSessionsRow} ${styles.severityLow}`}>
            <span className="subdued">Clear</span>
            <span className="subdued">No crash sessions matched the current filters.</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
          </div>
        ) : (
          sessions.map((row) => {
            const expanded = expandedSessionId === row.id;
            return (
              <div key={row.id} className={styles.adminCrashSessionGroup}>
                <div
                  className={`${styles.adminCrashSessionsRow} ${
                    row.effectiveStatus === "confirmed_crash" ||
                    row.effectiveStatus === "probable_freeze_or_crash"
                      ? styles.severityHigh
                      : row.effectiveStatus === "possible_ungraceful_exit"
                        ? styles.severityMedium
                        : styles.severityLow
                  }`}
                >
                  <div className={styles.errorCell}>
                    <span className={`${styles.pill} ${statusClassName(row.effectiveStatus)}`}>
                      {statusLabel(row.effectiveStatus)}
                    </span>
                    <span className="tiny subdued">{confidenceLabel(row.effectiveConfidence)}</span>
                  </div>
                  <div className={styles.errorCell}>
                    <span>{row.userEmail ?? "Unknown email"}</span>
                    <span className="tiny subdued">{row.userId ?? "No user id"}</span>
                  </div>
                  <div className={styles.errorCell}>
                    <span>{formatDateTime(row.lastSeenAt)}</span>
                    <span className="tiny subdued">Started {formatDateTime(row.startedAt)}</span>
                  </div>
                  <div className={styles.errorCell}>
                    <span>{browserLabel(row.userAgent)}</span>
                    <span className="tiny subdued">{row.clientEnvironment ?? "Unknown env"}</span>
                  </div>
                  <div className={styles.errorCell}>
                    <span>{row.route ?? "Unknown route"}</span>
                    <span className="tiny subdued">
                      {row.buildId ?? row.clientRelease ?? "No build"}
                    </span>
                  </div>
                  <div className={styles.errorCell}>
                    <span>{evidenceText(row)}</span>
                    <span className="tiny subdued">{row.lastEvent.replaceAll("_", " ")}</span>
                  </div>
                  <div className={styles.errorActions}>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => setExpandedSessionId(expanded ? null : row.id)}
                    >
                      {expanded ? "Hide" : "Details"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => {
                        void copyPacket(row);
                      }}
                    >
                      {copiedSessionId === row.id ? "Copied" : "Copy packet"}
                    </button>
                  </div>
                </div>
                {expanded ? (
                  <div className={styles.adminCrashSessionDetail}>
                    <span>Session {row.browserSessionId}</span>
                    <span>Host {row.host ?? "unknown"}</span>
                    <span>Vercel {row.vercelId ?? "unknown"}</span>
                    <span>Suspected {formatDateTime(row.suspectedAt)}</span>
                    <span>User agent {row.userAgent ?? "unknown"}</span>
                    <pre>{JSON.stringify(row.metadata, null, 2)}</pre>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
