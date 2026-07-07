/**
 * Admin Crash Logs panel.
 * Displays account-linked browser freeze/crash session rows and compact evidence packets.
 */
import { useState } from "react";
import { AppMessage } from "../../../components/AppMessage";
import type {
  AdminCrashSessionConfidence,
  AdminCrashSessionReviewStatus,
  AdminCrashSessionRow,
  AdminCrashSessionStatus,
  AdminPagination,
} from "../types";
import type {
  AdminCrashSessionsViewMode,
  AdminCrashSessionReviewStatusFilter,
  AdminCrashSessionStatusFilter,
} from "../logic/adminCrashSessionsApi";
import { copyToClipboard } from "../logic/copyToClipboard";
import { formatDateTime } from "../logic/errorIncidentViewUtils";
import styles from "../../../styles/admin.module.css";

type AdminCrashLogsPanelProps = {
  sessions: AdminCrashSessionRow[];
  loading: boolean;
  error: string | null;
  pagination: AdminPagination;
  viewMode: AdminCrashSessionsViewMode;
  statusFilter: AdminCrashSessionStatusFilter;
  reviewStatusFilter: AdminCrashSessionReviewStatusFilter;
  search: string;
  updatingReviewSessionId: string | null;
  onViewModeChange: (value: AdminCrashSessionsViewMode) => void;
  onStatusFilterChange: (value: AdminCrashSessionStatusFilter) => void;
  onReviewStatusFilterChange: (value: AdminCrashSessionReviewStatusFilter) => void;
  onSearchChange: (value: string) => void;
  onUpdateReviewStatus: (
    sessionId: string,
    status: AdminCrashSessionReviewStatus,
    note?: string
  ) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
};

const STATUS_OPTIONS: Array<{ value: AdminCrashSessionStatusFilter; label: string }> = [
  { value: "needs_review", label: "Needs review" },
  { value: "probable_freeze_or_crash", label: "Probable freeze/crash" },
  { value: "confirmed_crash", label: "Confirmed crash" },
  { value: "possible_ungraceful_exit", label: "Possible ungraceful exit" },
  { value: "active", label: "Active" },
  { value: "clean_closed", label: "Clean closed" },
  { value: "all", label: "All statuses" },
];
const REVIEW_STATUS_OPTIONS: Array<{ value: AdminCrashSessionReviewStatusFilter; label: string }> =
  [
    { value: "open", label: "Open review" },
    { value: "reviewed", label: "Reviewed history" },
    { value: "resolved", label: "Reviewed" },
    { value: "ignored", label: "Ignored" },
    { value: "all", label: "All review" },
  ];

const VIEW_MODE_OPTIONS: Array<{ value: AdminCrashSessionsViewMode; label: string }> = [
  { value: "needs_review", label: "Needs Review" },
  { value: "history", label: "History" },
  { value: "all_evidence", label: "All Evidence" },
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

const reviewStatusLabel = (status: AdminCrashSessionReviewStatus): string => {
  if (status === "resolved") return "Reviewed";
  if (status === "ignored") return "Ignored";
  return "Open review";
};

const evidenceText = (row: AdminCrashSessionRow): string => {
  const pressure = row.metadata.max_pressure_level ?? row.metadata.pressure_level;
  const stall = row.metadata.stall_duration_ms ?? row.metadata.max_input_stall_ms;
  const heap =
    row.metadata.max_heap_used_to_total_ratio ??
    row.metadata.heap_used_to_total_ratio ??
    row.metadata.heap_usage_ratio;
  const parts = [
    typeof pressure === "number" ? `pressure ${pressure}` : null,
    typeof stall === "number" ? `stall ${Math.round(stall)}ms` : null,
    typeof heap === "number" ? `heap ${Math.round(heap * 100)}%` : null,
  ].filter(Boolean);
  if (row.isStale) parts.unshift("heartbeat stale");
  return parts.length ? parts.join(" · ") : row.lastEvent.replaceAll("_", " ");
};

const signalText = (row: AdminCrashSessionRow): string => {
  if (row.isStale) return "Heartbeat went stale";
  if (row.lastEvent === "crash_report") return "Browser reported a crash";
  if (row.lastEvent === "previous_session_abandoned")
    return "Previous session ended without clean close";
  return evidenceText(row);
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
        reviewStatus: row.reviewStatus,
        reviewedAt: row.reviewedAt,
        reviewedByEmail: row.reviewedByEmail,
        reviewNote: row.reviewNote,
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
  viewMode,
  statusFilter,
  reviewStatusFilter,
  search,
  updatingReviewSessionId,
  onViewModeChange,
  onStatusFilterChange,
  onReviewStatusFilterChange,
  onSearchChange,
  onUpdateReviewStatus,
  onPrevPage,
  onNextPage,
  onRefresh,
}: AdminCrashLogsPanelProps) {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{
    row: AdminCrashSessionRow;
    status: Extract<AdminCrashSessionReviewStatus, "resolved" | "ignored">;
    note: string;
  } | null>(null);
  const resultStart =
    pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const resultEnd = Math.min(pagination.page * pagination.perPage, pagination.totalCount);

  const copyPacket = async (row: AdminCrashSessionRow) => {
    const copied = await copyToClipboard(buildCrashPacket(row));
    if (copied) setCopiedSessionId(row.id);
  };

  const submitReviewDraft = () => {
    if (!reviewDraft) return;
    onUpdateReviewStatus(reviewDraft.row.id, reviewDraft.status, reviewDraft.note);
    setReviewDraft(null);
  };

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Crash Logs</p>
          <p className="tiny subdued">
            Review crash evidence, keep historical context, and reopen rows when signals recur.
          </p>
        </div>
        <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className={styles.adminCrashModeTabs} role="tablist" aria-label="Crash log view">
        {VIEW_MODE_OPTIONS.map((option) => {
          const active = option.value === viewMode;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.adminNavLink} ${styles.adminNavButton} ${
                active ? styles.adminNavLinkActive : ""
              }`}
              onClick={() => onViewModeChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
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
        <select
          className={styles.searchInput}
          value={reviewStatusFilter}
          onChange={(event) =>
            onReviewStatusFilterChange(event.target.value as AdminCrashSessionReviewStatusFilter)
          }
        >
          {REVIEW_STATUS_OPTIONS.map((option) => (
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
        <div className={styles.adminErrorsHead}>
          <span>Status</span>
          <span>Confidence</span>
          <span>Evidence</span>
          <span>User / browser</span>
          <span>Last seen</span>
          <span>Action</span>
        </div>

        {error ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityMedium}`}>
            <span className="subdued">Unavailable</span>
            <span className="subdued">-</span>
            <span>
              <AppMessage tone="error" mode="compact" message={error} />
            </span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityLow}`}>
            <span className="subdued">Clear</span>
            <span className="subdued">-</span>
            <span className="subdued">No crash sessions matched the current filters.</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
            <span className="subdued">-</span>
          </div>
        ) : (
          sessions.map((row) => {
            const expanded = expandedSessionId === row.id;
            const signal = signalText(row);
            const evidence = evidenceText(row);
            const isUpdatingReview = updatingReviewSessionId === row.id;
            const isOpenReview = row.reviewStatus === "open";
            return (
              <div key={row.id} className={styles.adminCrashSessionGroup}>
                <div
                  className={`${styles.adminErrorsRow} ${
                    row.effectiveStatus === "confirmed_crash" ||
                    row.effectiveStatus === "probable_freeze_or_crash"
                      ? styles.severityHigh
                      : row.effectiveStatus === "possible_ungraceful_exit"
                        ? styles.severityMedium
                        : styles.severityLow
                  }`}
                >
                  <div className={styles.errorCell}>
                    <span>{statusLabel(row.effectiveStatus)}</span>
                    <span className="tiny subdued">{row.lastEvent.replaceAll("_", " ")}</span>
                    <span className="tiny subdued">{reviewStatusLabel(row.reviewStatus)}</span>
                  </div>
                  <span>{confidenceLabel(row.effectiveConfidence)}</span>
                  <div className={styles.errorCell}>
                    <span>{signal}</span>
                    <span className="tiny subdued">
                      {row.route ?? "Unknown route"}
                      {evidence !== signal ? ` · ${evidence}` : ""}
                    </span>
                  </div>
                  <div className={styles.errorCell}>
                    <span>{row.userEmail ?? "Unknown email"}</span>
                    <span className="tiny subdued">
                      {browserLabel(row.userAgent)} · {row.clientEnvironment ?? "Unknown env"}
                    </span>
                  </div>
                  <div className={styles.errorCell}>
                    <span>{formatDateTime(row.lastSeenAt)}</span>
                    <span className="tiny subdued">Started {formatDateTime(row.startedAt)}</span>
                  </div>
                  <div className={styles.errorActions}>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => {
                        void copyPacket(row);
                      }}
                      disabled={isUpdatingReview}
                    >
                      {copiedSessionId === row.id ? "Copied" : "Copy triage"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => setExpandedSessionId(expanded ? null : row.id)}
                    >
                      {expanded ? "Hide" : "Details"}
                    </button>
                    {isOpenReview ? (
                      <>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => setReviewDraft({ row, status: "resolved", note: "" })}
                          disabled={isUpdatingReview}
                        >
                          {isUpdatingReview ? "Updating..." : "Mark reviewed"}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => setReviewDraft({ row, status: "ignored", note: "" })}
                          disabled={isUpdatingReview}
                        >
                          Ignore signal
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => onUpdateReviewStatus(row.id, "open")}
                        disabled={isUpdatingReview}
                      >
                        {isUpdatingReview ? "Updating..." : "Reopen"}
                      </button>
                    )}
                  </div>
                </div>
                {expanded ? (
                  <div className={styles.adminCrashSessionDetail}>
                    <span>Session {row.browserSessionId}</span>
                    <span>Host {row.host ?? "unknown"}</span>
                    <span>Vercel {row.vercelId ?? "unknown"}</span>
                    <span>Suspected {formatDateTime(row.suspectedAt)}</span>
                    <span>Review {reviewStatusLabel(row.reviewStatus)}</span>
                    <span>Reviewed {formatDateTime(row.reviewedAt)}</span>
                    <span>Reviewer {row.reviewedByEmail ?? "not recorded"}</span>
                    <span>Review note {row.reviewNote ?? "none"}</span>
                    <span>User agent {row.userAgent ?? "unknown"}</span>
                    <pre>{JSON.stringify(row.metadata, null, 2)}</pre>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {reviewDraft ? (
        <div className={styles.adminModalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.adminModalCard}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">
                  {reviewDraft.status === "ignored" ? "Ignore Crash Signal" : "Mark Reviewed"}
                </p>
                <h3>{reviewDraft.row.userEmail ?? "Unknown user"}</h3>
                <p className="tiny subdued">
                  {reviewDraft.row.route ?? "Unknown route"} ·{" "}
                  {formatDateTime(reviewDraft.row.lastSeenAt)}
                </p>
              </div>
            </div>
            <textarea
              className={styles.reportNotesInput}
              value={reviewDraft.note}
              onChange={(event) =>
                setReviewDraft((current) =>
                  current ? { ...current, note: event.target.value } : current
                )
              }
              placeholder="Add a short review note for history"
            />
            <div className={styles.errorActions}>
              <button type="button" className="primary-btn mini" onClick={submitReviewDraft}>
                {reviewDraft.status === "ignored" ? "Ignore signal" : "Mark reviewed"}
              </button>
              <button type="button" className="ghost-btn mini" onClick={() => setReviewDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
