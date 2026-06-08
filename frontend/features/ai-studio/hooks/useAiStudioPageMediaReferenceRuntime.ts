/**
 * AI Studio page media-reference runtime.
 * Owns quick-slot drop handling, canvas reference resolution, voice-changer internal references,
 * and dual-canvas workspace wiring for the page shell.
 */
import { useCallback, useEffect, useMemo, useRef, type DragEvent } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { useAiStudioDualCanvasWorkspaceState } from "../components/canvas/useAiStudioCanvasWorkspaceState";
import type {
  CanvasDropResolution,
  CanvasSceneItem,
  PrepareCanvasMediaLibraryDrop,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDroppedMediaReference,
  ResolveCanvasDropReference,
} from "../components/canvas/canvasTypes";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import type {
  CanvasPropertiesPanelProps,
  CanvasWorkspaceInstanceId,
  CanvasWorkspaceSessionState,
} from "../components/canvas/canvasWorkspaceContracts";
import {
  CANVAS_AUDIO_ITEM_HEIGHT,
  CANVAS_AUDIO_ITEM_WIDTH,
} from "../components/canvas/canvasGeometry";
import {
  createVoiceChangerSourceFromFile,
  createVoiceChangerSourceFromReference,
  type ResolveVoiceChangerInternalReferenceSource,
} from "../components/VoiceChangerSourceDropzone";
import {
  normalizeOptionalText,
  resolveVoiceChangerBlobFilename,
  resolveVoiceChangerOutputLocalUrl,
  resolveVoiceChangerOutputRemoteUrl,
  resolveVoiceChangerOutputStoragePath,
} from "../logic/voiceChangerReferenceSource";
import { isVideoUrl } from "../logic/stateParsers";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";
import {
  normalizeMediaFile,
  type PastedMediaReference,
} from "../reference-grid/controllers/referenceGridClipboard";
import { resolveReferenceProjectionIds } from "../reference-projections";
import type { StudioOutput } from "../types";
import {
  resolveSessionRestoreSignedMediaAuthorityByMediaId,
  type SessionSignedMediaRestoreAuthority,
} from "../logic/sessionRestoreMediaSigning";
import { resolveOutputAudioSourceMode } from "../logic/audioSourceMode";
import {
  resolveCanvasLibraryMediaDisplayAuthority,
  resolveCanvasStudioOutputMediaDisplayAuthority,
} from "../logic/canvasMediaDisplayAuthority";
import type { StudioOutputMediaDisplayAuthority } from "../logic/referenceGridMedia";
import { resolveVideoPosterStoragePath } from "../logic/videoPosterStoragePaths";
import { useCanvasPropertiesPanelLivePropsBridge } from "../components/canvas/useCanvasPropertiesPanelLivePropsBridge";
import { resolveSavedMediaIdFromOutput } from "./useAiStudioInternalDropResolvers";
import type { AiStudioOutputStoreSnapshot } from "./aiStudioOutputStore";
import {
  attachMediaLibraryDragGhost,
  clearMediaLibraryDragGhost,
} from "../logic/mediaLibraryDragGhost";
import { clearDragState, prepareReferenceDrag } from "../utils/dragDrop";
import type { CanvasTearOutComposerTargetRegistry } from "./useAiStudioCanvasTearOutTargets";

const SURFACE_DIRECT_DROP_PARTIAL_MESSAGE = "Some files could not be added. The rest were added.";
const CANVAS_MEDIA_LIBRARY_BUCKET = "media_library";

const areNumberListsEqual = (
  left: readonly number[] | null | undefined,
  right: readonly number[] | null | undefined
): boolean => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const resolveCanvasMediaRenderRetryKey = (item: CanvasSceneItem): string | null => {
  if (item.kind === "image") {
    return `${item.id}:image:${item.src}`;
  }
  if (item.kind === "video") {
    return `${item.id}:video:${item.videoUrl}:${item.posterUrl ?? ""}`;
  }
  if (item.kind === "audio") {
    return `${item.id}:audio:${item.audioUrl}`;
  }
  return null;
};

const resolveCanvasMediaFallbackUrl = (item: CanvasSceneItem): string | null => {
  if (item.kind === "image") return item.src;
  if (item.kind === "video") return item.videoUrl;
  if (item.kind === "audio") return item.audioUrl;
  return null;
};

type QuickSlotDropOptions = {
  targetId: string | null;
  placement: "start" | "before" | "after" | "end";
};

type DirectDroppedMediaFiles = {
  mediaFiles: File[];
  rejectedFileCount: number;
};

type UseAiStudioPageMediaReferenceRuntimeParams = {
  addCuratedReference: (outputId: string) => void;
  addLibraryMediaReferenceToQuickSlot: (
    payload: LibraryMediaReferencePayload,
    options?: QuickSlotDropOptions
  ) => Promise<string | null>;
  addLibraryPromptReferenceToQuickSlot: (
    payload: LibraryPromptReferencePayload,
    options?: QuickSlotDropOptions
  ) => string | null;
  addPastedPromptReference: (text: string) => void;
  insertPastedMediaReference: (payload: PastedMediaReference) => StudioOutput[];
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => AiStudioOutputStoreSnapshot;
  ingestReferenceFiles: (
    files: FileList | File[],
    source?: "filePicker" | "drop"
  ) => Promise<
    {
      outputId: string;
      payload: LibraryMediaReferencePayload;
      output: StudioOutput;
      file: File;
    }[]
  >;
  reorderCuratedReference: (
    outputId: string,
    targetId: string | null,
    placement: "start" | "before" | "after" | "end"
  ) => void;
  setActiveOutputId: (outputId: string | null) => void;
  setDetailSelectionTarget: (target: SharedMediaDetailSelectionTarget | null) => void;
  setUiError?: (message: string | null) => void;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
};

/**
 * Returns page-shell media reference runtime helpers.
 */
export const useAiStudioPageMediaReferenceRuntime = ({
  addCuratedReference,
  addLibraryMediaReferenceToQuickSlot,
  addLibraryPromptReferenceToQuickSlot,
  addPastedPromptReference,
  insertPastedMediaReference,
  getOutputById,
  getOutputSnapshot,
  ingestReferenceFiles,
  reorderCuratedReference,
  setActiveOutputId,
  setDetailSelectionTarget,
  setUiError,
  canvasTearOutTargetRegistry,
}: UseAiStudioPageMediaReferenceRuntimeParams) => {
  const canvasMediaRestoreAuthorityCacheRef = useRef(
    new Map<string, SessionSignedMediaRestoreAuthority>()
  );
  const resolveDirectDroppedMediaFiles = useCallback(
    (files: FileList | File[]): DirectDroppedMediaFiles => {
      const droppedFiles = Array.from(files);
      const mediaFiles = droppedFiles
        .map((file, index) => normalizeMediaFile(file, null, index))
        .filter((file): file is File => Boolean(file));
      return {
        mediaFiles,
        rejectedFileCount: Math.max(0, droppedFiles.length - mediaFiles.length),
      };
    },
    []
  );

  const ensureDroppedMediaFiles = useCallback(
    (files: FileList | File[]): DirectDroppedMediaFiles => {
      const directDrop = resolveDirectDroppedMediaFiles(files);
      if (directDrop.mediaFiles.length > 0) return directDrop;
      setUiError?.("Drop image, video, or audio files here.");
      return directDrop;
    },
    [resolveDirectDroppedMediaFiles, setUiError]
  );

  const normalizeCanvasVisualDimensions = useCallback(
    (
      width: number | null | undefined,
      height: number | null | undefined
    ): { width: number; height: number } | undefined => {
      if (
        typeof width !== "number" ||
        !Number.isFinite(width) ||
        width <= 0 ||
        typeof height !== "number" ||
        !Number.isFinite(height) ||
        height <= 0
      ) {
        return undefined;
      }
      return { width, height };
    },
    []
  );

  const resolveCanvasPosterUrl = useCallback(
    (...candidates: Array<string | null | undefined>): string | null => {
      for (const candidate of candidates) {
        const normalized = candidate?.trim() || "";
        if (!normalized || isVideoUrl(normalized)) continue;
        return normalized;
      }
      return null;
    },
    []
  );

  const resolveCanvasResolutionFromOutput = useCallback(
    ({
      output,
      fallbackUrl = null,
      outputId = output.id ?? null,
      mediaId = resolveSavedMediaIdFromOutput(output, 0),
      sourceSurface = null,
      width,
      height,
      imageIndex = 0,
      preferFallbackUrl = false,
      displayAuthority = null,
    }: {
      output: StudioOutput;
      fallbackUrl?: string | null;
      outputId?: string | null;
      mediaId?: string | null;
      sourceSurface?: CanvasDropResolution["sourceSurface"];
      width?: number | null;
      height?: number | null;
      imageIndex?: number;
      preferFallbackUrl?: boolean;
      displayAuthority?: StudioOutputMediaDisplayAuthority | null;
    }): CanvasDropResolution | null => {
      const visualDimensions =
        normalizeCanvasVisualDimensions(width, height) ??
        normalizeCanvasVisualDimensions(output.width, output.height);
      if (output.mode === "text") {
        const text = (output.prompt || output.previewText || "").trim();
        if (!text) return null;
        return {
          kind: "text",
          outputId: null,
          text,
          ...(sourceSurface ? { sourceSurface } : {}),
        };
      }
      if (output.mode === "audio") {
        const audioUrl =
          displayAuthority?.playableMediaUrl ??
          output.resultUrls?.[0] ??
          output.previewUrl ??
          fallbackUrl ??
          null;
        if (!audioUrl) return null;
        return {
          kind: "audio",
          outputId,
          mediaId,
          audioUrl,
          title: (output.prompt || output.previewText || "Canvas audio").trim() || null,
          companionArtUrl: output.companionArtUrl ?? null,
          companionArtStoragePath: output.companionArtStoragePath ?? null,
          audioSourceMode: resolveOutputAudioSourceMode(output),
          durationMs: output.durationMs ?? null,
          waveformPeaks: output.waveformPeaks ?? null,
          width: CANVAS_AUDIO_ITEM_WIDTH,
          height: CANVAS_AUDIO_ITEM_HEIGHT,
          ...(sourceSurface ? { sourceSurface } : {}),
        };
      }
      if (output.mode === "video") {
        const videoUrl =
          displayAuthority?.playableMediaUrl ??
          output.resultUrls?.[0] ??
          output.previewUrl ??
          fallbackUrl ??
          null;
        if (!videoUrl) return null;
        return {
          kind: "video",
          outputId,
          mediaId,
          videoUrl,
          posterUrl: resolveCanvasPosterUrl(
            displayAuthority?.posterPreviewUrl,
            output.previewPosterUrl,
            fallbackUrl
          ),
          title: (output.prompt || output.previewText || "Canvas video").trim() || null,
          durationMs: output.durationMs ?? null,
          ...(visualDimensions ?? {}),
          ...(sourceSurface ? { sourceSurface } : {}),
        };
      }
      if (output.mode !== "image") return null;
      const sourceUrl = preferFallbackUrl
        ? (fallbackUrl ??
          displayAuthority?.fullMediaUrl ??
          displayAuthority?.cardDisplayUrl ??
          output.previewUrl ??
          output.resultUrls?.[imageIndex] ??
          null)
        : (displayAuthority?.fullMediaUrl ??
          displayAuthority?.cardDisplayUrl ??
          output.previewUrl ??
          output.resultUrls?.[imageIndex] ??
          fallbackUrl ??
          null);
      if (!sourceUrl) return null;
      return {
        kind: "image",
        outputId,
        mediaId,
        src: sourceUrl,
        alt: (output.prompt || output.previewText || "Canvas reference").trim(),
        ...(visualDimensions ?? {}),
        ...(sourceSurface ? { sourceSurface } : {}),
      };
    },
    [normalizeCanvasVisualDimensions, resolveCanvasPosterUrl]
  );

  const projectOutputIdsToQuickSlot = useCallback(
    (outputIds: string[], options: QuickSlotDropOptions): string[] => {
      if (outputIds.length === 0) return [];

      if (options.placement === "start") {
        [...outputIds].reverse().forEach((outputId) => {
          addCuratedReference(outputId);
        });
        return outputIds;
      }

      if (options.placement === "end") {
        outputIds.forEach((outputId) => {
          addCuratedReference(outputId);
          reorderCuratedReference(outputId, null, "end");
        });
        return outputIds;
      }

      if (options.placement === "after") {
        let anchorId = options.targetId;
        outputIds.forEach((outputId) => {
          addCuratedReference(outputId);
          reorderCuratedReference(outputId, anchorId, "after");
          anchorId = outputId;
        });
        return outputIds;
      }

      let anchorId = options.targetId;
      [...outputIds].reverse().forEach((outputId) => {
        addCuratedReference(outputId);
        reorderCuratedReference(outputId, anchorId, "before");
        anchorId = outputId;
      });
      return outputIds;
    },
    [addCuratedReference, reorderCuratedReference]
  );

  const handleQuickSlotLibraryMediaDrop = useCallback(
    async (payload: LibraryMediaReferencePayload, options?: QuickSlotDropOptions) => {
      const insertedId = await addLibraryMediaReferenceToQuickSlot(payload, options);
      if (!insertedId) return null;
      addCuratedReference(insertedId);
      if (options && options.placement !== "start") {
        reorderCuratedReference(insertedId, options.targetId, options.placement);
      }
      setActiveOutputId(insertedId);
      return insertedId;
    },
    [
      addCuratedReference,
      addLibraryMediaReferenceToQuickSlot,
      reorderCuratedReference,
      setActiveOutputId,
    ]
  );

  const handleQuickSlotDroppedFiles = useCallback(
    async (files: FileList, options?: QuickSlotDropOptions) => {
      const { mediaFiles, rejectedFileCount } = ensureDroppedMediaFiles(files);
      if (mediaFiles.length === 0) return [];
      const insertedResults = await ingestReferenceFiles(mediaFiles, "drop");
      if (rejectedFileCount > 0 && insertedResults.length > 0) {
        setUiError?.(SURFACE_DIRECT_DROP_PARTIAL_MESSAGE);
      }
      const insertedOutputIds = projectOutputIdsToQuickSlot(
        insertedResults.map((result) => result.outputId).filter(Boolean),
        {
          targetId: options?.targetId ?? null,
          placement: options?.placement ?? "start",
        }
      );
      const activeOutputId = insertedOutputIds[insertedOutputIds.length - 1] ?? null;
      if (activeOutputId) {
        setActiveOutputId(activeOutputId);
      }
      return insertedOutputIds;
    },
    [
      ensureDroppedMediaFiles,
      ingestReferenceFiles,
      projectOutputIdsToQuickSlot,
      setActiveOutputId,
      setUiError,
    ]
  );

  const handleQuickSlotDroppedMediaReference = useCallback(
    (payload: PastedMediaReference, options?: QuickSlotDropOptions) => {
      const insertedOutputs = insertPastedMediaReference(payload);
      const insertedOutputIds = projectOutputIdsToQuickSlot(
        insertedOutputs.map((output) => output.id).filter(Boolean),
        {
          targetId: options?.targetId ?? null,
          placement: options?.placement ?? "start",
        }
      );
      const activeOutputId = insertedOutputIds[insertedOutputIds.length - 1] ?? null;
      if (activeOutputId) {
        setActiveOutputId(activeOutputId);
      }
      return activeOutputId;
    },
    [insertPastedMediaReference, projectOutputIdsToQuickSlot, setActiveOutputId]
  );

  const handleQuickSlotLibraryPromptDrop = useCallback(
    (payload: LibraryPromptReferencePayload, options?: QuickSlotDropOptions) => {
      const insertedId = addLibraryPromptReferenceToQuickSlot(payload, options);
      if (!insertedId) return null;
      addCuratedReference(insertedId);
      if (options && options.placement !== "start") {
        reorderCuratedReference(insertedId, options.targetId, options.placement);
      }
      setActiveOutputId(insertedId);
      return insertedId;
    },
    [
      addCuratedReference,
      addLibraryPromptReferenceToQuickSlot,
      reorderCuratedReference,
      setActiveOutputId,
    ]
  );

  const resolveCanvasDropReference = useCallback<ResolveCanvasDropReference>(
    (payload) => {
      const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
      const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
      const output = outputId ? getOutputById(outputId) : null;
      if (!output) return null;
      const fallbackUrl = payload.referenceUrl ?? payload.referenceRenderUrl ?? null;
      return resolveCanvasResolutionFromOutput({
        output,
        fallbackUrl,
        outputId: outputId || null,
        mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
        sourceSurface: payload.sourceSurface ?? null,
        width: payload.width,
        height: payload.height,
        imageIndex,
        preferFallbackUrl: true,
      });
    },
    [getOutputById, resolveCanvasResolutionFromOutput]
  );

  const prepareResolvedInternalCanvasDrop = useCallback<PrepareResolvedInternalCanvasDrop>(
    async (payload, resolved) => {
      const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
      const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
      const output = outputId ? getOutputById(outputId) : null;
      if (!output || output.mode === "text") return resolved;
      try {
        const displayAuthority = await resolveCanvasStudioOutputMediaDisplayAuthority(output);
        const prepared = resolveCanvasResolutionFromOutput({
          output,
          fallbackUrl:
            resolved?.kind === "image"
              ? resolved.src
              : resolved?.kind === "audio"
                ? resolved.audioUrl
                : resolved?.kind === "video"
                  ? resolved.videoUrl
                  : (payload.referenceRenderUrl ?? payload.referenceUrl ?? null),
          outputId: outputId || null,
          mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
          sourceSurface: payload.sourceSurface ?? null,
          width:
            resolved && "width" in resolved && typeof resolved.width === "number"
              ? resolved.width
              : payload.width,
          height:
            resolved && "height" in resolved && typeof resolved.height === "number"
              ? resolved.height
              : payload.height,
          imageIndex,
          preferFallbackUrl: false,
          displayAuthority,
        });
        return prepared ?? resolved;
      } catch (error) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "canvas.internal_reference_media_authority_resolve_failed",
          data: {
            outputId,
            mode: output.mode,
            mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
        return resolved;
      }
    },
    [getOutputById, resolveCanvasResolutionFromOutput]
  );

  const resolveVoiceChangerInternalReferenceSource =
    useCallback<ResolveVoiceChangerInternalReferenceSource>(
      async (payload) => {
        const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
        const output = outputId ? getOutputById(outputId) : null;
        if (!output || (output.mode !== "audio" && output.mode !== "video")) return null;

        const kind = output.mode;
        const referenceMediaId =
          payload.mediaId?.trim() || resolveSavedMediaIdFromOutput(output, payload.imageIndex ?? 0);
        const storagePath = resolveVoiceChangerOutputStoragePath(output);
        const remoteUrl = resolveVoiceChangerOutputRemoteUrl({
          output,
          kind,
          payloadReferenceUrl: payload.referenceUrl,
        });
        const displayName =
          normalizeOptionalText(output.prompt || output.previewText) ?? `Reference Grid ${kind}`;

        if (storagePath || remoteUrl) {
          return createVoiceChangerSourceFromReference({
            kind,
            origin: "reference-grid",
            name: displayName,
            mimeType: output.mimeType ?? null,
            sourceUrl: remoteUrl,
            previewUrl: kind === "video" ? remoteUrl : null,
            storagePath,
            durationMs: output.durationMs ?? null,
            referenceOutputId: outputId || null,
            referenceMediaId,
          });
        }

        const localUrl = resolveVoiceChangerOutputLocalUrl(output);
        if (!localUrl) return null;

        try {
          const response = await fetch(localUrl);
          if (!response.ok) return null;
          const blob = await response.blob();
          if (!(blob instanceof Blob) || blob.size <= 0) return null;
          const mimeType =
            blob.type || output.mimeType || (kind === "audio" ? "audio/mpeg" : "video/mp4");
          const file = new File(
            [blob],
            resolveVoiceChangerBlobFilename({ output, kind, mimeType }),
            { type: mimeType }
          );
          return createVoiceChangerSourceFromFile(file, {
            origin: "reference-grid",
            referenceOutputId: outputId || null,
            referenceMediaId,
            durationMs: output.durationMs ?? null,
          });
        } catch (error) {
          addBreadcrumb({
            type: "ui",
            level: "warn",
            message: "voice_changer.internal_reference_resolve_failed",
            data: {
              outputId,
              mediaId: referenceMediaId,
              mode: output.mode,
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          });
          return null;
        }
      },
      [getOutputById]
    );

  const prepareCanvasMediaLibraryDrop = useCallback<PrepareCanvasMediaLibraryDrop>(
    async (payload): Promise<CanvasDropResolution | null> => {
      if (payload.kind === "libraryMedia") {
        const insertedOutputId = await addLibraryMediaReferenceToQuickSlot(payload.payload);
        if (!insertedOutputId) return null;
        const visualDimensions = normalizeCanvasVisualDimensions(
          payload.payload.width,
          payload.payload.height
        );
        const displayAuthority = await resolveCanvasLibraryMediaDisplayAuthority(payload.payload);
        const previewSrc = displayAuthority.mediaUrl;
        if (!previewSrc) return null;
        if (payload.payload.fileType === "audio") {
          return {
            kind: "audio",
            outputId: insertedOutputId,
            mediaId: payload.payload.id,
            audioUrl: previewSrc,
            title:
              (payload.payload.filename || payload.payload.promptText || "Canvas audio").trim() ||
              null,
            companionArtUrl: payload.payload.companionArtUrl ?? null,
            companionArtStoragePath: payload.payload.companionArtStoragePath ?? null,
            audioSourceMode: payload.payload.audioSourceMode ?? null,
            durationMs: payload.payload.durationMs ?? null,
            waveformPeaks: payload.payload.waveformPeaks ?? null,
            width: CANVAS_AUDIO_ITEM_WIDTH,
            height: CANVAS_AUDIO_ITEM_HEIGHT,
          };
        }
        if (payload.payload.fileType === "video") {
          return {
            kind: "video",
            outputId: insertedOutputId,
            mediaId: payload.payload.id,
            videoUrl: previewSrc,
            posterUrl: resolveCanvasPosterUrl(
              displayAuthority.posterUrl,
              payload.payload.previewPosterUrl
            ),
            title:
              (payload.payload.filename || payload.payload.promptText || "Canvas video").trim() ||
              null,
            durationMs: payload.payload.durationMs ?? null,
            ...(visualDimensions ?? {}),
          };
        }
        return {
          kind: "image",
          outputId: insertedOutputId,
          mediaId: payload.payload.id,
          src: previewSrc,
          alt: (payload.payload.filename || payload.payload.promptText || "Canvas media").trim(),
          ...(visualDimensions ?? {}),
        };
      }

      const promptText = payload.payload.promptText.trim();
      if (!promptText) return null;
      const outputId = addLibraryPromptReferenceToQuickSlot(payload.payload);
      if (!outputId) return null;
      return {
        kind: "text",
        outputId: null,
        text: promptText,
      };
    },
    [
      addLibraryMediaReferenceToQuickSlot,
      addLibraryPromptReferenceToQuickSlot,
      normalizeCanvasVisualDimensions,
      resolveCanvasPosterUrl,
    ]
  );

  const resolveCanvasDroppedMediaReference = useCallback<ResolveCanvasDroppedMediaReference>(
    (payload) => {
      const insertedOutput = insertPastedMediaReference(payload)[0];
      if (!insertedOutput) return null;
      return resolveCanvasResolutionFromOutput({
        output: insertedOutput,
        fallbackUrl: payload.url ?? null,
      });
    },
    [insertPastedMediaReference, resolveCanvasResolutionFromOutput]
  );

  const resolveCanvasDropFiles = useCallback(
    async (files: FileList): Promise<CanvasDropResolution[] | null> => {
      const { mediaFiles, rejectedFileCount } = ensureDroppedMediaFiles(files);
      if (mediaFiles.length === 0) return null;
      const insertedResults = await ingestReferenceFiles(mediaFiles, "drop");
      if (rejectedFileCount > 0 && insertedResults.length > 0) {
        setUiError?.(SURFACE_DIRECT_DROP_PARTIAL_MESSAGE);
      }
      const resolvedItems = insertedResults.flatMap((result) => {
        const resolved = resolveCanvasResolutionFromOutput({
          output: result.output,
          outputId: result.outputId,
          mediaId: resolveSavedMediaIdFromOutput(result.output, 0),
          fallbackUrl: result.output.resultUrls?.[0] ?? result.output.previewUrl ?? null,
          width: result.payload.width ?? null,
          height: result.payload.height ?? null,
        });
        return resolved ? [resolved] : [];
      });
      if (resolvedItems.length === 0) {
        setUiError?.("Unable to place that media on the canvas right now.");
        return null;
      }
      return resolvedItems;
    },
    [ensureDroppedMediaFiles, ingestReferenceFiles, resolveCanvasResolutionFromOutput, setUiError]
  );

  const handleOpenCanvasMediaDetail = useCallback(
    (item: CanvasSceneItem, instanceId: CanvasWorkspaceInstanceId) => {
      if (item.kind === "text") return;
      const outputId = item.outputId?.trim() || "";
      if (outputId) {
        const output = getOutputById(outputId);
        if (output) {
          setDetailSelectionTarget({
            kind: "studio-output",
            outputId: output.id,
            surface: "right-rail-canvas",
          });
          return;
        }
      }
      setDetailSelectionTarget({
        kind: "canvas-item",
        itemId: item.id,
        surface: "right-rail-canvas",
        instanceId,
      });
    },
    [getOutputById, setDetailSelectionTarget]
  );

  const {
    railCanvasProps: baseRailCanvasProps,
    sessionState: canvasSessionState,
    hydrateSessionState: hydrateCanvasSessionState,
  } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
    onPinTextReference: addPastedPromptReference,
    onOpenMediaDetail: handleOpenCanvasMediaDetail,
    canvasTearOutTargetRegistry,
    getCanvasTearOutOutputById: getOutputById,
  });
  const canvasSessionStateRef = useRef<CanvasWorkspaceSessionState>(canvasSessionState);
  const canvasMediaRenderRetryKeysRef = useRef(new Set<string>());

  useEffect(() => {
    canvasSessionStateRef.current = canvasSessionState;
  }, [canvasSessionState]);

  const applyCanvasSessionItemUpdate = useCallback(
    (itemId: string, resolveNextItem: (item: CanvasSceneItem) => CanvasSceneItem): boolean => {
      const currentState = canvasSessionStateRef.current;
      let changed = false;
      const nextItems = currentState.items.map((item) => {
        if (item.id !== itemId) return item;
        const nextItem = resolveNextItem(item);
        if (nextItem !== item) changed = true;
        return nextItem;
      });
      if (!changed) return false;
      hydrateCanvasSessionState({
        ...currentState,
        items: nextItems,
      });
      return true;
    },
    [hydrateCanvasSessionState]
  );

  const removeCanvasItemsForOutput = useCallback(
    (outputId: string): boolean => {
      const normalizedOutputId = outputId.trim();
      if (!normalizedOutputId) return false;
      const currentState = canvasSessionStateRef.current;
      const removedItemIds = new Set(
        currentState.items
          .filter((item) => item.outputId === normalizedOutputId)
          .map((item) => item.id)
      );
      if (!removedItemIds.size) return false;
      const nextItems = currentState.items.filter((item) => !removedItemIds.has(item.id));
      hydrateCanvasSessionState({
        ...currentState,
        items: nextItems,
        textEditSession:
          currentState.textEditSession && removedItemIds.has(currentState.textEditSession.itemId)
            ? null
            : currentState.textEditSession,
      });
      return true;
    },
    [hydrateCanvasSessionState]
  );

  const applyCanvasOutputRetryResolution = useCallback(
    ({
      itemId,
      outputId,
      resolved,
      forceVideoPlaceholderWithoutPoster,
    }: {
      itemId: string;
      outputId: string;
      resolved: CanvasDropResolution;
      forceVideoPlaceholderWithoutPoster?: boolean;
    }): boolean =>
      applyCanvasSessionItemUpdate(itemId, (item) => {
        if (
          (item.kind !== "image" && item.kind !== "audio" && item.kind !== "video") ||
          resolved.kind !== item.kind
        ) {
          return item;
        }

        if (item.kind === "image" && resolved.kind === "image") {
          const nextMediaId = resolved.mediaId ?? item.mediaId ?? null;
          if (
            outputId === item.outputId &&
            resolved.src === item.src &&
            resolved.alt === item.alt &&
            nextMediaId === (item.mediaId ?? null)
          ) {
            return item;
          }
          return {
            ...item,
            outputId,
            src: resolved.src,
            alt: resolved.alt,
            mediaId: nextMediaId,
          };
        }

        if (item.kind === "video" && resolved.kind === "video") {
          const nextMediaId = resolved.mediaId ?? item.mediaId ?? null;
          const nextPosterUrl = forceVideoPlaceholderWithoutPoster
            ? null
            : (resolved.posterUrl ?? item.posterUrl ?? null);
          const nextTitle = resolved.title ?? item.title ?? null;
          const nextDurationMs = resolved.durationMs ?? item.durationMs ?? null;
          if (
            outputId === item.outputId &&
            resolved.videoUrl === item.videoUrl &&
            nextPosterUrl === (item.posterUrl ?? null) &&
            nextTitle === (item.title ?? null) &&
            nextDurationMs === (item.durationMs ?? null) &&
            nextMediaId === (item.mediaId ?? null)
          ) {
            return item;
          }
          return {
            ...item,
            outputId,
            mediaId: nextMediaId,
            videoUrl: resolved.videoUrl,
            posterUrl: nextPosterUrl,
            title: nextTitle,
            durationMs: nextDurationMs,
          };
        }

        if (item.kind === "audio" && resolved.kind === "audio") {
          const nextMediaId = resolved.mediaId ?? item.mediaId ?? null;
          const nextCompanionArtUrl = resolved.companionArtUrl ?? item.companionArtUrl ?? null;
          const nextCompanionArtStoragePath =
            resolved.companionArtStoragePath ?? item.companionArtStoragePath ?? null;
          const nextTitle = resolved.title ?? item.title ?? null;
          const nextDurationMs = resolved.durationMs ?? item.durationMs ?? null;
          const nextAudioSourceMode = resolved.audioSourceMode ?? item.audioSourceMode ?? null;
          const nextWaveformPeaks = resolved.waveformPeaks ?? item.waveformPeaks ?? null;
          if (
            outputId === item.outputId &&
            resolved.audioUrl === item.audioUrl &&
            nextTitle === (item.title ?? null) &&
            nextCompanionArtUrl === (item.companionArtUrl ?? null) &&
            nextCompanionArtStoragePath === (item.companionArtStoragePath ?? null) &&
            nextDurationMs === (item.durationMs ?? null) &&
            nextAudioSourceMode === (item.audioSourceMode ?? null) &&
            nextMediaId === (item.mediaId ?? null) &&
            areNumberListsEqual(nextWaveformPeaks, item.waveformPeaks ?? null)
          ) {
            return item;
          }
          return {
            ...item,
            outputId,
            mediaId: nextMediaId,
            audioUrl: resolved.audioUrl,
            title: nextTitle,
            companionArtUrl: nextCompanionArtUrl,
            companionArtStoragePath: nextCompanionArtStoragePath,
            audioSourceMode: nextAudioSourceMode,
            durationMs: nextDurationMs,
            waveformPeaks: nextWaveformPeaks,
          };
        }

        return item;
      }),
    [applyCanvasSessionItemUpdate]
  );

  const applyCanvasMediaIdRetryAuthority = useCallback(
    (itemId: string, authority: SessionSignedMediaRestoreAuthority): boolean =>
      applyCanvasSessionItemUpdate(itemId, (item) => {
        if (item.kind === "image") {
          const nextSrc = authority.signedPreviewUrl ?? authority.signedFullUrl;
          if (!nextSrc || nextSrc === item.src) return item;
          return {
            ...item,
            src: nextSrc,
          };
        }

        if (item.kind === "video") {
          const nextVideoUrl = authority.signedFullUrl ?? authority.signedPreviewUrl;
          const nextPosterUrl = authority.signedPreviewPosterUrl ?? null;
          if (
            (!nextVideoUrl || nextVideoUrl === item.videoUrl) &&
            nextPosterUrl === (item.posterUrl ?? null)
          ) {
            return item;
          }
          return {
            ...item,
            videoUrl: nextVideoUrl ?? item.videoUrl,
            posterUrl: nextPosterUrl,
          };
        }

        if (item.kind === "audio") {
          const nextAudioUrl = authority.signedFullUrl ?? authority.signedPreviewUrl;
          if (!nextAudioUrl || nextAudioUrl === item.audioUrl) return item;
          return {
            ...item,
            audioUrl: nextAudioUrl,
          };
        }

        return item;
      }),
    [applyCanvasSessionItemUpdate]
  );

  const handleCanvasMediaRenderError = useCallback(
    (failedItem: CanvasSceneItem) => {
      const retryKey = resolveCanvasMediaRenderRetryKey(failedItem);
      if (!retryKey || canvasMediaRenderRetryKeysRef.current.has(retryKey)) return;
      canvasMediaRenderRetryKeysRef.current.add(retryKey);

      void (async () => {
        const currentItem = canvasSessionStateRef.current.items.find(
          (item) => item.id === failedItem.id
        );
        if (
          !currentItem ||
          (currentItem.kind !== "image" &&
            currentItem.kind !== "audio" &&
            currentItem.kind !== "video")
        ) {
          return;
        }

        const outputId = currentItem.outputId?.trim() || "";
        if (outputId) {
          const outputSnapshot = getOutputSnapshot();
          const projectionOutputs = [
            ...outputSnapshot.outputOrder
              .map((id) => outputSnapshot.outputById[id])
              .filter((item): item is StudioOutput => Boolean(item)),
            ...outputSnapshot.archivedOutputOrder
              .map((id) => outputSnapshot.archivedOutputById[id])
              .filter((item): item is StudioOutput => Boolean(item)),
          ];
          const resolvedOutputId =
            resolveReferenceProjectionIds([outputId], projectionOutputs, {
              preserveUnresolved: true,
            })[0] ?? outputId;
          const output = getOutputById(resolvedOutputId);
          if (output) {
            try {
              const displayAuthority = await resolveCanvasStudioOutputMediaDisplayAuthority(
                output,
                (storagePath) =>
                  getSignedMediaUrl({
                    bucket: CANVAS_MEDIA_LIBRARY_BUCKET,
                    storagePath,
                    forceRefresh: true,
                  })
              );
              const resolved = resolveCanvasResolutionFromOutput({
                output,
                outputId: resolvedOutputId,
                mediaId: "mediaId" in currentItem ? (currentItem.mediaId ?? null) : null,
                fallbackUrl: resolveCanvasMediaFallbackUrl(currentItem),
                width: "width" in currentItem ? currentItem.width : undefined,
                height: "height" in currentItem ? currentItem.height : undefined,
                displayAuthority,
              });
              if (resolved) {
                const applied = applyCanvasOutputRetryResolution({
                  itemId: currentItem.id,
                  outputId: resolvedOutputId,
                  resolved,
                  forceVideoPlaceholderWithoutPoster:
                    currentItem.kind === "video" && !displayAuthority.posterPreviewUrl,
                });
                if (applied) return;
              }
            } catch (error) {
              addBreadcrumb({
                type: "ui",
                level: "warn",
                message: "ai_studio_canvas_media_render_output_retry_failed",
                data: {
                  itemId: currentItem.id,
                  outputId: resolvedOutputId,
                  kind: currentItem.kind,
                  error: error instanceof Error ? error.message : "unknown_error",
                },
              });
            }
          }
        }

        const mediaId = "mediaId" in currentItem ? currentItem.mediaId?.trim() || "" : "";
        if (!mediaId) return;
        try {
          const authorityByMediaId = await resolveSessionRestoreSignedMediaAuthorityByMediaId(
            [mediaId],
            { forceRefresh: true }
          );
          const authority = authorityByMediaId.get(mediaId);
          if (!authority) return;
          canvasMediaRestoreAuthorityCacheRef.current.set(mediaId, authority);
          applyCanvasMediaIdRetryAuthority(currentItem.id, authority);
        } catch (error) {
          addBreadcrumb({
            type: "ui",
            level: "warn",
            message: "ai_studio_canvas_media_render_media_retry_failed",
            data: {
              itemId: currentItem.id,
              mediaId,
              kind: currentItem.kind,
              error: error instanceof Error ? error.message : "unknown_error",
            },
          });
        }
      })();
    },
    [
      applyCanvasMediaIdRetryAuthority,
      applyCanvasOutputRetryResolution,
      getOutputById,
      getOutputSnapshot,
      resolveCanvasResolutionFromOutput,
    ]
  );

  const handleRailCanvasItemDragStart = useCallback(
    (id: string, event: DragEvent<HTMLElement>) => {
      if (!event.shiftKey) {
        event.preventDefault();
        return;
      }
      const item = canvasSessionState.items.find((candidate) => candidate.id === id);
      if (!item) {
        event.preventDefault();
        return;
      }

      if (item.kind === "text") {
        const promptText = item.text.trim();
        if (!promptText) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", promptText);
        event.dataTransfer.setData("text/prompt", promptText);
        event.currentTarget.classList.add("is-dragging");
        attachMediaLibraryDragGhost(event, {
          label: "Prompt",
          detail: promptText,
          template: "prompt",
        });
        return;
      }

      const outputId = item.outputId?.trim() || "";
      if (!outputId) {
        event.preventDefault();
        return;
      }
      const output = getOutputById(outputId);
      if (!output) {
        event.preventDefault();
        return;
      }

      prepareReferenceDrag(event, output, {
        dragImage: event.currentTarget as HTMLElement,
        sourceSurface: "all-refs",
      });
    },
    [canvasSessionState.items, getOutputById]
  );

  const handleRailCanvasItemDragEnd = useCallback((_: string, event: DragEvent<HTMLElement>) => {
    event.currentTarget.classList.remove("is-dragging");
    clearDragState(event);
    clearMediaLibraryDragGhost(event);
  }, []);

  const railCanvasProps: CanvasPropertiesPanelProps = useMemo(
    () => ({
      ...baseRailCanvasProps,
      isItemDraggable: true,
      onItemDragStart: handleRailCanvasItemDragStart,
      onItemDragEnd: handleRailCanvasItemDragEnd,
      onCanvasMediaRenderError: handleCanvasMediaRenderError,
    }),
    [
      baseRailCanvasProps,
      handleCanvasMediaRenderError,
      handleRailCanvasItemDragEnd,
      handleRailCanvasItemDragStart,
    ]
  );
  const stableRailCanvasProps = useCanvasPropertiesPanelLivePropsBridge(railCanvasProps);

  useEffect(() => {
    const outputSnapshot = getOutputSnapshot();
    const projectionOutputs = [
      ...outputSnapshot.outputOrder
        .map((id) => outputSnapshot.outputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
      ...outputSnapshot.archivedOutputOrder
        .map((id) => outputSnapshot.archivedOutputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
    ];
    let changed = false;
    const nextItems = canvasSessionState.items.map((item) => {
      if (
        (item.kind !== "image" && item.kind !== "audio" && item.kind !== "video") ||
        !item.outputId
      ) {
        return item;
      }
      const resolvedOutputId =
        resolveReferenceProjectionIds([item.outputId], projectionOutputs, {
          preserveUnresolved: true,
        })[0] ?? item.outputId;
      const output = getOutputById(resolvedOutputId);
      if (!output) return item;
      const resolved = resolveCanvasResolutionFromOutput({
        output,
        outputId: resolvedOutputId,
        mediaId: "mediaId" in item ? (item.mediaId ?? null) : null,
        fallbackUrl:
          item.kind === "image" ? item.src : item.kind === "audio" ? item.audioUrl : item.videoUrl,
        width: "width" in item ? item.width : undefined,
        height: "height" in item ? item.height : undefined,
      });
      if (!resolved || resolved.kind !== item.kind) return item;
      if (item.kind === "image" && resolved.kind === "image") {
        const nextMediaId = resolved.mediaId ?? item.mediaId ?? null;
        if (
          resolvedOutputId === item.outputId &&
          resolved.src === item.src &&
          resolved.alt === item.alt &&
          nextMediaId === (item.mediaId ?? null)
        ) {
          return item;
        }
        changed = true;
        return {
          ...item,
          outputId: resolvedOutputId,
          src: resolved.src,
          alt: resolved.alt,
          mediaId: nextMediaId,
        };
      }
      if (item.kind === "video" && resolved.kind === "video") {
        const nextMediaId = resolved.mediaId ?? item.mediaId ?? null;
        const nextPosterUrl = resolved.posterUrl ?? item.posterUrl ?? null;
        const nextTitle = resolved.title ?? item.title ?? null;
        const nextDurationMs = resolved.durationMs ?? item.durationMs ?? null;
        if (
          resolvedOutputId === item.outputId &&
          resolved.videoUrl === item.videoUrl &&
          nextPosterUrl === (item.posterUrl ?? null) &&
          nextTitle === (item.title ?? null) &&
          nextDurationMs === (item.durationMs ?? null) &&
          nextMediaId === (item.mediaId ?? null)
        ) {
          return item;
        }
        changed = true;
        return {
          ...item,
          outputId: resolvedOutputId,
          mediaId: nextMediaId,
          videoUrl: resolved.videoUrl,
          posterUrl: nextPosterUrl,
          title: nextTitle,
          durationMs: nextDurationMs,
        };
      }
      if (item.kind === "audio" && resolved.kind === "audio") {
        const nextMediaId = resolved.mediaId ?? item.mediaId ?? null;
        const nextCompanionArtUrl = resolved.companionArtUrl ?? item.companionArtUrl ?? null;
        const nextCompanionArtStoragePath =
          resolved.companionArtStoragePath ?? item.companionArtStoragePath ?? null;
        const nextTitle = resolved.title ?? item.title ?? null;
        const nextDurationMs = resolved.durationMs ?? item.durationMs ?? null;
        const nextAudioSourceMode = resolved.audioSourceMode ?? item.audioSourceMode ?? null;
        const nextWaveformPeaks = resolved.waveformPeaks ?? item.waveformPeaks ?? null;
        if (
          resolvedOutputId === item.outputId &&
          resolved.audioUrl === item.audioUrl &&
          nextTitle === (item.title ?? null) &&
          nextCompanionArtUrl === (item.companionArtUrl ?? null) &&
          nextCompanionArtStoragePath === (item.companionArtStoragePath ?? null) &&
          nextDurationMs === (item.durationMs ?? null) &&
          nextAudioSourceMode === (item.audioSourceMode ?? null) &&
          nextMediaId === (item.mediaId ?? null) &&
          areNumberListsEqual(nextWaveformPeaks, item.waveformPeaks ?? null)
        ) {
          return item;
        }
        changed = true;
        return {
          ...item,
          outputId: resolvedOutputId,
          mediaId: nextMediaId,
          audioUrl: resolved.audioUrl,
          title: nextTitle,
          companionArtUrl: nextCompanionArtUrl,
          companionArtStoragePath: nextCompanionArtStoragePath,
          audioSourceMode: nextAudioSourceMode,
          durationMs: nextDurationMs,
          waveformPeaks: nextWaveformPeaks,
        };
      }
      return item;
    });
    if (!changed) return;
    hydrateCanvasSessionState({
      ...canvasSessionState,
      items: nextItems,
    });
  }, [
    canvasSessionState,
    getOutputById,
    getOutputSnapshot,
    hydrateCanvasSessionState,
    resolveCanvasResolutionFromOutput,
  ]);

  useEffect(() => {
    const outputSnapshot = getOutputSnapshot();
    const projectionOutputs = [
      ...outputSnapshot.outputOrder
        .map((id) => outputSnapshot.outputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
      ...outputSnapshot.archivedOutputOrder
        .map((id) => outputSnapshot.archivedOutputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
    ];
    const candidates = canvasSessionState.items.flatMap((item) => {
      if (item.kind !== "video" || !item.outputId || item.posterUrl) return [];
      const resolvedOutputId =
        resolveReferenceProjectionIds([item.outputId], projectionOutputs, {
          preserveUnresolved: true,
        })[0] ?? item.outputId;
      const output = getOutputById(resolvedOutputId);
      if (!output || output.mode !== "video") return [];
      const posterStoragePath = resolveVideoPosterStoragePath({
        previewPosterStoragePath: output.previewPosterStoragePath,
        previewStoragePath: output.previewStoragePath,
        fullStoragePath: output.fullStoragePath,
      });
      if (!posterStoragePath && !output.previewPosterUrl) return [];
      return [
        {
          item,
          output,
          outputId: resolvedOutputId,
        },
      ];
    });
    if (candidates.length === 0) return;

    let cancelled = false;
    void Promise.all(
      candidates.map(async ({ item, output, outputId }) => {
        try {
          const displayAuthority = await resolveCanvasStudioOutputMediaDisplayAuthority(output);
          const resolved = resolveCanvasResolutionFromOutput({
            output,
            outputId,
            mediaId: item.mediaId ?? resolveSavedMediaIdFromOutput(output, 0),
            fallbackUrl: item.videoUrl,
            width: item.width,
            height: item.height,
            displayAuthority,
          });
          return {
            itemId: item.id,
            outputId,
            resolved,
          };
        } catch {
          return null;
        }
      })
    ).then((resolvedCandidates) => {
      if (cancelled) return;
      const resolvedByItemId = new Map(
        resolvedCandidates
          .filter(
            (
              entry
            ): entry is {
              itemId: string;
              outputId: string;
              resolved: Extract<CanvasDropResolution, { kind: "video" }>;
            } => Boolean(entry?.resolved && entry.resolved.kind === "video")
          )
          .map((entry) => [entry.itemId, entry])
      );
      if (resolvedByItemId.size === 0) return;

      let changed = false;
      const nextItems = canvasSessionState.items.map((item) => {
        if (item.kind !== "video") return item;
        const entry = resolvedByItemId.get(item.id);
        const posterUrl = entry?.resolved.posterUrl?.trim() || null;
        if (!entry || !posterUrl) return item;
        const nextMediaId = entry.resolved.mediaId ?? item.mediaId ?? null;
        const nextTitle = entry.resolved.title ?? item.title ?? null;
        const nextDurationMs = entry.resolved.durationMs ?? item.durationMs ?? null;
        if (
          entry.outputId === item.outputId &&
          entry.resolved.videoUrl === item.videoUrl &&
          posterUrl === (item.posterUrl ?? null) &&
          nextTitle === (item.title ?? null) &&
          nextDurationMs === (item.durationMs ?? null) &&
          nextMediaId === (item.mediaId ?? null)
        ) {
          return item;
        }
        changed = true;
        return {
          ...item,
          outputId: entry.outputId,
          mediaId: nextMediaId,
          videoUrl: entry.resolved.videoUrl,
          posterUrl,
          title: nextTitle,
          durationMs: nextDurationMs,
        };
      });

      if (!changed) return;
      hydrateCanvasSessionState({
        ...canvasSessionState,
        items: nextItems,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    canvasSessionState,
    getOutputById,
    getOutputSnapshot,
    hydrateCanvasSessionState,
    resolveCanvasResolutionFromOutput,
  ]);

  useEffect(() => {
    const mediaIds = Array.from(
      new Set(
        canvasSessionState.items
          .map((item) =>
            (item.kind === "image" || item.kind === "audio" || item.kind === "video") &&
            item.mediaId
              ? item.mediaId.trim()
              : ""
          )
          .filter((mediaId): mediaId is string => mediaId.length > 0)
      )
    );
    if (mediaIds.length === 0) return;

    const applyCachedAuthority = (): boolean => {
      let changed = false;
      const nextItems = canvasSessionState.items.map((item) => {
        if (
          (item.kind !== "image" && item.kind !== "audio" && item.kind !== "video") ||
          !item.mediaId
        ) {
          return item;
        }
        const authority = canvasMediaRestoreAuthorityCacheRef.current.get(item.mediaId);
        if (!authority) return item;

        if (item.kind === "image") {
          const nextSrc = authority.signedPreviewUrl ?? authority.signedFullUrl;
          if (!nextSrc || nextSrc === item.src) return item;
          changed = true;
          return {
            ...item,
            src: nextSrc,
          };
        }

        if (item.kind === "video") {
          const nextVideoUrl = authority.signedFullUrl ?? authority.signedPreviewUrl;
          const nextPosterUrl = authority.signedPreviewPosterUrl ?? item.posterUrl ?? null;
          if (
            (!nextVideoUrl || nextVideoUrl === item.videoUrl) &&
            nextPosterUrl === (item.posterUrl ?? null)
          ) {
            return item;
          }
          changed = true;
          return {
            ...item,
            videoUrl: nextVideoUrl ?? item.videoUrl,
            posterUrl: nextPosterUrl,
          };
        }

        const nextAudioUrl = authority.signedFullUrl ?? authority.signedPreviewUrl;
        if (!nextAudioUrl || nextAudioUrl === item.audioUrl) return item;
        changed = true;
        return {
          ...item,
          audioUrl: nextAudioUrl,
        };
      });

      if (!changed) return false;
      hydrateCanvasSessionState({
        ...canvasSessionState,
        items: nextItems,
      });
      return true;
    };

    if (applyCachedAuthority()) return;

    const missingMediaIds = mediaIds.filter(
      (mediaId) => !canvasMediaRestoreAuthorityCacheRef.current.has(mediaId)
    );
    if (missingMediaIds.length === 0) return;

    let cancelled = false;
    void resolveSessionRestoreSignedMediaAuthorityByMediaId(missingMediaIds)
      .then((authorityByMediaId) => {
        if (cancelled) return;
        authorityByMediaId.forEach((authority, mediaId) => {
          canvasMediaRestoreAuthorityCacheRef.current.set(mediaId, authority);
        });
        applyCachedAuthority();
      })
      .catch((error) => {
        if (cancelled) return;
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "ai_studio_canvas_media_restore_signing_failed",
          data: {
            media_id_count: missingMediaIds.length,
            error: error instanceof Error ? error.message : "unknown_error",
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [canvasSessionState, hydrateCanvasSessionState]);

  return {
    canvasSessionState,
    handleQuickSlotDroppedFiles,
    handleQuickSlotDroppedMediaReference,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryPromptDrop,
    hydrateCanvasSessionState,
    removeCanvasItemsForOutput,
    railCanvasProps: stableRailCanvasProps,
    resolveVoiceChangerInternalReferenceSource,
  };
};
