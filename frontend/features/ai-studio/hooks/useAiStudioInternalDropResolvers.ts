/**
 * AI Studio internal-drop resolver hook.
 * Centralizes page-scoped drop resolution for character, canvas, media-library, and styles surfaces.
 */
import { useCallback } from "react";
import { resolveCanvasDropImageSourceUrl } from "../components/canvas/canvasDropResolvers";
import type { ResolveCanvasDropReference } from "../components/canvas/canvasTypes";
import type { PersistOutputSaveResult } from "./useAiStudioPersistenceActions";
import { resolveMediaLibraryInternalDropResolver } from "../logic/mediaLibraryInternalDropResolver";
import { resolveInternalReferenceSource } from "../logic/referenceSource/internalReferenceSource";
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
          previewUrl: payload.referenceUrl ?? null,
          outputId,
          imageIndex,
          sourceSurface: payload.sourceSurface ?? null,
        };
      }
      return {
        mediaId: resolvedSource.mediaId?.trim() || "",
        previewUrl:
          resolvedSource.preparedImageUrl ??
          resolvedSource.preview.url ??
          payload.referenceUrl ??
          null,
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
        payloadReferenceUrl: payload.referenceUrl,
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

  return {
    resolveCharacterDropReference,
    resolveCanvasDropReference,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
  };
};
