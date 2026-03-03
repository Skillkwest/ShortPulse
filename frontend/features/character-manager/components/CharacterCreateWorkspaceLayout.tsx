/**
 * Character create workspace layout.
 * Provides a stable layout contract for QuickSwap and Character Sheet regions.
 */
import React from "react";

type CharacterCreateWorkspaceLayoutProps = {
  surface: "page" | "panel";
  quickSwap: React.ReactNode;
  characterSheet: React.ReactNode;
  embeddedGuidance?: React.ReactNode;
};

/**
 * Renders create-mode workspace regions in a deterministic DOM order.
 */
export function CharacterCreateWorkspaceLayout({
  surface,
  quickSwap,
  characterSheet,
  embeddedGuidance,
}: CharacterCreateWorkspaceLayoutProps) {
  const isEmbeddedSurface = surface === "panel";

  return (
    <div className="character-create-workspace-layout" data-surface={surface}>
      <div
        className="character-layout-region character-layout-region--quickswap"
        data-layout-region="quickswap"
      >
        {quickSwap}
        {isEmbeddedSurface ? embeddedGuidance : null}
      </div>
      <div
        className="character-layout-region character-layout-region--sheet"
        data-layout-region="sheet"
      >
        {characterSheet}
      </div>
    </div>
  );
}
