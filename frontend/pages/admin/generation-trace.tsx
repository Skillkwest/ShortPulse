import Head from "next/head";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ShieldCheck } from "phosphor-react";
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
    mediaEvents: number;
    mediaFiles: number;
    reservations: number;
    ledgerEntries: number;
    errorEvents: number;
  };
  generations: Array<Record<string, unknown>>;
  mediaEvents: Array<Record<string, unknown>>;
  mediaFiles: Array<Record<string, unknown>>;
  reservations: Array<Record<string, unknown>>;
  ledgerEntries: Array<Record<string, unknown>>;
  errorEvents: Array<Record<string, unknown>>;
  warnings: string[];
};

const isAdminUser = (user: unknown): boolean => {
  const record = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const appMetadata =
    record.app_metadata && typeof record.app_metadata === "object"
      ? (record.app_metadata as Record<string, unknown>)
      : {};
  const roles = [appMetadata.role, ...(Array.isArray(appMetadata.roles) ? appMetadata.roles : [])]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return roles.includes("admin") || roles.includes("operator");
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export default function AdminGenerationTracePage() {
  const { loading, user } = useProtectedRoute(true);
  const roleBasedAdmin = isAdminUser(user);

  const [generationId, setGenerationId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [traceId, setTraceId] = useState("");
  const [result, setResult] = useState<GenerationTraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);

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
    } catch (traceError) {
      setError(traceError instanceof Error ? traceError.message : "Failed to load trace.");
      setResult(null);
    } finally {
      setLoadingTrace(false);
    }
  };

  if (loading) {
    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <section className={styles.adminSection}>
          <p className="eyebrow">Admin</p>
          <h1 className={styles.adminTitle}>Loading…</h1>
        </section>
      </main>
    );
  }

  if (!roleBasedAdmin) {
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
            <Link href="/admin" className="ghost-btn mini">
              Back to operations
            </Link>
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
            <h2 className={styles.adminSectionTitle}>Generations</h2>
            <pre className={styles.adminPreBlock}>{pretty(result.generations)}</pre>
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
