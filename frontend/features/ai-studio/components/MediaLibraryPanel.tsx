import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FolderSimple } from "phosphor-react";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import { resolveMediaRowKind } from "../../../lib/mediaRowKind";
import { MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM } from "../../../lib/mediaPreviewRuntimePolicy";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import { useMediaSurfacePreviewSigning } from "../../media-library/hooks/useMediaSurfacePreviewSigning";
import { useMediaSurfacePreviewRuntime } from "../../media-library/hooks/useMediaSurfacePreviewRuntime";
import {
  MEDIA_LIBRARY_PANEL_DENSITY_CONFIG,
  MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
} from "../../media-library/logic/mediaLibraryRuntimeConfig";
import { resolveMediaLibraryPanelGridAdaptiveCardPreviewUrl } from "../../media-library/logic/mediaLibraryAdaptivePreview";
import { applyAiStudioPressureQuarantineLevel } from "../logic/aiStudioStabilityTelemetry";
import {
  getMediaDataTabForRow,
  isNextImageOptimizerUrl,
  resolveNextImageOptimizerSourceUrl,
  sortByCreatedAtDesc,
  type MediaDataTab,
  type MediaFileRow,
  type MediaTab,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import {
  createMediaLibraryWorkflowReloadOutput,
  resolveMediaLibraryWorkflowReloadMediaKindHint,
} from "../logic/mediaLibraryWorkflowReload";
import {
  getMediaLibrarySurfaceConfig,
  resolvePanelDenseBrowseSignBudget,
  resolvePanelPressureAwareSignBudget,
} from "../../media-library/runtime";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../logic/mediaLibraryPanelApi";
import { useMediaLibraryPanelDataController } from "../hooks/useMediaLibraryPanelDataController";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useMediaLibraryFoldersState } from "../hooks/useMediaLibraryFoldersState";
import { useMediaLibraryFolderDropController } from "../hooks/useMediaLibraryFolderDropController";
import { useMediaLibraryFolderReparentController } from "../hooks/useMediaLibraryFolderReparentController";
import { useMediaLibraryPanelItemInteractions } from "../hooks/useMediaLibraryPanelItemInteractions";
import { useMediaLibraryPanelMutationController } from "../hooks/useMediaLibraryPanelMutationController";
import { useMediaLibraryPanelSelectionController } from "../hooks/useMediaLibraryPanelSelectionController";
import { collectMediaLibraryFolderDescendantIds } from "../logic/mediaLibraryFolderHierarchy";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";
import { MediaLibraryPanelFoldersSection } from "./MediaLibraryPanelFoldersSection";
import { MediaLibraryPanelDialogs } from "./MediaLibraryPanelDialogs";
import { MediaLibraryPanelFolderContent } from "./MediaLibraryPanelFolderContent";
import { MediaLibraryPanelHeader } from "./MediaLibraryPanelHeader";
import { MediaLibraryPanelPromptsSection } from "./MediaLibraryPanelPromptsSection";
import { MediaLibraryPanelRootContent } from "./MediaLibraryPanelRootContent";
import { MediaLibraryPanelStatusArea } from "./MediaLibraryPanelStatusArea";
import { useMediaLibraryPanelBulkSelection } from "./useMediaLibraryPanelBulkSelection";
import type {
  SharedMediaDetailSelectionTarget,
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "./detail-modal/detailModalPlatformTypes";
import { MediaLibraryAllItemsGrid } from "./media-library-modal/MediaLibraryAllItemsGrid";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryPanelPreviewModal } from "./media-library-modal/MediaLibraryPanelPreviewModal";
import { MediaLibraryPromptDetailModal } from "./media-library-modal/MediaLibraryPromptDetailModal";
import { useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import type { StudioOutput, WorkflowReloadMediaKindHint } from "../types";
import type { LibraryMediaReferencePayload } from "../reference-grid/referenceGridTypes";
import {
  createMediaLibraryPromptDetailModalItem,
  type MediaLibraryPromptDetailModalItem,
} from "../logic/mediaLibraryPromptDetailModal";
type MediaLibraryPanelItemType = "all" | "images" | "videos" | "audio" | "prompts";

type FolderContextMenuState = {
  folderId: string;
  folderName: string;
  x: number;
  y: number;
};

type MoveFolderPickerState = {
  folderId: string;
  folderName: string;
};

type FolderOpenGhostState = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type MediaLibraryPanelProps = {
  onSelectMedia: (payload: LibraryMediaReferencePayload) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
  projectId?: string | null;
  projectName?: string | null;
  onProjectNameCommit?: (value: string) => void;
  projectNameFocusRequestKey?: number;
  isMediaLibraryPanelExpanded?: boolean;
  isStorageQuotaBlocked?: boolean;
  isPlanAccessBlocked?: boolean;
  onPlanAccessBlockedUploadAttempt?: () => void;
  onExpandMediaLibraryPanel?: () => void;
  onCollapseMediaLibraryPanel?: () => void;
  resolveInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
    alreadyInLibrary?: boolean;
  } | null>;
  onDeleteMediaRowsFromWorkspace?: (rows: MediaFileRow[]) => void;
  onReloadWorkflowFromMedia?: (
    output: StudioOutput,
    options?: { mediaKindHint?: WorkflowReloadMediaKindHint | null }
  ) => void;
  onRerollWorkflowFromMedia?: (output: StudioOutput) => void;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
  detailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  onDetailSelectionTargetChange?: (target: SharedMediaDetailSelectionTarget | null) => void;
};

const FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX = 10;
const MEMBERSHIP_MESSAGE_TIMEOUT_MS = 1800;
const MEDIA_LIBRARY_FOLDERS_DEFAULT_TOP_RATIO = 0.3;
const MEDIA_LIBRARY_FOLDERS_EXPANDED_GRID_TOP_HEIGHT_PX = 0,
  MEDIA_LIBRARY_FOLDERS_COLLAPSE_TOP_HEIGHT_PX = 86;
const PROJECT_NAME_PLACEHOLDER = "Untitled project";
const FOLDER_OPEN_GHOST_IMAGE_SRC = "/Folder 1.png";
const FOLDER_OPEN_GHOST_DURATION_MS = 180;
const ROOT_ALL_MEDIA_VISUAL_PRIORITY_COUNT = MEDIA_LIBRARY_PANEL_DENSITY_CONFIG.maxColumnCount;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const resolveSigningTab = (itemType: MediaLibraryPanelItemType): MediaDataTab => {
  if (itemType === "videos") return "uploaded_videos";
  return "uploaded_images";
};
export const MediaLibraryPanel = React.memo(function MediaLibraryPanel({
  onSelectMedia,
  onSelectPrompt,
  projectId = null,
  projectName = null,
  onProjectNameCommit,
  projectNameFocusRequestKey = 0,
  isMediaLibraryPanelExpanded = false,
  isStorageQuotaBlocked: routeStorageQuotaBlocked,
  isPlanAccessBlocked = false,
  onPlanAccessBlockedUploadAttempt,
  onExpandMediaLibraryPanel,
  onCollapseMediaLibraryPanel,
  resolveInternalDropItem,
  onDeleteMediaRowsFromWorkspace,
  onReloadWorkflowFromMedia,
  onRerollWorkflowFromMedia,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
  detailSelectionTarget = null,
  onDetailSelectionTargetChange,
}: MediaLibraryPanelProps) {
  const sessionSnapshot = useResolvedProtectedSessionState();
  const sessionUserId = sessionSnapshot.user?.id ?? null;
  const panelSurfaceConfig = getMediaLibrarySurfaceConfig("panel");
  const panelListSurface = "media-library-panel" as const;
  const {
    folders,
    visibleFolders,
    ancestorFolders,
    activeFolderId,
    activeFolderName,
    activeFolderParentId,
    canNavigateUp,
    setActiveFolderId,
    folderError,
    setFolderError,
    creatingFolder,
    createFolder,
    editingFolderId,
    editingFolderName,
    setEditingFolderName,
    startFolderRename,
    cancelFolderRename,
    commitFolderRename,
    moveFolder,
    deleteFolder,
    refreshFolders,
  } = useMediaLibraryFoldersState(projectId);

  const isRootFolderSelected = activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const [rootTab, setRootTab] = useState<MediaLibraryPanelItemType>("all");
  const itemType: MediaLibraryPanelItemType = isRootFolderSelected ? rootTab : "all";

  const [error, setError] = useState<string | null>(null);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);
  const [membershipPendingMessage, setMembershipPendingMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(() => new Set());
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);
  const [folderOpenGhost, setFolderOpenGhost] = useState<FolderOpenGhostState | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    folderId: string;
    folderName: string;
  } | null>(null);
  const [moveFolderPicker, setMoveFolderPicker] = useState<MoveFolderPickerState | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName ?? "");
  const [promptDetailModalItem, setPromptDetailModalItem] =
    useState<MediaLibraryPromptDetailModalItem | null>(null);

  const rootUploadInputRef = useRef<HTMLInputElement | null>(null);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const expandedTopHeightPxRef = useRef<number | null>(null);

  const panelBodyRef = useRef<HTMLDivElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const folderContextMenuRef = useRef<HTMLDivElement | null>(null);
  const folderOpenGhostTimeoutRef = useRef<number | null>(null);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = useState<Set<string>>(
    () => new Set()
  );
  const isRoutePlanAccessBlocked = Boolean(isPlanAccessBlocked);

  useEffect(() => {
    return () => {
      if (folderOpenGhostTimeoutRef.current !== null) {
        window.clearTimeout(folderOpenGhostTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setProjectNameDraft(projectName ?? "");
  }, [projectName]);

  useEffect(() => {
    if (projectNameFocusRequestKey <= 0) return;
    const frameId = window.requestAnimationFrame(() => {
      const input = projectNameInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [projectNameFocusRequestKey]);

  const projectNameInputWidthCh = useMemo(() => {
    const normalizedProjectName =
      projectNameDraft.trim() || projectName?.trim() || PROJECT_NAME_PLACEHOLDER;
    return Math.min(
      Math.max(normalizedProjectName.length + 1, PROJECT_NAME_PLACEHOLDER.length),
      28
    );
  }, [projectName, projectNameDraft]);

  const adaptivePreviewQualityEnabled = isAdaptiveSurfaceEnabled("media-library-panel-grid");
  const mediaAdaptivePressure = useMediaAdaptivePressure({
    surface: "media-library-panel",
    enabled: adaptivePreviewQualityEnabled,
  });
  const effectiveAdaptivePressureLevel = applyAiStudioPressureQuarantineLevel(
    mediaAdaptivePressure.previewPressureLevel
  );

  const normalizedSearch = "";
  const shouldShowMedia = itemType !== "prompts";
  const shouldShowPrompts = itemType === "prompts" || (!isRootFolderSelected && itemType === "all");
  const {
    error: dataError,
    mediaRows,
    setMediaRows,
    setSignedUrls,
    libraryTotalCount,
    promptRows,
    setPromptRows,
    mediaHasMore,
    promptHasMore,
    mediaLoading,
    promptLoading,
    mediaPagesLoaded,
    loadMediaPage,
    loadPromptPage,
    refreshActiveRows,
  } = useMediaLibraryPanelDataController({
    activeFolderId,
    itemType,
    normalizedSearch,
    shouldShowMedia,
    shouldShowPrompts,
    panelBodyRef,
    listSurface: panelListSurface,
    currentUserId: sessionUserId,
  });
  const {
    isStorageQuotaBlocked,
    storageQuotaMessage,
    pendingLibraryDelete,
    setPendingLibraryDelete,
    deleteConfirmSubmitting,
    resetDeleteConfirmState,
    closeDeleteConfirm,
    confirmDeleteFromLibrary,
    deleteMediaRowsFromLibrary,
    handleRemoveItemFromActiveFolder,
    handleRemoveItemsFromActiveFolder,
    handleMoveItemsToFolder,
    uploadDroppedFilesToFolder,
  } = useMediaLibraryPanelMutationController({
    projectId,
    activeFolderId,
    folders,
    isStorageQuotaBlockedOverride: routeStorageQuotaBlocked,
    refreshActiveRows,
    refreshFolders,
    setFolderError,
    setMembershipMessage,
    setMediaRows,
    setPromptRows,
    onDeleteMediaRowsFromWorkspace,
  });
  const isPlanBlockedStorageQuota = isPlanAccessBlocked;
  const shouldDisableUploads = isStorageQuotaBlocked && !isPlanBlockedStorageQuota;
  const visiblePromptRows = useMemo(() => sortByCreatedAtDesc(promptRows), [promptRows]);
  const foldersById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders]
  );
  const buildFolderPathLabel = useCallback(
    (targetFolderId: string | null): string => {
      if (targetFolderId === null) return "All Media";
      const chain: string[] = [];
      let cursor = foldersById.get(targetFolderId) ?? null;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        chain.unshift(cursor.name);
        cursor = cursor.parentFolderId ? (foldersById.get(cursor.parentFolderId) ?? null) : null;
      }
      return chain.length > 0 ? `All Media > ${chain.join(" > ")}` : "All Media";
    },
    [foldersById]
  );
  const visibleImageRows = useMemo(
    () => mediaRows.filter((row) => resolveMediaRowKind(row) === "image"),
    [mediaRows]
  );
  const visibleVideoRows = useMemo(
    () => mediaRows.filter((row) => resolveMediaRowKind(row) === "video"),
    [mediaRows]
  );
  const visibleAudioRows = useMemo(
    () => mediaRows.filter((row) => resolveMediaRowKind(row) === "audio"),
    [mediaRows]
  );
  const shouldPreferVisualMediaFirstOnRootAll = useMemo(
    () => isRootFolderSelected && itemType === "all" && normalizedSearch.length === 0,
    [isRootFolderSelected, itemType, normalizedSearch]
  );
  const signableMediaRows = useMemo(() => mediaRows, [mediaRows]);
  const activeMediaTab = useMemo<MediaDataTab | null>(() => {
    if (!shouldShowMedia || mediaRows.length === 0) return null;
    return resolveSigningTab(itemType);
  }, [itemType, mediaRows.length, shouldShowMedia]);
  const applySignedUrlsToMediaRows = useCallback(
    (_tab: MediaDataTab, signedById: Map<string, string>) => {
      if (!signedById.size) return;
      setSignedUrls(signedById);
    },
    [setSignedUrls]
  );
  const resolvePanelSignBudgetForPressure = useCallback(
    () =>
      resolvePanelPressureAwareSignBudget(
        panelSurfaceConfig.signBudgetResolver(),
        effectiveAdaptivePressureLevel
      ),
    [effectiveAdaptivePressureLevel, panelSurfaceConfig]
  );
  const previewRuntime = useMediaSurfacePreviewRuntime<MediaFileRow, MediaTab, HTMLElement>({
    activeMediaQuery: normalizedSearch,
    activeTab: activeMediaTab ?? "saved_prompts",
    firstMediaPaintEventName: "media.panel.first_media_paint",
    previewProfile: panelSurfaceConfig.imageCardPreviewProfile,
    signBudgetResolver: resolvePanelSignBudgetForPressure,
    surface: panelListSurface,
    visibilityRootMargin: panelSurfaceConfig.visibilityRootMargin,
    visibilityRootRef: panelBodyRef as React.MutableRefObject<HTMLElement | null>,
    applySignedUrlsToSurface: applySignedUrlsToMediaRows,
    setFiles: setMediaRows,
    beforeRetry: ({ row, failedUrl }) => {
      if (!isNextImageOptimizerUrl(failedUrl)) return;
      const sourceUrl = resolveNextImageOptimizerSourceUrl(failedUrl);
      if (!sourceUrl) return;
      applySignedUrlsToMediaRows(getMediaDataTabForRow(row), new Map([[row.id, sourceUrl]]));
      setOptimizerFallbackMediaIds((previous) => {
        if (previous.has(row.id)) return previous;
        const next = new Set(previous);
        next.add(row.id);
        return next;
      });
    },
  });
  const {
    currentUserIdRef,
    getMediaCardRef,
    handleMediaPreviewError,
    refreshSignedUrl,
    signAttemptRef,
    signStoragePath,
    signedUrlRetryRef,
    visibleMediaIdsRef,
  } = previewRuntime;
  const signBudgetOverride = useMemo(
    () =>
      shouldShowMedia
        ? resolvePanelPressureAwareSignBudget(
            resolvePanelDenseBrowseSignBudget(previewRuntime.signBudget),
            effectiveAdaptivePressureLevel
          )
        : undefined,
    [effectiveAdaptivePressureLevel, previewRuntime.signBudget, shouldShowMedia]
  );
  const foldersSplit = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef as React.MutableRefObject<HTMLElement | null>,
    defaultTopRatio: MEDIA_LIBRARY_FOLDERS_DEFAULT_TOP_RATIO,
    minTopSectionHeightPx: 0,
    minTopRatioFloor: 0,
    minBottomSectionHeightPx: 240,
    allRefsSnapTopHeightPx: MEDIA_LIBRARY_FOLDERS_EXPANDED_GRID_TOP_HEIGHT_PX,
    collapseTopHeightPx: MEDIA_LIBRARY_FOLDERS_COLLAPSE_TOP_HEIGHT_PX,
    ariaLabel: "Resize folders and references sections",
  });

  useVisibleErrorTelemetry({
    source: "telemetry.ai_studio.media_library_panel_error",
    scope: "app",
    severity: "low",
    message: error || folderError,
    metadata: {
      folder_id: activeFolderId,
      item_type: itemType,
      has_media_rows: mediaRows.length > 0,
      has_prompt_rows: promptRows.length > 0,
    },
  });

  useEffect(() => {
    setMembershipMessage(null);
    setMembershipPendingMessage(null);
  }, [activeFolderId, itemType, normalizedSearch]);

  useEffect(() => {
    if (!membershipMessage) return;
    const timeout = window.setTimeout(() => {
      setMembershipMessage(null);
    }, MEMBERSHIP_MESSAGE_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [membershipMessage]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeFolderId, itemType]);

  useEffect(() => {
    setError(dataError);
  }, [dataError]);

  useEffect(() => {
    if (!sessionSnapshot.initialized) return;
    currentUserIdRef.current = sessionUserId;
  }, [currentUserIdRef, sessionSnapshot.initialized, sessionUserId]);

  useEffect(() => {
    signAttemptRef.current = {};
    setOptimizerFallbackMediaIds(new Set());
  }, [activeFolderId, itemType, normalizedSearch, signAttemptRef]);

  useEffect(() => {
    if (!folderContextMenu) return;
    const dismissContextMenu = () => {
      setFolderContextMenu(null);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        dismissContextMenu();
        return;
      }
      if (folderContextMenuRef.current?.contains(target)) return;
      dismissContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissContextMenu();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", dismissContextMenu, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", dismissContextMenu, true);
    };
  }, [folderContextMenu]);

  useIsomorphicLayoutEffect(() => {
    if (!folderContextMenu) return;
    const frameId = window.requestAnimationFrame(() => {
      const menuNode = folderContextMenuRef.current;
      if (!menuNode) return;
      const { height, width } = menuNode.getBoundingClientRect();
      if (!(height > 0) || !(width > 0)) return;
      const nextX = Math.min(
        Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, folderContextMenu.x),
        Math.max(
          FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX,
          window.innerWidth - width - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        )
      );
      const nextY = Math.min(
        Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, folderContextMenu.y),
        Math.max(
          FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX,
          window.innerHeight - height - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        )
      );
      if (nextX === folderContextMenu.x && nextY === folderContextMenu.y) return;
      setFolderContextMenu((previous) => {
        if (!previous) return previous;
        if (previous.x === nextX && previous.y === nextY) return previous;
        return {
          ...previous,
          x: nextX,
          y: nextY,
        };
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [folderContextMenu]);

  const {
    detailModalItem,
    detailNavigation,
    detailModalLoading,
    detailModalError,
    handleMediaCardDoubleClick,
    handleMediaCardContextMenu,
    handleDetailModalMediaError,
    closeDetailModal,
  } = useMediaLibraryPanelSelectionController({
    activeFolderId,
    detailSurface: "media-library-panel",
    currentUserIdRef,
    mediaRows,
    detailSelectionTarget,
    setDetailSelectionTarget: onDetailSelectionTargetChange,
    onSelectMedia,
    refreshSignedUrl,
    signStoragePath,
  });

  const closePromptDetailModal = useCallback(() => {
    setPromptDetailModalItem(null);
    onDetailSelectionTargetChange?.(null);
  }, [onDetailSelectionTargetChange]);

  const handlePromptCardDoubleClick = useCallback(
    (prompt: PromptRow) => {
      const item = createMediaLibraryPromptDetailModalItem({
        prompt,
        surface: "media-library-panel",
      });
      setPromptDetailModalItem(item);
      onDetailSelectionTargetChange?.(item.selectionTarget);
    },
    [onDetailSelectionTargetChange]
  );

  const handleUsePromptDetailItem = useCallback(
    (item: MediaLibraryPromptDetailModalItem) => {
      onSelectPrompt({
        id: item.prompt.id,
        promptText: item.prompt.prompt_text,
        title: item.prompt.title,
      });
      closePromptDetailModal();
    },
    [closePromptDetailModal, onSelectPrompt]
  );

  const handleDeletePromptDetailItem = useCallback(
    (item: MediaLibraryPromptDetailModalItem) => {
      setPendingLibraryDelete({
        kind: "prompt",
        prompt: item.prompt,
      });
      closePromptDetailModal();
    },
    [closePromptDetailModal, setPendingLibraryDelete]
  );

  const clearSelections = useCallback(() => {
    setSelectedIds(new Set());
    setSelectedPromptIds(new Set());
  }, []);

  const handleReloadWorkflowFromMedia = useCallback(
    (file: MediaFileRow) => {
      if (!onReloadWorkflowFromMedia) return;
      const output = createMediaLibraryWorkflowReloadOutput(file);
      if (!output) return;
      onReloadWorkflowFromMedia(output, {
        mediaKindHint: resolveMediaLibraryWorkflowReloadMediaKindHint(file),
      });
    },
    [onReloadWorkflowFromMedia]
  );

  const handleRerollWorkflowFromMedia = useCallback(
    (file: MediaFileRow) => {
      if (!onRerollWorkflowFromMedia) return;
      const output = createMediaLibraryWorkflowReloadOutput(file);
      if (!output) return;
      onRerollWorkflowFromMedia(output);
    },
    [onRerollWorkflowFromMedia]
  );

  const combinedSelectedIds = useMemo(() => {
    if (!selectedPromptIds.size) return selectedIds;
    if (!selectedIds.size) return selectedPromptIds;
    const next = new Set(selectedIds);
    for (const id of selectedPromptIds) {
      next.add(id);
    }
    return next;
  }, [selectedIds, selectedPromptIds]);

  useMediaSurfacePreviewSigning<MediaFileRow, MediaTab>({
    runtime: previewRuntime,
    activeMediaTab,
    activeMediaCacheLoading: mediaLoading,
    activeMediaCachePagesLoaded: mediaPagesLoaded,
    activeMediaQuery: normalizedSearch,
    filteredMedia: signableMediaRows,
    signBudgetOverride,
    isSigningPassEnabled: shouldShowMedia,
    surface: "media-library-panel",
    unresolvedWarningPrefix: "[media-library-panel]",
    maxSignAttemptsPerItem: MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
    maxSignCandidatesPerRow: 4,
    isSignPrefetchEnabled: MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
    backgroundHydrateFallbackEnabled: true,
  });

  useEffect(() => {
    resetDeleteConfirmState();
    closeDetailModal();
    closePromptDetailModal();
  }, [activeFolderId, closeDetailModal, closePromptDetailModal, resetDeleteConfirmState]);

  const foldersDropController = useMediaLibraryFolderDropController({
    projectId,
    folders,
    isStorageQuotaBlocked: isStorageQuotaBlocked || isPlanBlockedStorageQuota,
    setFolderError,
    setMembershipMessage,
    setMembershipPendingMessage,
    refreshActiveRows,
    refreshFolders,
    resolveInternalDropItem,
    onDropFilesToFolder: async (folderId, files) => {
      await uploadDroppedFilesToFolder({
        targetFolderId: folderId,
        files,
      });
    },
    onStorageQuotaBlockedFileDrop: isRoutePlanAccessBlocked
      ? onPlanAccessBlockedUploadAttempt
      : undefined,
  });
  const selectedVisibleMediaRowsRef = useRef<MediaFileRow[]>([]);
  const getSelectedVisibleMediaRows = useCallback(() => selectedVisibleMediaRowsRef.current, []);
  const {
    handleCardDragEnd,
    handleDownloadMediaFile,
    handleMediaCardDragStart,
    handlePromptCardDragStart,
  } = useMediaLibraryPanelItemInteractions({
    activeFolderId,
    getSelectedVisibleMediaRows,
  });

  const openFolderContextMenu = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      folder: { id: string; name: string },
      isRoot: boolean
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (isRoot) {
        setFolderContextMenu(null);
        return;
      }
      setFolderContextMenu({
        folderId: folder.id,
        folderName: folder.name,
        x: Math.min(
          Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, event.clientX),
          window.innerWidth - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        ),
        y: Math.min(
          Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, event.clientY),
          window.innerHeight - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        ),
      });
    },
    []
  );

  const handleContextRename = useCallback(() => {
    if (!folderContextMenu) return;
    startFolderRename(folderContextMenu.folderId, folderContextMenu.folderName);
    setFolderContextMenu(null);
  }, [folderContextMenu, startFolderRename]);

  const handleContextCreateSubfolder = useCallback(async () => {
    if (!folderContextMenu) return;
    const parentFolderId = folderContextMenu.folderId;
    setFolderContextMenu(null);
    setActiveFolderId(parentFolderId);
    await createFolder(parentFolderId);
  }, [createFolder, folderContextMenu, setActiveFolderId]);

  const handleContextDelete = useCallback(async () => {
    if (!folderContextMenu) return;
    const { folderId, folderName } = folderContextMenu;
    setFolderContextMenu(null);
    setPendingFolderDelete({ folderId, folderName });
  }, [folderContextMenu]);

  const closeFolderDeleteConfirm = useCallback(() => {
    setPendingFolderDelete(null);
  }, []);

  const confirmFolderDelete = useCallback(async () => {
    const target = pendingFolderDelete;
    if (!target) return;
    setPendingFolderDelete(null);
    await deleteFolder(target.folderId);
  }, [deleteFolder, pendingFolderDelete]);
  const resolveMoveFolderDestinationOptions = useCallback(
    (folderId: string) => {
      const movingFolder = foldersById.get(folderId);
      if (!movingFolder) return [] as Array<{ id: string | null; label: string }>;
      const excludedIds = collectMediaLibraryFolderDescendantIds(folders, movingFolder.id);
      excludedIds.add(movingFolder.id);
      const options: Array<{ id: string | null; label: string }> = [];
      if (movingFolder.parentFolderId !== null) {
        options.push({ id: null, label: "All Media" });
      }
      for (const folder of folders) {
        if (excludedIds.has(folder.id)) continue;
        if (folder.id === movingFolder.parentFolderId) continue;
        options.push({
          id: folder.id,
          label: buildFolderPathLabel(folder.id),
        });
      }
      if (options.length <= 1) return options;
      const [rootOption, ...folderOptions] = options;
      if (rootOption?.id !== null) {
        return [...options].sort((left, right) => left.label.localeCompare(right.label));
      }
      return [
        rootOption,
        ...folderOptions.sort((left, right) => left.label.localeCompare(right.label)),
      ];
    },
    [buildFolderPathLabel, folders, foldersById]
  );
  const moveFolderDestinationOptions = useMemo(() => {
    if (!moveFolderPicker) return [];
    return resolveMoveFolderDestinationOptions(moveFolderPicker.folderId);
  }, [moveFolderPicker, resolveMoveFolderDestinationOptions]);
  const moveFolderCurrentParentLabel = useMemo(() => {
    if (!moveFolderPicker) return "All Media";
    const movingFolder = foldersById.get(moveFolderPicker.folderId);
    if (!movingFolder || movingFolder.parentFolderId === null) return "All Media";
    return buildFolderPathLabel(movingFolder.parentFolderId);
  }, [buildFolderPathLabel, foldersById, moveFolderPicker]);
  const canOpenMovePicker = useMemo(() => {
    if (!folderContextMenu) return false;
    return resolveMoveFolderDestinationOptions(folderContextMenu.folderId).length > 0;
  }, [folderContextMenu, resolveMoveFolderDestinationOptions]);
  const handleOpenMovePicker = useCallback(() => {
    if (!folderContextMenu) return;
    setMoveFolderPicker({
      folderId: folderContextMenu.folderId,
      folderName: folderContextMenu.folderName,
    });
    setFolderContextMenu(null);
  }, [folderContextMenu]);
  const closeMoveFolderPicker = useCallback(() => {
    setMoveFolderPicker(null);
  }, []);
  const handleMoveFolderToDestination = useCallback(
    async (parentFolderId: string | null) => {
      if (!moveFolderPicker) return;
      const folderId = moveFolderPicker.folderId;
      setMoveFolderPicker(null);
      await moveFolder(folderId, parentFolderId);
    },
    [moveFolder, moveFolderPicker]
  );
  const folderReparentController = useMediaLibraryFolderReparentController({
    folders,
    moveFolder,
  });

  const handleNavigateUp = useCallback(() => {
    if (!canNavigateUp) return;
    setActiveFolderId(activeFolderParentId ?? MEDIA_LIBRARY_ROOT_FOLDER_ID);
  }, [activeFolderParentId, canNavigateUp, setActiveFolderId]);
  const handleNavigateToRoot = useCallback(() => {
    setActiveFolderId(MEDIA_LIBRARY_ROOT_FOLDER_ID);
  }, [setActiveFolderId]);
  const handleNavigateToFolder = useCallback(
    (folderId: string) => {
      setActiveFolderId(folderId || MEDIA_LIBRARY_ROOT_FOLDER_ID);
    },
    [setActiveFolderId]
  );

  const handleOpenFolderWithAnimation = useCallback(
    (folderId: string, sourceElement: HTMLElement) => {
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const rect = sourceElement.getBoundingClientRect();

      if (folderOpenGhostTimeoutRef.current !== null) {
        window.clearTimeout(folderOpenGhostTimeoutRef.current);
        folderOpenGhostTimeoutRef.current = null;
      }

      if (!prefersReducedMotion && rect.width > 0 && rect.height > 0) {
        setFolderOpenGhost({
          key: `${folderId}:${Date.now()}`,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
        folderOpenGhostTimeoutRef.current = window.setTimeout(() => {
          setFolderOpenGhost(null);
          folderOpenGhostTimeoutRef.current = null;
        }, FOLDER_OPEN_GHOST_DURATION_MS);
      } else {
        setFolderOpenGhost(null);
      }

      setActiveFolderId(folderId || MEDIA_LIBRARY_ROOT_FOLDER_ID);
    },
    [setActiveFolderId]
  );

  const canShowFolderItemRemoveAction = !isRootFolderSelected;
  const activeFolderGridMediaRows = useMemo(
    () => (shouldShowMedia ? mediaRows : []),
    [mediaRows, shouldShowMedia]
  );
  const bulkMoveDestinationOptions = useMemo(
    () =>
      folders
        .filter((folder) => folder.id !== activeFolderId)
        .map((folder) => ({
          id: folder.id,
          label: buildFolderPathLabel(folder.id),
        })),
    [activeFolderId, buildFolderPathLabel, folders]
  );
  const {
    bulkActions,
    bulkMoveDialogOpen,
    bulkVisibleMediaRows,
    handleCloseBulkDeleteConfirm,
    handleCloseBulkMoveDialog,
    handleConfirmBulkDelete,
    handleMoveSelectedMediaToFolder,
    pendingBulkDeleteIds,
    selectedVisibleMediaRows,
  } = useMediaLibraryPanelBulkSelection({
    activeFolderGridMediaRows,
    bulkMoveDestinationOptions,
    clearSelections,
    deleteConfirmSubmitting,
    deleteMediaRowsFromLibrary,
    handleMoveItemsToFolder,
    handleRemoveItemsFromActiveFolder,
    isRootFolderSelected,
    itemType,
    mediaRows,
    selectedIds,
    setSelectedIds,
    shouldShowMedia,
    visibleAudioRows,
    visibleImageRows,
    visibleVideoRows,
  });
  useLayoutEffect(() => {
    selectedVisibleMediaRowsRef.current = selectedVisibleMediaRows;
  }, [selectedVisibleMediaRows]);
  useAiStudioModalActivity(
    "media-library-panel-delete-confirm",
    Boolean(pendingLibraryDelete || pendingBulkDeleteIds || pendingFolderDelete)
  );
  useAiStudioModalActivity("media-library-panel-move-folder", Boolean(moveFolderPicker));
  useAiStudioModalActivity("media-library-panel-bulk-move", bulkMoveDialogOpen);

  const handleToggleSelectedPrompt = useCallback(
    (prompt: PromptRow) => {
      handleCloseBulkDeleteConfirm();
      handleCloseBulkMoveDialog();
      setSelectedPromptIds((prev) => {
        const next = new Set(prev);
        if (next.has(prompt.id)) {
          next.delete(prompt.id);
        } else {
          next.add(prompt.id);
        }
        return next;
      });
    },
    [handleCloseBulkDeleteConfirm, handleCloseBulkMoveDialog]
  );

  const toggleSelectedMediaFile = useCallback(
    (file: MediaFileRow) => {
      handleCloseBulkDeleteConfirm();
      handleCloseBulkMoveDialog();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(file.id)) {
          next.delete(file.id);
        } else {
          next.add(file.id);
        }
        return next;
      });
    },
    [handleCloseBulkDeleteConfirm, handleCloseBulkMoveDialog]
  );
  const resolvePanelCardPreviewUrl = useCallback(
    ({
      signedUrl,
      fileType,
      pressureLevel,
      adaptivePreviewQualityEnabled: isAdaptivePreviewQualityEnabled,
      shouldBypassAdaptivePreview = false,
      cardLongEdgePx,
      devicePixelRatio,
    }: {
      signedUrl: string | null | undefined;
      fileType?: string | null;
      pressureLevel: 0 | 1 | 2;
      adaptivePreviewQualityEnabled: boolean;
      shouldBypassAdaptivePreview?: boolean;
      cardLongEdgePx?: number;
      devicePixelRatio?: number;
    }) =>
      resolveMediaLibraryPanelGridAdaptiveCardPreviewUrl({
        signedUrl,
        fileType,
        pressureLevel,
        adaptivePreviewQualityEnabled: isAdaptivePreviewQualityEnabled,
        shouldBypassAdaptivePreview,
        cardLongEdgePx,
        devicePixelRatio,
      }),
    []
  );

  const renderMediaGrid = useCallback(
    (rows: MediaFileRow[]) => (
      <MediaLibraryMediaGrid
        activeMedia={rows}
        selectedIds={selectedIds}
        optimizerFallbackMediaIds={optimizerFallbackMediaIds}
        adaptivePressureLevel={effectiveAdaptivePressureLevel}
        adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
        resolveCardPreviewUrl={resolvePanelCardPreviewUrl}
        scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
        getMediaCardRef={getMediaCardRef}
        onSelectMediaFile={toggleSelectedMediaFile}
        onToggleMediaSelection={toggleSelectedMediaFile}
        onMediaDoubleClick={handleMediaCardDoubleClick}
        onMediaDragStart={handleMediaCardDragStart}
        onMediaDragEnd={handleCardDragEnd}
        onMediaContextMenu={handleMediaCardContextMenu}
        onRequestSignedUrl={refreshSignedUrl}
        showRemoveAction={canShowFolderItemRemoveAction}
        onRemoveMediaFromFolder={(file) => {
          void handleRemoveItemFromActiveFolder({ kind: "media", id: file.id });
        }}
        showDeleteAction={activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID}
        onDeleteMediaFromLibrary={(file) => {
          setPendingLibraryDelete({
            kind: "media",
            file,
          });
        }}
        onDownloadMediaFile={handleDownloadMediaFile}
        onRerollWorkflowFromMedia={handleRerollWorkflowFromMedia}
        onMediaPreviewError={handleMediaPreviewError}
        onMediaPaint={() => undefined}
        onSignedUrlLoaded={(id) => {
          signedUrlRetryRef.current[id] = 0;
        }}
        visibleMediaIdsRef={visibleMediaIdsRef}
        surface={panelListSurface}
        densityConfig={MEDIA_LIBRARY_PANEL_DENSITY_CONFIG}
      />
    ),
    [
      adaptivePreviewQualityEnabled,
      canShowFolderItemRemoveAction,
      getMediaCardRef,
      handleCardDragEnd,
      handleMediaCardDoubleClick,
      handleMediaCardDragStart,
      handleMediaCardContextMenu,
      handleDownloadMediaFile,
      handleMediaPreviewError,
      handleRerollWorkflowFromMedia,
      refreshSignedUrl,
      handleRemoveItemFromActiveFolder,
      effectiveAdaptivePressureLevel,
      optimizerFallbackMediaIds,
      resolvePanelCardPreviewUrl,
      signedUrlRetryRef,
      setPendingLibraryDelete,
      selectedIds,
      toggleSelectedMediaFile,
      activeFolderId,
      panelListSurface,
      visibleMediaIdsRef,
    ]
  );

  const renderAllItemsGrid = useCallback(
    ({
      gridMediaRows = mediaRows,
      gridPromptRows = visiblePromptRows,
    }: {
      gridMediaRows?: MediaFileRow[];
      gridPromptRows?: PromptRow[];
    } = {}) => (
      <MediaLibraryAllItemsGrid
        mediaRows={gridMediaRows}
        promptRows={gridPromptRows}
        selectedIds={combinedSelectedIds}
        optimizerFallbackMediaIds={optimizerFallbackMediaIds}
        adaptivePressureLevel={effectiveAdaptivePressureLevel}
        adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
        resolveCardPreviewUrl={resolvePanelCardPreviewUrl}
        scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
        getMediaCardRef={getMediaCardRef}
        onSelectMediaFile={toggleSelectedMediaFile}
        onToggleMediaSelection={toggleSelectedMediaFile}
        onSelectPromptCard={handleToggleSelectedPrompt}
        onMediaDoubleClick={handleMediaCardDoubleClick}
        onPromptDoubleClick={handlePromptCardDoubleClick}
        onMediaDragStart={handleMediaCardDragStart}
        onPromptDragStart={handlePromptCardDragStart}
        onMediaDragEnd={handleCardDragEnd}
        onPromptDragEnd={handleCardDragEnd}
        onMediaContextMenu={handleMediaCardContextMenu}
        onRequestSignedUrl={refreshSignedUrl}
        showRemoveAction={canShowFolderItemRemoveAction}
        onRemoveMediaFromFolder={(file) => {
          void handleRemoveItemFromActiveFolder({ kind: "media", id: file.id });
        }}
        onRemovePromptFromFolder={(prompt) => {
          void handleRemoveItemFromActiveFolder({ kind: "prompt", id: prompt.id });
        }}
        showDeleteAction={activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID}
        onDeleteMediaFromLibrary={(file) => {
          setPendingLibraryDelete({
            kind: "media",
            file,
          });
        }}
        onDeletePromptFromLibrary={(prompt) => {
          setPendingLibraryDelete({
            kind: "prompt",
            prompt,
          });
        }}
        onDownloadMediaFile={handleDownloadMediaFile}
        onRerollWorkflowFromMedia={handleRerollWorkflowFromMedia}
        onMediaPreviewError={handleMediaPreviewError}
        onMediaPaint={() => undefined}
        onSignedUrlLoaded={(id) => {
          signedUrlRetryRef.current[id] = 0;
        }}
        visibleMediaIdsRef={visibleMediaIdsRef}
        visibleMediaVersion={previewRuntime.visibleMediaVersion}
        surface={panelListSurface}
        densityConfig={MEDIA_LIBRARY_PANEL_DENSITY_CONFIG}
        preferVisualMediaFirst={shouldPreferVisualMediaFirstOnRootAll}
        visualMediaPriorityCount={ROOT_ALL_MEDIA_VISUAL_PRIORITY_COUNT}
      />
    ),
    [
      activeFolderId,
      adaptivePreviewQualityEnabled,
      canShowFolderItemRemoveAction,
      mediaRows,
      getMediaCardRef,
      handleCardDragEnd,
      handleDownloadMediaFile,
      handleMediaCardDoubleClick,
      handleMediaCardDragStart,
      handleMediaCardContextMenu,
      handleMediaPreviewError,
      handleRerollWorkflowFromMedia,
      handlePromptCardDoubleClick,
      handlePromptCardDragStart,
      handleRemoveItemFromActiveFolder,
      combinedSelectedIds,
      handleToggleSelectedPrompt,
      effectiveAdaptivePressureLevel,
      optimizerFallbackMediaIds,
      panelBodyRef,
      panelListSurface,
      shouldPreferVisualMediaFirstOnRootAll,
      refreshSignedUrl,
      resolvePanelCardPreviewUrl,
      setPendingLibraryDelete,
      signedUrlRetryRef,
      toggleSelectedMediaFile,
      visibleMediaIdsRef,
      previewRuntime.visibleMediaVersion,
      visiblePromptRows,
    ]
  );

  const renderAudioGrid = useCallback(
    () => renderAllItemsGrid({ gridMediaRows: visibleAudioRows, gridPromptRows: [] }),
    [renderAllItemsGrid, visibleAudioRows]
  );

  const renderPromptsSection = useCallback(
    ({ showHeading = true }: { showHeading?: boolean } = {}) => (
      <MediaLibraryPanelPromptsSection
        showHeading={showHeading}
        visiblePromptRows={visiblePromptRows}
        promptLoading={promptLoading}
        promptHasMore={promptHasMore}
        selectedPromptIds={selectedPromptIds}
        canShowFolderItemRemoveAction={canShowFolderItemRemoveAction}
        canDeleteFromLibrary={activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID}
        onSelectPromptCard={handleToggleSelectedPrompt}
        onPromptDoubleClick={handlePromptCardDoubleClick}
        onPromptDragStart={handlePromptCardDragStart}
        onPromptDragEnd={handleCardDragEnd}
        onRemovePromptFromFolder={(prompt) => {
          void handleRemoveItemFromActiveFolder({ kind: "prompt", id: prompt.id });
        }}
        onDeletePromptFromLibrary={(prompt) => {
          setPendingLibraryDelete({ kind: "prompt", prompt });
        }}
        loadPromptPage={loadPromptPage}
        scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
      />
    ),
    [
      activeFolderId,
      canShowFolderItemRemoveAction,
      handleCardDragEnd,
      handlePromptCardDoubleClick,
      handlePromptCardDragStart,
      handleRemoveItemFromActiveFolder,
      handleToggleSelectedPrompt,
      promptHasMore,
      promptLoading,
      selectedPromptIds,
      setPendingLibraryDelete,
      visiblePromptRows,
      loadPromptPage,
      panelBodyRef,
    ]
  );

  const commitProjectName = useCallback(() => {
    onProjectNameCommit?.(projectNameDraft);
  }, [onProjectNameCommit, projectNameDraft]);

  const handleExpandMediaLibraryPanel = useCallback(() => {
    if (isMediaLibraryPanelExpanded) return;
    expandedTopHeightPxRef.current = foldersSplit.topSectionHeightPx;
    onExpandMediaLibraryPanel?.();
    foldersSplit.snapToAllRefsExpanded(MEDIA_LIBRARY_FOLDERS_EXPANDED_GRID_TOP_HEIGHT_PX);
  }, [foldersSplit, isMediaLibraryPanelExpanded, onExpandMediaLibraryPanel]);

  const handleCollapseMediaLibraryPanel = useCallback(() => {
    if (
      typeof expandedTopHeightPxRef.current === "number" &&
      Number.isFinite(expandedTopHeightPxRef.current)
    ) {
      foldersSplit.restoreTopSectionHeightPx(expandedTopHeightPxRef.current);
    } else {
      foldersSplit.restoreTopRatio(MEDIA_LIBRARY_FOLDERS_DEFAULT_TOP_RATIO);
    }
    expandedTopHeightPxRef.current = null;
    onCollapseMediaLibraryPanel?.();
  }, [foldersSplit, onCollapseMediaLibraryPanel]);

  const handleOpenRootUploadPicker = useCallback(() => {
    if (isPlanBlockedStorageQuota) {
      onPlanAccessBlockedUploadAttempt?.();
      return;
    }
    if (isStorageQuotaBlocked) return;
    rootUploadInputRef.current?.click();
  }, [isPlanBlockedStorageQuota, isStorageQuotaBlocked, onPlanAccessBlockedUploadAttempt]);

  const handleRootUploadSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      const selectedFiles = files ? Array.from(files) : [];
      event.currentTarget.value = "";
      if (selectedFiles.length === 0) return;
      const uploadTargetFolderId = (activeFolderId ?? "").trim() || MEDIA_LIBRARY_ROOT_FOLDER_ID;
      try {
        await uploadDroppedFilesToFolder({
          targetFolderId: uploadTargetFolderId,
          files: selectedFiles,
        });
      } catch (error) {
        setFolderError(error instanceof Error ? error.message : "Unable to upload media.");
      }
    },
    [activeFolderId, setFolderError, uploadDroppedFilesToFolder]
  );

  const showCustomFolderEmptyState =
    !isRootFolderSelected &&
    !error &&
    !promptLoading &&
    !mediaLoading &&
    visiblePromptRows.length === 0 &&
    mediaRows.length === 0;
  const activeFolderGridPromptRows = useMemo(
    () => (shouldShowPrompts ? visiblePromptRows : []),
    [shouldShowPrompts, visiblePromptRows]
  );
  const showActiveFolderUnifiedGrid =
    !showCustomFolderEmptyState &&
    (activeFolderGridMediaRows.length > 0 || activeFolderGridPromptRows.length > 0);
  const isActiveFolderDropHover =
    !isRootFolderSelected && foldersDropController.hoveredContentFolderId === activeFolderId;
  const isRootFolderDropHover =
    isRootFolderSelected &&
    foldersDropController.hoveredContentFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const activeFolderDropZoneProps = !isRootFolderSelected
    ? {
        onDragOver: (event: React.DragEvent<HTMLElement>) =>
          foldersDropController.handleFolderContentDragOver(activeFolderId, event),
        onDragLeave: () => {
          foldersDropController.handleFolderContentDragLeave(activeFolderId);
        },
        onDrop: (event: React.DragEvent<HTMLElement>) => {
          void foldersDropController.handleFolderContentDrop(activeFolderId, event);
        },
      }
    : null;
  const rootFolderDropZoneProps = isRootFolderSelected
    ? {
        onDragOver: (event: React.DragEvent<HTMLElement>) =>
          foldersDropController.handleFolderContentDragOver(MEDIA_LIBRARY_ROOT_FOLDER_ID, event),
        onDragLeave: () =>
          foldersDropController.handleFolderContentDragLeave(MEDIA_LIBRARY_ROOT_FOLDER_ID),
        onDrop: (event: React.DragEvent<HTMLElement>) => {
          void foldersDropController.handleFolderContentDrop(MEDIA_LIBRARY_ROOT_FOLDER_ID, event);
        },
      }
    : null;
  useEffect(() => {
    if (!selectedIds.size) return;
    const visibleIdSet = new Set(bulkVisibleMediaRows.map((row) => row.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (!visibleIdSet.has(id)) {
          changed = true;
          continue;
        }
        next.add(id);
      }
      return changed ? next : prev;
    });
  }, [bulkVisibleMediaRows, selectedIds.size]);

  useEffect(() => {
    if (!selectedPromptIds.size) return;
    const visiblePromptIdSet = new Set(
      shouldShowPrompts ? visiblePromptRows.map((row) => row.id) : []
    );
    setSelectedPromptIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (!visiblePromptIdSet.has(id)) {
          changed = true;
          continue;
        }
        next.add(id);
      }
      return changed ? next : prev;
    });
  }, [selectedPromptIds.size, shouldShowPrompts, visiblePromptRows]);

  return (
    <section className="media-library-panel" aria-label="Media library panel">
      <MediaLibraryPanelHeader
        projectName={projectName}
        projectNameDraft={projectNameDraft}
        setProjectNameDraft={setProjectNameDraft}
        commitProjectName={commitProjectName}
        projectNameInputRef={projectNameInputRef}
        projectNamePlaceholder={PROJECT_NAME_PLACEHOLDER}
        projectNameInputWidthCh={projectNameInputWidthCh}
        rootUploadInputRef={rootUploadInputRef}
        onRootUploadSelection={handleRootUploadSelection}
        disableUploads={shouldDisableUploads}
      />
      {folderOpenGhost ? (
        <div
          key={folderOpenGhost.key}
          className="media-library-panel-folder-open-ghost"
          aria-hidden="true"
          style={{
            left: `${folderOpenGhost.left}px`,
            top: `${folderOpenGhost.top}px`,
            width: `${folderOpenGhost.width}px`,
            height: `${folderOpenGhost.height}px`,
          }}
        >
          {/* Decorative folder-open echo for double-click navigation. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FOLDER_OPEN_GHOST_IMAGE_SRC} alt="" />
        </div>
      ) : null}

      <div ref={splitContainerRef} className="media-library-panel-split">
        <div className="media-library-panel-folders-panel" style={foldersSplit.topSectionStyle}>
          <div key={activeFolderId} className="media-library-panel-folders-stage">
            <MediaLibraryPanelFoldersSection
              ancestorFolders={ancestorFolders}
              folders={visibleFolders}
              canNavigateUp={canNavigateUp}
              onNavigateUp={handleNavigateUp}
              onNavigateToRoot={handleNavigateToRoot}
              onNavigateToFolder={handleNavigateToFolder}
              onOpenFolderWithAnimation={handleOpenFolderWithAnimation}
              setActiveFolderId={setActiveFolderId}
              editingFolderId={editingFolderId}
              editingFolderName={editingFolderName}
              setEditingFolderName={setEditingFolderName}
              startFolderRename={startFolderRename}
              cancelFolderRename={cancelFolderRename}
              commitFolderRename={commitFolderRename}
              createFolder={createFolder}
              creatingFolder={creatingFolder}
              folderError={folderError}
              hoveredFolderId={foldersDropController.hoveredFolderId}
              hoveredReparentFolderId={folderReparentController.hoveredFolderId}
              isRootReparentDropHover={folderReparentController.isRootDropHover}
              onFolderDragOver={foldersDropController.handleFolderDragOver}
              onFolderDragLeave={foldersDropController.handleFolderDragLeave}
              onFolderDrop={foldersDropController.handleFolderDrop}
              onFolderReparentDragStart={folderReparentController.handleFolderDragStart}
              onFolderReparentDragEnd={folderReparentController.handleFolderDragEnd}
              onFolderReparentDragOver={folderReparentController.handleFolderDragOver}
              onFolderReparentDragLeave={folderReparentController.handleFolderDragLeave}
              onFolderReparentDrop={folderReparentController.handleFolderDrop}
              folderContextMenu={folderContextMenu}
              folderContextMenuRef={folderContextMenuRef}
              openFolderContextMenu={openFolderContextMenu}
              onContextCreateSubfolder={handleContextCreateSubfolder}
              onContextRename={handleContextRename}
              canOpenMovePicker={canOpenMovePicker}
              onOpenMovePicker={handleOpenMovePicker}
              onContextDelete={handleContextDelete}
            />
          </div>
        </div>

        <div
          className="reference-grid-horizontal-divider-wrap media-library-panel-horizontal-divider-wrap"
          {...foldersSplit.dividerProps}
        >
          <div className="reference-grid-horizontal-divider" />
        </div>

        <div className="media-library-panel-content-panel" style={foldersSplit.bottomSectionStyle}>
          <div className="media-library-panel-body" ref={panelBodyRef}>
            <MediaLibraryPanelStatusArea
              error={error}
              membershipPendingMessage={membershipPendingMessage}
              membershipMessage={membershipMessage}
              storageQuotaMessage={isPlanBlockedStorageQuota ? null : storageQuotaMessage}
            />
            {isRootFolderSelected ? (
              <MediaLibraryPanelRootContent
                rootTab={rootTab}
                setRootTab={setRootTab}
                libraryTotalCount={libraryTotalCount}
                isMediaLibraryPanelExpanded={isMediaLibraryPanelExpanded}
                onExpandMediaLibraryPanel={handleExpandMediaLibraryPanel}
                onCollapseMediaLibraryPanel={handleCollapseMediaLibraryPanel}
                onOpenRootUploadPicker={handleOpenRootUploadPicker}
                disableUploads={shouldDisableUploads}
                bulkActions={bulkActions}
                selectedVisibleMediaCount={selectedVisibleMediaRows.length}
                itemType={itemType}
                isRootFolderDropHover={isRootFolderDropHover}
                rootFolderDropZoneProps={rootFolderDropZoneProps}
                mediaLoading={mediaLoading}
                mediaRowsLength={mediaRows.length}
                promptLoading={itemType === "prompts" ? promptLoading : false}
                visiblePromptRowsLength={itemType === "prompts" ? visiblePromptRows.length : 0}
                visibleImageRowsLength={visibleImageRows.length}
                visibleVideoRowsLength={visibleVideoRows.length}
                visibleAudioRowsLength={visibleAudioRows.length}
                renderAllItemsGrid={() => renderAllItemsGrid({ gridPromptRows: [] })}
                renderImageGrid={() => renderMediaGrid(visibleImageRows)}
                renderVideoGrid={() => renderMediaGrid(visibleVideoRows)}
                renderAudioGrid={renderAudioGrid}
                renderPromptsSection={() => renderPromptsSection({ showHeading: false })}
                mediaHasMore={mediaHasMore}
                loadMediaPage={loadMediaPage}
              />
            ) : null}

            {!isRootFolderSelected ? (
              <MediaLibraryPanelFolderContent
                activeFolderId={activeFolderId}
                activeFolderName={activeFolderName}
                isActiveFolderDropHover={isActiveFolderDropHover}
                activeFolderDropZoneProps={activeFolderDropZoneProps}
                onOpenRootUploadPicker={handleOpenRootUploadPicker}
                disableUploads={shouldDisableUploads}
                showCustomFolderEmptyState={showCustomFolderEmptyState}
                showActiveFolderUnifiedGrid={showActiveFolderUnifiedGrid}
                promptLoading={promptLoading}
                mediaLoading={mediaLoading}
                shouldShowPrompts={shouldShowPrompts}
                shouldShowMedia={shouldShowMedia}
                activeFolderGridMediaRows={activeFolderGridMediaRows}
                activeFolderGridPromptRows={activeFolderGridPromptRows}
                renderAllItemsGrid={renderAllItemsGrid}
                promptHasMore={promptHasMore}
                mediaHasMore={mediaHasMore}
                loadPromptPage={loadPromptPage}
                loadMediaPage={loadMediaPage}
                visiblePromptRowsLength={visiblePromptRows.length}
                mediaRowsLength={mediaRows.length}
                bulkActions={bulkActions}
              />
            ) : null}
          </div>

          <footer className="media-library-panel-footer">
            <p className="tiny subdued media-library-panel-footer-folder-label">
              <FolderSimple
                size={13}
                weight={isRootFolderSelected ? "fill" : "regular"}
                aria-hidden
              />
              <span>{activeFolderName}</span>
            </p>
          </footer>
        </div>
      </div>
      <MediaLibraryPanelPreviewModal
        item={detailModalItem}
        detailNavigation={detailNavigation}
        isLoading={detailModalLoading}
        error={detailModalError}
        onClose={closeDetailModal}
        onPreviewError={handleDetailModalMediaError}
        onSnapshotVideoFrame={onSnapshotVideoFrame}
        onSnapshotVideoFrameError={onSnapshotVideoFrameError}
        onDownloadItem={(item) => {
          handleDownloadMediaFile(item.file);
        }}
        onReloadWorkflowItem={(item) => {
          handleReloadWorkflowFromMedia(item.file);
        }}
        onDeleteItem={(item) => {
          setPendingLibraryDelete({
            kind: "media",
            file: item.file,
          });
        }}
      />
      <MediaLibraryPromptDetailModal
        item={promptDetailModalItem}
        onClose={closePromptDetailModal}
        onUsePromptItem={handleUsePromptDetailItem}
        onDeletePromptItem={handleDeletePromptDetailItem}
      />
      <MediaLibraryPanelDialogs
        pendingBulkDeleteIds={pendingBulkDeleteIds}
        onCloseBulkDeleteConfirm={handleCloseBulkDeleteConfirm}
        onConfirmBulkDelete={() => {
          void handleConfirmBulkDelete();
        }}
        bulkMoveDialogOpen={bulkMoveDialogOpen}
        selectedVisibleMediaCount={selectedVisibleMediaRows.length}
        bulkMoveDestinationOptions={bulkMoveDestinationOptions}
        onCloseBulkMoveDialog={handleCloseBulkMoveDialog}
        onMoveSelectedMediaToFolder={(targetFolderId) => {
          void handleMoveSelectedMediaToFolder(targetFolderId);
        }}
        pendingLibraryDelete={pendingLibraryDelete}
        onCloseDeleteConfirm={closeDeleteConfirm}
        onConfirmDeleteFromLibrary={() => {
          void confirmDeleteFromLibrary();
        }}
        pendingFolderDelete={pendingFolderDelete}
        onCloseFolderDeleteConfirm={closeFolderDeleteConfirm}
        onConfirmFolderDelete={() => {
          void confirmFolderDelete();
        }}
        moveFolderPicker={moveFolderPicker}
        moveFolderCurrentParentLabel={moveFolderCurrentParentLabel}
        moveFolderDestinationOptions={moveFolderDestinationOptions}
        onCloseMoveFolderPicker={closeMoveFolderPicker}
        onMoveFolderToDestination={(parentFolderId) => {
          void handleMoveFolderToDestination(parentFolderId);
        }}
      />
    </section>
  );
});
