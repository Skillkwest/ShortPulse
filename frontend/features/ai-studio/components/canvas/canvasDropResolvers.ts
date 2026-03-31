/**
 * Canvas drop URL resolvers.
 * Normalizes and validates image URL candidates so canvas drops never prefer non-renderable paths.
 */
import { isRenderableAdaptiveUrl } from "../../../../lib/adaptive-media";
import { looksLikeVideoUrl } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";

type CanvasImageUrlResolutionInput = {
  output: Pick<
    StudioOutput,
    "previewUrl" | "fullStoragePath" | "previewStoragePath" | "resultUrls"
  >;
  imageIndex: number;
};

const normalizeRenderableImageUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isRenderableAdaptiveUrl(trimmed)) return null;
  if (looksLikeVideoUrl(trimmed)) return null;
  return trimmed;
};

/**
 * Resolves the best renderable image URL for canvas drops.
 * Prioritizes the explicit image index when valid, then canonical output fallbacks.
 */
export const resolveCanvasDropImageSourceUrl = ({
  output,
  imageIndex,
}: CanvasImageUrlResolutionInput): string | null => {
  const indexedResultUrl = normalizeRenderableImageUrl(
    output.resultUrls?.[Math.max(0, Math.floor(imageIndex))] ?? null
  );
  if (indexedResultUrl) return indexedResultUrl;

  const fallbackCandidates = [
    output.previewUrl,
    output.fullStoragePath,
    output.previewStoragePath,
    ...(output.resultUrls ?? []),
  ];

  for (const candidate of fallbackCandidates) {
    const normalized = normalizeRenderableImageUrl(candidate);
    if (normalized) return normalized;
  }
  return null;
};
