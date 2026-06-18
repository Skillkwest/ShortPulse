/**
 * AI Studio internal-drop resolver hook.
 * Centralizes page-scoped drop resolution for character, media-library, styles, and element-profile surfaces.
 */
import { useCallback } from "react";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { rememberObjectUrlBlob } from "../utils/objectUrlBlobRegistry";
import type {
  PersistOutputSaveOptions,
  PersistOutputSaveResult,
} from "./useAiStudioPersistenceActions";
import {
  resolveInternalReferenceSource,
  type ResolveInternalReferenceDrop,
  type ResolvedInternalReferenceSource,
} from "../logic/referenceSource/internalReferenceSource";
import { resolveAgentAttachmentPreviewUrl } from "../logic/agentAttachmentImage";
import type { StudioOutput } from "../types";
import type { InternalReferenceDragPayload, ReferenceDragSourceSurface } from "../utils/dragDrop";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

type UseAiStudioInternalDropResolversParams = {
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => OutputSnapshot;
  ensureOutputPersisted: (
    outputId: string,
    options?: PersistOutputSaveOptions
  ) => Promise<PersistOutputSaveResult>;
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

const canCreateObjectUrl = () =>
  typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

const VIDEO_STORAGE_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;

const normalizeOptionalString = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length ? normalized : null;
};

const resolveVideoStoragePath = (output: StudioOutput): string | null => {
  const previewStoragePath = asCanonicalStoragePath(output.previewStoragePath);
  const fullStoragePath = asCanonicalStoragePath(output.fullStoragePath);
  if (previewStoragePath && VIDEO_STORAGE_PATH_PATTERN.test(previewStoragePath)) {
    return previewStoragePath;
  }
  return fullStoragePath ?? previewStoragePath;
};

const resolveVideoPreviewUrl = (output: StudioOutput): string | null =>
  normalizeOptionalString(output.localObjectUrl)?.replace(/#video=1$/i, "") ||
  normalizeOptionalString(output.previewUrl) ||
  normalizeOptionalString(output.resultUrls?.[0]) ||
  null;

const resolveMotionVideoOutputSource = ({
  output,
  payload,
}: {
  output: StudioOutput | null;
  payload: InternalReferenceDragPayload;
}): ResolvedInternalReferenceSource | null => {
  if (!output || output.mode !== "video") return null;
  const storagePath = resolveVideoStoragePath(output);
  const previewUrl = resolveVideoPreviewUrl(output);
  if (!storagePath && !previewUrl) return null;
  const mediaId =
    normalizeOptionalString(payload.mediaId) ?? resolveSavedMediaIdFromOutput(output, 0);
  const localObjectUrl = normalizeOptionalString(output.localObjectUrl);
  const sourceKind = storagePath
    ? output.mediaSource === "generated"
      ? "generated_output"
      : "media_library"
    : localObjectUrl
      ? "local_file"
      : "external_url";

  return {
    kind: "internal",
    sourceKind,
    sourceId: mediaId ?? normalizeOptionalString(output.id) ?? "motion-video-reference",
    provenance: {
      origin: payload.origin ?? null,
      outputId: output.id || null,
      mediaId,
      imageIndex: Math.max(0, Math.floor(payload.imageIndex ?? 0)),
      sourceSurface: payload.sourceSurface ?? null,
      resolutionReason: storagePath ? "output_storage_path" : "local_object_url",
    },
    outputId: output.id || null,
    generationId: normalizeOptionalString(output.generationId),
    mediaId,
    mediaSource: output.mediaSource ?? null,
    preview: {
      url: previewUrl,
    },
    previewStoragePath: storagePath,
    fullStoragePath: storagePath,
    promptText: output.prompt || output.previewText || null,
    preparedImageUrl: null,
    loadBlob: async () => {
      if (!previewUrl) {
        throw new Error("Motion reference video source is missing a preview URL.");
      }
      return await loadBlobFromUrl(previewUrl);
    },
  };
};

/**
 * Builds internal-reference drop resolvers used by the AI Studio page shell.
 */
export const useAiStudioInternalDropResolvers = ({
  getOutputById,
  getOutputSnapshot,
  ensureOutputPersisted,
}: UseAiStudioInternalDropResolversParams): {
  resolveCharacterDropReference: ResolveCharacterDropReference;
  resolveMediaLibraryInternalDropItem: (
    payload: InternalReferenceDragPayload
  ) => Promise<{ kind: "media" | "prompt"; id: string } | null>;
  resolveStyleLibraryInternalDrop: (
    payload: InternalReferenceDragPayload
  ) => ReturnType<typeof resolveInternalReferenceSource>;
  resolveComposerInternalImageDropSource: ResolveInternalReferenceDrop;
  resolveMotionReferenceVideoDropSource: ResolveInternalReferenceDrop;
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
        allowPersistenceRecovery: true,
        allowTrustedPreviewFallback: true,
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

  const resolveMediaLibraryInternalDropItem = useCallback(
    async (payload: InternalReferenceDragPayload) => {
      const payloadMediaId = payload.mediaId?.trim() ?? "";
      if (payloadMediaId) {
        return { kind: "media" as const, id: payloadMediaId };
      }

      const resolvedOutputId = (payload.outputId ?? payload.referenceId ?? "").trim();
      const initialOutput = resolvedOutputId ? getOutputById(resolvedOutputId) : null;

      if (initialOutput?.mode === "text") {
        const initialPromptId = initialOutput.promptId?.trim() ?? "";
        if (initialPromptId) {
          return { kind: "prompt" as const, id: initialPromptId };
        }
        if (!resolvedOutputId) return null;
        let persistedPromptId = "";
        try {
          const persistedResult = await ensureOutputPersisted(resolvedOutputId);
          persistedPromptId = persistedResult.promptId?.trim() ?? "";
        } catch {
          return null;
        }
        if (!persistedPromptId) {
          const persistedOutput = getOutputById(resolvedOutputId);
          persistedPromptId =
            persistedOutput?.mode === "text" ? (persistedOutput.promptId?.trim() ?? "") : "";
        }
        if (!persistedPromptId) return null;
        return { kind: "prompt" as const, id: persistedPromptId };
      }

      const resolvedSource = await resolveInternalReferenceSource({
        payload,
        getOutputById,
        getOutputSnapshot,
        ensureOutputPersisted,
        resolveSavedMediaIdFromOutput,
      });
      const resolvedMediaId = resolvedSource?.mediaId?.trim() ?? "";
      if (!resolvedMediaId) return null;
      return { kind: "media" as const, id: resolvedMediaId };
    },
    [ensureOutputPersisted, getOutputById, getOutputSnapshot]
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

  const resolveComposerInternalImageDropSource = useCallback(
    async (payload: InternalReferenceDragPayload) => {
      const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
      const referencedOutput = outputId ? getOutputById(outputId) : null;
      const effectiveMediaKind = payload.mediaKind ?? referencedOutput?.mode ?? null;
      if (effectiveMediaKind && effectiveMediaKind !== "image") {
        return null;
      }

      const resolvedSource = await resolveInternalReferenceSource({
        payload,
        getOutputById,
        getOutputSnapshot,
        ensureOutputPersisted,
        resolveSavedMediaIdFromOutput,
      });
      if (!resolvedSource) return null;

      const resolvedOutput = resolvedSource.outputId?.trim()
        ? getOutputById(resolvedSource.outputId)
        : null;
      if (resolvedOutput?.mode && resolvedOutput.mode !== "image") {
        return null;
      }

      const hasStablePreviewAuthority = Boolean(
        resolvedSource.preparedImageUrl?.trim() ||
        resolvedSource.previewStoragePath?.trim() ||
        resolvedSource.fullStoragePath?.trim()
      );

      if (hasStablePreviewAuthority) {
        const durablePreviewUrl = await resolveAgentAttachmentPreviewUrl({
          previewStoragePath: resolvedSource.previewStoragePath ?? null,
          fullStoragePath: resolvedSource.fullStoragePath ?? null,
          referenceRenderUrl: null,
          referenceUrl: resolvedSource.preparedImageUrl ?? resolvedSource.preview.url ?? null,
          imageUrl: resolvedSource.preview.url ?? null,
          submissionImageUrl: resolvedSource.preparedImageUrl ?? null,
        }).catch(() => null);
        if (durablePreviewUrl) {
          return {
            ...resolvedSource,
            preview: {
              ...resolvedSource.preview,
              url: durablePreviewUrl,
            },
            preparedImageUrl: resolvedSource.preparedImageUrl ?? durablePreviewUrl,
          };
        }
        return resolvedSource;
      }

      if (resolvedSource.sourceKind === "local_file" && canCreateObjectUrl()) {
        try {
          const blob = await resolvedSource.loadBlob();
          if (blob instanceof Blob && blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            rememberObjectUrlBlob(objectUrl, blob);
            return {
              ...resolvedSource,
              preview: {
                ...resolvedSource.preview,
                url: objectUrl,
              },
              preparedImageUrl: objectUrl,
            };
          }
        } catch {
          // Fall back to rejecting drops that cannot produce a stable local preview.
        }
      }

      return null;
    },
    [ensureOutputPersisted, getOutputById, getOutputSnapshot]
  );

  const resolveMotionReferenceVideoDropSource = useCallback(
    async (payload: InternalReferenceDragPayload) => {
      const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
      const referencedOutput = outputId ? getOutputById(outputId) : null;
      const effectiveMediaKind = payload.mediaKind ?? referencedOutput?.mode ?? null;
      if (effectiveMediaKind && effectiveMediaKind !== "video") {
        return null;
      }

      const resolvedSource = await resolveInternalReferenceSource({
        payload,
        getOutputById,
        getOutputSnapshot,
        ensureOutputPersisted,
        resolveSavedMediaIdFromOutput,
      });
      if (!resolvedSource) {
        return resolveMotionVideoOutputSource({
          output: referencedOutput,
          payload,
        });
      }

      const resolvedOutput = resolvedSource.outputId?.trim()
        ? getOutputById(resolvedSource.outputId)
        : null;
      if (resolvedOutput?.mode && resolvedOutput.mode !== "video") {
        return null;
      }

      return resolvedSource;
    },
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

      const localObjectUrl = output.localObjectUrl?.replace(/#video=1$/i, "").trim() || null;
      if (output.mediaSource === "generated" && !localObjectUrl) {
        return null;
      }

      const previewUrl =
        localObjectUrl ||
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
          resolutionReason: localObjectUrl ? "local_object_url" : "payload_reference_url",
        },
        outputId: outputId || null,
        generationId: output.generationId?.trim() || null,
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
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    resolveComposerInternalImageDropSource,
    resolveMotionReferenceVideoDropSource,
    resolveElementProfileImageDropSource,
  };
};
