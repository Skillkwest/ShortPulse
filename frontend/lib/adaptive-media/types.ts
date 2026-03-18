export type AdaptiveSurface =
  | "reference-grid"
  | "quick-slot"
  | "media-library-grid"
  | "media-library-modal-grid"
  | "media-library-panel-grid"
  | "character-grid"
  | "detail-modal";

export type AdaptivePressureLevel = 0 | 1 | 2;

export type AdaptiveMediaKind = "image" | "video" | "unknown";

export type AdaptiveSourceKind = "remote" | "local-blob" | "data-url";

export type AdaptiveQualityBand = "high" | "balanced" | "compact";

export type AdaptiveStorageCandidates = {
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
};

export type AdaptiveUrlCandidates = {
  previewUrl?: string | null;
  fullUrl?: string | null;
  resultUrls?: string[] | null;
};

export type AdaptiveInput = {
  surface: AdaptiveSurface;
  mediaKind: AdaptiveMediaKind;
  source: AdaptiveSourceKind;
  urls: AdaptiveUrlCandidates;
  storage: AdaptiveStorageCandidates;
  pressureLevel?: number;
  cardLongEdgePx?: number | null;
  devicePixelRatio?: number;
  strictPreviewLadder?: boolean;
  adaptivePreviewQuality?: boolean;
};

export type AdaptiveDecision = {
  qualityBand: AdaptiveQualityBand;
  targetLongEdgePx: number;
  qualityParam: number;
  localTranscodeQuality: number;
  allowTranscodeLocal: boolean;
  adaptationEnabled: boolean;
};

export type AdaptiveDecisionMeta = {
  surface: AdaptiveSurface;
  mediaKind: AdaptiveMediaKind;
  source: AdaptiveSourceKind;
  pressureLevel: AdaptivePressureLevel;
  usedFallback: boolean;
  usedOptimizerTransform: boolean;
  strictPreviewLadder: boolean;
};

export type AdaptiveResolvedMedia = {
  previewUrl: string | null;
  fullUrl: string | null;
  fallbackChain: string[];
  decision: AdaptiveDecision;
  decisionMeta: AdaptiveDecisionMeta;
};
