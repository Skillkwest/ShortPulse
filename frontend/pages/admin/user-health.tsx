/**
 * Admin user health diagnostics page.
 * Lets operators run per-user generation and credit-drain health reports.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "phosphor-react";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import type { AdminHealthFinding, AdminUserHealthResponse } from "../../features/admin/types";
import { useProtectedRoute } from "../../lib/authGuard";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import styles from "../../styles/admin.module.css";

const LOOKBACK_OPTIONS = [7, 14, 30, 60, 90];

const formatNumber = (value: number): string => value.toLocaleString();

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString();
};

const topStatusEntries = (statusMap: Record<string, number>): string => {
  const pairs = Object.entries(statusMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  if (!pairs.length) return "—";
  return pairs.map(([status, count]) => `${status}: ${count}`).join(" · ");
};

const severityClassName = (finding: AdminHealthFinding): string => {
  if (finding.severity === "critical") return styles.pillCritical;
  if (finding.severity === "warning") return styles.pillWarn;
  return styles.pillOk;
};

const confidenceClassName = (finding: AdminHealthFinding): string => {
  if (finding.confidence === "high") return styles.pillConfidenceHigh;
  if (finding.confidence === "medium") return styles.pillConfidenceMedium;
  return styles.pillConfidenceLow;
};

export default function AdminUserHealthPage() {
  const router = useRouter();
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: hasAdminAccess,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({ enabled: Boolean(user) });

  const [lookup, setLookup] = useState("");
  const [lookupMode, setLookupMode] = useState<"auto" | "email" | "user_id">("auto");
  const [lookbackDays, setLookbackDays] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminUserHealthResponse | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const queryLookup = typeof router.query.lookup === "string" ? router.query.lookup.trim() : "";
    const queryLookupMode =
      typeof router.query.lookupMode === "string" ? router.query.lookupMode : "";
    const queryLookbackDays =
      typeof router.query.lookbackDays === "string"
        ? Number(router.query.lookbackDays)
        : Number.NaN;

    if (queryLookup) {
      setLookup(queryLookup);
    }
    if (
      queryLookupMode === "auto" ||
      queryLookupMode === "email" ||
      queryLookupMode === "user_id"
    ) {
      setLookupMode(queryLookupMode);
    }
    if (
      Number.isFinite(queryLookbackDays) &&
      LOOKBACK_OPTIONS.includes(Number(queryLookbackDays))
    ) {
      setLookbackDays(Number(queryLookbackDays));
    }
  }, [router.isReady, router.query.lookup, router.query.lookupMode, router.query.lookbackDays]);

  const runHealthCheck = async (event: FormEvent) => {
    event.preventDefault();
    if (!lookup.trim()) {
      setError("Enter a user email or user id.");
      return;
    }

    setIsRunning(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/admin/user-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookup: lookup.trim(),
          lookupMode,
          lookbackDays,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | AdminUserHealthResponse
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          payload && "error" in payload
            ? payload.error || "Failed to run user health check."
            : "Failed to run user health check."
        );
      }
      setResult(payload as AdminUserHealthResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to run user health check."
      );
      setResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  const headline = useMemo(() => {
    if (!result) return null;
    return {
      spendable: result.credits.spendableCents,
      failRate24h: result.generations.last24h.failRatePercent,
      stuckCount: result.generations.stuckOver1hCount,
      costWithoutSuccess: result.drainage.costWithoutSuccessfulGeneration.debitCents,
    };
  }, [result]);

  if (loading || isAdminAccessLoading) {
    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <section className={styles.adminSection}>
          <p className="eyebrow">Admin</p>
          <h1 className={styles.adminTitle}>Verifying access…</h1>
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
                {isAdminAccessLoading ? "Retrying…" : "Retry access check"}
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
        <title>ShortPulse · Admin User Health</title>
        <meta
          name="description"
          content="Operator diagnostics for user-level generation and credit health."
        />
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <header className={styles.adminHeader}>
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1 className={styles.adminTitle}>User health diagnostics</h1>
            <p className="tiny subdued">
              Search by user id or email and run a generation + drainage health check.
            </p>
          </div>
          <div className={styles.adminUserPill}>
            <ShieldCheck size={18} weight="fill" />
            <span>{user?.email ?? "Admin"}</span>
          </div>
        </header>

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <h2 className={styles.adminSectionTitle}>Run report</h2>
            <div className={styles.tabRow}>
              <Link href="/admin" className="ghost-btn mini">
                Back to operations
              </Link>
              <Link href="/admin/user-health-fleet" className="ghost-btn mini">
                Fleet health
              </Link>
              <Link href="/admin/generation-trace" className="ghost-btn mini">
                Generation trace
              </Link>
            </div>
          </div>

          <form onSubmit={runHealthCheck} className={styles.healthFormGrid}>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Lookup</span>
              <input
                className={styles.searchInput}
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
                placeholder="user@email.com or user uuid"
                autoComplete="off"
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Lookup mode</span>
              <select
                className={styles.searchInput}
                value={lookupMode}
                onChange={(event) =>
                  setLookupMode(event.target.value as "auto" | "email" | "user_id")
                }
              >
                <option value="auto">Auto</option>
                <option value="email">Email</option>
                <option value="user_id">User ID</option>
              </select>
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Lookback window</span>
              <select
                className={styles.searchInput}
                value={lookbackDays}
                onChange={(event) => setLookbackDays(Number(event.target.value))}
              >
                {LOOKBACK_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    Last {days} days
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.manualAdjustActions}>
              <button type="submit" className="primary-btn" disabled={isRunning}>
                {isRunning ? "Running..." : "Run health check"}
              </button>
            </div>
          </form>

          {error ? <p className={styles.announcementError}>{error}</p> : null}
        </section>

        {result ? (
          <>
            <section className={styles.adminGrid}>
              <div className={styles.adminCard}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Spendable credits</span>
                </div>
                <p className={styles.adminMetric}>{formatNumber(headline?.spendable ?? 0)}</p>
                <p className={styles.adminSubtext}>as of {formatDateTime(result.generatedAt)}</p>
              </div>
              <div className={`${styles.adminCard} ${styles.warning}`}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>24h fail rate</span>
                </div>
                <p className={styles.adminMetric}>{headline?.failRate24h.toFixed(2)}%</p>
                <p className={styles.adminSubtext}>
                  {result.generations.last24h.fail} / {result.generations.last24h.total} runs failed
                </p>
              </div>
              <div className={`${styles.adminCard} ${styles.alert}`}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Stuck generations</span>
                </div>
                <p className={styles.adminMetric}>{formatNumber(headline?.stuckCount ?? 0)}</p>
                <p className={styles.adminSubtext}>older than 1h in queued/recovering</p>
              </div>
              <div className={styles.adminCard}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Cost without success</span>
                </div>
                <p className={styles.adminMetric}>
                  {formatNumber(headline?.costWithoutSuccess ?? 0)}
                </p>
                <p className={styles.adminSubtext}>lookback debits without linked success rows</p>
                <p className={styles.adminSubtext}>
                  linked non-success{" "}
                  {formatNumber(
                    result.drainage.costWithoutSuccessfulGeneration.linkedNonSuccessGeneration
                      .debitCents
                  )}{" "}
                  · missing linkage{" "}
                  {formatNumber(
                    result.drainage.costWithoutSuccessfulGeneration.missingLinkageData.debitCents
                  )}
                </p>
              </div>
            </section>

            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Target</p>
                  <p className="tiny subdued">
                    {result.target.email ?? "No email"} · {result.target.userId}
                  </p>
                </div>
                <span className="tiny subdued">
                  User created {formatDateTime(result.target.createdAt)} · Last sign-in{" "}
                  {formatDateTime(result.target.lastSignInAt)}
                </span>
              </div>

              <div className={styles.adminTable}>
                <div className={styles.adminTableHead}>
                  <span>Category</span>
                  <span>Value</span>
                  <span>Category</span>
                  <span>Value</span>
                  <span>Category</span>
                </div>
                <div className={styles.adminTableRow}>
                  <span>Credits</span>
                  <span>
                    spendable {formatNumber(result.credits.spendableCents)} · available{" "}
                    {formatNumber(result.credits.availableCents)} · reserved{" "}
                    {formatNumber(result.credits.reservedCents)}
                  </span>
                  <span>Generation status mix</span>
                  <span>{topStatusEntries(result.generations.byStatus)}</span>
                  <span>
                    Queue states: {topStatusEntries(result.queue.byStatus)} · Exhausted{" "}
                    {result.queue.exhaustedCount}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <h2 className={styles.adminSectionTitle}>Findings</h2>
                <span className="tiny subdued">Lookback: {result.lookbackDays}d</span>
              </div>
              <div className={styles.healthFindingList}>
                {result.findings.map((finding) => (
                  <article key={finding.code} className={styles.healthFindingCard}>
                    <div className={styles.healthFindingMetaRow}>
                      <span className={`${styles.pill} ${severityClassName(finding)}`}>
                        {finding.severity}
                      </span>
                      <span className={`${styles.pill} ${confidenceClassName(finding)}`}>
                        confidence {finding.confidence}
                      </span>
                      <span className="mono tiny subdued">{finding.code}</span>
                    </div>
                    <p className={styles.healthFindingSummary}>{finding.summary}</p>
                    <p className="tiny subdued">{finding.details}</p>
                    {finding.recommendedActions.length ? (
                      <ul className={styles.healthActionList}>
                        {finding.recommendedActions.map((action) => (
                          <li key={`${finding.code}-${action}`}>{action}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.adminSection}>
              <h2 className={styles.adminSectionTitle}>Cost and runtime details</h2>
              <pre className={styles.adminPreBlock}>
                {JSON.stringify(result.drainage.windows, null, 2)}
              </pre>
              <pre className={styles.adminPreBlock}>
                {JSON.stringify(
                  {
                    topDebitSources: result.drainage.topDebitSources,
                    topDebitSourcesLookbackDays: result.lookbackDays,
                    costWithoutSuccessBreakdown: result.drainage.costWithoutSuccessfulGeneration,
                    topFailReasonsLookback: result.generations.topFailReasonsLookback,
                    topCapturedModels: result.reservations.topCapturedModels,
                    recentExhaustedQueue: result.queue.recentExhaustedSample,
                    compatibilityWarnings: result.compatibility.warnings,
                    nextSteps: result.nextSteps,
                  },
                  null,
                  2
                )}
              </pre>
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
