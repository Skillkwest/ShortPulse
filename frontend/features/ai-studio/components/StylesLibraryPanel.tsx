/**
 * Primary Styles library panel for AI Studio.
 * Presentational surface wired to the style-creator controller.
 */
import React from "react";
import { Prohibit, X } from "phosphor-react";
import type { StylesLibraryStyleDetails } from "../types";
import { resolveStylePreviewBackgroundImage } from "./edit/expertEditStyles";
import type { ExpertEditStyleTile } from "./edit/expertEditStyles";
import { useStyleCreatorController } from "./style-creator/useStyleCreatorController";

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
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
  deleteError?: string | null;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
  saveError?: string | null;
};

export function StylesLibraryPanel({
  styles,
  selectedStyleId,
  onDeleteStyle,
  deleteError = null,
  onSaveStyleDetails,
  saveError = null,
}: StylesLibraryPanelProps) {
  const stylePreviewFileInputRef = React.useRef<HTMLInputElement | null>(null);

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
    onDeleteStyle,
    onSaveStyleDetails,
  });
  const stylesWithNoneFirst = React.useMemo(
    () => [NONE_STYLE_TILE, ...renderedStyles],
    [renderedStyles]
  );

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
          <p className="styles-library-drop-status tiny subdued">Creating style from image...</p>
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
            const isSelected = isNoneStyle
              ? selectedStyleId == null
              : !style.placeholder && selectedStyleId === style.id;
            return (
              <article
                key={style.id}
                role="listitem"
                className={`styles-library-tile ${isSelected ? "is-selected" : ""} ${
                  draggedStyleId === style.id ? "is-dragging" : ""
                } ${dropTargetStyleId === style.id ? "is-drop-target" : ""} ${
                  style.placeholder ? "is-placeholder" : ""
                }`.trim()}
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
                  aria-pressed={style.placeholder ? undefined : isSelected}
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
                  void applyStylePreviewFromTransfer(event.dataTransfer);
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
                />
                <span className="styles-library-edit-dropzone-copy">
                  Drop an image here, or click to upload.
                </span>
                <span className="styles-library-edit-dropzone-hint tiny subdued">
                  Image is center-cropped to a square and used on the style card.
                </span>
              </div>
            </div>
            <label className="styles-library-edit-field">
              <span className="styles-library-edit-label">Style Prompt</span>
              <textarea
                className="styles-library-edit-textarea"
                rows={5}
                value={pendingStyleEdit.details.stylePrompt}
                onChange={(event) => {
                  const nextValue = event.target.value;
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
            </label>
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
      ) : null}
      {pendingDeleteStyle ? (
        <div
          className="styles-library-delete-modal-backdrop"
          role="presentation"
          onClick={closeDeleteModal}
        >
          <div
            className="styles-library-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="styles-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="styles-delete-title" className="styles-library-delete-title">
              Delete style?
            </p>
            <p className="styles-library-delete-copy tiny subdued">
              Remove <strong>{pendingDeleteStyle.title}</strong> from your style library
              permanently?
            </p>
            {deleteError ? <p className="styles-library-delete-error tiny">{deleteError}</p> : null}
            {localDeleteError ? (
              <p className="styles-library-delete-error tiny">{localDeleteError}</p>
            ) : null}
            <div className="styles-library-delete-actions">
              <button type="button" className="ghost-btn mini" onClick={closeDeleteModal}>
                No
              </button>
              <button
                type="button"
                className="ghost-btn mini styles-library-delete-confirm"
                disabled={deleteSubmitting}
                onClick={() => {
                  void handleDeleteConfirm();
                }}
              >
                {deleteSubmitting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
