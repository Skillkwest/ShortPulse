/**
 * Primary Styles library panel for AI Studio.
 * Presentational surface wired to the style-creator controller.
 */
import React from "react";
import { ArrowCounterClockwise, CircleNotch, Prohibit, UploadSimple, X } from "phosphor-react";
import type { StylesLibraryStyleDetails } from "../types";
import type { StylesLibraryReorderPlacement } from "../logic/stylesLibraryCatalog";
import {
  NONE_STYLE_ID,
  prependNoneStyleTile,
  resolveStylePreviewBackgroundImage,
  type ExpertEditStyleTile,
} from "./edit/expertEditStyles";
import {
  STYLE_PROMPT_MAX_CHARACTERS,
  STYLE_PROMPT_NEAR_LIMIT_CHARACTERS,
} from "./style-creator/constants";
import { captureStyleDropSnapshot, type ResolveInternalStyleDrop } from "./style-creator/intake";
import { useStyleCreatorController } from "./style-creator/useStyleCreatorController";
import { AppMessage, useTransientAppMessage } from "../../../components/AppMessage";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import styleLibraryStyles from "../../../styles/ai-studio-styles-library.module.css";

export type StylesLibraryPanelProps = {
  styles: readonly ExpertEditStyleTile[];
  onReorderStyle?: (
    sourceStyleId: string,
    targetStyleId: string,
    placement?: StylesLibraryReorderPlacement
  ) => Promise<void> | void;
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
  deleteError?: string | null;
  onRestoreBuiltInStyles?: () => Promise<boolean> | boolean;
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
  onRestoreBuiltInStyles,
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
    dropTargetStyle,
    pendingDeleteStyle,
    pendingStyleEdit,
    deleteSubmitting,
    editSubmitting,
    createStyleFromDropSubmitting,
    stylesLibraryDropActive,
    stylePreviewDropActive,
    stylePreviewGenerationStyleIds,
    localDeleteError,
    localSaveError,
    stylesLibraryDropError,
    stylePreviewGenerationError,
    stylePromptExtractionSubmitting,
    stylePromptExtractionError,
    setPendingDeleteStyle,
    setPendingStyleEdit,
    setStylePreviewDropActive,
    setLocalDeleteError,
    closeDeleteModal,
    closeEditModal,
    dismissStylesLibraryDropError,
    dismissStylePreviewGenerationError,
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
    handleStyleGridDragOver,
    handleStyleGridDrop,
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
    () => prependNoneStyleTile(renderedStyles),
    [renderedStyles]
  );
  const [restoreConfirmOpen, setRestoreConfirmOpen] = React.useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = React.useState(false);
  const [restoreError, setRestoreError] = React.useState<string | null>(null);
  const {
    message: restoreStatus,
    show: showRestoreStatus,
    clear: clearRestoreStatus,
  } = useTransientAppMessage();
  const stylePromptCharacterCount = pendingStyleEdit?.details.stylePrompt.length ?? 0;
  const stylePromptNearLimit = stylePromptCharacterCount >= STYLE_PROMPT_NEAR_LIMIT_CHARACTERS;
  const stylePromptAtLimit = stylePromptCharacterCount >= STYLE_PROMPT_MAX_CHARACTERS;
  const isPendingBuiltInView = pendingStyleEdit?.mode === "view";
  const isAnyStylesModalOpen = Boolean(
    pendingStyleEdit || pendingDeleteStyle || restoreConfirmOpen
  );
  useAiStudioModalActivity("styles-library-modal", isAnyStylesModalOpen);
  const editBackdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(closeEditModal);
  const handleRestoreBuiltInStyles = React.useCallback(async () => {
    if (restoreSubmitting) return;
    setRestoreSubmitting(true);
    setRestoreError(null);
    clearRestoreStatus();
    try {
      const restored = onRestoreBuiltInStyles ? await onRestoreBuiltInStyles() : false;
      if (!restored) {
        setRestoreError("Unable to restore built-in styles right now.");
        return;
      }
      showRestoreStatus("Built-in styles restored.", "success");
      setRestoreConfirmOpen(false);
    } catch {
      setRestoreError("Unable to restore built-in styles right now.");
    } finally {
      setRestoreSubmitting(false);
    }
  }, [clearRestoreStatus, onRestoreBuiltInStyles, restoreSubmitting, showRestoreStatus]);

  return (
    <section
      className={`styles-library-panel ${styleLibraryStyles.bootstrapStyleScope} ${
        stylesLibraryDropActive ? "is-drop-active" : ""
      }`.trim()}
      aria-label="Styles library"
      onDragEnter={handleStylesLibraryDragEnter}
      onDragOver={handleStylesLibraryDragOver}
      onDragLeave={handleStylesLibraryDragLeave}
      onDrop={handleStylesLibraryDrop}
    >
      <header className="styles-library-header">
        <div className="styles-library-header-row">
          <p className="eyebrow">Styles Library</p>
          {onRestoreBuiltInStyles ? (
            <button
              type="button"
              className="styles-library-restore-btn"
              disabled={restoreSubmitting}
              onClick={() => {
                setRestoreError(null);
                clearRestoreStatus();
                setRestoreConfirmOpen(true);
              }}
            >
              <ArrowCounterClockwise size={15} weight="bold" aria-hidden="true" />
              <span>{restoreSubmitting ? "Restoring..." : "Restore built-ins"}</span>
            </button>
          ) : null}
        </div>
        <p className="tiny subdued helper-text">
          Browse all loaded styles. Drag an image from your computer, Reference Grid, or Quick Slot
          to create a style.
        </p>
        {restoreStatus ? (
          <AppMessage
            className={`styles-library-restore-message tiny ${
              restoreStatus.fading ? "is-fading" : ""
            }`.trim()}
            tone="success"
            mode="inline"
            message={restoreStatus.message}
          />
        ) : null}
        {restoreError && !restoreConfirmOpen ? (
          <AppMessage
            className="styles-library-restore-message tiny"
            tone="error"
            mode="inline"
            message={restoreError}
          />
        ) : null}
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
          <AppMessage
            className="styles-library-drop-error tiny"
            tone="error"
            mode="inline"
            title="Style creation issue"
            message={stylesLibraryDropError}
            onDismiss={dismissStylesLibraryDropError}
          />
        ) : null}
        {stylePreviewGenerationError ? (
          <AppMessage
            className="styles-library-drop-error tiny"
            tone="error"
            mode="inline"
            title="Style preview not created"
            message={stylePreviewGenerationError}
            onDismiss={dismissStylePreviewGenerationError}
          />
        ) : null}
      </header>
      <div
        className={`styles-library-scroll ${
          stylesLibraryDropActive ? "is-external-drop-active" : ""
        }`.trim()}
      >
        <div
          className="styles-library-grid"
          role="list"
          aria-label="Styles library tiles"
          onDragOver={handleStyleGridDragOver}
          onDrop={handleStyleGridDrop}
        >
          {stylesWithNoneFirst.map((style) => {
            const isNoneStyle = style.id === NONE_STYLE_ID;
            const isStylePreviewGenerating = stylePreviewGenerationStyleIds.includes(style.id);
            return (
              <article
                key={style.id}
                role="listitem"
                className={`styles-library-tile ${draggedStyleId === style.id ? "is-dragging" : ""} ${
                  dropTargetStyle?.styleId === style.id ? "is-drop-target" : ""
                } ${
                  dropTargetStyle?.styleId === style.id
                    ? `is-drop-${dropTargetStyle.placement}`
                    : ""
                } ${style.placeholder ? "is-placeholder" : ""} ${
                  isStylePreviewGenerating ? "is-preview-generating" : ""
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
                  aria-label={`Style tile: ${style.title}${style.placeholder ? " (coming soon)" : ""}${
                    isStylePreviewGenerating ? " (generating)" : ""
                  }`}
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
                    aria-hidden={isStylePreviewGenerating ? undefined : "true"}
                  >
                    {style.placeholder ? (
                      <span className="styles-library-tile-coming-soon">Coming soon</span>
                    ) : isStylePreviewGenerating ? (
                      <span className="styles-library-preview-generating" role="status">
                        <span className="styles-library-processing-spinner" aria-hidden="true">
                          <CircleNotch size={22} weight="bold" />
                        </span>
                        <span className="styles-library-processing-copy tiny">Generating...</span>
                      </span>
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
          <div className={styleLibraryStyles.bootstrapStyleScope}>
            <div
              {...editBackdropDismiss}
              className="styles-library-edit-modal-backdrop"
              role="presentation"
            >
              <div
                className="styles-library-edit-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="styles-edit-title"
                onClick={(event) => event.stopPropagation()}
              >
                <p id="styles-edit-title" className="styles-library-edit-title">
                  {pendingStyleEdit.mode === "create"
                    ? "Add style"
                    : isPendingBuiltInView
                      ? "Built-in style"
                      : "Edit style"}
                </p>
                <p className="styles-library-edit-copy tiny subdued">
                  {pendingStyleEdit.mode === "create" ? (
                    <>
                      Enter details for <strong>{pendingStyleEdit.styleTitle}</strong>.
                    </>
                  ) : isPendingBuiltInView ? (
                    <>
                      <strong>{pendingStyleEdit.styleTitle}</strong> is managed globally by
                      ShortPulse. You can delete it from your library without changing the built-in
                      style for anyone else.
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
                    readOnly={isPendingBuiltInView}
                    onChange={(event) => {
                      if (isPendingBuiltInView) return;
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
                    tabIndex={isPendingBuiltInView ? -1 : 0}
                    aria-label="Drop reference image or click to upload"
                    aria-disabled={isPendingBuiltInView}
                    onClick={() => {
                      if (isPendingBuiltInView) return;
                      stylePreviewFileInputRef.current?.click();
                    }}
                    onKeyDown={(event) => {
                      if (isPendingBuiltInView) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      stylePreviewFileInputRef.current?.click();
                    }}
                    onDragEnter={(event) => {
                      if (isPendingBuiltInView) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setStylePreviewDropActive(true);
                    }}
                    onDragOver={(event) => {
                      if (isPendingBuiltInView) return;
                      event.preventDefault();
                      event.stopPropagation();
                      event.dataTransfer.dropEffect = "copy";
                      setStylePreviewDropActive(true);
                    }}
                    onDragLeave={(event) => {
                      if (isPendingBuiltInView) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const nextTarget = event.relatedTarget;
                      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                        return;
                      }
                      setStylePreviewDropActive(false);
                    }}
                    onDrop={(event) => {
                      if (isPendingBuiltInView) return;
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
                      disabled={isPendingBuiltInView}
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
                      {isPendingBuiltInView
                        ? "Preview image is managed by the global built-in style."
                        : "Drop an image here, or click to upload."}
                    </span>
                    <span className="styles-library-edit-dropzone-hint tiny subdued">
                      {isPendingBuiltInView
                        ? "Admins can change built-in style previews from Agent Instructions."
                        : "Image is center-cropped to a square and used on the style card."}
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
                    readOnly={isPendingBuiltInView}
                    onChange={(event) => {
                      if (isPendingBuiltInView) return;
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
                  <AppMessage
                    className="styles-library-edit-error tiny"
                    tone="error"
                    mode="inline"
                    message={stylePromptExtractionError}
                  />
                ) : null}
                {saveError ? (
                  <AppMessage
                    className="styles-library-edit-error tiny"
                    tone="error"
                    mode="inline"
                    message={saveError}
                  />
                ) : null}
                {localSaveError ? (
                  <AppMessage
                    className="styles-library-edit-error tiny"
                    tone="error"
                    mode="inline"
                    message={localSaveError}
                  />
                ) : null}
                <div className="styles-library-edit-actions">
                  <button
                    type="button"
                    className="ghost-btn mini styles-library-edit-action-btn"
                    onClick={closeEditModal}
                  >
                    {isPendingBuiltInView ? "Close" : "Cancel"}
                  </button>
                  {!isPendingBuiltInView ? (
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
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}
      {pendingDeleteStyle ? (
        <AiStudioModalLayer>
          <div className={styleLibraryStyles.bootstrapStyleScope}>
            <ConfirmationModal
              title="Delete this style?"
              body={
                <div>
                  {pendingDeleteStyle.source === "built_in" ? (
                    <p>
                      <strong>{pendingDeleteStyle.title}</strong> will be removed from your style
                      library. The built-in style stays managed by ShortPulse and can be restored.
                    </p>
                  ) : (
                    <p>
                      <strong>{pendingDeleteStyle.title}</strong> will be removed permanently from
                      your style library.
                    </p>
                  )}
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
          </div>
        </AiStudioModalLayer>
      ) : null}
      {restoreConfirmOpen ? (
        <AiStudioModalLayer>
          <div className={styleLibraryStyles.bootstrapStyleScope}>
            <ConfirmationModal
              title="Restore built-in styles?"
              body={
                <div>
                  <p>Restore the current ShortPulse built-in Styles to your style library.</p>
                  <p>Your custom Styles stay unchanged. The built-in order returns to default.</p>
                  {restoreError ? <p>{restoreError}</p> : null}
                </div>
              }
              confirmLabel="Restore"
              confirmBusyLabel={restoreSubmitting ? "Restoring..." : undefined}
              confirmDisabled={restoreSubmitting}
              cancelDisabled={restoreSubmitting}
              onCancel={() => {
                if (restoreSubmitting) return;
                setRestoreConfirmOpen(false);
              }}
              onConfirm={() => {
                void handleRestoreBuiltInStyles();
              }}
            />
          </div>
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
}
