/**
 * Reference-grid media delivery helpers.
 * Centralizes preview/full URL resolution so card rendering can prefer lightweight variants safely.
 */
import type { StudioOutput } from "../types";

type ReferenceMediaCandidate = string | null | undefined;
export type ReferenceGridPreviewQualityBand = "high" | "balanced" | "compact";

const HTTP_LIKE_PATTERN = /^https?:\/\//i;
const DATA_LIKE_PATTERN = /^data:(image|video)\//i;
const BLOB_LIKE_PATTERN = /^blob:/i;

/**
 * Returns true when a media candidate is directly renderable by an `<img>`/`<video>` tag.
 */
export const isRenderableReferenceMediaUrl = (value: ReferenceMediaCandidate): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (HTTP_LIKE_PATTERN.test(trimmed)) return true;
  if (DATA_LIKE_PATTERN.test(trimmed)) return true;
  if (BLOB_LIKE_PATTERN.test(trimmed)) return true;
  if (trimmed.startsWith("/")) return true;
  return false;
};

const normalizeRenderableUrl = (value: ReferenceMediaCandidate): string | null => {
  if (!isRenderableReferenceMediaUrl(value)) return null;
  return value.trim();
};

const resolvePreviewQualityTarget = ({
  pressureLevel,
  cardLongEdgePx,
  devicePixelRatio,
}: {
  pressureLevel: number;
  cardLongEdgePx: number | null;
  devicePixelRatio: number;
}) => {
  const qualityBand: ReferenceGridPreviewQualityBand =
    pressureLevel >= 2 ? "compact" : pressureLevel >= 1 ? "balanced" : "high";
  const qualityCap = qualityBand === "compact" ? 640 : qualityBand === "balanced" ? 720 : 960;
  const safeDpr = Math.min(
    2,
    Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1)
  );
  const viewportDerivedTarget =
    typeof cardLongEdgePx === "number" && Number.isFinite(cardLongEdgePx)
      ? Math.round(Math.max(1, cardLongEdgePx) * safeDpr)
      : qualityCap;
  const targetLongEdgePx = Math.max(320, Math.min(qualityCap, viewportDerivedTarget));
  return {
    qualityBand,
    targetLongEdgePx,
  };
};

/**
 * Resolves preview/full card URLs with strict preview-ladder semantics when enabled.
 */
export const resolveReferenceCardUrls = (
  output: Pick<
    StudioOutput,
    "previewStoragePath" | "fullStoragePath" | "previewUrl" | "resultUrls"
  >,
  options?: {
    strictPreviewLadder?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
    adaptivePreviewQuality?: boolean;
  }
) => {
  const strictPreviewLadder = options?.strictPreviewLadder === true;
  const adaptivePreviewQuality = options?.adaptivePreviewQuality === true;
  const pressureLevel = options?.pressureLevel ?? 0;
  const { qualityBand, targetLongEdgePx } = resolvePreviewQualityTarget({
    pressureLevel,
    cardLongEdgePx: options?.cardLongEdgePx ?? null,
    devicePixelRatio: options?.devicePixelRatio ?? 1,
  });
  const previewStorageUrl = normalizeRenderableUrl(output.previewStoragePath);
  const fullStorageUrl = normalizeRenderableUrl(output.fullStoragePath);
  const legacyPreviewUrl = normalizeRenderableUrl(output.previewUrl);
  const resultFallbackUrl =
    output.resultUrls
      ?.map((value) => normalizeRenderableUrl(value))
      .find((value): value is string => Boolean(value)) ?? null;

  if (strictPreviewLadder) {
    return {
      previewUrl:
        previewStorageUrl ?? fullStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null,
      fullUrl: fullStorageUrl ?? previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null,
      previewQualityBand: adaptivePreviewQuality ? qualityBand : "high",
      targetLongEdgePx: adaptivePreviewQuality ? targetLongEdgePx : 960,
    };
  }

  return {
    previewUrl: previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null,
    fullUrl: fullStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null,
    previewQualityBand: adaptivePreviewQuality ? qualityBand : "high",
    targetLongEdgePx: adaptivePreviewQuality ? targetLongEdgePx : 960,
  };
};

/**
 * Resolves normalized delivery fields for output state updates while preserving existing variants.
 */
export const resolveNormalizedOutputDelivery = ({
  previewStoragePath,
  fullStoragePath,
  previewUrl,
  resultUrls,
}: {
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  resultUrls?: string[] | null;
}) => {
  const primaryResultUrl = resultUrls?.find(
    (value) => typeof value === "string" && value.length > 0
  );
  const normalizedFull =
    fullStoragePath ?? previewStoragePath ?? primaryResultUrl ?? previewUrl ?? null;
  const normalizedPreview =
    previewStoragePath ?? normalizedFull ?? primaryResultUrl ?? previewUrl ?? null;

  return {
    previewStoragePath: normalizedPreview,
    fullStoragePath: normalizedFull,
  };
};
