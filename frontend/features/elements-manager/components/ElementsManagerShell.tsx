/**
 * Elements library shell.
 * Rebuilds the Elements surface as a local-state clone of the embedded Character workflow shell.
 */
import React from "react";
import { Plus, Trash, UserCircle } from "phosphor-react";
import { CharacterCreateWorkspaceSurface } from "../../character-manager/components/CharacterCreateWorkspaceSurface";
import { CharacterDescriptionEditorCard } from "../../character-manager/components/CharacterDescriptionEditorCard";
import {
  CharacterSheetPresetTabs,
  getCharacterSheetPresetTabId,
} from "../../character-manager/components/CharacterSheetPresetTabs";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
import { ElementsManagerWorkflowTabs } from "./ElementsManagerWorkflowTabs";
import type { ElementAssetType } from "../types";

type ElementsManagerShellProps = {
  onActiveTabChange?: (activeTab: "manage" | "profile") => void;
};

const ELEMENT_DESCRIPTION_HELPER_TEXT =
  "Tip: Element notes help preserve appearance, material, and scene role across generations.";

const IMAGE_REFERENCE_SLOT_LABELS = ["Primary Look", "Secondary Angle", "Support Angle"] as const;

const buildElementInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "EL";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
};

const buildElementDeckEntries = (assetType: ElementAssetType, references: string[]) => {
  if (assetType === "video") {
    return references.slice(0, 1).map((reference, index) => ({
      id: `video-reference-${index + 1}`,
      label: "Motion Reference",
      token: "VID",
      reference,
    }));
  }
  return references.slice(0, 6).map((reference, index) => ({
    id: `image-reference-${index + 1}`,
    label: index === 0 ? "Primary Look" : `Reference ${index + 1}`,
    token: "IMG",
    reference,
  }));
};

export function ElementsManagerShell({ onActiveTabChange }: ElementsManagerShellProps) {
  const {
    activeTab,
    elements,
    selectedElementId,
    pendingDeleteElementId,
    draft,
    setActiveTab,
    updateDraftField,
    updateActiveReferenceSet,
    setActiveReferenceSet,
    onAddReferenceSet,
    onRenameReferenceSet,
    onDeleteReferenceSet,
    onCreateElement,
    onSelectElement,
    onRequestDeleteElement,
    onCancelDeleteElement,
    onConfirmDeleteElement,
  } = useElementsManagerViewState();
  const presetTabsIdBase = `element-reference-set-${React.useId()}`;
  const presetPanelId = `${presetTabsIdBase}-panel`;
  const activePresetTabId = getCharacterSheetPresetTabId(
    presetTabsIdBase,
    draft.activeReferenceSetId
  );
  const activeReferenceSet = draft.referenceSets[draft.activeReferenceSetId];
  const deckEntries = buildElementDeckEntries(
    draft.assetType,
    draft.assetType === "image"
      ? activeReferenceSet.imageReferenceUrls.filter(Boolean)
      : activeReferenceSet.videoReferenceUrl.trim()
        ? [activeReferenceSet.videoReferenceUrl]
        : []
  );
  React.useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);

  return (
    <div
      className="character-manager-page character-manager-page--embedded elements-manager-shell elements-manager-shell--character-clone"
      data-active-tab={activeTab}
      data-surface="panel"
    >
      <ElementsManagerWorkflowTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "manage" ? (
        <section className="panel media-panel character-manage-panel">
          <div className="character-manage-header-row">
            <div className="character-manage-title-stack">
              <h2>Elements</h2>
              <p className="tiny subdued character-manage-helper">
                Select an element to edit its reference profile.
              </p>
            </div>
            <div className="character-manage-header-actions">
              <button
                type="button"
                className="character-mode-create-btn character-mode-create-btn--inline"
                onClick={onCreateElement}
              >
                <Plus
                  size={14}
                  weight="bold"
                  className="character-mode-create-btn-icon"
                  aria-hidden
                />
                <span>Create New Element</span>
              </button>
            </div>
          </div>

          <div className="character-manage-chip-container">
            <div className="character-manage-list" role="list" aria-label="Element list">
              {elements.map((item) => {
                const isSelected = item.id === selectedElementId;
                const itemName = item.name || "Untitled element";
                return (
                  <article
                    key={item.id}
                    role="listitem"
                    className={`character-list-card ${isSelected ? "is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="character-list-select-btn"
                      aria-label={`Open element profile: ${itemName}`}
                      onClick={() => onSelectElement(item.id)}
                    >
                      <div className="character-list-main">
                        <span className="character-list-avatar" aria-hidden="true">
                          <span className="character-list-avatar-initials">
                            {buildElementInitials(itemName)}
                          </span>
                        </span>
                        <div className="character-list-copy">
                          <p className="metric-label tiny">{isSelected ? "Selected" : "Element"}</p>
                          <p className="character-list-name">{itemName}</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="character-list-delete-btn"
                      aria-label={`Delete element: ${itemName}`}
                      onClick={() => onRequestDeleteElement(item.id)}
                    >
                      <Trash size={12} weight="bold" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="character-simple-panel">
          <CharacterCreateWorkspaceSurface
            surface="panel"
            quickSwap={
              <section className="character-section character-section--reference-drop no-collapse-toggle">
                <div className="character-section-head">
                  <div className="character-section-title-row">
                    <div className="character-section-title-copy">
                      <h3 className="character-section-title">Element Deck</h3>
                      <p className="character-section-helper tiny subdued">
                        Keep reusable reference looks here for quick swaps and revisions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="character-reference-drop-content">
                  <div className="character-quickswap-active-scroll">
                    <div
                      className="character-reference-upload-grid character-reference-upload-grid--drop-card"
                      role="list"
                      aria-label="Element deck references"
                    >
                      {deckEntries.map((entry) => (
                        <article
                          key={entry.id}
                          role="listitem"
                          className="character-reference-upload-card"
                        >
                          <div className="character-reference-upload-image-wrap">
                            <div className="elements-character-deck-card" aria-hidden="true">
                              <span className="elements-character-deck-card-token">
                                {entry.token}
                              </span>
                              <span className="elements-character-deck-card-label">
                                {entry.label}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}

                      <button
                        type="button"
                        className="character-reference-upload-placeholder"
                        aria-label="Add element deck reference"
                      >
                        <span className="character-reference-upload-placeholder-label">
                          Add reference
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            }
            characterSheet={
              <section className="character-section character-section--references">
                <div className="character-section-head">
                  <div className="character-section-title-row">
                    <div className="character-section-title-copy">
                      <h3 className="character-section-title">Element Sheet</h3>
                    </div>
                  </div>
                </div>

                <div className="character-profile-card">
                  <div className="character-profile-card-top-row">
                    <div className="character-profile-photo-stack">
                      <button
                        type="button"
                        className="character-profile-photo-btn"
                        aria-label="Element hero"
                      >
                        <span className="character-profile-placeholder-icon" aria-hidden="true">
                          <UserCircle size={46} weight="light" aria-hidden="true" />
                        </span>
                      </button>
                      <span className="character-profile-edit-indicator" aria-hidden="true">
                        <span>
                          {draft.assetType === "image" ? "Image element" : "Video element"}
                        </span>
                      </span>
                    </div>

                    <div className="character-profile-fields character-profile-fields--label-serif">
                      <label
                        className="control-row character-simple-field"
                        htmlFor="element-manager-name"
                      >
                        <span className="input-label">Name:</span>
                        <input
                          id="element-manager-name"
                          className="character-name-input"
                          type="text"
                          value={draft.name}
                          onChange={(event) => updateDraftField("name", event.target.value)}
                          placeholder="Enter element name"
                        />
                      </label>
                      <label
                        className="control-row character-simple-field"
                        htmlFor="element-manager-alias"
                      >
                        <span className="input-label">Alias:</span>
                        <input
                          id="element-manager-alias"
                          className="character-name-input character-voice-input"
                          type="text"
                          value={draft.alias}
                          onChange={(event) => updateDraftField("alias", event.target.value)}
                          placeholder="Enter prompt alias"
                        />
                      </label>
                      <div className="control-row character-simple-field">
                        <span className="input-label">Type:</span>
                        <div
                          className="character-voice-row elements-character-type-toggle"
                          role="group"
                          aria-label="Element type"
                        >
                          {(["image", "video"] as const).map((assetType) => (
                            <button
                              key={assetType}
                              type="button"
                              className={`elements-character-type-pill ${
                                draft.assetType === assetType ? "is-active" : ""
                              }`}
                              onClick={() => updateDraftField("assetType", assetType)}
                            >
                              {assetType === "image" ? "Image Element" : "Video Element"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <CharacterSheetPresetTabs
                  presetIds={draft.visibleReferenceSetIds}
                  activePresetId={draft.activeReferenceSetId}
                  presetLabels={draft.referenceSetLabels}
                  onSelectPreset={setActiveReferenceSet}
                  onAddPreset={onAddReferenceSet}
                  onRenamePreset={onRenameReferenceSet}
                  onDeletePreset={onDeleteReferenceSet}
                  panelId={presetPanelId}
                  idBase={presetTabsIdBase}
                />

                <div
                  className="character-sheet-preset-panel"
                  role="tabpanel"
                  id={presetPanelId}
                  aria-labelledby={activePresetTabId}
                >
                  <CharacterDescriptionEditorCard
                    description={activeReferenceSet.description}
                    helperText={ELEMENT_DESCRIPTION_HELPER_TEXT}
                    maxLength={150}
                    rows={2}
                    disabled={false}
                    onChangeDescription={(value) =>
                      updateActiveReferenceSet((current) => ({
                        ...current,
                        description: value,
                      }))
                    }
                  />

                  <div className="character-sheet-references-title-row character-profile-fields character-profile-fields--label-serif">
                    <p className="input-label">Element References:</p>
                  </div>
                  <p className="character-sheet-references-helper tiny subdued">
                    {draft.assetType === "image"
                      ? "Use these slots to stage the core reference angles for this element."
                      : "Use this slot to stage the primary motion reference for this element."}
                  </p>
                  <div className="character-reference-empty-grid">
                    {(draft.assetType === "image"
                      ? IMAGE_REFERENCE_SLOT_LABELS
                      : ["Motion Reference"]
                    ).map((slotLabel, index) => {
                      const slotValue =
                        draft.assetType === "image"
                          ? (activeReferenceSet.imageReferenceUrls[index] ?? "")
                          : activeReferenceSet.videoReferenceUrl;
                      return (
                        <article
                          key={`${slotLabel}-${index + 1}`}
                          className={`character-character-sheet-card ${
                            slotValue ? "is-filled" : "is-empty"
                          }`}
                        >
                          <div className="character-character-sheet-media">
                            {slotValue ? (
                              <div className="elements-character-sheet-placeholder">
                                <span className="elements-character-sheet-placeholder-token">
                                  {draft.assetType === "image" ? "IMG" : "VID"}
                                </span>
                                <span>{slotLabel}</span>
                              </div>
                            ) : (
                              <span className="character-character-sheet-drop-copy tiny">
                                <span>Drop reference or click to upload</span>
                                <span className="character-character-sheet-drop-requirement">
                                  {draft.assetType === "image" && index === 0
                                    ? "(Required)"
                                    : "(Optional)"}
                                </span>
                              </span>
                            )}
                          </div>
                          <span className="character-reference-empty-hint">{slotLabel}</span>
                        </article>
                      );
                    })}
                  </div>

                  <label
                    className="control-row character-simple-field"
                    htmlFor="element-reference-urls"
                  >
                    <span className="input-label">
                      {draft.assetType === "image" ? "Reference URLs:" : "Motion URL:"}
                    </span>
                    {draft.assetType === "image" ? (
                      <textarea
                        id="element-reference-urls"
                        className="character-description-input elements-character-reference-textarea"
                        rows={4}
                        value={activeReferenceSet.imageReferenceUrls.join("\n")}
                        onChange={(event) =>
                          updateActiveReferenceSet((current) => ({
                            ...current,
                            imageReferenceUrls: event.target.value
                              .split(/\n+/)
                              .map((value) => value.trim())
                              .filter(Boolean)
                              .slice(0, 6),
                          }))
                        }
                        placeholder="Paste one reference URL per line"
                      />
                    ) : (
                      <input
                        id="element-reference-urls"
                        className="character-name-input"
                        type="text"
                        value={activeReferenceSet.videoReferenceUrl}
                        onChange={(event) =>
                          updateActiveReferenceSet((current) => ({
                            ...current,
                            videoReferenceUrl: event.target.value,
                          }))
                        }
                        placeholder="Paste the primary motion reference URL"
                      />
                    )}
                  </label>
                </div>
              </section>
            }
          />
        </section>
      )}

      {pendingDeleteElementId ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-element-title"
        >
          <div className="modal-card character-delete-confirm-card">
            <h3 id="delete-element-title">Delete this element?</h3>
            <p className="subdued tiny character-delete-confirm-copy">
              This will permanently remove the selected element from the local Elements library.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onCancelDeleteElement}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger character-delete-confirm-btn"
                onClick={onConfirmDeleteElement}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
