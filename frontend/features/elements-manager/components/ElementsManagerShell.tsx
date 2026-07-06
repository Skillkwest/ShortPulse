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
import { AppMessage } from "../../../components/AppMessage";
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
import { SharedMediaDetailPreviewModal } from "../../ai-studio/components/detail-modal/SharedMediaDetailPreviewModal";
import { resolveSharedMediaDetailMediaActionItems } from "../../ai-studio/components/detail-modal/sharedMediaDetailActions";
import { readMediaLibraryDragPayload } from "../../ai-studio/logic/mediaLibraryDragPayload";
import type { AgentComposerDirectDropPayload } from "../../ai-studio/logic/agentComposerDirectDropPayload";
import type { CanvasTearOutComposerTargetRegistry } from "../../ai-studio/hooks/useAiStudioCanvasTearOutTargets";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";
import type { GenerationAccessCta } from "../../ai-studio/logic/generationAccessCta";
import {
  createSlotReferenceDetailModalItem,
  downloadSlotReferenceDetailItem,
  type SlotReferenceDetailModalItem,
} from "../../ai-studio/logic/slotReferenceDetailModal";
import { refreshSupabaseSignedUrlIfNeeded } from "../../ai-studio/utils/imageUpload";
import { hasDroppedImageReferenceTransfer } from "../../character-manager/logic/characterDropPayload";
import { parseInternalMediaRefFromSupabaseSignedUrl } from "../../../lib/media/internalMediaRefs";
import { buildElementProfileImageBackgroundStyle } from "../logic/elementProfileImageTransform";
import { swapElementImageReferenceSlots } from "../logic/elementReferenceSlots";
import { useElementsManagerViewState } from "../hooks/useElementsManagerViewState";
import { ELEMENT_PANEL_ACCENT_FAINT, ELEMENT_PANEL_ACCENT_SOFT } from "../constants";
import { ElementsDescriptionEditorCard } from "./ElementsDescriptionEditorCard";
import {
  DND_ELEMENT_REFERENCE_SLOT_INDEX,
  ELEMENT_BUTTON_INLINE_STYLE,
  ELEMENT_BUTTON_LABEL_INLINE_STYLE,
  ELEMENT_CREATE_ACTION_BUTTON_INLINE_STYLE,
  ELEMENT_DESCRIPTION_COLUMN_INLINE_STYLE,
  ELEMENT_DESCRIPTION_MAX_LENGTH,
  ELEMENT_EDITOR_CONTENT_GRID_INLINE_STYLE,
  ELEMENT_EDITOR_FIELDS_WRAPPER_STYLE,
  ELEMENT_FOLDER_ICON_INLINE_STYLE,
  ELEMENT_LIBRARY_AVATAR_SIZE_PX,
  ELEMENT_NAME_COLUMN_INLINE_STYLE,
  ELEMENT_NAME_INPUT_INLINE_STYLE,
  ELEMENT_PANEL_FIELD_BORDER_COLOR,
  ELEMENT_REFERENCE_CARD_INLINE_STYLE,
  ELEMENT_REFERENCE_COLUMN_INLINE_STYLE,
  ELEMENT_REFERENCE_DELETE_BUTTON_INLINE_STYLE,
  ELEMENT_REFERENCE_DRAG_GHOST_SCALE,
  ELEMENT_REFERENCE_DRAG_GHOST_SELECTOR,
  ELEMENT_REFERENCE_DROP_COPY_INLINE_STYLE,
  ELEMENT_REFERENCE_DROP_REQUIREMENT_BASE_STYLE,
  ELEMENT_REFERENCE_GRID_INLINE_STYLE,
  ELEMENT_REFERENCE_HINT_INLINE_STYLE,
  ELEMENT_REFERENCE_IMAGE_INLINE_STYLE,
  ELEMENT_REFERENCE_MEDIA_FILLED_INLINE_STYLE,
  ELEMENT_REFERENCE_MEDIA_INLINE_STYLE,
  ELEMENT_REFERENCE_SLOT_ACTIONS_INLINE_STYLE,
  ELEMENT_REFERENCE_TITLE_INLINE_STYLE,
  ELEMENT_SAVE_ACTION_BUTTON_INLINE_STYLE,
  ELEMENT_SAVE_ICON_BUTTON_INLINE_STYLE,
  ELEMENT_SAVE_PROGRESS_BADGE_INLINE_STYLE,
  ELEMENT_SAVE_SUCCESS_BADGE_DURATION_MS,
  ELEMENT_SAVE_SUCCESS_BADGE_INLINE_STYLE,
  ELEMENT_SECONDARY_ACTION_BUTTON_INLINE_STYLE,
  ELEMENT_TOP_ACTION_BUTTON_SIDE_PX,
  ELEMENT_TOP_ACTION_BUTTON_TRANSITION,
  ELEMENT_TOP_FIELD_CONTROL_INLINE_STYLE,
  ELEMENT_TOP_FIELD_GROUP_INLINE_STYLE,
  ELEMENT_TOP_FIELD_LABEL_INLINE_STYLE,
  ELEMENT_TOP_FIELD_LABEL_TEXT_INLINE_STYLE,
  ELEMENT_TOP_ROW_ACTIONS_INLINE_STYLE,
  ELEMENT_TOP_ROW_PRIMARY_ACTIONS_INLINE_STYLE,
  ELEMENT_TOP_ROW_SECONDARY_ACTIONS_INLINE_STYLE,
  ELEMENT_TOP_SECTION_CONTENT_STYLE,
  IMAGE_REFERENCE_SLOT_LABELS,
  buildElementInitials,
} from "./elementsManagerShellLayout";

type ElementsManagerShellProps = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  externalCreateRequestKey?: number;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  generationAccessCta?: GenerationAccessCta | null;
};

export function ElementsManagerShell({
  resolveProfileImageDropSource,
  externalCreateRequestKey = 0,
  canvasTearOutTargetRegistry,
  generationAccessCta = null,
}: ElementsManagerShellProps) {
  const editorColumnPanelRef = React.useRef<HTMLDivElement | null>(null);
  const elementNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const referenceSlotElementRefs = React.useRef(new Map<number, HTMLElement>());
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
    onHandleCanvasTearOutImageReferenceAtIndex,
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
  const [focusedReferenceCardIndex, setFocusedReferenceCardIndex] = React.useState<number | null>(
    null
  );
  const [slotDetailItem, setSlotDetailItem] = React.useState<SlotReferenceDetailModalItem | null>(
    null
  );
  const [referenceSlotTargetRevision, setReferenceSlotTargetRevision] = React.useState(0);
  const [pendingReferenceUploadCounts, setPendingReferenceUploadCounts] = React.useState<
    Record<number, number>
  >({});
  const [measuredReferenceCardHeightPx, setMeasuredReferenceCardHeightPx] = React.useState<
    number | null
  >(null);
  const [editorPanelWidth, setEditorPanelWidth] = React.useState(0);
  const saveSuccessHideTimerRef = React.useRef<number | null>(null);
  const referenceCardMeasureNodeRef = React.useRef<HTMLElement | null>(null);
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
      ...ELEMENT_SAVE_ACTION_BUTTON_INLINE_STYLE,
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
      ...ELEMENT_CREATE_ACTION_BUTTON_INLINE_STYLE,
    }),
    [secondaryActionButtonStyle]
  );

  const getTopActionButtonStyle = React.useCallback(
    (
      baseStyle: React.CSSProperties,
      isHovered: boolean,
      disabled: boolean,
      tone: "accent" | "neutral" = "accent"
    ): React.CSSProperties => ({
      ...baseStyle,
      transition: ELEMENT_TOP_ACTION_BUTTON_TRANSITION,
      transform: !disabled && isHovered ? "translateY(-2px)" : "translateY(0)",
      borderColor:
        !disabled && isHovered
          ? tone === "neutral"
            ? "rgba(228, 235, 243, 0.66)"
            : "rgba(240, 135, 172, 0.84)"
          : baseStyle.borderColor,
      background:
        !disabled && isHovered
          ? tone === "neutral"
            ? "rgba(201, 205, 214, 0.22)"
            : "rgba(255, 123, 167, 0.22)"
          : baseStyle.background,
      backgroundColor:
        !disabled && isHovered
          ? tone === "neutral"
            ? "rgba(201, 205, 214, 0.22)"
            : "rgba(255, 123, 167, 0.22)"
          : baseStyle.backgroundColor,
      boxShadow:
        !disabled && isHovered
          ? tone === "neutral"
            ? "0 10px 22px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(228, 235, 243, 0.12)"
            : `0 10px 22px rgba(0, 0, 0, 0.24), 0 0 0 1px ${ELEMENT_PANEL_ACCENT_FAINT}`
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
        createActionDisabled,
        "neutral"
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
    if (generationAccessCta) return;
    setIsElementLibraryModalOpen(false);
    setShowSaveSuccessIndicator(false);
    void onCreateElement();
  }, [externalCreateRequestKey, generationAccessCta, onCreateElement]);

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
      referenceCardMeasureNodeRef.current = null;
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

  const canAcceptCanvasTearOutImagePayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload): boolean =>
      draft.assetType === "image" &&
      payload.kind === "image" &&
      Boolean(payload.internalPayload || payload.composerImagePayload),
    [draft.assetType]
  );

  const acceptCanvasTearOutImageReferenceAtIndex = React.useCallback(
    (slotIndex: number, payload: AgentComposerDirectDropPayload) => {
      if (!canAcceptCanvasTearOutImagePayload(payload) || isReferenceSlotPending(slotIndex)) {
        return;
      }
      setActiveSheetDropIndex(null);
      setReferenceSlotPending(slotIndex, 1);
      void onHandleCanvasTearOutImageReferenceAtIndex(slotIndex, payload).finally(() => {
        setReferenceSlotPending(slotIndex, -1);
      });
    },
    [
      canAcceptCanvasTearOutImagePayload,
      isReferenceSlotPending,
      onHandleCanvasTearOutImageReferenceAtIndex,
      setReferenceSlotPending,
    ]
  );

  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || draft.assetType !== "image") return;

    const unregisterTargets = IMAGE_REFERENCE_SLOT_LABELS.map((_, slotIndex) => {
      const element = referenceSlotElementRefs.current.get(slotIndex) ?? null;
      if (!element) return null;
      return canvasTearOutTargetRegistry.registerTarget({
        id: `elements-reference-slot-${slotIndex}`,
        element,
        canAccept: (payload) =>
          canAcceptCanvasTearOutImagePayload(payload) && !isReferenceSlotPending(slotIndex),
        accept: (payload) => acceptCanvasTearOutImageReferenceAtIndex(slotIndex, payload),
        setActive: (active) => {
          setActiveSheetDropIndex((current) =>
            active ? slotIndex : current === slotIndex ? null : current
          );
        },
      });
    }).filter((unregister): unregister is () => void => Boolean(unregister));

    return () => {
      unregisterTargets.forEach((unregister) => unregister());
    };
  }, [
    acceptCanvasTearOutImageReferenceAtIndex,
    canAcceptCanvasTearOutImagePayload,
    canvasTearOutTargetRegistry,
    draft.assetType,
    isReferenceSlotPending,
    referenceSlotTargetRevision,
  ]);

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

  const openImageReferenceSlotDetail = React.useCallback(
    async (slotLabel: string, slotIndex: number) => {
      if (draft.assetType !== "image" || isReferenceSlotPending(slotIndex)) return;
      const slotValue = draft.imageReferenceUrls[slotIndex]?.trim() ?? "";
      if (!slotValue) return;
      const internalRef = parseInternalMediaRefFromSupabaseSignedUrl(slotValue);
      let resolvedUrl = slotValue;
      try {
        resolvedUrl = await refreshSupabaseSignedUrlIfNeeded(slotValue);
      } catch {
        resolvedUrl = slotValue;
      }
      const nextItem = createSlotReferenceDetailModalItem({
        surface: "elements-media-panel",
        slotId: `element-reference:${slotIndex}`,
        title: `${slotLabel} reference`,
        url: resolvedUrl,
        previewUrl: resolvedUrl,
        fullUrl: resolvedUrl,
        previewStoragePath: internalRef?.storagePath ?? null,
        fullStoragePath: internalRef?.storagePath ?? null,
      });
      if (nextItem) {
        setSlotDetailItem(nextItem);
      }
    },
    [draft.assetType, draft.imageReferenceUrls, isReferenceSlotPending]
  );

  const slotDetailActionItems = React.useMemo(
    () =>
      resolveSharedMediaDetailMediaActionItems({
        canDownload: Boolean(slotDetailItem),
        onDownload: slotDetailItem
          ? () => {
              void downloadSlotReferenceDetailItem(slotDetailItem);
            }
          : null,
      }),
    [slotDetailItem]
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
    if (referenceCardMeasureNodeRef.current === node) {
      return;
    }
    referenceCardMeasureNodeRef.current = node;
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

  const handleReferenceSlotElementRef = React.useCallback(
    (slotIndex: number, node: HTMLElement | null) => {
      const currentNode = referenceSlotElementRefs.current.get(slotIndex) ?? null;
      if (currentNode === node) {
        if (slotIndex === 0) {
          handleReferenceCardMeasureRef(node);
        }
        return;
      }
      if (node) {
        referenceSlotElementRefs.current.set(slotIndex, node);
      } else {
        referenceSlotElementRefs.current.delete(slotIndex);
      }
      setReferenceSlotTargetRevision((current) => current + 1);
      if (slotIndex === 0) {
        handleReferenceCardMeasureRef(node);
      }
    },
    [handleReferenceCardMeasureRef]
  );
  const referenceSlotElementRefCallbacks = React.useMemo<Array<(node: HTMLElement | null) => void>>(
    () =>
      IMAGE_REFERENCE_SLOT_LABELS.map(
        (_, slotIndex) => (node) => handleReferenceSlotElementRef(slotIndex, node)
      ),
    [handleReferenceSlotElementRef]
  );

  return (
    <div className="elements-manager-shell elements-manager-shell--panel" data-surface="panel">
      <div className="elements-panel-workspace">
        {error ? (
          <AppMessage
            className="elements-feedback error"
            tone="error"
            mode="banner"
            message={error}
          />
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
                      {generationAccessCta ? (
                        <a
                          className="app-message__action ai-panel-plan-access-cta"
                          href={generationAccessCta.href}
                          aria-label={generationAccessCta.ariaLabel}
                        >
                          {generationAccessCta.label}
                        </a>
                      ) : (
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
                      )}
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
                      {generationAccessCta ? null : (
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
                      )}
                      {generationAccessCta ? null : (
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
                      )}
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
                              (hoveredReferenceCardIndex === index ||
                                focusedReferenceCardIndex === index) &&
                              !isDropPending;
                            return (
                              <article
                                key={`${slotLabel}-${index + 1}`}
                                ref={referenceSlotElementRefCallbacks[index]}
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
                                onDoubleClick={() => {
                                  void openImageReferenceSlotDetail(slotLabel, index);
                                }}
                                onMouseEnter={() => setHoveredReferenceCardIndex(index)}
                                onMouseLeave={() =>
                                  setHoveredReferenceCardIndex((current) =>
                                    current === index ? null : current
                                  )
                                }
                                onFocus={() => setFocusedReferenceCardIndex(index)}
                                onBlur={(event) => {
                                  const nextFocusedNode =
                                    event.relatedTarget instanceof Node
                                      ? event.relatedTarget
                                      : null;
                                  if (
                                    !nextFocusedNode ||
                                    !event.currentTarget.contains(nextFocusedNode)
                                  ) {
                                    setFocusedReferenceCardIndex((current) =>
                                      current === index ? null : current
                                    );
                                  }
                                }}
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
                                      onDoubleClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
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
            {generationAccessCta ? (
              <a
                className="app-message__action ai-panel-plan-access-cta"
                href={generationAccessCta.href}
                aria-label={generationAccessCta.ariaLabel}
              >
                {generationAccessCta.label}
              </a>
            ) : (
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
            )}
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
      <SharedMediaDetailPreviewModal
        item={slotDetailItem}
        isLoading={false}
        error={null}
        onClose={() => setSlotDetailItem(null)}
        topBarActionItems={slotDetailActionItems}
        modalActivityId="elements-slot-reference-detail-modal"
        backdropClassName="reference-modal-backdrop media-library-panel-preview-backdrop"
        closeLabel="Close element reference detail"
        stageClassName="art-image-vessel media-library-panel-preview-body"
        placeholderClassName="art-text-placeholder media-library-panel-preview-placeholder"
        imageClassName="art-hero-image media-library-panel-preview-media"
      />
    </div>
  );
}
