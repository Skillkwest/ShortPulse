/**
 * Canonical model catalog shared by AI Studio client logic and server runtime.
 * Keep model capabilities, provider docs provenance, and Fal routing aliases in one place.
 */

export type ModelAspectSubmitField = "aspect_ratio" | "image_size" | "none";
export type ModelProvider = "fal" | "openai";

export type ModelPayloadValidationSpec = {
  requiredStringFields?: string[];
  requiredStringArrayFields?: Array<{ field: string; min?: number; max?: number }>;
  requiredAnyOfStringFields?: string[];
  requiredAnyOfStringArrayFields?: string[];
  enumFields?: Record<string, string[]>;
  optionalBooleanFields?: string[];
  optionalNumberFields?: string[];
};

export type ModelCatalogEntry = {
  modelId: string;
  provider: ModelProvider;
  sourceUrl: string;
  verifiedAt: string;
  submitAspectField: ModelAspectSubmitField;
  defaultAspect: string;
  allowedAspects: string[];
  defaultResolution?: string;
  allowedResolutions?: string[];
  defaultDurationSeconds?: number;
  allowedDurations?: number[];
  falSubmitUrl?: string;
  falStatusBaseUrls?: string[];
  falTimeoutMs?: number;
  pricingParamAliases?: {
    webSearch?: string[];
  };
  payloadValidation?: ModelPayloadValidationSpec;
};

const VERIFIED_AT = "2026-02-17";

const catalog: Record<string, ModelCatalogEntry> = {
  "fal-ai/flux-2/klein/9b": {
    modelId: "fal-ai/flux-2/klein/9b",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/klein/9b/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-2/klein/9b",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/flux-2/requests",
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "num_inference_steps", "seed", "guidance_scale"],
    },
  },
  "fal/flux-2": {
    modelId: "fal/flux-2",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-2",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/flux-2/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "num_inference_steps", "seed", "guidance_scale"],
    },
  },
  "fal/flux-2/edit": {
    modelId: "fal/flux-2/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-2/edit",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/flux-2/requests",
      "https://queue.fal.run/fal-ai/flux-2/edit/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1 }],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "num_inference_steps", "seed", "guidance_scale"],
    },
  },
  "fal/flux-2-pro": {
    modelId: "fal/flux-2-pro",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2-pro/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-2-pro",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/flux-2-pro/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
        safety_tolerance: ["1", "2", "3", "4", "5"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "seed", "guidance_scale", "num_inference_steps"],
    },
  },
  "fal/flux-2-pro/edit": {
    modelId: "fal/flux-2-pro/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2-pro/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-2-pro/edit",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/flux-2-pro/requests",
      "https://queue.fal.run/fal-ai/flux-2-pro/edit/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1 }],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
        safety_tolerance: ["1", "2", "3", "4", "5"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "seed", "guidance_scale", "num_inference_steps"],
    },
  },
  "fal-ai/nano-banana": {
    modelId: "fal-ai/nano-banana",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "1:1",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "limit_generations"],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana/edit": {
    modelId: "fal-ai/nano-banana/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
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
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana/edit",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/nano-banana/requests",
      "https://queue.fal.run/fal-ai/nano-banana/edit/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1 }],
      enumFields: {
        aspect_ratio: [
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
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "limit_generations"],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana-pro": {
    modelId: "fal-ai/nano-banana-pro",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "4:5",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "4:5", "3:4", "2:3", "9:16", "1:1"],
    defaultResolution: "1K",
    allowedResolutions: ["1K", "2K", "4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana-pro",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana-pro/requests"],
    falTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["enable_web_search", "web_search", "enable_google_search"],
    },
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["21:9", "16:9", "3:2", "4:3", "5:4", "4:5", "3:4", "2:3", "9:16", "1:1"],
        output_format: ["png", "jpeg", "webp"],
        resolution: ["1K", "2K", "4K"],
      },
      optionalBooleanFields: [
        "sync_mode",
        "limit_generations",
        "enable_web_search",
        "enable_google_search",
      ],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana-pro/edit": {
    modelId: "fal-ai/nano-banana-pro/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
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
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/edit",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      "https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests",
    ],
    falTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["enable_web_search", "web_search", "enable_google_search"],
    },
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1 }],
      enumFields: {
        aspect_ratio: [
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
        output_format: ["png", "jpeg", "webp"],
        resolution: ["1K", "2K", "4K"],
      },
      optionalBooleanFields: [
        "sync_mode",
        "limit_generations",
        "enable_web_search",
        "enable_google_search",
      ],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": {
    modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default", "auto_2K", "auto_4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/bytedance/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "max_images", "seed"],
    },
  },
  "fal-ai/bytedance/seedream/v4.5/edit": {
    modelId: "fal-ai/bytedance/seedream/v4.5/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default", "auto_2K", "auto_4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/bytedance/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1, max: 10 }],
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "max_images", "seed"],
    },
  },
  "fal-ai/kling-video/v3/pro/text-to-video": {
    modelId: "fal-ai/kling-video/v3/pro/text-to-video",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    defaultDurationSeconds: 10,
    allowedDurations: [5, 6, 7, 8, 9, 10],
    falSubmitUrl: "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/kling-video/requests",
      "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["16:9", "9:16", "1:1"],
      },
      optionalBooleanFields: ["generate_audio"],
      optionalNumberFields: ["duration", "cfg_scale"],
    },
  },
  "fal-ai/kling-video/v3/pro/image-to-video": {
    modelId: "fal-ai/kling-video/v3/pro/image-to-video",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    defaultDurationSeconds: 10,
    allowedDurations: [5, 6, 7, 8, 9, 10],
    falSubmitUrl: "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/kling-video/requests",
      "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt", "start_image_url"],
      enumFields: {
        aspect_ratio: ["16:9", "9:16", "1:1"],
      },
      optionalBooleanFields: ["generate_audio"],
      optionalNumberFields: ["duration", "cfg_scale"],
    },
  },
  "fal-ai/veo3.1": {
    modelId: "fal-ai/veo3.1",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/veo3.1/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 6, 8],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p", "4k"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/veo3.1",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/veo3.1/requests",
      "https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video/requests",
      "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
    ],
    falTimeoutMs: 90000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["16:9", "9:16"],
        duration: ["4s", "6s", "8s"],
        resolution: ["720p", "1080p", "4k"],
      },
      optionalBooleanFields: ["generate_audio", "auto_fix", "enable_safety_checker"],
      optionalNumberFields: ["seed", "safety_tolerance"],
    },
  },
  "fal-ai/veo3.1/image-to-video": {
    modelId: "fal-ai/veo3.1/image-to-video",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/veo3.1/image-to-video/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "auto",
    allowedAspects: ["auto", "16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 6, 8],
    defaultResolution: "720p",
    allowedResolutions: ["720p", "1080p", "4k"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/veo3.1/requests",
      "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
      "https://queue.fal.run/fal-ai/veo3.1/reference-to-video/requests",
    ],
    falTimeoutMs: 90000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredAnyOfStringFields: ["image_url"],
      requiredAnyOfStringArrayFields: ["image_urls"],
      enumFields: {
        aspect_ratio: ["auto", "16:9", "9:16"],
        duration: ["4s", "6s", "8s"],
        resolution: ["720p", "1080p", "4k"],
      },
      optionalBooleanFields: ["generate_audio", "auto_fix", "enable_safety_checker"],
      optionalNumberFields: ["seed", "safety_tolerance"],
    },
  },
  "fal-ai/veo3.1/first-last-frame-to-video": {
    modelId: "fal-ai/veo3.1/first-last-frame-to-video",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/veo3.1/first-last-frame-to-video/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "auto",
    allowedAspects: ["auto", "16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 6, 8],
    defaultResolution: "720p",
    allowedResolutions: ["720p", "1080p", "4k"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/veo3.1/requests",
      "https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video/requests",
      "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
    ],
    falTimeoutMs: 90000,
  },
  "fal-ai/sora-2/text-to-video/pro": {
    modelId: "fal-ai/sora-2/text-to-video/pro",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/sora-2/text-to-video/pro/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16"],
    defaultDurationSeconds: 8,
    allowedDurations: [4, 8, 12],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/sora-2/text-to-video/pro",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/sora-2/requests",
      "https://queue.fal.run/fal-ai/sora-2/text-to-video/pro/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["16:9", "9:16"],
        resolution: ["720p", "1080p"],
      },
      optionalBooleanFields: ["delete_video"],
      optionalNumberFields: ["duration"],
    },
  },
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": {
    modelId: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/text-to-video/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    defaultDurationSeconds: 10,
    allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultResolution: "1080p",
    allowedResolutions: ["480p", "720p", "1080p"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/bytedance/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedance/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/text-to-video/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
        resolution: ["480p", "720p", "1080p"],
      },
      optionalBooleanFields: ["generate_audio", "enable_safety_checker"],
      optionalNumberFields: ["cfg_scale"],
    },
  },
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": {
    modelId: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    defaultDurationSeconds: 5,
    allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultResolution: "1080p",
    allowedResolutions: ["480p", "720p", "1080p"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/bytedance/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedance/requests",
      "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt", "image_url"],
      enumFields: {
        aspect_ratio: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
        resolution: ["480p", "720p", "1080p"],
      },
      optionalBooleanFields: ["generate_audio", "camera_fixed", "enable_safety_checker"],
      optionalNumberFields: ["seed"],
    },
  },
  "gpt-5-nano": {
    modelId: "gpt-5-nano",
    provider: "openai",
    sourceUrl: "https://platform.openai.com/docs/models/gpt-5-nano",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
};

export const MODEL_CATALOG: Record<string, ModelCatalogEntry> = catalog;

export const listModelCatalogEntries = (): ModelCatalogEntry[] => Object.values(catalog);

export const getModelCatalogEntry = (modelId: string): ModelCatalogEntry | null =>
  catalog[modelId] ?? null;

export const getFalSubmitUrlByModelId = (modelId: string): string | null =>
  getModelCatalogEntry(modelId)?.falSubmitUrl ?? null;

export const getFalStatusBaseUrlsByModelId = (modelId: string): string[] =>
  getModelCatalogEntry(modelId)?.falStatusBaseUrls ?? [];

export const getFalTimeoutMsByModelId = (modelId: string): number | null =>
  getModelCatalogEntry(modelId)?.falTimeoutMs ?? null;

export const getModelPayloadValidationSpec = (modelId: string): ModelPayloadValidationSpec | null =>
  getModelCatalogEntry(modelId)?.payloadValidation ?? null;
