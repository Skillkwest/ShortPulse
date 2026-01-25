/**
 * Admin dashboard (initial read-only slice).
 * Surfaces overview metrics, recent generation errors, and user/credit snapshots for operators.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { CloudSlash, ShieldCheck, UserCircle, WarningCircle } from "phosphor-react";
import { useProtectedRoute } from "../../lib/authGuard";
import { useCredits } from "../../features/ai-studio/hooks/useCredits";
import styles from "../../styles/admin.module.css";

export default function AdminDashboardPage() {
  const { loading, user } = useProtectedRoute(true);
  const { balanceCents, balanceLoading } = useCredits();
  const [activeTab, setActiveTab] = useState<"overview" | "errors">("overview");
  const [userSearch, setUserSearch] = useState("");

  const overview = useMemo(
    () => ({
      activeUsers: 1, // current admin session
      openIssues: 0,
      nanoBananaIncidents: 0,
    }),
    [],
  );

  const users = useMemo(
    () => [
      {
        id: user?.id ?? "self",
        email: user?.email ?? "Supabase user",
        credits: balanceCents,
        recentRuns: null,
        failures: null,
        status: "active" as const,
      },
    ],
    [balanceCents, user?.email, user?.id],
  );

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((row) => row.email.toLowerCase().includes(query));
  }, [userSearch, users]);

  if (loading) {
    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <p className="subdued">Checking your session…</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>ShortPulse · Admin</title>
        <meta name="description" content="Admin dashboard for monitoring users, credits, and errors." />
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <header className={styles.adminHeader}>
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1 className={styles.adminTitle}>Operations overview</h1>
            <p className="tiny subdued">Monitor credits, model health, and generation failures across AI Studio.</p>
          </div>
          <div className={styles.adminUserPill}>
            <ShieldCheck size={18} weight="fill" />
            <span>{user?.email ?? "Admin"}</span>
          </div>
        </header>

        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "overview" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "errors" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("errors")}
          >
            Errors
          </button>
        </div>

        {activeTab === "overview" ? (
          <>
            <section className={styles.adminGrid}>
              <div className={styles.adminCard}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Active users</span>
                  <UserCircle size={18} />
                </div>
                <p className={styles.adminMetric}>{overview.activeUsers}</p>
                <p className={styles.adminSubtext}>Current signed-in admin</p>
              </div>

              <div className={`${styles.adminCard} ${styles.alert}`}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Open failures</span>
                  <CloudSlash size={18} />
                </div>
                <p className={styles.adminMetric}>{overview.openIssues}</p>
                <p className={styles.adminSubtext}>Wire to error feed backend</p>
              </div>

              <div className={`${styles.adminCard} ${styles.warning}`}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Error feed wiring</span>
                </div>
                <p className={styles.adminMetric}>Pending</p>
                <p className={styles.adminSubtext}>Connect the backend error stream next</p>
              </div>
            </section>

            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Recent errors</p>
                  <p className="tiny subdued">Wire this to the backend error log stream.</p>
                </div>
                <Link href="/ai-studio" className="ghost-btn mini">
                  Go to AI Studio
                </Link>
              </div>
              <div className={styles.adminTable}>
                <div className={styles.adminTableHead}>
                  <span>ID</span>
                  <span>Model</span>
                  <span>User</span>
                  <span>Error</span>
                  <span>When</span>
                </div>
                <div className={styles.adminTableRow}>
                  <span className="subdued">—</span>
                  <span className="subdued">Connect to backend</span>
                  <span className="subdued">Supabase user</span>
                  <span className="subdued">No errors yet</span>
                  <span className="subdued">—</span>
                </div>
              </div>
            </section>

            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Users & credits</p>
                  <p className="tiny subdued">Live data will come from Supabase users and credits ledger.</p>
                </div>
                <button type="button" className="ghost-btn mini" disabled>
                  Add credit (coming soon)
                </button>
              </div>
              <div className={styles.searchRow}>
                <label htmlFor="user-search" className="tiny subdued">
                  Search users
                </label>
                <input
                  id="user-search"
                  className={styles.searchInput}
                  type="search"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search by email"
                />
              </div>
              <div className={styles.adminTable}>
                <div className={styles.adminTableHead}>
                  <span>User</span>
                  <span>Credits</span>
                  <span>Recent runs</span>
                  <span>Failures</span>
                  <span>Status</span>
                </div>
                {filteredUsers.length === 0 ? (
                  <div className={styles.adminTableRow}>
                    <span className="subdued">No users match.</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className="subdued">—</span>
                    <span className={`${styles.pill} ${styles.pillWarn}`}>none</span>
                  </div>
                ) : (
                  filteredUsers.map((row) => (
                    <div key={row.id} className={styles.adminTableRow}>
                      <span>{row.email}</span>
                      <span className="mono">
                        {balanceLoading ? "…" : row.credits != null ? row.credits.toLocaleString() : "—"}
                      </span>
                      <span className="subdued">{row.recentRuns ?? "—"}</span>
                      <span className="subdued">{row.failures ?? "—"}</span>
                      <span className={`${styles.pill} ${styles.pillOk}`}>{row.status}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <section className={styles.adminSection}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">Errors</p>
                <p className="tiny subdued">View all logged errors once the backend stream is connected.</p>
              </div>
              <button type="button" className="ghost-btn mini" disabled>
                Export (soon)
              </button>
            </div>
            <div className={styles.adminTable}>
              <div className={styles.adminTableHead}>
                <span>ID</span>
                <span>Model</span>
                <span>User</span>
                <span>Error</span>
                <span>When</span>
              </div>
              <div className={`${styles.adminTableRow} ${styles.severityMedium}`}>
                <WarningCircle size={16} />
                <span className="subdued">Connect to backend</span>
                <span className="subdued">—</span>
                <span className="subdued">Awaiting error log feed</span>
                <span className="subdued">—</span>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
