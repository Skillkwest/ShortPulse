/**
 * Operator log for tester-agent run reports.
 */
import { useState } from "react";
import type { TesterReportStatus } from "../../../lib/testerReports";
import type { AdminPagination, AdminTesterReportRunRow, AdminTesterReportSummary } from "../types";
import styles from "../../../styles/admin.module.css";

type AdminTesterReportsPanelProps = {
  testerReports: AdminTesterReportRunRow[];
  testerReportsLoading: boolean;
  testerReportsError: string | null;
  testerReportSummary: AdminTesterReportSummary;
  testerReportsPagination: AdminPagination;
  testerReportStatusFilter: "all" | TesterReportStatus;
  testerReportTesterFilter: string;
  testerReportSearch: string;
  onTesterReportStatusFilterChange: (value: "all" | TesterReportStatus) => void;
  onTesterReportTesterFilterChange: (value: string) => void;
  onTesterReportSearchChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
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
  if (status === "blocked") return styles.testerReportStatusBlocked;
  if (status === "failed") return styles.testerReportStatusFailed;
  if (status === "partial") return styles.testerReportStatusPartial;
  return styles.testerReportStatusCompleted;
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
  testerReportSummary,
  testerReportsPagination,
  testerReportStatusFilter,
  testerReportTesterFilter,
  testerReportSearch,
  onTesterReportStatusFilterChange,
  onTesterReportTesterFilterChange,
  onTesterReportSearchChange,
  onPrevPage,
  onNextPage,
  onRefresh,
}: AdminTesterReportsPanelProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedReportKeys, setExpandedReportKeys] = useState<Set<string>>(new Set());
  const hasActiveFilters =
    testerReportStatusFilter !== "all" ||
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
          <p className={styles.adminSectionEyebrow}>Tester Reports</p>
          <h2 className={styles.adminSectionTitle}>Automated run log</h2>
        </div>
        <div className={styles.adminReportsHeaderActions}>
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

      <div className={styles.adminReportsSummaryStrip} aria-label="Tester report status filters">
        {countFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-label={`${filter.label} tester reports: ${filter.count}`}
            className={[
              styles.adminReportsStatButton,
              testerReportStatusFilter === filter.value ? styles.adminReportsStatButtonActive : "",
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

      <div className={styles.adminReportsToolbar}>
        <label className={styles.reportFilterField}>
          <span className="tiny subdued">Search tester reports</span>
          <input
            className={styles.searchInput}
            value={testerReportSearch}
            onChange={(event) => onTesterReportSearchChange(event.target.value)}
            placeholder="Run id, tester, account, scenario, or surface"
          />
        </label>
        <label className={styles.reportFilterField}>
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
              onTesterReportTesterFilterChange("");
              onTesterReportSearchChange("");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className={styles.adminTableShell}>
        <div className={styles.adminReportsTableMeta}>
          <div className={styles.adminReportsTableMetaBlock}>
            <strong>{showingLabel}</strong>
          </div>
          <div className={styles.adminReportsTableMetaBlock}>
            <strong>
              {testerReportStatusFilter === "all"
                ? "All statuses"
                : statusLabel(testerReportStatusFilter)}
            </strong>
          </div>
        </div>
        <div className={styles.adminTableScroller}>
          <div className={styles.adminTable}>
            <div className={styles.adminTesterReportsHead}>
              <span>Run</span>
              <span>Status</span>
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
                className={`${styles.adminTableRow} ${styles.adminTableEmptyRow} ${styles.adminReportsEmptyState}`}
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
                return (
                  <div key={report.id} className={styles.adminTesterReportGroup}>
                    <button
                      type="button"
                      className={[
                        styles.adminTableRow,
                        styles.adminTableRowButton,
                        styles.adminTesterReportsRow,
                        expanded ? styles.adminTableRowActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-expanded={expanded}
                      onClick={() => setExpandedRunId(expanded ? null : report.id)}
                    >
                      <span className={styles.reportIdentityCell}>
                        <strong>{formatDateTime(report.createdAt)}</strong>
                        <span className="tiny subdued">{report.externalRunId}</span>
                      </span>
                      <span>
                        <span
                          className={[styles.reportStatusPill, statusClassName(report.status)].join(
                            " "
                          )}
                        >
                          {statusLabel(report.status)}
                        </span>
                      </span>
                      <span className={styles.reportIdentityCell}>
                        <strong>{report.testerDisplayName}</strong>
                        <span className="tiny subdued">{report.testerSlug}</span>
                      </span>
                      <span className={styles.reportIdentityCell}>
                        <strong>{accountLabel}</strong>
                        <span className="tiny subdued">
                          {report.shortpulseUserId ?? "No linked user id"}
                        </span>
                      </span>
                      <span className={styles.reportPreviewCell}>
                        {buildScenarioPreview(report.scenario)}
                      </span>
                    </button>

                    {expanded ? (
                      <div className={styles.adminTesterReportExpanded}>
                        <div className={styles.adminTesterReportMeta}>
                          <span>Started: {formatDateTime(report.runStartedAt)}</span>
                          <span>Finished: {formatDateTime(report.runFinishedAt)}</span>
                          <span>
                            Duration: {formatOptionalNumber(report.durationMinutes, " min")}
                          </span>
                          <span>Credits: {formatOptionalNumber(report.creditsSpent)}</span>
                          <span>Surface: {report.productionSurface ?? "Not recorded"}</span>
                        </div>
                        <div className={styles.adminTesterReportPanels}>
                          <article className={styles.adminTesterReportPanel}>
                            <button
                              type="button"
                              className={styles.adminTesterReportDisclosure}
                              aria-expanded={personaExpanded}
                              onClick={() => toggleReport(personaKey)}
                            >
                              <span>Persona report</span>
                              <strong>{report.personaReportTitle}</strong>
                            </button>
                            {personaExpanded ? (
                              <pre className={styles.adminPreBlock}>{report.personaReportBody}</pre>
                            ) : null}
                          </article>
                          <article className={styles.adminTesterReportPanel}>
                            <button
                              type="button"
                              className={styles.adminTesterReportDisclosure}
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
                          <div className={styles.adminTesterReportArtifacts}>
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
