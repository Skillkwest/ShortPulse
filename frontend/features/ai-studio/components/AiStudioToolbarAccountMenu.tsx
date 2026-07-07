/**
 * AI Studio account menu for the left toolbar footer.
 * Provides protected account navigation, issue reporting, and sign-out without
 * forking the shared authenticated account-menu styling.
 */
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { GearSix, SignOut } from "phosphor-react";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { useCustomerSupportDialog } from "../../../components/CustomerSupportDialog";
import { normalizeIssueReportSourcePath } from "../../../lib/issueReports";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { signOutSupabaseSession } from "../../../lib/supabaseClient";
import { ACCOUNT_MENU_LINKS, CUSTOMER_SUPPORT_MENU_LINK } from "../../profile/accountMenuLinks";

type MenuStyle = React.CSSProperties & {
  "--ai-toolbar-account-menu-transform-origin"?: string;
};

const MENU_WIDTH_PX = 238;
const MENU_MARGIN_PX = 12;

const toNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const resolveDisplayName = (user: User | null | undefined): string =>
  toNonEmptyString(user?.user_metadata?.display_name) ??
  toNonEmptyString(user?.user_metadata?.full_name) ??
  toNonEmptyString(user?.email) ??
  "ShortPulse account";

const resolveInitials = (displayName: string): string =>
  displayName
    .split(" ")
    .filter((part) => part.trim().length > 0)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SP";

const resolveReportIssueHref = (asPath: string | undefined): string => {
  const sourcePath = normalizeIssueReportSourcePath(asPath) ?? "/ai-studio";
  return `/report-issue?from=${encodeURIComponent(sourcePath)}`;
};

/**
 * Renders the authenticated account/settings control anchored in the AI Studio toolbar footer.
 */
export function AiStudioToolbarAccountMenu() {
  const router = useRouter();
  const sessionSnapshot = useResolvedProtectedSessionState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [menuStyle, setMenuStyle] = useState<MenuStyle | null>(null);
  const { customerSupportDialog, openCustomerSupportDialog } = useCustomerSupportDialog();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const displayName = resolveDisplayName(sessionSnapshot.user);
  const email = sessionSnapshot.user?.email ?? null;
  const initials = resolveInitials(displayName);
  const reportIssueHref = useMemo(() => resolveReportIssueHref(router.asPath), [router.asPath]);

  const syncMenuPosition = React.useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect || typeof window === "undefined") return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxLeft = Math.max(MENU_MARGIN_PX, viewportWidth - MENU_WIDTH_PX - MENU_MARGIN_PX);
    const left = Math.min(Math.max(MENU_MARGIN_PX, triggerRect.left), maxLeft);
    const bottom = Math.max(MENU_MARGIN_PX, viewportHeight - triggerRect.top + MENU_MARGIN_PX);

    setMenuStyle({
      position: "fixed",
      left,
      bottom,
      width: MENU_WIDTH_PX,
      zIndex: 1230,
      "--ai-toolbar-account-menu-transform-origin": "bottom left",
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = triggerRef.current?.contains(target) ?? false;
      const isInsideMenu = menuRef.current?.contains(target) ?? false;
      if (!isInsideTrigger && !isInsideMenu) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    const handleViewportChange = () => {
      syncMenuPosition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [menuOpen, syncMenuPosition]);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOutSupabaseSession();
      setShowLogoutConfirm(false);
      setMenuOpen(false);
      void router.replace("/");
    } catch {
      // Best-effort sign-out only.
    }
  };

  const menu =
    menuOpen && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            className="toolbar-account-menu"
            role="menu"
            aria-label="Account settings"
            style={menuStyle}
          >
            <div className="toolbar-account-menu__identity" aria-label="Signed-in account">
              <span className="toolbar-account-menu__avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="toolbar-account-menu__identity-copy">
                <strong>{displayName}</strong>
                {email ? <span>{email}</span> : null}
              </span>
            </div>
            <div className="toolbar-account-menu__links">
              {ACCOUNT_MENU_LINKS.map((item) => (
                <Link key={item.href} href={item.href} role="menuitem" onClick={closeMenu}>
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="toolbar-account-menu__actions">
              <button
                type="button"
                role="menuitem"
                className="toolbar-account-menu__support-action"
                onClick={(event) => {
                  closeMenu();
                  openCustomerSupportDialog(event);
                }}
              >
                {CUSTOMER_SUPPORT_MENU_LINK.label}
              </button>
              <Link href={reportIssueHref} role="menuitem" onClick={closeMenu}>
                Report an issue
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setShowLogoutConfirm(true);
                }}
              >
                <SignOut size={15} weight="regular" />
                Log out
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="toolbar-account">
        <button
          ref={triggerRef}
          type="button"
          className="toolbar-account-trigger"
          aria-label="Account settings"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            if (!menuOpen) {
              syncMenuPosition();
            }
            setMenuOpen((open) => !open);
          }}
        >
          <span className="toolbar-account-trigger__avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="toolbar-account-trigger__copy">
            <span>Account</span>
            <small>Settings</small>
          </span>
          <GearSix size={16} weight="regular" aria-hidden="true" />
        </button>
      </div>
      {menu}
      {showLogoutConfirm ? (
        <ConfirmationModal
          title="Log out?"
          titleId="ai-studio-logout-title"
          body={<p>You will be signed out of ShortPulse.</p>}
          confirmLabel="Log out"
          tone="primary"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={handleSignOut}
        />
      ) : null}
      {customerSupportDialog}
    </>
  );
}
