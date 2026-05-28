/**
 * Shared payload normalization helpers for video model submission handlers.
 */
import { resolveKlingV3Duration } from "../../logic/stateParsers";
import {
  getAiStudioKlingElementReferenceUrls,
  resolveKieKlingElementToken,
} from "../../logic/klingElements";
import { getModelApiContract, resolveEffectiveAspectForModel } from "../../logic/modelApiContracts";
import type { SubmissionModelConfig, VideoSubmissionArgs } from "./types";

type KlingMultiPromptPayload = { prompt: string; duration: number };
type KlingElementPayload =
  | { video_url: string }
  | { frontal_image_url: string | undefined; reference_image_urls: string[] | undefined };
type KieKlingMultiPromptPayload = { prompt: string; duration: number };
type KieKlingElementPayload = {
  name: string;
  description: string;
  element_input_urls?: string[];
  element_input_video_urls?: string[];
};

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

export const resolveKlingShotType = (
  shotType: "customize" | "intelligent" | undefined
): "customize" | "intelligent" | undefined =>
  shotType === "customize" || shotType === "intelligent" ? shotType : undefined;

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
 * Maps UI resolution intent to KIE Kling generation mode.
 */
export const resolveKieKlingMode = (requestedResolution?: string): "std" | "pro" =>
  resolveKlingResolution(requestedResolution) === "720p" ? "std" : "pro";

/**
 * Clamps KIE Kling single-shot duration to the supported range.
 */
export const resolveKieKlingDuration = (requestedDurationSeconds: number): number =>
  Math.max(3, Math.min(15, Math.round(requestedDurationSeconds)));

/**
 * Resolves Kie Kling aspect ratio with model-aware fallback defaults.
 */
export const resolveKieKlingAspect = (
  aspect: string,
  modelConfig: SubmissionModelConfig
): "16:9" | "9:16" | "1:1" => {
  const resolved = resolveAspectForModelConfig(aspect, modelConfig, "16:9");
  if (resolved === "16:9" || resolved === "9:16" || resolved === "1:1") {
    return resolved;
  }
  return "16:9";
};

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
 * Maps Seedance 2.x duration to the documented 5s/10s/15s contract.
 */
export const resolveSeedance2Duration = (requestedDurationSeconds: number): string =>
  requestedDurationSeconds <= 5 ? "5" : requestedDurationSeconds <= 10 ? "10" : "15";

/**
 * Resolves Seedance 2.x resolution against the model-declared contract.
 */
const normalizeSeedanceResolutionChoice = (requestedResolution?: string): string | null => {
  const normalized = requestedResolution?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("720") || normalized.includes("high")) return "720p";
  if (normalized.includes("480")) return "480p";
  return requestedResolution?.trim() ?? null;
};

export const resolveSeedance2Resolution = (
  requestedResolution: string | undefined,
  modelConfig: SubmissionModelConfig
): string => {
  const contract = modelConfig?.id ? getModelApiContract(modelConfig.id) : null;
  const allowedResolutions = contract?.allowedResolutions ?? modelConfig?.allowedResolutions ?? [];
  const defaultResolution =
    contract?.defaultResolution ?? modelConfig?.defaultResolution ?? "1080p";
  const fallbackResolution = allowedResolutions.includes(defaultResolution)
    ? defaultResolution
    : (allowedResolutions[0] ?? defaultResolution);
  const normalizedRequested = normalizeSeedanceResolutionChoice(requestedResolution);
  if (!normalizedRequested) {
    return fallbackResolution;
  }
  const matchedResolution = allowedResolutions.find(
    (candidate) => candidate.toLowerCase() === normalizedRequested.toLowerCase()
  );
  if (matchedResolution) {
    return matchedResolution;
  }
  const modelLabel = modelConfig?.label ?? contract?.modelId ?? "Seedance 2";
  throw new Error(
    `${modelLabel} submit uses unsupported resolution: ${normalizedRequested}. Allowed: ${allowedResolutions.join(", ")}`
  );
};

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
 * Builds KIE Kling multi-shot payload from non-empty shots.
 */
export const buildKieKlingMultiPromptPayload = (
  klingMultiPrompts: VideoSubmissionArgs["klingMultiPrompts"]
): KieKlingMultiPromptPayload[] | undefined => {
  const payload = klingMultiPrompts
    .map((shot) => {
      const prompt = shot.prompt.trim();
      if (!prompt) return null;
      return {
        prompt,
        duration: Math.max(1, Math.min(12, Math.round(shot.duration))),
      };
    })
    .filter((shot): shot is KieKlingMultiPromptPayload => Boolean(shot));
  return payload.length ? payload : undefined;
};

/**
 * Builds Kling element payloads from either video references or image reference sets.
 */
export const buildKlingElementsPayload = (
  klingElements: VideoSubmissionArgs["klingElements"]
): KlingElementPayload[] | undefined => {
  const orderedElements = [...klingElements].sort((a, b) => {
    const left = a.slotIndex ?? 0;
    const right = b.slotIndex ?? 0;
    return left - right;
  });
  const payload = orderedElements.reduce<KlingElementPayload[]>((accumulator, element) => {
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

/**
 * Builds KIE Kling element payloads using deterministic element token names.
 */
export const buildKieKlingElementsPayload = (
  klingElements: VideoSubmissionArgs["klingElements"]
): KieKlingElementPayload[] | undefined => {
  const orderedElements = [...klingElements].sort((a, b) => {
    const left = a.slotIndex ?? 0;
    const right = b.slotIndex ?? 0;
    return left - right;
  });
  const payload = orderedElements.reduce<KieKlingElementPayload[]>(
    (accumulator, element, index) => {
      const tokenName = resolveKieKlingElementToken(
        element,
        element.slotIndex ?? index,
        orderedElements
      );
      const imageList = Array.from(new Set(getAiStudioKlingElementReferenceUrls(element))).slice(
        0,
        4
      );
      const displayName = element.name?.trim() || tokenName;

      if (element.videoUrl.trim()) {
        accumulator.push({
          name: tokenName,
          description: `Reference video for ${displayName}`,
          element_input_video_urls: [element.videoUrl.trim()],
        });
        return accumulator;
      }

      if (imageList.length) {
        accumulator.push({
          name: tokenName,
          description: `Reference images for ${displayName}`,
          element_input_urls: imageList,
        });
      }
      return accumulator;
    },
    []
  );

  return payload.length ? payload : undefined;
};
