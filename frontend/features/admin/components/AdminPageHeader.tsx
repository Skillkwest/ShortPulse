/**
 * Shared admin page header.
 * Renders the route title, operator identity, and route-level navigation.
 */
import Link from "next/link";
import { ShieldCheck } from "phosphor-react";
import styles from "../../../styles/admin.module.css";

const ADMIN_NAV_ITEMS = [
  { href: "/admin/announcements", label: "Dashboard" },
  { href: "/admin/agent-instructions", label: "Agent Instructions" },
  { href: "/admin/pricing", label: "Model Pricing" },
  { href: "/admin/catalog", label: "Product Catalog" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin", label: "Customer Support" },
  { href: "/admin/stats", label: "Analytics" },
  { href: "/admin/tester-reports", label: "Tester Reports" },
  { href: "/admin/legal", label: "Legal" },
  { href: "/admin/storage", label: "Storage" },
  { href: "/admin/errors", label: "Errors" },
] as const;

const CUSTOMER_SUPPORT_NAV_ITEMS = [
  { href: "/admin", label: "Support" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/user-health", label: "User health" },
  { href: "/admin/user-health-fleet", label: "Fleet health" },
  { href: "/admin/generation-trace", label: "Generation trace" },
] as const;

const ERRORS_NAV_ITEMS = [
  { href: "/admin/errors", label: "Errors" },
  { href: "/admin/crashes", label: "Crash Logs" },
  { href: "/admin/kanban", label: "Ophestivus" },
] as const;

type AdminPageHeaderProps = {
  title: string;
  description: string;
  userEmail: string | null | undefined;
  currentPath: string;
  renderBareNav?: boolean;
};

/**
 * Provides consistent route-level chrome across admin operator pages.
 */
export function AdminPageHeader({
  title,
  description,
  userEmail,
  currentPath,
  renderBareNav = false,
}: AdminPageHeaderProps) {
  const isCustomerSupportPath = CUSTOMER_SUPPORT_NAV_ITEMS.some(
    (item) => item.href === currentPath
  );
  const isErrorsPath = ERRORS_NAV_ITEMS.some((item) => item.href === currentPath);
  const activeSubNav = isCustomerSupportPath
    ? {
        label: "Customer Support",
        ariaLabel: "Customer support pages",
        items: CUSTOMER_SUPPORT_NAV_ITEMS,
      }
    : isErrorsPath
      ? {
          label: "Errors",
          ariaLabel: "Error management pages",
          items: ERRORS_NAV_ITEMS,
        }
      : null;

  const navContent = (
    <>
      <p className={styles.adminNavLabel}>Jump to</p>
      <nav
        className={`${styles.adminNavRow} ${renderBareNav ? styles.adminNavRowBare : ""}`}
        aria-label="Admin pages"
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const active =
            item.href === currentPath ||
            (item.href === "/admin" && isCustomerSupportPath) ||
            (item.href === "/admin/errors" && isErrorsPath);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${styles.adminNavLink} ${active ? styles.adminNavLinkActive : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {activeSubNav ? (
        <div className={styles.adminSubNavShell}>
          <p className={styles.adminNavLabel}>{activeSubNav.label}</p>
          <nav
            className={`${styles.adminNavRow} ${styles.adminSubNavRow}`}
            aria-label={activeSubNav.ariaLabel}
          >
            {activeSubNav.items.map((item) => {
              const active = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${styles.adminNavLink} ${active ? styles.adminNavLinkActive : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <header className={styles.adminHeader}>
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className={styles.adminTitle}>{title}</h1>
          <p className="tiny subdued">{description}</p>
        </div>
        <div className={styles.adminUserPill}>
          <ShieldCheck size={18} weight="fill" />
          <span>{userEmail ?? "Admin"}</span>
        </div>
      </header>

      {renderBareNav ? navContent : <div className={styles.adminNavShell}>{navContent}</div>}
    </>
  );
}
