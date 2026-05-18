import Image from "next/image";
import React from "react";
import { Plus, Trash, UploadSimple, XCircle } from "phosphor-react";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import {
  CHARACTER_SHEET_DROP_ZONES,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import { useCharacterCardPreviewUrls } from "../hooks/useCharacterCardPreviewUrls";
import { useCharacterManagerCharacterSheetInteractions } from "../hooks/useCharacterManagerCharacterSheetInteractions";
import { useCharacterManagerDragInteractions } from "../hooks/useCharacterManagerDragInteractions";
import {
  useCharacterManagerDroppedReferenceController,
  type ResolveCharacterDropReference,
} from "../hooks/useCharacterManagerDroppedReferenceController";
import { useCharacterManagerDraft } from "../hooks/useCharacterManagerDraft";
import { CharacterDescriptionEditorCard } from "./CharacterDescriptionEditorCard";
import { CharacterProfileLoadingSkeleton } from "./CharacterProfileLoadingSkeleton";
import { CharacterSheetPresetTabs, getCharacterSheetPresetTabId } from "./CharacterSheetPresetTabs";
import type { CharacterSheetDropZoneKey, CharacterSheetPresetId } from "../types";
import type { MediaLibrarySelectionPayload } from "../../ai-studio/hooks/useMediaLibraryPanelSelectionController";
import {
  AiStudioPickerCard,
  AiStudioPickerFeedback,
  AiStudioPickerGrid,
  AiStudioPickerModalFrame,
  AiStudioPickerSection,
} from "../../ai-studio/components/picker/AiStudioPickerPrimitives";

type CharacterPanelWorkspaceProps = {
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  externalCreateRequestKey?: number;
  externalUploadRequest?: CharacterPanelUploadRequest | null;
  onExternalUploadRequestHandled?: (requestId: number) => void;
  isEmbeddedMediaLibraryMaximized?: boolean;
  pendingMediaSelection?: {
    key: number;
    payload: MediaLibrarySelectionPayload;
  } | null;
};

const CHARACTER_DESCRIPTION_MAX_LENGTH = 150;
const DND_REFERENCE_SLOT_KEY = "application/x-shortpulse-reference-slot-key";
const DND_QUICK_SWAP_ITEM = "application/x-shortpulse-quickswap-item";
const DND_CHARACTER_SHEET_ZONE_KEY = "application/x-shortpulse-character-sheet-zone-key";
const MEDIA_BUCKET = "media_library";
const SLOT_ASSIGNMENT_ORDER: CharacterSheetDropZoneKey[] = ["portrait", "close_up", "front_shot"];
const FULL_SLOT_UPLOAD_ERROR =
  "All character reference slots are filled. Clear a slot before adding more media.";

const fetchSelectionFile = async (payload: MediaLibrarySelectionPayload): Promise<File> => {
  const candidateUrl = (payload.fullUrl ?? payload.previewUrl ?? payload.url ?? "").trim();
  if (!candidateUrl) {
    throw new Error("Selected media is missing a readable source URL.");
  }
  const response = await fetch(candidateUrl, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load selected media (${response.status}).`);
  }
  const blob = await response.blob();
  const mimeType = (blob.type || "").trim().toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image media can be assigned to character references.");
  }
  const filename = (payload.filename ?? "").trim() || `character-reference-${payload.id}.png`;
  return new File([blob], filename, {
    type: mimeType,
  });
};

const getCharacterInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "NC";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
};

export function CharacterPanelWorkspace({
  resolveCharacterDropReference,
  externalCreateRequestKey = 0,
  externalUploadRequest = null,
  onExternalUploadRequestHandled,
  isEmbeddedMediaLibraryMaximized = false,
  pendingMediaSelection = null,
}: CharacterPanelWorkspaceProps) {
  const {
    characters,
    selectedCharacterId,
    characterName,
    characterDescription,
    activeCharacterSheetPresetId,
    visibleCharacterSheetPresetIds,
    characterSheetPresetLabels,
    characterSheetPresetAssignments,
    error,
    setErrorMessage,
    loading,
    isSavingName,
    isCreatingCharacter,
    isSavingCharacter,
    isDeletingCharacter,
    isSwitchingCharacter,
    isSavingCharacterSheetPreset,
    hasUnsavedCharacterDraft,
    setCharacterName,
    setCharacterDescription,
    setActiveCharacterSheetPreset,
    saveCharacterSheetPresetAssignments,
    addCharacterSheetPreset,
    renameCharacterSheetPreset,
    deleteCharacterSheetPreset,
    setCharacterSheetPresetFile,
    createCharacter,
    saveCharacter,
    selectCharacter,
    deleteCharacter,
    clearMessages,
  } = useCharacterManagerDraft();

  const [armedSlotKey, setArmedSlotKey] = React.useState<CharacterSheetDropZoneKey | null>(null);
  const [activeCharacterSheetDropZone, setActiveCharacterSheetDropZone] =
    React.useState<CharacterSheetDropZoneKey | null>(null);
  const [draggedQuickSwapItemId, setDraggedQuickSwapItemId] = React.useState<string | null>(null);
  const [draggedCharacterSheetZoneKey, setDraggedCharacterSheetZoneKey] =
    React.useState<CharacterSheetDropZoneKey | null>(null);
  const [pendingCharacterSheetUploadZoneKey, setPendingCharacterSheetUploadZoneKey] =
    React.useState<CharacterSheetDropZoneKey | null>(null);
  const [isCharacterLibraryModalOpen, setIsCharacterLibraryModalOpen] = React.useState(false);
  const [deleteTargetCharacter, setDeleteTargetCharacter] = React.useState<{
    characterId: string;
    characterName: string;
  } | null>(null);
  const [deleteTargetCharacterSheetPresetId, setDeleteTargetCharacterSheetPresetId] =
    React.useState<CharacterSheetPresetId | null>(null);
  const lastHandledExternalCreateRequestKeyRef = React.useRef(0);
  const lastHandledExternalUploadRequestIdRef = React.useRef(0);
  const lastHandledMediaSelectionKeyRef = React.useRef(0);
  const characterSheetFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const characterNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const pageBusy =
    loading ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isSavingCharacter ||
    isDeletingCharacter;

  const resolvedCharacterSheetPresetAssignments = React.useMemo(
    () => characterSheetPresetAssignments ?? createEmptyCharacterSheetPresetAssignments(),
    [characterSheetPresetAssignments]
  );
  const activeCharacterSheetPresetTabId = getCharacterSheetPresetTabId(
    "character-panel-preset",
    activeCharacterSheetPresetId
  );
  const deleteTargetCharacterSheetPresetLabel = deleteTargetCharacterSheetPresetId
    ? characterSheetPresetLabels[deleteTargetCharacterSheetPresetId]
    : null;
  const selectedCharacter = React.useMemo(
    () => characters.find((entry) => entry.characterId === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );
  const selectedCharacterSummaryName = React.useMemo(() => {
    const draftName = characterName.trim();
    if (draftName.length > 0) {
      return draftName;
    }
    const savedName = selectedCharacter?.characterName?.trim() ?? "";
    if (savedName.length > 0) {
      return savedName;
    }
    return "Character library ready";
  }, [characterName, selectedCharacter]);

  const { refreshCardPreviewSignedUrl, resolveCharacterCardPreviewUrl } =
    useCharacterCardPreviewUrls({
      selectedCharacterId,
      adaptivePreviewEnabled: false,
      pressureLevel: 0,
    });

  const { pendingDropTarget, isDropResolutionBusy, handleCharacterSheetReferenceDrop } =
    useCharacterManagerDroppedReferenceController({
      pageBusy,
      quickSwapMutating: false,
      clearAllMessages: clearMessages,
      appendQuickSwapFiles: async () => false,
      setCharacterSheetPresetFile,
      resolveCharacterDropReference,
      hasQuickSwapMediaFileId: () => false,
    });

  const openCharacterSheetPicker = React.useCallback((zoneKey: CharacterSheetDropZoneKey) => {
    setPendingCharacterSheetUploadZoneKey(zoneKey);
    characterSheetFileInputRef.current?.click();
  }, []);

  const {
    handleCharacterSheetFileSelection,
    handleCharacterSheetDragOver,
    clearCharacterSheetAssignment,
    handleCharacterSheetDrop,
  } = useCharacterManagerCharacterSheetInteractions({
    pageBusy,
    isDropResolutionBusy,
    selectedCharacterId,
    pendingCharacterSheetUploadZoneKey,
    setPendingCharacterSheetUploadZoneKey,
    setCharacterSheetPresetFile,
    resolvedCharacterSheetPresetAssignments,
    saveCharacterSheetPresetAssignments,
    quickSwapItemById: new Map(),
    quickSwapItemByMediaFileId: new Map(),
    quickSwapItemByLegacySlotKey: new Map(),
    draggedQuickSwapItemId,
    draggedCharacterSheetZoneKey,
    canResolveCharacterDropReference: Boolean(resolveCharacterDropReference),
    handleCharacterSheetReferenceDrop,
    setActiveCharacterSheetDropZone,
    openCharacterSheetPicker,
    referenceSlotMimeType: DND_REFERENCE_SLOT_KEY,
    characterSheetZoneMimeType: DND_CHARACTER_SHEET_ZONE_KEY,
  });

  const { handleCharacterSheetDragStart, handleReferenceDragEnd } =
    useCharacterManagerDragInteractions({
      pageBusy,
      quickSwapMutating: false,
      isDropResolutionBusy,
      resolvedCharacterSheetPresetAssignments,
      setDraggedQuickSwapItemId,
      setDraggedCharacterSheetZoneKey,
      setActiveCharacterSheetDropZone,
      quickSwapMimeType: DND_QUICK_SWAP_ITEM,
      referenceSlotMimeType: DND_REFERENCE_SLOT_KEY,
      characterSheetZoneMimeType: DND_CHARACTER_SHEET_ZONE_KEY,
    });

  const resetActiveSlotAssignment = React.useCallback(() => {
    setArmedSlotKey(null);
  }, []);

  const assignMediaSelectionToSlot = React.useCallback(
    async (payload: MediaLibrarySelectionPayload) => {
      if (pageBusy || isDropResolutionBusy) return;
      const targetSlotKey = armedSlotKey;
      if (!targetSlotKey) {
        setErrorMessage("Select a character reference slot before assigning media.");
        return;
      }
      try {
        clearMessages();
        const file = await fetchSelectionFile(payload);
        const saved = await setCharacterSheetPresetFile(targetSlotKey, file);
        if (saved) {
          setArmedSlotKey(null);
        }
      } catch (nextError) {
        const message =
          nextError instanceof Error && nextError.message.trim().length
            ? nextError.message
            : "Failed to assign media to the selected reference slot.";
        setErrorMessage(message);
      }
    },
    [
      armedSlotKey,
      clearMessages,
      isDropResolutionBusy,
      pageBusy,
      setCharacterSheetPresetFile,
      setErrorMessage,
    ]
  );

  const handleCreateNewCharacter = React.useCallback(async () => {
    clearMessages();
    setArmedSlotKey(null);
    setIsCharacterLibraryModalOpen(false);
    await createCharacter();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        characterNameInputRef.current?.focus();
        characterNameInputRef.current?.select();
      });
    }
  }, [clearMessages, createCharacter]);

  const assignFilesToSlots = React.useCallback(
    async (files: File[]) => {
      const nextFiles = files.filter((file) => file instanceof File);
      if (!nextFiles.length) return;
      clearMessages();
      const openSlotQueue = SLOT_ASSIGNMENT_ORDER.filter(
        (slotKey) => !resolvedCharacterSheetPresetAssignments[slotKey]
      );
      if (!openSlotQueue.length) {
        setErrorMessage(FULL_SLOT_UPLOAD_ERROR);
        return;
      }
      const orderedTargetSlots =
        armedSlotKey && openSlotQueue.includes(armedSlotKey)
          ? [armedSlotKey, ...openSlotQueue.filter((slotKey) => slotKey !== armedSlotKey)]
          : openSlotQueue;
      let assignedCount = 0;

      for (const file of nextFiles) {
        const targetSlotKey = orderedTargetSlots[assignedCount] ?? null;
        if (!targetSlotKey) break;
        const saved = await setCharacterSheetPresetFile(targetSlotKey, file);
        if (!saved) break;
        assignedCount += 1;
      }

      if (nextFiles.length > orderedTargetSlots.length) {
        setErrorMessage(
          `Only ${orderedTargetSlots.length} open reference slot${
            orderedTargetSlots.length === 1 ? " was" : "s were"
          } available. Extra uploads were skipped.`
        );
      }
      setArmedSlotKey(null);
    },
    [
      armedSlotKey,
      clearMessages,
      resolvedCharacterSheetPresetAssignments,
      setCharacterSheetPresetFile,
      setErrorMessage,
    ]
  );

  React.useEffect(() => {
    if (externalCreateRequestKey === 0) return;
    if (lastHandledExternalCreateRequestKeyRef.current === externalCreateRequestKey) return;
    lastHandledExternalCreateRequestKeyRef.current = externalCreateRequestKey;
    void handleCreateNewCharacter();
  }, [externalCreateRequestKey, handleCreateNewCharacter]);

  React.useEffect(() => {
    const activeUploadRequest = externalUploadRequest;
    if (!activeUploadRequest) return;
    const requestId = activeUploadRequest.requestId ?? 0;
    if (requestId === 0) return;
    if (lastHandledExternalUploadRequestIdRef.current === requestId) return;
    lastHandledExternalUploadRequestIdRef.current = requestId;
    onExternalUploadRequestHandled?.(requestId);
    void assignFilesToSlots(activeUploadRequest.files);
  }, [assignFilesToSlots, externalUploadRequest, onExternalUploadRequestHandled]);

  React.useEffect(() => {
    if (!pendingMediaSelection) return;
    if (lastHandledMediaSelectionKeyRef.current === pendingMediaSelection.key) return;
    lastHandledMediaSelectionKeyRef.current = pendingMediaSelection.key;
    void assignMediaSelectionToSlot(pendingMediaSelection.payload);
  }, [assignMediaSelectionToSlot, pendingMediaSelection]);

  const handleCharacterSelection = React.useCallback(
    async (characterId: string) => {
      if (pageBusy) return;
      clearMessages();
      resetActiveSlotAssignment();
      setIsCharacterLibraryModalOpen(false);
      await selectCharacter(characterId);
    },
    [clearMessages, pageBusy, resetActiveSlotAssignment, selectCharacter]
  );

  const confirmDeleteCharacter = React.useCallback(async () => {
    if (!deleteTargetCharacter) return;
    const deleted = await deleteCharacter(deleteTargetCharacter.characterId);
    if (deleted) {
      setDeleteTargetCharacter(null);
      resetActiveSlotAssignment();
    }
  }, [deleteCharacter, deleteTargetCharacter, resetActiveSlotAssignment]);

  const confirmDeleteCharacterSheetPreset = React.useCallback(async () => {
    if (!deleteTargetCharacterSheetPresetId) return;
    const deleted = await deleteCharacterSheetPreset(deleteTargetCharacterSheetPresetId);
    if (deleted) {
      setDeleteTargetCharacterSheetPresetId(null);
      resetActiveSlotAssignment();
    }
  }, [deleteCharacterSheetPreset, deleteTargetCharacterSheetPresetId, resetActiveSlotAssignment]);

  const openSlotPreview = React.useCallback(
    async (slotKey: CharacterSheetDropZoneKey) => {
      const assignedReference = resolvedCharacterSheetPresetAssignments[slotKey];
      const storagePath =
        assignedReference?.previewStoragePath ?? assignedReference?.storagePath ?? null;
      if (!storagePath) return;
      const signedUrl = await getSignedMediaUrl({
        bucket: MEDIA_BUCKET,
        storagePath,
        expiresInSeconds: 3600,
        forceRefresh: false,
      });
      if (!signedUrl) return;
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    },
    [resolvedCharacterSheetPresetAssignments]
  );

  return (
    <div
      className={`character-panel-workspace ${
        isEmbeddedMediaLibraryMaximized ? "is-embedded-media-library-maximized" : ""
      }`.trim()}
    >
      {error ? (
        <div className="character-feedback error" role="status">
          <XCircle size={16} weight="fill" />
          <span>{error}</span>
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {isSavingName ? "Saving character name..." : ""}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {isSavingCharacter ? "Saving character..." : ""}
      </p>

      <div className="character-panel-library-workspace">
        <section className="character-panel-library-column">
          <div className="character-panel-library-header">
            <div className="character-panel-library-header-main">
              <div className="character-panel-library-title-stack">
                <h2>Characters Library</h2>
                <p className="tiny subdued">
                  Open Characters to browse saved profiles and load one into the editor.
                </p>
              </div>
              <div className="character-panel-library-header-actions">
                <button
                  type="button"
                  className="character-panel-action-btn"
                  onClick={() => setIsCharacterLibraryModalOpen(true)}
                  disabled={pageBusy}
                >
                  Characters
                </button>
                <button
                  type="button"
                  className="character-panel-action-btn character-panel-action-btn--danger"
                  onClick={() => {
                    if (!selectedCharacterId) return;
                    const target =
                      characters.find((entry) => entry.characterId === selectedCharacterId) ?? null;
                    if (!target) return;
                    setDeleteTargetCharacter({
                      characterId: target.characterId,
                      characterName: target.characterName || "Untitled character",
                    });
                  }}
                  disabled={!selectedCharacterId || pageBusy}
                >
                  <Trash size={14} weight="bold" aria-hidden />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  className="character-panel-action-btn"
                  onClick={() => {
                    void saveCharacter();
                  }}
                  disabled={!hasUnsavedCharacterDraft || pageBusy}
                >
                  {isSavingCharacter ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="character-panel-action-btn character-panel-action-btn--primary"
                  onClick={() => {
                    void handleCreateNewCharacter();
                  }}
                  disabled={pageBusy}
                >
                  <Plus size={14} weight="bold" aria-hidden />
                  <span>Create</span>
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="character-panel-library-empty-state" role="status" aria-live="polite">
              <p className="character-panel-library-empty-title">Loading characters...</p>
              <p className="tiny subdued">Pulling your saved character library into view.</p>
            </div>
          ) : characters.length === 0 ? (
            <div className="character-panel-library-empty-state" role="status" aria-live="polite">
              <p className="character-panel-library-empty-title">No saved characters yet.</p>
              <p className="tiny subdued">Create a character to start building your library.</p>
            </div>
          ) : (
            <div className="character-panel-library-summary" role="status" aria-live="polite">
              <p className="character-panel-library-empty-title">{selectedCharacterSummaryName}</p>
              <p className="tiny subdued">
                {selectedCharacterId
                  ? "Use Characters to browse saved profiles and switch the active character."
                  : "Open Characters to browse your saved library and load a profile."}
              </p>
            </div>
          )}
        </section>

        <section className="character-panel-editor-column">
          {loading || isSwitchingCharacter ? (
            <div className="character-panel-editor-column-panel">
              <CharacterProfileLoadingSkeleton surface="panel" />
            </div>
          ) : (
            <div className="character-panel-editor-column-panel">
              <div className="character-panel-editor-column-head">
                <div className="character-panel-library-title-stack">
                  <h2>Character Profile</h2>
                  <p className="tiny subdued">
                    Build the active look and assign references from the media library below.
                  </p>
                </div>
                <div className="character-panel-profile-status">
                  {armedSlotKey ? (
                    <>
                      <span className="character-panel-slot-armed-pill">
                        Slot armed:{" "}
                        {CHARACTER_SHEET_DROP_ZONES.find((slot) => slot.key === armedSlotKey)
                          ?.label ?? armedSlotKey}
                      </span>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={resetActiveSlotAssignment}
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <span className="tiny subdued">
                      Click a slot, then click media below to assign it.
                    </span>
                  )}
                </div>
              </div>

              <div className="character-profile-card">
                <label
                  className="control-row character-simple-field character-simple-field--label-serif"
                  htmlFor="character-panel-name"
                >
                  <span className="input-label">Name:</span>
                  <input
                    ref={characterNameInputRef}
                    id="character-panel-name"
                    className="character-name-input"
                    type="text"
                    value={characterName}
                    maxLength={80}
                    onChange={(event) => setCharacterName(event.target.value)}
                    placeholder="Enter character name"
                    disabled={loading}
                  />
                </label>

                <div className="character-sheet-looks-title-row character-profile-fields character-profile-fields--label-serif">
                  <p className="input-label">Looks:</p>
                </div>

                <div className="character-sheet-looks-block">
                  <CharacterSheetPresetTabs
                    presetIds={visibleCharacterSheetPresetIds}
                    activePresetId={activeCharacterSheetPresetId}
                    presetLabels={characterSheetPresetLabels}
                    onSelectPreset={(presetId) => {
                      resetActiveSlotAssignment();
                      void setActiveCharacterSheetPreset(presetId);
                    }}
                    onAddPreset={() => {
                      resetActiveSlotAssignment();
                      void addCharacterSheetPreset();
                    }}
                    onRenamePreset={(presetId, nextLabel) => {
                      void renameCharacterSheetPreset(presetId, nextLabel);
                    }}
                    onDeletePreset={(presetId) => {
                      if (pageBusy || isSavingCharacterSheetPreset) return;
                      clearMessages();
                      setDeleteTargetCharacterSheetPresetId(presetId);
                    }}
                    panelId="character-panel-preset-panel"
                    disabled={pageBusy}
                    idBase="character-panel-preset"
                  />
                </div>
              </div>

              <div
                className="character-sheet-preset-panel"
                role="tabpanel"
                id="character-panel-preset-panel"
                aria-labelledby={activeCharacterSheetPresetTabId}
              >
                {isEmbeddedMediaLibraryMaximized ? null : (
                  <CharacterDescriptionEditorCard
                    description={characterDescription}
                    maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
                    rows={3}
                    disabled={loading}
                    onChangeDescription={setCharacterDescription}
                  />
                )}
                <div className="character-sheet-references-title-row character-profile-fields character-profile-fields--label-serif">
                  <p className="input-label">Character References:</p>
                </div>
                <div className="character-reference-empty-grid">
                  {CHARACTER_SHEET_DROP_ZONES.map((dropZone) => {
                    const assignedReference = resolvedCharacterSheetPresetAssignments[dropZone.key];
                    const isDropActive = activeCharacterSheetDropZone === dropZone.key;
                    const isDropPending =
                      pendingDropTarget?.target === "character_sheet" &&
                      pendingDropTarget.zoneKey === dropZone.key;
                    const isRequiredSlot = dropZone.key === "portrait";
                    const isArmed = armedSlotKey === dropZone.key;
                    const slotRequirementCopy = isRequiredSlot ? "(Required)" : "(Optional)";

                    return (
                      <article
                        key={dropZone.key}
                        className={`character-character-sheet-card ${
                          assignedReference ? "is-filled" : "is-empty"
                        } ${isDropActive ? "is-drop-active" : ""} ${
                          draggedCharacterSheetZoneKey === dropZone.key ? "is-dragging" : ""
                        } ${isDropPending ? "is-drop-pending" : ""} ${isArmed ? "is-armed" : ""}`}
                        draggable={!pageBusy && !isDropPending && Boolean(assignedReference)}
                        onClick={() => {
                          if (pageBusy || isDropResolutionBusy) return;
                          setArmedSlotKey((current) =>
                            current === dropZone.key ? null : dropZone.key
                          );
                        }}
                        onDoubleClick={() => {
                          void openSlotPreview(dropZone.key);
                        }}
                        onDragStart={handleCharacterSheetDragStart(dropZone.key)}
                        onDragEnd={handleReferenceDragEnd}
                        onDragOver={handleCharacterSheetDragOver(dropZone.key)}
                        onDragLeave={() => {
                          setActiveCharacterSheetDropZone((current) =>
                            current === dropZone.key ? null : current
                          );
                        }}
                        onDrop={handleCharacterSheetDrop(dropZone.key)}
                      >
                        <div className="character-panel-slot-actions">
                          <button
                            type="button"
                            className="character-list-delete-btn character-reference-delete-btn character-panel-slot-upload-btn"
                            aria-label={`Upload ${dropZone.label} reference`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openCharacterSheetPicker(dropZone.key);
                            }}
                            disabled={pageBusy}
                          >
                            <UploadSimple size={12} weight="bold" />
                          </button>
                          {assignedReference ? (
                            <button
                              type="button"
                              className="character-list-delete-btn character-reference-delete-btn character-character-sheet-delete-btn"
                              aria-label={`Clear ${dropZone.label} reference`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void clearCharacterSheetAssignment(dropZone.key);
                              }}
                              disabled={pageBusy}
                            >
                              <Trash size={12} weight="bold" />
                            </button>
                          ) : null}
                        </div>
                        <div className="character-character-sheet-media">
                          {assignedReference?.previewUrl ? (
                            <Image
                              src={
                                resolveCharacterCardPreviewUrl({
                                  previewUrl: assignedReference.previewUrl,
                                  storagePath:
                                    assignedReference.previewStoragePath ??
                                    assignedReference.storagePath,
                                  cardLongEdgePx: 300,
                                }) ?? assignedReference.previewUrl
                              }
                              alt={`${dropZone.label} reference`}
                              className="character-character-sheet-image"
                              width={240}
                              height={300}
                              onError={(event) => {
                                refreshCardPreviewSignedUrl(
                                  assignedReference.previewStoragePath ??
                                    assignedReference.storagePath,
                                  event.currentTarget.currentSrc || event.currentTarget.src || null
                                );
                              }}
                              unoptimized
                            />
                          ) : (
                            <span className="character-character-sheet-drop-copy tiny">
                              <UploadSimple
                                size={14}
                                weight="bold"
                                className="character-character-sheet-drop-icon"
                                aria-hidden="true"
                              />
                              <span>
                                {isArmed
                                  ? "Click media below to assign this slot"
                                  : "Drag reference here or arm this slot"}
                              </span>
                              <span
                                className={`character-character-sheet-drop-requirement ${
                                  isRequiredSlot ? "is-required" : "is-optional"
                                }`}
                              >
                                {slotRequirementCopy}
                              </span>
                              {isDropPending ? (
                                <span className="character-character-sheet-drop-pending tiny">
                                  Assigning...
                                </span>
                              ) : null}
                            </span>
                          )}
                        </div>
                        <span className="character-reference-empty-hint">{dropZone.label}</span>
                      </article>
                    );
                  })}
                </div>
                <p className="character-sheet-references-helper tiny subdued">
                  Drag media into a slot or arm a slot and click media below to assign it.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {deleteTargetCharacter ? (
        <ConfirmationModal
          title="Delete this character?"
          titleId="delete-character-title"
          body={
            <p>
              <strong>{deleteTargetCharacter.characterName}</strong> and its reference images will
              be removed permanently.
            </p>
          }
          confirmLabel="Delete"
          confirmBusyLabel={isDeletingCharacter ? "Deleting..." : undefined}
          confirmDisabled={isDeletingCharacter}
          cancelDisabled={isDeletingCharacter}
          onCancel={() => setDeleteTargetCharacter(null)}
          onConfirm={() => {
            void confirmDeleteCharacter();
          }}
        />
      ) : null}

      {deleteTargetCharacterSheetPresetId ? (
        <ConfirmationModal
          title={`Delete look "${deleteTargetCharacterSheetPresetLabel}"?`}
          titleId="delete-character-sheet-preset-title"
          body={
            <p>
              Saved references for <strong>{deleteTargetCharacterSheetPresetLabel}</strong> will be
              removed permanently.
            </p>
          }
          confirmLabel="Delete"
          confirmBusyLabel={isSavingCharacterSheetPreset ? "Deleting..." : undefined}
          confirmDisabled={isSavingCharacterSheetPreset}
          cancelDisabled={isSavingCharacterSheetPreset}
          onCancel={() => setDeleteTargetCharacterSheetPresetId(null)}
          onConfirm={() => {
            void confirmDeleteCharacterSheetPreset();
          }}
        />
      ) : null}

      <AiStudioPickerModalFrame
        isOpen={isCharacterLibraryModalOpen}
        activityId="character-panel-character-picker"
        ariaLabel="Character library"
        title="Characters"
        subtitle="Browse saved characters and load a profile into the editor."
        onClose={() => setIsCharacterLibraryModalOpen(false)}
      >
        <AiStudioPickerSection>
          {characters.length > 0 ? (
            <AiStudioPickerGrid ariaLabel="Saved characters">
              {characters.map((character) => {
                const isSelected = character.characterId === selectedCharacterId;
                const chipName = character.characterName || "Untitled character";
                const chipInitials = getCharacterInitials(chipName);
                return (
                  <AiStudioPickerCard
                    key={character.characterId}
                    isActive={isSelected}
                    className="ai-character-picker-card--character"
                    onSelect={() => {
                      void handleCharacterSelection(character.characterId);
                    }}
                    avatar={
                      character.profileImageUrl ? (
                        <Image
                          src={
                            resolveCharacterCardPreviewUrl({
                              previewUrl: character.profileImageUrl,
                              storagePath:
                                character.profileImagePreviewStoragePath ??
                                character.profileImageStoragePath,
                              cardLongEdgePx: 44,
                            }) ?? character.profileImageUrl
                          }
                          alt=""
                          className="ai-character-list-avatar-image"
                          width={44}
                          height={44}
                          onError={(event) => {
                            refreshCardPreviewSignedUrl(
                              character.profileImagePreviewStoragePath ??
                                character.profileImageStoragePath,
                              event.currentTarget.currentSrc || event.currentTarget.src
                            );
                          }}
                          unoptimized
                        />
                      ) : (
                        <span className="ai-character-list-avatar-initials">{chipInitials}</span>
                      )
                    }
                    label={isSelected ? "Selected" : "Character"}
                    name={chipName}
                  />
                );
              })}
            </AiStudioPickerGrid>
          ) : (
            <AiStudioPickerFeedback
              isLoading={loading}
              loadingMessage="Loading characters..."
              errorMessage={null}
              emptyMessage="No saved characters yet. Create one to start building your library."
            />
          )}
        </AiStudioPickerSection>
      </AiStudioPickerModalFrame>

      <input
        ref={characterSheetFileInputRef}
        data-testid="character-sheet-upload-input"
        type="file"
        accept="image/*"
        onChange={handleCharacterSheetFileSelection}
        hidden
      />
    </div>
  );
}
