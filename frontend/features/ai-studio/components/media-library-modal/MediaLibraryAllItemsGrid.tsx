import React, { type MutableRefObject } from "react";
import { resolveMediaRowKind } from "../../../../lib/mediaRowKind";
import { useMediaGridVideoBudgetController } from "../../../media-library/hooks/useMediaGridVideoBudgetController";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../../media-library/logic/mediaLibraryAdaptivePreview";
import {
  MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
  MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
  type MediaLibraryGridDensityConfig,
} from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import {
  MEDIA_AUDIO_CARD_ASPECT_RATIO,
  resolveMediaCardAspectRatio,
} from "../../logic/mediaLibraryAspectRatio";
import { resolveVideoPosterSourceUrl } from "../../logic/mediaVideoBrowsePreview";
import { useMediaVideoBrowsePreviewUrls } from "../../hooks/useMediaVideoBrowsePreviewUrls";
import { isVideoUrl } from "../../logic/stateParsers";
import {
  MediaLibraryAudioCard,
  MediaLibraryVisualMediaCard,
  buildMediaLibraryCardActionLabels,
  canShowMediaLibraryRerollAction,
  resolveMediaLibraryCardDisplayLabel,
  type MediaLibraryMediaDragPreview,
} from "./MediaLibraryMediaCard";
import { MediaLibraryPromptReferenceCard } from "./MediaLibraryPromptReferenceCard";
import { useMediaAspectRatioCache } from "./useMediaAspectRatioCache";
import {
  createdAtTime,
  type MediaCardRefCallback,
  type MediaFileRow,
  type PromptRow,
} from "../../logic/mediaLibraryModalModel";

type ResolveMediaLibraryGridPreviewUrlArgs = {
  signedUrl: string | null | undefined;
  fileType?: string | null;
  pressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  shouldBypassAdaptivePreview?: boolean;
  cardLongEdgePx?: number;
  devicePixelRatio?: number;
};

type MediaLibraryAllItemsGridProps = {
  mediaRows: MediaFileRow[];
  promptRows: PromptRow[];
  selectedIds: Set<string>;
  optimizerFallbackMediaIds: Set<string>;
  adaptivePressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  resolveCardPreviewUrl?: (args: ResolveMediaLibraryGridPreviewUrlArgs) => string | null;
  scrollContainerRef?: MutableRefObject<HTMLElement | null>;
  getMediaCardRef: (fileId: string) => MediaCardRefCallback;
  onSelectMediaFile: (file: MediaFileRow) => void;
  onSelectPromptCard: (prompt: PromptRow) => void;
  onMediaDoubleClick?: (file: MediaFileRow) => void;
  onPromptDoubleClick?: (prompt: PromptRow) => void;
  onMediaDragStart?: (
    event: React.DragEvent<HTMLElement>,
    file: MediaFileRow,
    preview?: MediaLibraryMediaDragPreview
  ) => void;
  onPromptDragStart?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onMediaDragEnd?: (event: React.DragEvent<HTMLElement>, file: MediaFileRow) => void;
  onPromptDragEnd?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onToggleMediaSelection?: (file: MediaFileRow) => void;
  showRemoveAction?: boolean;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onRemovePromptFromFolder?: (prompt: PromptRow) => void;
  showDeleteAction?: boolean;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
  onDeletePromptFromLibrary?: (prompt: PromptRow) => void;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onRerollWorkflowFromMedia?: (file: MediaFileRow) => void;
  onMediaContextMenu?: (event: React.MouseEvent<HTMLElement>, file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
  onRequestSignedUrl?: (file: MediaFileRow) => Promise<string | null>;
  currentUserId?: string | null;
  visibleMediaIdsRef?: MutableRefObject<Set<string>>;
  visibleMediaVersion?: number;
  signedPosterUrlById?: Record<string, string>;
  signedVideoUrlById?: Record<string, string>;
  surface?:
    | "media-library-modal"
    | "media-library-panel"
    | "elements-media-panel"
    | "character-media-panel";
  densityConfig?: MediaLibraryGridDensityConfig;
  preferVisualMediaFirst?: boolean;
  visualMediaPriorityCount?: number;
  fixedVisualAspectRatio?: number | null;
};

export type { MediaLibraryMediaDragPreview } from "./MediaLibraryMediaCard";

type MediaLibraryAllItem =
  | { key: string; kind: "media"; id: string; createdAt: number; row: MediaFileRow }
  | { key: string; kind: "prompt"; id: string; createdAt: number; row: PromptRow };

const PROMPT_CARD_ASPECT_RATIO = 4 / 5;

export function MediaLibraryAllItemsGrid({
  mediaRows,
  promptRows,
  selectedIds,
  optimizerFallbackMediaIds,
  adaptivePressureLevel,
  adaptivePreviewQualityEnabled,
  resolveCardPreviewUrl,
  scrollContainerRef,
  getMediaCardRef,
  onSelectMediaFile,
  onSelectPromptCard,
  onMediaDoubleClick,
  onPromptDoubleClick,
  onMediaDragStart,
  onPromptDragStart,
  onMediaDragEnd,
  onPromptDragEnd,
  onToggleMediaSelection,
  showRemoveAction = false,
  onRemoveMediaFromFolder,
  onRemovePromptFromFolder,
  showDeleteAction = false,
  onDeleteMediaFromLibrary,
  onDeletePromptFromLibrary,
  onDownloadMediaFile,
  onRerollWorkflowFromMedia,
  onMediaContextMenu,
  onMediaPreviewError,
  onMediaPaint,
  onSignedUrlLoaded,
  onRequestSignedUrl,
  currentUserId = null,
  visibleMediaIdsRef,
  visibleMediaVersion = 0,
  signedPosterUrlById: signedPosterUrlOverrides = {},
  signedVideoUrlById: signedVideoUrlOverrides = {},
  surface = "media-library-panel",
  densityConfig,
  preferVisualMediaFirst = false,
  visualMediaPriorityCount = 0,
  fixedVisualAspectRatio = null,
}: MediaLibraryAllItemsGridProps) {
  const { aspectRatioById, cacheAspectRatio } = useMediaAspectRatioCache(mediaRows);
  const targetColumnWidth = densityConfig?.targetColumnWidth ?? 188;
  const cardPreviewLongEdgePx = densityConfig?.previewLongEdgePx ?? 320;
  const shouldUsePackedMasonryLayout = Boolean(densityConfig);
  const layoutMode: "chronological-grid" | "masonry" = shouldUsePackedMasonryLayout
    ? "masonry"
    : "chronological-grid";
  const {
    signedPosterUrlById: signedPosterUrlByIdFromHook,
    signedVideoUrlById: signedVideoUrlByIdFromHook,
  } = useMediaVideoBrowsePreviewUrls({
    mediaRows,
    currentUserId,
    surface,
    visibleMediaIdsRef,
    visibleMediaVersion,
  });
  const signedPosterUrlById = React.useMemo(
    () => ({ ...signedPosterUrlByIdFromHook, ...signedPosterUrlOverrides }),
    [signedPosterUrlByIdFromHook, signedPosterUrlOverrides]
  );
  const signedVideoUrlById = React.useMemo(
    () => ({ ...signedVideoUrlByIdFromHook, ...signedVideoUrlOverrides }),
    [signedVideoUrlByIdFromHook, signedVideoUrlOverrides]
  );

  const combinedItems = React.useMemo<MediaLibraryAllItem[]>(() => {
    const items: MediaLibraryAllItem[] = [
      ...mediaRows.map((row) => ({
        key: `media:${row.id}`,
        kind: "media" as const,
        id: row.id,
        createdAt: createdAtTime(row.created_at),
        row,
      })),
      ...promptRows.map((row) => ({
        key: `prompt:${row.id}`,
        kind: "prompt" as const,
        id: row.id,
        createdAt: createdAtTime(row.created_at),
        row,
      })),
    ];
    const chronologicallySortedItems = items.sort((left, right) => {
      const createdDelta = right.createdAt - left.createdAt;
      if (createdDelta !== 0) return createdDelta;
      return right.key.localeCompare(left.key);
    });
    if (!preferVisualMediaFirst || visualMediaPriorityCount < 1) {
      return chronologicallySortedItems;
    }
    const prioritizedVisualItems: MediaLibraryAllItem[] = [];
    const remainingItems: MediaLibraryAllItem[] = [];
    for (const item of chronologicallySortedItems) {
      const isPrioritizedVisualItem =
        item.kind === "media" &&
        resolveMediaRowKind(item.row) !== "audio" &&
        prioritizedVisualItems.length < visualMediaPriorityCount;
      if (isPrioritizedVisualItem) {
        prioritizedVisualItems.push(item);
        continue;
      }
      remainingItems.push(item);
    }
    return [...prioritizedVisualItems, ...remainingItems];
  }, [mediaRows, preferVisualMediaFirst, promptRows, visualMediaPriorityCount]);

  const {
    containerRef: virtualContainerRef,
    isVirtualized,
    totalHeight: virtualTotalHeight,
    renderItems: virtualRenderItems,
  } = useMediaMasonryVirtualization({
    items: combinedItems,
    getItemId: (item) => item.key,
    getAspectRatio: (item) => {
      if (item.kind === "prompt") return PROMPT_CARD_ASPECT_RATIO;
      const mediaKind = resolveMediaRowKind(item.row);
      if (mediaKind === "audio") return MEDIA_AUDIO_CARD_ASPECT_RATIO;
      if (
        typeof fixedVisualAspectRatio === "number" &&
        Number.isFinite(fixedVisualAspectRatio) &&
        fixedVisualAspectRatio > 0
      ) {
        return fixedVisualAspectRatio;
      }
      const cachedRatio = aspectRatioById[item.id];
      if (Number.isFinite(cachedRatio) && cachedRatio > 0) return cachedRatio;
      return resolveMediaCardAspectRatio({
        fileType: mediaKind,
        width: item.row.width ?? null,
        height: item.row.height ?? null,
        metadata: item.row.metadata,
      });
    },
    enabled: MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
    scrollContainerRef,
    targetColumnWidth,
    maxColumnCount: densityConfig?.maxColumnCount,
    gap: 1,
    overscanPx: 920,
    minItemsToVirtualize: shouldUsePackedMasonryLayout ? 1 : 24,
    layoutMode,
  });

  const videoBudgetItems = React.useMemo(
    () => mediaRows.map((file) => ({ id: file.id, fileType: resolveMediaRowKind(file) })),
    [mediaRows]
  );
  const isVideoFileType = React.useCallback((fileType?: string | null) => fileType === "video", []);
  const { getVideoNodeRef, isVideoAutoplayEnabled, resolveVideoSource } =
    useMediaGridVideoBudgetController({
      items: videoBudgetItems,
      enabled: MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
      surface,
      isVideoFile: isVideoFileType,
      pressureLevel: adaptivePressureLevel,
      scrollContainerRef,
      detachDelayMs: 850,
      visibilityThreshold: 0.5,
    });

  const gridStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const densityStyle = densityConfig
      ? ({
          "--media-library-modal-preview-width": `${densityConfig.targetColumnWidth}px`,
          "--media-library-panel-density-max-columns": densityConfig.maxColumnCount,
        } as React.CSSProperties)
      : undefined;
    if (!isVirtualized) return densityStyle;
    return {
      ...densityStyle,
      height: `${virtualTotalHeight}px`,
    };
  }, [densityConfig, isVirtualized, virtualTotalHeight]);

  if (combinedItems.length === 0) {
    return <p className="tiny subdued">No saved items yet.</p>;
  }

  return (
    <div
      ref={virtualContainerRef}
      className={`media-grid media-library-modal-grid media-library-modal-grid-packed media-library-panel-all-items-grid${
        isVirtualized ? " media-library-modal-grid-virtualized" : ""
      }${densityConfig ? " media-library-panel-density-grid" : ""}`}
      style={gridStyle}
    >
      {virtualRenderItems.map((renderItem) => {
        const item = renderItem.item;
        if (item.kind === "prompt") {
          const prompt = item.row;
          const isSelected = selectedIds.has(prompt.id);
          return (
            <MediaLibraryPromptReferenceCard
              key={item.key}
              prompt={prompt}
              isSelected={isSelected}
              onSelectPromptCard={onSelectPromptCard}
              onPromptDoubleClick={onPromptDoubleClick}
              onPromptDragStart={onPromptDragStart}
              onPromptDragEnd={onPromptDragEnd}
              showRemoveAction={showRemoveAction}
              onRemovePromptFromFolder={onRemovePromptFromFolder}
              showDeleteAction={showDeleteAction}
              onDeletePromptFromLibrary={onDeletePromptFromLibrary}
              shellClassName="media-library-modal-card media-library-panel-all-items-prompt-shell"
              cardClassName="media-library-panel-all-items-prompt-card"
              shellStyle={renderItem.style}
            />
          );
        }

        const file = item.row;
        const mediaKind = resolveMediaRowKind(file);
        const mediaLabel = resolveMediaLibraryCardDisplayLabel(file);
        const isAudio = mediaKind === "audio";
        const isVideo = mediaKind === "video";
        const hasDownloadableMediaSource = Boolean(
          (file.storage_path ?? "").trim() || (file.signedUrl ?? "").trim()
        );
        const canShowRemoveAction = showRemoveAction && Boolean(onRemoveMediaFromFolder);
        const canShowDeleteAction = showDeleteAction && Boolean(onDeleteMediaFromLibrary);
        const canShowDownloadAction = Boolean(
          onDownloadMediaFile &&
          (isAudio ? hasDownloadableMediaSource : (file.signedUrl ?? "").trim().length > 0)
        );
        const canShowRerollAction = canShowMediaLibraryRerollAction(
          file,
          onRerollWorkflowFromMedia
        );
        const shouldShowCardActions =
          canShowDownloadAction ||
          canShowRerollAction ||
          canShowRemoveAction ||
          canShowDeleteAction;
        const shouldBypassAdaptivePreview = optimizerFallbackMediaIds.has(file.id);
        const previewAspectRatio = isAudio
          ? MEDIA_AUDIO_CARD_ASPECT_RATIO
          : typeof fixedVisualAspectRatio === "number" &&
              Number.isFinite(fixedVisualAspectRatio) &&
              fixedVisualAspectRatio > 0
            ? fixedVisualAspectRatio
            : (aspectRatioById[file.id] ??
              resolveMediaCardAspectRatio({
                fileType: mediaKind,
                width: file.width ?? null,
                height: file.height ?? null,
                metadata: file.metadata,
              }));
        const cardPreviewUrl = resolveCardPreviewUrl
          ? resolveCardPreviewUrl({
              signedUrl: file.signedUrl,
              fileType: mediaKind,
              pressureLevel: adaptivePressureLevel,
              adaptivePreviewQualityEnabled,
              shouldBypassAdaptivePreview,
              cardLongEdgePx: cardPreviewLongEdgePx,
              devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            })
          : resolveMediaLibraryAdaptiveCardPreviewUrl({
              surface: "media-library-modal-grid",
              signedUrl: file.signedUrl,
              fileType: mediaKind,
              pressureLevel: adaptivePressureLevel,
              adaptivePreviewQualityEnabled,
              shouldBypassAdaptivePreview,
              cardLongEdgePx: cardPreviewLongEdgePx,
              devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            });
        const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";
        const signedPosterUrl = signedPosterUrlById[file.id] ?? null;
        const hoverVideoUrl = isVideo
          ? (signedVideoUrlById[file.id] ??
            (file.signedUrl && isVideoUrl(file.signedUrl) ? file.signedUrl : null))
          : null;
        const pressureSafeHoverVideoUrl = adaptivePressureLevel >= 2 ? null : hoverVideoUrl;
        const managedVideoSrc = isVideo
          ? resolveVideoSource(file.id, pressureSafeHoverVideoUrl)
          : undefined;
        const autoPlayEnabled = isVideoAutoplayEnabled(file.id);
        const posterSourceUrl = resolveVideoPosterSourceUrl(
          file,
          signedPosterUrl,
          hoverVideoUrl,
          file.signedUrl ?? null
        );
        const posterPreviewUrl = posterSourceUrl
          ? resolveCardPreviewUrl
            ? resolveCardPreviewUrl({
                signedUrl: posterSourceUrl,
                fileType: "image/jpeg",
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: cardPreviewLongEdgePx,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              })
            : resolveMediaLibraryAdaptiveCardPreviewUrl({
                surface: "media-library-modal-grid",
                signedUrl: posterSourceUrl,
                fileType: "image/jpeg",
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: cardPreviewLongEdgePx,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              })
          : null;

        return (
          <div key={item.key} style={renderItem.style}>
            {isAudio ? (
              <MediaLibraryAudioCard
                file={file}
                isSelected={selectedIds.has(file.id)}
                previewAspectRatio={previewAspectRatio}
                cardPreviewUrl={cardPreviewUrl}
                fetchPriorityAttr={fetchPriorityAttr}
                getMediaCardRef={getMediaCardRef}
                onSelectMediaFile={onSelectMediaFile}
                onMediaDoubleClick={onMediaDoubleClick}
                onMediaDragStart={onMediaDragStart}
                onMediaDragEnd={onMediaDragEnd}
                onToggleMediaSelection={onToggleMediaSelection}
                onMediaContextMenu={onMediaContextMenu}
                onMediaPreviewError={onMediaPreviewError}
                onSignedUrlLoaded={onSignedUrlLoaded}
                onRequestSignedUrl={onRequestSignedUrl}
                cacheAspectRatio={cacheAspectRatio}
                showCardActions={shouldShowCardActions}
                canShowDownloadAction={canShowDownloadAction}
                canShowRerollAction={canShowRerollAction}
                canShowRemoveAction={canShowRemoveAction}
                canShowDeleteAction={canShowDeleteAction}
                actionLabels={buildMediaLibraryCardActionLabels(file, {
                  actionAriaLabel: "Media actions",
                  downloadLabelPrefix: "Download media",
                  removeLabel: `Remove media ${mediaLabel}`,
                  deleteLabel: `Delete media ${mediaLabel}`,
                })}
                dangerActionMode="separate"
                onDownloadMediaFile={onDownloadMediaFile}
                onRerollWorkflowFromMedia={onRerollWorkflowFromMedia}
                onRemoveMediaFromFolder={onRemoveMediaFromFolder}
                onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
                setAriaPressedWithoutSelectionMode
              />
            ) : (
              <MediaLibraryVisualMediaCard
                variant="mixed-feed"
                file={file}
                isSelected={selectedIds.has(file.id)}
                previewAspectRatio={previewAspectRatio}
                cardPreviewUrl={cardPreviewUrl}
                hoverVideoUrl={pressureSafeHoverVideoUrl}
                managedVideoSrc={managedVideoSrc ?? null}
                autoPlayEnabled={autoPlayEnabled}
                getVideoNodeRef={getVideoNodeRef}
                posterPreviewUrl={posterPreviewUrl}
                adaptivePressureLevel={adaptivePressureLevel}
                fetchPriorityAttr={fetchPriorityAttr}
                getMediaCardRef={getMediaCardRef}
                onSelectMediaFile={onSelectMediaFile}
                onMediaDoubleClick={onMediaDoubleClick}
                onMediaDragStart={onMediaDragStart}
                onMediaDragEnd={onMediaDragEnd}
                onToggleMediaSelection={onToggleMediaSelection}
                onMediaContextMenu={onMediaContextMenu}
                onMediaPreviewError={onMediaPreviewError}
                onMediaPaint={onMediaPaint}
                onSignedUrlLoaded={onSignedUrlLoaded}
                onRequestSignedUrl={onRequestSignedUrl}
                cacheAspectRatio={cacheAspectRatio}
                showCardActions={shouldShowCardActions}
                canShowDownloadAction={canShowDownloadAction}
                canShowRerollAction={canShowRerollAction}
                canShowRemoveAction={canShowRemoveAction}
                canShowDeleteAction={canShowDeleteAction}
                actionLabels={buildMediaLibraryCardActionLabels(file, {
                  actionAriaLabel: "Media actions",
                  downloadLabelPrefix: "Download media",
                  removeLabel: `Remove media ${mediaLabel}`,
                  deleteLabel: `Delete media ${mediaLabel}`,
                })}
                dangerActionMode="separate"
                onDownloadMediaFile={onDownloadMediaFile}
                onRerollWorkflowFromMedia={onRerollWorkflowFromMedia}
                onRemoveMediaFromFolder={onRemoveMediaFromFolder}
                onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
                setAriaPressedWithoutSelectionMode
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
