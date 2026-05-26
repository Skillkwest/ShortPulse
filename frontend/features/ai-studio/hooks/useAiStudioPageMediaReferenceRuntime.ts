/**
 * AI Studio page media-reference runtime.
 * Owns quick-slot drop handling, canvas reference resolution, voice-changer internal references,
 * and dual-canvas workspace wiring for the page shell.
 */
import { useCallback, useEffect } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { useAiStudioDualCanvasWorkspaceState } from "../components/canvas/useAiStudioCanvasWorkspaceState";
import type {
  CanvasDropResolution,
  PrepareCanvasMediaLibraryDrop,
  ResolveCanvasDropReference,
} from "../components/canvas/canvasTypes";
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
import { isImageFile } from "../logic/mediaLibraryModalModel";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";
import type { StudioOutput } from "../types";
import { resolveSavedMediaIdFromOutput } from "./useAiStudioInternalDropResolvers";

const IMAGE_FILE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|webp)$/i;
const SURFACE_DIRECT_DROP_PARTIAL_MESSAGE = "Some files could not be added. The rest were added.";

type QuickSlotDropOptions = {
  targetId: string | null;
  placement: "before" | "after" | "end";
};

type DirectDroppedImageFiles = {
  imageFiles: File[];
  rejectedFileCount: number;
};

type IngestedReferenceFileResult = Awaited<
  ReturnType<NonNullable<UseAiStudioPageMediaReferenceRuntimeParams["ingestReferenceFiles"]>>
>[number];

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
  getOutputById: (outputId: string) => StudioOutput | null;
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
    placement: "before" | "after" | "end"
  ) => void;
  setActiveOutputId: (outputId: string | null) => void;
  setUiError?: (message: string | null) => void;
};

/**
 * Returns page-shell media reference runtime helpers.
 */
export const useAiStudioPageMediaReferenceRuntime = ({
  addCuratedReference,
  addLibraryMediaReferenceToQuickSlot,
  addLibraryPromptReferenceToQuickSlot,
  addPastedPromptReference,
  getOutputById,
  ingestReferenceFiles,
  reorderCuratedReference,
  setActiveOutputId,
  setUiError,
}: UseAiStudioPageMediaReferenceRuntimeParams) => {
  const resolveDirectDroppedImageFiles = useCallback(
    (files: FileList | File[]): DirectDroppedImageFiles => {
      const droppedFiles = Array.from(files);
      const imageFiles = droppedFiles.filter((file) => {
        if (isImageFile(file.type)) return true;
        return !file.type && IMAGE_FILE_EXTENSION_PATTERN.test(file.name);
      });
      return {
        imageFiles,
        rejectedFileCount: Math.max(0, droppedFiles.length - imageFiles.length),
      };
    },
    []
  );

  const ensureDroppedImageFiles = useCallback(
    (files: FileList | File[]): DirectDroppedImageFiles => {
      const directDrop = resolveDirectDroppedImageFiles(files);
      if (directDrop.imageFiles.length > 0) return directDrop;
      setUiError?.("Drop image files here.");
      return directDrop;
    },
    [resolveDirectDroppedImageFiles, setUiError]
  );

  const projectOutputIdsToQuickSlot = useCallback(
    (insertedResults: IngestedReferenceFileResult[], options: QuickSlotDropOptions): string[] => {
      const outputIds = insertedResults.map((result) => result.outputId).filter(Boolean);
      if (outputIds.length === 0) return [];

      if (options.placement === "end" || !options.targetId) {
        outputIds.forEach((outputId) => {
          addCuratedReference(outputId);
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
      if (options?.targetId || options?.placement === "end") {
        reorderCuratedReference(insertedId, options?.targetId ?? null, options?.placement ?? "end");
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
      const { imageFiles, rejectedFileCount } = ensureDroppedImageFiles(files);
      if (imageFiles.length === 0) return [];
      const insertedResults = await ingestReferenceFiles(imageFiles, "drop");
      if (rejectedFileCount > 0 && insertedResults.length > 0) {
        setUiError?.(SURFACE_DIRECT_DROP_PARTIAL_MESSAGE);
      }
      const insertedOutputIds = projectOutputIdsToQuickSlot(insertedResults, {
        targetId: options?.targetId ?? null,
        placement: options?.placement ?? "end",
      });
      const activeOutputId = insertedOutputIds[insertedOutputIds.length - 1] ?? null;
      if (activeOutputId) {
        setActiveOutputId(activeOutputId);
      }
      return insertedOutputIds;
    },
    [
      ensureDroppedImageFiles,
      ingestReferenceFiles,
      projectOutputIdsToQuickSlot,
      setActiveOutputId,
      setUiError,
    ]
  );

  const handleQuickSlotLibraryPromptDrop = useCallback(
    (payload: LibraryPromptReferencePayload, options?: QuickSlotDropOptions) => {
      const insertedId = addLibraryPromptReferenceToQuickSlot(payload, options);
      if (!insertedId) return null;
      addCuratedReference(insertedId);
      if (options?.targetId || options?.placement === "end") {
        reorderCuratedReference(insertedId, options?.targetId ?? null, options?.placement ?? "end");
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
      if (output.mode === "text") {
        const text = (output.prompt || output.previewText || "").trim();
        if (!text) return null;
        return {
          kind: "text",
          outputId: outputId || null,
          text,
          sourceSurface: payload.sourceSurface ?? null,
        };
      }
      if (output.mode === "audio") {
        const audioUrl =
          output.resultUrls?.[0] ?? output.previewUrl ?? payload.referenceUrl ?? null;
        if (!audioUrl) return null;
        return {
          kind: "audio",
          outputId: outputId || null,
          mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
          audioUrl,
          title: (output.prompt || output.previewText || "Canvas audio").trim() || null,
          companionArtUrl: output.companionArtUrl ?? null,
          companionArtStoragePath: output.companionArtStoragePath ?? null,
          durationMs: output.durationMs ?? null,
          waveformPeaks: output.waveformPeaks ?? null,
          width: CANVAS_AUDIO_ITEM_WIDTH,
          height: CANVAS_AUDIO_ITEM_HEIGHT,
          sourceSurface: payload.sourceSurface ?? null,
        };
      }
      if (output.mode !== "image") return null;
      const sourceUrl =
        output.resultUrls?.[imageIndex] ?? output.previewUrl ?? payload.referenceUrl ?? null;
      if (!sourceUrl) return null;
      return {
        kind: "image",
        outputId: outputId || null,
        mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
        src: sourceUrl,
        alt: (output.prompt || output.previewText || "Canvas reference").trim(),
        sourceSurface: payload.sourceSurface ?? null,
      };
    },
    [getOutputById]
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
        const outputId = await addLibraryMediaReferenceToQuickSlot(payload.payload);
        if (!outputId) return null;
        const previewSrc =
          (payload.payload.fullUrl ?? "").trim() ||
          (payload.payload.previewUrl ?? "").trim() ||
          (payload.payload.url ?? "").trim();
        if (!previewSrc) return null;
        if (payload.payload.fileType === "audio") {
          return {
            kind: "audio",
            outputId,
            mediaId: payload.payload.id,
            audioUrl: previewSrc,
            title:
              (payload.payload.filename || payload.payload.promptText || "Canvas audio").trim() ||
              null,
            companionArtUrl: payload.payload.companionArtUrl ?? null,
            companionArtStoragePath: payload.payload.companionArtStoragePath ?? null,
            width: CANVAS_AUDIO_ITEM_WIDTH,
            height: CANVAS_AUDIO_ITEM_HEIGHT,
          };
        }
        const width =
          typeof payload.payload.width === "number" &&
          Number.isFinite(payload.payload.width) &&
          payload.payload.width > 0
            ? payload.payload.width
            : undefined;
        const height =
          typeof payload.payload.height === "number" &&
          Number.isFinite(payload.payload.height) &&
          payload.payload.height > 0
            ? payload.payload.height
            : undefined;
        return {
          kind: "image",
          outputId,
          mediaId: payload.payload.id,
          src: previewSrc,
          alt: (payload.payload.filename || payload.payload.promptText || "Canvas media").trim(),
          width,
          height,
        };
      }

      const promptText = payload.payload.promptText.trim();
      if (!promptText) return null;
      const outputId = addLibraryPromptReferenceToQuickSlot(payload.payload);
      if (!outputId) return null;
      return {
        kind: "text",
        outputId,
        text: promptText,
      };
    },
    [addLibraryMediaReferenceToQuickSlot, addLibraryPromptReferenceToQuickSlot]
  );

  const resolveCanvasDropFiles = useCallback(
    async (files: FileList): Promise<CanvasDropResolution[] | null> => {
      const { imageFiles, rejectedFileCount } = ensureDroppedImageFiles(files);
      if (imageFiles.length === 0) return null;
      const insertedResults = await ingestReferenceFiles(imageFiles, "drop");
      if (rejectedFileCount > 0 && insertedResults.length > 0) {
        setUiError?.(SURFACE_DIRECT_DROP_PARTIAL_MESSAGE);
      }
      const resolvedItems = insertedResults.flatMap((result) => {
        if (result.output.mode !== "image") return [];
        const sourceUrl = result.output.resultUrls?.[0] ?? result.output.previewUrl ?? null;
        if (!sourceUrl) return [];
        return [
          {
            kind: "image" as const,
            outputId: result.outputId,
            mediaId: resolveSavedMediaIdFromOutput(result.output, 0),
            src: sourceUrl,
            alt: (
              result.output.prompt ||
              result.output.previewText ||
              result.payload.filename ||
              result.file.name ||
              "Canvas media"
            ).trim(),
          },
        ];
      });
      if (resolvedItems.length === 0) {
        setUiError?.("Unable to place those images on the canvas right now.");
        return null;
      }
      return resolvedItems;
    },
    [ensureDroppedImageFiles, ingestReferenceFiles, setUiError]
  );

  const {
    railCanvasProps,
    sessionState: canvasSessionState,
    hydrateSessionState: hydrateCanvasSessionState,
  } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDropFiles,
    onPinTextReference: addPastedPromptReference,
  });

  useEffect(() => {
    let changed = false;
    const nextItems = canvasSessionState.items.map((item) => {
      if (item.kind !== "audio" || !item.outputId) return item;
      const output = getOutputById(item.outputId);
      if (!output || output.mode !== "audio") return item;
      const nextCompanionArtUrl = output.companionArtUrl ?? item.companionArtUrl ?? null;
      const nextCompanionArtStoragePath =
        output.companionArtStoragePath ?? item.companionArtStoragePath ?? null;
      if (
        nextCompanionArtUrl === (item.companionArtUrl ?? null) &&
        nextCompanionArtStoragePath === (item.companionArtStoragePath ?? null)
      ) {
        return item;
      }
      changed = true;
      return {
        ...item,
        companionArtUrl: nextCompanionArtUrl,
        companionArtStoragePath: nextCompanionArtStoragePath,
      };
    });
    if (!changed) return;
    hydrateCanvasSessionState({
      ...canvasSessionState,
      items: nextItems,
    });
  }, [canvasSessionState, getOutputById, hydrateCanvasSessionState]);

  return {
    canvasSessionState,
    handleQuickSlotDroppedFiles,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryPromptDrop,
    hydrateCanvasSessionState,
    railCanvasProps,
    resolveVoiceChangerInternalReferenceSource,
  };
};
