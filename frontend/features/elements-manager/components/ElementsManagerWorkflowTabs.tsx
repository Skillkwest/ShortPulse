/**
 * Elements workflow tab chrome.
 * Renders the embedded Elements workflow tabs for the manage/profile surface.
 */
import React from "react";
import type { ElementsWorkflowTab } from "../types";

type ElementsManagerWorkflowTabsProps = {
  activeTab: ElementsWorkflowTab;
  setActiveTab: (tab: ElementsWorkflowTab) => void;
  isSavingElement: boolean;
  hasUnsavedElementDraft: boolean;
  loading: boolean;
  onSaveElement: () => void;
};

export function ElementsManagerWorkflowTabs({
  activeTab,
  setActiveTab,
  isSavingElement,
  hasUnsavedElementDraft,
  loading,
  onSaveElement,
}: ElementsManagerWorkflowTabsProps) {
  if (activeTab !== "profile") {
    return null;
  }

  return (
    <header className="elements-workflow-header">
      <div className="elements-workflow-header-main">
        <div
          className="elements-workflow-tab-row"
          role="tablist"
          aria-label="Elements workflow mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className="elements-workflow-tab elements-workflow-tab--manage"
            onClick={() => setActiveTab("manage")}
          >
            Manage Elements
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={true}
            className="elements-workflow-tab elements-workflow-tab--profile is-active"
            onClick={() => setActiveTab("profile")}
          >
            Element Profile
          </button>
        </div>
        <div className="elements-workflow-header-actions">
          <button
            type="button"
            className="elements-manage-create-btn elements-manage-save-btn"
            onClick={onSaveElement}
            disabled={!hasUnsavedElementDraft || isSavingElement || loading}
          >
            {isSavingElement ? "Saving..." : hasUnsavedElementDraft ? "Save Element" : "Saved"}
          </button>
        </div>
      </div>
    </header>
  );
}
