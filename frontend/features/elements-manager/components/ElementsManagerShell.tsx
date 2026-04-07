import React from "react";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
import { ElementsLibraryList } from "./ElementsLibraryList";
import { ElementsManagerWorkflowTabs } from "./ElementsManagerWorkflowTabs";
import { ElementProfileEditor } from "./ElementProfileEditor";

export function ElementsManagerShell() {
  const {
    activeTab,
    draft,
    elements,
    errorMessage,
    pendingDeleteElementId,
    profileMode,
    selectedElementId,
    setActiveTab,
    updateDraftField,
    onConfirmDeleteElement,
    onCreateElement,
    onRequestDeleteElement,
    onCancelDeleteElement,
    onSaveElement,
    onSelectElement,
  } = useElementsManagerViewState();

  return (
    <div className="elements-manager-shell">
      <ElementsManagerWorkflowTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        title="Elements"
      />
      <div className="elements-manager-body">
        {activeTab === "manage" ? (
          <ElementsLibraryList
            elements={elements}
            selectedElementId={selectedElementId}
            onCreateElement={onCreateElement}
            onSelectElement={onSelectElement}
            onRequestDeleteElement={onRequestDeleteElement}
          />
        ) : (
          <ElementProfileEditor
            mode={profileMode}
            draft={draft}
            errorMessage={errorMessage}
            onFieldChange={updateDraftField}
            onSave={onSaveElement}
            onRequestDelete={
              profileMode === "edit" && selectedElementId
                ? () => onRequestDeleteElement(selectedElementId)
                : undefined
            }
          />
        )}
      </div>
      {pendingDeleteElementId ? (
        <div
          className="elements-delete-confirm"
          role="alertdialog"
          aria-label="Delete element confirmation"
        >
          <p>Delete this element from the library?</p>
          <div className="elements-delete-confirm-actions">
            <button
              type="button"
              className="elements-secondary-btn"
              onClick={onCancelDeleteElement}
            >
              Cancel
            </button>
            <button type="button" className="elements-primary-btn" onClick={onConfirmDeleteElement}>
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
