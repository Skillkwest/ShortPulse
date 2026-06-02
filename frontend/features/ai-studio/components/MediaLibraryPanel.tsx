/**
 * AI Studio Media Library left-panel surface.
 * Provides folder-aware browsing for media + prompts with adaptive preview/signing parity.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FolderSimple } from "phosphor-react";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
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
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../media-library/logic/mediaLibraryAdaptivePreview";
import {
  getMediaDataTabForRow,
  isAudioFile,
  isImageFile,
  isNextImageOptimizerUrl,
  isVideoFile,
  resolveNextImageOptimizerSourceUrl,
  sortByCreatedAtDesc,
  type MediaDataTab,
  type MediaFileRow,
  type MediaTab,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import {
  getMediaLibrarySurfaceConfig,
  resolvePanelMixedAllMediaSignBudget,
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
import { MediaLibraryPanelBulkActions } from "./MediaLibraryPanelBulkActions";
import { MediaLibraryPanelDialogs } from "./MediaLibraryPanelDialogs";
import { MediaLibraryPanelFolderContent } from "./MediaLibraryPanelFolderContent";
import { MediaLibraryPanelHeader } from "./MediaLibraryPanelHeader";
import { MediaLibraryPanelRootContent } from "./MediaLibraryPanelRootContent";
import { MediaLibraryPanelStatusArea } from "./MediaLibraryPanelStatusArea";
import { MediaLibraryAllItemsGrid } from "./media-library-modal/MediaLibraryAllItemsGrid";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryPanelPreviewModal } from "./media-library-modal/MediaLibraryPanelPreviewModal";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";
import { useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "audio" | "prompts";
type RootMediaLibraryTab = MediaLibraryPanelItemType;

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

type MediaLibraryPanelProps = {
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video" | "audio";
    filename?: string | null;
    promptText?: string | null;
    transcriptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    previewPosterUrl?: string | null;
    previewPosterStoragePath?: string | null;
    fullUrl?: string | null;
  }) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
  projectId?: string | null;
  projectName?: string | null;
  onProjectNameCommit?: (value: string) => void;
  isMediaLibraryPanelExpanded?: boolean;
  onExpandMediaLibraryPanel?: () => void;
  onCollapseMediaLibraryPanel?: () => void;
  resolveInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  onDeleteMediaRowsFromWorkspace?: (rows: MediaFileRow[]) => void;
};

const FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX = 10;
const MEMBERSHIP_MESSAGE_TIMEOUT_MS = 1800;
const MEDIA_LIBRARY_FOLDERS_DEFAULT_TOP_RATIO = 0.3;
const MEDIA_LIBRARY_FOLDERS_EXPANDED_GRID_TOP_HEIGHT_PX = 0;
const MEDIA_LIBRARY_FOLDERS_COLLAPSE_TOP_HEIGHT_PX = 86;
const PROJECT_NAME_PLACEHOLDER = "Untitled project";
const ROOT_ALL_MEDIA_VISUAL_PRIORITY_COUNT = MEDIA_LIBRARY_PANEL_DENSITY_CONFIG.maxColumnCount;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const resolveSigningTab = (itemType: MediaLibraryPanelItemType): MediaDataTab => {
  if (itemType === "videos") return "uploaded_videos";
  return "uploaded_images";
};

export const MediaLibraryPanel = React.memo(function MediaLibraryPanel({
  onSelectMedia,
  onSelectPrompt: _onSelectPrompt,
  projectId = null,
  projectName = null,
  onProjectNameCommit,
  isMediaLibraryPanelExpanded = false,
  onExpandMediaLibraryPanel,
  onCollapseMediaLibraryPanel,
  resolveInternalDropItem,
  onDeleteMediaRowsFromWorkspace,
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
  const [rootTab, setRootTab] = useState<RootMediaLibraryTab>("all");
  const itemType: MediaLibraryPanelItemType = isRootFolderSelected ? rootTab : "all";

  const [error, setError] = useState<string | null>(null);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);
  const [membershipPendingMessage, setMembershipPendingMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(() => new Set());
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);
  const [moveFolderPicker, setMoveFolderPicker] = useState<MoveFolderPickerState | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName ?? "");
  void _onSelectPrompt;

  const rootUploadInputRef = useRef<HTMLInputElement | null>(null);
  const expandedTopHeightPxRef = useRef<number | null>(null);

  const panelBodyRef = useRef<HTMLDivElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const folderContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setProjectNameDraft(projectName ?? "");
  }, [projectName]);

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

  const normalizedSearch = "";
  const shouldShowMedia = itemType !== "prompts";
  const shouldShowPrompts = itemType === "prompts" || itemType === "all";
  // Folder canvas remains a secondary domain and is no longer the default folder browse surface.
  const showFolderCanvas = false;
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
    loadMediaPage,
    loadPromptPage,
    refreshActiveRows,
  } = useMediaLibraryPanelDataController({
    projectId,
    activeFolderId,
    itemType,
    normalizedSearch,
    shouldShowMedia,
    shouldShowPrompts,
    showFolderCanvas,
    panelBodyRef,
    listSurface: panelListSurface,
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
    refreshActiveRows,
    refreshFolders,
    setFolderError,
    setMembershipMessage,
    setMediaRows,
    setPromptRows,
    onDeleteMediaRowsFromWorkspace,
  });
  useAiStudioModalActivity(
    "media-library-panel-delete-confirm",
    Boolean(pendingLibraryDelete || pendingBulkDeleteIds)
  );
  useAiStudioModalActivity("media-library-panel-move-folder", Boolean(moveFolderPicker));
  useAiStudioModalActivity("media-library-panel-bulk-move", bulkMoveDialogOpen);
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
    () => mediaRows.filter((row) => isImageFile(row.file_type)),
    [mediaRows]
  );
  const visibleVideoRows = useMemo(
    () => mediaRows.filter((row) => isVideoFile(row.file_type)),
    [mediaRows]
  );
  const visibleAudioRows = useMemo(
    () => mediaRows.filter((row) => isAudioFile(row.file_type)),
    [mediaRows]
  );
  const shouldPreferVisualMediaFirstOnRootAll = useMemo(
    () => isRootFolderSelected && itemType === "all" && normalizedSearch.length === 0,
    [isRootFolderSelected, itemType, normalizedSearch]
  );
  const signableMediaRows = useMemo(
    () => (itemType === "all" ? mediaRows.filter((row) => !isAudioFile(row.file_type)) : mediaRows),
    [itemType, mediaRows]
  );
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
  const previewRuntime = useMediaSurfacePreviewRuntime<MediaFileRow, MediaTab, HTMLElement>({
    activeMediaQuery: normalizedSearch,
    activeTab: activeMediaTab ?? "saved_prompts",
    firstMediaPaintEventName: "media.panel.first_media_paint",
    previewProfile: panelSurfaceConfig.imageCardPreviewProfile,
    signBudgetResolver: panelSurfaceConfig.signBudgetResolver,
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
      itemType === "all"
        ? resolvePanelMixedAllMediaSignBudget(previewRuntime.signBudget)
        : undefined,
    [itemType, previewRuntime.signBudget]
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
    source: "client.ai_studio.media_library_panel_error",
    scope: "app",
    severity: "medium",
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
    setPendingBulkDeleteIds(null);
    setBulkMoveDialogOpen(false);
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
    onSelectMedia,
    refreshSignedUrl,
    signStoragePath,
  });

  const handleToggleSelectedPrompt = useCallback((prompt: PromptRow) => {
    setPendingBulkDeleteIds(null);
    setBulkMoveDialogOpen(false);
    setSelectedPromptIds((prev) => {
      const next = new Set(prev);
      if (next.has(prompt.id)) {
        next.delete(prompt.id);
      } else {
        next.add(prompt.id);
      }
      return next;
    });
  }, []);

  const toggleSelectedMediaFile = useCallback((file: MediaFileRow) => {
    setPendingBulkDeleteIds(null);
    setBulkMoveDialogOpen(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.add(file.id);
      }
      return next;
    });
  }, []);

  const clearSelections = useCallback(() => {
    setPendingBulkDeleteIds(null);
    setBulkMoveDialogOpen(false);
    setSelectedIds(new Set());
    setSelectedPromptIds(new Set());
  }, []);

  const handleToggleSelectedMedia = useCallback(
    (file: MediaFileRow) => {
      toggleSelectedMediaFile(file);
    },
    [toggleSelectedMediaFile]
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

  const handleCloseBulkDeleteConfirm = useCallback(() => {
    setPendingBulkDeleteIds(null);
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    const nextPendingBulkDeleteIds = pendingBulkDeleteIds ? [...pendingBulkDeleteIds] : null;
    if (!nextPendingBulkDeleteIds?.length) return;
    setPendingBulkDeleteIds(null);
    const selectedIdSet = new Set(nextPendingBulkDeleteIds);
    const selectedRows = mediaRows.filter((row) => selectedIdSet.has(row.id));
    const deleted = await deleteMediaRowsFromLibrary(selectedRows);
    if (deleted) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of nextPendingBulkDeleteIds) {
        if (!mediaRows.some((row) => row.id === id)) {
          next.delete(id);
        }
      }
      return next;
    });
  }, [deleteMediaRowsFromLibrary, mediaRows, pendingBulkDeleteIds]);

  useMediaSurfacePreviewSigning<MediaFileRow, MediaTab>({
    runtime: previewRuntime,
    activeMediaTab,
    activeMediaCacheLoading: mediaLoading,
    activeMediaCachePagesLoaded: 1,
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
  }, [activeFolderId, closeDetailModal, resetDeleteConfirmState]);

  const foldersDropController = useMediaLibraryFolderDropController({
    projectId,
    folders,
    isStorageQuotaBlocked,
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
  });
  const {
    handleCardDragEnd,
    handleDownloadMediaFile,
    handleMediaCardDragStart,
    handlePromptCardDragStart,
  } = useMediaLibraryPanelItemInteractions({
    activeFolderId,
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
    const folderId = folderContextMenu.folderId;
    setFolderContextMenu(null);
    await deleteFolder(folderId);
  }, [deleteFolder, folderContextMenu]);
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
  const canShowFolderItemRemoveAction = !isRootFolderSelected;
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
      resolveMediaLibraryAdaptiveCardPreviewUrl({
        surface: "media-library-panel-grid",
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
        adaptivePressureLevel={mediaAdaptivePressure.previewPressureLevel}
        adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
        resolveCardPreviewUrl={resolvePanelCardPreviewUrl}
        scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
        getMediaCardRef={getMediaCardRef}
        onSelectMediaFile={handleToggleSelectedMedia}
        onToggleMediaSelection={handleToggleSelectedMedia}
        onMediaDoubleClick={handleMediaCardDoubleClick}
        onMediaDragStart={handleMediaCardDragStart}
        onMediaDragEnd={handleCardDragEnd}
        onMediaContextMenu={handleMediaCardContextMenu}
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
      handleRemoveItemFromActiveFolder,
      handleToggleSelectedMedia,
      mediaAdaptivePressure.previewPressureLevel,
      optimizerFallbackMediaIds,
      resolvePanelCardPreviewUrl,
      signedUrlRetryRef,
      setPendingLibraryDelete,
      selectedIds,
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
        adaptivePressureLevel={mediaAdaptivePressure.previewPressureLevel}
        adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
        resolveCardPreviewUrl={resolvePanelCardPreviewUrl}
        scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
        getMediaCardRef={getMediaCardRef}
        onSelectMediaFile={handleToggleSelectedMedia}
        onToggleMediaSelection={handleToggleSelectedMedia}
        onSelectPromptCard={handleToggleSelectedPrompt}
        onMediaDoubleClick={handleMediaCardDoubleClick}
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
      handlePromptCardDragStart,
      handleRemoveItemFromActiveFolder,
      combinedSelectedIds,
      handleToggleSelectedPrompt,
      handleToggleSelectedMedia,
      mediaAdaptivePressure.previewPressureLevel,
      optimizerFallbackMediaIds,
      panelBodyRef,
      panelListSurface,
      shouldPreferVisualMediaFirstOnRootAll,
      refreshSignedUrl,
      resolvePanelCardPreviewUrl,
      setPendingLibraryDelete,
      signedUrlRetryRef,
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
      <section className="media-library-panel-section">
        {showHeading ? (
          <div className="media-library-panel-section-head">
            <p className="tiny subdued">
              Prompts ({visiblePromptRows.length})
              {promptLoading && visiblePromptRows.length > 0 ? " · Refreshing" : ""}
            </p>
          </div>
        ) : null}
        {promptLoading && visiblePromptRows.length === 0 ? (
          <p className="tiny subdued">Loading prompts…</p>
        ) : null}
        {!promptLoading && visiblePromptRows.length === 0 ? (
          <p className="tiny subdued">No prompts found for this folder.</p>
        ) : null}
        <div id="media-library-panel-prompts-section">
          {visiblePromptRows.length > 0 ? (
            <MediaLibraryPromptGrid
              prompts={visiblePromptRows}
              sortedPrompts={visiblePromptRows}
              selectedIds={selectedPromptIds}
              onSelectPromptCard={handleToggleSelectedPrompt}
              onPromptDragStart={handlePromptCardDragStart}
              onPromptDragEnd={handleCardDragEnd}
              showRemoveAction={canShowFolderItemRemoveAction}
              showDeleteAction={activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID}
              onRemovePromptFromFolder={(prompt) => {
                void handleRemoveItemFromActiveFolder({ kind: "prompt", id: prompt.id });
              }}
              onDeletePromptFromLibrary={(prompt) => {
                setPendingLibraryDelete({
                  kind: "prompt",
                  prompt,
                });
              }}
              variant="reference-card"
            />
          ) : null}
          {promptHasMore ? (
            <div className="media-load-more">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void loadPromptPage({ reset: false });
                }}
                disabled={promptLoading}
              >
                {promptLoading ? "Loading more..." : "Load more prompts"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    ),
    [
      activeFolderId,
      canShowFolderItemRemoveAction,
      handleCardDragEnd,
      handlePromptCardDragStart,
      handleRemoveItemFromActiveFolder,
      handleToggleSelectedPrompt,
      promptHasMore,
      promptLoading,
      selectedPromptIds,
      setPendingLibraryDelete,
      visiblePromptRows,
      loadPromptPage,
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
    if (isStorageQuotaBlocked) return;
    rootUploadInputRef.current?.click();
  }, [isStorageQuotaBlocked]);

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
    !showFolderCanvas &&
    !isRootFolderSelected &&
    !error &&
    !promptLoading &&
    !mediaLoading &&
    visiblePromptRows.length === 0 &&
    mediaRows.length === 0;
  const activeFolderGridMediaRows = useMemo(
    () => (shouldShowMedia ? mediaRows : []),
    [mediaRows, shouldShowMedia]
  );
  const activeFolderGridPromptRows = useMemo(
    () => (shouldShowPrompts ? visiblePromptRows : []),
    [shouldShowPrompts, visiblePromptRows]
  );
  const showActiveFolderUnifiedGrid =
    !showCustomFolderEmptyState &&
    (activeFolderGridMediaRows.length > 0 || activeFolderGridPromptRows.length > 0);
  const bulkVisibleMediaRows = useMemo(() => {
    if (!shouldShowMedia) return [] as MediaFileRow[];
    if (!isRootFolderSelected) {
      return activeFolderGridMediaRows;
    }
    if (itemType === "images") return visibleImageRows;
    if (itemType === "videos") return visibleVideoRows;
    if (itemType === "audio") return visibleAudioRows;
    if (itemType === "all") return mediaRows;
    return [];
  }, [
    activeFolderGridMediaRows,
    isRootFolderSelected,
    itemType,
    mediaRows,
    shouldShowMedia,
    visibleAudioRows,
    visibleImageRows,
    visibleVideoRows,
  ]);
  const selectedVisibleMediaRows = useMemo(() => {
    if (!selectedIds.size) return [] as MediaFileRow[];
    return bulkVisibleMediaRows.filter((row) => selectedIds.has(row.id));
  }, [bulkVisibleMediaRows, selectedIds]);
  const handleOpenBulkDeleteConfirm = useCallback(() => {
    if (!selectedVisibleMediaRows.length || !isRootFolderSelected) return;
    setBulkMoveDialogOpen(false);
    setPendingBulkDeleteIds(selectedVisibleMediaRows.map((row) => row.id));
  }, [isRootFolderSelected, selectedVisibleMediaRows]);
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
  const canMoveSelectedMediaToFolder = bulkMoveDestinationOptions.length > 0;
  const handleOpenBulkMoveDialog = useCallback(() => {
    if (!selectedVisibleMediaRows.length || !canMoveSelectedMediaToFolder) return;
    setPendingBulkDeleteIds(null);
    setBulkMoveDialogOpen(true);
  }, [canMoveSelectedMediaToFolder, selectedVisibleMediaRows.length]);
  const handleCloseBulkMoveDialog = useCallback(() => setBulkMoveDialogOpen(false), []);
  const handleMoveSelectedMediaToFolder = useCallback(
    async (targetFolderId: string) => {
      if (!selectedVisibleMediaRows.length) return;
      const moved = await handleMoveItemsToFolder({
        mediaIds: selectedVisibleMediaRows.map((row) => row.id),
        targetFolderId,
      });
      if (!moved) return;
      setBulkMoveDialogOpen(false);
      setSelectedIds(new Set());
    },
    [handleMoveItemsToFolder, selectedVisibleMediaRows]
  );
  const handleRemoveSelectedMediaFromFolder = useCallback(async () => {
    if (!selectedVisibleMediaRows.length || isRootFolderSelected) return;
    const removed = await handleRemoveItemsFromActiveFolder({
      mediaIds: selectedVisibleMediaRows.map((row) => row.id),
    });
    if (!removed) return;
    setSelectedIds(new Set());
  }, [handleRemoveItemsFromActiveFolder, isRootFolderSelected, selectedVisibleMediaRows]);
  const bulkActions = useMemo(
    () => (
      <MediaLibraryPanelBulkActions
        canDeleteFromLibrary={isRootFolderSelected}
        canMoveToFolder={canMoveSelectedMediaToFolder}
        canRemoveFromFolder={!isRootFolderSelected}
        disabled={deleteConfirmSubmitting}
        onClearSelection={clearSelections}
        onMoveToFolder={handleOpenBulkMoveDialog}
        onDeleteFromLibrary={handleOpenBulkDeleteConfirm}
        onRemoveFromFolder={() => {
          void handleRemoveSelectedMediaFromFolder();
        }}
        selectedCount={selectedVisibleMediaRows.length}
      />
    ),
    [
      canMoveSelectedMediaToFolder,
      clearSelections,
      deleteConfirmSubmitting,
      handleOpenBulkDeleteConfirm,
      handleOpenBulkMoveDialog,
      handleRemoveSelectedMediaFromFolder,
      isRootFolderSelected,
      selectedVisibleMediaRows.length,
    ]
  );
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
  const renderRootAllItemsGrid = useCallback(() => renderAllItemsGrid(), [renderAllItemsGrid]);
  const renderRootImageGrid = useCallback(
    () => renderMediaGrid(visibleImageRows),
    [renderMediaGrid, visibleImageRows]
  );
  const renderRootVideoGrid = useCallback(
    () => renderMediaGrid(visibleVideoRows),
    [renderMediaGrid, visibleVideoRows]
  );
  const renderRootPromptsGrid = useCallback(
    () => renderPromptsSection({ showHeading: false }),
    [renderPromptsSection]
  );
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

  useEffect(() => {
    if (selectedVisibleMediaRows.length > 0) return;
    setPendingBulkDeleteIds(null);
    setBulkMoveDialogOpen(false);
  }, [selectedVisibleMediaRows.length]);

  return (
    <section className="media-library-panel" aria-label="Media library panel">
      <MediaLibraryPanelHeader
        projectName={projectName}
        projectNameDraft={projectNameDraft}
        setProjectNameDraft={setProjectNameDraft}
        commitProjectName={commitProjectName}
        projectNamePlaceholder={PROJECT_NAME_PLACEHOLDER}
        projectNameInputWidthCh={projectNameInputWidthCh}
        rootUploadInputRef={rootUploadInputRef}
        onRootUploadSelection={handleRootUploadSelection}
        disableUploads={isStorageQuotaBlocked}
      />

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
              storageQuotaMessage={storageQuotaMessage}
            />
            {!showFolderCanvas ? (
              isRootFolderSelected ? (
                <MediaLibraryPanelRootContent
                  rootTab={rootTab}
                  setRootTab={setRootTab}
                  libraryTotalCount={libraryTotalCount}
                  isMediaLibraryPanelExpanded={isMediaLibraryPanelExpanded}
                  onExpandMediaLibraryPanel={handleExpandMediaLibraryPanel}
                  onCollapseMediaLibraryPanel={handleCollapseMediaLibraryPanel}
                  onOpenRootUploadPicker={handleOpenRootUploadPicker}
                  disableUploads={isStorageQuotaBlocked}
                  bulkActions={bulkActions}
                  selectedVisibleMediaCount={selectedVisibleMediaRows.length}
                  itemType={itemType}
                  isRootFolderDropHover={isRootFolderDropHover}
                  rootFolderDropZoneProps={rootFolderDropZoneProps}
                  mediaLoading={mediaLoading}
                  mediaRowsLength={mediaRows.length}
                  promptLoading={promptLoading}
                  visiblePromptRowsLength={visiblePromptRows.length}
                  visibleImageRowsLength={visibleImageRows.length}
                  visibleVideoRowsLength={visibleVideoRows.length}
                  visibleAudioRowsLength={visibleAudioRows.length}
                  renderAllItemsGrid={renderRootAllItemsGrid}
                  renderImageGrid={renderRootImageGrid}
                  renderVideoGrid={renderRootVideoGrid}
                  renderAudioGrid={renderAudioGrid}
                  renderPromptsSection={renderRootPromptsGrid}
                  mediaHasMore={mediaHasMore}
                  loadMediaPage={loadMediaPage}
                />
              ) : null
            ) : null}

            {!showFolderCanvas && !isRootFolderSelected ? (
              <MediaLibraryPanelFolderContent
                activeFolderId={activeFolderId}
                activeFolderName={activeFolderName}
                isActiveFolderDropHover={isActiveFolderDropHover}
                activeFolderDropZoneProps={activeFolderDropZoneProps}
                onOpenRootUploadPicker={handleOpenRootUploadPicker}
                disableUploads={isStorageQuotaBlocked}
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
        isLoading={detailModalLoading}
        error={detailModalError}
        onClose={closeDetailModal}
        onPreviewError={handleDetailModalMediaError}
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
