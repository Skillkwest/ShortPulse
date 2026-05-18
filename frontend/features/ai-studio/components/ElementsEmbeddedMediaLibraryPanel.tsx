import React from "react";
import { FolderSimple } from "phosphor-react";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import { MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM } from "../../../lib/mediaPreviewRuntimePolicy";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import { useMediaSurfacePreviewSigning } from "../../media-library/hooks/useMediaSurfacePreviewSigning";
import { useMediaSurfacePreviewRuntime } from "../../media-library/hooks/useMediaSurfacePreviewRuntime";
import { MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED } from "../../media-library/logic/mediaLibraryRuntimeConfig";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../media-library/logic/mediaLibraryAdaptivePreview";
import {
  BUCKET,
  getMediaDataTabForRow,
  isAudioFile,
  isImageFile,
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
import {
  getMediaLibrarySurfaceConfig,
  resolvePanelMixedAllMediaSignBudget,
} from "../../media-library/runtime";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../logic/mediaLibraryPanelApi";
import { resolveMediaDragDimensions } from "../logic/mediaLibraryAspectRatio";
import {
  attachMediaLibraryDragGhost,
  clearMediaLibraryDragGhost,
} from "../logic/mediaLibraryDragGhost";
import { writeMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import { downloadBlobToFile } from "../logic/referenceDownload";
import { useMediaLibraryPanelDataController } from "../hooks/useMediaLibraryPanelDataController";
import { useMediaLibraryFolderDropController } from "../hooks/useMediaLibraryFolderDropController";
import { useMediaLibraryPanelMutationController } from "../hooks/useMediaLibraryPanelMutationController";
import {
  useMediaLibraryPanelSelectionController,
  type MediaLibrarySelectionPayload,
} from "../hooks/useMediaLibraryPanelSelectionController";
import { MediaLibraryPanelBulkActions } from "./MediaLibraryPanelBulkActions";
import { MediaLibraryPanelDialogs } from "./MediaLibraryPanelDialogs";
import { MediaLibraryPanelRootContent } from "./MediaLibraryPanelRootContent";
import { MediaLibraryPanelStatusArea } from "./MediaLibraryPanelStatusArea";
import { MediaLibraryAllItemsGrid } from "./media-library-modal/MediaLibraryAllItemsGrid";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryPanelPreviewModal } from "./media-library-modal/MediaLibraryPanelPreviewModal";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";
import { useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type ElementsEmbeddedMediaLibraryPanelProps = {
  projectId?: string | null;
  resolveInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  mediaCardInteractionMode?: "selection" | "assignment";
  onSelectMedia?: (payload: MediaLibrarySelectionPayload) => void;
};

const MEMBERSHIP_MESSAGE_TIMEOUT_MS = 1800;
type RootMediaLibraryTab = "all" | "images" | "videos" | "audio" | "prompts";
const EMPTY_SET = new Set<string>();

export function ElementsEmbeddedMediaLibraryPanel({
  projectId = null,
  resolveInternalDropItem,
  mediaCardInteractionMode = "selection",
  onSelectMedia,
}: ElementsEmbeddedMediaLibraryPanelProps) {
  const activeFolderId = MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const [rootTab, setRootTab] = React.useState<RootMediaLibraryTab>("all");
  const [folderError, setFolderError] = React.useState<string | null>(null);
  const [membershipMessage, setMembershipMessage] = React.useState<string | null>(null);
  const [membershipPendingMessage, setMembershipPendingMessage] = React.useState<string | null>(
    null
  );
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [selectedPromptIds, setSelectedPromptIds] = React.useState<Set<string>>(new Set());
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = React.useState<string[] | null>(null);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = React.useState<Set<string>>(
    new Set()
  );
  const [rootFileInputResetKey, setRootFileInputResetKey] = React.useState(0);
  const panelBodyRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const mediaDownloadInFlightRef = React.useRef<Record<string, boolean>>({});
  const bulkMoveDialogOpen = false;
  const adaptivePreviewQualityEnabled = isAdaptiveSurfaceEnabled("media-library-panel-grid");
  const panelSurfaceConfig = getMediaLibrarySurfaceConfig("panel");
  const mediaAdaptivePressure = useMediaAdaptivePressure({
    surface: "media-library-panel",
    enabled: adaptivePreviewQualityEnabled,
  });

  const normalizedSearch = "";
  const itemType = rootTab;
  const shouldShowMedia = itemType !== "prompts";
  const shouldShowPrompts = itemType === "prompts" || itemType === "all";
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
  });

  const refreshFolders = React.useCallback(async () => undefined, []);

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
    uploadDroppedFilesToFolder,
  } = useMediaLibraryPanelMutationController({
    projectId,
    activeFolderId,
    folders: [],
    refreshActiveRows,
    refreshFolders,
    setFolderError,
    setMembershipMessage,
    setMediaRows,
    setPromptRows,
  });

  useAiStudioModalActivity(
    "elements-media-library-delete-confirm",
    Boolean(pendingLibraryDelete || pendingBulkDeleteIds)
  );

  const visiblePromptRows = React.useMemo(() => sortByCreatedAtDesc(promptRows), [promptRows]);
  const visibleImageRows = React.useMemo(
    () => mediaRows.filter((row) => isImageFile(row.file_type)),
    [mediaRows]
  );
  const visibleVideoRows = React.useMemo(
    () => mediaRows.filter((row) => isVideoFile(row.file_type)),
    [mediaRows]
  );
  const visibleAudioRows = React.useMemo(
    () => mediaRows.filter((row) => isAudioFile(row.file_type)),
    [mediaRows]
  );
  const signableMediaRows = React.useMemo(
    () => (itemType === "all" ? mediaRows.filter((row) => !isAudioFile(row.file_type)) : mediaRows),
    [itemType, mediaRows]
  );
  const activeMediaTab = React.useMemo<MediaDataTab | null>(() => {
    if (!shouldShowMedia || mediaRows.length === 0) return null;
    return itemType === "videos" ? "uploaded_videos" : "uploaded_images";
  }, [itemType, mediaRows.length, shouldShowMedia]);

  const applySignedUrlsToMediaRows = React.useCallback(
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
  const signBudgetOverride = React.useMemo(
    () =>
      itemType === "all"
        ? resolvePanelMixedAllMediaSignBudget(previewRuntime.signBudget)
        : undefined,
    [itemType, previewRuntime.signBudget]
  );

  useVisibleErrorTelemetry({
    source: "client.ai_studio.elements_media_library_error",
    scope: "app",
    severity: "medium",
    message: dataError || folderError,
    metadata: {
      item_type: itemType,
      has_media_rows: mediaRows.length > 0,
      has_prompt_rows: promptRows.length > 0,
    },
  });

  React.useEffect(() => {
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

  React.useEffect(() => {
    signAttemptRef.current = {};
    setOptimizerFallbackMediaIds(new Set());
  }, [itemType, normalizedSearch, signAttemptRef]);

  React.useEffect(() => {
    setSelectedIds(new Set());
    setSelectedPromptIds(new Set());
    setPendingBulkDeleteIds(null);
  }, [itemType]);

  React.useEffect(() => {
    setFolderError(dataError);
  }, [dataError]);

  React.useEffect(() => {
    if (!membershipMessage) return;
    const timeout = window.setTimeout(() => {
      setMembershipMessage(null);
    }, MEMBERSHIP_MESSAGE_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [membershipMessage]);

  React.useEffect(() => {
    resetDeleteConfirmState();
    setPendingBulkDeleteIds(null);
  }, [itemType, resetDeleteConfirmState]);

  const handleNoopMediaSelect = React.useCallback(() => undefined, []);
  const {
    previewModalFile,
    previewModalUrl,
    previewModalLoading,
    previewModalError,
    handleSelectMediaFile,
    handleMediaCardDoubleClick,
    handleMediaCardContextMenu,
    closePreviewModal,
  } = useMediaLibraryPanelSelectionController({
    activeFolderId,
    currentUserIdRef,
    onSelectMedia: onSelectMedia ?? handleNoopMediaSelect,
    refreshSignedUrl,
    signStoragePath,
  });
  const mediaCardUsesAssignment = mediaCardInteractionMode === "assignment";
  const activeSelectedMediaIds = mediaCardUsesAssignment ? EMPTY_SET : selectedIds;

  React.useEffect(() => {
    closePreviewModal();
  }, [closePreviewModal, itemType]);

  const handleToggleSelectedPrompt = React.useCallback((prompt: PromptRow) => {
    setPendingBulkDeleteIds(null);
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

  const handleToggleSelectedMedia = React.useCallback((file: MediaFileRow) => {
    setPendingBulkDeleteIds(null);
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

  const combinedSelectedIds = React.useMemo(() => {
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
    activeMediaCachePagesLoaded: 1,
    activeMediaQuery: normalizedSearch,
    filteredMedia: signableMediaRows,
    signBudgetOverride,
    isSigningPassEnabled: shouldShowMedia,
    surface: "media-library-panel",
    unresolvedWarningPrefix: "[elements-media-library]",
    maxSignAttemptsPerItem: MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
    maxSignCandidatesPerRow: 4,
    isSignPrefetchEnabled: MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
  });

  const foldersDropController = useMediaLibraryFolderDropController({
    projectId,
    folders: [],
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

  const handleMediaCardDragStart = React.useCallback(
    (event: React.DragEvent<HTMLElement>, file: MediaFileRow) => {
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
          fileType: isAudioFile(file.file_type)
            ? "audio"
            : isVideoFile(file.file_type)
              ? "video"
              : "image",
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
      try {
        event.dataTransfer.setData("text/reference-url", signedUrl);
        event.dataTransfer.setData("text/uri-list", signedUrl);
        event.dataTransfer.setData("text/plain", promptText.trim() || signedUrl);
        if (promptText.trim()) {
          event.dataTransfer.setData("text/prompt", promptText);
        }
      } catch {
        // Keep drag active even when a specific transfer mime is rejected.
      }
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: file.filename || "Media",
        detail: promptText,
        previewUrl: signedUrl,
        previewKind: isVideoFile(file.file_type)
          ? "video"
          : isAudioFile(file.file_type)
            ? "text"
            : "image",
      });
    },
    [activeFolderId]
  );

  const handlePromptCardDragStart = React.useCallback(
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
      try {
        event.dataTransfer.setData("text/prompt", promptText);
        event.dataTransfer.setData("text/plain", promptText);
      } catch {
        // Keep drag active even when a specific transfer mime is rejected.
      }
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: prompt.title || "Prompt",
        detail: promptText,
        previewKind: "text",
      });
    },
    [activeFolderId]
  );

  const handleCardDragEnd = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.currentTarget.classList.remove("is-dragging");
    clearMediaLibraryDragGhost(event);
  }, []);

  const resolveDownloadBlob = React.useCallback(
    async (file: MediaFileRow): Promise<Blob | null> => {
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
    },
    []
  );

  const handleDownloadMediaFile = React.useCallback(
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

  const resolvePanelCardPreviewUrl = React.useCallback(
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

  const renderMediaGrid = React.useCallback(
    (rows: MediaFileRow[]) => (
      <MediaLibraryMediaGrid
        activeMedia={rows}
        selectedIds={activeSelectedMediaIds}
        optimizerFallbackMediaIds={optimizerFallbackMediaIds}
        adaptivePressureLevel={mediaAdaptivePressure.previewPressureLevel}
        adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
        resolveCardPreviewUrl={resolvePanelCardPreviewUrl}
        scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
        getMediaCardRef={getMediaCardRef}
        onSelectMediaFile={
          mediaCardUsesAssignment ? handleSelectMediaFile : handleToggleSelectedMedia
        }
        onToggleMediaSelection={mediaCardUsesAssignment ? undefined : handleToggleSelectedMedia}
        onMediaDoubleClick={handleMediaCardDoubleClick}
        onMediaDragStart={handleMediaCardDragStart}
        onMediaDragEnd={handleCardDragEnd}
        onMediaContextMenu={handleMediaCardContextMenu}
        showDeleteAction
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
        visibleMediaIdsRef={previewRuntime.visibleMediaIdsRef}
      />
    ),
    [
      adaptivePreviewQualityEnabled,
      activeSelectedMediaIds,
      getMediaCardRef,
      handleCardDragEnd,
      handleDownloadMediaFile,
      handleMediaCardContextMenu,
      handleMediaCardDoubleClick,
      handleMediaCardDragStart,
      handleMediaPreviewError,
      handleSelectMediaFile,
      handleToggleSelectedMedia,
      mediaCardUsesAssignment,
      mediaAdaptivePressure.previewPressureLevel,
      optimizerFallbackMediaIds,
      resolvePanelCardPreviewUrl,
      setPendingLibraryDelete,
      signedUrlRetryRef,
      previewRuntime.visibleMediaIdsRef,
    ]
  );

  const renderAllItemsGrid = React.useCallback(
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
        onSelectMediaFile={
          mediaCardUsesAssignment ? handleSelectMediaFile : handleToggleSelectedMedia
        }
        onToggleMediaSelection={mediaCardUsesAssignment ? undefined : handleToggleSelectedMedia}
        onSelectPromptCard={handleToggleSelectedPrompt}
        onMediaDoubleClick={handleMediaCardDoubleClick}
        onMediaDragStart={handleMediaCardDragStart}
        onPromptDragStart={handlePromptCardDragStart}
        onMediaDragEnd={handleCardDragEnd}
        onPromptDragEnd={handleCardDragEnd}
        onMediaContextMenu={handleMediaCardContextMenu}
        onRequestSignedUrl={refreshSignedUrl}
        showDeleteAction
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
        visibleMediaIdsRef={previewRuntime.visibleMediaIdsRef}
      />
    ),
    [
      adaptivePreviewQualityEnabled,
      combinedSelectedIds,
      getMediaCardRef,
      handleCardDragEnd,
      handleDownloadMediaFile,
      handleMediaCardContextMenu,
      handleMediaCardDoubleClick,
      handleMediaCardDragStart,
      handleMediaPreviewError,
      handleSelectMediaFile,
      handlePromptCardDragStart,
      handleToggleSelectedMedia,
      handleToggleSelectedPrompt,
      mediaCardUsesAssignment,
      mediaAdaptivePressure.previewPressureLevel,
      mediaRows,
      optimizerFallbackMediaIds,
      refreshSignedUrl,
      resolvePanelCardPreviewUrl,
      setPendingLibraryDelete,
      signedUrlRetryRef,
      visiblePromptRows,
      previewRuntime.visibleMediaIdsRef,
    ]
  );

  const renderAudioGrid = React.useCallback(
    () => renderAllItemsGrid({ gridMediaRows: visibleAudioRows, gridPromptRows: [] }),
    [renderAllItemsGrid, visibleAudioRows]
  );

  const renderPromptsSection = React.useCallback(
    () => (
      <section className="media-library-panel-section">
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
              showDeleteAction
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
      handleCardDragEnd,
      handlePromptCardDragStart,
      handleToggleSelectedPrompt,
      loadPromptPage,
      promptHasMore,
      promptLoading,
      selectedPromptIds,
      setPendingLibraryDelete,
      visiblePromptRows,
    ]
  );

  const bulkVisibleMediaRows = React.useMemo(() => {
    if (!shouldShowMedia) return [] as MediaFileRow[];
    if (itemType === "images") return visibleImageRows;
    if (itemType === "videos") return visibleVideoRows;
    if (itemType === "audio") return visibleAudioRows;
    if (itemType === "all") return mediaRows;
    return [];
  }, [itemType, mediaRows, shouldShowMedia, visibleAudioRows, visibleImageRows, visibleVideoRows]);

  const selectedVisibleMediaRows = React.useMemo(() => {
    if (!selectedIds.size) return [] as MediaFileRow[];
    return bulkVisibleMediaRows.filter((row) => selectedIds.has(row.id));
  }, [bulkVisibleMediaRows, selectedIds]);

  React.useEffect(() => {
    if (!selectedIds.size) return;
    const visibleIdSet = new Set(bulkVisibleMediaRows.map((row) => row.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [bulkVisibleMediaRows, selectedIds.size]);

  const handleOpenBulkDeleteConfirm = React.useCallback(() => {
    if (!selectedVisibleMediaRows.length) return;
    setPendingBulkDeleteIds(selectedVisibleMediaRows.map((row) => row.id));
  }, [selectedVisibleMediaRows]);

  const handleCloseBulkDeleteConfirm = React.useCallback(() => {
    setPendingBulkDeleteIds(null);
  }, []);

  const handleConfirmBulkDelete = React.useCallback(async () => {
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

  const clearSelections = React.useCallback(() => {
    setPendingBulkDeleteIds(null);
    setSelectedIds(new Set());
    setSelectedPromptIds(new Set());
  }, []);

  const bulkActions = React.useMemo(
    () => (
      <MediaLibraryPanelBulkActions
        canDeleteFromLibrary
        canMoveToFolder={false}
        canRemoveFromFolder={false}
        disabled={deleteConfirmSubmitting}
        onClearSelection={clearSelections}
        onMoveToFolder={() => undefined}
        onDeleteFromLibrary={handleOpenBulkDeleteConfirm}
        onRemoveFromFolder={() => undefined}
        selectedCount={selectedVisibleMediaRows.length}
      />
    ),
    [
      clearSelections,
      deleteConfirmSubmitting,
      handleOpenBulkDeleteConfirm,
      selectedVisibleMediaRows.length,
    ]
  );

  const isRootFolderDropHover =
    foldersDropController.hoveredContentFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const rootFolderDropZoneProps = {
    onDragOver: (event: React.DragEvent<HTMLElement>) =>
      foldersDropController.handleFolderContentDragOver(MEDIA_LIBRARY_ROOT_FOLDER_ID, event),
    onDragLeave: () =>
      foldersDropController.handleFolderContentDragLeave(MEDIA_LIBRARY_ROOT_FOLDER_ID),
    onDrop: (event: React.DragEvent<HTMLElement>) => {
      void foldersDropController.handleFolderContentDrop(MEDIA_LIBRARY_ROOT_FOLDER_ID, event);
    },
  };

  const handleOpenRootUploadPicker = React.useCallback(() => {
    if (isStorageQuotaBlocked) return;
    fileInputRef.current?.click();
  }, [isStorageQuotaBlocked]);

  const handleRootUploadSelection = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) {
        setRootFileInputResetKey((current) => current + 1);
        return;
      }
      await uploadDroppedFilesToFolder({
        targetFolderId: MEDIA_LIBRARY_ROOT_FOLDER_ID,
        files,
      }).catch((uploadError) => {
        setFolderError(
          uploadError instanceof Error ? uploadError.message : "Unable to upload files."
        );
      });
      setRootFileInputResetKey((current) => current + 1);
    },
    [uploadDroppedFilesToFolder]
  );
  const renderRootAllItemsGrid = React.useCallback(
    () => renderAllItemsGrid(),
    [renderAllItemsGrid]
  );
  const renderRootImageGrid = React.useCallback(
    () => renderMediaGrid(visibleImageRows),
    [renderMediaGrid, visibleImageRows]
  );
  const renderRootVideoGrid = React.useCallback(
    () => renderMediaGrid(visibleVideoRows),
    [renderMediaGrid, visibleVideoRows]
  );

  return (
    <section
      className="media-library-panel elements-embedded-media-library-panel"
      aria-label="Elements media library panel"
      data-surface="elements-media-panel"
    >
      <input
        key={rootFileInputResetKey}
        ref={fileInputRef}
        type="file"
        multiple
        disabled={isStorageQuotaBlocked}
        className="media-library-panel-file-input"
        onChange={(event) => {
          void handleRootUploadSelection(event);
        }}
      />

      <div className="media-library-panel-content-panel elements-embedded-media-library-content">
        <div className="media-library-panel-body" ref={panelBodyRef}>
          <MediaLibraryPanelStatusArea
            error={folderError}
            membershipPendingMessage={membershipPendingMessage}
            membershipMessage={membershipMessage}
            storageQuotaMessage={storageQuotaMessage}
          />
          <MediaLibraryPanelRootContent
            rootTab={rootTab}
            setRootTab={setRootTab}
            libraryTotalCount={libraryTotalCount}
            showExpandCollapseButton={false}
            isMediaLibraryPanelExpanded={false}
            onExpandMediaLibraryPanel={() => undefined}
            onCollapseMediaLibraryPanel={() => undefined}
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
            renderPromptsSection={renderPromptsSection}
            mediaHasMore={mediaHasMore}
            loadMediaPage={loadMediaPage}
          />

          <footer className="media-library-panel-footer">
            <p className="tiny subdued media-library-panel-footer-folder-label">
              <FolderSimple size={13} weight="fill" aria-hidden />
              <span>All Media</span>
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
      <MediaLibraryPanelDialogs
        pendingBulkDeleteIds={pendingBulkDeleteIds}
        onCloseBulkDeleteConfirm={handleCloseBulkDeleteConfirm}
        onConfirmBulkDelete={() => {
          void handleConfirmBulkDelete();
        }}
        bulkMoveDialogOpen={bulkMoveDialogOpen}
        selectedVisibleMediaCount={selectedVisibleMediaRows.length}
        bulkMoveDestinationOptions={[]}
        onCloseBulkMoveDialog={() => undefined}
        onMoveSelectedMediaToFolder={() => undefined}
        pendingLibraryDelete={pendingLibraryDelete}
        onCloseDeleteConfirm={closeDeleteConfirm}
        onConfirmDeleteFromLibrary={() => {
          void confirmDeleteFromLibrary();
        }}
        moveFolderPicker={null}
        moveFolderCurrentParentLabel="All Media"
        moveFolderDestinationOptions={[]}
        onCloseMoveFolderPicker={() => undefined}
        onMoveFolderToDestination={() => undefined}
      />
    </section>
  );
}
