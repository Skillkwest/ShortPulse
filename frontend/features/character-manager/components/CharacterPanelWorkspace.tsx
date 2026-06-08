import Image from "next/image";
import React from "react";
import {
  CheckCircle,
  FloppyDisk,
  FolderSimple,
  Plus,
  Trash,
  UploadSimple,
  X,
  XCircle,
} from "phosphor-react";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import {
  CHARACTER_PANEL_FIELD_BACKGROUND,
  CHARACTER_PANEL_FIELD_BORDER,
  CHARACTER_PANEL_SHELL_BACKGROUND,
  CHARACTER_PANEL_TWO_COLUMN_GRID_AREAS,
  CHARACTER_PANEL_TWO_COLUMN_GRID_TEMPLATE,
  CHARACTER_SHEET_DROP_ZONES,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import { resolveCharacterPanelResponsiveLayout } from "../logic/characterPanelResponsiveLayout";
import { getCharacterSheetPresetTabId } from "../logic/characterSheetPresetTabs";
import { useCharacterCardPreviewUrls } from "../hooks/useCharacterCardPreviewUrls";
import { useCharacterManagerCharacterSheetInteractions } from "../hooks/useCharacterManagerCharacterSheetInteractions";
import { useCharacterManagerDragInteractions } from "../hooks/useCharacterManagerDragInteractions";
import {
  useCharacterManagerDroppedReferenceController,
  type ResolveCharacterDropReference,
} from "../hooks/useCharacterManagerDroppedReferenceController";
import { useCharacterManagerDraft } from "../hooks/useCharacterManagerDraft";
import { CharacterDescriptionEditorCard } from "./CharacterDescriptionEditorCard";
import { EmbeddedCharacterLooksControl } from "./EmbeddedCharacterLooksControl";
import { CharacterProfileLoadingSkeleton } from "./CharacterProfileLoadingSkeleton";
import type { CharacterSheetDropZoneKey, CharacterSheetPresetId } from "../types";
import {
  AiStudioPickerCard,
  AiStudioPickerFeedback,
  AiStudioPickerGrid,
  AiStudioPickerModalFrame,
  AiStudioPickerSection,
} from "../../ai-studio/components/picker/AiStudioPickerPrimitives";
import { AiStudioModalLayer } from "../../ai-studio/components/modal-layer/AiStudioModalLayer";

type CharacterPanelWorkspaceProps = {
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  externalCreateRequestKey?: number;
  externalUploadRequest?: CharacterPanelUploadRequest | null;
  onExternalUploadRequestHandled?: (requestId: number) => void;
  preferredCharacterId?: string | null;
  suppressSelectedCharacterPersistence?: boolean;
  onSelectedCharacterIdChange?: (characterId: string | null) => void;
};

const CHARACTER_DESCRIPTION_MAX_LENGTH = 150;
const DND_REFERENCE_SLOT_KEY = "application/x-shortpulse-reference-slot-key";
const DND_CHARACTER_SHEET_ZONE_KEY = "application/x-shortpulse-character-sheet-zone-key";
const MEDIA_BUCKET = "media_library";
const CHARACTER_PROFILE_WRAPPER_BACKGROUND = CHARACTER_PANEL_SHELL_BACKGROUND;
const CHARACTER_TEXT_ENTRY_BACKGROUND = CHARACTER_PANEL_FIELD_BACKGROUND;
const SLOT_ASSIGNMENT_ORDER: CharacterSheetDropZoneKey[] = ["portrait", "close_up", "front_shot"];
const FULL_SLOT_UPLOAD_ERROR =
  "All character reference slots are filled. Clear a slot before adding more media.";
const BUSY_SLOT_UPLOAD_ERROR =
  "Character reference slots are busy. Wait for current uploads to finish before adding more media.";
const CHARACTER_SAVE_SUCCESS_BADGE_DURATION_MS = 2200;
const CHARACTER_PANEL_FIELD_BORDER_COLOR = CHARACTER_PANEL_FIELD_BORDER;
const createCharacterSheetSlotPendingCounts = (): Record<CharacterSheetDropZoneKey, number> => ({
  portrait: 0,
  close_up: 0,
  front_shot: 0,
});
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
  cursor: "pointer",
};
const CHARACTER_TOP_ROW_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
  width: "100%",
  minWidth: 0,
};
const CHARACTER_TOP_ROW_PRIMARY_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};
const CHARACTER_SAVE_SUCCESS_BADGE_INLINE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid rgba(77, 191, 123, 0.42)",
  background: "rgba(20, 66, 39, 0.34)",
  color: "rgba(138, 236, 171, 0.98)",
  boxShadow: "0 0 0 1px rgba(77, 191, 123, 0.08)",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
};
const CHARACTER_TOP_ROW_SECONDARY_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flex: "1 1 0",
  minWidth: 0,
  marginLeft: "auto",
};
const CHARACTER_TOP_FIELDS_GRID_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: CHARACTER_PANEL_TWO_COLUMN_GRID_TEMPLATE,
  columnGap: "34px",
  alignItems: "start",
};
const CHARACTER_FOLDER_ICON_SIZE_PX = 20;
const CHARACTER_FOLDER_ICON_INLINE_STYLE: React.CSSProperties = {
  flex: `0 0 ${CHARACTER_FOLDER_ICON_SIZE_PX}px`,
  width: `${CHARACTER_FOLDER_ICON_SIZE_PX}px`,
  height: `${CHARACTER_FOLDER_ICON_SIZE_PX}px`,
  minWidth: `${CHARACTER_FOLDER_ICON_SIZE_PX}px`,
  minHeight: `${CHARACTER_FOLDER_ICON_SIZE_PX}px`,
  maxWidth: `${CHARACTER_FOLDER_ICON_SIZE_PX}px`,
  maxHeight: `${CHARACTER_FOLDER_ICON_SIZE_PX}px`,
  display: "block",
};
const CHARACTER_BUTTON_LABEL_INLINE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1,
  minHeight: "20px",
};
const CHARACTER_EDITOR_FIELDS_WRAPPER_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "1px",
  marginTop: "2px",
  padding: "12px 8px 3px",
  borderRadius: "15px",
  border: "1px solid rgba(30, 35, 43, 0.96)",
  background: CHARACTER_PROFILE_WRAPPER_BACKGROUND,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
};
const CHARACTER_TOP_FIELD_GROUP_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  alignContent: "start",
  minWidth: 0,
};
const CHARACTER_TOP_FIELD_LABEL_INLINE_STYLE: React.CSSProperties = {
  margin: 0,
};
const CHARACTER_TOP_FIELD_LABEL_TEXT_INLINE_STYLE: React.CSSProperties = {
  display: "block",
  margin: 0,
  color: "#25a9bf",
  textShadow: "0 1px 4px rgba(0, 0, 0, 0.32)",
  fontFamily:
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: "0.84rem",
  lineHeight: 1.16,
  fontWeight: 400,
  letterSpacing: "0.06em",
};
const CHARACTER_TOP_FIELD_CONTROL_INLINE_STYLE: React.CSSProperties = {
  minWidth: 0,
};
const CHARACTER_NAME_INPUT_INLINE_STYLE: React.CSSProperties = {
  height: "36px",
  minHeight: "36px",
  padding: "6px 10px",
  width: "100%",
  borderRadius: "10px",
  border: `1px solid ${CHARACTER_PANEL_FIELD_BORDER_COLOR}`,
  background: CHARACTER_TEXT_ENTRY_BACKGROUND,
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
  display: "flex",
  flexDirection: "column",
  padding: "14px 16px 2px",
  boxSizing: "border-box",
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
  gap: "6px",
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
  display: "grid",
  gap: "2px",
  margin: "0 0 4px",
};
const CHARACTER_REFERENCE_CARD_INLINE_STYLE: React.CSSProperties = {
  width: "min(100%, 114px)",
  aspectRatio: "4 / 5",
  gridTemplateRows: "minmax(0, 1fr) 30px",
  borderRadius: "10px",
  border: `1px solid ${CHARACTER_PANEL_FIELD_BORDER_COLOR}`,
  background: "rgba(12, 14, 19, 0.96)",
  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.28), 0 3px 8px rgba(0, 0, 0, 0.18)",
  overflow: "hidden",
  position: "relative",
  boxSizing: "border-box",
  alignSelf: "start",
};
const CHARACTER_REFERENCE_SLOT_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "2px",
  right: "2px",
  zIndex: 2,
};
const CHARACTER_REFERENCE_DELETE_BUTTON_INLINE_STYLE: React.CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  border: "1px solid rgba(196, 70, 86, 0.9)",
  background: "rgba(73, 18, 27, 0.94)",
  color: "rgba(255, 204, 212, 0.98)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
  boxShadow: "0 0 0 1px rgba(255, 92, 115, 0.12)",
};
const CHARACTER_SECONDARY_ACTION_BUTTON_INLINE_STYLE: React.CSSProperties = {
  minWidth: "84px",
  minHeight: "30px",
  padding: "0 8px",
  fontSize: "0.72rem",
  gap: "4px",
};
const CHARACTER_TOP_ACTION_BUTTON_SIDE_PX = 38;
const CHARACTER_SAVE_ICON_BUTTON_INLINE_STYLE: React.CSSProperties = {
  width: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
  minWidth: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
  maxWidth: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
  height: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
  minHeight: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
  maxHeight: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
  padding: 0,
  borderRadius: "12px",
};
const CHARACTER_TOP_ACTION_BUTTON_TRANSITION =
  "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease";
const CHARACTER_REFERENCE_MEDIA_INLINE_STYLE: React.CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 10px 8px",
  borderBottom: "none",
  aspectRatio: "auto",
  boxSizing: "border-box",
};
const CHARACTER_REFERENCE_MEDIA_FILLED_INLINE_STYLE: React.CSSProperties = {
  alignItems: "stretch",
  justifyContent: "stretch",
  padding: 0,
};
const CHARACTER_REFERENCE_IMAGE_INLINE_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover",
};
const CHARACTER_REFERENCE_DROP_COPY_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  textAlign: "center",
  color: "rgba(137, 145, 161, 0.8)",
  fontSize: "0.78rem",
  lineHeight: 1.32,
};
const CHARACTER_REFERENCE_DROP_REQUIREMENT_BASE_STYLE: React.CSSProperties = {
  fontSize: "0.76rem",
  fontWeight: 700,
};
const CHARACTER_REFERENCE_HINT_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "22px",
  padding: "0 8px",
  borderTop: "1px dashed rgba(50, 57, 67, 0.9)",
  background: CHARACTER_TEXT_ENTRY_BACKGROUND,
  color: "rgba(150, 159, 176, 0.82)",
  fontSize: "0.74rem",
  fontWeight: 600,
  lineHeight: 1.1,
  textAlign: "center",
  boxSizing: "border-box",
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
  preferredCharacterId = null,
  suppressSelectedCharacterPersistence = false,
  onSelectedCharacterIdChange,
}: CharacterPanelWorkspaceProps) {
  const editorColumnPanelRef = React.useRef<HTMLDivElement | null>(null);
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
    characterSaveProgressMessage,
    isDeletingCharacter,
    isSwitchingCharacter,
    isSavingCharacterSheetPreset,
    isDeletingCharacterSheetPreset,
    hasUnsavedCharacterDraftChanges,
    setCharacterName,
    setCharacterDescription,
    setActiveCharacterSheetPreset,
    saveCharacterSheetPresetAssignments,
    addCharacterSheetPreset,
    renameCharacterSheetPreset,
    deleteCharacterSheetPreset,
    setCharacterSheetPresetFile,
    setCharacterSheetPresetStorageReference,
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
  const [hoveredCharacterSheetActionZone, setHoveredCharacterSheetActionZone] =
    React.useState<CharacterSheetDropZoneKey | null>(null);
  const [draggedCharacterSheetZoneKey, setDraggedCharacterSheetZoneKey] =
    React.useState<CharacterSheetDropZoneKey | null>(null);
  const [measuredReferenceCardHeightPx, setMeasuredReferenceCardHeightPx] = React.useState<
    number | null
  >(null);
  const [pendingCharacterSheetUploadZoneKey, setPendingCharacterSheetUploadZoneKey] =
    React.useState<CharacterSheetDropZoneKey | null>(null);
  const [pendingCharacterSheetUploadCounts, setPendingCharacterSheetUploadCounts] = React.useState<
    Record<CharacterSheetDropZoneKey, number>
  >(createCharacterSheetSlotPendingCounts);
  const [isCharacterLibraryModalOpen, setIsCharacterLibraryModalOpen] = React.useState(false);
  const [deleteTargetCharacter, setDeleteTargetCharacter] = React.useState<{
    characterId: string;
    characterName: string;
  } | null>(null);
  const [isDiscardUnsavedDraftConfirmOpen, setIsDiscardUnsavedDraftConfirmOpen] =
    React.useState(false);
  const [showSaveSuccessIndicator, setShowSaveSuccessIndicator] = React.useState(false);
  const [hoveredTopActionButton, setHoveredTopActionButton] = React.useState<
    "characters" | "save" | "create" | null
  >(null);
  const [deleteTargetCharacterSheetPresetId, setDeleteTargetCharacterSheetPresetId] =
    React.useState<CharacterSheetPresetId | null>(null);
  const lastHandledExternalCreateRequestKeyRef = React.useRef(0);
  const inFlightExternalUploadRequestIdsRef = React.useRef<Set<number>>(new Set());
  const handledExternalUploadRequestIdsRef = React.useRef<Set<number>>(new Set());
  const saveSuccessHideTimerRef = React.useRef<number | null>(null);
  const characterSheetFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const characterNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const [editorPanelSize, setEditorPanelSize] = React.useState(() => ({
    width: 0,
    height: 0,
  }));
  const structuralBusy =
    loading ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isSavingCharacter ||
    isDeletingCharacter ||
    isDeletingCharacterSheetPreset;
  const pageBusy = structuralBusy || isSavingCharacterSheetPreset;
  const looksControlDisabled =
    loading ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isSavingCharacter ||
    isDeletingCharacter ||
    isDeletingCharacterSheetPreset;
  const characterLibraryButtonDisabled =
    loading || isSwitchingCharacter || isCreatingCharacter || isDeletingCharacter;
  const characterLibrarySelectionDisabled = pageBusy;
  const saveActionDisabled = pageBusy;
  const createActionDisabled = pageBusy;
  const resolvedCharacterSaveProgressMessage =
    characterSaveProgressMessage ?? "Saving character...";
  const isAnyCharacterSheetSlotPending = React.useMemo(
    () => Object.values(pendingCharacterSheetUploadCounts).some((count) => count > 0),
    [pendingCharacterSheetUploadCounts]
  );
  const slotMutationBusy = pageBusy || isAnyCharacterSheetSlotPending;

  const resolvedCharacterSheetPresetAssignments = React.useMemo(
    () => characterSheetPresetAssignments ?? createEmptyCharacterSheetPresetAssignments(),
    [characterSheetPresetAssignments]
  );
  const activeCharacterSheetPresetTabId = getCharacterSheetPresetTabId(
    "character-panel-looks",
    activeCharacterSheetPresetId
  );
  const deleteTargetCharacterSheetPresetLabel = deleteTargetCharacterSheetPresetId
    ? characterSheetPresetLabels[deleteTargetCharacterSheetPresetId]
    : null;

  React.useEffect(() => {
    const node = editorColumnPanelRef.current;
    if (!node || typeof ResizeObserver !== "function") return;

    const syncSize = () => {
      const nextWidth = node.clientWidth || Math.round(node.getBoundingClientRect().width);
      const nextHeight = node.clientHeight || Math.round(node.getBoundingClientRect().height);
      setEditorPanelSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    const observer = new ResizeObserver(syncSize);
    observer.observe(node);
    syncSize();
    return () => observer.disconnect();
  }, [loading, isSwitchingCharacter]);

  const responsiveLayout = React.useMemo(
    () =>
      resolveCharacterPanelResponsiveLayout({
        panelWidthPx: editorPanelSize.width,
      }),
    [editorPanelSize.width]
  );

  const actionButtonStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_BUTTON_INLINE_STYLE,
      minWidth: `${responsiveLayout.actionButtonMinWidthPx}px`,
      minHeight: `${responsiveLayout.actionButtonMinHeightPx}px`,
      padding: `0 ${responsiveLayout.actionButtonHorizontalPaddingPx}px`,
    }),
    [responsiveLayout]
  );

  const charactersButtonStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_BUTTON_INLINE_STYLE,
      boxSizing: "border-box",
      width: "134px",
      minWidth: "134px",
      maxWidth: "134px",
      height: "38px",
      minHeight: "38px",
      maxHeight: "38px",
      padding: "0 18px",
      borderRadius: "11px",
      fontSize: "0.92rem",
      lineHeight: 1,
    }),
    []
  );

  const topRowActionsStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_TOP_ROW_ACTIONS_INLINE_STYLE,
      gap: `${Math.max(6, responsiveLayout.topFieldGroupGapPx + 1)}px`,
    }),
    [responsiveLayout.topFieldGroupGapPx]
  );

  const topRowPrimaryActionsStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_TOP_ROW_PRIMARY_ACTIONS_INLINE_STYLE,
      gap: `${Math.max(6, responsiveLayout.topFieldGroupGapPx + 1)}px`,
    }),
    [responsiveLayout.topFieldGroupGapPx]
  );

  const topRowSecondaryActionsStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_TOP_ROW_SECONDARY_ACTIONS_INLINE_STYLE,
      gap: `${Math.max(6, responsiveLayout.topFieldGroupGapPx + 1)}px`,
    }),
    [responsiveLayout.topFieldGroupGapPx]
  );

  const secondaryActionButtonStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...actionButtonStyle,
      ...CHARACTER_SECONDARY_ACTION_BUTTON_INLINE_STYLE,
      minWidth: `${Math.max(84, responsiveLayout.actionButtonMinWidthPx - 58)}px`,
      minHeight: `${Math.max(30, responsiveLayout.actionButtonMinHeightPx - 12)}px`,
      padding: `0 ${Math.max(8, responsiveLayout.actionButtonHorizontalPaddingPx - 10)}px`,
      fontSize: "0.72rem",
      gap: "4px",
    }),
    [actionButtonStyle, responsiveLayout]
  );

  const saveIconButtonBaseStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...secondaryActionButtonStyle,
      ...CHARACTER_SAVE_ICON_BUTTON_INLINE_STYLE,
    }),
    [secondaryActionButtonStyle]
  );

  const createActionButtonBaseStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...secondaryActionButtonStyle,
      width: "fit-content",
      minWidth: "fit-content",
      height: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
      minHeight: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
      maxHeight: `${CHARACTER_TOP_ACTION_BUTTON_SIDE_PX}px`,
      flex: "0 0 auto",
    }),
    [secondaryActionButtonStyle]
  );

  const getTopActionButtonStyle = React.useCallback(
    (
      baseStyle: React.CSSProperties,
      isHovered: boolean,
      disabled: boolean
    ): React.CSSProperties => ({
      ...baseStyle,
      transition: CHARACTER_TOP_ACTION_BUTTON_TRANSITION,
      transform: !disabled && isHovered ? "translateY(-2px)" : "translateY(0)",
      borderColor: !disabled && isHovered ? "rgba(77, 214, 255, 0.84)" : baseStyle.borderColor,
      background: !disabled && isHovered ? "rgba(36, 41, 47, 0.98)" : baseStyle.background,
      backgroundColor:
        !disabled && isHovered ? "rgba(36, 41, 47, 0.98)" : baseStyle.backgroundColor,
      boxShadow:
        !disabled && isHovered
          ? "0 10px 22px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(37, 204, 255, 0.12)"
          : baseStyle.boxShadow,
    }),
    []
  );

  const charactersTopButtonStyle = React.useMemo(
    () =>
      getTopActionButtonStyle(
        charactersButtonStyle,
        hoveredTopActionButton === "characters",
        characterLibraryButtonDisabled
      ),
    [
      characterLibraryButtonDisabled,
      charactersButtonStyle,
      getTopActionButtonStyle,
      hoveredTopActionButton,
    ]
  );

  const saveTopButtonStyle = React.useMemo(
    () =>
      getTopActionButtonStyle(
        saveIconButtonBaseStyle,
        hoveredTopActionButton === "save",
        saveActionDisabled
      ),
    [getTopActionButtonStyle, hoveredTopActionButton, saveActionDisabled, saveIconButtonBaseStyle]
  );

  const createTopButtonStyle = React.useMemo(
    () =>
      getTopActionButtonStyle(
        createActionButtonBaseStyle,
        hoveredTopActionButton === "create",
        createActionDisabled
      ),
    [
      createActionButtonBaseStyle,
      createActionDisabled,
      getTopActionButtonStyle,
      hoveredTopActionButton,
    ]
  );

  React.useEffect(
    () => () => {
      if (saveSuccessHideTimerRef.current) {
        window.clearTimeout(saveSuccessHideTimerRef.current);
      }
    },
    []
  );

  const topFieldsGridStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_TOP_FIELDS_GRID_INLINE_STYLE,
      columnGap: `${responsiveLayout.topFieldsColumnGapPx}px`,
      rowGap: `${responsiveLayout.topFieldsRowGapPx}px`,
    }),
    [responsiveLayout]
  );

  const editorFieldsWrapperStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_EDITOR_FIELDS_WRAPPER_STYLE,
      alignContent: "start",
      gap: `${responsiveLayout.editorWrapperGapPx}px`,
      padding: `${Math.max(8, responsiveLayout.editorWrapperPaddingTopPx - 2)}px ${responsiveLayout.editorWrapperPaddingXpx}px ${responsiveLayout.editorWrapperPaddingBottomPx}px`,
    }),
    [responsiveLayout]
  );

  const characterProfileCardStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      flexDirection: "column",
    }),
    []
  );

  const topFieldGroupStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_TOP_FIELD_GROUP_INLINE_STYLE,
      gap: `${responsiveLayout.topFieldGroupGapPx}px`,
    }),
    [responsiveLayout]
  );

  const nameInputStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_NAME_INPUT_INLINE_STYLE,
      height: `${responsiveLayout.nameInputHeightPx}px`,
      minHeight: `${responsiveLayout.nameInputHeightPx}px`,
    }),
    [responsiveLayout]
  );

  const topScrollInnerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_TOP_SCROLL_INNER_STYLE,
      gap: `${Math.max(4, responsiveLayout.contentGapPx - 2)}px`,
    }),
    [responsiveLayout]
  );

  const topSectionContentStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_TOP_SECTION_CONTENT_STYLE,
      padding: `${responsiveLayout.contentPaddingTopPx}px ${responsiveLayout.contentPaddingXpx}px ${responsiveLayout.contentPaddingBottomPx}px`,
    }),
    [responsiveLayout]
  );

  const presetContentGridStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_PRESET_CONTENT_GRID_INLINE_STYLE,
      display: "grid",
      gridTemplateColumns: CHARACTER_PANEL_TWO_COLUMN_GRID_TEMPLATE,
      gridTemplateAreas: CHARACTER_PANEL_TWO_COLUMN_GRID_AREAS,
      columnGap: `${responsiveLayout.presetContentColumnGapPx}px`,
      rowGap: `${responsiveLayout.presetContentRowGapPx}px`,
      alignItems: "start",
    }),
    [responsiveLayout]
  );

  const descriptionColumnStyle = React.useMemo<React.CSSProperties>(
    () => ({
      gridArea: "description",
      minWidth: 0,
      display: "grid",
      alignContent: "start",
    }),
    []
  );

  const referenceColumnStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_REFERENCE_COLUMN_INLINE_STYLE,
      gridArea: "references",
      gap: `${responsiveLayout.referenceColumnGapPx}px`,
    }),
    [responsiveLayout]
  );

  const referenceGridStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...CHARACTER_REFERENCE_GRID_INLINE_STYLE,
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: `${responsiveLayout.referenceGridGapPx}px`,
      alignItems: "start",
    }),
    [responsiveLayout]
  );

  const { refreshCardPreviewSignedUrl, resolveCharacterCardPreviewUrl } =
    useCharacterCardPreviewUrls({
      selectedCharacterId,
      adaptivePreviewEnabled: false,
      pressureLevel: 0,
    });

  const setCharacterSheetSlotPending = React.useCallback(
    (zoneKey: CharacterSheetDropZoneKey, direction: 1 | -1) => {
      setPendingCharacterSheetUploadCounts((current) => ({
        ...current,
        [zoneKey]: Math.max(0, (current[zoneKey] ?? 0) + direction),
      }));
    },
    []
  );

  const isCharacterSheetSlotPending = React.useCallback(
    (zoneKey: CharacterSheetDropZoneKey) => (pendingCharacterSheetUploadCounts[zoneKey] ?? 0) > 0,
    [pendingCharacterSheetUploadCounts]
  );

  const setCharacterSheetPresetFileWithPending = React.useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, file: File) => {
      setCharacterSheetSlotPending(zoneKey, 1);
      try {
        return await setCharacterSheetPresetFile(zoneKey, file);
      } finally {
        setCharacterSheetSlotPending(zoneKey, -1);
      }
    },
    [setCharacterSheetPresetFile, setCharacterSheetSlotPending]
  );

  const setCharacterSheetPresetStorageReferenceWithPending = React.useCallback(
    async (
      zoneKey: CharacterSheetDropZoneKey,
      reference: {
        storagePath: string;
        previewUrl: string | null;
        filename?: string | null;
        mimeType?: string | null;
      }
    ) => {
      setCharacterSheetSlotPending(zoneKey, 1);
      try {
        return await setCharacterSheetPresetStorageReference(zoneKey, reference);
      } finally {
        setCharacterSheetSlotPending(zoneKey, -1);
      }
    },
    [setCharacterSheetPresetStorageReference, setCharacterSheetSlotPending]
  );

  const { handleCharacterSheetReferenceDrop } = useCharacterManagerDroppedReferenceController({
    setCharacterSheetPresetFile,
    setCharacterSheetPresetStorageReference: setCharacterSheetPresetStorageReferenceWithPending,
    resolveCharacterDropReference,
  });

  const handleCharacterSheetReferenceDropWithPending = React.useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, transfer: DataTransfer) => {
      setCharacterSheetSlotPending(zoneKey, 1);
      try {
        await handleCharacterSheetReferenceDrop(zoneKey, transfer);
      } finally {
        setCharacterSheetSlotPending(zoneKey, -1);
      }
    },
    [handleCharacterSheetReferenceDrop, setCharacterSheetSlotPending]
  );

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
    intakeBusy: structuralBusy,
    slotMutationBusy,
    isAnyCharacterSheetSlotPending,
    isCharacterSheetSlotPending,
    pendingCharacterSheetUploadZoneKey,
    setPendingCharacterSheetUploadZoneKey,
    setCharacterSheetPresetFile: setCharacterSheetPresetFileWithPending,
    resolvedCharacterSheetPresetAssignments,
    saveCharacterSheetPresetAssignments,
    draggedCharacterSheetZoneKey,
    canResolveCharacterDropReference: Boolean(resolveCharacterDropReference),
    handleCharacterSheetReferenceDrop: handleCharacterSheetReferenceDropWithPending,
    setActiveCharacterSheetDropZone,
    openCharacterSheetPicker,
    characterSheetZoneMimeType: DND_CHARACTER_SHEET_ZONE_KEY,
  });

  const { handleCharacterSheetDragStart, handleReferenceDragEnd } =
    useCharacterManagerDragInteractions({
      dragBusy: slotMutationBusy,
      resolvedCharacterSheetPresetAssignments,
      setDraggedCharacterSheetZoneKey,
      setActiveCharacterSheetDropZone,
      referenceSlotMimeType: DND_REFERENCE_SLOT_KEY,
      characterSheetZoneMimeType: DND_CHARACTER_SHEET_ZONE_KEY,
    });

  const createNewCharacter = React.useCallback(async () => {
    clearMessages();
    setIsDiscardUnsavedDraftConfirmOpen(false);
    setIsCharacterLibraryModalOpen(false);
    await createCharacter();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        characterNameInputRef.current?.focus();
        characterNameInputRef.current?.select();
      });
    }
  }, [clearMessages, createCharacter]);

  const handleCreateNewCharacter = React.useCallback(async () => {
    if (hasUnsavedCharacterDraftChanges) {
      setIsDiscardUnsavedDraftConfirmOpen(true);
      return;
    }
    await createNewCharacter();
  }, [createNewCharacter, hasUnsavedCharacterDraftChanges]);

  const triggerSaveSuccessIndicator = React.useCallback(() => {
    setShowSaveSuccessIndicator(true);
    if (saveSuccessHideTimerRef.current) {
      window.clearTimeout(saveSuccessHideTimerRef.current);
    }
    saveSuccessHideTimerRef.current = window.setTimeout(() => {
      setShowSaveSuccessIndicator(false);
      saveSuccessHideTimerRef.current = null;
    }, CHARACTER_SAVE_SUCCESS_BADGE_DURATION_MS);
  }, []);

  const handleSaveCharacter = React.useCallback(async () => {
    setShowSaveSuccessIndicator(false);
    const saved = await saveCharacter();
    if (saved) {
      triggerSaveSuccessIndicator();
    }
  }, [saveCharacter, triggerSaveSuccessIndicator]);

  const referenceCardMeasureObserverRef = React.useRef<ResizeObserver | null>(null);
  const handleReferenceCardMeasureRef = React.useCallback((node: HTMLElement | null) => {
    referenceCardMeasureObserverRef.current?.disconnect();
    referenceCardMeasureObserverRef.current = null;

    if (!node || typeof ResizeObserver !== "function") {
      return;
    }

    const syncHeight = () => {
      const nextHeight = Math.round(node.getBoundingClientRect().height || node.clientHeight || 0);
      if (nextHeight <= 0) return;
      setMeasuredReferenceCardHeightPx((current) =>
        current === nextHeight ? current : nextHeight
      );
    };

    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    referenceCardMeasureObserverRef.current = observer;
    syncHeight();
  }, []);

  React.useEffect(
    () => () => {
      referenceCardMeasureObserverRef.current?.disconnect();
    },
    []
  );

  const assignFilesToSlots = React.useCallback(
    async (files: File[]) => {
      const nextFiles = files.filter((file) => file instanceof File);
      if (!nextFiles.length) return false;
      clearMessages();
      const openSlotQueue = SLOT_ASSIGNMENT_ORDER.filter(
        (slotKey) =>
          !resolvedCharacterSheetPresetAssignments[slotKey] && !isCharacterSheetSlotPending(slotKey)
      );
      if (!openSlotQueue.length) {
        setErrorMessage(
          isAnyCharacterSheetSlotPending ? BUSY_SLOT_UPLOAD_ERROR : FULL_SLOT_UPLOAD_ERROR
        );
        return false;
      }
      let assignedCount = 0;

      for (const file of nextFiles) {
        const targetSlotKey = openSlotQueue[assignedCount] ?? null;
        if (!targetSlotKey) break;
        const saved = await setCharacterSheetPresetFileWithPending(targetSlotKey, file);
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
      isAnyCharacterSheetSlotPending,
      isCharacterSheetSlotPending,
      resolvedCharacterSheetPresetAssignments,
      setCharacterSheetPresetFileWithPending,
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
    if (handledExternalUploadRequestIdsRef.current.has(requestId)) return;
    if (inFlightExternalUploadRequestIdsRef.current.has(requestId)) return;
    inFlightExternalUploadRequestIdsRef.current.add(requestId);
    void assignFilesToSlots(activeUploadRequest.files)
      .catch(() => false)
      .finally(() => {
        handledExternalUploadRequestIdsRef.current.add(requestId);
        onExternalUploadRequestHandled?.(requestId);
        inFlightExternalUploadRequestIdsRef.current.delete(requestId);
      });
  }, [assignFilesToSlots, externalUploadRequest, onExternalUploadRequestHandled]);

  const handleCharacterSelection = React.useCallback(
    async (characterId: string) => {
      if (characterLibrarySelectionDisabled) return;
      clearMessages();
      setIsCharacterLibraryModalOpen(false);
      await selectCharacter(characterId);
    },
    [characterLibrarySelectionDisabled, clearMessages, selectCharacter]
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
    <div className="character-panel-workspace">
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
        {isSavingCharacter ? resolvedCharacterSaveProgressMessage : ""}
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
              ref={editorColumnPanelRef}
              style={CHARACTER_TOP_SCROLL_OUTER_STYLE}
            >
              <div style={topScrollInnerStyle}>
                <div style={topSectionContentStyle}>
                  <div className="character-profile-card" style={characterProfileCardStyle}>
                    <div className="character-panel-profile-top-row" style={topRowActionsStyle}>
                      <div style={topRowPrimaryActionsStyle}>
                        <button
                          type="button"
                          className="character-panel-action-btn character-panel-action-btn--picker-accent"
                          style={charactersTopButtonStyle}
                          aria-describedby={
                            isSavingCharacter ? "character-save-progress-status" : undefined
                          }
                          onClick={() => setIsCharacterLibraryModalOpen(true)}
                          onMouseEnter={() => setHoveredTopActionButton("characters")}
                          onMouseLeave={() =>
                            setHoveredTopActionButton((current) =>
                              current === "characters" ? null : current
                            )
                          }
                          disabled={characterLibraryButtonDisabled}
                        >
                          <FolderSimple
                            size={CHARACTER_FOLDER_ICON_SIZE_PX}
                            weight="fill"
                            aria-hidden
                            style={CHARACTER_FOLDER_ICON_INLINE_STYLE}
                          />
                          <span style={CHARACTER_BUTTON_LABEL_INLINE_STYLE}>Characters</span>
                        </button>
                      </div>
                      <div style={topRowSecondaryActionsStyle}>
                        {isSavingCharacter ? (
                          <span
                            id="character-save-progress-status"
                            className="character-panel-save-progress"
                            role="status"
                            aria-live="polite"
                            aria-label={resolvedCharacterSaveProgressMessage}
                          >
                            <span
                              className="character-panel-save-progress-spinner"
                              aria-hidden="true"
                            />
                            <span>{resolvedCharacterSaveProgressMessage}</span>
                          </span>
                        ) : null}
                        {showSaveSuccessIndicator ? (
                          <span
                            role="status"
                            aria-live="polite"
                            aria-label="Character saved"
                            style={CHARACTER_SAVE_SUCCESS_BADGE_INLINE_STYLE}
                          >
                            <CheckCircle size={14} weight="fill" aria-hidden />
                            <span>Saved</span>
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="character-panel-action-btn"
                          style={saveTopButtonStyle}
                          aria-label={isSavingCharacter ? "Saving..." : "Save"}
                          title={isSavingCharacter ? "Saving..." : "Save"}
                          onClick={() => {
                            void handleSaveCharacter();
                          }}
                          onMouseEnter={() => setHoveredTopActionButton("save")}
                          onMouseLeave={() =>
                            setHoveredTopActionButton((current) =>
                              current === "save" ? null : current
                            )
                          }
                          disabled={saveActionDisabled}
                        >
                          <FloppyDisk size={20} weight="fill" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="character-panel-action-btn character-panel-action-btn--picker-accent"
                          style={createTopButtonStyle}
                          onClick={() => {
                            void handleCreateNewCharacter();
                          }}
                          onMouseEnter={() => setHoveredTopActionButton("create")}
                          onMouseLeave={() =>
                            setHoveredTopActionButton((current) =>
                              current === "create" ? null : current
                            )
                          }
                          disabled={createActionDisabled}
                        >
                          <Plus size={14} weight="bold" aria-hidden />
                          <span>Create</span>
                        </button>
                      </div>
                    </div>

                    <div style={editorFieldsWrapperStyle}>
                      <div
                        className="character-panel-profile-fields-row"
                        style={topFieldsGridStyle}
                      >
                        <div
                          className="character-panel-profile-name-field"
                          style={topFieldGroupStyle}
                        >
                          <label
                            htmlFor="character-panel-name"
                            style={CHARACTER_TOP_FIELD_LABEL_INLINE_STYLE}
                          >
                            <span style={CHARACTER_TOP_FIELD_LABEL_TEXT_INLINE_STYLE}>Name:</span>
                          </label>

                          <div style={CHARACTER_TOP_FIELD_CONTROL_INLINE_STYLE}>
                            <input
                              ref={characterNameInputRef}
                              id="character-panel-name"
                              className="character-name-input"
                              style={nameInputStyle}
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
                          <div style={topFieldGroupStyle}>
                            <div
                              className="character-sheet-looks-block"
                              style={CHARACTER_LOOKS_BLOCK_INLINE_STYLE}
                            >
                              <EmbeddedCharacterLooksControl
                                presetIds={visibleCharacterSheetPresetIds}
                                activePresetId={activeCharacterSheetPresetId}
                                presetLabels={characterSheetPresetLabels}
                                onSelectPreset={(presetId) => {
                                  if (looksControlDisabled || isSavingCharacterSheetPreset) return;
                                  void setActiveCharacterSheetPreset(presetId);
                                }}
                                onAddPreset={() => {
                                  if (looksControlDisabled || isSavingCharacterSheetPreset) return;
                                  void addCharacterSheetPreset();
                                }}
                                onRenamePreset={(presetId, nextLabel) => {
                                  if (looksControlDisabled || isSavingCharacterSheetPreset) return;
                                  void renameCharacterSheetPreset(presetId, nextLabel);
                                }}
                                onDeletePreset={(presetId) => {
                                  if (looksControlDisabled) return;
                                  clearMessages();
                                  setDeleteTargetCharacterSheetPresetId(presetId);
                                }}
                                panelId="character-panel-preset-panel"
                                disabled={looksControlDisabled}
                                headerContent={
                                  <div style={CHARACTER_TOP_FIELD_LABEL_INLINE_STYLE}>
                                    <p style={CHARACTER_TOP_FIELD_LABEL_TEXT_INLINE_STYLE}>
                                      Looks:
                                    </p>
                                  </div>
                                }
                                idBase="character-panel-looks"
                                viewportMinHeightPx={responsiveLayout.looksViewportMinHeightPx}
                                viewportPaddingXpx={responsiveLayout.looksViewportPaddingXpx}
                                railMinHeightPx={responsiveLayout.looksRailMinHeightPx}
                                tabMinWidthPx={responsiveLayout.looksTabMinWidthPx}
                                tabHeightPx={responsiveLayout.looksTabHeightPx}
                                deleteButtonTopPx={responsiveLayout.looksDeleteButtonTopPx}
                                deleteButtonRightPx={responsiveLayout.looksDeleteButtonRightPx}
                              />
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
                          style={presetContentGridStyle}
                        >
                          <div
                            className="character-panel-preset-description-column"
                            style={descriptionColumnStyle}
                          >
                            <CharacterDescriptionEditorCard
                              description={characterDescription}
                              maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
                              rows={5}
                              disabled={loading}
                              cardGapPx={responsiveLayout.descriptionCardGapPx}
                              containerHeightPx={
                                measuredReferenceCardHeightPx ??
                                responsiveLayout.descriptionHeightPx
                              }
                              containerPaddingTopPx={
                                responsiveLayout.descriptionContainerPaddingTopPx
                              }
                              containerPaddingXpx={responsiveLayout.descriptionContainerPaddingXpx}
                              containerPaddingBottomPx={
                                responsiveLayout.descriptionContainerPaddingBottomPx
                              }
                              textareaPaddingYpx={responsiveLayout.descriptionTextareaPaddingYpx}
                              footerMinHeightPx={responsiveLayout.descriptionFooterMinHeightPx}
                              onChangeDescription={setCharacterDescription}
                            />
                          </div>

                          <div
                            className="character-panel-preset-references-column"
                            style={referenceColumnStyle}
                          >
                            <div style={CHARACTER_REFERENCE_TITLE_INLINE_STYLE}>
                              <p style={CHARACTER_TOP_FIELD_LABEL_TEXT_INLINE_STYLE}>
                                Character References:
                              </p>
                            </div>
                            <div
                              className="character-reference-empty-grid"
                              style={referenceGridStyle}
                            >
                              {CHARACTER_SHEET_DROP_ZONES.map((dropZone) => {
                                const assignedReference =
                                  resolvedCharacterSheetPresetAssignments[dropZone.key];
                                const isDropActive = activeCharacterSheetDropZone === dropZone.key;
                                const isDropPending = isCharacterSheetSlotPending(dropZone.key);
                                const showDeleteButton =
                                  Boolean(assignedReference) &&
                                  hoveredCharacterSheetActionZone === dropZone.key;
                                const isRequiredSlot = dropZone.key === "portrait";
                                const slotRequirementCopy = isRequiredSlot
                                  ? "(Required)"
                                  : "(Optional)";

                                return (
                                  <article
                                    key={dropZone.key}
                                    ref={
                                      dropZone.key === "portrait"
                                        ? handleReferenceCardMeasureRef
                                        : null
                                    }
                                    className={`character-character-sheet-card ${
                                      assignedReference ? "is-filled" : "is-empty"
                                    } ${isDropActive ? "is-drop-active" : ""} ${
                                      draggedCharacterSheetZoneKey === dropZone.key
                                        ? "is-dragging"
                                        : ""
                                    } ${isDropPending ? "is-drop-pending" : ""}`}
                                    aria-busy={isDropPending}
                                    style={{
                                      ...CHARACTER_REFERENCE_CARD_INLINE_STYLE,
                                      width: "100%",
                                      maxWidth: `${responsiveLayout.referenceCardMaxWidthPx}px`,
                                      gridTemplateRows: `minmax(0, 1fr) ${responsiveLayout.referenceHintMinHeightPx}px`,
                                      justifySelf: "stretch",
                                      borderColor: isDropActive
                                        ? "rgba(59, 193, 255, 0.82)"
                                        : CHARACTER_PANEL_FIELD_BORDER_COLOR,
                                      boxShadow: isDropActive
                                        ? "0 0 0 1px rgba(59, 193, 255, 0.18), 0 14px 30px rgba(0, 0, 0, 0.28), 0 3px 8px rgba(0, 0, 0, 0.18)"
                                        : CHARACTER_REFERENCE_CARD_INLINE_STYLE.boxShadow,
                                      opacity:
                                        draggedCharacterSheetZoneKey === dropZone.key ? 0.74 : 1,
                                    }}
                                    draggable={
                                      !slotMutationBusy &&
                                      !isDropPending &&
                                      Boolean(assignedReference)
                                    }
                                    onClick={handleCharacterSheetCardClick(dropZone.key)}
                                    onDoubleClick={() => {
                                      void openSlotPreview(dropZone.key);
                                    }}
                                    onDragStart={handleCharacterSheetDragStart(dropZone.key)}
                                    onDragEnd={handleReferenceDragEnd}
                                    onMouseEnter={() => {
                                      setHoveredCharacterSheetActionZone(dropZone.key);
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredCharacterSheetActionZone((current) =>
                                        current === dropZone.key ? null : current
                                      );
                                    }}
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
                                      style={{
                                        ...CHARACTER_REFERENCE_SLOT_ACTIONS_INLINE_STYLE,
                                        top: 0,
                                        right: 0,
                                      }}
                                    >
                                      {assignedReference ? (
                                        <button
                                          type="button"
                                          className="character-list-delete-btn character-reference-delete-btn character-character-sheet-delete-btn"
                                          style={{
                                            ...CHARACTER_REFERENCE_DELETE_BUTTON_INLINE_STYLE,
                                            width: `${responsiveLayout.referenceDeleteButtonSizePx}px`,
                                            height: `${responsiveLayout.referenceDeleteButtonSizePx}px`,
                                            opacity: showDeleteButton ? 1 : 0,
                                            pointerEvents: showDeleteButton ? "auto" : "none",
                                            transition: "opacity 140ms ease",
                                          }}
                                          aria-label={`Clear ${dropZone.label} reference`}
                                          draggable={false}
                                          onPointerDown={(event) => {
                                            event.stopPropagation();
                                          }}
                                          onMouseDown={(event) => {
                                            event.stopPropagation();
                                          }}
                                          onDragStart={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                          }}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            void clearCharacterSheetAssignment(dropZone.key);
                                          }}
                                          disabled={slotMutationBusy}
                                        >
                                          <Trash size={12} weight="bold" />
                                        </button>
                                      ) : null}
                                    </div>
                                    <div
                                      className="character-character-sheet-media"
                                      style={{
                                        ...CHARACTER_REFERENCE_MEDIA_INLINE_STYLE,
                                        padding: `${responsiveLayout.referenceMediaPaddingTopPx}px ${responsiveLayout.referenceMediaPaddingXpx}px ${responsiveLayout.referenceMediaPaddingBottomPx}px`,
                                        ...(assignedReference
                                          ? CHARACTER_REFERENCE_MEDIA_FILLED_INLINE_STYLE
                                          : null),
                                      }}
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
                                          style={CHARACTER_REFERENCE_IMAGE_INLINE_STYLE}
                                          draggable={false}
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
                                          style={{
                                            ...CHARACTER_REFERENCE_DROP_COPY_INLINE_STYLE,
                                            gap: `${responsiveLayout.referenceDropCopyGapPx}px`,
                                          }}
                                        >
                                          <UploadSimple
                                            size={responsiveLayout.referenceDropIconSizePx}
                                            weight="bold"
                                            className="character-character-sheet-drop-icon"
                                            aria-hidden="true"
                                          />
                                          <span>Upload references</span>
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
                                            <span className="sr-only">Loading reference...</span>
                                          ) : null}
                                        </span>
                                      )}
                                    </div>
                                    {isDropPending ? (
                                      <div
                                        className="character-character-sheet-loading-overlay"
                                        role="status"
                                        aria-live="polite"
                                        aria-label={`Loading ${dropZone.label} reference`}
                                      >
                                        <span className="character-character-sheet-loading-indicator">
                                          <span
                                            className="character-character-sheet-loading-spinner"
                                            aria-hidden="true"
                                          />
                                          <span>Loading...</span>
                                        </span>
                                      </div>
                                    ) : null}
                                    <span
                                      className="character-reference-empty-hint"
                                      style={{
                                        ...CHARACTER_REFERENCE_HINT_INLINE_STYLE,
                                        minHeight: `${responsiveLayout.referenceHintMinHeightPx}px`,
                                      }}
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
              </div>
            </div>
          )}
        </section>
      </div>

      {deleteTargetCharacter ? (
        <AiStudioModalLayer>
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
        </AiStudioModalLayer>
      ) : null}

      {isDiscardUnsavedDraftConfirmOpen ? (
        <ConfirmationModal
          title="Start a new character?"
          titleId="discard-unsaved-character-draft-title"
          body={
            <p>
              Your current unsaved character draft will be discarded. Save it first if you want to
              keep these changes.
            </p>
          }
          confirmLabel="Discard Draft"
          cancelDisabled={isCreatingCharacter}
          confirmDisabled={isCreatingCharacter}
          confirmBusyLabel={isCreatingCharacter ? "Discarding..." : undefined}
          onCancel={() => setIsDiscardUnsavedDraftConfirmOpen(false)}
          onConfirm={() => {
            void createNewCharacter();
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
          confirmBusyLabel={isDeletingCharacterSheetPreset ? "Deleting..." : undefined}
          confirmDisabled={isDeletingCharacterSheetPreset}
          cancelDisabled={isDeletingCharacterSheetPreset}
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
              className="ai-character-picker-library-btn"
              disabled={createActionDisabled}
              onClick={() => {
                void handleCreateNewCharacter();
              }}
            >
              + Create New Character
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
        {isSavingCharacter ? (
          <div
            className="character-panel-save-progress character-panel-save-progress--modal"
            role="status"
            aria-live="polite"
            aria-label={resolvedCharacterSaveProgressMessage}
          >
            <span className="character-panel-save-progress-spinner" aria-hidden="true" />
            <span>{resolvedCharacterSaveProgressMessage}</span>
          </div>
        ) : null}
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
                    disabled={characterLibrarySelectionDisabled}
                    footer={
                      <div className="ai-character-picker-card-delete-control">
                        <button
                          type="button"
                          className="ai-character-picker-card-delete-btn"
                          aria-label={`Delete ${chipName}`}
                          disabled={characterLibrarySelectionDisabled}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDeleteTargetCharacter({
                              characterId: character.characterId,
                              characterName: chipName,
                            });
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
