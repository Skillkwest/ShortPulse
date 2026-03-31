import Head from "next/head";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ShieldCheck } from "phosphor-react";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import styles from "../../styles/admin.module.css";

type GenerationTraceResponse = {
  query: {
    generationId: string | null;
    requestId: string | null;
    traceId: string | null;
  };
  summary: {
    generations: number;
    attempts: number;
    outputs: number;
    mediaEvents: number;
    mediaFiles: number;
    reservations: number;
    ledgerEntries: number;
    errorEvents: number;
  };
  generations: Array<Record<string, unknown>>;
  generationAttempts: Array<Record<string, unknown>>;
  generationOutputs: Array<Record<string, unknown>>;
  mediaEvents: Array<Record<string, unknown>>;
  mediaFiles: Array<Record<string, unknown>>;
  reservations: Array<Record<string, unknown>>;
  ledgerEntries: Array<Record<string, unknown>>;
  errorEvents: Array<Record<string, unknown>>;
  warnings: string[];
};

type GenerationReplayResponse = {
  ok: boolean;
  requestId: string | null;
  generationId: string | null;
  state: "recovered" | "already_persisted" | "no_media" | "provider_running" | "provider_failed";
  mediaFileIds: string[];
  mediaUrls: string[];
  details?: string;
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export default function AdminGenerationTracePage() {
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: hasAdminAccess,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({ enabled: Boolean(user) });

  const [generationId, setGenerationId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [traceId, setTraceId] = useState("");
  const [result, setResult] = useState<GenerationTraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayResult, setReplayResult] = useState<GenerationReplayResponse | null>(null);

  const hasQuery = useMemo(
    () => Boolean(generationId.trim() || requestId.trim() || traceId.trim()),
    [generationId, requestId, traceId]
  );

  const loadTrace = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasQuery) {
      setError("Provide at least one of generationId, requestId, or traceId.");
      return;
    }

    setLoadingTrace(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (generationId.trim()) params.set("generationId", generationId.trim());
      if (requestId.trim()) params.set("requestId", requestId.trim());
      if (traceId.trim()) params.set("traceId", traceId.trim());

      const response = await fetchWithAuth(`/api/admin/generation-trace?${params.toString()}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => ({}))) as
        | GenerationTraceResponse
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          payload && "error" in payload
            ? payload.error || "Failed to load trace."
            : "Failed to load trace."
        );
      }
      setResult(payload as GenerationTraceResponse);
      setReplayResult(null);
    } catch (traceError) {
      setError(traceError instanceof Error ? traceError.message : "Failed to load trace.");
      setResult(null);
      setReplayResult(null);
    } finally {
      setLoadingTrace(false);
    }
  };

  const runReplayRecovery = async () => {
    const firstGeneration =
      result?.generations[0] &&
      typeof result.generations[0] === "object" &&
      !Array.isArray(result.generations[0])
        ? (result.generations[0] as Record<string, unknown>)
        : null;
    const firstGenerationId =
      typeof firstGeneration?.id === "string" && firstGeneration.id.trim().length
        ? firstGeneration.id.trim()
        : null;
    const firstRequestId =
      typeof firstGeneration?.request_id === "string" && firstGeneration.request_id.trim().length
        ? firstGeneration.request_id.trim()
        : null;
    const currentGenerationId =
      (result?.query.generationId && result.query.generationId.trim().length
        ? result.query.generationId.trim()
        : null) || firstGenerationId;
    const currentRequestId =
      (result?.query.requestId && result.query.requestId.trim().length
        ? result.query.requestId.trim()
        : null) || firstRequestId;

    if (!currentGenerationId && !currentRequestId) {
      setError("Replay requires a generationId or requestId in the loaded trace.");
      return;
    }

    setReplayLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/admin/generation-recovery/replay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          generationId: currentGenerationId || undefined,
          requestId: currentRequestId || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | GenerationReplayResponse
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          payload && "error" in payload
            ? payload.error || "Replay recovery failed."
            : "Replay recovery failed."
        );
      }
      setReplayResult(payload as GenerationReplayResponse);
      // Refresh timeline immediately so operator sees recovered state/materialized media.
      const refreshParams = new URLSearchParams();
      if (currentGenerationId) refreshParams.set("generationId", currentGenerationId);
      if (currentRequestId) refreshParams.set("requestId", currentRequestId);
      const refreshResponse = await fetchWithAuth(
        `/api/admin/generation-trace?${refreshParams.toString()}`,
        {
          method: "GET",
        }
      );
      const refreshPayload = (await refreshResponse
        .json()
        .catch(() => ({}))) as GenerationTraceResponse;
      if (refreshResponse.ok) {
        setResult(refreshPayload);
      }
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Replay recovery failed.");
    } finally {
      setReplayLoading(false);
    }
  };

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
        <title>ShortPulse · Admin Trace</title>
        <meta name="description" content="Operator trace view for generation request timelines." />
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <header className={styles.adminHeader}>
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1 className={styles.adminTitle}>Generation trace</h1>
            <p className="tiny subdued">
              Query generation lifecycle data by generation id, request id, or trace id.
            </p>
          </div>
          <div className={styles.adminUserPill}>
            <ShieldCheck size={18} weight="fill" />
            <span>{user?.email ?? "Admin"}</span>
          </div>
        </header>

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <h2 className={styles.adminSectionTitle}>Query</h2>
            <div className={styles.tabRow}>
              <Link href="/admin/user-health-fleet" className="ghost-btn mini">
                Fleet health
              </Link>
              <Link href="/admin/user-health" className="ghost-btn mini">
                User health
              </Link>
              <Link href="/admin" className="ghost-btn mini">
                Back to operations
              </Link>
            </div>
          </div>
          <form onSubmit={loadTrace} style={{ display: "grid", gap: 12 }}>
            <input
              value={generationId}
              onChange={(event) => setGenerationId(event.target.value)}
              placeholder="generationId (uuid)"
              className={styles.searchInput}
              autoComplete="off"
            />
            <input
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              placeholder="requestId (provider request_id)"
              className={styles.searchInput}
              autoComplete="off"
            />
            <input
              value={traceId}
              onChange={(event) => setTraceId(event.target.value)}
              placeholder="traceId (submission/generation trace)"
              className={styles.searchInput}
              autoComplete="off"
            />
            <button type="submit" className="primary-btn" disabled={loadingTrace || !hasQuery}>
              {loadingTrace ? "Loading..." : "Load trace"}
            </button>
          </form>
          {error ? (
            <p className="tiny" style={{ color: "#ff7f7f", marginTop: 10 }}>
              {error}
            </p>
          ) : null}
        </section>

        {result ? (
          <section className={styles.adminSection}>
            <h2 className={styles.adminSectionTitle}>Summary</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.summary)}</pre>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <button
                type="button"
                className="ghost-btn mini"
                disabled={replayLoading}
                onClick={runReplayRecovery}
              >
                {replayLoading ? "Replaying..." : "Replay recovery"}
              </button>
            </div>
            {replayResult ? (
              <>
                <h2 className={styles.adminSectionTitle}>Replay result</h2>
                <pre className={styles.adminPreBlock}>{pretty(replayResult)}</pre>
              </>
            ) : null}
            <h2 className={styles.adminSectionTitle}>Generations</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.generations)}</pre>
            <h2 className={styles.adminSectionTitle}>Generation Attempts</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.generationAttempts)}</pre>
            <h2 className={styles.adminSectionTitle}>Generation Outputs</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.generationOutputs)}</pre>
            <h2 className={styles.adminSectionTitle}>Reservations</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.reservations)}</pre>
            <h2 className={styles.adminSectionTitle}>Ledger</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.ledgerEntries)}</pre>
            <h2 className={styles.adminSectionTitle}>Media Events</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.mediaEvents)}</pre>
            <h2 className={styles.adminSectionTitle}>Media Files</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.mediaFiles)}</pre>
            <h2 className={styles.adminSectionTitle}>Error Events</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.errorEvents)}</pre>
            <h2 className={styles.adminSectionTitle}>Warnings</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.warnings)}</pre>
          </section>
        ) : null}
      </main>
    </>
  );
}
