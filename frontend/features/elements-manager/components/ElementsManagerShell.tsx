/**
 * Elements library shell.
 * Hosts the embedded Elements library with a manage-first surface and inline editor column.
 */
import React from "react";
import Image from "next/image";
import { Trash, UploadSimple } from "phosphor-react";
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
} from "../../../lib/internalReferenceDragPayload";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { readMediaLibraryDragPayload } from "../../ai-studio/logic/mediaLibraryDragPayload";
import { uploadImageToStorage } from "../../ai-studio/utils/imageUpload";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
import { ElementsDescriptionEditorCard } from "./ElementsDescriptionEditorCard";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";

type ElementsManagerShellProps = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  externalCreateRequestKey?: number;
};

const IMAGE_REFERENCE_SLOT_LABELS = ["Primary Look", "Secondary Angle", "Detail Shot"] as const;
const ELEMENT_DESCRIPTION_MAX_LENGTH = 150;

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
    isEditorOpen,
    draft,
    error,
    loading,
    isSavingElement,
    hasUnsavedElementDraft,
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
    reportSaveElementRequired,
  } = useElementsManagerViewState({
    resolveProfileImageDropSource,
  });
  const lastHandledExternalCreateRequestKeyRef = React.useRef(0);
  const [activeSheetDropIndex, setActiveSheetDropIndex] = React.useState<number | null>(null);
  const showSaveAction = isEditorOpen && hasUnsavedElementDraft;
  const selectedElement = elements.find((item) => item.id === selectedElementId) ?? null;
  const selectedElementName = selectedElement?.name || "Untitled element";

  React.useEffect(() => {
    if (externalCreateRequestKey === 0) return;
    if (lastHandledExternalCreateRequestKeyRef.current === externalCreateRequestKey) return;
    lastHandledExternalCreateRequestKeyRef.current = externalCreateRequestKey;
    onCreateElement();
  }, [externalCreateRequestKey, onCreateElement]);

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
      if (hasUnsavedElementDraft) {
        reportSaveElementRequired();
        return;
      }
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
      hasUnsavedElementDraft,
      reportSaveElementRequired,
      resolveDroppedReferenceUrl,
    ]
  );

  const editorBody = (
    <>
      <div className="elements-profile-fields">
        <label className="control-row elements-profile-field" htmlFor="element-manager-name">
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

      <div className="elements-profile-sheet-panel">
        <div className="elements-references-title-row elements-profile-fields">
          <p className="input-label">References</p>
        </div>
        <div
          className={`elements-references-grid ${
            draft.assetType === "image"
              ? "elements-references-grid--image"
              : "elements-references-grid--video"
          }`}
        >
          {(draft.assetType === "image" ? IMAGE_REFERENCE_SLOT_LABELS : ["Motion Reference"]).map(
            (slotLabel, index) => {
              const slotValue =
                draft.assetType === "image"
                  ? (draft.imageReferenceUrls[index] ?? "")
                  : draft.videoReferenceUrl;
              return (
                <article
                  key={`${slotLabel}-${index + 1}`}
                  className={`elements-reference-card ${
                    slotValue ? "is-filled" : "is-empty"
                  } ${activeSheetDropIndex === index ? "is-drop-active" : ""}`}
                  onDragEnter={handleSheetDragEnter(index)}
                  onDragOver={handleSheetDragOver(index)}
                  onDragLeave={() => {
                    setActiveSheetDropIndex((current) => (current === index ? null : current));
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
                            draft.assetType === "image" && index < 2 ? "is-required" : "is-optional"
                          }`}
                        >
                          {draft.assetType === "video"
                            ? "(Required)"
                            : draft.assetType === "image" && index < 2
                              ? "(Required)"
                              : "(Optional)"}
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="elements-reference-empty-hint">{slotLabel}</span>
                </article>
              );
            }
          )}
        </div>

        <ElementsDescriptionEditorCard
          description={draft.description}
          maxLength={ELEMENT_DESCRIPTION_MAX_LENGTH}
          rows={6}
          disabled={false}
          onChangeDescription={(value) => updateDraftField("description", value)}
        />
      </div>
    </>
  );

  return (
    <div className="elements-manager-shell elements-manager-shell--panel" data-surface="panel">
      {error ? <p className="tiny elements-manager-feedback">{error}</p> : null}

      <div className="elements-library-workspace">
        <section className="elements-library-column">
          <div className="elements-manage-header-row">
            <div className="elements-manage-title-stack">
              <h2>Elements Library</h2>
              <p className="tiny subdued elements-manage-helper">
                Select an element to edit its details.
              </p>
            </div>
            <div className="elements-manage-header-actions">
              <button
                type="button"
                className="elements-manage-delete-btn"
                onClick={() => {
                  if (!selectedElementId) return;
                  onRequestDeleteElement(selectedElementId);
                }}
                disabled={!selectedElementId}
                aria-label={
                  selectedElementId ? `Delete element: ${selectedElementName}` : "Delete element"
                }
              >
                <Trash size={14} weight="bold" aria-hidden="true" />
                <span>Delete</span>
              </button>
              <button
                type="button"
                className="elements-manage-create-btn"
                onClick={onCreateElement}
              >
                <span>+ Create</span>
              </button>
            </div>
          </div>

          <div className="elements-manage-chip-container">
            <div className="elements-manage-list" role="list" aria-label="Element list">
              {elements.map((item) => {
                const isSelected = item.id === selectedElementId;
                const itemName = item.name || "Untitled element";
                return (
                  <article
                    key={item.id}
                    role="listitem"
                    className={`elements-list-card ${isSelected ? "is-active" : ""}`}
                    onClick={(event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest(".elements-list-select-btn")) {
                        return;
                      }
                      onSelectElement(item.id);
                    }}
                  >
                    <button
                      type="button"
                      className="elements-list-select-btn"
                      aria-label={`Edit element: ${itemName}`}
                      onClick={() => onSelectElement(item.id)}
                    >
                      <div className="elements-list-main">
                        <span className="elements-list-avatar" aria-hidden="true">
                          {item.profileImageUrl ? (
                            <div
                              className="elements-list-avatar-image"
                              style={{
                                backgroundImage: `url("${item.profileImageUrl}")`,
                                backgroundRepeat: "no-repeat",
                                backgroundSize: "cover",
                                backgroundPosition: "center center",
                              }}
                            />
                          ) : (
                            <span className="elements-list-avatar-initials">
                              {buildElementInitials(itemName)}
                            </span>
                          )}
                        </span>
                        <div className="elements-list-copy">
                          <p className="metric-label tiny">{isSelected ? "Selected" : "Element"}</p>
                          <p className="elements-list-name">{itemName}</p>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="elements-editor-column" aria-label="Element editor">
          <div className="elements-editor-column-panel">
            {isEditorOpen ? (
              <div className="elements-editor-column-body">{editorBody}</div>
            ) : (
              <section className="elements-editor-column-empty">
                <h3>Element Profile</h3>
                <p className="tiny subdued">
                  Select an element from the library or create a new one to edit its details here.
                </p>
              </section>
            )}

            {showSaveAction ? (
              <div className="elements-editor-column-footer">
                <button
                  type="button"
                  className="elements-manage-create-btn elements-manage-save-btn"
                  onClick={onSaveElement}
                  disabled={!hasUnsavedElementDraft || isSavingElement || loading}
                >
                  {isSavingElement ? "Saving..." : "Save Element"}
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {pendingDeleteElementId ? (
        <ConfirmationModal
          title="Delete this element?"
          titleId="delete-element-title"
          body={<p>This element will be removed permanently from your Elements library.</p>}
          confirmLabel="Delete"
          onCancel={onCancelDeleteElement}
          onConfirm={onConfirmDeleteElement}
        />
      ) : null}
    </div>
  );
}
