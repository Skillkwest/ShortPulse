import React from "react";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { resolveSignedSelectionUrl } from "../../media-library/logic/mediaPreviewResolver";
import {
  isAudioFile,
  isVideoFile,
  resolveMediaMetadataPromptText,
  type MediaFileRow,
} from "../logic/mediaLibraryModalModel";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../logic/mediaLibraryPanelApi";

type UseMediaLibraryPanelSelectionControllerParams = {
  activeFolderId: string;
  currentUserIdRef: React.MutableRefObject<string | null>;
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video" | "audio";
    filename?: string | null;
    promptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    previewPosterUrl?: string | null;
    previewPosterStoragePath?: string | null;
    fullUrl?: string | null;
  }) => void;
  refreshSignedUrl: (row: MediaFileRow) => Promise<string | null>;
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
  ) => Promise<string | null>;
};

type UseMediaLibraryPanelSelectionControllerResult = {
  previewModalFile: MediaFileRow | null;
  previewModalUrl: string | null;
  previewModalLoading: boolean;
  previewModalError: string | null;
  handleSelectMediaFile: (file: MediaFileRow) => void;
  handleMediaCardDoubleClick: (file: MediaFileRow) => void;
  handleMediaCardContextMenu: (event: React.MouseEvent<HTMLElement>, file: MediaFileRow) => void;
  closePreviewModal: () => void;
};

export const useMediaLibraryPanelSelectionController = ({
  activeFolderId,
  currentUserIdRef,
  onSelectMedia,
  refreshSignedUrl,
  signStoragePath,
}: UseMediaLibraryPanelSelectionControllerParams): UseMediaLibraryPanelSelectionControllerResult => {
  const [previewModalFile, setPreviewModalFile] = React.useState<MediaFileRow | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = React.useState<string | null>(null);
  const [previewModalLoading, setPreviewModalLoading] = React.useState(false);
  const [previewModalError, setPreviewModalError] = React.useState<string | null>(null);
  const previewResolveTokenRef = React.useRef(0);

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
      const previewUrl = file.signedUrl ?? nextUrl;
      const fullUrl = nextUrl;
      onSelectMedia({
        id: file.id,
        url: nextUrl,
        fileType: isAudioFile(file.file_type) ? "audio" : isVideo ? "video" : "image",
        filename: file.filename,
        promptText: resolveMediaMetadataPromptText(file.metadata),
        source: file.source ?? "upload",
        previewStoragePath,
        previewPosterStoragePath,
        fullStoragePath,
        previewUrl,
        previewPosterUrl,
        fullUrl,
      });
      return true;
    },
    [currentUserIdRef, onSelectMedia, refreshSignedUrl, signStoragePath]
  );

  const handleSelectMediaFile = React.useCallback((file: MediaFileRow) => {
    void file;
  }, []);

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

  const closePreviewModal = React.useCallback(() => {
    previewResolveTokenRef.current += 1;
    setPreviewModalFile(null);
    setPreviewModalUrl(null);
    setPreviewModalLoading(false);
    setPreviewModalError(null);
  }, []);

  const handleMediaCardDoubleClick = React.useCallback(
    (file: MediaFileRow) => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      const nextToken = previewResolveTokenRef.current + 1;
      previewResolveTokenRef.current = nextToken;
      setPreviewModalFile(file);
      setPreviewModalUrl((file.signedUrl ?? "").trim() || null);
      setPreviewModalLoading(true);
      setPreviewModalError(null);
      void resolvePreviewModalUrl(file)
        .then((resolvedUrl) => {
          if (previewResolveTokenRef.current !== nextToken) return;
          if (resolvedUrl) {
            setPreviewModalUrl(resolvedUrl);
            return;
          }
          setPreviewModalError("Failed to load preview.");
        })
        .catch(() => {
          if (previewResolveTokenRef.current !== nextToken) return;
          setPreviewModalError("Failed to load preview.");
        })
        .finally(() => {
          if (previewResolveTokenRef.current !== nextToken) return;
          setPreviewModalLoading(false);
        });
    },
    [activeFolderId, resolvePreviewModalUrl]
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
    previewModalFile,
    previewModalUrl,
    previewModalLoading,
    previewModalError,
    handleSelectMediaFile,
    handleMediaCardDoubleClick,
    handleMediaCardContextMenu,
    closePreviewModal,
  };
};
