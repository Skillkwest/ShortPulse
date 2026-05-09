import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { resolvePublishedGenerationOutputStoragePathByIndex } from "../logic/generatedMediaAuthority";
import { isVideoUrl } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import type {
  PersistOutputSaveOptions,
  PersistedMediaDelivery,
} from "./persistenceActionContracts";

const normalizeOptionalUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const resolvePersistablePosterUrl = (output: StudioOutput): string | null => {
  if (output.mode !== "video") return null;
  const explicitPosterUrl = normalizeOptionalUrl(output.previewPosterUrl);
  if (explicitPosterUrl) return explicitPosterUrl;
  const previewUrl = normalizeOptionalUrl(output.previewUrl);
  if (previewUrl && !isVideoUrl(previewUrl)) return previewUrl;
  return null;
};

const uniqueUrls = (values: Array<string | null | undefined>): string[] => {
  const next: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeOptionalUrl(value);
    if (!normalized || next.includes(normalized)) return;
    next.push(normalized);
  });
  return next;
};

export const resolveRequestedImageIndex = (value: number | null | undefined): number =>
  Math.max(0, Math.floor(value ?? 0));

export const resolvePersistOutputSaveKey = (
  outputId: string,
  options?: PersistOutputSaveOptions
): string => {
  if (typeof options?.imageIndex !== "number" || !Number.isFinite(options.imageIndex)) {
    return outputId;
  }
  return `${outputId}::image:${resolveRequestedImageIndex(options.imageIndex)}`;
};

export const resolveSavedMediaIdsForRequest = (
  output: StudioOutput,
  options?: PersistOutputSaveOptions
): string[] => {
  const savedMediaIds = output.savedMediaIds ?? [];
  if (!savedMediaIds.length) return [];
  if (output.mode !== "image") return savedMediaIds;
  if (typeof options?.imageIndex !== "number" || !Number.isFinite(options.imageIndex)) {
    return savedMediaIds;
  }

  const requestedIndex = resolveRequestedImageIndex(options?.imageIndex);
  const requestedMediaId = normalizeOptionalUrl(savedMediaIds[requestedIndex]);
  if (requestedMediaId) return [requestedMediaId];

  const hasMultipleIndexedResults = (output.resultUrls?.length ?? 0) > 1;
  if (!hasMultipleIndexedResults) {
    const fallbackMediaId = normalizeOptionalUrl(savedMediaIds[0]);
    return fallbackMediaId ? [fallbackMediaId] : [];
  }

  return [];
};

export const mergeSavedMediaIdsForRequest = ({
  output,
  savedMediaIds,
  options,
}: {
  output: StudioOutput;
  savedMediaIds: string[];
  options?: PersistOutputSaveOptions;
}): string[] => {
  if (!savedMediaIds.length) return output.savedMediaIds ?? [];
  if (output.mode !== "image") return savedMediaIds;
  if (typeof options?.imageIndex !== "number" || !Number.isFinite(options.imageIndex)) {
    return savedMediaIds;
  }

  const requestedIndex = resolveRequestedImageIndex(options?.imageIndex);
  const nextSavedMediaIds = [...(output.savedMediaIds ?? [])];
  nextSavedMediaIds[requestedIndex] = savedMediaIds[0] ?? nextSavedMediaIds[requestedIndex];
  return nextSavedMediaIds;
};

export const shouldMergePersistedDeliveryForRequest = (
  output: StudioOutput,
  options?: PersistOutputSaveOptions
): boolean => {
  if (output.mode !== "image") return true;
  if (typeof options?.imageIndex !== "number" || !Number.isFinite(options.imageIndex)) {
    return true;
  }
  const requestedIndex = resolveRequestedImageIndex(options?.imageIndex);
  const hasMultipleIndexedResults = (output.resultUrls?.length ?? 0) > 1;
  return !hasMultipleIndexedResults || requestedIndex === 0;
};

const resolvePersistableImageUrl = (
  output: StudioOutput,
  imageIndex: number | null | undefined
): string[] => {
  const safeImageIndex = resolveRequestedImageIndex(imageIndex);
  const uploadLocalSource = normalizeOptionalUrl(output.localObjectUrl);
  const indexedResultUrl = normalizeOptionalUrl(
    output.resultUrls?.[safeImageIndex] ?? output.resultUrls?.[0]
  );
  if (indexedResultUrl) {
    return uniqueUrls([indexedResultUrl]);
  }
  if (output.mediaSource === "upload" && uploadLocalSource) {
    return uniqueUrls([uploadLocalSource]);
  }
  return uniqueUrls([output.previewUrl, uploadLocalSource]);
};

export const resolvePersistableOutputUrls = (output: StudioOutput): string[] => {
  if (output.mode === "image") {
    return resolvePersistableImageUrl(output, 0);
  }
  const uploadLocalSource = normalizeOptionalUrl(output.localObjectUrl);
  const baseUrls = output.resultUrls?.length
    ? uniqueUrls(output.resultUrls)
    : uniqueUrls([
        output.mediaSource === "upload" ? uploadLocalSource : null,
        output.previewUrl,
        uploadLocalSource,
      ]);
  if (!baseUrls.length) return [];
  if (output.mode !== "video") return baseUrls;
  const videoUrls = baseUrls.filter((value) => isVideoUrl(value));
  return videoUrls.length ? videoUrls : baseUrls;
};

const isLikelyStoragePath = (value: string | null | undefined): boolean => {
  const normalized = normalizeOptionalUrl(value);
  if (!normalized) return false;
  return !/^https?:\/\//i.test(normalized) && !normalized.startsWith("blob:");
};

export const resolvePersistableOutputUrlsForSave = async (
  output: StudioOutput,
  options?: PersistOutputSaveOptions
): Promise<string[]> => {
  const safeImageIndex = resolveRequestedImageIndex(options?.imageIndex);
  if (output.mediaSource === "generated" || Boolean(output.generationId)) {
    if (output.generationId) {
      try {
        const supabase = ensureSupabaseQueryClient();
        const generationStoragePath = await resolvePublishedGenerationOutputStoragePathByIndex({
          supabase,
          generationId: output.generationId,
          imageIndex: safeImageIndex,
        });
        if (generationStoragePath) {
          const signedUrl = await getSignedMediaUrl({
            bucket: "media_library",
            storagePath: generationStoragePath,
          });
          if (signedUrl) {
            return uniqueUrls([signedUrl]);
          }
        }
      } catch {
        // fall through to output state and legacy result URL handling
      }
    }

    const candidateStoragePaths = uniqueUrls(
      output.mode === "video"
        ? [output.fullStoragePath, output.previewStoragePath]
        : [output.previewStoragePath, output.fullStoragePath]
    ).filter((value) => isLikelyStoragePath(value));

    for (const storagePath of candidateStoragePaths) {
      const signedUrl = await getSignedMediaUrl({
        bucket: "media_library",
        storagePath,
      });
      if (signedUrl) {
        return uniqueUrls([signedUrl]);
      }
    }
  }

  if (output.mode === "image") {
    return resolvePersistableImageUrl(output, safeImageIndex);
  }

  return resolvePersistableOutputUrls(output);
};

export const isDurablyGeneratedOutput = (output: StudioOutput): boolean =>
  output.mediaSource === "generated" || Boolean(output.generationId);

export const hasDurableGenerationIdentity = (output: StudioOutput): boolean =>
  Boolean(output.generationId);

export const mergeOutputWithPersistedDelivery = (
  output: StudioOutput,
  delivery: PersistedMediaDelivery
): StudioOutput => {
  const nextPreviewStoragePath = delivery.previewStoragePath ?? output.previewStoragePath ?? null;
  const nextFullStoragePath =
    delivery.fullStoragePath ?? output.fullStoragePath ?? nextPreviewStoragePath ?? null;
  const nextPreviewPosterStoragePath =
    delivery.previewPosterStoragePath ?? output.previewPosterStoragePath ?? null;
  const nextPreviewPosterUrl =
    output.mode === "video"
      ? (normalizeOptionalUrl(delivery.previewPosterUrl) ??
        normalizeOptionalUrl(output.previewPosterUrl) ??
        null)
      : null;
  const nextPreviewUrl =
    normalizeOptionalUrl(delivery.previewUrl) ??
    normalizeOptionalUrl(delivery.fullUrl) ??
    normalizeOptionalUrl(output.previewUrl) ??
    undefined;
  return {
    ...output,
    previewStoragePath: nextPreviewStoragePath,
    previewPosterStoragePath: nextPreviewPosterStoragePath,
    fullStoragePath: nextFullStoragePath,
    previewUrl: nextPreviewUrl,
    previewPosterUrl: nextPreviewPosterUrl,
  };
};

export const resolvePersistedPosterUrlHint = resolvePersistablePosterUrl;
