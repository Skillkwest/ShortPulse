/**
 * Character create workspace layout.
 * Provides a stable layout contract for Identity, QuickSwap, and Character Sheet regions.
 */
import React from "react";

type CharacterCreateWorkspaceLayoutProps = {
  surface: "page" | "panel";
  identity: React.ReactNode;
  quickSwap: React.ReactNode;
  characterSheet: React.ReactNode;
  embeddedGuidance?: React.ReactNode;
};

/**
 * Renders create-mode workspace regions in a deterministic DOM order.
 */
export function CharacterCreateWorkspaceLayout({
  surface,
  identity,
  quickSwap,
  characterSheet,
  embeddedGuidance,
}: CharacterCreateWorkspaceLayoutProps) {
  const isEmbeddedSurface = surface === "panel";

  return (
    <div className="character-create-workspace-layout" data-surface={surface}>
      <div
        className="character-layout-region character-layout-region--identity"
        data-layout-region="identity"
      >
        {identity}
      </div>
      <div
        className="character-layout-region character-layout-region--quickswap"
        data-layout-region="quickswap"
      >
        {quickSwap}
      </div>
      <div
        className="character-layout-region character-layout-region--sheet"
        data-layout-region="sheet"
      >
        {characterSheet}
        {isEmbeddedSurface ? embeddedGuidance : null}
      </div>
    </div>
  );
}
