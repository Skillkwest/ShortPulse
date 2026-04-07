/**
 * Elements workflow tab chrome.
 * Matches the embedded Character header contract while using Elements-specific labels.
 */
import React from "react";
import type { ElementsWorkflowTab } from "../types";

type ElementsManagerWorkflowTabsProps = {
  activeTab: ElementsWorkflowTab;
  setActiveTab: (tab: ElementsWorkflowTab) => void;
};

export function ElementsManagerWorkflowTabs({
  activeTab,
  setActiveTab,
}: ElementsManagerWorkflowTabsProps) {
  if (activeTab !== "profile") {
    return null;
  }

  return (
    <header className="character-library-panel-header">
      <div
        className="character-mode-tab-row character-mode-tab-row--embedded-header"
        role="tablist"
        aria-label="Elements workflow mode"
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
          Manage Elements
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          className={`character-mode-tab character-mode-tab--profile ${
            activeTab === "profile" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("profile")}
        >
          Element Profile
        </button>
      </div>
    </header>
  );
}
