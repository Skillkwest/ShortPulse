import {
  FLUX_LOGO_SRC,
  GOOGLE_LOGO_SRC,
  KLING_LOGO_SRC,
  modelLogos,
  SEEDREAM_LOGO_SRC,
} from "../constants";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../lib/model-runtime/openAiImage2";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../../../lib/model-runtime/falModelIds";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import {
  resolveRequiredCreateCharacterModeStartupModelId,
  resolveRequiredCreateStartupModelId,
} from "../../../lib/model-runtime/modelCatalog";

export type ModelModalFamilyKey =
  | "gpt-image"
  | "flux"
  | "kling"
  | "nano-banana"
  | "other"
  | "seedance"
  | "seedream"
  | "veo";

export type ModelModalFamilyMeta = {
  label: string;
  logo?: string;
};

export type ModelModalTooltipContext =
  | "character-image"
  | "reference-image"
  | "reference-video"
  | "reference-keyframes"
  | "text-image";

export type ModelModalPresentationMeta = {
  provider?: string;
  description?: string;
  logo?: string;
  tags?: string[];
  verified?: boolean;
};

const SECTION_LOGOS: Record<string, string> = {
  Flux: FLUX_LOGO_SRC,
  "Black Forest Labs": FLUX_LOGO_SRC,
  Google: GOOGLE_LOGO_SRC,
  "Google DeepMind": GOOGLE_LOGO_SRC,
  Kling: KLING_LOGO_SRC,
  "Kling AI": KLING_LOGO_SRC,
  ByteDance: SEEDREAM_LOGO_SRC,
  Seedream: SEEDREAM_LOGO_SRC,
};

export const MODEL_MODAL_FAMILY_META: Record<ModelModalFamilyKey, ModelModalFamilyMeta> = {
  "gpt-image": { label: "GPT Image" },
  flux: { label: "FLUX", logo: FLUX_LOGO_SRC },
  kling: { label: "Kling", logo: KLING_LOGO_SRC },
  "nano-banana": { label: "Nano Banana", logo: GOOGLE_LOGO_SRC },
  other: { label: "Other" },
  seedance: { label: "Seedance", logo: SEEDREAM_LOGO_SRC },
  seedream: { label: "Seedream", logo: SEEDREAM_LOGO_SRC },
  veo: { label: "Veo", logo: GOOGLE_LOGO_SRC },
};

export function resolveModelModalFallbackLogo(logoOrProvider?: string | null): string | undefined {
  if (!logoOrProvider) {
    return undefined;
  }
  return SECTION_LOGOS[logoOrProvider];
}

export function resolveModelModalFamilyKey(modelId: string): ModelModalFamilyKey {
  if (
    modelId === OPENAI_GPT_IMAGE_2_MODEL_ID ||
    modelId === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID ||
    modelId === KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID
  ) {
    return "gpt-image";
  }
  if (modelId.includes("seedream")) return "seedream";
  if (modelId.includes("nano-banana")) return "nano-banana";
  if (modelId.includes("flux")) return "flux";
  if (modelId.includes("veo")) return "veo";
  if (modelId.includes("kling")) return "kling";
  if (modelId.includes("seedance")) return "seedance";
  return "other";
}

const MODEL_MODAL_TEXT_IMAGE_STARTUP_MODEL_ID = resolveRequiredCreateStartupModelId();
const MODEL_MODAL_EDIT_IMAGE_STARTUP_MODEL_ID = resolveRequiredCreateCharacterModeStartupModelId();

export const MODEL_MODAL_PRESENTATION_META: Record<string, ModelModalPresentationMeta> = {
  [OPENAI_GPT_IMAGE_2_MODEL_ID]: {
    provider: "OpenAI",
    description: "GPT Image 2 supports high-quality image generation and standard edits.",
    tags: ["Image", "Text-to-Image", "Image-to-Image"],
    verified: true,
  },
  [KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID]: {
    provider: "Kie AI",
    description: "GPT Image 2 supports queued text-to-image generation at 1K, 2K, or 4K.",
    tags: ["Image", "Text-to-Image", "1K-4K", "Queued"],
    verified: true,
  },
  [KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID]: {
    provider: "Kie AI",
    description:
      "GPT Image 2 supports queued image-to-image editing with up to 16 reference images at 1K, 2K, or 4K.",
    tags: ["Image", "Image-to-Image", "1K-4K", "Queued"],
    verified: true,
  },
  [FAL_FLUX_2_KLEIN_9B_MODEL_ID]: {
    provider: "Black Forest Labs",
    description: "FLUX.2 Lite (9B) for fast text-to-image drafts across core aspect ratios.",
    logo: "Flux",
    tags: ["Image", "Text-to-Image", "9B", "Fast"],
    verified: true,
  },
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: {
    provider: "Kie AI",
    description:
      "Veo 3.1 Fast handles text-to-video, single-image animation, and first/last-frame transitions at 720p or 1080p.",
    tags: [
      "Video",
      "Text-to-Video",
      "Image-to-Video",
      "First/Last Frame",
      "5-8s",
      "720p/1080p",
      "Audio",
    ],
  },
  [KIE_KLING_30_MODEL_ID]: {
    provider: "Kie AI",
    description:
      "Kling 3.0 supports standard image-to-video and dedicated motion-control transfers.",
    tags: ["Video", "Image-to-Video", "Motion Control", "720p/1080p", "Audio"],
  },
  [KIE_SEEDANCE_2_MODEL_ID]: {
    provider: "Kie AI",
    description:
      "Seedance 2.0 supports prompt-only video, first-frame animation, first/last-frame transitions, and multimodal reference-to-video workflows.",
    tags: [
      "Video",
      "Text-to-Video",
      "Image-to-Video",
      "First/Last Frame",
      "Multimodal References",
      "5-10s",
      "720p/1080p",
      "Audio",
    ],
  },
  [KIE_SEEDANCE_2_FAST_MODEL_ID]: {
    provider: "Kie AI",
    description:
      "Seedance 2.0 Fast supports prompt-only video, first-frame animation, first/last-frame transitions, and faster multimodal reference-to-video workflows.",
    tags: [
      "Video",
      "Text-to-Video",
      "Image-to-Video",
      "First/Last Frame",
      "Multimodal References",
      "5-10s",
      "720p/1080p",
      "Fast",
      "Audio",
    ],
  },
  [MODEL_MODAL_TEXT_IMAGE_STARTUP_MODEL_ID]: {
    provider: "ByteDance",
    description:
      "Seedream 4.5 text-to-image supports native output plus automatic 2K and 4K upscale modes.",
    tags: ["Image", "Text-to-Image", "Native/2K/4K"],
    verified: true,
  },
  [FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID]: {
    provider: "ByteDance",
    description:
      "Seedream 5 Lite text-to-image supports faster generation with automatic 2K and 3K output modes.",
    tags: ["Image", "Text-to-Image", "Auto 2K/3K", "Fast"],
    verified: true,
  },
  [MODEL_MODAL_EDIT_IMAGE_STARTUP_MODEL_ID]: {
    provider: "ByteDance",
    description:
      "Seedream 4.5 Edit applies image-to-image changes with native output plus automatic 2K and 4K upscale modes.",
    tags: ["Image", "Image-to-Image", "Native/2K/4K"],
    verified: true,
  },
  [FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID]: {
    provider: "ByteDance",
    description:
      "Seedream 5 Lite Edit applies fast image-to-image edits with automatic 2K and 3K output modes.",
    tags: ["Image", "Image-to-Image", "Auto 2K/3K", "Fast"],
    verified: true,
  },
  [FAL_NANO_BANANA_PRO_MODEL_ID]: {
    provider: "Google",
    description: "Nano Banana Pro text-to-image adds selectable 1K, 2K, or 4K output.",
    tags: ["Image", "Text-to-Image", "1K-4K"],
  },
  [FAL_NANO_BANANA_PRO_EDIT_MODEL_ID]: {
    provider: "Google",
    description:
      "Nano Banana Pro Edit adds image-to-image editing with selectable 1K, 2K, or 4K output.",
    logo: "Google",
    tags: ["Image", "Image-to-Image", "1K-4K"],
  },
  [FAL_NANO_BANANA_2_MODEL_ID]: {
    provider: "Google",
    description:
      "Nano Banana 2 text-to-image supports faster generations with selectable 0.5K, 1K, 2K, or 4K output.",
    tags: ["Image", "Text-to-Image", "0.5K-4K", "Fast"],
  },
  [FAL_NANO_BANANA_2_EDIT_MODEL_ID]: {
    provider: "Google",
    description:
      "Nano Banana 2 Edit applies image-to-image edits with selectable 0.5K, 1K, 2K, or 4K output.",
    logo: "Google",
    tags: ["Image", "Image-to-Image", "0.5K-4K", "Fast"],
  },
};

const TOOLTIP_TAG_LIMIT = 5;

const TOOLTIP_TAG_PRIORITY: Record<string, number> = {
  Image: 1,
  Video: 1,
  "Text-to-Image": 2,
  "Image-to-Image": 2,
  "Text-to-Video": 2,
  "Image-to-Video": 2,
  "First/Last Frame": 2,
  "Motion Transfer": 2,
  "9B": 3,
  "1K-4K": 3,
  "0.5K-4K": 3,
  "Native/2K/4K": 3,
  "720p-4K": 3,
  "720p/1080p": 3,
  "480p-1080p": 3,
  "Multimodal References": 3,
  "2-12s": 4,
  "4-8s": 4,
  "4-12s": 4,
  "5-10s": 4,
  "High Fidelity": 5,
  Balanced: 5,
  Fast: 5,
  "Wide Aspects": 5,
  Audio: 6,
};

const CONTEXT_TOOLTIP_TAG_MAP: Record<ModelModalTooltipContext, string> = {
  "character-image": "Image-to-Image",
  "reference-image": "Image-to-Image",
  "reference-video": "Image-to-Video",
  "reference-keyframes": "First/Last Frame",
  "text-image": "Text-to-Image",
};

function isImageToImageModel(modelId: string) {
  return /\/edit(\b|\/|$)/i.test(modelId) || /image-to-image/i.test(modelId);
}

export function resolveModelModalContextTooltipTag(
  context?: ModelModalTooltipContext | null
): string | undefined {
  if (!context) {
    return undefined;
  }
  return CONTEXT_TOOLTIP_TAG_MAP[context];
}

export function resolveModelModalTooltipTags(modelId: string, contextTag?: string): string[] {
  const tagSet = new Set<string>(MODEL_MODAL_PRESENTATION_META[modelId]?.tags ?? []);
  if (contextTag) {
    tagSet.add(contextTag);
  } else if (isImageToImageModel(modelId)) {
    tagSet.add("Image-to-Image");
  }
  return Array.from(tagSet)
    .sort((a, b) => {
      const rankA = TOOLTIP_TAG_PRIORITY[a] ?? 99;
      const rankB = TOOLTIP_TAG_PRIORITY[b] ?? 99;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.localeCompare(b);
    })
    .slice(0, TOOLTIP_TAG_LIMIT);
}

export function resolveModelModalLogo(modelId: string): string | undefined {
  const explicitLogo = modelLogos[modelId];
  if (explicitLogo) {
    return explicitLogo;
  }
  const fallbackKey =
    MODEL_MODAL_PRESENTATION_META[modelId]?.logo ??
    MODEL_MODAL_PRESENTATION_META[modelId]?.provider;
  return resolveModelModalFallbackLogo(fallbackKey);
}
