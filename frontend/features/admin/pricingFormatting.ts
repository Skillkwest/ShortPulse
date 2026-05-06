import type { AdminPricingModelRow, AdminPricingPreviewVariant } from "./types";
import type {
  AudioDraftByModelId,
  AspectDraftByModelId,
  ResolutionDraftByModelId,
} from "./pricingDrafts";
import { parseAudioDraft, shouldShowAudioSpecControl } from "./pricingDrafts";

export const formatUsd = (value: number): string => `$${value.toFixed(2)}`;

export const formatProviderCostUsd = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value > 0 && value < 1) return `$${value.toFixed(4)}`;
  return formatUsd(value);
};

export const formatCurrencyFromCents = (value: number): string => formatUsd(value / 100);

export const formatCredits = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value);

export const formatFractionalCredits = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  }).format(value);
};

export const formatPercent = (value: number): string =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;

export const formatDateTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "—";

export const getModelTypeLabel = (
  model: AdminPricingModelRow,
  variant: AdminPricingPreviewVariant | null = null
): string => {
  const workflow = model.workflowType.toLowerCase();
  const strategy = model.pricingStrategy.toLowerCase();
  const modelLabel = model.label.toLowerCase();
  const variantId = variant?.id.toLowerCase() ?? "";
  const variantLabel = variant?.label.toLowerCase() ?? "";

  if (workflow.includes("image to video") || workflow.includes("image + video")) {
    return "image → video";
  }
  if (workflow.includes("text to video")) return "text → video";
  if (workflow.includes("image to image")) return "image → image";
  if (workflow.includes("text to image")) {
    if (modelLabel.includes("edit") || variantId === "edit" || variantLabel.includes("edit")) {
      return "image → image";
    }
    return "text → image";
  }
  if (workflow.includes("text + image edit")) {
    if (variantId === "edit" || variantLabel.includes("edit") || modelLabel.includes("edit")) {
      return "image → image";
    }
    if (variantId === "create" || variantLabel.includes("create")) return "text → image";
    return "text/image → image";
  }
  if (strategy === "elevenlabs-voice-changer-per-minute") return "sound → sound";
  if (strategy.includes("elevenlabs")) return "text → sound";
  if (workflow.includes("audio") || workflow.includes("sound")) {
    return workflow.includes("text") ? "text → sound" : "sound → sound";
  }
  if (workflow.includes("text")) return "text → text";
  if (workflow.includes("video") || strategy.includes("video") || strategy.includes("per-second")) {
    return "video";
  }
  if (workflow.includes("image") || strategy.includes("image") || strategy.includes("megapixel")) {
    return "image";
  }
  return workflow || "text";
};

export const getPricingAuthorityLabel = (
  authority: "shared_policy" | "local_pricing" | "metadata_only"
): string => {
  if (authority === "shared_policy") return "Shared policy";
  if (authority === "local_pricing") return "Local pricing";
  return "Metadata only";
};

export type ModelSpecDraftContext = {
  aspectDrafts?: AspectDraftByModelId;
  resolutionDrafts?: ResolutionDraftByModelId;
  audioDrafts?: AudioDraftByModelId;
};

export const getResolvedModelSpec = (
  model: AdminPricingModelRow,
  draftContext: ModelSpecDraftContext = {}
): {
  aspect: string;
  resolution: string | null;
  audio: boolean | null;
} => ({
  aspect: draftContext.aspectDrafts?.[model.id] ?? model.defaultAspect,
  resolution: draftContext.resolutionDrafts?.[model.id] ?? model.defaultResolution,
  audio: shouldShowAudioSpecControl(model)
    ? parseAudioDraft(draftContext.audioDrafts?.[model.id], model)
    : null,
});

export const getModelSpecSummary = (
  model: AdminPricingModelRow,
  draftContext: ModelSpecDraftContext = {}
): string => {
  const resolvedSpec = getResolvedModelSpec(model, draftContext);
  const parts: string[] = [];
  if (resolvedSpec.resolution) parts.push(resolvedSpec.resolution);
  if (resolvedSpec.aspect) parts.push(resolvedSpec.aspect);
  if (resolvedSpec.audio != null) parts.push(resolvedSpec.audio ? "audio on" : "audio off");
  return parts.length ? parts.join(" / ") : model.workflowType;
};

export const getModelDefaultDurationSeconds = (model: AdminPricingModelRow): number | null =>
  model.defaultDurationSeconds ?? model.defaultSourceDurationSeconds ?? null;

export const getModelDurationSummary = (model: AdminPricingModelRow): string => {
  const durationSeconds = getModelDefaultDurationSeconds(model);
  return durationSeconds != null ? String(durationSeconds) : "";
};

export const getVariantSpecSummary = (
  model: AdminPricingModelRow,
  variant: AdminPricingPreviewVariant | null,
  variantCount: number,
  draftContext: ModelSpecDraftContext = {}
): string => {
  const resolvedSpec = getResolvedModelSpec(model, draftContext);
  const parts: string[] = [];
  const resolution = variant?.resolution ?? resolvedSpec.resolution;
  const aspect = variant?.aspect ?? resolvedSpec.aspect;
  const audio = variant?.audio ?? resolvedSpec.audio;
  if (resolution) parts.push(resolution);
  if (aspect) parts.push(aspect);
  if (audio != null) parts.push(audio ? "audio on" : "audio off");
  const baseSpec = parts.length ? parts.join(" / ") : model.workflowType;
  if (
    !variant ||
    variantCount <= 1 ||
    variant.id === "default" ||
    variant.label.toLowerCase() === "default"
  ) {
    return baseSpec;
  }
  return `${variant.label} / ${baseSpec}`;
};
