/**
 * Reference-grid media delivery helpers.
 * Centralizes preview/full URL resolution so card rendering can prefer lightweight variants safely.
 */
import {
  isAdaptiveSurfaceEnabled,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
  asCanonicalStoragePath,
  logAdaptivePolicyApplied,
  type AdaptiveSurface,
} from "../../../lib/adaptive-media";
import {
  hasStorageAuthority,
  isGeneratedOutput,
  resolveReferenceOutputAuthorityTier,
  type ReferenceOutputAuthorityTier,
} from "./referenceOutputAuthority";
import {
  applyAdaptivePreviewTransform,
  resolvePreviewQualityTarget,
  type ReferenceGridMediaKindHint,
  type ReferenceGridPreviewQualityBand,
} from "./referenceGridMediaAdaptivePreview";
import {
  firstPlayableCandidate,
  firstRenderableCandidate,
  hasDistinctDurablePreviewAsset,
  inferReferenceMediaKind,
  isAudioMediaCandidate,
  isImageMediaCandidate,
  isVideoMediaCandidate,
  normalizeRenderableUrl,
} from "./referenceGridMediaCandidates";
import type { StudioOutput } from "../types";

export type ReferenceGridMediaAuthorityTier = ReferenceOutputAuthorityTier;
export type { ReferenceGridPreviewQualityBand } from "./referenceGridMediaAdaptivePreview";

export type StudioOutputMediaDisplayUnavailableReason =
  | "waiting_for_signing"
  | "missing_storage_authority"
  | "upstream_generation_pending"
  | "storage_resolve_failed"
  | "unsupported_media_kind";

export type StudioOutputMediaDisplayAuthority = {
  mediaIdentity: {
    outputId: string | null;
    savedMediaId: string | null;
    generationId: string | null;
    taskId: string | null;
    previewStoragePath: string | null;
    previewPosterStoragePath: string | null;
    fullStoragePath: string | null;
    mediaKind: ReferenceGridMediaKindHint | "unknown";
  };
  thumbnailPreviewUrl: string | null;
  posterPreviewUrl: string | null;
  playableMediaUrl: string | null;
  fullMediaUrl: string | null;
  cardDisplayUrl: string | null;
  unavailableReason: StudioOutputMediaDisplayUnavailableReason | null;
  authorityTier: ReferenceGridMediaAuthorityTier;
  authoritySource: "durable" | "direct" | "temporary" | null;
  previewQualityBand: ReferenceGridPreviewQualityBand;
  targetLongEdgePx: number;
};

const resolveReferenceCardUrlsLegacy = (
  output: Pick<
    StudioOutput,
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewUrl"
    | "resultUrls"
    | "mediaSource"
    | "generationId"
    | "savedMediaIds"
  > & { mode?: StudioOutput["mode"] | null },
  options?: {
    strictPreviewLadder?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
    adaptivePreviewQuality?: boolean;
    surface?: AdaptiveSurface;
  }
) => {
  const authorityTier = resolveReferenceOutputAuthorityTier(output);
  const isPreviewOnlyGenerated = authorityTier === "preview-only" && isGeneratedOutput(output);
  const strictPreviewLadder = options?.strictPreviewLadder === true;
  const surface = options?.surface ?? "reference-grid";
  const adaptivePreviewQuality = options?.adaptivePreviewQuality === true;
  const isReferenceRailSurface = surface === "reference-grid" || surface === "quick-slot";
  const shouldApplyAdaptivePreviewQuality =
    adaptivePreviewQuality && (isReferenceRailSurface || !hasDistinctDurablePreviewAsset(output));
  const pressureLevel = options?.pressureLevel ?? 0;
  const mediaKindHint = inferReferenceMediaKind(output);
  const { qualityBand, targetLongEdgePx } = resolvePreviewQualityTarget({
    pressureLevel,
    surface,
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
    const resolvedPreviewUrl =
      previewStorageUrl ?? fullStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null;
    const previewUrl =
      shouldApplyAdaptivePreviewQuality && resolvedPreviewUrl
        ? applyAdaptivePreviewTransform({
            url: resolvedPreviewUrl,
            qualityBand,
            targetLongEdgePx,
            mediaKindHint,
            surface,
          })
        : resolvedPreviewUrl;
    return {
      previewUrl,
      fullUrl: isPreviewOnlyGenerated
        ? null
        : (fullStorageUrl ?? previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null),
      authorityTier,
      previewQualityBand: shouldApplyAdaptivePreviewQuality ? qualityBand : "high",
      targetLongEdgePx: shouldApplyAdaptivePreviewQuality ? targetLongEdgePx : 960,
    };
  }

  const resolvedPreviewUrl = previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null;
  const previewUrl =
    shouldApplyAdaptivePreviewQuality && resolvedPreviewUrl
      ? applyAdaptivePreviewTransform({
          url: resolvedPreviewUrl,
          qualityBand,
          targetLongEdgePx,
          mediaKindHint,
          surface,
        })
      : resolvedPreviewUrl;

  return {
    previewUrl,
    fullUrl: isPreviewOnlyGenerated
      ? null
      : (fullStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null),
    authorityTier,
    previewQualityBand: shouldApplyAdaptivePreviewQuality ? qualityBand : "high",
    targetLongEdgePx: shouldApplyAdaptivePreviewQuality ? targetLongEdgePx : 960,
  };
};

/**
 * Resolves preview/full card URLs with strict preview-ladder semantics when enabled.
 */
export const resolveReferenceCardUrls = (
  output: Pick<
    StudioOutput,
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewUrl"
    | "resultUrls"
    | "mediaSource"
    | "generationId"
    | "savedMediaIds"
  > & { mode?: StudioOutput["mode"] | null },
  options?: {
    strictPreviewLadder?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
    adaptivePreviewQuality?: boolean;
    surface?: AdaptiveSurface;
  }
) => {
  const authorityTier = resolveReferenceOutputAuthorityTier(output);
  const surface = options?.surface ?? "reference-grid";
  const isReferenceRailSurface = surface === "reference-grid" || surface === "quick-slot";
  const shouldApplyAdaptivePreviewQuality =
    options?.adaptivePreviewQuality === true &&
    (isReferenceRailSurface || !hasDistinctDurablePreviewAsset(output));
  const shouldUseV2 = isAdaptiveSurfaceEnabled(surface);
  const legacy = resolveReferenceCardUrlsLegacy(output, options);

  if (!shouldUseV2) {
    return legacy;
  }

  const mediaKind = inferReferenceMediaKind(output) ?? "unknown";
  const source = resolveAdaptiveSourceKind(output.previewUrl ?? output.resultUrls?.[0] ?? null);

  const v2Resolved = resolveAdaptiveMedia({
    surface,
    mediaKind,
    source,
    urls: {
      previewUrl: output.previewUrl ?? null,
      resultUrls: output.resultUrls ?? null,
      fullUrl: output.resultUrls?.[0] ?? null,
    },
    storage: {
      previewStoragePath: output.previewStoragePath ?? null,
      fullStoragePath: output.fullStoragePath ?? null,
    },
    strictPreviewLadder: options?.strictPreviewLadder === true,
    pressureLevel: options?.pressureLevel,
    cardLongEdgePx: options?.cardLongEdgePx ?? null,
    devicePixelRatio: options?.devicePixelRatio ?? 1,
    adaptivePreviewQuality: shouldApplyAdaptivePreviewQuality,
  });

  const resolved = {
    previewUrl: v2Resolved.previewUrl,
    fullUrl:
      authorityTier === "preview-only" && isGeneratedOutput(output) ? null : v2Resolved.fullUrl,
    authorityTier,
    previewQualityBand: shouldApplyAdaptivePreviewQuality
      ? v2Resolved.decision.qualityBand
      : ("high" satisfies ReferenceGridPreviewQualityBand),
    targetLongEdgePx: shouldApplyAdaptivePreviewQuality
      ? v2Resolved.decision.targetLongEdgePx
      : 960,
  };

  logAdaptivePolicyApplied({ result: v2Resolved });
  return resolved;
};

type StudioOutputMediaDisplayInput = Pick<
  StudioOutput,
  | "id"
  | "mode"
  | "taskState"
  | "mediaSource"
  | "generationId"
  | "taskId"
  | "savedMediaIds"
  | "previewStoragePath"
  | "previewPosterStoragePath"
  | "fullStoragePath"
  | "previewUrl"
  | "previewPosterUrl"
  | "resultUrls"
>;

const resolveUnavailableReason = (
  output: StudioOutputMediaDisplayInput,
  hasAnyDisplayUrl: boolean
): StudioOutputMediaDisplayUnavailableReason | null => {
  if (hasAnyDisplayUrl) return null;
  if (hasStorageAuthority(output)) return "waiting_for_signing";
  if (output.taskState === "pending" || output.taskState === "running") {
    return "upstream_generation_pending";
  }
  if (output.mode !== "image" && output.mode !== "video" && output.mode !== "audio") {
    return "unsupported_media_kind";
  }
  return "missing_storage_authority";
};

/**
 * Resolves canonical StudioOutput media-display authority without blurring poster,
 * thumbnail, playable, and full/original media roles.
 */
export const resolveStudioOutputMediaDisplayAuthority = (
  output: StudioOutputMediaDisplayInput,
  options?: {
    strictPreviewLadder?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
    adaptivePreviewQuality?: boolean;
    surface?: AdaptiveSurface;
  }
): StudioOutputMediaDisplayAuthority => {
  const mediaKind = inferReferenceMediaKind(output) ?? "unknown";
  const resolvedCardUrls = resolveReferenceCardUrls(output, options);
  const authorityTier = resolvedCardUrls.authorityTier;
  const firstResultUrl = output.resultUrls?.[0] ?? null;
  const savedMediaId =
    output.savedMediaIds?.find((value) => typeof value === "string" && value.trim().length > 0) ??
    null;
  const normalizedPreviewPosterUrl = firstRenderableCandidate(
    output.previewPosterUrl,
    output.previewPosterStoragePath
  );

  let thumbnailPreviewUrl: string | null = null;
  let posterPreviewUrl: string | null = null;
  let playableMediaUrl: string | null = null;
  let fullMediaUrl: string | null = null;
  let cardDisplayUrl: string | null = null;

  if (mediaKind === "image") {
    thumbnailPreviewUrl = resolvedCardUrls.previewUrl ?? resolvedCardUrls.fullUrl ?? null;
    fullMediaUrl = resolvedCardUrls.fullUrl ?? thumbnailPreviewUrl;
    cardDisplayUrl = thumbnailPreviewUrl;
  } else if (mediaKind === "video") {
    posterPreviewUrl =
      normalizedPreviewPosterUrl ??
      (!isVideoMediaCandidate(output.previewUrl) && isImageMediaCandidate(output.previewUrl)
        ? firstRenderableCandidate(output.previewUrl)
        : null);
    playableMediaUrl =
      firstRenderableCandidate(output.fullStoragePath) ??
      firstPlayableCandidate("video", firstResultUrl, ...(output.resultUrls ?? [])) ??
      firstPlayableCandidate("video", output.previewUrl) ??
      (isVideoMediaCandidate(resolvedCardUrls.fullUrl) ? resolvedCardUrls.fullUrl : null) ??
      (isVideoMediaCandidate(resolvedCardUrls.previewUrl) ? resolvedCardUrls.previewUrl : null);
    fullMediaUrl = playableMediaUrl;
    cardDisplayUrl = posterPreviewUrl ?? playableMediaUrl;
  } else if (mediaKind === "audio") {
    playableMediaUrl =
      firstRenderableCandidate(output.fullStoragePath) ??
      firstPlayableCandidate("audio", firstResultUrl, ...(output.resultUrls ?? [])) ??
      firstPlayableCandidate("audio", output.previewUrl) ??
      (isAudioMediaCandidate(resolvedCardUrls.fullUrl) ? resolvedCardUrls.fullUrl : null) ??
      (isAudioMediaCandidate(resolvedCardUrls.previewUrl) ? resolvedCardUrls.previewUrl : null);
    fullMediaUrl = playableMediaUrl;
    cardDisplayUrl = playableMediaUrl;
  }

  const hasAnyDisplayUrl = Boolean(
    thumbnailPreviewUrl || posterPreviewUrl || playableMediaUrl || fullMediaUrl || cardDisplayUrl
  );
  const authoritySource = hasStorageAuthority(output)
    ? "durable"
    : output.mediaSource === "generated"
      ? "temporary"
      : hasAnyDisplayUrl
        ? "direct"
        : null;

  return {
    mediaIdentity: {
      outputId: output.id?.trim() || null,
      savedMediaId: savedMediaId?.trim() || null,
      generationId: output.generationId?.trim() || null,
      taskId: output.taskId?.trim() || null,
      previewStoragePath: asCanonicalStoragePath(output.previewStoragePath),
      previewPosterStoragePath: asCanonicalStoragePath(output.previewPosterStoragePath),
      fullStoragePath: asCanonicalStoragePath(output.fullStoragePath),
      mediaKind,
    },
    thumbnailPreviewUrl,
    posterPreviewUrl,
    playableMediaUrl,
    fullMediaUrl,
    cardDisplayUrl,
    unavailableReason: resolveUnavailableReason(output, hasAnyDisplayUrl),
    authorityTier,
    authoritySource,
    previewQualityBand: resolvedCardUrls.previewQualityBand ?? "high",
    targetLongEdgePx: resolvedCardUrls.targetLongEdgePx ?? 960,
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
  void previewUrl;
  void resultUrls;
  const normalizedPreview = asCanonicalStoragePath(previewStoragePath);
  const normalizedFull = asCanonicalStoragePath(fullStoragePath) ?? normalizedPreview;

  return {
    previewStoragePath: normalizedPreview,
    fullStoragePath: normalizedFull,
  };
};
