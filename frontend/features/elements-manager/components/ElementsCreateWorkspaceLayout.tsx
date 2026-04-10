/**
 * Elements create workspace layout.
 * Preserves the stable two-region DOM order with Elements-owned workspace classes.
 */
import React from "react";

type ElementsCreateWorkspaceLayoutProps = {
  quickSwap?: React.ReactNode;
  elementSheet: React.ReactNode;
};

/**
 * Renders the Elements workspace regions in deterministic DOM order.
 */
export function ElementsCreateWorkspaceLayout({
  quickSwap,
  elementSheet,
}: ElementsCreateWorkspaceLayoutProps) {
  const hasQuickSwap = quickSwap != null;
  return (
    <div
      className={`elements-create-workspace-layout ${
        hasQuickSwap ? "" : "elements-create-workspace-layout--sheet-only"
      }`.trim()}
    >
      {hasQuickSwap ? (
        <div
          className="elements-layout-region elements-layout-region--quickswap"
          data-layout-region="quickswap"
        >
          {quickSwap}
        </div>
      ) : null}
      <div
        className="elements-layout-region elements-layout-region--sheet"
        data-layout-region="sheet"
      >
        {elementSheet}
      </div>
    </div>
  );
}
