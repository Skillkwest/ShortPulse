import { useMemo, useState } from "react";
import type { IssueReportStatus } from "../../../lib/issueReports";
import type { AdminIssueReportRow, AdminIssueReportSummary, AdminPagination } from "../types";
import { AdminReportDetailModal } from "./AdminReportDetailModal";
import styles from "../../../styles/admin.module.css";

type AdminReportsPanelProps = {
  reports: AdminIssueReportRow[];
  reportsLoading: boolean;
  reportsError: string | null;
  reportSummary: AdminIssueReportSummary;
  reportsPagination: AdminPagination;
  reportStatusFilter: "all" | IssueReportStatus;
  reportSearch: string;
  reportUpdatingId: string | null;
  onReportStatusFilterChange: (value: "all" | IssueReportStatus) => void;
  onReportSearchChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
  onUpdateReport: (
    reportId: string,
    updates: { status?: IssueReportStatus; adminNotes?: string }
  ) => Promise<AdminIssueReportRow | null>;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const buildMessagePreview = (message: string): string => {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) return normalized;
  return `${normalized.slice(0, 137)}...`;
};

const statusLabel = (status: IssueReportStatus): string => {
  if (status === "reviewing") return "Reviewing";
  if (status === "resolved") return "Resolved";
  return "New";
};

export function AdminReportsPanel({
  reports,
  reportsLoading,
  reportsError,
  reportSummary,
  reportsPagination,
  reportStatusFilter,
  reportSearch,
  reportUpdatingId,
  onReportStatusFilterChange,
  onReportSearchChange,
  onPrevPage,
  onNextPage,
  onRefresh,
  onUpdateReport,
}: AdminReportsPanelProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Report Queue</p>
            <h2 className={styles.adminSectionTitle}>Manual issue review</h2>
          </div>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onRefresh}
            disabled={reportsLoading}
          >
            {reportsLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className={styles.adminGrid}>
          <article className={styles.adminCard}>
            <p className={styles.adminLabel}>Total reports</p>
            <p className={styles.adminMetric}>{reportSummary.totalCount}</p>
            <p className="tiny subdued">All stored issue reports</p>
          </article>
          <article className={styles.adminCard}>
            <p className={styles.adminLabel}>New</p>
            <p className={styles.adminMetric}>{reportSummary.newCount}</p>
            <p className="tiny subdued">Still untouched in admin</p>
          </article>
          <article className={styles.adminCard}>
            <p className={styles.adminLabel}>Reviewing</p>
            <p className={styles.adminMetric}>{reportSummary.reviewingCount}</p>
            <p className="tiny subdued">Actively being worked</p>
          </article>
          <article className={styles.adminCard}>
            <p className={styles.adminLabel}>Resolved</p>
            <p className={styles.adminMetric}>{reportSummary.resolvedCount}</p>
            <p className="tiny subdued">Handled and documented</p>
          </article>
        </div>

        <div className={styles.filterGrid}>
          <label className={styles.errorCell}>
            <span className="tiny subdued">Status</span>
            <select
              value={reportStatusFilter}
              onChange={(event) =>
                onReportStatusFilterChange(event.target.value as "all" | IssueReportStatus)
              }
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className={styles.errorCell}>
            <span className="tiny subdued">Search</span>
            <input
              className={styles.searchInput}
              value={reportSearch}
              onChange={(event) => onReportSearchChange(event.target.value)}
              placeholder="Search by email, user id, message, or path"
            />
          </label>
        </div>

        <div className={styles.adminTableShell}>
          <div className={styles.adminTableScroller}>
            <div className={styles.adminTable}>
              <div className={styles.adminReportsHead}>
                <span>Submitted</span>
                <span>Status</span>
                <span>Reporter</span>
                <span>Message</span>
              </div>
              {reportsLoading ? (
                <div className={`${styles.adminTableRow} ${styles.adminTableEmptyRow}`}>
                  Loading reports…
                </div>
              ) : reportsError ? (
                <div className={`${styles.adminTableRow} ${styles.adminTableEmptyRow}`}>
                  {reportsError}
                </div>
              ) : reports.length === 0 ? (
                <div className={`${styles.adminTableRow} ${styles.adminTableEmptyRow}`}>
                  No reports match the current filters.
                </div>
              ) : (
                reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    className={[
                      styles.adminTableRow,
                      styles.adminTableRowButton,
                      styles.adminReportsRow,
                      selectedReportId === report.id ? styles.adminTableRowActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedReportId(report.id)}
                  >
                    <span>{formatDateTime(report.createdAt)}</span>
                    <span>
                      <span
                        className={[
                          styles.reportStatusPill,
                          report.status === "new"
                            ? styles.reportStatusNew
                            : report.status === "reviewing"
                              ? styles.reportStatusReviewing
                              : styles.reportStatusResolved,
                        ].join(" ")}
                      >
                        {statusLabel(report.status)}
                      </span>
                    </span>
                    <span className={styles.reportIdentityCell}>
                      <strong>{report.submitterEmail}</strong>
                      <span className="tiny subdued">{report.userId ?? "Detached user"}</span>
                    </span>
                    <span className={styles.reportPreviewCell}>
                      {buildMessagePreview(report.message)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.errorActions}>
          <span className="tiny subdued">
            Page {reportsPagination.page} of {reportsPagination.totalPages}
          </span>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onPrevPage}
            disabled={!reportsPagination.hasPrevPage}
          >
            Previous
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onNextPage}
            disabled={!reportsPagination.hasNextPage}
          >
            Next
          </button>
        </div>
      </section>

      <AdminReportDetailModal
        key={
          selectedReport ? `${selectedReport.id}:${selectedReport.updatedAt}` : "empty-report-modal"
        }
        selectedReport={selectedReport}
        updatingReportId={reportUpdatingId}
        onClose={() => setSelectedReportId(null)}
        onUpdateReport={onUpdateReport}
      />
    </>
  );
}
