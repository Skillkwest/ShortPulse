/**
 * Shared Character Manager workflow body.
 * Switches between shared create/manage content while keeping overlays and file inputs host-agnostic.
 */
import React from "react";
import type { CharacterWorkflowTab } from "../types";

type CharacterManagerWorkflowBodyProps = {
  activeTab: CharacterWorkflowTab;
  createPanel: React.ReactNode;
  managePanel: React.ReactNode;
  referencePreviewOverlay: React.ReactNode;
  deleteCharacterDialog: React.ReactNode;
  deletePresetDialog: React.ReactNode;
  fileInputs: React.ReactNode;
};

/**
 * Renders the shared workflow body beneath the host-level Character Manager chrome.
 */
export function CharacterManagerWorkflowBody({
  activeTab,
  createPanel,
  managePanel,
  referencePreviewOverlay,
  deleteCharacterDialog,
  deletePresetDialog,
  fileInputs,
}: CharacterManagerWorkflowBodyProps) {
  return (
    <>
      {activeTab === "create" ? createPanel : managePanel}
      {referencePreviewOverlay}
      {deleteCharacterDialog}
      {deletePresetDialog}
      {fileInputs}
    </>
  );
}
