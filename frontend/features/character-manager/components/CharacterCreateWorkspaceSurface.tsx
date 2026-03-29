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
};

type CharacterCreateWorkspaceLayoutProps = Omit<CharacterCreateWorkspaceSurfaceProps, "surface">;

function CharacterCreateWorkspacePage({
  quickSwap,
  characterSheet,
}: CharacterCreateWorkspaceLayoutProps) {
  return <CharacterCreateWorkspaceLayout quickSwap={quickSwap} characterSheet={characterSheet} />;
}

function CharacterCreateWorkspacePanel({
  quickSwap,
  characterSheet,
}: CharacterCreateWorkspaceLayoutProps) {
  return <CharacterCreateWorkspaceLayout quickSwap={quickSwap} characterSheet={characterSheet} />;
}

/**
 * Selects the correct create-workspace composition path for Character Manager surfaces.
 */
export function CharacterCreateWorkspaceSurface({
  surface,
  quickSwap,
  characterSheet,
}: CharacterCreateWorkspaceSurfaceProps) {
  if (surface === "panel") {
    return <CharacterCreateWorkspacePanel quickSwap={quickSwap} characterSheet={characterSheet} />;
  }

  return <CharacterCreateWorkspacePage quickSwap={quickSwap} characterSheet={characterSheet} />;
}
