import {
  ADAPTIVE_MEDIA_V2_FORCE_FULL_QUALITY,
  ADAPTIVE_MEDIA_V2_TUNED_POLICY,
  REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION,
} from "./flags";
import type {
  AdaptiveDecision,
  AdaptiveInput,
  AdaptivePressureLevel,
  AdaptiveQualityBand,
  AdaptiveSurface,
} from "./types";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const asPressureLevel = (value: number | undefined): AdaptivePressureLevel => {
  if (!Number.isFinite(value)) return 0;
  if ((value ?? 0) >= 2) return 2;
  if ((value ?? 0) >= 1) return 1;
  return 0;
};

const resolveQualityBand = (pressureLevel: AdaptivePressureLevel): AdaptiveQualityBand => {
  if (pressureLevel >= 2) return "compact";
  if (pressureLevel >= 1) return "balanced";
  return "high";
};

const PARITY_QUALITY_Q: Record<AdaptiveQualityBand, number> = {
  high: 40,
  balanced: 34,
  compact: 34,
};

const TUNED_QUALITY_Q: Record<AdaptiveQualityBand, number> = {
  high: 70,
  balanced: 60,
  compact: 50,
};

const PARITY_LOCAL_TRANSCODE_QUALITY: Record<AdaptiveQualityBand, number> = {
  high: 0.42,
  balanced: 0.32,
  compact: 0.3,
};

const TUNED_LOCAL_TRANSCODE_QUALITY: Record<AdaptiveQualityBand, number> = {
  high: 0.82,
  balanced: 0.72,
  compact: 0.62,
};

const GRID_SURFACE_SET = new Set<AdaptiveSurface>([
  "reference-grid",
  "media-library-grid",
  "media-library-modal-grid",
  "media-library-panel-grid",
  "character-grid",
]);

const resolveParityTargetLongEdgePx = ({
  surface,
  qualityBand,
}: {
  surface: AdaptiveSurface;
  qualityBand: AdaptiveQualityBand;
}): number => {
  if (surface === "quick-slot") {
    if (qualityBand === "compact") return 384;
    if (qualityBand === "balanced") return 448;
    return 512;
  }
  if (qualityBand === "compact") return 448;
  if (qualityBand === "balanced") return 512;
  return 640;
};

const resolveTunedTargetLongEdgePx = ({
  surface,
  qualityBand,
  cardLongEdgePx,
  devicePixelRatio,
}: {
  surface: AdaptiveSurface;
  qualityBand: AdaptiveQualityBand;
  cardLongEdgePx: number | null;
  devicePixelRatio: number;
}): number => {
  const factorByBand: Record<AdaptiveQualityBand, number> = {
    high: 1.15,
    balanced: 1,
    compact: 0.9,
  };
  const min = surface === "quick-slot" ? 240 : 320;
  const max = surface === "quick-slot" ? 640 : 1280;
  const safeCardEdge =
    Number.isFinite(cardLongEdgePx) && (cardLongEdgePx ?? 0) > 0 ? cardLongEdgePx! : 480;
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(clamp(safeCardEdge * safeDpr * factorByBand[qualityBand], min, max));
};

const applyHeavyLoadLongEdgeCompaction = ({
  targetLongEdgePx,
  surface,
  pressureLevel,
}: {
  targetLongEdgePx: number;
  surface: AdaptiveSurface;
  pressureLevel: AdaptivePressureLevel;
}): number => {
  if (!REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION) return targetLongEdgePx;
  if (pressureLevel !== 2) return targetLongEdgePx;

  if (surface === "reference-grid") {
    return Math.round(clamp(targetLongEdgePx * 0.86, 320, 1280));
  }
  if (surface === "quick-slot") {
    return Math.round(clamp(targetLongEdgePx * 0.9, 240, 640));
  }
  return targetLongEdgePx;
};

export const resolveAdaptivePolicyDecision = (input: AdaptiveInput): AdaptiveDecision => {
  const pressureLevel = asPressureLevel(input.pressureLevel);
  const qualityBand = resolveQualityBand(pressureLevel);
  const adaptiveRequested = input.adaptivePreviewQuality === true;
  const adaptationEnabled =
    adaptiveRequested &&
    !ADAPTIVE_MEDIA_V2_FORCE_FULL_QUALITY &&
    input.surface !== "detail-modal" &&
    input.mediaKind === "image";

  const tuned = ADAPTIVE_MEDIA_V2_TUNED_POLICY;
  const qualityParam = (tuned ? TUNED_QUALITY_Q : PARITY_QUALITY_Q)[qualityBand];
  const localTranscodeQuality = (
    tuned ? TUNED_LOCAL_TRANSCODE_QUALITY : PARITY_LOCAL_TRANSCODE_QUALITY
  )[qualityBand];

  const targetLongEdgePxBase = tuned
    ? resolveTunedTargetLongEdgePx({
        surface: input.surface,
        qualityBand,
        cardLongEdgePx: input.cardLongEdgePx ?? null,
        devicePixelRatio: input.devicePixelRatio ?? 1,
      })
    : resolveParityTargetLongEdgePx({
        surface: input.surface,
        qualityBand,
      });
  const targetLongEdgePx = applyHeavyLoadLongEdgeCompaction({
    targetLongEdgePx: targetLongEdgePxBase,
    surface: input.surface,
    pressureLevel,
  });

  const localSource = input.source === "local-blob" || input.source === "data-url";
  const localAllowedSurface = input.surface === "reference-grid" || input.surface === "quick-slot";

  const allowTranscodeLocal =
    adaptationEnabled &&
    localSource &&
    localAllowedSurface &&
    GRID_SURFACE_SET.has(input.surface === "quick-slot" ? "reference-grid" : input.surface);

  return {
    qualityBand,
    targetLongEdgePx,
    qualityParam,
    localTranscodeQuality,
    allowTranscodeLocal,
    adaptationEnabled,
  };
};

export const resolveAdaptivePressureLevel = asPressureLevel;
