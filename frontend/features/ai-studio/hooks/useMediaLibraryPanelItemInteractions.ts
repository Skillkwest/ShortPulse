/**
 * Media Library panel item interaction hook.
 * Owns drag payload wiring and download fallback behavior for panel media/prompt cards.
 */
import { useCallback, useRef } from "react";
import { resolveMediaRowKind } from "../../../lib/mediaRowKind";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  BUCKET,
  resolveMediaAudioPresentation,
  resolveMediaMetadataAudioSourceMode,
  resolveMediaMetadataDurationMs,
  resolveMediaMetadataModelId,
  resolveMediaMetadataPromptText,
  resolveMediaMetadataTranscriptText,
  resolveMediaMetadataWaveformPeaks,
  type MediaFileRow,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import { resolveMediaDragDimensions } from "../logic/mediaLibraryAspectRatio";
import {
  attachMediaLibraryDragGhost,
  clearMediaLibraryDragGhost,
} from "../logic/mediaLibraryDragGhost";
import { writeMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import { resolveMediaLibraryWorkflowReloadConfig } from "../logic/mediaLibraryWorkflowReload";
import { downloadBlobToFile } from "../logic/referenceDownload";
import type { MediaLibraryMediaDragPreview } from "../components/media-library-modal/MediaLibraryAllItemsGrid";
import { clearDragState, preparePromptReferenceDrag } from "../utils/dragDrop";

const setTransferDataSafe = (transfer: DataTransfer, type: string, value: string): void => {
  try {
    transfer.setData(type, value);
  } catch {
    // Some browser engines reject specific transfer MIME types; keep drag active.
  }
};

const resolveLibraryMediaReferenceFileType = (file: MediaFileRow): "image" | "video" | "audio" =>
  resolveMediaRowKind(file) === "audio"
    ? "audio"
    : resolveMediaRowKind(file) === "video"
      ? "video"
      : "image";

type UseMediaLibraryPanelItemInteractionsParams = {
  activeFolderId: string | null;
};

/**
 * Returns panel media/prompt drag handlers and resilient media download behavior.
 */
export const useMediaLibraryPanelItemInteractions = ({
  activeFolderId,
}: UseMediaLibraryPanelItemInteractionsParams) => {
  const mediaDownloadInFlightRef = useRef<Record<string, boolean>>({});

  const handleMediaCardDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      file: MediaFileRow,
      preview?: MediaLibraryMediaDragPreview
    ) => {
      const signedUrl = (file.signedUrl ?? "").trim();
      const durableUrl = (file.storage_path ?? file.preview_storage_path ?? "").trim();
      const transferUrl = signedUrl || durableUrl;
      if (!transferUrl) {
        event.preventDefault();
        return;
      }
      const mediaKind = resolveMediaRowKind(file);
      const isVideo = mediaKind === "video";
      const isAudio = mediaKind === "audio";
      const hoverVideoUrl = preview?.hoverVideoUrl?.trim() || signedUrl;
      const posterPreviewUrl = isVideo ? preview?.posterPreviewUrl?.trim() || null : null;
      const resolvedTransferUrl = isVideo ? hoverVideoUrl || transferUrl : transferUrl;
      const previewUrl = posterPreviewUrl ?? signedUrl;
      const previewStoragePath = isVideo
        ? (file.preview_storage_path ?? file.storage_path)
        : (file.preview_storage_path ?? file.storage_path);
      const dragDimensions = resolveMediaDragDimensions({
        fileType: mediaKind,
        width: file.width ?? null,
        height: file.height ?? null,
        metadata: file.metadata,
        visualAspectRatio: preview?.aspectRatio ?? null,
      });
      const promptText = resolveMediaMetadataPromptText(file.metadata) ?? file.filename ?? "";
      const transcriptText = resolveMediaMetadataTranscriptText(file.metadata);
      const workflowReload = resolveMediaLibraryWorkflowReloadConfig(file.metadata);
      const sourceRef = file.source_ref?.trim() || null;
      const audioPresentation = resolveMediaAudioPresentation(file);
      const companionArtUrl = audioPresentation.backgroundImageUrl;
      writeMediaLibraryDragPayload(event.dataTransfer, {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: file.id,
          url: resolvedTransferUrl,
          fileType: resolveLibraryMediaReferenceFileType(file),
          createdAt: file.created_at ?? null,
          originFolderId: activeFolderId,
          filename: file.filename,
          displayTitle: isAudio ? audioPresentation.displayTitle : null,
          promptText,
          transcriptText,
          source: file.source ?? null,
          sourceRef,
          generationId: sourceRef,
          modelId: resolveMediaMetadataModelId(file.metadata),
          workflowReload,
          previewStoragePath,
          fullStoragePath: file.storage_path,
          previewUrl,
          previewPosterUrl: posterPreviewUrl,
          previewPosterStoragePath: isVideo ? (file.poster_variant_path ?? null) : null,
          fullUrl: signedUrl || null,
          companionArtUrl,
          companionArtStoragePath: isAudio ? audioPresentation.backgroundImageStoragePath : null,
          audioSourceMode: isAudio ? resolveMediaMetadataAudioSourceMode(file.metadata) : null,
          durationMs: resolveMediaMetadataDurationMs(file.metadata, { fileType: file.file_type }),
          waveformPeaks: isAudio ? resolveMediaMetadataWaveformPeaks(file.metadata) : null,
          width: dragDimensions.width,
          height: dragDimensions.height,
        },
      });
      event.dataTransfer.effectAllowed = "copy";
      setTransferDataSafe(event.dataTransfer, "text/reference-url", resolvedTransferUrl);
      setTransferDataSafe(event.dataTransfer, "text/uri-list", resolvedTransferUrl);
      if (promptText.trim()) {
        setTransferDataSafe(event.dataTransfer, "text/prompt", promptText);
        setTransferDataSafe(event.dataTransfer, "text/plain", promptText);
      } else {
        setTransferDataSafe(event.dataTransfer, "text/plain", resolvedTransferUrl);
      }
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: isAudio
          ? audioPresentation.displayTitle || file.filename || "Media"
          : file.filename || "Media",
        detail: promptText,
        previewUrl: isAudio ? companionArtUrl : previewUrl,
        previewKind: isVideo ? "video" : isAudio ? "audio" : "image",
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
          createdAt: prompt.created_at ?? null,
          originFolderId: activeFolderId,
          title: prompt.title,
        },
      });
      preparePromptReferenceDrag(event, {
        referenceId: prompt.id,
        outputId: prompt.id,
        promptText,
        sourceSurface: null,
      });
      setTransferDataSafe(event.dataTransfer, "text/prompt", promptText);
      setTransferDataSafe(event.dataTransfer, "text/plain", promptText);
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: prompt.title || "Prompt",
        detail: promptText,
        template: "prompt",
      });
    },
    [activeFolderId]
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.currentTarget.classList.remove("is-dragging");
    clearDragState(event);
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

  return {
    handleCardDragEnd,
    handleDownloadMediaFile,
    handleMediaCardDragStart,
    handlePromptCardDragStart,
  };
};
