import { logMediaPerf } from "../mediaPerfTelemetry";
import type { AdaptiveResolvedMedia } from "./types";

export const logAdaptivePolicyApplied = ({ result }: { result: AdaptiveResolvedMedia }): void => {
  logMediaPerf("media.adaptive.policy.applied", {
    surface: result.decisionMeta.surface,
    media_kind: result.decisionMeta.mediaKind,
    pressure_level: result.decisionMeta.pressureLevel,
    quality_band: result.decision.qualityBand,
    target_long_edge_px: result.decision.targetLongEdgePx,
    source_kind: result.decisionMeta.source,
    used_fallback: result.decisionMeta.usedFallback,
  });
};

export const logAdaptiveResolveMismatch = ({
  surface,
  mediaKind,
  pressureLevel,
  oldPreviewUrl,
  newPreviewUrl,
}: {
  surface: string;
  mediaKind: string;
  pressureLevel: number;
  oldPreviewUrl: string | null;
  newPreviewUrl: string | null;
}): void => {
  logMediaPerf("media.adaptive.resolve.mismatch", {
    surface,
    media_kind: mediaKind,
    pressure_level: pressureLevel,
    old_preview_shape: oldPreviewUrl ? oldPreviewUrl.slice(0, 48) : "",
    new_preview_shape: newPreviewUrl ? newPreviewUrl.slice(0, 48) : "",
  });
};

export const logAdaptiveLocalTranscode = ({
  surface,
  pressureLevel,
  qualityBand,
  targetLongEdgePx,
}: {
  surface: string;
  pressureLevel: number;
  qualityBand: string;
  targetLongEdgePx: number;
}): void => {
  logMediaPerf("media.adaptive.local_transcode.applied", {
    surface,
    pressure_level: pressureLevel,
    quality_band: qualityBand,
    target_long_edge_px: targetLongEdgePx,
  });
};

export const logAdaptiveRecoveryLevelChanged = ({
  surface,
  prevLevel,
  nextLevel,
}: {
  surface: string;
  prevLevel: number;
  nextLevel: number;
}): void => {
  logMediaPerf("media.adaptive.recovery.level_changed", {
    surface,
    prev_level: prevLevel,
    next_level: nextLevel,
  });
};

export const logAdaptiveDetailFullQualityUsed = ({
  surface,
  mediaKind,
}: {
  surface: string;
  mediaKind: string;
}): void => {
  logMediaPerf("media.adaptive.detail.full_quality_used", {
    surface,
    media_kind: mediaKind,
  });
};

export const logAdaptiveError = ({
  surface,
  errorCode,
}: {
  surface: string;
  errorCode: string;
}): void => {
  logMediaPerf("media.adaptive.error", {
    surface,
    error_code: errorCode,
  });
};
