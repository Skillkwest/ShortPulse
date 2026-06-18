/**
 * Dashboard modal portal host.
 * Keeps dashboard overlays mounted at document body so section containment and transforms cannot reframe fixed backdrops.
 */
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

type DashboardModalPortalProps = {
  children: ReactNode;
};

let dashboardModalLockCount = 0;

const updateDashboardModalLock = (isLocked: boolean) => {
  document.documentElement.classList.toggle("dashboard-modal-open", isLocked);
  document.body.classList.toggle("dashboard-modal-open", isLocked);
};

/**
 * Renders dashboard modal content into the document body and locks background scroll while open.
 */
export function DashboardModalPortal({ children }: DashboardModalPortalProps) {
  useEffect(() => {
    dashboardModalLockCount += 1;
    updateDashboardModalLock(true);

    return () => {
      dashboardModalLockCount = Math.max(0, dashboardModalLockCount - 1);
      if (dashboardModalLockCount === 0) {
        updateDashboardModalLock(false);
      }
    };
  }, []);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
