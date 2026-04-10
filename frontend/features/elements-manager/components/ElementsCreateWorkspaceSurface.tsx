/**
 * Elements create workspace surface adapter.
 * Makes the Elements page and panel composition explicit while preserving the current region order.
 */
import React from "react";
import { ElementsCreateWorkspaceLayout } from "./ElementsCreateWorkspaceLayout";

type ElementsManagerShellSurface = "page" | "panel";

type ElementsCreateWorkspaceSurfaceProps = {
  surface: ElementsManagerShellSurface;
  quickSwap?: React.ReactNode;
  elementSheet: React.ReactNode;
};

type ElementsCreateWorkspaceLayoutProps = Omit<ElementsCreateWorkspaceSurfaceProps, "surface">;

function ElementsCreateWorkspacePage({
  quickSwap,
  elementSheet,
}: ElementsCreateWorkspaceLayoutProps) {
  return <ElementsCreateWorkspaceLayout quickSwap={quickSwap} elementSheet={elementSheet} />;
}

function ElementsCreateWorkspacePanel({
  quickSwap,
  elementSheet,
}: ElementsCreateWorkspaceLayoutProps) {
  return <ElementsCreateWorkspaceLayout quickSwap={quickSwap} elementSheet={elementSheet} />;
}

/**
 * Selects the correct create-workspace composition path for Elements Manager surfaces.
 */
export function ElementsCreateWorkspaceSurface({
  surface,
  quickSwap,
  elementSheet,
}: ElementsCreateWorkspaceSurfaceProps) {
  if (surface === "panel") {
    return <ElementsCreateWorkspacePanel quickSwap={quickSwap} elementSheet={elementSheet} />;
  }

  return <ElementsCreateWorkspacePage quickSwap={quickSwap} elementSheet={elementSheet} />;
}
