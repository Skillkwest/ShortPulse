/**
 * Elements library shell.
 * Mirrors the embedded Character panel contract while preserving the Elements save/runtime model.
 */
import React from "react";
import Image from "next/image";
import {
  CheckCircle,
  FloppyDisk,
  FolderSimple,
  Plus,
  Trash,
  UploadSimple,
  X,
} from "phosphor-react";
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
} from "../../../lib/internalReferenceDragPayload";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import {
  AiStudioPickerCard,
  AiStudioPickerFeedback,
  AiStudioPickerGrid,
  AiStudioPickerModalFrame,
  AiStudioPickerSection,
} from "../../ai-studio/components/picker/AiStudioPickerPrimitives";
import { readMediaLibraryDragPayload } from "../../ai-studio/logic/mediaLibraryDragPayload";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";
import { uploadImageToStorage } from "../../ai-studio/utils/imageUpload";
import { buildElementProfileImageBackgroundStyle } from "../logic/elementProfileImageTransform";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
import { ElementsDescriptionEditorCard } from "./ElementsDescriptionEditorCard";

type ElementsManagerShellProps = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  externalCreateRequestKey?: number;
};

const IMAGE_REFERENCE_SLOT_LABELS = ["Primary View", "Secondary View", "Detail View"] as const;
const ELEMENT_DESCRIPTION_MAX_LENGTH = 150;
const ELEMENT_LIBRARY_AVATAR_SIZE_PX = 44;
const ELEMENT_SAVE_SUCCESS_BADGE_DURATION_MS = 2200;

const buildElementInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "EL";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
};

export function ElementsManagerShell({
  resolveProfileImageDropSource,
  externalCreateRequestKey = 0,
}: ElementsManagerShellProps) {
  const {
    elements,
    selectedElementId,
    pendingDeleteElementId,
    draft,
    error,
    loading,
    isCreatingElement,
    isDeletingElement,
    isSwitchingElement,
    isSavingElement,
    updateDraftField,
    assignActiveImageReferenceAtIndex,
    assignActiveVideoReference,
    clearActiveImageReferenceAtIndex,
    clearActiveVideoReference,
    onCreateElement,
    onSaveElement,
    onSelectElement,
    onRequestDeleteElement,
    onCancelDeleteElement,
    onConfirmDeleteElement,
  } = useElementsManagerViewState({
    resolveProfileImageDropSource,
  });
  const lastHandledExternalCreateRequestKeyRef = React.useRef(0);
  const [activeSheetDropIndex, setActiveSheetDropIndex] = React.useState<number | null>(null);
  const [isElementLibraryModalOpen, setIsElementLibraryModalOpen] = React.useState(false);
  const [showSaveSuccessIndicator, setShowSaveSuccessIndicator] = React.useState(false);
  const saveSuccessHideTimerRef = React.useRef<number | null>(null);
  const selectedElement = elements.find((item) => item.id === selectedElementId) ?? null;
  const pendingDeleteElement =
    elements.find((item) => item.id === pendingDeleteElementId) ?? selectedElement ?? null;
  const selectedElementName = selectedElement?.name || "Untitled element";
  const structuralBusy = loading || isSwitchingElement || isCreatingElement || isDeletingElement;
  const pageBusy = structuralBusy || isSavingElement;
  const libraryButtonDisabled =
    loading || isSwitchingElement || isCreatingElement || isDeletingElement;
  const librarySelectionDisabled = pageBusy;
  const createActionDisabled = pageBusy;
  const saveActionDisabled = pageBusy;

  React.useEffect(() => {
    if (externalCreateRequestKey === 0) return;
    if (lastHandledExternalCreateRequestKeyRef.current === externalCreateRequestKey) return;
    lastHandledExternalCreateRequestKeyRef.current = externalCreateRequestKey;
    setIsElementLibraryModalOpen(false);
    setShowSaveSuccessIndicator(false);
    void onCreateElement();
  }, [externalCreateRequestKey, onCreateElement]);

  React.useEffect(
    () => () => {
      if (saveSuccessHideTimerRef.current) {
        window.clearTimeout(saveSuccessHideTimerRef.current);
      }
    },
    []
  );

  const canAcceptSheetDrop = React.useCallback(
    (transfer: DataTransfer | null | undefined): boolean => {
      if (!transfer) return false;
      const libraryPayload = readMediaLibraryDragPayload(transfer);
      const canAcceptLibraryMedia =
        libraryPayload?.kind === "libraryMedia" &&
        ((draft.assetType === "image" && libraryPayload.payload.fileType === "image") ||
          (draft.assetType === "video" && libraryPayload.payload.fileType === "video"));
      const canAcceptLocalImageFile =
        draft.assetType === "image" &&
        Array.from(transfer.files ?? []).some((file) => file.type.startsWith("image/"));
      return Boolean(
        canAcceptLocalImageFile ||
        canAcceptLibraryMedia ||
        extractInternalReferenceDragPayload(transfer) ||
        hasInternalReferenceDragTypeHints(transfer)
      );
    },
    [draft.assetType]
  );

  const resolveDroppedReferenceUrl = React.useCallback(
    async (transfer: DataTransfer): Promise<string | null> => {
      const localImageFile =
        draft.assetType === "image"
          ? (Array.from(transfer.files ?? []).find((file) => file.type.startsWith("image/")) ??
            null)
          : null;
      if (localImageFile) {
        const localObjectUrl = URL.createObjectURL(localImageFile);
        try {
          return await uploadImageToStorage(localObjectUrl);
        } finally {
          URL.revokeObjectURL(localObjectUrl);
        }
      }

      const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
      if (mediaLibraryPayload?.kind === "libraryMedia") {
        if (
          (draft.assetType === "image" && mediaLibraryPayload.payload.fileType !== "image") ||
          (draft.assetType === "video" && mediaLibraryPayload.payload.fileType !== "video")
        ) {
          return null;
        }
        const mediaLibraryUrl =
          mediaLibraryPayload.payload.fullUrl?.trim() ||
          mediaLibraryPayload.payload.url?.trim() ||
          mediaLibraryPayload.payload.previewUrl?.trim() ||
          null;
        if (!mediaLibraryUrl) return null;
        if (
          draft.assetType === "image" &&
          (mediaLibraryUrl.startsWith("blob:") || mediaLibraryUrl.startsWith("data:image/"))
        ) {
          return await uploadImageToStorage(mediaLibraryUrl);
        }
        return mediaLibraryUrl;
      }

      const payload = extractInternalReferenceDragPayload(transfer);
      if (!payload) return null;

      const directReferenceUrl =
        payload.referenceUrl?.trim() || payload.referenceRenderUrl?.trim() || null;

      if (!resolveProfileImageDropSource) {
        if (
          directReferenceUrl?.startsWith("blob:") ||
          directReferenceUrl?.startsWith("data:image/")
        ) {
          return await uploadImageToStorage(directReferenceUrl);
        }
        return directReferenceUrl;
      }

      try {
        const resolvedSource = await resolveProfileImageDropSource(payload);
        const resolvedReferenceUrl =
          resolvedSource?.preparedImageUrl?.trim() ||
          resolvedSource?.preview.url?.trim() ||
          directReferenceUrl;
        if (!resolvedReferenceUrl) return null;
        if (
          resolvedReferenceUrl.startsWith("blob:") ||
          resolvedReferenceUrl.startsWith("data:image/")
        ) {
          return await uploadImageToStorage(resolvedReferenceUrl);
        }
        return resolvedReferenceUrl;
      } catch {
        if (!directReferenceUrl) return null;
        if (
          directReferenceUrl.startsWith("blob:") ||
          directReferenceUrl.startsWith("data:image/")
        ) {
          return await uploadImageToStorage(directReferenceUrl);
        }
        return directReferenceUrl;
      }
    },
    [draft.assetType, resolveProfileImageDropSource]
  );

  const handleSheetDragEnter = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptSheetDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setActiveSheetDropIndex(slotIndex);
    },
    [canAcceptSheetDrop]
  );

  const handleSheetDragOver = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptSheetDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setActiveSheetDropIndex(slotIndex);
    },
    [canAcceptSheetDrop]
  );

  const handleSheetDrop = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptSheetDrop(event.dataTransfer)) return;
      event.preventDefault();
      setActiveSheetDropIndex(null);
      void resolveDroppedReferenceUrl(event.dataTransfer).then((droppedReferenceUrl) => {
        if (!droppedReferenceUrl) return;
        if (draft.assetType === "video") {
          assignActiveVideoReference(droppedReferenceUrl);
          return;
        }
        assignActiveImageReferenceAtIndex(slotIndex, droppedReferenceUrl);
      });
    },
    [
      assignActiveImageReferenceAtIndex,
      assignActiveVideoReference,
      canAcceptSheetDrop,
      draft.assetType,
      resolveDroppedReferenceUrl,
    ]
  );

  const handleElementSelection = React.useCallback(
    (elementId: string) => {
      if (librarySelectionDisabled) return;
      setIsElementLibraryModalOpen(false);
      setShowSaveSuccessIndicator(false);
      onSelectElement(elementId);
    },
    [librarySelectionDisabled, onSelectElement]
  );

  const handleCreateNewElement = React.useCallback(() => {
    if (createActionDisabled) return;
    setIsElementLibraryModalOpen(false);
    setShowSaveSuccessIndicator(false);
    onCreateElement();
  }, [createActionDisabled, onCreateElement]);

  const triggerSaveSuccessIndicator = React.useCallback(() => {
    setShowSaveSuccessIndicator(true);
    if (saveSuccessHideTimerRef.current) {
      window.clearTimeout(saveSuccessHideTimerRef.current);
    }
    saveSuccessHideTimerRef.current = window.setTimeout(() => {
      setShowSaveSuccessIndicator(false);
      saveSuccessHideTimerRef.current = null;
    }, ELEMENT_SAVE_SUCCESS_BADGE_DURATION_MS);
  }, []);

  const handleSaveElement = React.useCallback(async () => {
    setShowSaveSuccessIndicator(false);
    const saved = await onSaveElement();
    if (saved) {
      triggerSaveSuccessIndicator();
    }
  }, [onSaveElement, triggerSaveSuccessIndicator]);

  return (
    <div className="elements-manager-shell elements-manager-shell--panel" data-surface="panel">
      <div className="elements-panel-workspace">
        {error ? (
          <div className="elements-feedback error" role="status">
            <span>{error}</span>
          </div>
        ) : null}

        <p className="sr-only" role="status" aria-live="polite">
          {isSavingElement ? "Saving element..." : ""}
        </p>

        <div className="elements-panel-library-workspace">
          <section className="elements-panel-editor-column" aria-label="Element editor">
            <div className="elements-panel-editor-column-panel">
              <div className="elements-profile-card">
                <div className="elements-panel-profile-top-row">
                  <div className="elements-panel-top-row-primary-actions">
                    <button
                      type="button"
                      className="elements-panel-action-btn elements-panel-action-btn--picker-accent elements-panel-elements-btn"
                      onClick={() => setIsElementLibraryModalOpen(true)}
                      disabled={libraryButtonDisabled && elements.length === 0}
                    >
                      <FolderSimple size={20} weight="fill" aria-hidden />
                      <span>Elements</span>
                    </button>
                  </div>

                  <div className="elements-panel-top-row-secondary-actions">
                    {isSavingElement ? (
                      <span
                        className="elements-panel-save-progress"
                        role="status"
                        aria-live="polite"
                        aria-label="Saving element"
                      >
                        <span className="elements-panel-save-progress-spinner" aria-hidden="true" />
                        <span>Saving...</span>
                      </span>
                    ) : null}
                    {showSaveSuccessIndicator ? (
                      <span
                        className="elements-panel-save-success"
                        role="status"
                        aria-live="polite"
                        aria-label={`${selectedElementName} saved`}
                      >
                        <CheckCircle size={14} weight="fill" aria-hidden />
                        <span>Saved</span>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="elements-panel-action-btn"
                      aria-label={isSavingElement ? "Saving..." : "Save"}
                      title={isSavingElement ? "Saving..." : "Save"}
                      onClick={() => {
                        void handleSaveElement();
                      }}
                      disabled={saveActionDisabled}
                    >
                      <FloppyDisk size={20} weight="fill" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="elements-panel-action-btn elements-panel-action-btn--picker-accent"
                      onClick={() => {
                        handleCreateNewElement();
                      }}
                      disabled={createActionDisabled}
                    >
                      <Plus size={14} weight="bold" aria-hidden />
                      <span>Create</span>
                    </button>
                  </div>
                </div>

                <div className="elements-panel-profile-fields-row">
                  <label className="elements-profile-field" htmlFor="element-manager-name">
                    <span className="input-label">Name:</span>
                    <input
                      id="element-manager-name"
                      className="elements-name-input"
                      type="text"
                      value={draft.name}
                      onChange={(event) => updateDraftField("name", event.target.value)}
                      placeholder="Enter element name"
                    />
                  </label>
                </div>

                <div className="elements-panel-preset-content-grid">
                  <div className="elements-panel-preset-description-column">
                    <ElementsDescriptionEditorCard
                      description={draft.description}
                      maxLength={ELEMENT_DESCRIPTION_MAX_LENGTH}
                      rows={5}
                      disabled={false}
                      onChangeDescription={(value) => updateDraftField("description", value)}
                    />
                  </div>

                  <div className="elements-panel-preset-references-column">
                    <div className="elements-reference-title-row">
                      <p className="input-label">Element References:</p>
                    </div>
                    <div
                      className={`elements-references-grid ${
                        draft.assetType === "image"
                          ? "elements-references-grid--image"
                          : "elements-references-grid--video"
                      }`}
                    >
                      {(draft.assetType === "image"
                        ? IMAGE_REFERENCE_SLOT_LABELS
                        : (["Motion Reference"] as const)
                      ).map((slotLabel, index) => {
                        const slotValue =
                          draft.assetType === "image"
                            ? (draft.imageReferenceUrls[index] ?? "")
                            : draft.videoReferenceUrl;
                        const isRequiredSlot = draft.assetType === "video" || index < 2;
                        return (
                          <article
                            key={`${slotLabel}-${index + 1}`}
                            className={`elements-reference-card ${
                              slotValue ? "is-filled" : "is-empty"
                            } ${activeSheetDropIndex === index ? "is-drop-active" : ""}`}
                            onDragEnter={handleSheetDragEnter(index)}
                            onDragOver={handleSheetDragOver(index)}
                            onDragLeave={() => {
                              setActiveSheetDropIndex((current) =>
                                current === index ? null : current
                              );
                            }}
                            onDrop={(event) => {
                              void handleSheetDrop(index)(event);
                            }}
                          >
                            {slotValue ? (
                              <button
                                type="button"
                                className="elements-reference-delete-btn"
                                aria-label={`Clear ${slotLabel} reference`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (draft.assetType === "video") {
                                    clearActiveVideoReference();
                                    return;
                                  }
                                  clearActiveImageReferenceAtIndex(index);
                                }}
                              >
                                <Trash size={12} weight="bold" />
                              </button>
                            ) : null}
                            <div className="elements-reference-media">
                              {slotValue ? (
                                draft.assetType === "video" ? (
                                  <video
                                    src={slotValue}
                                    aria-label={`${slotLabel} reference`}
                                    className="elements-reference-image"
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                ) : (
                                  <Image
                                    src={slotValue}
                                    alt={`${slotLabel} reference`}
                                    className="elements-reference-image"
                                    width={240}
                                    height={300}
                                    unoptimized
                                  />
                                )
                              ) : (
                                <span className="elements-reference-drop-copy tiny">
                                  <UploadSimple
                                    size={14}
                                    weight="bold"
                                    className="elements-reference-drop-icon"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {draft.assetType === "video"
                                      ? "Drop motion reference here"
                                      : "Drop reference here"}
                                  </span>
                                  <span
                                    className={`elements-reference-drop-requirement ${
                                      isRequiredSlot ? "is-required" : "is-optional"
                                    }`}
                                  >
                                    {isRequiredSlot ? "(Required)" : "(Optional)"}
                                  </span>
                                </span>
                              )}
                            </div>
                            <span className="elements-reference-empty-hint">{slotLabel}</span>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <AiStudioPickerModalFrame
        isOpen={isElementLibraryModalOpen}
        activityId="elements-panel-element-picker"
        ariaLabel="Element library"
        title="Elements"
        subtitle="Browse saved elements and load a profile into the editor."
        onClose={() => setIsElementLibraryModalOpen(false)}
        headerActions={
          <div className="model-modal-header-actions">
            <button
              type="button"
              className="ai-character-picker-library-btn kling-entity-picker-create-btn kling-entity-picker-create-btn--elements"
              disabled={createActionDisabled}
              onClick={() => {
                handleCreateNewElement();
              }}
            >
              + Create New Element
            </button>
            <button
              type="button"
              className="ghost-btn mini model-modal-close"
              aria-label="Close element library"
              onClick={() => setIsElementLibraryModalOpen(false)}
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        }
      >
        <AiStudioPickerSection>
          {elements.length > 0 ? (
            <AiStudioPickerGrid ariaLabel="Saved elements">
              {elements.map((item) => {
                const isSelected = item.id === selectedElementId;
                const itemName = item.name || "Untitled element";
                return (
                  <AiStudioPickerCard
                    key={item.id}
                    isActive={isSelected}
                    className="ai-character-picker-card--element"
                    onSelect={() => {
                      handleElementSelection(item.id);
                    }}
                    disabled={librarySelectionDisabled}
                    avatar={
                      item.profileImageUrl ? (
                        <div
                          className="ai-character-list-avatar-image"
                          style={buildElementProfileImageBackgroundStyle(
                            item.profileImageUrl,
                            item.profileImageTransform,
                            ELEMENT_LIBRARY_AVATAR_SIZE_PX
                          )}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="ai-character-list-avatar-initials">
                          {buildElementInitials(itemName)}
                        </span>
                      )
                    }
                    label={isSelected ? "Selected" : "Element"}
                    name={itemName}
                    footer={
                      <div className="elements-library-card-delete-control">
                        <button
                          type="button"
                          className="ai-character-picker-card-delete-btn"
                          aria-label={`Delete ${itemName}`}
                          disabled={librarySelectionDisabled}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onRequestDeleteElement(item.id);
                          }}
                        >
                          <Trash size={12} weight="bold" aria-hidden />
                        </button>
                      </div>
                    }
                  />
                );
              })}
            </AiStudioPickerGrid>
          ) : (
            <AiStudioPickerFeedback
              isLoading={loading}
              loadingMessage="Loading elements..."
              errorMessage={null}
              emptyMessage="No saved elements yet. Create one to start building your library."
            />
          )}
        </AiStudioPickerSection>
      </AiStudioPickerModalFrame>

      {pendingDeleteElement ? (
        <ConfirmationModal
          title="Delete this element?"
          titleId="delete-element-title"
          body={
            <p>
              <strong>{pendingDeleteElement.name || "Untitled element"}</strong> and its saved
              references will be removed permanently.
            </p>
          }
          confirmLabel="Delete"
          confirmBusyLabel={isDeletingElement ? "Deleting..." : undefined}
          confirmDisabled={isDeletingElement}
          cancelDisabled={isDeletingElement}
          onCancel={onCancelDeleteElement}
          onConfirm={() => {
            void onConfirmDeleteElement();
          }}
        />
      ) : null}
    </div>
  );
}
