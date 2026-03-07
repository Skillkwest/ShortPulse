/**
 * Canvas drop URL resolvers.
 * Normalizes and validates image URL candidates so canvas drops never prefer non-renderable paths.
 */
import { resolveReferenceTransferUrl } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";

type CanvasImageUrlResolutionInput = {
  output: Pick<
    StudioOutput,
    "previewUrl" | "fullStoragePath" | "previewStoragePath" | "resultUrls"
  >;
  imageIndex: number;
  payloadReferenceUrl: string | null;
};

const normalizeRenderableImageUrl = (value: string | null | undefined): string | null => {
  const resolved = resolveReferenceTransferUrl(
    {
      previewUrl: value ?? undefined,
      fullStoragePath: null,
      previewStoragePath: null,
      resultUrls: [],
    },
    "image"
  );
  return resolved ?? null;
};

/**
 * Resolves the best renderable image URL for canvas drops.
 * Prioritizes the explicit image index when valid, then output fallbacks, then drag-payload URL.
 */
export const resolveCanvasDropImageSourceUrl = ({
  output,
  imageIndex,
  payloadReferenceUrl,
}: CanvasImageUrlResolutionInput): string | null => {
  const indexedResultUrl = normalizeRenderableImageUrl(
    output.resultUrls?.[Math.max(0, Math.floor(imageIndex))] ?? null
  );
  if (indexedResultUrl) return indexedResultUrl;
  const outputResolvedUrl = resolveReferenceTransferUrl(output, "image");
  if (outputResolvedUrl) return outputResolvedUrl;
  return normalizeRenderableImageUrl(payloadReferenceUrl);
};
