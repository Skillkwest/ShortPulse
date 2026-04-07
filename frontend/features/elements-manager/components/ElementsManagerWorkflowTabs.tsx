import React from "react";
import type { ElementsWorkflowTab } from "../types";

type ElementsManagerWorkflowTabsProps = {
  activeTab: ElementsWorkflowTab;
  setActiveTab: (tab: ElementsWorkflowTab) => void;
  title: string;
};

export function ElementsManagerWorkflowTabs({
  activeTab,
  setActiveTab,
  title,
}: ElementsManagerWorkflowTabsProps) {
  return (
    <header className="elements-library-panel-header">
      <p className="eyebrow">{title}</p>
      <div
        className="elements-mode-tab-row elements-mode-tab-row--embedded-header"
        role="tablist"
        aria-label="Elements workflow mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "manage"}
          className={`elements-mode-tab ${activeTab === "manage" ? "is-active" : ""}`}
          onClick={() => setActiveTab("manage")}
        >
          Manage Elements
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          className={`elements-mode-tab ${activeTab === "profile" ? "is-active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          Element Profile
        </button>
      </div>
    </header>
  );
}
