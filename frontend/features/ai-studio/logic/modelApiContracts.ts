/**
 * Provider API contract manifest for AI Studio models.
 * Centralizes aspect/resolution/duration capabilities verified against model docs.
 */

export type ModelAspectSubmitField = "aspect_ratio" | "image_size" | "none";

export type ModelApiContract = {
  modelId: string;
  defaultAspect: string;
  allowedAspects: string[];
  defaultResolution?: string;
  allowedResolutions?: string[];
  defaultDurationSeconds?: number;
  allowedDurations?: number[];
  submitAspectField: ModelAspectSubmitField;
  sourceUrl: string;
  verifiedAt: string;
};

const VERIFIED_AT = "2026-02-17";

const contracts: Record<string, ModelApiContract> = {
  "fal-ai/flux-2/klein/9b": {
    modelId: "fal-ai/flux-2/klein/9b",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    submitAspectField: "image_size",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/klein/9b/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal/flux-2": {
    modelId: "fal/flux-2",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    submitAspectField: "image_size",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal/flux-2/edit": {
    modelId: "fal/flux-2/edit",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    submitAspectField: "image_size",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/edit/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal/flux-2-pro": {
    modelId: "fal/flux-2-pro",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    submitAspectField: "image_size",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2-pro/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal/flux-2-pro/edit": {
    modelId: "fal/flux-2-pro/edit",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    submitAspectField: "image_size",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2-pro/edit/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/nano-banana": {
    modelId: "fal-ai/nano-banana",
    defaultAspect: "1:1",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/nano-banana/edit": {
    modelId: "fal-ai/nano-banana/edit",
    defaultAspect: "auto",
    allowedAspects: [
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana/edit/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/nano-banana-pro": {
    modelId: "fal-ai/nano-banana-pro",
    defaultAspect: "4:5",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "4:5", "3:4", "2:3", "9:16", "1:1"],
    defaultResolution: "1K",
    allowedResolutions: ["1K", "2K", "4K"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/nano-banana-pro/edit": {
    modelId: "fal-ai/nano-banana-pro/edit",
    defaultAspect: "auto",
    allowedAspects: [
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ],
    defaultResolution: "1K",
    allowedResolutions: ["1K", "2K", "4K"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/edit/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": {
    modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default", "auto_2K", "auto_4K"],
    submitAspectField: "image_size",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/bytedance/seedream/v4.5/edit": {
    modelId: "fal-ai/bytedance/seedream/v4.5/edit",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default", "auto_2K", "auto_4K"],
    submitAspectField: "image_size",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/kling-video/v3/pro/text-to-video": {
    modelId: "fal-ai/kling-video/v3/pro/text-to-video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    defaultDurationSeconds: 10,
    allowedDurations: [5, 6, 7, 8, 9, 10],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/kling-video/v3/pro/image-to-video": {
    modelId: "fal-ai/kling-video/v3/pro/image-to-video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    defaultDurationSeconds: 10,
    allowedDurations: [5, 6, 7, 8, 9, 10],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/veo3.1": {
    modelId: "fal-ai/veo3.1",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 6, 8],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p", "4k"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/veo3.1/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/veo3.1/image-to-video": {
    modelId: "fal-ai/veo3.1/image-to-video",
    defaultAspect: "auto",
    allowedAspects: ["auto", "16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 6, 8],
    defaultResolution: "720p",
    allowedResolutions: ["720p", "1080p", "4k"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/veo3.1/image-to-video/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/veo3.1/first-last-frame-to-video": {
    modelId: "fal-ai/veo3.1/first-last-frame-to-video",
    defaultAspect: "auto",
    allowedAspects: ["auto", "16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 6, 8],
    defaultResolution: "720p",
    allowedResolutions: ["720p", "1080p", "4k"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/veo3.1/first-last-frame-to-video/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/sora-2/text-to-video/pro": {
    modelId: "fal-ai/sora-2/text-to-video/pro",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 8, 12],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/sora-2/text-to-video/pro/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": {
    modelId: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    defaultDurationSeconds: 10,
    allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultResolution: "1080p",
    allowedResolutions: ["480p", "720p", "1080p"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/text-to-video/api",
    verifiedAt: VERIFIED_AT,
  },
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": {
    modelId: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    defaultDurationSeconds: 5,
    allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultResolution: "1080p",
    allowedResolutions: ["480p", "720p", "1080p"],
    submitAspectField: "aspect_ratio",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/api",
    verifiedAt: VERIFIED_AT,
  },
  "gpt-5-nano": {
    modelId: "gpt-5-nano",
    defaultAspect: "text",
    allowedAspects: [],
    submitAspectField: "none",
    sourceUrl: "https://platform.openai.com/docs/models/gpt-5-nano",
    verifiedAt: VERIFIED_AT,
  },
};

export const listModelApiContracts = (): ModelApiContract[] => Object.values(contracts);

export const getModelApiContract = (modelId: string): ModelApiContract | null =>
  contracts[modelId] ?? null;

export const getModelAllowedAspects = (modelId: string, fallback: string[] = []): string[] => {
  const contract = getModelApiContract(modelId);
  return contract?.allowedAspects?.length ? contract.allowedAspects : fallback;
};

export const getModelDefaultAspect = (modelId: string, fallback: string): string => {
  return getModelApiContract(modelId)?.defaultAspect ?? fallback;
};

export const getModelAllowedResolutions = (
  modelId: string,
  fallback: string[] | undefined
): string[] | undefined => {
  const contract = getModelApiContract(modelId);
  if (contract?.allowedResolutions) return contract.allowedResolutions;
  return fallback;
};

export const getModelDefaultResolution = (
  modelId: string,
  fallback: string | undefined
): string | undefined => {
  const contract = getModelApiContract(modelId);
  if (typeof contract?.defaultResolution === "string") return contract.defaultResolution;
  return fallback;
};

export const getModelAllowedDurations = (
  modelId: string,
  fallback: number[] | undefined
): number[] | undefined => {
  const contract = getModelApiContract(modelId);
  if (contract?.allowedDurations) return contract.allowedDurations;
  return fallback;
};

export const getModelDefaultDurationSeconds = (
  modelId: string,
  fallback: number | undefined
): number | undefined => {
  const contract = getModelApiContract(modelId);
  if (typeof contract?.defaultDurationSeconds === "number") return contract.defaultDurationSeconds;
  return fallback;
};

export const resolveEffectiveAspectForModel = (
  modelId: string,
  requestedAspect: string | null | undefined,
  fallback = "16:9"
): string => {
  const contract = getModelApiContract(modelId);
  const next = requestedAspect?.trim();

  if (!contract) {
    return next && next.length ? next : fallback;
  }

  if (!contract.allowedAspects.length) {
    return next && next.length ? next : contract.defaultAspect;
  }

  if (next && contract.allowedAspects.includes(next)) {
    return next;
  }

  if (contract.allowedAspects.includes(contract.defaultAspect)) {
    return contract.defaultAspect;
  }

  return contract.allowedAspects[0] ?? fallback;
};
