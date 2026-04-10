/**
 * Elements library shell.
 * Hosts the embedded Elements manage/profile workflow while reusing shared Character-style controls.
 */
import React from "react";
import Image from "next/image";
import { PencilSimpleLine, Plus, Trash, UploadSimple, UserCircle } from "phosphor-react";
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
} from "../../../lib/internalReferenceDragPayload";
import { uploadImageToStorage } from "../../ai-studio/utils/imageUpload";
import { CharacterDescriptionEditorCard } from "../../character-manager/components/CharacterDescriptionEditorCard";
import { CharacterCreateWorkspaceSurface } from "../../character-manager/components/CharacterCreateWorkspaceSurface";
import { buildElementProfileImageTransformStyle } from "../logic/elementProfileImageTransform";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
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
    setActiveTab,
    updateDraftField,
    updateActiveReferenceSet,
    assignActiveImageReferenceAtIndex,
    assignActiveVideoReference,
    clearActiveImageReferenceAtIndex,
    clearActiveVideoReference,
    onSetProfileImageFile,
    onSetProfileImageFromInternalDrop,
    onSaveProfileImageTransform,
    onClearProfileImage,
    onCreateElement,
    onSelectElement,
    onRequestDeleteElement,
    onCancelDeleteElement,
    onConfirmDeleteElement,
  } = useElementsManagerViewState({
    resolveProfileImageDropSource,
  });
  const lastHandledExternalCreateRequestKeyRef = React.useRef(0);
  const activeReferenceSet = draft.referenceSets[draft.activeReferenceSetId];
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
  }, [draft.profileImageTransform, draft.profileImageUrl, isProfileAdjusterVisible]);

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
        hasInternalReferenceDragTypeHints(transfer) || extractInternalReferenceDragPayload(transfer)
      ),
    []
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
      const droppedReference = extractInternalReferenceDragPayload(event.dataTransfer);
      if (!droppedReference) return;
      void onSetProfileImageFromInternalDrop(droppedReference);
    },
    [canAcceptProfileImageDrop, onSetProfileImageFromInternalDrop]
  );

  const canAcceptInternalReferenceDrag = React.useCallback(
    (transfer: DataTransfer | null | undefined): boolean =>
      Boolean(
        transfer &&
        (extractInternalReferenceDragPayload(transfer) ||
          hasInternalReferenceDragTypeHints(transfer))
      ),
    []
  );

  const resolveDroppedReferenceUrl = React.useCallback(
    async (transfer: DataTransfer): Promise<string | null> => {
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
    [resolveProfileImageDropSource]
  );

  const handleSheetDragEnter = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptInternalReferenceDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setActiveSheetDropIndex(slotIndex);
    },
    [canAcceptInternalReferenceDrag]
  );

  const handleSheetDragOver = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptInternalReferenceDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setActiveSheetDropIndex(slotIndex);
    },
    [canAcceptInternalReferenceDrag]
  );

  const handleSheetDrop = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      if (!canAcceptInternalReferenceDrag(event.dataTransfer)) return;
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
      canAcceptInternalReferenceDrag,
      draft.assetType,
      resolveDroppedReferenceUrl,
    ]
  );

  return (
    <div
      className="character-manager-page character-manager-page--embedded elements-manager-shell elements-manager-shell--character-clone"
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
      <ElementsManagerWorkflowTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "manage" ? (
        <section className="panel media-panel character-manage-panel elements-manage-panel">
          <div className="character-manage-header-row">
            <div className="character-manage-title-stack">
              <h2>Elements Library</h2>
              <p className="tiny subdued character-manage-helper">
                Select an element to edit its element profile.
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
                          {item.profileImageUrl ? (
                            <div
                              className="ai-character-list-avatar-image"
                              style={{
                                backgroundImage: `url("${item.profileImageUrl}")`,
                                backgroundRepeat: "no-repeat",
                                backgroundSize: "cover",
                                backgroundPosition: "center center",
                              }}
                            />
                          ) : (
                            <span className="character-list-avatar-initials">
                              {buildElementInitials(itemName)}
                            </span>
                          )}
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
          {error ? <p className="tiny character-delete-confirm-copy">{error}</p> : null}
        </section>
      ) : (
        <section className="character-simple-panel">
          <CharacterCreateWorkspaceSurface
            surface="panel"
            characterSheet={
              <section className="character-section character-section--references">
                <div className="character-profile-card">
                  <div className="character-profile-card-top-row">
                    <div className="character-profile-photo-stack">
                      <button
                        type="button"
                        className={`character-profile-photo-btn ${
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
                            className="character-profile-photo"
                            style={buildElementProfileImageTransformStyle(
                              activeProfileImageTransform,
                              profileImageRenderSize
                            )}
                            width={profileImageRenderSize}
                            height={profileImageRenderSize}
                            unoptimized
                          />
                        ) : (
                          <span className="character-profile-placeholder-icon" aria-hidden="true">
                            <UserCircle size={46} weight="light" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                      {draft.profileImageUrl ? (
                        <span className="character-profile-edit-indicator" aria-hidden="true">
                          <PencilSimpleLine size={14} weight="bold" />
                          <span>Edit photo</span>
                        </span>
                      ) : null}
                      {draft.profileImageUrl && isProfileAdjusterVisible ? (
                        <div
                          className="character-profile-adjuster"
                          role="group"
                          aria-label="Element profile crop controls"
                        >
                          <div className="character-profile-adjuster-row">
                            <label
                              className="character-profile-adjuster-label"
                              htmlFor="element-profile-adjust-zoom"
                            >
                              <span>Zoom</span>
                              <span>{Math.round(activeProfileImageTransform.zoom * 100)}%</span>
                            </label>
                            <input
                              id="element-profile-adjust-zoom"
                              className="character-profile-adjuster-range"
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
                          <div className="character-profile-adjuster-row">
                            <label
                              className="character-profile-adjuster-label"
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
                              className="character-profile-adjuster-range"
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
                          <div className="character-profile-adjuster-row">
                            <label
                              className="character-profile-adjuster-label"
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
                              className="character-profile-adjuster-range"
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
                            className="ghost-btn small character-profile-adjuster-reset"
                            onClick={saveProfileAdjustments}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="ghost-btn small character-profile-adjuster-remove character-remove-btn"
                            onClick={clearProfilePreview}
                            disabled={!draft.profileImageUrl}
                          >
                            Remove photo
                          </button>
                        </div>
                      ) : null}
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
                          className="character-name-input"
                          type="text"
                          value={draft.alias}
                          onChange={(event) => updateDraftField("alias", event.target.value)}
                          placeholder="Enter element alias"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="character-sheet-preset-panel">
                  <CharacterDescriptionEditorCard
                    description={activeReferenceSet.description}
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
                    <p className="input-label">References</p>
                  </div>
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
                              className="character-list-delete-btn character-reference-delete-btn character-character-sheet-delete-btn"
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
                          <div className="character-character-sheet-media">
                            {slotValue ? (
                              draft.assetType === "video" ? (
                                <video
                                  src={slotValue}
                                  aria-label={`${slotLabel} reference`}
                                  className="character-character-sheet-image"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <Image
                                  src={slotValue}
                                  alt={`${slotLabel} reference`}
                                  className="character-character-sheet-image"
                                  width={240}
                                  height={300}
                                  unoptimized
                                />
                              )
                            ) : (
                              <span className="character-character-sheet-drop-copy tiny">
                                <UploadSimple
                                  size={14}
                                  weight="bold"
                                  className="character-character-sheet-drop-icon"
                                  aria-hidden="true"
                                />
                                <span>
                                  {draft.assetType === "video"
                                    ? "Drop motion reference here"
                                    : "Drop reference here"}
                                </span>
                                <span
                                  className={`character-character-sheet-drop-requirement ${
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
                          <span className="character-reference-empty-hint">{slotLabel}</span>
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
          <div className="modal-card character-delete-confirm-card">
            <h3 id="delete-element-title">Delete this element?</h3>
            <p className="subdued tiny character-delete-confirm-copy">
              This will permanently remove the selected element from your Elements library.
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
