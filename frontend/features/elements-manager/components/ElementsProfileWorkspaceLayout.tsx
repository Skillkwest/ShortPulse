import React from "react";

type ElementsProfileWorkspaceLayoutProps = {
  elementSheet: React.ReactNode;
  elementDeck: React.ReactNode;
};

export function ElementsProfileWorkspaceLayout({
  elementSheet,
  elementDeck,
}: ElementsProfileWorkspaceLayoutProps) {
  return (
    <div className="elements-profile-workspace-layout">
      <div
        className="elements-layout-region elements-layout-region--sheet"
        data-layout-region="sheet"
      >
        {elementSheet}
      </div>
      <div
        className="elements-layout-region elements-layout-region--deck"
        data-layout-region="deck"
      >
        {elementDeck}
      </div>
    </div>
  );
}
