/**
 * Primary Styles library panel for AI Studio.
 * Presentational surface wired to the style-creator controller.
 */
import React from "react";
import { CircleNotch, Prohibit, UploadSimple, X } from "phosphor-react";
import type { StylesLibraryStyleDetails } from "../types";
import { resolveStylePreviewBackgroundImage } from "./edit/expertEditStyles";
import type { ExpertEditStyleTile } from "./edit/expertEditStyles";
import {
  STYLE_PROMPT_MAX_CHARACTERS,
  STYLE_PROMPT_NEAR_LIMIT_CHARACTERS,
} from "./style-creator/constants";
import { captureStyleDropSnapshot, type ResolveInternalStyleDrop } from "./style-creator/intake";
import { useStyleCreatorController } from "./style-creator/useStyleCreatorController";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

const NONE_STYLE_ID = "__none_style__";
const NONE_STYLE_TILE: ExpertEditStyleTile = {
  id: NONE_STYLE_ID,
  title: "None",
  style: "None",
  referenceImageName: "None",
  stylePrompt: "",
  previewUrl: null,
  placeholder: false,
};

export type StylesLibraryPanelProps = {
  styles: readonly ExpertEditStyleTile[];
  selectedStyleId: string | null;
  onReorderStyle?: (sourceStyleId: string, targetStyleId: string) => Promise<void> | void;
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
  deleteError?: string | null;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
  saveError?: string | null;
  resolveInternalStyleDrop?: ResolveInternalStyleDrop;
};

export function StylesLibraryPanel({
  styles,
  onReorderStyle,
  onDeleteStyle,
  deleteError = null,
  onSaveStyleDetails,
  saveError = null,
  resolveInternalStyleDrop,
}: StylesLibraryPanelProps) {
  const stylePreviewFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const stylePromptInputId = "styles-library-style-prompt-input";

  const {
    renderedStyles,
    pendingEditPreviewImageUrl,
    draggedStyleId,
    dropTargetStyleId,
    pendingDeleteStyle,
    pendingStyleEdit,
    deleteSubmitting,
    editSubmitting,
    createStyleFromDropSubmitting,
    stylesLibraryDropActive,
    stylePreviewDropActive,
    localDeleteError,
    localSaveError,
    stylesLibraryDropError,
    stylePromptExtractionSubmitting,
    stylePromptExtractionError,
    setPendingDeleteStyle,
    setPendingStyleEdit,
    setStylePreviewDropActive,
    setLocalDeleteError,
    closeDeleteModal,
    closeEditModal,
    handleStylesLibraryDragEnter,
    handleStylesLibraryDragOver,
    handleStylesLibraryDragLeave,
    handleStylesLibraryDrop,
    handleDeleteConfirm,
    handleSaveStyleDetails,
    openStyleEditModal,
    openCreateStyleModal,
    handleStyleDragStart,
    handleStyleDragOver,
    handleStyleDrop,
    handleStyleDragEnd,
    applyStylePreviewFromTransfer,
    applyStylePreviewFile,
  } = useStyleCreatorController({
    styles,
    onReorderStyle,
    onDeleteStyle,
    onSaveStyleDetails,
    resolveInternalStyleDrop,
  });
  const stylesWithNoneFirst = React.useMemo(
    () => [NONE_STYLE_TILE, ...renderedStyles],
    [renderedStyles]
  );
  const stylePromptCharacterCount = pendingStyleEdit?.details.stylePrompt.length ?? 0;
  const stylePromptNearLimit = stylePromptCharacterCount >= STYLE_PROMPT_NEAR_LIMIT_CHARACTERS;
  const stylePromptAtLimit = stylePromptCharacterCount >= STYLE_PROMPT_MAX_CHARACTERS;
  const isAnyStylesModalOpen = Boolean(pendingStyleEdit || pendingDeleteStyle);
  useAiStudioModalActivity("styles-library-modal", isAnyStylesModalOpen);

  return (
    <section
      className={`styles-library-panel ${stylesLibraryDropActive ? "is-drop-active" : ""}`.trim()}
      aria-label="Styles library"
      onDragEnter={handleStylesLibraryDragEnter}
      onDragOver={handleStylesLibraryDragOver}
      onDragLeave={handleStylesLibraryDragLeave}
      onDrop={handleStylesLibraryDrop}
    >
      <header className="styles-library-header">
        <p className="eyebrow">Styles Library</p>
        <p className="tiny subdued helper-text">
          Browse all loaded styles. Drag an image from your computer, Reference Grid, or Quick Slot
          to create a style.
        </p>
        {stylesLibraryDropActive ? (
          <p className="styles-library-drop-status tiny">Drop image to create a new style.</p>
        ) : null}
        {createStyleFromDropSubmitting ? (
          <p className="styles-library-drop-status styles-library-drop-status-processing tiny subdued">
            <span className="styles-library-processing-inline-spinner" aria-hidden="true">
              <CircleNotch size={12} weight="bold" />
            </span>
            <span role="status" aria-live="polite">
              Creating style from image...
            </span>
          </p>
        ) : null}
        {stylesLibraryDropError ? (
          <p className="styles-library-drop-error tiny">{stylesLibraryDropError}</p>
        ) : null}
      </header>
      <div
        className={`styles-library-scroll ${
          stylesLibraryDropActive ? "is-external-drop-active" : ""
        }`.trim()}
      >
        <div className="styles-library-grid" role="list" aria-label="Styles library tiles">
          {stylesWithNoneFirst.map((style) => {
            const isNoneStyle = style.id === NONE_STYLE_ID;
            return (
              <article
                key={style.id}
                role="listitem"
                className={`styles-library-tile ${draggedStyleId === style.id ? "is-dragging" : ""} ${
                  dropTargetStyleId === style.id ? "is-drop-target" : ""
                } ${style.placeholder ? "is-placeholder" : ""}`.trim()}
                draggable={!isNoneStyle}
                onDragStart={
                  isNoneStyle ? undefined : (event) => handleStyleDragStart(style.id, event)
                }
                onDragOver={
                  isNoneStyle ? undefined : (event) => handleStyleDragOver(style.id, event)
                }
                onDrop={isNoneStyle ? undefined : (event) => handleStyleDrop(style.id, event)}
                onDragEnd={handleStyleDragEnd}
              >
                {!style.placeholder && !isNoneStyle ? (
                  <button
                    type="button"
                    className="styles-library-tile-delete"
                    aria-label={`Delete style: ${style.title}`}
                    onClick={() => {
                      setLocalDeleteError(null);
                      setPendingDeleteStyle(style);
                    }}
                  >
                    <X size={12} weight="bold" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="styles-library-tile-select"
                  aria-label={`Style tile: ${style.title}${style.placeholder ? " (coming soon)" : ""}`}
                  disabled={style.placeholder}
                  onClick={() => {
                    if (style.placeholder) return;
                    if (isNoneStyle) return;
                    openStyleEditModal(style);
                  }}
                >
                  <span className="styles-library-tile-title">{style.title}</span>
                  <span
                    className="styles-library-tile-preview"
                    style={
                      style.previewUrl
                        ? {
                            backgroundImage: resolveStylePreviewBackgroundImage(style.previewUrl),
                          }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {style.placeholder ? (
                      <span className="styles-library-tile-coming-soon">Coming soon</span>
                    ) : isNoneStyle ? (
                      <span className="styles-library-none-icon" aria-hidden="true">
                        <Prohibit size={34} weight="duotone" />
                      </span>
                    ) : null}
                  </span>
                </button>
              </article>
            );
          })}
          {createStyleFromDropSubmitting ? (
            <article
              role="listitem"
              className="styles-library-tile styles-library-processing-tile"
              aria-live="polite"
              aria-label="Processing dropped style image"
            >
              <div className="styles-library-processing-content" role="status">
                <span className="styles-library-tile-title styles-library-processing-title">
                  Processing image
                </span>
                <span className="styles-library-tile-preview styles-library-processing-preview">
                  <span className="styles-library-processing-spinner" aria-hidden="true">
                    <CircleNotch size={24} weight="bold" />
                  </span>
                  <span className="styles-library-processing-copy tiny">Analyzing style...</span>
                </span>
              </div>
            </article>
          ) : null}
          <article role="listitem" className="styles-library-tile styles-library-add-tile">
            <button
              type="button"
              className="styles-library-tile-select styles-library-add-button"
              aria-label="Add style"
              onClick={openCreateStyleModal}
            >
              <span
                className="styles-library-tile-title styles-library-add-title"
                aria-hidden="true"
              >
                Add style
              </span>
              <span
                className="styles-library-tile-preview styles-library-add-preview"
                aria-hidden="true"
              >
                <span className="styles-library-add-plus">+</span>
                <span className="styles-library-add-label tiny">Add style</span>
              </span>
            </button>
          </article>
        </div>
      </div>
      {pendingStyleEdit ? (
        <AiStudioModalLayer>
          <div
            className="styles-library-edit-modal-backdrop"
            role="presentation"
            onClick={closeEditModal}
          >
            <div
              className="styles-library-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="styles-edit-title"
              onClick={(event) => event.stopPropagation()}
            >
              <p id="styles-edit-title" className="styles-library-edit-title">
                {pendingStyleEdit.mode === "create" ? "Add style" : "Edit style"}
              </p>
              <p className="styles-library-edit-copy tiny subdued">
                {pendingStyleEdit.mode === "create" ? (
                  <>
                    Enter details for <strong>{pendingStyleEdit.styleTitle}</strong>.
                  </>
                ) : (
                  <>
                    Update <strong>{pendingStyleEdit.styleTitle}</strong> details.
                  </>
                )}
              </p>
              <label className="styles-library-edit-field">
                <span className="styles-library-edit-label">Style</span>
                <input
                  type="text"
                  className="styles-library-edit-input"
                  value={pendingStyleEdit.details.style}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setPendingStyleEdit((previous) => {
                      if (!previous) return previous;
                      return {
                        ...previous,
                        details: {
                          ...previous.details,
                          style: nextValue,
                          title: nextValue,
                          referenceImageName: nextValue,
                        },
                      };
                    });
                  }}
                />
              </label>
              <div className="styles-library-edit-field">
                <span className="styles-library-edit-label">Reference Image</span>
                <div
                  className={`styles-library-edit-dropzone ${
                    stylePreviewDropActive ? "is-drop-active" : ""
                  } ${pendingEditPreviewImageUrl ? "has-preview" : ""}`.trim()}
                  role="button"
                  tabIndex={0}
                  aria-label="Drop reference image or click to upload"
                  onClick={() => stylePreviewFileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    stylePreviewFileInputRef.current?.click();
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setStylePreviewDropActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "copy";
                    setStylePreviewDropActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const nextTarget = event.relatedTarget;
                    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                      return;
                    }
                    setStylePreviewDropActive(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setStylePreviewDropActive(false);
                    const dropSnapshot = captureStyleDropSnapshot(event.dataTransfer);
                    void applyStylePreviewFromTransfer(dropSnapshot);
                  }}
                >
                  <input
                    ref={stylePreviewFileInputRef}
                    type="file"
                    accept="image/*"
                    className="styles-library-edit-dropzone-input"
                    onChange={(event) => {
                      const [file] = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      if (!file) return;
                      void applyStylePreviewFile(file);
                    }}
                  />
                  <span
                    className="styles-library-edit-dropzone-preview"
                    style={
                      pendingEditPreviewImageUrl
                        ? {
                            backgroundImage: resolveStylePreviewBackgroundImage(
                              pendingEditPreviewImageUrl
                            ),
                          }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {!pendingEditPreviewImageUrl ? (
                      <span className="styles-library-edit-dropzone-upload" aria-hidden="true">
                        <UploadSimple size={24} weight="bold" />
                        <span className="styles-library-edit-dropzone-upload-copy tiny">
                          Upload image
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="styles-library-edit-dropzone-copy">
                    Drop an image here, or click to upload.
                  </span>
                  <span className="styles-library-edit-dropzone-hint tiny subdued">
                    Image is center-cropped to a square and used on the style card.
                  </span>
                </div>
              </div>
              <div className="styles-library-edit-field">
                <label className="styles-library-edit-label" htmlFor={stylePromptInputId}>
                  Style Prompt
                </label>
                <textarea
                  id={stylePromptInputId}
                  className="styles-library-edit-textarea"
                  rows={5}
                  maxLength={STYLE_PROMPT_MAX_CHARACTERS}
                  value={pendingStyleEdit.details.stylePrompt}
                  onChange={(event) => {
                    const nextValue = event.target.value.slice(0, STYLE_PROMPT_MAX_CHARACTERS);
                    setPendingStyleEdit((previous) => {
                      if (!previous) return previous;
                      return {
                        ...previous,
                        details: {
                          ...previous.details,
                          stylePrompt: nextValue,
                        },
                      };
                    });
                  }}
                />
                <span
                  className={`styles-library-edit-counter tiny subdued ${
                    stylePromptNearLimit ? "is-near-limit" : ""
                  } ${stylePromptAtLimit ? "is-limit-reached" : ""}`.trim()}
                  aria-live="polite"
                >
                  {stylePromptCharacterCount} / {STYLE_PROMPT_MAX_CHARACTERS}
                </span>
              </div>
              {pendingStyleEdit.mode === "create" && stylePromptExtractionSubmitting ? (
                <p className="styles-library-edit-copy tiny subdued">Analyzing style...</p>
              ) : null}
              {pendingStyleEdit.mode === "create" && stylePromptExtractionError ? (
                <p className="styles-library-edit-error tiny">{stylePromptExtractionError}</p>
              ) : null}
              {saveError ? <p className="styles-library-edit-error tiny">{saveError}</p> : null}
              {localSaveError ? (
                <p className="styles-library-edit-error tiny">{localSaveError}</p>
              ) : null}
              <div className="styles-library-edit-actions">
                <button
                  type="button"
                  className="ghost-btn mini styles-library-edit-action-btn"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ghost-btn mini styles-library-edit-action-btn styles-library-edit-save"
                  disabled={
                    editSubmitting ||
                    (pendingStyleEdit.mode === "create" && stylePromptExtractionSubmitting)
                  }
                  onClick={() => {
                    void handleSaveStyleDetails();
                  }}
                >
                  {pendingStyleEdit.mode === "create" && stylePromptExtractionSubmitting
                    ? "Analyzing style..."
                    : editSubmitting
                      ? "Saving..."
                      : pendingStyleEdit.mode === "create"
                        ? "Save style"
                        : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}
      {pendingDeleteStyle ? (
        <AiStudioModalLayer>
          <ConfirmationModal
            title="Delete this style?"
            body={
              <div>
                <p>
                  <strong>{pendingDeleteStyle.title}</strong> will be removed permanently from your
                  style library.
                </p>
                {deleteError ? <p>{deleteError}</p> : null}
                {localDeleteError ? <p>{localDeleteError}</p> : null}
              </div>
            }
            confirmLabel="Delete"
            confirmBusyLabel={deleteSubmitting ? "Deleting..." : undefined}
            confirmDisabled={deleteSubmitting}
            cancelDisabled={deleteSubmitting}
            onCancel={closeDeleteModal}
            onConfirm={() => {
              void handleDeleteConfirm();
            }}
          />
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
}
