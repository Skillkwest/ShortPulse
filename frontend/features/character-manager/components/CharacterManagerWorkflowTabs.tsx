/**
 * Character Manager workflow tabs and host-level controls.
 * Keeps page-vs-embedded tab chrome separate from the shared workflow body.
 */
import React from "react";
import { Plus } from "phosphor-react";
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import type { CharacterWorkflowTab } from "../types";

type CharacterManagerWorkflowTabsProps = {
  isEmbeddedSurface: boolean;
  activeTab: CharacterWorkflowTab;
  setActiveTab: React.Dispatch<React.SetStateAction<CharacterWorkflowTab>>;
  manageTabId: string;
  createTabId: string;
  managePanelId: string;
  createPanelId: string;
  isCreatingCharacter: boolean;
  isSavingCharacter: boolean;
  hasUnsavedCharacterDraft: boolean;
  loading: boolean;
  onCreateCharacter: () => void;
  onSaveCharacter: () => void;
};

/**
 * Renders the shared Manage/Profile tab chrome for Character Manager surfaces.
 */
export function CharacterManagerWorkflowTabs({
  isEmbeddedSurface,
  activeTab,
  setActiveTab,
  manageTabId,
  createTabId,
  managePanelId,
  createPanelId,
  isCreatingCharacter,
  isSavingCharacter,
  hasUnsavedCharacterDraft,
  loading,
  onCreateCharacter,
  onSaveCharacter,
}: CharacterManagerWorkflowTabsProps) {
  const shouldShowProfileTab = !isEmbeddedSurface || activeTab === "create";
  const shouldRenderEmbeddedHeader = !isEmbeddedSurface || activeTab === "create";
  const selectTab = (nextTab: CharacterWorkflowTab) => {
    setActiveTab(nextTab);
  };
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: CharacterWorkflowTab
  ) => {
    if (!shouldShowProfileTab) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectTab(currentTab === "manage" ? "create" : "manage");
  };
  const tabRow = (
    <div
      className={
        isEmbeddedSurface
          ? "character-mode-tab-row character-mode-tab-row--embedded-header"
          : "character-mode-tab-row"
      }
      role="tablist"
      aria-label="Character workflow mode"
    >
      <button
        type="button"
        id={manageTabId}
        role="tab"
        aria-selected={activeTab === "manage"}
        aria-controls={managePanelId}
        tabIndex={activeTab === "manage" ? 0 : -1}
        className={`character-mode-tab character-mode-tab--manage ${
          activeTab === "manage" ? "is-active" : ""
        }`}
        onClick={() => selectTab("manage")}
        onKeyDown={(event) => handleTabKeyDown(event, "manage")}
      >
        Manage Characters
      </button>
      {shouldShowProfileTab ? (
        <button
          type="button"
          id={createTabId}
          role="tab"
          aria-selected={activeTab === "create"}
          aria-controls={createPanelId}
          tabIndex={activeTab === "create" ? 0 : -1}
          className={`character-mode-tab character-mode-tab--profile ${
            activeTab === "create" ? "is-active" : ""
          }`}
          onClick={() => selectTab("create")}
          onKeyDown={(event) => handleTabKeyDown(event, "create")}
        >
          Character Profile
        </button>
      ) : null}
    </div>
  );

  const createButton = (
    <button
      type="button"
      className={`character-mode-create-btn${isEmbeddedSurface ? " character-mode-create-btn--inline" : ""}`}
      onClick={onCreateCharacter}
      disabled={isCreatingCharacter || loading}
    >
      {isCreatingCharacter ? (
        "Creating..."
      ) : (
        <>
          <Plus size={14} weight="bold" className="character-mode-create-btn-icon" aria-hidden />
          <span>Create New Character</span>
        </>
      )}
    </button>
  );

  const shouldShowSaveButton =
    activeTab === "create" && (hasUnsavedCharacterDraft || isSavingCharacter);
  const saveButton = shouldShowSaveButton ? (
    <button
      type="button"
      className={`character-mode-create-btn character-mode-save-btn${
        isEmbeddedSurface ? " character-mode-create-btn--inline" : ""
      }`}
      onClick={onSaveCharacter}
      disabled={!hasUnsavedCharacterDraft || isSavingCharacter || loading}
    >
      {isSavingCharacter ? "Saving..." : "Save Character"}
    </button>
  ) : null;

  if (isEmbeddedSurface) {
    if (!shouldRenderEmbeddedHeader) return null;
    return (
      <header className="character-library-panel-header">
        <div className="character-library-panel-header-main">
          {tabRow}
          {saveButton ? (
            <div className="character-library-panel-header-actions">{saveButton}</div>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <div className="character-mode-row">
      <DashboardNavPrefab variant="inline" className="character-mode-dashboard-link" />
      {tabRow}
      {saveButton}
      {activeTab === "manage" ? createButton : null}
    </div>
  );
}
