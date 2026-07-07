/**
 * Operator issue-report queue for reviewing signed-in user submissions.
 */
import { useMemo, useState } from "react";
import type { IssueReportStatus } from "../../../lib/issueReports";
import type {
  AdminIssueReportFilter,
  AdminIssueReportRow,
  AdminIssueReportSummary,
  AdminPagination,
} from "../types";
import { AdminReportDetailModal } from "./AdminReportDetailModal";
import reportStyles from "./AdminReportLog.module.css";
import styles from "../../../styles/admin.module.css";

type AdminReportsPanelProps = {
  reports: AdminIssueReportRow[];
  reportsLoading: boolean;
  reportsError: string | null;
  reportSummary: AdminIssueReportSummary;
  reportsPagination: AdminPagination;
  reportStatusFilter: AdminIssueReportFilter;
  reportSearch: string;
  reportUpdatingId: string | null;
  onReportStatusFilterChange: (value: AdminIssueReportFilter) => void;
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
  const hasActiveFilters = reportStatusFilter !== "open" || reportSearch.trim().length > 0;
  const hasStoredReports = reportSummary.totalCount > 0;
  const countFilters: Array<{
    label: string;
    value: AdminIssueReportFilter;
    count: number;
  }> = [
    { label: "Open", value: "open", count: reportSummary.openCount },
    { label: "New", value: "new", count: reportSummary.newCount },
    { label: "Reviewing", value: "reviewing", count: reportSummary.reviewingCount },
    { label: "History", value: "resolved", count: reportSummary.resolvedCount },
    { label: "All", value: "all", count: reportSummary.totalCount },
  ];
  const activeFilterLabel =
    countFilters.find((filter) => filter.value === reportStatusFilter)?.label ?? "Open";
  const showingLabel = hasStoredReports
    ? `Showing ${reports.length} of ${reportsPagination.totalCount} ${activeFilterLabel.toLowerCase()} reports`
    : "No reports submitted yet";

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Reports</p>
            <h2 className={styles.adminSectionTitle}>User issue queue</h2>
          </div>
          <div className={reportStyles.adminReportsHeaderActions}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={onRefresh}
              disabled={reportsLoading}
            >
              {reportsLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className={reportStyles.adminReportsSummaryStrip} aria-label="Report status filters">
          {countFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-label={`${filter.label} reports: ${filter.count}`}
              className={[
                reportStyles.adminReportsStatButton,
                reportStatusFilter === filter.value
                  ? reportStyles.adminReportsStatButtonActive
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onReportStatusFilterChange(filter.value)}
            >
              <span>{filter.label}</span>
              <strong>{filter.count}</strong>
            </button>
          ))}
        </div>

        <div className={reportStyles.adminReportsToolbar}>
          <label className={reportStyles.reportFilterField}>
            <span className="tiny subdued">Search reports</span>
            <input
              className={styles.searchInput}
              value={reportSearch}
              onChange={(event) => onReportSearchChange(event.target.value)}
              placeholder="Email, user id, message, or path"
            />
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => {
                onReportStatusFilterChange("open");
                onReportSearchChange("");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className={styles.adminTableShell}>
          <div className={reportStyles.adminReportsTableMeta}>
            <div className={reportStyles.adminReportsTableMetaBlock}>
              <strong>{showingLabel}</strong>
            </div>
            <div className={reportStyles.adminReportsTableMetaBlock}>
              <strong>{activeFilterLabel}</strong>
              {reportStatusFilter === "open" ? (
                <span className="tiny subdued">Resolved reports are preserved in History.</span>
              ) : null}
            </div>
          </div>
          <div className={styles.adminTableScroller}>
            <div className={styles.adminTable}>
              <div className={reportStyles.adminReportsHead}>
                <span>Submitted</span>
                <span>Status</span>
                <span>Reporter</span>
                <span>Message</span>
                <span>Actions</span>
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
                <div
                  className={`${styles.adminTableRow} ${styles.adminTableEmptyRow} ${reportStyles.adminReportsEmptyState}`}
                >
                  <strong>
                    {hasStoredReports
                      ? "No reports match the current filters."
                      : "No issue reports yet."}
                  </strong>
                  <span className="tiny subdued">
                    {hasStoredReports
                      ? "Try widening the filters or clear the search to bring more reports back into view."
                      : "Once signed-in users submit reports, they will appear here for manual review."}
                  </span>
                </div>
              ) : (
                reports.map((report) => {
                  const isUpdating = reportUpdatingId === report.id;
                  const statusAction =
                    report.status === "new"
                      ? {
                          label: "Start review",
                          status: "reviewing" as const,
                        }
                      : report.status === "reviewing"
                        ? {
                            label: "Resolve",
                            status: "resolved" as const,
                          }
                        : {
                            label: "Reopen",
                            status: "new" as const,
                          };
                  return (
                    <div
                      key={report.id}
                      className={[
                        styles.adminTableRow,
                        reportStyles.adminReportsRow,
                        selectedReportId === report.id ? styles.adminTableRowActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span>{formatDateTime(report.createdAt)}</span>
                      <span>
                        <span
                          className={[
                            reportStyles.reportStatusPill,
                            report.status === "new"
                              ? reportStyles.reportStatusNew
                              : report.status === "reviewing"
                                ? reportStyles.reportStatusReviewing
                                : reportStyles.reportStatusResolved,
                          ].join(" ")}
                        >
                          {statusLabel(report.status)}
                        </span>
                      </span>
                      <span className={reportStyles.reportIdentityCell}>
                        <strong>{report.submitterEmail}</strong>
                        <span className="tiny subdued">{report.userId ?? "Detached user"}</span>
                      </span>
                      <span className={reportStyles.reportPreviewCell}>
                        {buildMessagePreview(report.message)}
                      </span>
                      <span className={reportStyles.reportActionsCell}>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => setSelectedReportId(report.id)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() =>
                            void onUpdateReport(report.id, {
                              status: statusAction.status,
                            })
                          }
                          disabled={isUpdating}
                        >
                          {isUpdating ? "Saving..." : statusAction.label}
                        </button>
                        {report.status === "new" ? (
                          <button
                            type="button"
                            className="ghost-btn mini"
                            onClick={() =>
                              void onUpdateReport(report.id, {
                                status: "resolved",
                              })
                            }
                            disabled={isUpdating}
                          >
                            Resolve
                          </button>
                        ) : null}
                      </span>
                    </div>
                  );
                })
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
