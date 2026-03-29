/**
 * AI Studio Media Library left-panel surface.
 * Provides folder-aware browsing for media + prompts with adaptive preview/signing parity.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderSimple } from "phosphor-react";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import { MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM } from "../../../lib/mediaPreviewRuntimePolicy";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import { useMediaSurfacePreviewSigning } from "../../media-library/hooks/useMediaSurfacePreviewSigning";
import { useMediaSurfacePreviewRuntime } from "../../media-library/hooks/useMediaSurfacePreviewRuntime";
import {
  MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED,
  MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
} from "../../media-library/logic/mediaLibraryFeatureFlags";
import {
  BUCKET,
  getMediaDataTabForRow,
  isNextImageOptimizerUrl,
  isVideoFile,
  resolveMediaMetadataPromptText,
  resolveNextImageOptimizerSourceUrl,
  sortByCreatedAtDesc,
  type MediaDataTab,
  type MediaFileRow,
  type MediaTab,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import { getMediaLibrarySurfaceConfig } from "../../media-library/runtime";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../logic/mediaLibraryPanelApi";
import { resolveMediaDragDimensions } from "../logic/mediaLibraryAspectRatio";
import {
  attachMediaLibraryDragGhost,
  clearMediaLibraryDragGhost,
} from "../logic/mediaLibraryDragGhost";
import { writeMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import { resolveMediaLibraryPanelCardPreviewUrl } from "../logic/mediaLibraryPanelPreviewResolver";
import { downloadBlobToFile } from "../logic/referenceDownload";
import { useMediaLibraryPanelDataController } from "../hooks/useMediaLibraryPanelDataController";
import { useMediaLibraryPanelFolderCanvasController } from "../hooks/useMediaLibraryPanelFolderCanvasController";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useMediaLibraryFoldersState } from "../hooks/useMediaLibraryFoldersState";
import { useMediaLibraryFolderDropController } from "../hooks/useMediaLibraryFolderDropController";
import { useMediaLibraryPanelMutationController } from "../hooks/useMediaLibraryPanelMutationController";
import { useMediaLibraryPanelSelectionController } from "../hooks/useMediaLibraryPanelSelectionController";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";
import type { ResolveCanvasDropReference } from "./canvas/canvasTypes";
import { MediaLibraryFolderCanvas } from "./MediaLibraryFolderCanvas";
import { MediaLibraryPanelFoldersSection } from "./MediaLibraryPanelFoldersSection";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryPanelPreviewModal } from "./media-library-modal/MediaLibraryPanelPreviewModal";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "audio" | "prompts";
type RootMediaLibraryTab = "all" | "images" | "videos" | "audio" | "prompts";

type FolderContextMenuState = {
  folderId: string;
  folderName: string;
  x: number;
  y: number;
};

type MediaLibraryPanelProps = {
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video";
    filename?: string | null;
    promptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    fullUrl?: string | null;
  }) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
  projectName?: string | null;
  onProjectNameCommit?: (value: string) => void;
  resolveInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
};

const ROOT_FOLDER_LABEL = "All Media";
const FOLDER_CONTEXT_MENU_WIDTH_PX = 156;
const FOLDER_CONTEXT_MENU_HEIGHT_PX = 84;
const FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX = 10;

const setTransferDataSafe = (transfer: DataTransfer, type: string, value: string): void => {
  try {
    transfer.setData(type, value);
  } catch {
    // Some browser engines reject specific transfer MIME types; keep drag active.
  }
};

const resolveSigningTab = (itemType: MediaLibraryPanelItemType): MediaDataTab => {
  if (itemType === "videos") return "uploaded_videos";
  return "uploaded_images";
};

export const MediaLibraryPanel = React.memo(function MediaLibraryPanel({
  onSelectMedia,
  onSelectPrompt,
  projectName = null,
  onProjectNameCommit,
  resolveInternalDropItem,
  resolveCanvasDropReference,
}: MediaLibraryPanelProps) {
  const panelSurfaceConfig = getMediaLibrarySurfaceConfig("panel");
  const {
    folders,
    customFolders,
    orderedFolders,
    activeFolderId,
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
    deleteFolder,
  } = useMediaLibraryFoldersState();

  const isRootFolderSelected = activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const [rootTab, setRootTab] = useState<RootMediaLibraryTab>("all");
  const itemType: MediaLibraryPanelItemType = isRootFolderSelected ? rootTab : "all";

  const [error, setError] = useState<string | null>(null);
  const [, setMembershipMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName ?? "");

  const mediaDownloadInFlightRef = useRef<Record<string, boolean>>({});

  const panelBodyRef = useRef<HTMLDivElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const folderContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setProjectNameDraft(projectName ?? "");
  }, [projectName]);

  const adaptivePreviewQualityEnabled = isAdaptiveSurfaceEnabled("media-library-panel-grid");
  const mediaAdaptivePressure = useMediaAdaptivePressure({
    surface: "media-library-panel",
    enabled: adaptivePreviewQualityEnabled,
  });

  const normalizedSearch = "";
  const shouldShowMedia = itemType !== "prompts" && itemType !== "audio";
  const shouldShowPrompts = itemType === "prompts" || (!isRootFolderSelected && itemType === "all");
  const showFolderCanvas =
    activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID && shouldShowMedia && shouldShowPrompts;
  const {
    error: dataError,
    mediaRows,
    setMediaRows,
    libraryTotalCount,
    promptRows,
    setPromptRows,
    mediaHasMore,
    promptHasMore,
    mediaLoading,
    promptLoading,
    mediaScopeResolved,
    promptScopeResolved,
    loadMediaPage,
    loadPromptPage,
    refreshActiveRows,
  } = useMediaLibraryPanelDataController({
    activeFolderId,
    itemType,
    normalizedSearch,
    shouldShowMedia,
    shouldShowPrompts,
    showFolderCanvas,
    panelBodyRef,
  });
  const {
    pendingLibraryDelete,
    setPendingLibraryDelete,
    deleteConfirmSubmitting,
    resetDeleteConfirmState,
    closeDeleteConfirm,
    confirmDeleteFromLibrary,
    handleRemoveItemFromActiveFolder,
    handleAssignItemToActiveFolder,
    uploadDroppedFilesToFolder,
  } = useMediaLibraryPanelMutationController({
    activeFolderId,
    folders,
    refreshActiveRows,
    setFolderError,
    setMembershipMessage,
    setMediaRows,
    setPromptRows,
  });
  useAiStudioModalActivity("media-library-panel-delete-confirm", Boolean(pendingLibraryDelete));
  const visiblePromptRows = useMemo(() => sortByCreatedAtDesc(promptRows), [promptRows]);
  const visibleImageRows = useMemo(
    () => mediaRows.filter((row) => !isVideoFile(row.file_type)),
    [mediaRows]
  );
  const visibleVideoRows = useMemo(
    () => mediaRows.filter((row) => isVideoFile(row.file_type)),
    [mediaRows]
  );
  const activeMediaTab = useMemo<MediaDataTab | null>(() => {
    if (!shouldShowMedia || mediaRows.length === 0) return null;
    return resolveSigningTab(itemType);
  }, [itemType, mediaRows.length, shouldShowMedia]);
  const applySignedUrlsToMediaRows = useCallback(
    (_tab: MediaDataTab, signedById: Map<string, string>) => {
      if (!signedById.size) return;
      setMediaRows((previous) =>
        previous.map((row) => {
          const signedUrl = signedById.get(row.id);
          if (!signedUrl || row.signedUrl === signedUrl) return row;
          return { ...row, signedUrl };
        })
      );
    },
    [setMediaRows]
  );
  const previewRuntime = useMediaSurfacePreviewRuntime<MediaFileRow, MediaTab, HTMLButtonElement>({
    activeMediaQuery: normalizedSearch,
    activeTab: activeMediaTab ?? "saved_prompts",
    firstMediaPaintEventName: "media.modal.first_media_paint",
    previewProfile: panelSurfaceConfig.imageCardPreviewProfile,
    signBudgetResolver: panelSurfaceConfig.signBudgetResolver,
    surface: panelSurfaceConfig.listSurface,
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
  } = previewRuntime;
  const { folderCanvasDataReady, folderCanvasMediaRows } =
    useMediaLibraryPanelFolderCanvasController({
      currentUserIdRef,
      mediaRows,
      mediaScopeResolved,
      promptScopeResolved,
      showFolderCanvas,
      signStoragePath,
    });
  const foldersSplit = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef as React.MutableRefObject<HTMLElement | null>,
    defaultTopRatio: 0.3,
    minTopSectionHeightPx: 0,
    minTopRatioFloor: 0,
    minBottomSectionHeightPx: 240,
    allRefsSnapTopHeightPx: 120,
    collapseTopHeightPx: 86,
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
  }, [activeFolderId, itemType, normalizedSearch]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeFolderId, itemType]);

  useEffect(() => {
    setError(dataError);
  }, [dataError]);

  useEffect(() => {
    let cancelled = false;
    void readSupabaseUserId()
      .then((userId) => {
        if (cancelled) return;
        currentUserIdRef.current = userId;
      })
      .catch(() => {
        if (cancelled) return;
        currentUserIdRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserIdRef]);

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

  const {
    previewModalFile,
    previewModalUrl,
    previewModalLoading,
    previewModalError,
    handleSelectPromptCard,
    handleSelectMediaFile,
    handleMediaCardDoubleClick,
    handleMediaCardContextMenu,
    closePreviewModal,
  } = useMediaLibraryPanelSelectionController({
    activeFolderId,
    currentUserIdRef,
    onSelectMedia,
    onSelectPrompt,
    refreshSignedUrl,
    signStoragePath,
  });

  const handleSelectPromptCardWithSelection = useCallback(
    (prompt: PromptRow) => {
      setSelectedIds((prev) => {
        if (prev.has(prompt.id)) return prev;
        const next = new Set(prev);
        next.add(prompt.id);
        return next;
      });
      handleSelectPromptCard(prompt);
    },
    [handleSelectPromptCard]
  );

  const handleSelectMediaFileWithSelection = useCallback(
    async (file: MediaFileRow) => {
      setSelectedIds((prev) => {
        if (prev.has(file.id)) return prev;
        const next = new Set(prev);
        next.add(file.id);
        return next;
      });
      await handleSelectMediaFile(file);
    },
    [handleSelectMediaFile]
  );

  useMediaSurfacePreviewSigning<MediaFileRow, MediaTab>({
    runtime: previewRuntime,
    activeMediaTab,
    activeMediaCacheLoading: mediaLoading,
    activeMediaCachePagesLoaded: 1,
    filteredMedia: mediaRows,
    isSigningPassEnabled: shouldShowMedia,
    surface: "media-library-panel",
    unresolvedWarningPrefix: "[media-library-panel]",
    maxSignAttemptsPerItem: MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
    maxSignCandidatesPerRow: 4,
    isSignPrefetchEnabled: MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
  });

  useEffect(() => {
    resetDeleteConfirmState();
    closePreviewModal();
  }, [activeFolderId, closePreviewModal, resetDeleteConfirmState]);

  const foldersDropController = useMediaLibraryFolderDropController({
    folders,
    setFolderError,
    setMembershipMessage,
    refreshActiveRows,
    resolveInternalDropItem,
    onDropFilesToFolder: async (folderId, files) => {
      await uploadDroppedFilesToFolder({
        targetFolderId: folderId,
        files,
      });
    },
  });

  const handleMediaCardDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => {
      const signedUrl = (file.signedUrl ?? "").trim();
      if (!signedUrl) {
        event.preventDefault();
        return;
      }
      const dragDimensions = resolveMediaDragDimensions({
        fileType: file.file_type,
        width: file.width ?? null,
        height: file.height ?? null,
        metadata: file.metadata,
      });
      const promptText = resolveMediaMetadataPromptText(file.metadata) ?? file.filename ?? "";
      writeMediaLibraryDragPayload(event.dataTransfer, {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: file.id,
          url: signedUrl,
          fileType: isVideoFile(file.file_type) ? "video" : "image",
          originFolderId: activeFolderId,
          filename: file.filename,
          promptText,
          source: file.source ?? null,
          previewStoragePath: file.preview_storage_path ?? file.storage_path,
          fullStoragePath: file.storage_path,
          previewUrl: signedUrl,
          fullUrl: signedUrl,
          width: dragDimensions.width,
          height: dragDimensions.height,
        },
      });
      event.dataTransfer.effectAllowed = "copy";
      setTransferDataSafe(event.dataTransfer, "text/reference-url", signedUrl);
      setTransferDataSafe(event.dataTransfer, "text/uri-list", signedUrl);
      if (promptText.trim()) {
        setTransferDataSafe(event.dataTransfer, "text/prompt", promptText);
        setTransferDataSafe(event.dataTransfer, "text/plain", promptText);
      } else {
        setTransferDataSafe(event.dataTransfer, "text/plain", signedUrl);
      }
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: file.filename || "Media",
        detail: promptText,
        previewUrl: signedUrl,
        previewKind: isVideoFile(file.file_type) ? "video" : "image",
      });
    },
    [activeFolderId]
  );

  const handlePromptCardDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => {
      const promptText = prompt.prompt_text.trim();
      if (!promptText) {
        event.preventDefault();
        return;
      }
      writeMediaLibraryDragPayload(event.dataTransfer, {
        kind: "libraryPrompt",
        source: "mediaLibrary",
        payload: {
          id: prompt.id,
          promptText,
          originFolderId: activeFolderId,
          title: prompt.title,
        },
      });
      event.dataTransfer.effectAllowed = "copy";
      setTransferDataSafe(event.dataTransfer, "text/prompt", promptText);
      setTransferDataSafe(event.dataTransfer, "text/plain", promptText);
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: prompt.title || "Prompt",
        detail: promptText,
        previewKind: "text",
      });
    },
    [activeFolderId]
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove("is-dragging");
    clearMediaLibraryDragGhost(event);
  }, []);

  const resolveDownloadBlob = useCallback(async (file: MediaFileRow): Promise<Blob | null> => {
    const primaryStoragePath = (file.storage_path ?? "").trim();
    if (primaryStoragePath) {
      try {
        const supabase = ensureSupabaseQueryClient();
        const { data, error: downloadError } = await supabase.storage
          .from(BUCKET)
          .download(primaryStoragePath);
        if (!downloadError && data) {
          return data as Blob;
        }
      } catch {
        // Fall through to signed-url fetch fallback.
      }
    }
    const signedUrl = (file.signedUrl ?? "").trim();
    if (!signedUrl) return null;
    try {
      const response = await fetch(signedUrl, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.size) return null;
      return blob;
    } catch {
      return null;
    }
  }, []);

  const handleDownloadMediaFile = useCallback(
    (file: MediaFileRow) => {
      const filename = (file.filename ?? "media").trim() || "media";
      if (mediaDownloadInFlightRef.current[file.id]) return;
      mediaDownloadInFlightRef.current[file.id] = true;
      void resolveDownloadBlob(file)
        .then((blob) => {
          if (blob) {
            downloadBlobToFile(blob, filename);
            return;
          }
          const signedUrl = (file.signedUrl ?? "").trim();
          if (!signedUrl) return;
          const anchor = document.createElement("a");
          anchor.href = signedUrl;
          anchor.download = filename;
          anchor.rel = "noopener";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        })
        .finally(() => {
          mediaDownloadInFlightRef.current[file.id] = false;
        });
    },
    [resolveDownloadBlob]
  );

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
      setActiveFolderId(folder.id);
      const boundedX = Math.min(
        event.clientX,
        window.innerWidth - FOLDER_CONTEXT_MENU_WIDTH_PX - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
      );
      const boundedY = Math.min(
        event.clientY,
        window.innerHeight - FOLDER_CONTEXT_MENU_HEIGHT_PX - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
      );
      setFolderContextMenu({
        folderId: folder.id,
        folderName: folder.name,
        x: Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, boundedX),
        y: Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, boundedY),
      });
    },
    [setActiveFolderId]
  );

  const handleContextRename = useCallback(() => {
    if (!folderContextMenu) return;
    startFolderRename(folderContextMenu.folderId, folderContextMenu.folderName);
    setFolderContextMenu(null);
  }, [folderContextMenu, startFolderRename]);

  const handleContextDelete = useCallback(async () => {
    if (!folderContextMenu) return;
    const folderId = folderContextMenu.folderId;
    setFolderContextMenu(null);
    await deleteFolder(folderId);
  }, [deleteFolder, folderContextMenu]);

  const activeFolderName =
    orderedFolders.find((folder) => folder.id === activeFolderId)?.name || ROOT_FOLDER_LABEL;
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
      resolveMediaLibraryPanelCardPreviewUrl({
        signedUrl,
        fileType,
        pressureLevel,
        adaptivePreviewQualityEnabled: isAdaptivePreviewQualityEnabled,
        shouldBypassAdaptivePreview,
        cardLongEdgePx,
        devicePixelRatio,
        constantCompressionEnabled: MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED,
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
        onSelectMediaFile={(file) => {
          void handleSelectMediaFileWithSelection(file);
        }}
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
      handleSelectMediaFileWithSelection,
      mediaAdaptivePressure.previewPressureLevel,
      optimizerFallbackMediaIds,
      resolvePanelCardPreviewUrl,
      signedUrlRetryRef,
      setPendingLibraryDelete,
      selectedIds,
      activeFolderId,
    ]
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
              selectedIds={selectedIds}
              onSelectPromptCard={handleSelectPromptCardWithSelection}
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
      handleSelectPromptCardWithSelection,
      promptHasMore,
      promptLoading,
      selectedIds,
      setPendingLibraryDelete,
      visiblePromptRows,
      loadPromptPage,
    ]
  );

  const commitProjectName = useCallback(() => {
    onProjectNameCommit?.(projectNameDraft);
  }, [onProjectNameCommit, projectNameDraft]);

  return (
    <section className="media-library-panel" aria-label="Media library panel">
      <header className="media-library-panel-header">
        <div className="media-library-panel-header-title-group">
          <p className="eyebrow">Media</p>
        </div>
        <label className="media-library-panel-project-name-field">
          <span className="sr-only">Project name</span>
          <input
            type="text"
            value={projectNameDraft}
            onChange={(event) => setProjectNameDraft(event.target.value)}
            onBlur={commitProjectName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setProjectNameDraft(projectName ?? "");
                event.currentTarget.blur();
              }
            }}
            className="media-library-panel-project-name-input"
            placeholder="Untitled project"
            aria-label="Project name"
            maxLength={120}
          />
        </label>
      </header>

      <div ref={splitContainerRef} className="media-library-panel-split">
        <div className="media-library-panel-folders-panel" style={foldersSplit.topSectionStyle}>
          <MediaLibraryPanelFoldersSection
            folders={customFolders}
            activeFolderId={activeFolderId}
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
            onFolderDragOver={foldersDropController.handleFolderDragOver}
            onFolderDragLeave={foldersDropController.handleFolderDragLeave}
            onFolderDrop={foldersDropController.handleFolderDrop}
            folderContextMenu={folderContextMenu}
            folderContextMenuRef={folderContextMenuRef}
            openFolderContextMenu={openFolderContextMenu}
            onContextRename={handleContextRename}
            onContextDelete={handleContextDelete}
          />
        </div>

        <div
          className="reference-grid-horizontal-divider-wrap media-library-panel-horizontal-divider-wrap"
          {...foldersSplit.dividerProps}
        >
          <div className="reference-grid-horizontal-divider" />
        </div>

        <div className="media-library-panel-content-panel" style={foldersSplit.bottomSectionStyle}>
          <div className="media-library-panel-body" ref={panelBodyRef}>
            {error ? <p className="tiny subdued">{error}</p> : null}

            {showFolderCanvas && !folderCanvasDataReady ? (
              <p className="tiny subdued">Loading folder canvas...</p>
            ) : null}

            {showFolderCanvas && folderCanvasDataReady ? (
              <MediaLibraryFolderCanvas
                folderId={activeFolderId}
                mediaRows={folderCanvasMediaRows}
                promptRows={visiblePromptRows}
                onSelectMedia={onSelectMedia}
                onSelectPrompt={onSelectPrompt}
                onUnassignItem={handleRemoveItemFromActiveFolder}
                resolveCanvasDropReference={resolveCanvasDropReference}
                resolveInternalDropItem={resolveInternalDropItem}
                onAssignDroppedItem={handleAssignItemToActiveFolder}
                onDropFilesToCanvas={async (files) =>
                  await uploadDroppedFilesToFolder({
                    targetFolderId: activeFolderId,
                    files,
                  })
                }
              />
            ) : null}

            {!showFolderCanvas && shouldShowPrompts && !isRootFolderSelected
              ? renderPromptsSection()
              : null}

            {!showFolderCanvas && isRootFolderSelected ? (
              <div className="media-library-panel-root-tabs-row">
                {libraryTotalCount !== null ? (
                  <div
                    className="media-library-panel-root-count"
                    aria-label={`${libraryTotalCount} saved media items`}
                  >
                    <span className="media-library-panel-root-count-value">
                      {libraryTotalCount}
                    </span>
                    <span className="media-library-panel-root-count-label">saved</span>
                  </div>
                ) : null}
                <div
                  className="media-library-panel-root-tabs"
                  role="tablist"
                  aria-label="All Media type tabs"
                >
                  <button
                    type="button"
                    role="tab"
                    className={`media-library-panel-root-tab${rootTab === "all" ? " is-active" : ""}`}
                    aria-selected={rootTab === "all"}
                    aria-controls="media-library-panel-all-media-section"
                    onClick={() => setRootTab("all")}
                  >
                    All Media
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`media-library-panel-root-tab${rootTab === "images" ? " is-active" : ""}`}
                    aria-selected={rootTab === "images"}
                    aria-controls="media-library-panel-images-section"
                    onClick={() => setRootTab("images")}
                  >
                    Images
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`media-library-panel-root-tab${rootTab === "videos" ? " is-active" : ""}`}
                    aria-selected={rootTab === "videos"}
                    aria-controls="media-library-panel-videos-section"
                    onClick={() => setRootTab("videos")}
                  >
                    Videos
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`media-library-panel-root-tab${rootTab === "audio" ? " is-active" : ""}`}
                    aria-selected={rootTab === "audio"}
                    aria-controls="media-library-panel-audio-section"
                    onClick={() => setRootTab("audio")}
                  >
                    Audio
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`media-library-panel-root-tab${rootTab === "prompts" ? " is-active" : ""}`}
                    aria-selected={rootTab === "prompts"}
                    aria-controls="media-library-panel-prompts-section"
                    onClick={() => setRootTab("prompts")}
                  >
                    Prompts
                  </button>
                </div>
              </div>
            ) : null}

            {!showFolderCanvas && shouldShowMedia && isRootFolderSelected && itemType === "all" ? (
              <section className="media-library-panel-section">
                {mediaLoading && mediaRows.length === 0 ? (
                  <p className="tiny subdued">Loading media…</p>
                ) : null}
                {!mediaLoading && mediaRows.length === 0 ? (
                  <p className="tiny subdued">No media found for this folder.</p>
                ) : null}
                <div id="media-library-panel-all-media-section">
                  {mediaRows.length > 0 ? renderMediaGrid(mediaRows) : null}
                </div>
              </section>
            ) : null}

            {!showFolderCanvas &&
            shouldShowMedia &&
            isRootFolderSelected &&
            itemType === "images" ? (
              <>
                <section className="media-library-panel-section">
                  {mediaLoading && mediaRows.length === 0 ? (
                    <p className="tiny subdued">Loading images…</p>
                  ) : null}
                  {!mediaLoading && visibleImageRows.length === 0 ? (
                    <p className="tiny subdued">No images found for this folder.</p>
                  ) : null}
                  <div id="media-library-panel-images-section">
                    {visibleImageRows.length > 0 ? renderMediaGrid(visibleImageRows) : null}
                  </div>
                </section>
              </>
            ) : null}

            {!showFolderCanvas &&
            shouldShowMedia &&
            isRootFolderSelected &&
            itemType === "videos" ? (
              <>
                <section className="media-library-panel-section">
                  {mediaLoading && mediaRows.length === 0 ? (
                    <p className="tiny subdued">Loading videos…</p>
                  ) : null}
                  {!mediaLoading && visibleVideoRows.length === 0 ? (
                    <p className="tiny subdued">No videos found for this folder.</p>
                  ) : null}
                  <div id="media-library-panel-videos-section">
                    {visibleVideoRows.length > 0 ? renderMediaGrid(visibleVideoRows) : null}
                  </div>
                </section>
              </>
            ) : null}

            {!showFolderCanvas && shouldShowPrompts && isRootFolderSelected
              ? renderPromptsSection({ showHeading: false })
              : null}

            {!showFolderCanvas && isRootFolderSelected && itemType === "audio" ? (
              <section className="media-library-panel-section">
                <div id="media-library-panel-audio-section">
                  <p className="tiny subdued">Audio browsing is not available yet.</p>
                </div>
              </section>
            ) : null}

            {!showFolderCanvas && shouldShowMedia && isRootFolderSelected ? (
              <section
                className="media-library-panel-section media-library-panel-root-paginator"
                data-testid="media-library-panel-root-media-paginator"
              >
                <div className="media-load-more media-load-more-inline">
                  <p className="tiny subdued">
                    Loaded {mediaRows.length}{" "}
                    {mediaRows.length === 1 ? "media item" : "media items"}
                    {mediaHasMore ? "." : " (all loaded)."}
                  </p>
                  {mediaHasMore ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        void loadMediaPage({ reset: false });
                      }}
                      disabled={mediaLoading}
                    >
                      {mediaLoading ? "Loading more..." : "Load more media"}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {!showFolderCanvas && shouldShowMedia && !isRootFolderSelected ? (
              <section className="media-library-panel-section">
                <div className="media-library-panel-section-head">
                  <p className="tiny subdued">
                    Media ({mediaRows.length})
                    {mediaLoading && mediaRows.length > 0 ? " · Refreshing" : ""}
                  </p>
                </div>
                {mediaLoading && mediaRows.length === 0 ? (
                  <p className="tiny subdued">Loading media…</p>
                ) : null}
                {!mediaLoading && mediaRows.length === 0 ? (
                  <p className="tiny subdued">No media found for this folder.</p>
                ) : null}
                <div id="media-library-panel-media-section">
                  {mediaRows.length > 0 ? renderMediaGrid(mediaRows) : null}
                  {mediaHasMore ? (
                    <div className="media-load-more">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          void loadMediaPage({ reset: false });
                        }}
                        disabled={mediaLoading}
                      >
                        {mediaLoading ? "Loading more..." : "Load more media"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
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
        file={previewModalFile}
        previewUrl={previewModalUrl}
        isLoading={previewModalLoading}
        error={previewModalError}
        onClose={closePreviewModal}
      />
      {pendingLibraryDelete ? (
        <AiStudioModalLayer>
          <div className="art-confirm-backdrop" onClick={closeDeleteConfirm}>
            <div
              className="art-confirm-card"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm delete from All Media"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="art-confirm-title">Delete from All Media?</p>
              <p className="art-confirm-copy">
                {pendingLibraryDelete.kind === "media"
                  ? "This permanently deletes the selected media from your library."
                  : "This permanently deletes the selected prompt from your library."}
              </p>
              <div className="art-confirm-actions">
                <button
                  type="button"
                  className="art-action-btn"
                  onClick={closeDeleteConfirm}
                  disabled={deleteConfirmSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="art-action-btn art-action-btn-danger"
                  onClick={() => {
                    void confirmDeleteFromLibrary();
                  }}
                  disabled={deleteConfirmSubmitting}
                >
                  {deleteConfirmSubmitting ? "Deleting..." : "Yes, delete"}
                </button>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
});
