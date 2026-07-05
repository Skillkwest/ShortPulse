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
  resolveMediaFileRowDurationMs,
  resolveMediaMetadataAudioSourceMode,
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
import {
  prepareMediaLibraryBulkMediaDragPayload,
  writeMediaLibraryBulkMediaDragPayload,
  writeMediaLibraryDragPayload,
  type MediaLibraryBulkMediaDragPayload,
} from "../logic/mediaLibraryDragPayload";
import {
  resolveMediaLibraryCharacterContext,
  resolveMediaLibraryGenerationReplayConfig,
  resolveMediaLibraryStyleContext,
  resolveMediaLibraryWorkflowReloadConfig,
} from "../logic/mediaLibraryWorkflowReload";
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
  getSelectedVisibleMediaRows?: () => MediaFileRow[];
};

type LibraryMediaReferencePayload = MediaLibraryBulkMediaDragPayload["payload"]["items"][number];

const buildLibraryMediaReferencePayload = ({
  activeFolderId,
  file,
  preview,
}: {
  activeFolderId: string | null;
  file: MediaFileRow;
  preview?: MediaLibraryMediaDragPreview;
}): LibraryMediaReferencePayload | null => {
  const signedUrl = (file.signedUrl ?? "").trim();
  const durableUrl = (file.storage_path ?? file.preview_storage_path ?? "").trim();
  const transferUrl = signedUrl || durableUrl;
  if (!transferUrl) return null;
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
  const generationReplay = resolveMediaLibraryGenerationReplayConfig(file.metadata);
  const characterContext = resolveMediaLibraryCharacterContext(file.metadata, workflowReload);
  const styleContext = resolveMediaLibraryStyleContext(file.metadata, workflowReload);
  const sourceRef = file.source_ref?.trim() || null;
  const audioPresentation = resolveMediaAudioPresentation(file);
  return {
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
    generationReplay,
    characterContext,
    styleContext,
    previewStoragePath,
    fullStoragePath: file.storage_path,
    previewUrl,
    previewPosterUrl: posterPreviewUrl,
    previewPosterStoragePath: isVideo ? (file.poster_variant_path ?? null) : null,
    fullUrl: signedUrl || null,
    companionArtUrl: audioPresentation.backgroundImageUrl,
    companionArtStoragePath: isAudio ? audioPresentation.backgroundImageStoragePath : null,
    audioSourceMode: isAudio ? resolveMediaMetadataAudioSourceMode(file.metadata) : null,
    durationMs: resolveMediaFileRowDurationMs(file),
    waveformPeaks: isAudio ? resolveMediaMetadataWaveformPeaks(file.metadata) : null,
    width: dragDimensions.width,
    height: dragDimensions.height,
  };
};

/**
 * Returns panel media/prompt drag handlers and resilient media download behavior.
 */
export const useMediaLibraryPanelItemInteractions = ({
  activeFolderId,
  getSelectedVisibleMediaRows,
}: UseMediaLibraryPanelItemInteractionsParams) => {
  const mediaDownloadInFlightRef = useRef<Record<string, boolean>>({});

  const handleMediaCardDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      file: MediaFileRow,
      preview?: MediaLibraryMediaDragPreview
    ) => {
      const payload = buildLibraryMediaReferencePayload({ activeFolderId, file, preview });
      if (!payload) {
        event.preventDefault();
        return;
      }
      const selectedVisibleMediaRows = getSelectedVisibleMediaRows?.() ?? [];
      const selectedBulkRows =
        selectedVisibleMediaRows.length > 1 &&
        selectedVisibleMediaRows.some((row) => row.id === file.id)
          ? selectedVisibleMediaRows
          : [];
      if (selectedBulkRows.length > 1) {
        const selectedPayloads = selectedBulkRows
          .map((row) =>
            buildLibraryMediaReferencePayload({
              activeFolderId,
              file: row,
              preview: row.id === file.id ? preview : undefined,
            })
          )
          .filter((item): item is LibraryMediaReferencePayload => Boolean(item));
        const boundedBulkPayload = prepareMediaLibraryBulkMediaDragPayload({
          kind: "bulkLibraryMedia",
          source: "mediaLibrary",
          payload: {
            draggedItemId: file.id,
            originFolderId: activeFolderId,
            items: selectedPayloads,
          },
        });
        if (boundedBulkPayload && boundedBulkPayload.payload.items.length > 1) {
          writeMediaLibraryBulkMediaDragPayload(event.dataTransfer, boundedBulkPayload);
          event.dataTransfer.effectAllowed = "copy";
          event.currentTarget.classList.add("is-dragging");
          const draggedPayload =
            boundedBulkPayload.payload.items.find((item) => item.id === file.id) ?? payload;
          attachMediaLibraryDragGhost(event, {
            label: `${boundedBulkPayload.payload.items.length} media items`,
            detail: draggedPayload.promptText,
            previewUrl:
              draggedPayload.fileType === "audio"
                ? draggedPayload.companionArtUrl
                : (draggedPayload.previewUrl ?? null),
            previewKind: draggedPayload.fileType,
          });
          return;
        }
      }
      const mediaKind = resolveMediaRowKind(file);
      const isVideo = mediaKind === "video";
      const isAudio = mediaKind === "audio";
      const audioPresentation = resolveMediaAudioPresentation(file);
      writeMediaLibraryDragPayload(event.dataTransfer, {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload,
      });
      event.dataTransfer.effectAllowed = "copy";
      setTransferDataSafe(event.dataTransfer, "text/reference-url", payload.url ?? "");
      setTransferDataSafe(event.dataTransfer, "text/uri-list", payload.url ?? "");
      if ((payload.promptText ?? "").trim()) {
        setTransferDataSafe(event.dataTransfer, "text/prompt", payload.promptText ?? "");
        setTransferDataSafe(event.dataTransfer, "text/plain", payload.promptText ?? "");
      } else {
        setTransferDataSafe(event.dataTransfer, "text/plain", payload.url ?? "");
      }
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: isAudio
          ? audioPresentation.displayTitle || file.filename || "Media"
          : file.filename || "Media",
        detail: payload.promptText,
        previewUrl: isAudio ? payload.companionArtUrl : payload.previewUrl,
        previewKind: isVideo ? "video" : isAudio ? "audio" : "image",
      });
    },
    [activeFolderId, getSelectedVisibleMediaRows]
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
