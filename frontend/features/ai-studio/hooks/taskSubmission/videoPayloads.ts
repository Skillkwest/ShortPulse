/**
 * Shared payload normalization helpers for video model submission handlers.
 */
import { resolveKlingV3Duration } from "../../logic/stateParsers";
import { getModelApiContract, resolveEffectiveAspectForModel } from "../../logic/modelApiContracts";
import type { SubmissionModelConfig, VideoSubmissionArgs } from "./types";

type KlingMultiPromptPayload = { prompt: string; duration: number };
type KlingElementPayload =
  | { video_url: string }
  | { frontal_image_url: string | undefined; reference_image_urls: string[] | undefined };

const resolveAspectForModelConfig = (
  aspect: string,
  modelConfig: SubmissionModelConfig,
  fallback: string
): string => {
  if (modelConfig?.id && getModelApiContract(modelConfig.id)) {
    return resolveEffectiveAspectForModel(modelConfig.id, aspect, fallback);
  }
  if (modelConfig?.allowedAspects?.includes(aspect)) {
    return aspect;
  }
  if (modelConfig?.defaultAspect) {
    return modelConfig.defaultAspect;
  }
  return fallback;
};

/**
 * Fal currently guarantees `shot_type=customize` support for Kling 3 image-to-video.
 * Omit other values to avoid provider-side validation failures.
 */
export const resolveKlingShotType = (
  shotType: VideoSubmissionArgs["klingShotType"]
): "customize" | undefined => (shotType === "customize" ? "customize" : undefined);

/**
 * Normalizes aspect ratio for VEO image/video routes.
 */
export const resolveVeoAspect = (aspect: string): "16:9" | "9:16" | "auto" =>
  aspect === "16:9" || aspect === "9:16" ? aspect : "auto";

/**
 * Maps duration seconds to VEO-supported duration labels.
 */
export const resolveVeoDuration = (requestedDurationSeconds: number): "4s" | "6s" | "8s" =>
  requestedDurationSeconds <= 4 ? "4s" : requestedDurationSeconds <= 6 ? "6s" : "8s";

/**
 * Normalizes Kling 3.0 resolution choices.
 */
export const resolveKlingResolution = (
  requestedResolution?: string,
  fallback: "720p" | "1080p" = "1080p"
): "720p" | "1080p" => {
  const normalized = requestedResolution?.toLowerCase() ?? "";
  if (normalized.includes("720")) return "720p";
  if (normalized.includes("1080")) return "1080p";
  return fallback;
};

/**
 * Maps Kie Kling resolution tiers to the provider mode enum.
 */
export const resolveKieKlingMode = (requestedResolution?: string): "std" | "pro" =>
  resolveKlingResolution(requestedResolution) === "720p" ? "std" : "pro";

/**
 * Normalizes VEO resolution selection to accepted enum values.
 */
export const resolveVeoResolution = (
  requestedResolution?: string,
  fallback: "720p" | "1080p" = "720p"
): "720p" | "1080p" | "4k" => {
  const normalized = requestedResolution?.toLowerCase() ?? "";
  if (normalized.includes("4k")) return "4k";
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("720")) return "720p";
  return fallback;
};

/**
 * Resolves allowed Seedance text aspect ratio with model fallback defaults.
 */
export const resolveSeedanceTextAspect = (
  aspect: string,
  modelConfig: SubmissionModelConfig
): "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" => {
  const resolved = resolveAspectForModelConfig(aspect, modelConfig, "16:9");
  if (
    resolved === "16:9" ||
    resolved === "9:16" ||
    resolved === "1:1" ||
    resolved === "4:3" ||
    resolved === "3:4" ||
    resolved === "21:9"
  ) {
    return resolved;
  }
  return "16:9";
};

/**
 * Resolves Seedance image-to-video aspect ratio with model fallback defaults.
 */
export const resolveSeedanceI2VAspect = (
  aspect: string,
  modelConfig: SubmissionModelConfig
): string => resolveAspectForModelConfig(aspect, modelConfig, "16:9");

/**
 * Normalizes Seedance image-to-video resolution.
 */
export const resolveSeedanceI2VResolution = (
  requestedResolution?: string
): "480p" | "720p" | "1080p" => {
  const normalized = requestedResolution?.toLowerCase() ?? "";
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("480")) return "480p";
  return "720p";
};

/**
 * Normalizes Seedance text-to-video resolution.
 */
export const resolveSeedanceTextResolution = (
  requestedResolution?: string
): "480p" | "720p" | "1080p" => {
  const normalized = requestedResolution?.toLowerCase() ?? "";
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("480")) return "480p";
  if (normalized.includes("720") || normalized.includes("high")) return "720p";
  return "1080p";
};

/**
 * Clamps Seedance image-to-video duration to API-supported range.
 */
export const resolveSeedanceI2VDuration = (requestedDurationSeconds: number): string =>
  Math.max(4, Math.min(12, requestedDurationSeconds)).toString();

/**
 * Resolves Sora-supported aspect ratio with model defaults.
 */
export const resolveSoraAspect = (
  aspect: string,
  modelConfig: SubmissionModelConfig
): "16:9" | "9:16" => {
  const resolved = resolveAspectForModelConfig(aspect, modelConfig, "16:9");
  return resolved === "9:16" ? "9:16" : "16:9";
};

/**
 * Normalizes Sora resolution choices.
 */
export const resolveSoraResolution = (requestedResolution?: string): "720p" | "1080p" =>
  requestedResolution?.toLowerCase().includes("720") ? "720p" : "1080p";

/**
 * Resolves VEO text-to-video aspect ratio with model defaults.
 */
export const resolveVeoTextAspect = (
  aspect: string,
  modelConfig: SubmissionModelConfig
): "16:9" | "9:16" => {
  const resolved = resolveAspectForModelConfig(aspect, modelConfig, "16:9");
  return resolved === "9:16" ? "9:16" : "16:9";
};

/**
 * Builds compact list of up to two non-empty Kling voice IDs.
 */
export const buildKlingVoiceIds = (klingVoiceIds: [string, string]): string[] =>
  klingVoiceIds
    .map((voice) => voice.trim())
    .filter(Boolean)
    .slice(0, 2);

/**
 * Builds Kling multi-prompt payload from non-empty shots.
 */
export const buildKlingMultiPromptPayload = (
  klingMultiPrompts: VideoSubmissionArgs["klingMultiPrompts"]
): KlingMultiPromptPayload[] | undefined => {
  const payload = klingMultiPrompts
    .map((shot) =>
      shot.prompt.trim()
        ? { prompt: shot.prompt.trim(), duration: resolveKlingV3Duration(shot.duration) }
        : null
    )
    .filter((shot): shot is KlingMultiPromptPayload => Boolean(shot));
  return payload.length ? payload : undefined;
};

/**
 * Builds Kling element payloads from either video references or image reference sets.
 */
export const buildKlingElementsPayload = (
  klingElements: VideoSubmissionArgs["klingElements"]
): KlingElementPayload[] | undefined => {
  const payload = klingElements.reduce<KlingElementPayload[]>((accumulator, element) => {
    const referenceList = element.referenceImageUrls
      .split(/[,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (element.videoUrl.trim()) {
      accumulator.push({ video_url: element.videoUrl.trim() });
      return accumulator;
    }

    if (element.frontalImageUrl.trim() || referenceList.length) {
      accumulator.push({
        frontal_image_url: element.frontalImageUrl.trim() || undefined,
        reference_image_urls: referenceList.length ? referenceList : undefined,
      });
    }
    return accumulator;
  }, []);

  return payload.length ? payload : undefined;
};
