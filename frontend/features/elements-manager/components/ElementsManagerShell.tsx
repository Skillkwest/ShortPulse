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
import { AiStudioModalLayer } from "../../ai-studio/components/modal-layer/AiStudioModalLayer";
import { readMediaLibraryDragPayload } from "../../ai-studio/logic/mediaLibraryDragPayload";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";
import { hasDroppedImageReferenceTransfer } from "../../character-manager/logic/characterDropPayload";
import { buildElementProfileImageBackgroundStyle } from "../logic/elementProfileImageTransform";
import { swapElementImageReferenceSlots } from "../logic/elementReferenceSlots";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
import {
  ELEMENT_PANEL_ACCENT,
  ELEMENT_PANEL_ACCENT_FAINT,
  ELEMENT_PANEL_ACCENT_LABEL,
  ELEMENT_PANEL_ACCENT_PROGRESS_TEXT,
  ELEMENT_PANEL_ACCENT_SOFT,
} from "../constants";
import { ElementsDescriptionEditorCard } from "./ElementsDescriptionEditorCard";

type ElementsManagerShellProps = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  externalCreateRequestKey?: number;
};

const IMAGE_REFERENCE_SLOT_LABELS = ["Primary View", "Secondary View", "Detail View"] as const;
const DND_ELEMENT_REFERENCE_SLOT_INDEX = "application/x-shortpulse-element-reference-slot-index";
const ELEMENT_REFERENCE_DRAG_GHOST_SCALE = 0.74;
const ELEMENT_REFERENCE_DRAG_GHOST_SELECTOR =
  ".elements-reference-media, .elements-reference-image";
const ELEMENT_DESCRIPTION_MAX_LENGTH = 150;
const ELEMENT_LIBRARY_AVATAR_SIZE_PX = 44;
const ELEMENT_SAVE_SUCCESS_BADGE_DURATION_MS = 2200;
const ELEMENT_PANEL_SHELL_BACKGROUND = "rgba(31, 35, 40, 0.94)";
const ELEMENT_PANEL_FIELD_BACKGROUND = "#131518";
const ELEMENT_PANEL_FIELD_BORDER_COLOR = "rgba(34, 40, 49, 0.96)";
const ELEMENT_BUTTON_INLINE_STYLE: React.CSSProperties = {
  minWidth: "152px",
  minHeight: "48px",
  padding: "0 20px",
  borderRadius: "14px",
  fontSize: "0.9rem",
  flexShrink: 0,
  border: `1px solid ${ELEMENT_PANEL_ACCENT}`,
  background: "rgba(28, 32, 37, 0.94)",
  color: ELEMENT_PANEL_ACCENT_SOFT,
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.18)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  cursor: "pointer",
};
const ELEMENT_TOP_ROW_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
  width: "100%",
  minWidth: 0,
};
const ELEMENT_TOP_ROW_PRIMARY_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};
const ELEMENT_TOP_ROW_SECONDARY_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flex: "1 1 0",
  minWidth: 0,
  marginLeft: "auto",
};
const ELEMENT_FOLDER_ICON_SIZE_PX = 20;
const ELEMENT_FOLDER_ICON_INLINE_STYLE: React.CSSProperties = {
  flex: `0 0 ${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  width: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  height: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  minWidth: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  minHeight: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  maxWidth: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  maxHeight: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  display: "block",
};
const ELEMENT_BUTTON_LABEL_INLINE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1,
  minHeight: "20px",
};
const ELEMENT_EDITOR_FIELDS_WRAPPER_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  marginTop: "2px",
  padding: "12px 8px 3px",
  borderRadius: "15px",
  border: "1px solid rgba(30, 35, 43, 0.96)",
  background: ELEMENT_PANEL_SHELL_BACKGROUND,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
};
const ELEMENT_TOP_FIELD_GROUP_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  alignContent: "start",
  minWidth: 0,
};
const ELEMENT_TOP_FIELD_LABEL_INLINE_STYLE: React.CSSProperties = {
  margin: 0,
};
const ELEMENT_TOP_FIELD_LABEL_TEXT_INLINE_STYLE: React.CSSProperties = {
  display: "block",
  margin: 0,
  color: ELEMENT_PANEL_ACCENT_LABEL,
  textShadow: "0 1px 4px rgba(0, 0, 0, 0.32)",
  fontFamily:
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: "0.84rem",
  lineHeight: 1.16,
  fontWeight: 400,
  letterSpacing: "0.06em",
};
const ELEMENT_TOP_FIELD_CONTROL_INLINE_STYLE: React.CSSProperties = {
  minWidth: 0,
};
const ELEMENT_NAME_INPUT_INLINE_STYLE: React.CSSProperties = {
  height: "36px",
  minHeight: "36px",
  padding: "6px 10px",
  width: "100%",
  borderRadius: "10px",
  border: `1px solid ${ELEMENT_PANEL_FIELD_BORDER_COLOR}`,
  background: ELEMENT_PANEL_FIELD_BACKGROUND,
  color: "rgba(242, 246, 252, 0.96)",
  boxSizing: "border-box",
};
const ELEMENT_EDITOR_CONTENT_GRID_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.02fr) minmax(0, 0.98fr)",
  gridTemplateAreas: '"name empty" "description references"',
  columnGap: "34px",
  rowGap: "18px",
  alignItems: "start",
};
const ELEMENT_TOP_SECTION_CONTENT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "10px 16px 5px",
  boxSizing: "border-box",
};
const ELEMENT_NAME_COLUMN_INLINE_STYLE: React.CSSProperties = {
  gridArea: "name",
  minWidth: 0,
};
const ELEMENT_DESCRIPTION_COLUMN_INLINE_STYLE: React.CSSProperties = {
  gridArea: "description",
  minWidth: 0,
  display: "grid",
  alignContent: "start",
};
const ELEMENT_REFERENCE_COLUMN_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "10px",
  minWidth: 0,
  gridArea: "references",
};
const ELEMENT_REFERENCE_TITLE_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "2px",
  margin: "0 0 4px",
};
const ELEMENT_REFERENCE_GRID_INLINE_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  alignItems: "start",
};
const ELEMENT_REFERENCE_CARD_INLINE_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: "156px",
  minHeight: 0,
  aspectRatio: "4 / 5",
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) 30px",
  borderRadius: "10px",
  border: `1px solid ${ELEMENT_PANEL_FIELD_BORDER_COLOR}`,
  background: "rgba(12, 14, 19, 0.96)",
  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.28), 0 3px 8px rgba(0, 0, 0, 0.18)",
  overflow: "hidden",
  position: "relative",
  boxSizing: "border-box",
  alignSelf: "start",
  justifySelf: "stretch",
};
const ELEMENT_REFERENCE_SLOT_ACTIONS_INLINE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  zIndex: 2,
};
const ELEMENT_REFERENCE_DELETE_BUTTON_INLINE_STYLE: React.CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  border: "1px solid rgba(187, 71, 108, 0.9)",
  background: "rgba(69, 18, 35, 0.94)",
  color: "rgba(255, 214, 227, 0.98)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
  boxShadow: `0 0 0 1px ${ELEMENT_PANEL_ACCENT_FAINT}`,
};
const ELEMENT_REFERENCE_MEDIA_INLINE_STYLE: React.CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 10px 8px",
  background: "rgba(12, 14, 19, 0.96)",
  borderBottom: "none",
  aspectRatio: "auto",
  boxSizing: "border-box",
};
const ELEMENT_REFERENCE_MEDIA_FILLED_INLINE_STYLE: React.CSSProperties = {
  alignItems: "stretch",
  justifyContent: "stretch",
  padding: 0,
};
const ELEMENT_REFERENCE_IMAGE_INLINE_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover",
};
const ELEMENT_REFERENCE_DROP_COPY_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  paddingInline: "8px",
  textAlign: "center",
  color: "rgba(137, 145, 161, 0.8)",
  fontSize: "0.78rem",
  lineHeight: 1.32,
  whiteSpace: "pre-line",
};
const ELEMENT_REFERENCE_DROP_REQUIREMENT_BASE_STYLE: React.CSSProperties = {
  marginTop: "2px",
  fontSize: "0.76rem",
  fontWeight: 700,
};
const ELEMENT_REFERENCE_HINT_INLINE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "22px",
  padding: "0 8px",
  borderTop: "1px dashed rgba(50, 57, 67, 0.9)",
  background: ELEMENT_PANEL_FIELD_BACKGROUND,
  color: "rgba(150, 159, 176, 0.82)",
  fontSize: "0.74rem",
  fontWeight: 600,
  lineHeight: 1.1,
  textAlign: "center",
  boxSizing: "border-box",
};
const ELEMENT_SECONDARY_ACTION_BUTTON_INLINE_STYLE: React.CSSProperties = {
  minWidth: "84px",
  minHeight: "30px",
  padding: "0 8px",
  fontSize: "0.72rem",
  gap: "4px",
};
const ELEMENT_TOP_ACTION_BUTTON_SIDE_PX = 38;
const ELEMENT_SAVE_ICON_BUTTON_INLINE_STYLE: React.CSSProperties = {
  width: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  minWidth: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  maxWidth: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  height: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  minHeight: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  maxHeight: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  padding: 0,
  borderRadius: "12px",
};
const ELEMENT_TOP_ACTION_BUTTON_TRANSITION =
  "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease";
const ELEMENT_SAVE_SUCCESS_BADGE_INLINE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid rgba(231, 92, 134, 0.22)",
  background: "rgba(55, 17, 34, 0.54)",
  color: ELEMENT_PANEL_ACCENT_PROGRESS_TEXT,
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
};
const ELEMENT_SAVE_PROGRESS_BADGE_INLINE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid rgba(231, 92, 134, 0.28)",
  background: "rgba(70, 20, 41, 0.62)",
  color: ELEMENT_PANEL_ACCENT_PROGRESS_TEXT,
  boxShadow: `0 0 0 1px ${ELEMENT_PANEL_ACCENT_FAINT}`,
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0",
  whiteSpace: "nowrap",
};

const buildElementInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "EL";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
};

export function ElementsManagerShell({
  resolveProfileImageDropSource,
  externalCreateRequestKey = 0,
}: ElementsManagerShellProps) {
  const editorColumnPanelRef = React.useRef<HTMLDivElement | null>(null);
  const elementNameInputRef = React.useRef<HTMLInputElement | null>(null);
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
    assignActiveVideoReference,
    clearActiveImageReferenceAtIndex,
    clearActiveVideoReference,
    onHandleImageReferenceTransferAtIndex,
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
  const referenceDragGhostMapRef = React.useRef(new Map<HTMLElement, HTMLElement>());
  const [activeSheetDropIndex, setActiveSheetDropIndex] = React.useState<number | null>(null);
  const [draggedReferenceSlotIndex, setDraggedReferenceSlotIndex] = React.useState<number | null>(
    null
  );
  const [isElementLibraryModalOpen, setIsElementLibraryModalOpen] = React.useState(false);
  const [showSaveSuccessIndicator, setShowSaveSuccessIndicator] = React.useState(false);
  const [hoveredTopActionButton, setHoveredTopActionButton] = React.useState<
    "elements" | "save" | "create" | null
  >(null);
  const [hoveredReferenceCardIndex, setHoveredReferenceCardIndex] = React.useState<number | null>(
    null
  );
  const [pendingReferenceUploadCounts, setPendingReferenceUploadCounts] = React.useState<
    Record<number, number>
  >({});
  const [measuredReferenceCardHeightPx, setMeasuredReferenceCardHeightPx] = React.useState<
    number | null
  >(null);
  const [editorPanelWidth, setEditorPanelWidth] = React.useState(0);
  const saveSuccessHideTimerRef = React.useRef<number | null>(null);
  const referenceCardMeasureObserverRef = React.useRef<ResizeObserver | null>(null);
  const selectedElement = elements.find((item) => item.id === selectedElementId) ?? null;
  const pendingDeleteElement = pendingDeleteElementId
    ? (elements.find((item) => item.id === pendingDeleteElementId) ?? null)
    : null;
  const selectedElementName = selectedElement?.name || "Untitled element";
  const structuralBusy = loading || isSwitchingElement || isCreatingElement || isDeletingElement;
  const pageBusy = structuralBusy || isSavingElement;
  const libraryButtonDisabled =
    loading || isSwitchingElement || isCreatingElement || isDeletingElement;
  const librarySelectionDisabled = pageBusy;
  const createActionDisabled = pageBusy;
  const saveActionDisabled = pageBusy;

  const topRowActionsStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_TOP_ROW_ACTIONS_INLINE_STYLE,
    }),
    []
  );

  const topRowPrimaryActionsStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_TOP_ROW_PRIMARY_ACTIONS_INLINE_STYLE,
    }),
    []
  );

  const topRowSecondaryActionsStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_TOP_ROW_SECONDARY_ACTIONS_INLINE_STYLE,
    }),
    []
  );

  const elementsButtonStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_BUTTON_INLINE_STYLE,
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

  const secondaryActionButtonStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_BUTTON_INLINE_STYLE,
      ...ELEMENT_SECONDARY_ACTION_BUTTON_INLINE_STYLE,
      borderColor: "rgba(201, 205, 214, 0.16)",
      background: "rgba(24, 28, 33, 0.94)",
      color: "rgba(228, 235, 243, 0.94)",
      boxShadow: "none",
    }),
    []
  );

  const saveIconButtonBaseStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...secondaryActionButtonStyle,
      ...ELEMENT_SAVE_ICON_BUTTON_INLINE_STYLE,
    }),
    [secondaryActionButtonStyle]
  );

  const createActionButtonBaseStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...secondaryActionButtonStyle,
      width: "fit-content",
      minWidth: "fit-content",
      height: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
      minHeight: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
      maxHeight: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
      flex: "0 0 auto",
      borderColor: ELEMENT_PANEL_ACCENT,
      background: "rgba(28, 32, 37, 0.94)",
      color: ELEMENT_PANEL_ACCENT_SOFT,
      boxShadow: "0 6px 14px rgba(0, 0, 0, 0.18)",
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
      transition: ELEMENT_TOP_ACTION_BUTTON_TRANSITION,
      transform: !disabled && isHovered ? "translateY(-2px)" : "translateY(0)",
      borderColor: !disabled && isHovered ? "rgba(240, 135, 172, 0.84)" : baseStyle.borderColor,
      background: !disabled && isHovered ? "rgba(36, 41, 47, 0.98)" : baseStyle.background,
      backgroundColor:
        !disabled && isHovered ? "rgba(36, 41, 47, 0.98)" : baseStyle.backgroundColor,
      boxShadow:
        !disabled && isHovered
          ? `0 10px 22px rgba(0, 0, 0, 0.24), 0 0 0 1px ${ELEMENT_PANEL_ACCENT_FAINT}`
          : baseStyle.boxShadow,
    }),
    []
  );

  const elementsTopButtonStyle = React.useMemo(
    () =>
      getTopActionButtonStyle(
        elementsButtonStyle,
        hoveredTopActionButton === "elements",
        libraryButtonDisabled && elements.length === 0
      ),
    [
      elements.length,
      elementsButtonStyle,
      getTopActionButtonStyle,
      hoveredTopActionButton,
      libraryButtonDisabled,
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

  const profileCardStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }),
    []
  );

  const topSectionContentStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_TOP_SECTION_CONTENT_STYLE,
    }),
    []
  );

  const editorFieldsWrapperStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_EDITOR_FIELDS_WRAPPER_STYLE,
    }),
    []
  );

  const topFieldGroupStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_TOP_FIELD_GROUP_INLINE_STYLE,
    }),
    []
  );

  const nameInputStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_NAME_INPUT_INLINE_STYLE,
    }),
    []
  );

  const editorContentGridStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_EDITOR_CONTENT_GRID_INLINE_STYLE,
      gridTemplateColumns:
        editorPanelWidth > 0 && editorPanelWidth <= 760
          ? "minmax(0, 1fr)"
          : "minmax(0, 1.02fr) minmax(0, 0.98fr)",
      gridTemplateAreas:
        editorPanelWidth > 0 && editorPanelWidth <= 760
          ? '"name" "description" "references"'
          : '"name empty" "description references"',
    }),
    [editorPanelWidth]
  );

  const nameColumnStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_NAME_COLUMN_INLINE_STYLE,
    }),
    []
  );

  const descriptionColumnStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_DESCRIPTION_COLUMN_INLINE_STYLE,
    }),
    []
  );

  const referenceColumnStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_REFERENCE_COLUMN_INLINE_STYLE,
    }),
    []
  );

  const referenceGridStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...ELEMENT_REFERENCE_GRID_INLINE_STYLE,
      gridTemplateColumns:
        draft.assetType === "image"
          ? editorPanelWidth > 0 && editorPanelWidth <= 640
            ? "minmax(0, 1fr)"
            : editorPanelWidth > 0 && editorPanelWidth <= 860
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(3, minmax(0, 1fr))"
          : "minmax(0, 156px)",
    }),
    [draft.assetType, editorPanelWidth]
  );

  const setReferenceSlotPending = React.useCallback((slotIndex: number, direction: 1 | -1) => {
    setPendingReferenceUploadCounts((current) => ({
      ...current,
      [slotIndex]: Math.max(0, (current[slotIndex] ?? 0) + direction),
    }));
  }, []);

  const isReferenceSlotPending = React.useCallback(
    (slotIndex: number) => (pendingReferenceUploadCounts[slotIndex] ?? 0) > 0,
    [pendingReferenceUploadCounts]
  );

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

  React.useEffect(
    () => () => {
      referenceCardMeasureObserverRef.current?.disconnect();
    },
    []
  );

  React.useEffect(() => {
    const node = editorColumnPanelRef.current;
    if (!node || typeof ResizeObserver !== "function") return;

    const syncWidth = () => {
      const nextWidth = Math.round(node.getBoundingClientRect().width || node.clientWidth || 0);
      if (nextWidth <= 0) return;
      setEditorPanelWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    const observer = new ResizeObserver(syncWidth);
    observer.observe(node);
    syncWidth();
    return () => observer.disconnect();
  }, []);

  const canAcceptSheetDrop = React.useCallback(
    (transfer: DataTransfer | null | undefined): boolean => {
      if (!transfer) return false;
      const libraryPayload = readMediaLibraryDragPayload(transfer);
      if (draft.assetType === "image") {
        const sourceReferenceSlotIndex = transfer.getData(DND_ELEMENT_REFERENCE_SLOT_INDEX);
        const canAcceptLibraryImage =
          libraryPayload?.kind === "libraryMedia" && libraryPayload.payload.fileType === "image";
        return Boolean(
          sourceReferenceSlotIndex ||
          draggedReferenceSlotIndex != null ||
          canAcceptLibraryImage ||
          extractInternalReferenceDragPayload(transfer) ||
          hasInternalReferenceDragTypeHints(transfer) ||
          hasDroppedImageReferenceTransfer(transfer)
        );
      }
      const canAcceptLibraryMedia =
        libraryPayload?.kind === "libraryMedia" && libraryPayload.payload.fileType === "video";
      return Boolean(
        canAcceptLibraryMedia ||
        extractInternalReferenceDragPayload(transfer) ||
        hasInternalReferenceDragTypeHints(transfer)
      );
    },
    [draft.assetType, draggedReferenceSlotIndex]
  );

  const resolveDraggedReferenceSlotIndex = React.useCallback(
    (transfer: DataTransfer): number | null => {
      const transferIndexValue = transfer.getData(DND_ELEMENT_REFERENCE_SLOT_INDEX);
      if (/^\d+$/.test(transferIndexValue)) {
        return Number.parseInt(transferIndexValue, 10);
      }
      return draggedReferenceSlotIndex;
    },
    [draggedReferenceSlotIndex]
  );

  const applyReferenceSlotDragGhost = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    const transfer = event.dataTransfer;
    if (typeof transfer.setDragImage !== "function") {
      dragNode.classList.add("is-dragging");
      return;
    }
    try {
      const ghostSourceNode =
        dragNode.querySelector<HTMLElement>(ELEMENT_REFERENCE_DRAG_GHOST_SELECTOR) ?? dragNode;
      const sourceRect = ghostSourceNode.getBoundingClientRect();
      const fallbackRect = dragNode.getBoundingClientRect();
      const sourceWidth = sourceRect.width > 0 ? sourceRect.width : fallbackRect.width;
      const sourceHeight = sourceRect.height > 0 ? sourceRect.height : fallbackRect.height;
      const scaledWidth = Math.max(56, sourceWidth * ELEMENT_REFERENCE_DRAG_GHOST_SCALE);
      const scaledHeight = Math.max(72, sourceHeight * ELEMENT_REFERENCE_DRAG_GHOST_SCALE);
      const ghost = ghostSourceNode.cloneNode(true) as HTMLElement;
      ghost.classList.add("elements-reference-drag-ghost");
      ghost.style.boxSizing = "border-box";
      ghost.style.width = `${scaledWidth}px`;
      ghost.style.height = `${scaledHeight}px`;
      ghost.style.transform = `scale(${ELEMENT_REFERENCE_DRAG_GHOST_SCALE}) rotate(-2deg)`;
      ghost.style.transformOrigin = "center";
      ghost.style.position = "absolute";
      ghost.style.top = "-9999px";
      ghost.style.left = "-9999px";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.96";

      document.body.appendChild(ghost);
      referenceDragGhostMapRef.current.set(dragNode, ghost);
      transfer.setDragImage(ghost, scaledWidth / 2, scaledHeight / 2);
    } catch {
      transfer.setDragImage(dragNode, dragNode.offsetWidth / 2, dragNode.offsetHeight / 2);
    }
    dragNode.classList.add("is-dragging");
  }, []);

  const handleSheetDragEnter = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      const sourceReferenceSlotIndex =
        draft.assetType === "image" ? resolveDraggedReferenceSlotIndex(event.dataTransfer) : null;
      if (
        draft.assetType === "image" &&
        isReferenceSlotPending(slotIndex) &&
        sourceReferenceSlotIndex == null
      ) {
        return;
      }
      if (!canAcceptSheetDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = sourceReferenceSlotIndex == null ? "copy" : "move";
      setActiveSheetDropIndex(slotIndex);
    },
    [canAcceptSheetDrop, draft.assetType, isReferenceSlotPending, resolveDraggedReferenceSlotIndex]
  );

  const handleSheetDragOver = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      const sourceReferenceSlotIndex =
        draft.assetType === "image" ? resolveDraggedReferenceSlotIndex(event.dataTransfer) : null;
      if (
        draft.assetType === "image" &&
        isReferenceSlotPending(slotIndex) &&
        sourceReferenceSlotIndex == null
      ) {
        return;
      }
      if (!canAcceptSheetDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = sourceReferenceSlotIndex == null ? "copy" : "move";
      setActiveSheetDropIndex(slotIndex);
    },
    [canAcceptSheetDrop, draft.assetType, isReferenceSlotPending, resolveDraggedReferenceSlotIndex]
  );

  const handleSheetDrop = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      const sourceReferenceSlotIndex =
        draft.assetType === "image" ? resolveDraggedReferenceSlotIndex(event.dataTransfer) : null;
      if (
        draft.assetType === "image" &&
        isReferenceSlotPending(slotIndex) &&
        sourceReferenceSlotIndex == null
      ) {
        return;
      }
      if (!canAcceptSheetDrop(event.dataTransfer)) return;
      event.preventDefault();
      setActiveSheetDropIndex(null);
      if (draft.assetType === "video") {
        const mediaLibraryPayload = readMediaLibraryDragPayload(event.dataTransfer);
        const droppedReferenceUrl =
          mediaLibraryPayload?.kind === "libraryMedia" &&
          mediaLibraryPayload.payload.fileType === "video"
            ? mediaLibraryPayload.payload.fullUrl?.trim() ||
              mediaLibraryPayload.payload.url?.trim() ||
              mediaLibraryPayload.payload.previewUrl?.trim() ||
              null
            : null;
        if (droppedReferenceUrl) {
          assignActiveVideoReference(droppedReferenceUrl);
        }
        return;
      }

      if (sourceReferenceSlotIndex != null) {
        setDraggedReferenceSlotIndex(null);
        const nextImageReferenceUrls = swapElementImageReferenceSlots(
          draft.imageReferenceUrls,
          sourceReferenceSlotIndex,
          slotIndex
        );
        if (nextImageReferenceUrls) {
          updateDraftField("imageReferenceUrls", nextImageReferenceUrls);
        }
        return;
      }

      setReferenceSlotPending(slotIndex, 1);
      void onHandleImageReferenceTransferAtIndex(slotIndex, event.dataTransfer).finally(() => {
        setReferenceSlotPending(slotIndex, -1);
      });
    },
    [
      assignActiveVideoReference,
      canAcceptSheetDrop,
      draft.assetType,
      draft.imageReferenceUrls,
      isReferenceSlotPending,
      onHandleImageReferenceTransferAtIndex,
      resolveDraggedReferenceSlotIndex,
      setReferenceSlotPending,
      updateDraftField,
    ]
  );

  const handleReferenceSlotDragStart = React.useCallback(
    (slotIndex: number) => (event: React.DragEvent<HTMLElement>) => {
      const slotValue = draft.imageReferenceUrls[slotIndex]?.trim() ?? "";
      if (
        pageBusy ||
        draft.assetType !== "image" ||
        isReferenceSlotPending(slotIndex) ||
        !slotValue
      ) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DND_ELEMENT_REFERENCE_SLOT_INDEX, String(slotIndex));
      event.dataTransfer.setData("text/plain", slotValue);
      setDraggedReferenceSlotIndex(slotIndex);
      applyReferenceSlotDragGhost(event);
    },
    [
      applyReferenceSlotDragGhost,
      draft.assetType,
      draft.imageReferenceUrls,
      isReferenceSlotPending,
      pageBusy,
    ]
  );

  const handleReferenceSlotDragEnd = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    dragNode.classList.remove("is-dragging");
    const ghost = referenceDragGhostMapRef.current.get(dragNode);
    if (ghost) {
      ghost.remove();
      referenceDragGhostMapRef.current.delete(dragNode);
    }
    setDraggedReferenceSlotIndex(null);
    setActiveSheetDropIndex(null);
  }, []);

  React.useEffect(
    () => () => {
      for (const ghost of referenceDragGhostMapRef.current.values()) {
        ghost.remove();
      }
      referenceDragGhostMapRef.current.clear();
    },
    []
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
    Promise.resolve(onCreateElement()).then(() => {
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          elementNameInputRef.current?.focus();
          elementNameInputRef.current?.select();
        });
      }
    });
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
            <div className="elements-panel-editor-column-panel" ref={editorColumnPanelRef}>
              <div style={topSectionContentStyle}>
                <div className="elements-profile-card" style={profileCardStyle}>
                  <div className="elements-panel-profile-top-row" style={topRowActionsStyle}>
                    <div
                      className="elements-panel-top-row-primary-actions"
                      style={topRowPrimaryActionsStyle}
                    >
                      <button
                        type="button"
                        className="elements-panel-action-btn elements-panel-action-btn--picker-accent"
                        style={elementsTopButtonStyle}
                        onClick={() => setIsElementLibraryModalOpen(true)}
                        onMouseEnter={() => setHoveredTopActionButton("elements")}
                        onMouseLeave={() =>
                          setHoveredTopActionButton((current) =>
                            current === "elements" ? null : current
                          )
                        }
                        disabled={libraryButtonDisabled && elements.length === 0}
                      >
                        <FolderSimple
                          size={20}
                          weight="fill"
                          aria-hidden
                          style={ELEMENT_FOLDER_ICON_INLINE_STYLE}
                        />
                        <span style={ELEMENT_BUTTON_LABEL_INLINE_STYLE}>Elements</span>
                      </button>
                    </div>

                    <div
                      className="elements-panel-top-row-secondary-actions"
                      style={topRowSecondaryActionsStyle}
                    >
                      {isSavingElement ? (
                        <span
                          className="elements-panel-save-progress"
                          role="status"
                          aria-live="polite"
                          aria-label="Saving element"
                          style={ELEMENT_SAVE_PROGRESS_BADGE_INLINE_STYLE}
                        >
                          <span
                            className="elements-panel-save-progress-spinner"
                            aria-hidden="true"
                          />
                          <span>Saving...</span>
                        </span>
                      ) : null}
                      {showSaveSuccessIndicator ? (
                        <span
                          className="elements-panel-save-success"
                          role="status"
                          aria-live="polite"
                          aria-label={`${selectedElementName} saved`}
                          style={ELEMENT_SAVE_SUCCESS_BADGE_INLINE_STYLE}
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
                        style={saveTopButtonStyle}
                        onClick={() => {
                          void handleSaveElement();
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
                        className="elements-panel-action-btn elements-panel-action-btn--picker-accent"
                        style={createTopButtonStyle}
                        onClick={() => {
                          handleCreateNewElement();
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
                        <span style={ELEMENT_BUTTON_LABEL_INLINE_STYLE}>Create</span>
                      </button>
                    </div>
                  </div>

                  <div style={editorFieldsWrapperStyle}>
                    <div style={editorContentGridStyle}>
                      <div
                        className="elements-panel-profile-fields-row elements-panel-profile-fields-row--name"
                        style={nameColumnStyle}
                      >
                        <div className="elements-profile-field" style={topFieldGroupStyle}>
                          <label
                            htmlFor="element-manager-name"
                            style={ELEMENT_TOP_FIELD_LABEL_INLINE_STYLE}
                          >
                            <span style={ELEMENT_TOP_FIELD_LABEL_TEXT_INLINE_STYLE}>Name:</span>
                          </label>
                          <div style={ELEMENT_TOP_FIELD_CONTROL_INLINE_STYLE}>
                            <input
                              ref={elementNameInputRef}
                              id="element-manager-name"
                              className="elements-name-input"
                              style={nameInputStyle}
                              type="text"
                              value={draft.name}
                              onChange={(event) => updateDraftField("name", event.target.value)}
                              placeholder="Enter element name"
                            />
                          </div>
                        </div>
                      </div>
                      <div style={descriptionColumnStyle}>
                        <ElementsDescriptionEditorCard
                          description={draft.description}
                          maxLength={ELEMENT_DESCRIPTION_MAX_LENGTH}
                          containerHeightPx={measuredReferenceCardHeightPx ?? 142.5}
                          onChangeDescription={(value) => updateDraftField("description", value)}
                        />
                      </div>

                      <div style={referenceColumnStyle}>
                        <div
                          className="elements-reference-title-row"
                          style={ELEMENT_REFERENCE_TITLE_INLINE_STYLE}
                        >
                          <p style={ELEMENT_TOP_FIELD_LABEL_TEXT_INLINE_STYLE}>
                            Element References:
                          </p>
                        </div>
                        <div style={referenceGridStyle}>
                          {(draft.assetType === "image"
                            ? IMAGE_REFERENCE_SLOT_LABELS
                            : (["Motion Reference"] as const)
                          ).map((slotLabel, index) => {
                            const slotValue =
                              draft.assetType === "image"
                                ? (draft.imageReferenceUrls[index] ?? "")
                                : draft.videoReferenceUrl;
                            const isDropPending =
                              draft.assetType === "image" && isReferenceSlotPending(index);
                            const isRequiredSlot = draft.assetType === "video" || index < 2;
                            const showDeleteButton =
                              Boolean(slotValue) &&
                              hoveredReferenceCardIndex === index &&
                              !isDropPending;
                            return (
                              <article
                                key={`${slotLabel}-${index + 1}`}
                                ref={index === 0 ? handleReferenceCardMeasureRef : null}
                                className={`elements-reference-card ${
                                  slotValue ? "is-filled" : "is-empty"
                                } ${activeSheetDropIndex === index ? "is-drop-active" : ""} ${
                                  isDropPending ? "is-drop-pending" : ""
                                } ${draggedReferenceSlotIndex === index ? "is-dragging" : ""}`}
                                aria-busy={isDropPending}
                                style={{
                                  ...ELEMENT_REFERENCE_CARD_INLINE_STYLE,
                                  borderColor:
                                    activeSheetDropIndex === index
                                      ? "rgba(231, 92, 134, 0.82)"
                                      : ELEMENT_PANEL_FIELD_BORDER_COLOR,
                                  boxShadow:
                                    activeSheetDropIndex === index
                                      ? "0 0 0 1px rgba(231, 92, 134, 0.18), 0 14px 30px rgba(0, 0, 0, 0.28), 0 3px 8px rgba(0, 0, 0, 0.18)"
                                      : ELEMENT_REFERENCE_CARD_INLINE_STYLE.boxShadow,
                                  opacity: draggedReferenceSlotIndex === index ? 0.74 : 1,
                                }}
                                draggable={
                                  draft.assetType === "image" &&
                                  Boolean(slotValue) &&
                                  !pageBusy &&
                                  !isDropPending
                                }
                                onDragStart={handleReferenceSlotDragStart(index)}
                                onDragEnd={handleReferenceSlotDragEnd}
                                onMouseEnter={() => setHoveredReferenceCardIndex(index)}
                                onMouseLeave={() =>
                                  setHoveredReferenceCardIndex((current) =>
                                    current === index ? null : current
                                  )
                                }
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
                                <div style={ELEMENT_REFERENCE_SLOT_ACTIONS_INLINE_STYLE}>
                                  {slotValue ? (
                                    <button
                                      type="button"
                                      className="elements-reference-delete-btn"
                                      style={{
                                        ...ELEMENT_REFERENCE_DELETE_BUTTON_INLINE_STYLE,
                                        opacity: showDeleteButton ? 1 : 0,
                                        pointerEvents: showDeleteButton ? "auto" : "none",
                                        transition: "opacity 140ms ease",
                                      }}
                                      aria-label={`Clear ${slotLabel} reference`}
                                      disabled={isDropPending}
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
                                </div>
                                <div
                                  className="elements-reference-media"
                                  style={{
                                    ...ELEMENT_REFERENCE_MEDIA_INLINE_STYLE,
                                    ...(slotValue
                                      ? ELEMENT_REFERENCE_MEDIA_FILLED_INLINE_STYLE
                                      : null),
                                  }}
                                >
                                  {slotValue ? (
                                    draft.assetType === "video" ? (
                                      <video
                                        src={slotValue}
                                        aria-label={`${slotLabel} reference`}
                                        className="elements-reference-image"
                                        style={ELEMENT_REFERENCE_IMAGE_INLINE_STYLE}
                                        muted
                                        playsInline
                                        preload="metadata"
                                      />
                                    ) : (
                                      <Image
                                        src={slotValue}
                                        alt={`${slotLabel} reference`}
                                        className="elements-reference-image"
                                        style={ELEMENT_REFERENCE_IMAGE_INLINE_STYLE}
                                        width={240}
                                        height={300}
                                        unoptimized
                                        draggable={false}
                                      />
                                    )
                                  ) : (
                                    <span
                                      className="elements-reference-drop-copy"
                                      style={ELEMENT_REFERENCE_DROP_COPY_INLINE_STYLE}
                                    >
                                      <UploadSimple
                                        size={14}
                                        weight="bold"
                                        className="elements-reference-drop-icon"
                                        aria-hidden="true"
                                      />
                                      <span>
                                        {draft.assetType === "video"
                                          ? "Upload motion\nreference"
                                          : "Upload\nreferences"}
                                      </span>
                                      <span
                                        className={`elements-reference-drop-requirement ${
                                          isRequiredSlot ? "is-required" : "is-optional"
                                        }`}
                                        style={{
                                          ...ELEMENT_REFERENCE_DROP_REQUIREMENT_BASE_STYLE,
                                          color: isRequiredSlot
                                            ? ELEMENT_PANEL_ACCENT_SOFT
                                            : "rgba(167, 176, 192, 0.78)",
                                        }}
                                      >
                                        {isRequiredSlot ? "(Required)" : "(Optional)"}
                                      </span>
                                      {isDropPending ? (
                                        <span className="sr-only">Loading reference...</span>
                                      ) : null}
                                    </span>
                                  )}
                                </div>
                                {isDropPending ? (
                                  <div
                                    className="elements-reference-loading-overlay"
                                    role="status"
                                    aria-live="polite"
                                    aria-label={`Loading ${slotLabel} reference`}
                                  >
                                    <span className="elements-reference-loading-indicator">
                                      <span
                                        className="elements-reference-loading-spinner"
                                        aria-hidden="true"
                                      />
                                      <span>Loading...</span>
                                    </span>
                                  </div>
                                ) : null}
                                <span style={ELEMENT_REFERENCE_HINT_INLINE_STYLE}>{slotLabel}</span>
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
              className="ai-character-picker-library-btn ai-character-picker-library-btn--elements"
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
        <AiStudioModalLayer>
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
        </AiStudioModalLayer>
      ) : null}
    </div>
  );
}
