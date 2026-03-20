/**
 * Admin fleet user-health diagnostics page.
 * Provides triage-first scan summaries and per-user drill-down links.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "phosphor-react";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import type { AdminHealthFinding, AdminUserHealthFleetResponse } from "../../features/admin/types";
import { useProtectedRoute } from "../../lib/authGuard";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import styles from "../../styles/admin.module.css";

const formatNumber = (value: number): string => value.toLocaleString();
const formatSignedNumber = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toLocaleString()}`;

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString();
};

const severityClassName = (severity: AdminHealthFinding["severity"]): string => {
  if (severity === "critical") return styles.pillCritical;
  if (severity === "warning") return styles.pillWarn;
  return styles.pillOk;
};

export default function AdminUserHealthFleetPage() {
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: hasAdminAccess,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({ enabled: Boolean(user) });

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"all" | "critical" | "warning" | "info">("all");
  const [riskBand, setRiskBand] = useState<"all" | "low" | "medium" | "high">("all");
  const [findingCode, setFindingCode] = useState("");
  const [page, setPage] = useState(1);

  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AdminUserHealthFleetResponse | null>(null);

  useEffect(() => {
    if (!hasAdminAccess) return;

    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoadingReport(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("perPage", "50");
        if (severity !== "all") params.set("severity", severity);
        if (riskBand !== "all") params.set("riskBand", riskBand);
        if (search.trim()) params.set("search", search.trim());
        if (findingCode.trim()) params.set("findingCode", findingCode.trim());

        const response = await fetchWithAuth(`/api/admin/user-health-fleet?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as
          | AdminUserHealthFleetResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            payload && "error" in payload
              ? payload.error || "Failed to load fleet health report."
              : "Failed to load fleet health report."
          );
        }

        if (cancelled) return;
        setReport(payload as AdminUserHealthFleetResponse);
      } catch (loadError) {
        if (cancelled) return;
        if ((loadError as Error).name === "AbortError") return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load fleet health report."
        );
      } finally {
        if (!cancelled) {
          setLoadingReport(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasAdminAccess, page, severity, riskBand, search, findingCode]);

  const runStatusClass = useMemo(() => {
    if (!report?.run) return styles.pillWarn;
    if (report.run.status === "completed") return styles.pillOk;
    if (report.run.status === "partial") return styles.pillWarn;
    if (report.run.status === "running") return styles.pillConfidenceMedium;
    return styles.pillCritical;
  }, [report?.run]);

  const drainageCardClass = useMemo(() => {
    if (!report?.run?.drainage.enabled) return styles.pillConfidenceMedium;
    if (report.run.drainage.errors > 0) return styles.pillCritical;
    if (report.run.drainage.released > 0) return styles.pillOk;
    return styles.pillWarn;
  }, [report?.run?.drainage]);

  if (loading || isAdminAccessLoading) {
    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <section className={styles.adminSection}>
          <p className="eyebrow">Admin</p>
          <h1 className={styles.adminTitle}>Verifying access...</h1>
        </section>
      </main>
    );
  }

  if (!hasAdminAccess) {
    if (adminAccessStatus === "error") {
      return (
        <main className={`page page-wide ${styles.adminPage}`}>
          <section className={styles.adminSection}>
            <p className="eyebrow">Admin</p>
            <h1 className={styles.adminTitle}>Unable to verify access</h1>
            <p className="tiny subdued">
              {adminAccessError ?? "We could not verify admin access right now. Retry in a moment."}
            </p>
            <div className={styles.searchRow}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={refreshAdminAccess}
                disabled={isAdminAccessLoading}
              >
                {isAdminAccessLoading ? "Retrying..." : "Retry access check"}
              </button>
              <Link href="/dashboard" className="ghost-btn mini">
                Back to dashboard
              </Link>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <section className={styles.adminSection}>
          <p className="eyebrow">Admin</p>
          <h1 className={styles.adminTitle}>Access restricted</h1>
          <p className="tiny subdued">This page is available to operator accounts only.</p>
          <Link href="/dashboard" className="ghost-btn mini">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>ShortPulse · Admin Fleet Health</title>
        <meta
          name="description"
          content="Fleet-level generation and drainage diagnostics for active users."
        />
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <header className={styles.adminHeader}>
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1 className={styles.adminTitle}>Fleet health diagnostics</h1>
            <p className="tiny subdued">
              Hourly triage for active users with drill-down to per-user health and traces.
            </p>
          </div>
          <div className={styles.adminUserPill}>
            <ShieldCheck size={18} weight="fill" />
            <span>{user?.email ?? "Admin"}</span>
          </div>
        </header>

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <h2 className={styles.adminSectionTitle}>Filters</h2>
            <div className={styles.tabRow}>
              <Link href="/admin" className="ghost-btn mini">
                Back to operations
              </Link>
              <Link href="/admin/user-health" className="ghost-btn mini">
                User health
              </Link>
              <Link href="/admin/generation-trace" className="ghost-btn mini">
                Generation trace
              </Link>
            </div>
          </div>

          <div className={styles.healthFormGrid}>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Search user</span>
              <input
                className={styles.searchInput}
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="email or user id"
                autoComplete="off"
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Severity</span>
              <select
                className={styles.searchInput}
                value={severity}
                onChange={(event) => {
                  setPage(1);
                  setSeverity(event.target.value as "all" | "critical" | "warning" | "info");
                }}
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Risk band</span>
              <select
                className={styles.searchInput}
                value={riskBand}
                onChange={(event) => {
                  setPage(1);
                  setRiskBand(event.target.value as "all" | "low" | "medium" | "high");
                }}
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Finding code</span>
              <input
                className={styles.searchInput}
                value={findingCode}
                onChange={(event) => {
                  setPage(1);
                  setFindingCode(event.target.value);
                }}
                placeholder="e.g. STUCK_GENERATIONS"
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        {report?.run ? (
          <section className={styles.adminGrid}>
            <div className={styles.adminCard}>
              <div className={styles.adminCardTop}>
                <span className={styles.adminLabel}>Run status</span>
              </div>
              <p className={styles.adminMetric}>{report.run.status}</p>
              <p className={styles.adminSubtext}>
                <span className={`${styles.pill} ${runStatusClass}`}>status</span> started{" "}
                {formatDateTime(report.run.startedAt)}
              </p>
            </div>
            <div className={styles.adminCard}>
              <div className={styles.adminCardTop}>
                <span className={styles.adminLabel}>Users scanned</span>
              </div>
              <p className={styles.adminMetric}>
                {formatNumber(report.run.processedCount)} / {formatNumber(report.run.targetCount)}
              </p>
              <p className={styles.adminSubtext}>failed {formatNumber(report.run.failedCount)}</p>
            </div>
            <div className={`${styles.adminCard} ${styles.alert}`}>
              <div className={styles.adminCardTop}>
                <span className={styles.adminLabel}>Critical users</span>
              </div>
              <p className={styles.adminMetric}>{formatNumber(report.summary.criticalCount)}</p>
              <p className={styles.adminSubtext}>
                high risk {formatNumber(report.summary.highRiskCount)}
              </p>
            </div>
            <div className={`${styles.adminCard} ${styles.warning}`}>
              <div className={styles.adminCardTop}>
                <span className={styles.adminLabel}>Cost without success</span>
              </div>
              <p className={styles.adminMetric}>
                {formatNumber(report.summary.totalCostWithoutSuccessCents)}
              </p>
              <p className={styles.adminSubtext}>
                stuck {formatNumber(report.summary.totalStuckGenerations)} · exhausted{" "}
                {formatNumber(report.summary.totalExhaustedQueueRows)}
              </p>
            </div>
            <div className={styles.adminCard}>
              <div className={styles.adminCardTop}>
                <span className={styles.adminLabel}>Drainage</span>
              </div>
              <p className={styles.adminMetric}>
                {report.run.drainage.enabled
                  ? `${formatNumber(report.run.drainage.released)} released`
                  : "disabled"}
              </p>
              <p className={styles.adminSubtext}>
                <span className={`${styles.pill} ${drainageCardClass}`}>
                  {report.run.drainage.enabled ? "enabled" : "off"}
                </span>{" "}
                scanned {formatNumber(report.run.drainage.scanned)} · errors{" "}
                {formatNumber(report.run.drainage.errors)}
                {report.run.drainageTrend.previousRunId ? (
                  <>
                    {" "}
                    · Δ released {formatSignedNumber(report.run.drainageTrend.releasedDelta ?? 0)} ·
                    Δ errors {formatSignedNumber(report.run.drainageTrend.errorsDelta ?? 0)}
                  </>
                ) : null}
              </p>
            </div>
          </section>
        ) : null}

        {report?.health.degraded ? (
          <section className={styles.adminSection}>
            <p className={styles.announcementError}>
              {report.health.reason ?? "Fleet report is degraded."}
            </p>
          </section>
        ) : null}

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <h2 className={styles.adminSectionTitle}>Snapshots</h2>
            <span className="tiny subdued">
              {loadingReport ? "Loading..." : `Rows ${report?.pagination.totalCount ?? 0}`}
            </span>
          </div>

          {error ? <p className={styles.announcementError}>{error}</p> : null}

          <div className={styles.fleetTable}>
            <div className={styles.fleetHead}>
              <span>User</span>
              <span>Severity</span>
              <span>Risk</span>
              <span>24h fail</span>
              <span>Stuck/Queue</span>
              <span>Cost leakage</span>
              <span>Findings</span>
              <span>Actions</span>
            </div>

            {report?.snapshots.length ? (
              report.snapshots.map((snapshot) => {
                const lookup = snapshot.userEmail || snapshot.userId;
                const findingCodes = snapshot.findings
                  .map((finding) => finding.code)
                  .slice(0, 3)
                  .join(", ");

                return (
                  <div key={snapshot.id} className={styles.fleetRow}>
                    <span>
                      <strong>{snapshot.userEmail ?? "No email"}</strong>
                      <br />
                      <span className="mono tiny subdued">{snapshot.userId}</span>
                    </span>
                    <span>
                      <span
                        className={`${styles.pill} ${severityClassName(snapshot.highestSeverity)}`}
                      >
                        {snapshot.highestSeverity}
                      </span>
                    </span>
                    <span>
                      {snapshot.riskScore} ({snapshot.riskBand})
                    </span>
                    <span>
                      {snapshot.failRate24hPercent.toFixed(2)}% ({snapshot.failCount24h}/
                      {snapshot.totalCount24h})
                    </span>
                    <span>
                      stuck {snapshot.stuckGenerationsCount} · exhausted{" "}
                      {snapshot.exhaustedQueueCount}
                    </span>
                    <span>
                      total {formatNumber(snapshot.costWithoutSuccessCents)}
                      <br />
                      <span className="tiny subdued">
                        linked {formatNumber(snapshot.costWithoutSuccessLinkedCents)} · missing{" "}
                        {formatNumber(snapshot.costWithoutSuccessMissingLinkageCents)}
                      </span>
                    </span>
                    <span title={snapshot.findings.map((finding) => finding.code).join(", ")}>
                      {findingCodes || "-"}
                    </span>
                    <span className={styles.fleetActionCell}>
                      <Link
                        href={`/admin/user-health?lookup=${encodeURIComponent(lookup)}`}
                        className="ghost-btn mini"
                      >
                        User report
                      </Link>
                      <Link href="/admin/generation-trace" className="ghost-btn mini">
                        Trace
                      </Link>
                    </span>
                  </div>
                );
              })
            ) : (
              <div className={styles.fleetEmpty}>No snapshots match the current filters.</div>
            )}
          </div>

          <div className={styles.searchRow}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!report?.pagination.hasPrevPage || loadingReport}
            >
              Previous
            </button>
            <span className="tiny subdued">
              Page {report?.pagination.page ?? 1} / {report?.pagination.totalPages ?? 1}
            </span>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => setPage((current) => current + 1)}
              disabled={!report?.pagination.hasNextPage || loadingReport}
            >
              Next
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
