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
  showBeginnerModeToggle: boolean;
  effectiveBeginnerMode: boolean;
  setBeginnerMode: React.Dispatch<React.SetStateAction<boolean>>;
  isCreatingCharacter: boolean;
  loading: boolean;
  onCreateCharacter: () => void;
};

/**
 * Renders the shared Manage/Profile tab chrome for Character Manager surfaces.
 */
export function CharacterManagerWorkflowTabs({
  isEmbeddedSurface,
  activeTab,
  setActiveTab,
  showBeginnerModeToggle,
  effectiveBeginnerMode,
  setBeginnerMode,
  isCreatingCharacter,
  loading,
  onCreateCharacter,
}: CharacterManagerWorkflowTabsProps) {
  const shouldShowProfileTab = !isEmbeddedSurface || activeTab === "create";
  const shouldRenderEmbeddedHeader = !isEmbeddedSurface || activeTab === "create";
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
        role="tab"
        aria-selected={activeTab === "manage"}
        className={`character-mode-tab character-mode-tab--manage ${
          activeTab === "manage" ? "is-active" : ""
        }`}
        onClick={() => setActiveTab("manage")}
      >
        Manage Characters
      </button>
      {shouldShowProfileTab ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "create"}
          className={`character-mode-tab character-mode-tab--profile ${
            activeTab === "create" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("create")}
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

  if (isEmbeddedSurface) {
    if (!shouldRenderEmbeddedHeader) return null;
    return <header className="character-library-panel-header">{tabRow}</header>;
  }

  return (
    <div className="character-mode-row">
      <DashboardNavPrefab variant="inline" className="character-mode-dashboard-link" />
      {tabRow}
      {activeTab === "create" && showBeginnerModeToggle ? (
        <div className="toolbar-beginner-toggle character-mode-beginner-toggle">
          <div className="toolbar-beginner-copy">
            <span className="toolbar-label">Beginner mode</span>
          </div>
          <button
            type="button"
            className={`reference-toggle beginner-toggle ${effectiveBeginnerMode ? "is-active" : ""}`}
            aria-pressed={effectiveBeginnerMode}
            aria-label={effectiveBeginnerMode ? "Disable beginner mode" : "Enable beginner mode"}
            onClick={() => setBeginnerMode((current) => !current)}
          >
            <span className="reference-toggle-track" aria-hidden="true">
              <span className="reference-toggle-dot" />
            </span>
          </button>
        </div>
      ) : null}
      {activeTab === "manage" ? createButton : null}
    </div>
  );
}
