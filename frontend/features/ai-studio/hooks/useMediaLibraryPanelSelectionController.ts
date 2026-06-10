import React from "react";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { resolveSignedSelectionUrl } from "../../media-library/logic/mediaPreviewResolver";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import {
  isAudioFile,
  isVideoFile,
  resolveMediaMetadataAudioSourceMode,
  resolveMediaMetadataDurationMs,
  resolveMediaMetadataLyricsText,
  resolveMediaMetadataPromptText,
  resolveMediaMetadataTranscriptText,
  resolveMediaMetadataWaveformPeaks,
  type MediaFileRow,
} from "../logic/mediaLibraryModalModel";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../logic/mediaLibraryPanelApi";
import {
  createMediaLibraryDetailModalItem,
  createMediaLibraryDetailSelectionPayload,
  type MediaLibraryDetailModalItem,
  type MediaLibraryDetailModalSurface,
  type MediaLibraryDetailSelectionPayload,
} from "../logic/mediaLibraryDetailModal";
import { isVideoUrl } from "../logic/stateParsers";

export type MediaLibrarySelectionPayload = MediaLibraryDetailSelectionPayload;

type UseMediaLibraryPanelSelectionControllerParams = {
  activeFolderId: string;
  detailSurface: MediaLibraryDetailModalSurface;
  currentUserIdRef: React.MutableRefObject<string | null>;
  mediaRows: MediaFileRow[];
  detailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  setDetailSelectionTarget?: (target: SharedMediaDetailSelectionTarget | null) => void;
  onSelectMedia: (payload: MediaLibrarySelectionPayload) => void;
  refreshSignedUrl: (row: MediaFileRow) => Promise<string | null>;
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
  ) => Promise<string | null>;
};

type UseMediaLibraryPanelSelectionControllerResult = {
  detailModalItem: MediaLibraryDetailModalItem | null;
  detailModalLoading: boolean;
  detailModalError: string | null;
  handleSelectMediaFile: (file: MediaFileRow) => void;
  handleMediaCardDoubleClick: (file: MediaFileRow) => void;
  handleMediaCardContextMenu: (event: React.MouseEvent<HTMLElement>, file: MediaFileRow) => void;
  handleDetailModalMediaError: (item: MediaLibraryDetailModalItem, failedUrl: string) => void;
  closeDetailModal: () => void;
};

export const useMediaLibraryPanelSelectionController = ({
  activeFolderId,
  detailSurface,
  currentUserIdRef,
  mediaRows,
  detailSelectionTarget,
  setDetailSelectionTarget,
  onSelectMedia,
  refreshSignedUrl,
  signStoragePath,
}: UseMediaLibraryPanelSelectionControllerParams): UseMediaLibraryPanelSelectionControllerResult => {
  const [detailModalItem, setDetailModalItem] = React.useState<MediaLibraryDetailModalItem | null>(
    null
  );
  const [detailModalLoading, setDetailModalLoading] = React.useState(false);
  const [detailModalError, setDetailModalError] = React.useState<string | null>(null);
  const previewResolveTokenRef = React.useRef(0);
  const isExternallyControlled = typeof setDetailSelectionTarget === "function";
  const controlledSelectionTarget =
    detailSelectionTarget?.kind === "media-file" && detailSelectionTarget.surface === detailSurface
      ? detailSelectionTarget
      : null;

  const addMediaReferenceFromFile = React.useCallback(
    async (file: MediaFileRow) => {
      const nextUrl =
        (await resolveSignedSelectionUrl({
          row: file,
          currentUserId: currentUserIdRef.current,
          signStoragePath,
        })) ??
        (await refreshSignedUrl(file)) ??
        file.signedUrl;
      if (!nextUrl) return false;
      const previewStoragePath = file.preview_storage_path ?? file.storage_path;
      const isVideo = isVideoFile(file.file_type);
      const previewPosterStoragePath = isVideo
        ? (file.poster_variant_path ?? file.thumb_variant_path ?? null)
        : null;
      const previewPosterUrl = previewPosterStoragePath
        ? await signStoragePath(previewPosterStoragePath, { forceRefresh: true })
        : null;
      const fullStoragePath = file.storage_path;
      const previewUrl = nextUrl;
      const fullUrl =
        (fullStoragePath && fullStoragePath !== previewStoragePath
          ? await signStoragePath(fullStoragePath, { forceRefresh: true })
          : null) ?? nextUrl;
      onSelectMedia(
        createMediaLibraryDetailSelectionPayload(file.id, {
          url: nextUrl,
          fileType: isAudioFile(file.file_type) ? "audio" : isVideo ? "video" : "image",
          createdAt: file.created_at ?? null,
          filename: file.filename,
          promptText: resolveMediaMetadataPromptText(file.metadata),
          transcriptText: resolveMediaMetadataTranscriptText(file.metadata),
          lyricsText: resolveMediaMetadataLyricsText(file.metadata),
          source: file.source ?? "upload",
          previewStoragePath,
          previewPosterStoragePath,
          fullStoragePath,
          previewUrl,
          previewPosterUrl,
          fullUrl,
          audioSourceMode: isAudioFile(file.file_type)
            ? resolveMediaMetadataAudioSourceMode(file.metadata)
            : null,
          durationMs: resolveMediaMetadataDurationMs(file.metadata, { fileType: file.file_type }),
          waveformPeaks: isAudioFile(file.file_type)
            ? resolveMediaMetadataWaveformPeaks(file.metadata)
            : null,
        })
      );
      return true;
    },
    [currentUserIdRef, onSelectMedia, refreshSignedUrl, signStoragePath]
  );

  const handleSelectMediaFile = React.useCallback(
    (file: MediaFileRow) => {
      void addMediaReferenceFromFile(file);
    },
    [addMediaReferenceFromFile]
  );

  const resolvePreviewModalUrl = React.useCallback(
    async (file: MediaFileRow): Promise<string | null> => {
      const nextUrl =
        (await resolveSignedSelectionUrl({
          row: file,
          currentUserId: currentUserIdRef.current,
          signStoragePath,
        })) ??
        (await refreshSignedUrl(file)) ??
        file.signedUrl;
      const normalized = (nextUrl ?? "").trim();
      return normalized || null;
    },
    [currentUserIdRef, refreshSignedUrl, signStoragePath]
  );

  const resolvePreviewModalFullUrl = React.useCallback(
    async (file: MediaFileRow): Promise<string | null> => {
      const storagePath = file.storage_path?.trim() ?? "";
      if (!storagePath) return null;
      const signedUrl = await signStoragePath(storagePath, { forceRefresh: true });
      const normalized = (signedUrl ?? "").trim();
      return normalized || null;
    },
    [signStoragePath]
  );

  const resetDetailModalState = React.useCallback(() => {
    previewResolveTokenRef.current += 1;
    setDetailModalItem(null);
    setDetailModalLoading(false);
    setDetailModalError(null);
  }, []);

  const openDetailModalForFile = React.useCallback(
    (file: MediaFileRow) => {
      const nextToken = previewResolveTokenRef.current + 1;
      previewResolveTokenRef.current = nextToken;
      const isVideo = isVideoFile(file.file_type);
      const immediateSignedUrl = (file.signedUrl ?? "").trim() || null;
      const immediatePreviewUrl = isVideo
        ? immediateSignedUrl && isVideoUrl(immediateSignedUrl)
          ? immediateSignedUrl
          : null
        : immediateSignedUrl;
      const previewStoragePath = file.preview_storage_path ?? file.storage_path;
      const previewPosterStoragePath = isVideo
        ? (file.poster_variant_path ?? file.thumb_variant_path ?? null)
        : null;
      setDetailModalItem(
        createMediaLibraryDetailModalItem({
          file,
          surface: detailSurface,
          fields: {
            url: immediatePreviewUrl ?? "",
            fileType: isAudioFile(file.file_type) ? "audio" : isVideo ? "video" : "image",
            createdAt: file.created_at ?? null,
            filename: file.filename,
            promptText: resolveMediaMetadataPromptText(file.metadata),
            transcriptText: resolveMediaMetadataTranscriptText(file.metadata),
            lyricsText: resolveMediaMetadataLyricsText(file.metadata),
            source: file.source ?? "upload",
            previewStoragePath,
            previewPosterStoragePath,
            fullStoragePath: file.storage_path,
            previewUrl: immediatePreviewUrl,
            previewPosterUrl: null,
            fullUrl: null,
            audioSourceMode: isAudioFile(file.file_type)
              ? resolveMediaMetadataAudioSourceMode(file.metadata)
              : null,
            durationMs: resolveMediaMetadataDurationMs(file.metadata, { fileType: file.file_type }),
            waveformPeaks: isAudioFile(file.file_type)
              ? resolveMediaMetadataWaveformPeaks(file.metadata)
              : null,
          },
        })
      );
      setDetailModalLoading(true);
      setDetailModalError(null);
      // Open quickly on the current browse preview when available, then promote
      // the focused modal render to the signed original asset once it resolves.
      void (async () => {
        try {
          const [resolvedFullUrl, resolvedPreviewUrl] = await Promise.all([
            resolvePreviewModalFullUrl(file).catch(() => null),
            (immediatePreviewUrl
              ? Promise.resolve(immediatePreviewUrl)
              : resolvePreviewModalUrl(file)
            ).catch(() => null),
          ]);
          if (previewResolveTokenRef.current !== nextToken) return;
          const resolvedUrl =
            resolvedFullUrl ??
            (!isVideo || (resolvedPreviewUrl && isVideoUrl(resolvedPreviewUrl))
              ? resolvedPreviewUrl
              : null);
          if (resolvedUrl) {
            setDetailModalItem((current) => {
              if (!current || current.file.id !== file.id) return current;
              const nextPreviewUrl = resolvedPreviewUrl ?? current.previewUrl ?? null;
              const nextPosterUrl =
                isVideo && resolvedPreviewUrl && !isVideoUrl(resolvedPreviewUrl)
                  ? resolvedPreviewUrl
                  : (current.previewPosterUrl ?? null);
              const nextFullUrl = resolvedFullUrl ?? current.fullUrl ?? null;
              return {
                ...current,
                url: resolvedUrl,
                previewUrl: nextPreviewUrl,
                previewPosterUrl: nextPosterUrl,
                fullUrl: nextFullUrl,
                media: {
                  ...current.media,
                  url: resolvedUrl,
                  previewUrl: nextPreviewUrl,
                  previewPosterUrl: nextPosterUrl,
                  fullUrl: nextFullUrl,
                },
              };
            });
            return;
          }
          setDetailModalError("Failed to load preview.");
        } finally {
          if (previewResolveTokenRef.current === nextToken) {
            setDetailModalLoading(false);
          }
        }
      })();
    },
    [detailSurface, resolvePreviewModalFullUrl, resolvePreviewModalUrl]
  );

  React.useEffect(() => {
    if (!isExternallyControlled) return;
    if (!controlledSelectionTarget) {
      resetDetailModalState();
      return;
    }
    const matchingFile =
      mediaRows.find((row) => row.id === controlledSelectionTarget.fileId) ?? null;
    if (!matchingFile) {
      resetDetailModalState();
      return;
    }
    if (detailModalItem?.file.id === matchingFile.id) return;
    openDetailModalForFile(matchingFile);
  }, [
    controlledSelectionTarget,
    detailModalItem?.file.id,
    isExternallyControlled,
    mediaRows,
    openDetailModalForFile,
    resetDetailModalState,
  ]);

  const closeDetailModal = React.useCallback(() => {
    if (isExternallyControlled) {
      setDetailSelectionTarget?.(null);
      return;
    }
    resetDetailModalState();
  }, [isExternallyControlled, resetDetailModalState, setDetailSelectionTarget]);

  const handleMediaCardDoubleClick = React.useCallback(
    (file: MediaFileRow) => {
      if (isExternallyControlled) {
        setDetailSelectionTarget?.({
          kind: "media-file",
          fileId: file.id,
          surface: detailSurface,
        });
        return;
      }
      openDetailModalForFile(file);
    },
    [detailSurface, isExternallyControlled, openDetailModalForFile, setDetailSelectionTarget]
  );

  const handleDetailModalMediaError = React.useCallback(
    (item: MediaLibraryDetailModalItem, failedUrl: string) => {
      const nextToken = previewResolveTokenRef.current + 1;
      previewResolveTokenRef.current = nextToken;
      setDetailModalLoading(true);
      setDetailModalError(null);
      void (async () => {
        try {
          const refreshedFullUrl = await resolvePreviewModalFullUrl(item.file).catch(() => null);
          if (previewResolveTokenRef.current !== nextToken) return;
          const normalizedFailedUrl = failedUrl.trim();
          const normalizedRefreshedUrl = refreshedFullUrl?.trim() ?? "";
          if (normalizedRefreshedUrl && normalizedRefreshedUrl !== normalizedFailedUrl) {
            setDetailModalItem((current) => {
              if (!current || current.file.id !== item.file.id) return current;
              return {
                ...current,
                url: normalizedRefreshedUrl,
                fullUrl: normalizedRefreshedUrl,
              };
            });
            return;
          }
          setDetailModalItem((current) => {
            if (!current || current.file.id !== item.file.id) return current;
            return {
              ...current,
              url: "",
            };
          });
          setDetailModalError("Preview unavailable.");
        } finally {
          if (previewResolveTokenRef.current === nextToken) {
            setDetailModalLoading(false);
          }
        }
      })();
    },
    [resolvePreviewModalFullUrl]
  );

  const handleMediaCardContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, file: MediaFileRow) => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      event.preventDefault();
      event.stopPropagation();
      void addMediaReferenceFromFile(file);
    },
    [activeFolderId, addMediaReferenceFromFile]
  );

  return {
    detailModalItem,
    detailModalLoading,
    detailModalError,
    handleSelectMediaFile,
    handleMediaCardDoubleClick,
    handleMediaCardContextMenu,
    handleDetailModalMediaError,
    closeDetailModal,
  };
};
