/**
 * Character create workspace surface adapter.
 * Makes page and panel composition explicit while preserving the shared region order contract.
 */
import React from "react";
import type { CharacterManagerShellSurface } from "../types";
import { CharacterCreateWorkspaceLayout } from "./CharacterCreateWorkspaceLayout";

type CharacterCreateWorkspaceSurfaceProps = {
  surface: CharacterManagerShellSurface;
  quickSwap: React.ReactNode;
  characterSheet: React.ReactNode;
  panelGuidance?: React.ReactNode;
};

type CharacterCreateWorkspaceLayoutProps = Omit<
  CharacterCreateWorkspaceSurfaceProps,
  "surface" | "panelGuidance"
>;

function CharacterCreateWorkspacePage({
  quickSwap,
  characterSheet,
}: CharacterCreateWorkspaceLayoutProps) {
  return <CharacterCreateWorkspaceLayout quickSwap={quickSwap} characterSheet={characterSheet} />;
}

function CharacterCreateWorkspacePanel({
  quickSwap,
  characterSheet,
  panelGuidance,
}: CharacterCreateWorkspaceLayoutProps &
  Pick<CharacterCreateWorkspaceSurfaceProps, "panelGuidance">) {
  return (
    <CharacterCreateWorkspaceLayout
      quickSwap={
        <>
          {quickSwap}
          {panelGuidance}
        </>
      }
      characterSheet={characterSheet}
    />
  );
}

/**
 * Selects the correct create-workspace composition path for Character Manager surfaces.
 */
export function CharacterCreateWorkspaceSurface({
  surface,
  quickSwap,
  characterSheet,
  panelGuidance,
}: CharacterCreateWorkspaceSurfaceProps) {
  if (surface === "panel") {
    return (
      <CharacterCreateWorkspacePanel
        quickSwap={quickSwap}
        characterSheet={characterSheet}
        panelGuidance={panelGuidance}
      />
    );
  }

  return <CharacterCreateWorkspacePage quickSwap={quickSwap} characterSheet={characterSheet} />;
}
