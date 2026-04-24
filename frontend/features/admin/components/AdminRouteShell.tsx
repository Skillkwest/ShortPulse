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

type AdminShellStateProps = {
  documentTitle: string;
  pageTitle: string;
  pageDescription: string;
  stateTitle: string;
  stateDescription: string;
  actions?: ReactNode;
};

function AdminShellState({
  documentTitle,
  pageTitle,
  pageDescription,
  stateTitle,
  stateDescription,
  actions,
}: AdminShellStateProps) {
  return (
    <>
      <Head>
        <title>{documentTitle}</title>
      </Head>
      <main className={`page page-wide ${styles.adminPage}`}>
        <section className={styles.adminSection}>
          <p className="eyebrow">Admin</p>
          <h1 className={styles.adminTitle}>{pageTitle}</h1>
          <p className="tiny subdued">{pageDescription}</p>
          <div className={styles.adminStatePanel}>
            <p className={styles.adminStateEyebrow}>Workspace status</p>
            <h2 className={styles.adminStateTitle}>{stateTitle}</h2>
            <p className={styles.adminStateDescription}>{stateDescription}</p>
            {actions ? <div className={styles.adminStateActions}>{actions}</div> : null}
          </div>
        </section>
      </main>
    </>
  );
}

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
      <AdminShellState
        documentTitle={documentTitle}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        stateTitle="Checking your session"
        stateDescription="We need your authenticated session before loading this admin workspace."
      />
    );
  }

  if (!isAdminEnabled) {
    if (isAdminAccessLoading) {
      return (
        <AdminShellState
          documentTitle={documentTitle}
          pageTitle={pageTitle}
          pageDescription={pageDescription}
          stateTitle="Verifying admin access"
          stateDescription="Checking operator access before we expose admin data and controls."
        />
      );
    }

    if (adminAccessStatus === "error") {
      return (
        <AdminShellState
          documentTitle={documentTitle}
          pageTitle={pageTitle}
          pageDescription={pageDescription}
          stateTitle="Unable to verify access"
          stateDescription={
            adminAccessError ?? "We could not verify admin access right now. Retry in a moment."
          }
          actions={
            <>
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
            </>
          }
        />
      );
    }

    return (
      <AdminShellState
        documentTitle={documentTitle}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        stateTitle="Access restricted"
        stateDescription="This page is available to operator accounts only."
        actions={
          <Link href="/dashboard" className="ghost-btn mini">
            Back to dashboard
          </Link>
        }
      />
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
