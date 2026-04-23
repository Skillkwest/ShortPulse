import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminPageHeader } from "./AdminPageHeader";
import type { AdminAccessStatus } from "../logic/useAdminAccess";
import styles from "../../../styles/admin.module.css";

type AdminRouteShellProps = {
  loading: boolean;
  isAdminEnabled: boolean;
  isAdminAccessLoading: boolean;
  adminAccessStatus: AdminAccessStatus;
  adminAccessError: string | null;
  onRetryAccessCheck: () => void;
  documentTitle: string;
  metaDescription: string;
  pageTitle: string;
  pageDescription: string;
  userEmail: string | null | undefined;
  currentPath: string;
  children: ReactNode;
};

/**
 * Standardized admin route shell so every operator page shares one access gate, title system, and nav chrome.
 */
export function AdminRouteShell({
  loading,
  isAdminEnabled,
  isAdminAccessLoading,
  adminAccessStatus,
  adminAccessError,
  onRetryAccessCheck,
  documentTitle,
  metaDescription,
  pageTitle,
  pageDescription,
  userEmail,
  currentPath,
  children,
}: AdminRouteShellProps) {
  if (loading) {
    return (
      <main className={`page page-wide ${styles.adminPage}`}>
        <p className="subdued">Checking your session…</p>
      </main>
    );
  }

  if (!isAdminEnabled) {
    if (isAdminAccessLoading) {
      return (
        <main className={`page page-wide ${styles.adminPage}`}>
          <p className="subdued">Verifying admin access…</p>
        </main>
      );
    }

    if (adminAccessStatus === "error") {
      return (
        <>
          <Head>
            <title>{documentTitle}</title>
          </Head>
          <main className={`page page-wide ${styles.adminPage}`}>
            <section className={styles.adminSection}>
              <p className="eyebrow">Admin</p>
              <h1 className={styles.adminTitle}>Unable to verify access</h1>
              <p className="tiny subdued">
                {adminAccessError ??
                  "We could not verify admin access right now. Retry in a moment."}
              </p>
              <div className={styles.searchRow}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={onRetryAccessCheck}
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
        </>
      );
    }

    return (
      <>
        <Head>
          <title>{documentTitle}</title>
        </Head>
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
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{documentTitle}</title>
        <meta name="description" content={metaDescription} />
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <AdminPageHeader
          title={pageTitle}
          description={pageDescription}
          userEmail={userEmail}
          currentPath={currentPath}
        />
        {children}
      </main>
    </>
  );
}
