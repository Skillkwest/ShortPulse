/**
 * AI Studio internal-drop resolver hook.
 * Centralizes page-scoped drop resolution for character, canvas, media-library, and styles surfaces.
 */
import { useCallback } from "react";
import { resolveCanvasDropImageSourceUrl } from "../components/canvas/canvasDropResolvers";
import type { ResolveCanvasDropReference } from "../components/canvas/canvasTypes";
import type { PersistOutputSaveResult } from "./useAiStudioPersistenceActions";
import { resolveMediaLibraryInternalDropResolver } from "../logic/mediaLibraryInternalDropResolver";
import {
  resolveInternalReferenceSource,
  type ResolveInternalReferenceDrop,
  type ResolvedInternalReferenceSource,
} from "../logic/referenceSource/internalReferenceSource";
import type { StudioOutput } from "../types";
import type { InternalReferenceDragPayload, ReferenceDragSourceSurface } from "../utils/dragDrop";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";

const MEDIA_LIBRARY_INTERNAL_DROP_PERSIST_TIMEOUT_MS = 3500;
const MEDIA_LIBRARY_INTERNAL_DROP_POLL_INTERVAL_MS = 120;

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

type UseAiStudioInternalDropResolversParams = {
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => OutputSnapshot;
  ensureOutputPersisted: (outputId: string) => Promise<PersistOutputSaveResult>;
  saveReferenceToLibrary: (outputId: string) => unknown;
};

/**
 * Resolves a saved media id for the requested output image index, falling back to the first saved id.
 */
export const resolveSavedMediaIdFromOutput = (
  output: StudioOutput | null,
  imageIndex: number
): string | null => {
  if (!output?.savedMediaIds?.length) return null;
  const safeIndex = Math.max(0, Math.floor(imageIndex));
  const candidate = output.savedMediaIds[safeIndex] ?? output.savedMediaIds[0];
  const normalized = candidate?.trim() ?? "";
  return normalized.length ? normalized : null;
};

const normalizeReferenceDragSourceSurface = (value: unknown): ReferenceDragSourceSurface | null => {
  if (value === "all-refs" || value === "curated") return value;
  return null;
};

const loadBlobFromUrl = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download dropped image (${response.status}).`);
  }
  const blob = await response.blob();
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error("Dropped image returned no data.");
  }
  return blob;
};

/**
 * Builds internal-reference drop resolvers used by the AI Studio page shell.
 */
export const useAiStudioInternalDropResolvers = ({
  getOutputById,
  getOutputSnapshot,
  ensureOutputPersisted,
  saveReferenceToLibrary,
}: UseAiStudioInternalDropResolversParams): {
  resolveCharacterDropReference: ResolveCharacterDropReference;
  resolveCanvasDropReference: ResolveCanvasDropReference;
  resolveMediaLibraryInternalDropItem: (
    payload: InternalReferenceDragPayload
  ) => Promise<{ kind: "media" | "prompt"; id: string } | null>;
  resolveStyleLibraryInternalDrop: (
    payload: InternalReferenceDragPayload
  ) => ReturnType<typeof resolveInternalReferenceSource>;
  resolveElementProfileImageDropSource: ResolveInternalReferenceDrop;
} => {
  const resolveCharacterDropReference = useCallback<ResolveCharacterDropReference>(
    async (payload: InternalReferenceDragPayload) => {
      const resolvedSource = await resolveInternalReferenceSource({
        payload,
        getOutputById,
        getOutputSnapshot,
        ensureOutputPersisted,
        resolveSavedMediaIdFromOutput,
      });
      const outputId = (payload.outputId ?? payload.referenceId ?? "").trim() || null;
      const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
      if (!resolvedSource) {
        return {
          mediaId: payload.mediaId?.trim() || "",
          previewUrl: null,
          outputId,
          imageIndex,
          sourceSurface: payload.sourceSurface ?? null,
        };
      }
      return {
        mediaId: resolvedSource.mediaId?.trim() || "",
        previewUrl: resolvedSource.preparedImageUrl ?? resolvedSource.preview.url ?? null,
        storagePath: resolvedSource.fullStoragePath ?? resolvedSource.previewStoragePath ?? null,
        outputId: resolvedSource.outputId ?? outputId,
        imageIndex: resolvedSource.provenance.imageIndex,
        sourceSurface: normalizeReferenceDragSourceSurface(
          resolvedSource.provenance.sourceSurface ?? payload.sourceSurface ?? null
        ),
      };
    },
    [ensureOutputPersisted, getOutputById, getOutputSnapshot]
  );

  const resolveCanvasDropReference = useCallback<ResolveCanvasDropReference>(
    (payload: InternalReferenceDragPayload) => {
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

      if (output.mode !== "image") return null;

      const sourceUrl = resolveCanvasDropImageSourceUrl({
        output,
        imageIndex,
      });
      if (!sourceUrl) return null;

      return {
        kind: "image",
        outputId: outputId || null,
        mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
        src: sourceUrl,
        alt: (output.prompt || output.previewText || "Canvas reference").trim(),
        width: payload.width,
        height: payload.height,
        sourceSurface: payload.sourceSurface ?? null,
      };
    },
    [getOutputById]
  );

  const resolveMediaLibraryInternalDropItem = useCallback(
    async (payload: InternalReferenceDragPayload) =>
      await resolveMediaLibraryInternalDropResolver({
        payload,
        getOutputById,
        getOutputSnapshot,
        resolveSavedMediaIdFromOutput,
        saveReferenceToLibrary,
        persistTimeoutMs: MEDIA_LIBRARY_INTERNAL_DROP_PERSIST_TIMEOUT_MS,
        pollIntervalMs: MEDIA_LIBRARY_INTERNAL_DROP_POLL_INTERVAL_MS,
      }),
    [getOutputById, getOutputSnapshot, saveReferenceToLibrary]
  );

  const resolveStyleLibraryInternalDrop = useCallback(
    async (payload: InternalReferenceDragPayload) =>
      await resolveInternalReferenceSource({
        payload,
        getOutputById,
        getOutputSnapshot,
        ensureOutputPersisted,
        resolveSavedMediaIdFromOutput,
      }),
    [ensureOutputPersisted, getOutputById, getOutputSnapshot]
  );

  const resolveElementProfileImageDropSource = useCallback(
    async (payload: InternalReferenceDragPayload) => {
      const resolvedSource = await resolveInternalReferenceSource({
        payload,
        getOutputById,
        getOutputSnapshot,
        ensureOutputPersisted,
        resolveSavedMediaIdFromOutput,
      });
      if (resolvedSource) return resolvedSource;

      const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
      const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
      const output = outputId ? getOutputById(outputId) : null;
      if (output?.mode !== "image") return null;

      const previewUrl =
        output.localObjectUrl?.replace(/#video=1$/i, "").trim() ||
        output.resultUrls?.[imageIndex]?.trim() ||
        output.previewUrl?.trim() ||
        payload.referenceRenderUrl?.trim() ||
        payload.referenceUrl?.trim() ||
        null;
      if (!previewUrl) return null;

      const mediaId =
        payload.mediaId?.trim() || resolveSavedMediaIdFromOutput(output, imageIndex) || null;

      const fallbackResolvedSource: ResolvedInternalReferenceSource = {
        kind: "internal",
        sourceKind: output.localObjectUrl?.trim()
          ? "local_file"
          : output.mediaSource === "library"
            ? "media_library"
            : output.mediaSource === "generated"
              ? "generated_output"
              : "external_url",
        sourceId: mediaId ?? outputId ?? `element-profile:${imageIndex}`,
        provenance: {
          origin: payload.origin ?? null,
          outputId: outputId || null,
          mediaId,
          imageIndex,
          sourceSurface: normalizeReferenceDragSourceSurface(payload.sourceSurface ?? null),
          resolutionReason: output.localObjectUrl?.trim()
            ? "local_object_url"
            : "payload_reference_url",
        },
        outputId: outputId || null,
        mediaId,
        mediaSource: output.mediaSource ?? null,
        preview: {
          url: previewUrl,
        },
        previewStoragePath: null,
        fullStoragePath: null,
        promptText: (output.prompt || output.previewText || "").trim() || null,
        preparedImageUrl: null,
        loadBlob: async () => await loadBlobFromUrl(previewUrl),
      };
      return fallbackResolvedSource;
    },
    [ensureOutputPersisted, getOutputById, getOutputSnapshot]
  );

  return {
    resolveCharacterDropReference,
    resolveCanvasDropReference,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    resolveElementProfileImageDropSource,
  };
};
