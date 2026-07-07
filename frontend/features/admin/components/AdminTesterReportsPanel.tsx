/**
 * Operator log for tester-agent run reports.
 */
import { useState } from "react";
import type { HyberveesReviewStatus, TesterReportStatus } from "../../../lib/testerReports";
import type { AdminPagination, AdminTesterReportRunRow, AdminTesterReportSummary } from "../types";
import { AdminTesterReportMarkdown } from "./AdminTesterReportMarkdown";
import reportStyles from "./AdminReportLog.module.css";
import styles from "../../../styles/admin.module.css";

type AdminTesterReportsPanelProps = {
  testerReports: AdminTesterReportRunRow[];
  testerReportsLoading: boolean;
  testerReportsError: string | null;
  hyberveesReviewSavingId: string | null;
  hyberveesReviewError: string | null;
  testerReportSummary: AdminTesterReportSummary;
  testerReportsPagination: AdminPagination;
  testerReportStatusFilter: "all" | TesterReportStatus;
  testerReportReviewFilter: "all" | HyberveesReviewStatus;
  testerReportTesterFilter: string;
  testerReportSearch: string;
  onTesterReportStatusFilterChange: (value: "all" | TesterReportStatus) => void;
  onTesterReportReviewFilterChange: (value: "all" | HyberveesReviewStatus) => void;
  onTesterReportTesterFilterChange: (value: string) => void;
  onTesterReportSearchChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onMarkHyberveesReviewed: (reportId: string) => void;
  onRefresh: () => void;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatOptionalNumber = (value: number | null, suffix = ""): string =>
  value === null ? "Not recorded" : `${value}${suffix}`;

const statusLabel = (status: TesterReportStatus): string => {
  if (status === "blocked") return "Blocked";
  if (status === "failed") return "Failed";
  if (status === "partial") return "Partial";
  return "Completed";
};

const statusClassName = (status: TesterReportStatus): string => {
  if (status === "blocked") return reportStyles.testerReportStatusBlocked;
  if (status === "failed") return reportStyles.testerReportStatusFailed;
  if (status === "partial") return reportStyles.testerReportStatusPartial;
  return reportStyles.testerReportStatusCompleted;
};

const hyberveesReviewLabel = (status: "all" | HyberveesReviewStatus): string => {
  if (status === "reviewed") return "Hybervees reviewed";
  if (status === "unreviewed") return "Needs Hybervees";
  return "All review states";
};

const buildScenarioPreview = (scenario: string): string => {
  const normalized = scenario.replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) return normalized;
  return `${normalized.slice(0, 117)}...`;
};

export function AdminTesterReportsPanel({
  testerReports,
  testerReportsLoading,
  testerReportsError,
  hyberveesReviewSavingId,
  hyberveesReviewError,
  testerReportSummary,
  testerReportsPagination,
  testerReportStatusFilter,
  testerReportReviewFilter,
  testerReportTesterFilter,
  testerReportSearch,
  onTesterReportStatusFilterChange,
  onTesterReportReviewFilterChange,
  onTesterReportTesterFilterChange,
  onTesterReportSearchChange,
  onPrevPage,
  onNextPage,
  onMarkHyberveesReviewed,
  onRefresh,
}: AdminTesterReportsPanelProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedReportKeys, setExpandedReportKeys] = useState<Set<string>>(new Set());
  const hasActiveFilters =
    testerReportStatusFilter !== "all" ||
    testerReportReviewFilter !== "unreviewed" ||
    testerReportTesterFilter.trim().length > 0 ||
    testerReportSearch.trim().length > 0;
  const hasStoredReports = testerReportSummary.totalCount > 0;
  const showingLabel = hasStoredReports
    ? `Showing ${testerReports.length} of ${testerReportSummary.totalCount} tester runs`
    : "No tester runs recorded yet";
  const countFilters: Array<{
    label: string;
    value: "all" | TesterReportStatus;
    count: number;
  }> = [
    { label: "All", value: "all", count: testerReportSummary.totalCount },
    { label: "Completed", value: "completed", count: testerReportSummary.completedCount },
    { label: "Blocked", value: "blocked", count: testerReportSummary.blockedCount },
    { label: "Failed", value: "failed", count: testerReportSummary.failedCount },
    { label: "Partial", value: "partial", count: testerReportSummary.partialCount },
  ];
  const hyberveesReviewCounts = [
    { label: "Needs Hybervees", count: testerReportSummary.hyberveesUnreviewedCount },
    { label: "Hybervees reviewed", count: testerReportSummary.hyberveesReviewedCount },
  ];

  const toggleReport = (key: string) => {
    setExpandedReportKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className={styles.adminSectionEyebrow}>Agent Tester Reports</p>
          <h2 className={styles.adminSectionTitle}>Automated run log</h2>
        </div>
        <div className={reportStyles.adminReportsHeaderActions}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onRefresh}
            disabled={testerReportsLoading}
          >
            {testerReportsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div
        className={reportStyles.adminReportsSummaryStrip}
        aria-label="Tester report status filters"
      >
        {countFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-label={`${filter.label} tester reports: ${filter.count}`}
            className={[
              reportStyles.adminReportsStatButton,
              testerReportStatusFilter === filter.value
                ? reportStyles.adminReportsStatButtonActive
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onTesterReportStatusFilterChange(filter.value)}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>

      <div className={reportStyles.adminReportsToolbar}>
        <label className={reportStyles.reportFilterField}>
          <span className="tiny subdued">Hybervees review</span>
          <select
            className={styles.searchInput}
            value={testerReportReviewFilter}
            onChange={(event) =>
              onTesterReportReviewFilterChange(event.target.value as "all" | HyberveesReviewStatus)
            }
          >
            <option value="unreviewed">Needs Hybervees</option>
            <option value="reviewed">Hybervees reviewed</option>
            <option value="all">All review states</option>
          </select>
        </label>
        <label className={reportStyles.reportFilterField}>
          <span className="tiny subdued">Search tester reports</span>
          <input
            className={styles.searchInput}
            value={testerReportSearch}
            onChange={(event) => onTesterReportSearchChange(event.target.value)}
            placeholder="Run id, tester, account, scenario, or surface"
          />
        </label>
        <label className={reportStyles.reportFilterField}>
          <span className="tiny subdued">Tester slug</span>
          <input
            className={styles.searchInput}
            value={testerReportTesterFilter}
            onChange={(event) => onTesterReportTesterFilterChange(event.target.value)}
            placeholder="maya-chen"
          />
        </label>
        {hasActiveFilters ? (
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => {
              onTesterReportStatusFilterChange("all");
              onTesterReportReviewFilterChange("unreviewed");
              onTesterReportTesterFilterChange("");
              onTesterReportSearchChange("");
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
            <strong>
              {testerReportStatusFilter === "all"
                ? "All statuses"
                : statusLabel(testerReportStatusFilter)}
            </strong>
            <span className="tiny subdued">{hyberveesReviewLabel(testerReportReviewFilter)}</span>
          </div>
          <div className={reportStyles.adminReportsTableMetaBlock}>
            <strong>
              {hyberveesReviewCounts.map((item) => `${item.label}: ${item.count}`).join(" · ")}
            </strong>
          </div>
        </div>
        <div className={styles.adminTableScroller}>
          <div className={styles.adminTable}>
            <div className={reportStyles.adminTesterReportsHead}>
              <span>Date/time</span>
              <span>Status</span>
              <span>Review</span>
              <span>Tester</span>
              <span>Account</span>
              <span>Scenario</span>
            </div>
            {testerReportsLoading ? (
              <div className={`${styles.adminTableRow} ${styles.adminTableEmptyRow}`}>
                Loading tester reports...
              </div>
            ) : testerReportsError ? (
              <div className={`${styles.adminTableRow} ${styles.adminTableEmptyRow}`}>
                {testerReportsError}
              </div>
            ) : testerReports.length === 0 ? (
              <div
                className={`${styles.adminTableRow} ${styles.adminTableEmptyRow} ${reportStyles.adminReportsEmptyState}`}
              >
                <strong>
                  {hasStoredReports
                    ? "No tester reports match the current filters."
                    : "No tester reports yet."}
                </strong>
                <span className="tiny subdued">
                  {hasStoredReports
                    ? "Widen the filters to bring more tester runs back into view."
                    : "Once tester agents post run reports, they will appear here."}
                </span>
              </div>
            ) : (
              testerReports.map((report) => {
                const expanded = expandedRunId === report.id;
                const accountLabel =
                  report.shortpulseUserEmail ?? report.shortpulseUserId ?? "Unknown account";
                const personaKey = `${report.id}:persona`;
                const engineeringKey = `${report.id}:engineering`;
                const personaExpanded = expandedReportKeys.has(personaKey);
                const engineeringExpanded = expandedReportKeys.has(engineeringKey);
                const hyberveesReviewed = report.hyberveesReviewStatus === "reviewed";
                const isSavingReview = hyberveesReviewSavingId === report.id;
                return (
                  <div key={report.id} className={reportStyles.adminTesterReportGroup}>
                    <button
                      type="button"
                      className={[
                        styles.adminTableRow,
                        styles.adminTableRowButton,
                        reportStyles.adminTesterReportsRow,
                        expanded ? styles.adminTableRowActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-expanded={expanded}
                      onClick={() => setExpandedRunId(expanded ? null : report.id)}
                    >
                      <span className={reportStyles.reportIdentityCell}>
                        <strong>{formatDateTime(report.createdAt)}</strong>
                      </span>
                      <span>
                        <span
                          className={[
                            reportStyles.reportStatusPill,
                            statusClassName(report.status),
                          ].join(" ")}
                        >
                          {statusLabel(report.status)}
                        </span>
                      </span>
                      <span>
                        <span
                          className={[
                            reportStyles.reportStatusPill,
                            hyberveesReviewed
                              ? reportStyles.testerReportStatusCompleted
                              : reportStyles.testerReportReviewPending,
                          ].join(" ")}
                        >
                          {hyberveesReviewed ? "Hybervees reviewed" : "Needs Hybervees"}
                        </span>
                      </span>
                      <span className={reportStyles.reportIdentityCell}>
                        <strong>{report.testerDisplayName}</strong>
                      </span>
                      <span className={reportStyles.reportIdentityCell}>
                        <strong>{accountLabel}</strong>
                      </span>
                      <span className={reportStyles.reportPreviewCell}>
                        {buildScenarioPreview(report.scenario)}
                      </span>
                    </button>

                    {expanded ? (
                      <div className={reportStyles.adminTesterReportExpanded}>
                        <div className={reportStyles.adminTesterReportMeta}>
                          <span>Started: {formatDateTime(report.runStartedAt)}</span>
                          <span>Finished: {formatDateTime(report.runFinishedAt)}</span>
                          <span>
                            Duration: {formatOptionalNumber(report.durationMinutes, " min")}
                          </span>
                          <span>Credits: {formatOptionalNumber(report.creditsSpent)}</span>
                          <span>Surface: {report.productionSurface ?? "Not recorded"}</span>
                          <span>
                            Hybervees:{" "}
                            {hyberveesReviewed
                              ? `reviewed ${formatDateTime(report.hyberveesReviewedAt)}`
                              : "not reviewed"}
                          </span>
                          {report.hyberveesInsightArtifactPath ? (
                            <span>Insight: {report.hyberveesInsightArtifactPath}</span>
                          ) : null}
                        </div>
                        <div className={reportStyles.adminTesterReportReviewActions}>
                          <button
                            type="button"
                            className="ghost-btn mini"
                            disabled={hyberveesReviewed || isSavingReview}
                            onClick={() => onMarkHyberveesReviewed(report.id)}
                          >
                            {isSavingReview ? "Saving..." : "Mark Hybervees reviewed"}
                          </button>
                          {report.hyberveesInsightSummary ? (
                            <span className="tiny subdued">{report.hyberveesInsightSummary}</span>
                          ) : null}
                          {hyberveesReviewError ? (
                            <span className={reportStyles.adminTesterReportReviewError}>
                              {hyberveesReviewError}
                            </span>
                          ) : null}
                        </div>
                        <div className={reportStyles.adminTesterReportPanels}>
                          <article className={reportStyles.adminTesterReportPanel}>
                            <button
                              type="button"
                              className={reportStyles.adminTesterReportDisclosure}
                              aria-expanded={personaExpanded}
                              onClick={() => toggleReport(personaKey)}
                            >
                              <span>Persona report</span>
                              <strong>{report.personaReportTitle}</strong>
                            </button>
                            {personaExpanded ? (
                              <AdminTesterReportMarkdown body={report.personaReportBody} />
                            ) : null}
                          </article>
                          <article className={reportStyles.adminTesterReportPanel}>
                            <button
                              type="button"
                              className={reportStyles.adminTesterReportDisclosure}
                              aria-expanded={engineeringExpanded}
                              onClick={() => toggleReport(engineeringKey)}
                            >
                              <span>Engineering handoff</span>
                              <strong>{report.engineeringReportTitle}</strong>
                            </button>
                            {engineeringExpanded ? (
                              <pre className={styles.adminPreBlock}>
                                {report.engineeringReportBody}
                              </pre>
                            ) : null}
                          </article>
                        </div>
                        {report.reportArtifactPaths.length > 0 ? (
                          <div className={reportStyles.adminTesterReportArtifacts}>
                            <strong>Artifacts</strong>
                            {report.reportArtifactPaths.map((path) => (
                              <code key={path}>{path}</code>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className={styles.errorActions}>
        <span className="tiny subdued">
          Page {testerReportsPagination.page} of {testerReportsPagination.totalPages}
        </span>
        <button
          type="button"
          className="ghost-btn mini"
          onClick={onPrevPage}
          disabled={!testerReportsPagination.hasPrevPage}
        >
          Previous
        </button>
        <button
          type="button"
          className="ghost-btn mini"
          onClick={onNextPage}
          disabled={!testerReportsPagination.hasNextPage}
        >
          Next
        </button>
      </div>
    </section>
  );
}
