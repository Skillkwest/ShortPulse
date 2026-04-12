/**
 * Elements library shell.
 * Hosts the embedded Elements manage/profile workflow while preserving the current panel contract.
 */
import React from "react";
import Image from "next/image";
import { PencilSimpleLine, Plus, Trash, UploadSimple, UserCircle } from "phosphor-react";
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
} from "../../../lib/internalReferenceDragPayload";
import { uploadImageToStorage } from "../../ai-studio/utils/imageUpload";
import { buildElementProfileImageTransformStyle } from "../logic/elementProfileImageTransform";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
import { ElementsCreateWorkspaceSurface } from "./ElementsCreateWorkspaceSurface";
import { ElementsDescriptionEditorCard } from "./ElementsDescriptionEditorCard";
import { ElementsManagerWorkflowTabs } from "./ElementsManagerWorkflowTabs";
import { DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM } from "../constants";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";

type ElementsManagerShellProps = {
  onActiveTabChange?: (activeTab: "manage" | "profile") => void;
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  externalCreateRequestKey?: number;
};

const IMAGE_REFERENCE_SLOT_LABELS = ["Primary Look", "Secondary Angle", "Support Angle"] as const;
const PROFILE_ZOOM_MIN = 1;
const PROFILE_ZOOM_MAX = 2.4;
const PROFILE_OFFSET_MIN = -40;
const PROFILE_OFFSET_MAX = 40;
const PROFILE_PREVIEW_IMAGE_EMBEDDED_SIZE = 92;

const buildElementInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "EL";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
};

const hasLocalImageFileDrag = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  const files = Array.from(transfer.files ?? []);
  if (files.some((file) => file.type.startsWith("image/"))) {
    return true;
  }
  const items = Array.from(transfer.items ?? []);
  return items.some((item) => item.kind === "file" && item.type.startsWith("image/"));
};

const getDroppedLocalImageFile = (transfer: DataTransfer | null | undefined): File | null => {
  if (!transfer) return null;
  const files = Array.from(transfer.files ?? []);
  return files.find((file) => file.type.startsWith("image/")) ?? null;
};

export function ElementsManagerShell({
  onActiveTabChange,
  resolveProfileImageDropSource,
  externalCreateRequestKey = 0,
}: ElementsManagerShellProps) {
  const {
    activeTab,
    elements,
    selectedElementId,
    pendingDeleteElementId,
    draft,
    error,
    loading,
    isSavingElement,
    hasUnsavedElementDraft,
    setActiveTab,
    updateDraftField,
    assignActiveImageReferenceAtIndex,
    assignActiveVideoReference,
    clearActiveImageReferenceAtIndex,
    clearActiveVideoReference,
    onSetProfileImageFile,
    onSetProfileImageFromInternalDrop,
    onSaveProfileImageTransform,
    onClearProfileImage,
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
  const [isProfileAdjusterVisible, setIsProfileAdjusterVisible] = React.useState(false);
  const [profileAdjustDraft, setProfileAdjustDraft] = React.useState<
    typeof draft.profileImageTransform | null
  >(null);
  const [isProfileDropActive, setIsProfileDropActive] = React.useState(false);
  const profileFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const suppressProfilePickerClickRef = React.useRef(false);
  React.useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);

  React.useEffect(() => {
    if (externalCreateRequestKey === 0) return;
    if (lastHandledExternalCreateRequestKeyRef.current === externalCreateRequestKey) return;
    lastHandledExternalCreateRequestKeyRef.current = externalCreateRequestKey;
    onCreateElement();
  }, [externalCreateRequestKey, onCreateElement]);

  React.useEffect(() => {
    setIsProfileAdjusterVisible(false);
    setProfileAdjustDraft(null);
  }, [selectedElementId]);

  const profileImageRenderSize = PROFILE_PREVIEW_IMAGE_EMBEDDED_SIZE;
  const activeProfileImageTransform =
    isProfileAdjusterVisible && profileAdjustDraft
      ? profileAdjustDraft
      : draft.profileImageTransform;

  const openProfilePicker = React.useCallback(() => {
    if (hasUnsavedElementDraft) {
      reportSaveElementRequired();
      return;
    }
    if (suppressProfilePickerClickRef.current) {
      suppressProfilePickerClickRef.current = false;
      return;
    }
    if (draft.profileImageUrl && !isProfileAdjusterVisible) {
      setProfileAdjustDraft(draft.profileImageTransform);
      setIsProfileAdjusterVisible(true);
      return;
    }
    profileFileInputRef.current?.click();
  }, [
    draft.profileImageTransform,
    draft.profileImageUrl,
    hasUnsavedElementDraft,
    isProfileAdjusterVisible,
    reportSaveElementRequired,
  ]);

  const handleProfileSelection = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;
      setProfileAdjustDraft(DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM);
      setIsProfileAdjusterVisible(true);
      void onSetProfileImageFile(file);
    },
    [onSetProfileImageFile]
  );

  const applyProfileImageFile = React.useCallback(
    (file: File) => {
      setProfileAdjustDraft(DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM);
      setIsProfileAdjusterVisible(true);
      void onSetProfileImageFile(file);
    },
    [onSetProfileImageFile]
  );

  const saveProfileAdjustments = React.useCallback(() => {
    void onSaveProfileImageTransform(activeProfileImageTransform).then((saved) => {
      if (!saved) return;
      setProfileAdjustDraft(null);
      setIsProfileAdjusterVisible(false);
    });
  }, [activeProfileImageTransform, onSaveProfileImageTransform]);

  const clearProfilePreview = React.useCallback(() => {
    void onClearProfileImage();
    setProfileAdjustDraft(null);
    setIsProfileAdjusterVisible(false);
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = "";
    }
  }, [onClearProfileImage]);

  const canAcceptProfileImageDrop = React.useCallback(
    (transfer: DataTransfer | null | undefined): boolean =>
      Boolean(
        !hasUnsavedElementDraft &&
        (hasLocalImageFileDrag(transfer) ||
          hasInternalReferenceDragTypeHints(transfer) ||
          extractInternalReferenceDragPayload(transfer))
      ),
    [hasUnsavedElementDraft]
  );

  const handleProfileDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptProfileImageDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsProfileDropActive(true);
    },
    [canAcceptProfileImageDrop]
  );

  const handleProfileDragOver = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptProfileImageDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsProfileDropActive(true);
    },
    [canAcceptProfileImageDrop]
  );

  const handleProfileDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (event.currentTarget !== event.target) return;
    setIsProfileDropActive(false);
  }, []);

  const handleProfileDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptProfileImageDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      suppressProfilePickerClickRef.current = true;
      setIsProfileDropActive(false);
      const droppedFile = getDroppedLocalImageFile(event.dataTransfer);
      if (droppedFile) {
        applyProfileImageFile(droppedFile);
        return;
      }
      const droppedReference = extractInternalReferenceDragPayload(event.dataTransfer);
      if (!droppedReference) return;
      void onSetProfileImageFromInternalDrop(droppedReference);
    },
    [applyProfileImageFile, canAcceptProfileImageDrop, onSetProfileImageFromInternalDrop]
  );

  const canAcceptSheetDrop = React.useCallback(
    (transfer: DataTransfer | null | undefined): boolean =>
      Boolean(
        transfer &&
        !hasUnsavedElementDraft &&
        ((draft.assetType === "image" && hasLocalImageFileDrag(transfer)) ||
          extractInternalReferenceDragPayload(transfer) ||
          hasInternalReferenceDragTypeHints(transfer))
      ),
    [draft.assetType, hasUnsavedElementDraft]
  );

  const resolveDroppedReferenceUrl = React.useCallback(
    async (transfer: DataTransfer): Promise<string | null> => {
      const localImageFile =
        draft.assetType === "image" ? getDroppedLocalImageFile(transfer) : null;
      if (localImageFile) {
        const localObjectUrl = URL.createObjectURL(localImageFile);
        try {
          return await uploadImageToStorage(localObjectUrl);
        } finally {
          URL.revokeObjectURL(localObjectUrl);
        }
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

  return (
    <div
      className="elements-manager-shell elements-manager-shell--panel"
      data-active-tab={activeTab}
      data-surface="panel"
    >
      <input
        ref={profileFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleProfileSelection}
      />
      <ElementsManagerWorkflowTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSavingElement={isSavingElement}
        hasUnsavedElementDraft={hasUnsavedElementDraft}
        loading={loading}
        onSaveElement={onSaveElement}
      />
      {error ? <p className="tiny elements-manager-feedback">{error}</p> : null}

      {activeTab === "manage" ? (
        <>
          <div className="elements-manage-header-row">
            <div className="elements-manage-title-stack">
              <h2>Elements Library</h2>
              <p className="tiny subdued elements-manage-helper">
                Select an element to edit its element profile.
              </p>
            </div>
            <div className="elements-manage-header-actions">
              <button
                type="button"
                className="elements-manage-create-btn"
                onClick={onCreateElement}
              >
                <Plus
                  size={14}
                  weight="bold"
                  className="elements-manage-create-btn-icon"
                  aria-hidden
                />
                <span>Create New Element</span>
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
                  >
                    <button
                      type="button"
                      className="elements-list-select-btn"
                      aria-label={`Open element profile: ${itemName}`}
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
                    <button
                      type="button"
                      className="elements-list-delete-btn"
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
        </>
      ) : (
        <section className="elements-profile-panel">
          <ElementsCreateWorkspaceSurface
            surface="panel"
            elementSheet={
              <section className="elements-profile-section">
                <div className="elements-profile-top-row">
                  <div className="elements-profile-photo-stack">
                    <button
                      type="button"
                      className={`elements-profile-photo-btn ${
                        draft.profileImageUrl ? "has-image" : ""
                      } ${isProfileDropActive ? "is-drop-active" : ""}`}
                      onClick={openProfilePicker}
                      onDragEnter={handleProfileDragEnter}
                      onDragOver={handleProfileDragOver}
                      onDragLeave={handleProfileDragLeave}
                      onDrop={handleProfileDrop}
                      aria-label={
                        draft.profileImageUrl && !isProfileAdjusterVisible
                          ? "Edit element profile photo adjustments"
                          : "Upload element profile photo"
                      }
                    >
                      {draft.profileImageUrl ? (
                        <Image
                          src={draft.profileImageUrl}
                          alt="Element profile"
                          className="elements-profile-photo"
                          style={buildElementProfileImageTransformStyle(
                            activeProfileImageTransform,
                            profileImageRenderSize
                          )}
                          width={profileImageRenderSize}
                          height={profileImageRenderSize}
                          unoptimized
                        />
                      ) : (
                        <span className="elements-profile-placeholder-icon" aria-hidden="true">
                          <UserCircle size={46} weight="light" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                    {draft.profileImageUrl ? (
                      <span className="elements-profile-edit-indicator" aria-hidden="true">
                        <PencilSimpleLine size={14} weight="bold" />
                        <span>Edit photo</span>
                      </span>
                    ) : null}
                    {draft.profileImageUrl && isProfileAdjusterVisible ? (
                      <div
                        className="elements-profile-adjuster"
                        role="group"
                        aria-label="Element profile crop controls"
                      >
                        <div className="elements-profile-adjuster-row">
                          <label
                            className="elements-profile-adjuster-label"
                            htmlFor="element-profile-adjust-zoom"
                          >
                            <span>Zoom</span>
                            <span>{Math.round(activeProfileImageTransform.zoom * 100)}%</span>
                          </label>
                          <input
                            id="element-profile-adjust-zoom"
                            className="elements-profile-adjuster-range"
                            type="range"
                            min={PROFILE_ZOOM_MIN}
                            max={PROFILE_ZOOM_MAX}
                            step={0.01}
                            value={activeProfileImageTransform.zoom}
                            onChange={(event) => {
                              const nextZoom = Number(event.target.value);
                              setProfileAdjustDraft((previous) => ({
                                ...(previous ?? draft.profileImageTransform),
                                zoom: nextZoom,
                              }));
                            }}
                          />
                        </div>
                        <div className="elements-profile-adjuster-row">
                          <label
                            className="elements-profile-adjuster-label"
                            htmlFor="element-profile-adjust-x"
                          >
                            <span>Horizontal</span>
                            <span>
                              {activeProfileImageTransform.offsetX > 0
                                ? `+${activeProfileImageTransform.offsetX}`
                                : activeProfileImageTransform.offsetX}
                            </span>
                          </label>
                          <input
                            id="element-profile-adjust-x"
                            className="elements-profile-adjuster-range"
                            type="range"
                            min={PROFILE_OFFSET_MIN}
                            max={PROFILE_OFFSET_MAX}
                            step={1}
                            value={activeProfileImageTransform.offsetX}
                            onChange={(event) => {
                              const nextOffsetX = Number(event.target.value);
                              setProfileAdjustDraft((previous) => ({
                                ...(previous ?? draft.profileImageTransform),
                                offsetX: nextOffsetX,
                              }));
                            }}
                          />
                        </div>
                        <div className="elements-profile-adjuster-row">
                          <label
                            className="elements-profile-adjuster-label"
                            htmlFor="element-profile-adjust-y"
                          >
                            <span>Vertical</span>
                            <span>
                              {activeProfileImageTransform.offsetY > 0
                                ? `+${activeProfileImageTransform.offsetY}`
                                : activeProfileImageTransform.offsetY}
                            </span>
                          </label>
                          <input
                            id="element-profile-adjust-y"
                            className="elements-profile-adjuster-range"
                            type="range"
                            min={PROFILE_OFFSET_MIN}
                            max={PROFILE_OFFSET_MAX}
                            step={1}
                            value={activeProfileImageTransform.offsetY}
                            onChange={(event) => {
                              const nextOffsetY = Number(event.target.value);
                              setProfileAdjustDraft((previous) => ({
                                ...(previous ?? draft.profileImageTransform),
                                offsetY: nextOffsetY,
                              }));
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="ghost-btn small elements-profile-adjuster-reset"
                          onClick={saveProfileAdjustments}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="ghost-btn small elements-profile-adjuster-remove"
                          onClick={clearProfilePreview}
                          disabled={!draft.profileImageUrl}
                        >
                          Remove photo
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="elements-profile-fields">
                    <label
                      className="control-row elements-profile-field"
                      htmlFor="element-manager-name"
                    >
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
                    <label
                      className="control-row elements-profile-field"
                      htmlFor="element-manager-alias"
                    >
                      <span className="input-label">Alias:</span>
                      <input
                        id="element-manager-alias"
                        className="elements-name-input"
                        type="text"
                        value={draft.alias}
                        onChange={(event) => updateDraftField("alias", event.target.value)}
                        placeholder="Enter element alias"
                      />
                    </label>
                  </div>
                </div>

                <div className="elements-profile-sheet-panel">
                  <ElementsDescriptionEditorCard
                    description={draft.description}
                    maxLength={150}
                    rows={2}
                    disabled={false}
                    onChangeDescription={(value) => updateDraftField("description", value)}
                  />

                  <div className="elements-references-title-row elements-profile-fields">
                    <p className="input-label">References</p>
                  </div>
                  <div className="elements-references-grid">
                    {(draft.assetType === "image"
                      ? IMAGE_REFERENCE_SLOT_LABELS
                      : ["Motion Reference"]
                    ).map((slotLabel, index) => {
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
                                    draft.assetType === "image" && index < 2
                                      ? "is-required"
                                      : "is-optional"
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
                    })}
                  </div>
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
          <div className="modal-card elements-delete-confirm-card">
            <h3 id="delete-element-title">Delete this element?</h3>
            <p className="subdued tiny elements-delete-confirm-copy">
              This will permanently remove the selected element from your Elements library.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onCancelDeleteElement}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger elements-delete-confirm-btn"
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
