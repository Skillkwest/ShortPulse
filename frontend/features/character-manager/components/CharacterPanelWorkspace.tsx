import Image from "next/image";
import React from "react";
import { Plus, Trash, UploadSimple, X, XCircle } from "phosphor-react";
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
  preferredCharacterId?: string | null;
  suppressSelectedCharacterPersistence?: boolean;
  onSelectedCharacterIdChange?: (characterId: string | null) => void;
};

const CHARACTER_DESCRIPTION_MAX_LENGTH = 150;
const DND_REFERENCE_SLOT_KEY = "application/x-shortpulse-reference-slot-key";
const DND_QUICK_SWAP_ITEM = "application/x-shortpulse-quickswap-item";
const DND_CHARACTER_SHEET_ZONE_KEY = "application/x-shortpulse-character-sheet-zone-key";
const MEDIA_BUCKET = "media_library";
const SLOT_ASSIGNMENT_ORDER: CharacterSheetDropZoneKey[] = ["portrait", "close_up", "front_shot"];
const FULL_SLOT_UPLOAD_ERROR =
  "All character reference slots are filled. Clear a slot before adding more media.";
const CHARACTER_BUTTON_INLINE_STYLE: React.CSSProperties = {
  minWidth: "152px",
  minHeight: "48px",
  padding: "0 20px",
  borderRadius: "14px",
  fontSize: "0.9rem",
  flexShrink: 0,
  border: "1px solid rgba(37, 204, 255, 0.58)",
  background: "rgba(28, 32, 37, 0.94)",
  color: "rgba(110, 214, 233, 0.96)",
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.18)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
};
const CHARACTER_TOP_FIELDS_GRID_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.02fr) minmax(0, 0.98fr)",
  columnGap: "34px",
  alignItems: "start",
};
const CHARACTER_TOP_FIELD_GROUP_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  alignContent: "start",
  minWidth: 0,
};
const CHARACTER_TOP_FIELD_LABEL_INLINE_STYLE: React.CSSProperties = {
  margin: 0,
};
const CHARACTER_TOP_FIELD_CONTROL_INLINE_STYLE: React.CSSProperties = {
  minWidth: 0,
};
const CHARACTER_NAME_INPUT_INLINE_STYLE: React.CSSProperties = {
  height: "36px",
  minHeight: "36px",
  padding: "6px 10px",
  width: "100%",
  borderRadius: "12px",
  border: "1px solid rgba(34, 40, 49, 0.96)",
  background: "rgba(11, 13, 18, 0.98)",
  color: "rgba(242, 246, 252, 0.96)",
  boxSizing: "border-box",
};
const CHARACTER_LOOKS_BLOCK_INLINE_STYLE: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  justifySelf: "stretch",
  paddingTop: 0,
};
const CHARACTER_PRESET_CONTENT_GRID_INLINE_STYLE: React.CSSProperties = {
  columnGap: "34px",
};
const CHARACTER_TOP_SECTION_CONTENT_STYLE: React.CSSProperties = {
  padding: "18px 28px 0",
};
const CHARACTER_TOP_SCROLL_HIDE_GUTTER_PX = 18;
const CHARACTER_TOP_SCROLL_OUTER_STYLE: React.CSSProperties = {
  overflow: "hidden",
};
const CHARACTER_TOP_SCROLL_INNER_STYLE: React.CSSProperties = {
  display: "flex",
  flex: "1 1 auto",
  minHeight: 0,
  flexDirection: "column",
  gap: "8px",
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehaviorY: "contain",
  paddingRight: `${CHARACTER_TOP_SCROLL_HIDE_GUTTER_PX}px`,
  marginRight: `-${CHARACTER_TOP_SCROLL_HIDE_GUTTER_PX}px`,
};
const CHARACTER_REFERENCE_GRID_INLINE_STYLE: React.CSSProperties = {
  gap: "12px",
};
const CHARACTER_REFERENCE_COLUMN_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "10px",
  minWidth: 0,
};
const CHARACTER_REFERENCE_TITLE_INLINE_STYLE: React.CSSProperties = {
  marginBottom: "2px",
};
const CHARACTER_REFERENCE_CARD_INLINE_STYLE: React.CSSProperties = {
  width: "min(100%, 118px)",
  gridTemplateRows: "auto 28px",
  minHeight: "176px",
  borderRadius: "16px",
  border: "1px solid rgba(30, 34, 41, 0.96)",
  background: "rgba(12, 14, 19, 0.96)",
  overflow: "hidden",
  position: "relative",
  boxSizing: "border-box",
};
const CHARACTER_REFERENCE_SLOT_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
  zIndex: 2,
};
const CHARACTER_REFERENCE_DELETE_BUTTON_INLINE_STYLE: React.CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  border: "1px solid rgba(53, 60, 72, 0.94)",
  background: "rgba(16, 19, 24, 0.96)",
  color: "rgba(228, 234, 243, 0.92)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
const CHARACTER_REFERENCE_MEDIA_INLINE_STYLE: React.CSSProperties = {
  aspectRatio: "4 / 4.35",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px 10px 14px",
  boxSizing: "border-box",
};
const CHARACTER_REFERENCE_DROP_COPY_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
  textAlign: "center",
  color: "rgba(137, 145, 161, 0.8)",
  fontSize: "0.84rem",
  lineHeight: 1.32,
};
const CHARACTER_REFERENCE_DROP_REQUIREMENT_BASE_STYLE: React.CSSProperties = {
  fontSize: "0.82rem",
  fontWeight: 700,
};
const CHARACTER_REFERENCE_HINT_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "28px",
  borderTop: "1px dashed rgba(50, 57, 67, 0.9)",
  color: "rgba(150, 159, 176, 0.82)",
  fontSize: "0.74rem",
  fontWeight: 600,
};
const CHARACTER_MODAL_CREATE_BUTTON_INLINE_STYLE: React.CSSProperties = {
  border: "1px solid rgba(37, 204, 255, 0.58)",
  background: "rgba(28, 32, 37, 0.94)",
  color: "rgba(110, 214, 233, 0.96)",
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.18)",
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
  preferredCharacterId = null,
  suppressSelectedCharacterPersistence = false,
  onSelectedCharacterIdChange,
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
  } = useCharacterManagerDraft({
    preferredCharacterId,
    suppressSelectedCharacterPersistence,
    onSelectedCharacterIdChange,
  });

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
  const inFlightExternalUploadRequestIdsRef = React.useRef<Set<number>>(new Set());
  const characterSheetFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const characterNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const pageBusy =
    loading ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isSavingCharacter ||
    isDeletingCharacter ||
    isSavingCharacterSheetPreset;

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
    handleCharacterSheetCardClick,
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

  const handleCreateNewCharacter = React.useCallback(async () => {
    clearMessages();
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
      if (!nextFiles.length) return false;
      clearMessages();
      const openSlotQueue = SLOT_ASSIGNMENT_ORDER.filter(
        (slotKey) => !resolvedCharacterSheetPresetAssignments[slotKey]
      );
      if (!openSlotQueue.length) {
        setErrorMessage(FULL_SLOT_UPLOAD_ERROR);
        return false;
      }
      let assignedCount = 0;

      for (const file of nextFiles) {
        const targetSlotKey = openSlotQueue[assignedCount] ?? null;
        if (!targetSlotKey) break;
        const saved = await setCharacterSheetPresetFile(targetSlotKey, file);
        if (!saved) return false;
        assignedCount += 1;
      }

      if (nextFiles.length > openSlotQueue.length) {
        setErrorMessage(
          `Only ${openSlotQueue.length} open reference slot${
            openSlotQueue.length === 1 ? " was" : "s were"
          } available. Extra uploads were skipped.`
        );
      }
      return true;
    },
    [
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
    if (inFlightExternalUploadRequestIdsRef.current.has(requestId)) return;
    inFlightExternalUploadRequestIdsRef.current.add(requestId);
    void assignFilesToSlots(activeUploadRequest.files)
      .then((handled) => {
        if (handled) {
          onExternalUploadRequestHandled?.(requestId);
        }
      })
      .finally(() => {
        inFlightExternalUploadRequestIdsRef.current.delete(requestId);
      });
  }, [assignFilesToSlots, externalUploadRequest, onExternalUploadRequestHandled]);

  const handleCharacterSelection = React.useCallback(
    async (characterId: string) => {
      if (pageBusy) return;
      clearMessages();
      setIsCharacterLibraryModalOpen(false);
      await selectCharacter(characterId);
    },
    [clearMessages, pageBusy, selectCharacter]
  );

  const confirmDeleteCharacter = React.useCallback(async () => {
    if (!deleteTargetCharacter) return;
    const deleted = await deleteCharacter(deleteTargetCharacter.characterId);
    if (deleted) {
      setDeleteTargetCharacter(null);
    }
  }, [deleteCharacter, deleteTargetCharacter]);

  const confirmDeleteCharacterSheetPreset = React.useCallback(async () => {
    if (!deleteTargetCharacterSheetPresetId) return;
    const deleted = await deleteCharacterSheetPreset(deleteTargetCharacterSheetPresetId);
    if (deleted) {
      setDeleteTargetCharacterSheetPresetId(null);
    }
  }, [deleteCharacterSheetPreset, deleteTargetCharacterSheetPresetId]);

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
        <section className="character-panel-editor-column">
          {loading || isSwitchingCharacter ? (
            <div className="character-panel-editor-column-panel">
              <CharacterProfileLoadingSkeleton surface="panel" />
            </div>
          ) : (
            <div
              className="character-panel-editor-column-panel"
              style={CHARACTER_TOP_SCROLL_OUTER_STYLE}
            >
              <div style={CHARACTER_TOP_SCROLL_INNER_STYLE}>
                <div style={CHARACTER_TOP_SECTION_CONTENT_STYLE}>
                  <div className="character-profile-card">
                    <div className="character-panel-profile-top-row">
                      <button
                        type="button"
                        className="character-panel-action-btn character-panel-action-btn--picker-accent"
                        style={CHARACTER_BUTTON_INLINE_STYLE}
                        onClick={() => setIsCharacterLibraryModalOpen(true)}
                        disabled={pageBusy}
                      >
                        Characters
                      </button>
                    </div>

                    <div
                      className="character-panel-profile-fields-row"
                      style={CHARACTER_TOP_FIELDS_GRID_INLINE_STYLE}
                    >
                      <div
                        className="character-panel-profile-name-field"
                        style={CHARACTER_TOP_FIELD_GROUP_INLINE_STYLE}
                      >
                        <label
                          className="character-profile-fields character-profile-fields--label-serif"
                          htmlFor="character-panel-name"
                          style={CHARACTER_TOP_FIELD_LABEL_INLINE_STYLE}
                        >
                          <span className="input-label">Name:</span>
                        </label>

                        <div style={CHARACTER_TOP_FIELD_CONTROL_INLINE_STYLE}>
                          <input
                            ref={characterNameInputRef}
                            id="character-panel-name"
                            className="character-name-input"
                            style={CHARACTER_NAME_INPUT_INLINE_STYLE}
                            type="text"
                            value={characterName}
                            maxLength={80}
                            onChange={(event) => setCharacterName(event.target.value)}
                            placeholder="Enter character name"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div style={CHARACTER_TOP_FIELD_CONTROL_INLINE_STYLE}>
                        <div style={CHARACTER_TOP_FIELD_GROUP_INLINE_STYLE}>
                          <div
                            className="character-sheet-looks-title-row character-profile-fields character-profile-fields--label-serif"
                            style={CHARACTER_TOP_FIELD_LABEL_INLINE_STYLE}
                          >
                            <p className="input-label">Looks:</p>
                          </div>

                          <div
                            className="character-sheet-looks-block"
                            style={CHARACTER_LOOKS_BLOCK_INLINE_STYLE}
                          >
                            <CharacterSheetPresetTabs
                              presetIds={visibleCharacterSheetPresetIds}
                              activePresetId={activeCharacterSheetPresetId}
                              presetLabels={characterSheetPresetLabels}
                              compact
                              onSelectPreset={(presetId) => {
                                void setActiveCharacterSheetPreset(presetId);
                              }}
                              onAddPreset={() => {
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
                      </div>
                    </div>
                  </div>

                  <div
                    className="character-sheet-preset-panel"
                    role="tabpanel"
                    id="character-panel-preset-panel"
                    aria-labelledby={activeCharacterSheetPresetTabId}
                  >
                    <div
                      className="character-panel-preset-content-grid"
                      style={CHARACTER_PRESET_CONTENT_GRID_INLINE_STYLE}
                    >
                      {isEmbeddedMediaLibraryMaximized ? null : (
                        <div className="character-panel-preset-description-column">
                          <CharacterDescriptionEditorCard
                            description={characterDescription}
                            maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
                            rows={5}
                            disabled={loading}
                            onChangeDescription={setCharacterDescription}
                          />
                        </div>
                      )}

                      <div
                        className="character-panel-preset-references-column"
                        style={CHARACTER_REFERENCE_COLUMN_INLINE_STYLE}
                      >
                        <div
                          className="character-sheet-references-title-row character-profile-fields character-profile-fields--label-serif"
                          style={CHARACTER_REFERENCE_TITLE_INLINE_STYLE}
                        >
                          <p className="input-label">Character References:</p>
                        </div>
                        <div
                          className="character-reference-empty-grid"
                          style={CHARACTER_REFERENCE_GRID_INLINE_STYLE}
                        >
                          {CHARACTER_SHEET_DROP_ZONES.map((dropZone) => {
                            const assignedReference =
                              resolvedCharacterSheetPresetAssignments[dropZone.key];
                            const isDropActive = activeCharacterSheetDropZone === dropZone.key;
                            const isDropPending =
                              pendingDropTarget?.target === "character_sheet" &&
                              pendingDropTarget.zoneKey === dropZone.key;
                            const isRequiredSlot = dropZone.key === "portrait";
                            const slotRequirementCopy = isRequiredSlot
                              ? "(Required)"
                              : "(Optional)";

                            return (
                              <article
                                key={dropZone.key}
                                className={`character-character-sheet-card ${
                                  assignedReference ? "is-filled" : "is-empty"
                                } ${isDropActive ? "is-drop-active" : ""} ${
                                  draggedCharacterSheetZoneKey === dropZone.key ? "is-dragging" : ""
                                } ${isDropPending ? "is-drop-pending" : ""}`}
                                style={{
                                  ...CHARACTER_REFERENCE_CARD_INLINE_STYLE,
                                  borderColor: isDropActive
                                    ? "rgba(59, 193, 255, 0.82)"
                                    : "rgba(30, 34, 41, 0.96)",
                                  boxShadow: isDropActive
                                    ? "0 0 0 1px rgba(59, 193, 255, 0.18)"
                                    : "none",
                                  opacity: draggedCharacterSheetZoneKey === dropZone.key ? 0.74 : 1,
                                }}
                                draggable={
                                  !pageBusy && !isDropPending && Boolean(assignedReference)
                                }
                                onClick={handleCharacterSheetCardClick(dropZone.key)}
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
                                <div
                                  className="character-panel-slot-actions"
                                  style={CHARACTER_REFERENCE_SLOT_ACTIONS_INLINE_STYLE}
                                >
                                  {assignedReference ? (
                                    <button
                                      type="button"
                                      className="character-list-delete-btn character-reference-delete-btn character-character-sheet-delete-btn"
                                      style={CHARACTER_REFERENCE_DELETE_BUTTON_INLINE_STYLE}
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
                                <div
                                  className="character-character-sheet-media"
                                  style={CHARACTER_REFERENCE_MEDIA_INLINE_STYLE}
                                >
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
                                          event.currentTarget.currentSrc ||
                                            event.currentTarget.src ||
                                            null
                                        );
                                      }}
                                      unoptimized
                                    />
                                  ) : (
                                    <span
                                      className="character-character-sheet-drop-copy tiny"
                                      style={CHARACTER_REFERENCE_DROP_COPY_INLINE_STYLE}
                                    >
                                      <UploadSimple
                                        size={14}
                                        weight="bold"
                                        className="character-character-sheet-drop-icon"
                                        aria-hidden="true"
                                      />
                                      <span>Drag reference here or click to upload</span>
                                      <span
                                        className={`character-character-sheet-drop-requirement ${
                                          isRequiredSlot ? "is-required" : "is-optional"
                                        }`}
                                        style={{
                                          ...CHARACTER_REFERENCE_DROP_REQUIREMENT_BASE_STYLE,
                                          color: isRequiredSlot
                                            ? "rgba(151, 210, 255, 0.96)"
                                            : "rgba(167, 176, 192, 0.78)",
                                        }}
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
                                <span
                                  className="character-reference-empty-hint"
                                  style={CHARACTER_REFERENCE_HINT_INLINE_STYLE}
                                >
                                  {dropZone.label}
                                </span>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
        headerActions={
          <div className="model-modal-header-actions">
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
              className="character-panel-action-btn character-panel-action-btn--picker-accent"
              style={CHARACTER_MODAL_CREATE_BUTTON_INLINE_STYLE}
              onClick={() => {
                void handleCreateNewCharacter();
              }}
              disabled={pageBusy}
            >
              <Plus size={14} weight="bold" aria-hidden />
              <span>Create</span>
            </button>
            <button
              type="button"
              className="ghost-btn mini model-modal-close"
              aria-label="Close character library"
              onClick={() => setIsCharacterLibraryModalOpen(false)}
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        }
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
