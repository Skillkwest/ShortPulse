/**
 * Character create workspace layout.
 * Provides the stable two-region layout primitive for QuickSwap and Character Sheet content.
 */
import React from "react";

type CharacterCreateWorkspaceLayoutProps = {
  quickSwap?: React.ReactNode;
  characterSheet: React.ReactNode;
};

/**
 * Renders create-mode workspace regions in deterministic DOM order.
 */
export function CharacterCreateWorkspaceLayout({
  quickSwap,
  characterSheet,
}: CharacterCreateWorkspaceLayoutProps) {
  const hasQuickSwap = quickSwap != null;
  return (
    <div
      className={`character-create-workspace-layout ${
        hasQuickSwap ? "" : "character-create-workspace-layout--sheet-only"
      }`.trim()}
    >
      {hasQuickSwap ? (
        <div
          className="character-layout-region character-layout-region--quickswap"
          data-layout-region="quickswap"
        >
          {quickSwap}
        </div>
      ) : null}
      <div
        className="character-layout-region character-layout-region--sheet"
        data-layout-region="sheet"
      >
        {characterSheet}
      </div>
    </div>
  );
}
