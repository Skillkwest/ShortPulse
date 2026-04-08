import React from "react";
import type { ElementDraft, ElementsProfileMode } from "../types";
import { ElementIdentityCard } from "./ElementIdentityCard";
import { ElementReferenceAssetsCard } from "./ElementReferenceAssetsCard";
import { ElementTypeSelector } from "./ElementTypeSelector";
import { ElementsProfileWorkspaceLayout } from "./ElementsProfileWorkspaceLayout";
import { ElementsReferenceDeckSection } from "./ElementsReferenceDeckSection";

type ElementProfileEditorProps = {
  mode: ElementsProfileMode;
  draft: ElementDraft;
  errorMessage: string | null;
  onFieldChange: <K extends keyof ElementDraft>(field: K, value: ElementDraft[K]) => void;
  onSave?: () => void;
  onRequestDelete?: () => void;
  heroMedia?: React.ReactNode;
  detailsContent?: React.ReactNode;
  referenceAssetsContent?: React.ReactNode;
  deckContent?: React.ReactNode;
  footerActions?: React.ReactNode;
  showDefaultActions?: boolean;
};

export function ElementProfileEditor({
  mode,
  draft,
  errorMessage,
  onFieldChange,
  onSave,
  onRequestDelete,
  heroMedia,
  detailsContent,
  referenceAssetsContent,
  deckContent,
  footerActions,
  showDefaultActions = true,
}: ElementProfileEditorProps) {
  const tokenPreview = draft.alias || draft.name || "ElementName";
  const referenceCount =
    draft.assetType === "image"
      ? draft.imageReferenceUrls.filter(Boolean).length
      : draft.videoReferenceUrl.trim()
        ? 1
        : 0;

  return (
    <section className="elements-profile-view" aria-label="Element profile">
      <div className="elements-profile-head">
        <div>
          <h2 className="elements-library-title">
            {mode === "create" ? "Create Element" : "Element Profile"}
          </h2>
          <p className="tiny subdued helper-text">
            Define reusable element identity and reference assets.
          </p>
        </div>
      </div>
      <ElementsProfileWorkspaceLayout
        elementSheet={
          <section className="elements-sheet-section">
            <div className="elements-section-head">
              <div className="elements-section-title-row">
                <div className="elements-section-title-copy">
                  <h3 className="elements-section-title">Element Sheet</h3>
                </div>
              </div>
            </div>

            <div className="elements-sheet-profile-card">
              <div className="elements-sheet-profile-top-row">
                <div className="elements-sheet-profile-hero">
                  {heroMedia ?? (
                    <button
                      type="button"
                      className={`elements-sheet-profile-hero-btn elements-sheet-profile-hero-btn--${draft.assetType}`}
                      aria-label="Edit element hero"
                    >
                      <span className="elements-sheet-profile-token">@</span>
                      <span className="elements-sheet-profile-type">
                        {draft.assetType === "image" ? "Image" : "Video"}
                      </span>
                    </button>
                  )}
                  <span className="elements-sheet-edit-indicator" aria-hidden="true">
                    Element hero
                  </span>
                </div>

                <div className="elements-sheet-profile-fields elements-sheet-profile-fields--label-serif">
                  <ElementIdentityCard draft={draft} onFieldChange={onFieldChange} />
                </div>
              </div>
            </div>

            <div className="elements-sheet-meta-strip" aria-label="Element metadata">
              <div className="elements-sheet-meta-chip">
                <span className="elements-sheet-meta-kicker">Prompt token</span>
                <strong>@{tokenPreview}</strong>
              </div>
              <div className="elements-sheet-meta-chip">
                <span className="elements-sheet-meta-kicker">Type</span>
                <strong>{draft.assetType === "image" ? "Image Element" : "Video Element"}</strong>
              </div>
              <div className="elements-sheet-meta-chip">
                <span className="elements-sheet-meta-kicker">References</span>
                <strong>
                  {draft.assetType === "image" ? `${referenceCount}/4` : `${referenceCount}/1`}
                </strong>
              </div>
            </div>

            {detailsContent ?? (
              <section className="elements-profile-section elements-profile-section--details">
                <div className="elements-sheet-references-title-row elements-sheet-profile-fields elements-sheet-profile-fields--label-serif">
                  <p className="elements-field-label">Element Details:</p>
                </div>
                <label className="elements-field">
                  <span className="elements-field-label">Prompt Alias</span>
                  <input
                    className="elements-input"
                    value={draft.alias}
                    onChange={(event) => onFieldChange("alias", event.target.value)}
                    placeholder="Optional alias for @prompt references"
                  />
                </label>
                <label className="elements-field">
                  <span className="elements-field-label">Description</span>
                  <textarea
                    className="elements-textarea"
                    value={draft.description}
                    onChange={(event) => onFieldChange("description", event.target.value)}
                    rows={4}
                    placeholder="Describe the object's look, material, silhouette, lighting behavior, or scene role."
                  />
                </label>
                <p className="elements-sheet-references-helper tiny subdued">
                  This name will later map to prompt references for Kling element binding.
                </p>
                <ElementTypeSelector
                  assetType={draft.assetType}
                  onChange={(nextType) => {
                    onFieldChange("assetType", nextType);
                    if (nextType === "image") {
                      onFieldChange("videoReferenceUrl", "");
                    } else {
                      onFieldChange("imageReferenceUrls", []);
                    }
                  }}
                />
              </section>
            )}

            {referenceAssetsContent ?? (
              <ElementReferenceAssetsCard draft={draft} onFieldChange={onFieldChange} />
            )}

            <section className="elements-profile-section elements-profile-section--notes">
              <h3 className="elements-profile-section-title">Prompt Notes</h3>
              <p className="tiny subdued helper-text">
                Future Kling prompts can reference this element by name, for example: @
                {tokenPreview}. Use the description to capture visual identity, material, motion
                cues, or scene role.
              </p>
            </section>
          </section>
        }
        elementDeck={deckContent ?? <ElementsReferenceDeckSection draft={draft} />}
      />
      {errorMessage ? <p className="elements-profile-error tiny">{errorMessage}</p> : null}
      {showDefaultActions ? (
        <div className="elements-profile-actions">
          {mode === "edit" ? (
            <button type="button" className="elements-secondary-btn" onClick={onRequestDelete}>
              Delete Element
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="elements-primary-btn" onClick={onSave}>
            {mode === "create" ? "Save Element" : "Save Changes"}
          </button>
        </div>
      ) : footerActions ? (
        <div className="elements-profile-actions">{footerActions}</div>
      ) : null}
    </section>
  );
}
