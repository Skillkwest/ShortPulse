/**
 * Configurable options and fixtures for AI Studio.
 * Centralizes mode/aspect/model lists so components stay lean and consistent.
 */
import { AspectOption, PromptTemplate, ToolId } from "./types";
import { getModelAllowedAspects } from "./logic/modelApiContracts";
import { isSeedance2UiEnabled } from "./logic/seedance2Availability";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../lib/model-runtime/providerModelIds";

export type ModelMediaType = "image" | "video" | "image-to-video" | "edit" | "multi" | "keyframes";
export type ModelOption = { value: string; label: string; mediaType?: ModelMediaType };
export type ToolConfig = { id: ToolId; label: string; desc: string };
export const AI_STUDIO_TOOLBAR_LOGO_SRC = "/small good d.png";
export const FLUX_LOGO_SRC = "/flux-logo.png";
export const GOOGLE_LOGO_SRC = "/google-logo.png";
export const KLING_LOGO_SRC = "/kling-logo.png";
export const SEEDREAM_LOGO_SRC = "/seedream-logo.png";

// Map model ids to their logo assets used in selectors and chips.
export const modelLogos: Record<string, string> = {
  "fal-ai/flux-2/klein/9b": FLUX_LOGO_SRC,
  "fal/flux-2": FLUX_LOGO_SRC,
  "fal/flux-2/edit": FLUX_LOGO_SRC,
  "fal/flux-2-pro": FLUX_LOGO_SRC,
  "fal/flux-2-pro/edit": FLUX_LOGO_SRC,
  "fal-ai/nano-banana": GOOGLE_LOGO_SRC,
  "fal-ai/nano-banana/edit": GOOGLE_LOGO_SRC,
  "fal-ai/nano-banana-2": GOOGLE_LOGO_SRC,
  "fal-ai/nano-banana-2/edit": GOOGLE_LOGO_SRC,
  "fal-ai/nano-banana-pro": GOOGLE_LOGO_SRC,
  "fal-ai/nano-banana-pro/edit": GOOGLE_LOGO_SRC,
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": SEEDREAM_LOGO_SRC,
  "fal-ai/bytedance/seedream/v5/lite/edit": SEEDREAM_LOGO_SRC,
  "fal-ai/bytedance/seedream/v4.5/text-to-image": SEEDREAM_LOGO_SRC,
  "fal-ai/bytedance/seedream/v4.5/edit": SEEDREAM_LOGO_SRC,
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: GOOGLE_LOGO_SRC,
  [KIE_KLING_30_MODEL_ID]: KLING_LOGO_SRC,
  [KIE_SEEDANCE_15_PRO_MODEL_ID]: SEEDREAM_LOGO_SRC,
  [KIE_SEEDANCE_2_MODEL_ID]: SEEDREAM_LOGO_SRC,
  [KIE_SEEDANCE_2_FAST_MODEL_ID]: SEEDREAM_LOGO_SRC,
};

export const aspectOptions: AspectOption[] = [
  { value: "auto", ratioLabel: "Auto", name: "Auto", orientation: "square" },
  { value: "9:16", ratioLabel: "9:16", name: "Vertical", orientation: "vertical" },
  { value: "4:5", ratioLabel: "4:5", name: "Social Post", orientation: "vertical" },
  { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
  { value: "5:4", ratioLabel: "5:4", name: "Photo", orientation: "horizontal" },
  { value: "16:9", ratioLabel: "16:9", name: "Landscape", orientation: "widescreen" },
];

// When you add/remove image models here, update `docs/sops/sop_image_generation.md` → "Supported image models".
export const modelOptions: ModelOption[] = [
  {
    value: KIE_VEO_31_FAST_I2V_MODEL_ID,
    label: "Veo 3.1 Fast I2V (Kie)",
    mediaType: "image-to-video",
  },
  {
    value: KIE_KLING_30_MODEL_ID,
    label: "Kling 3.0 (Kie)",
    mediaType: "image-to-video",
  },
  {
    value: KIE_SEEDANCE_15_PRO_MODEL_ID,
    label: "Seedance 1.5 Pro (Kie)",
    mediaType: "image-to-video",
  },
  ...(isSeedance2UiEnabled()
    ? ([
        {
          value: KIE_SEEDANCE_2_MODEL_ID,
          label: "Seedance 2.0 (Kie)",
          mediaType: "image-to-video",
        },
        {
          value: KIE_SEEDANCE_2_FAST_MODEL_ID,
          label: "Seedance 2.0 Fast (Kie)",
          mediaType: "image-to-video",
        },
      ] satisfies ModelOption[])
    : []),
  { value: "fal/flux-2-pro/edit", label: "FLUX.2 Pro", mediaType: "image" },
  { value: "fal/flux-2/edit", label: "FLUX.2", mediaType: "image" },
  { value: "fal/flux-2-pro", label: "FLUX.2 Pro", mediaType: "image" },
  { value: "fal/flux-2", label: "FLUX.2", mediaType: "image" },
  { value: "fal-ai/flux-2/klein/9b", label: "FLUX.2 Lite", mediaType: "image" },
  { value: "fal-ai/nano-banana", label: "Nano Banana", mediaType: "image" },
  { value: "fal-ai/nano-banana/edit", label: "Nano Banana", mediaType: "image" },
  { value: "fal-ai/nano-banana-2", label: "Nano Banana 2", mediaType: "image" },
  { value: "fal-ai/nano-banana-2/edit", label: "Nano Banana 2", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro", label: "Nano Banana Pro", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro/edit", label: "Nano Banana Pro", mediaType: "image" },
  {
    value: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    label: "Seedream 5 Lite",
    mediaType: "image",
  },
  {
    value: "fal-ai/bytedance/seedream/v5/lite/edit",
    label: "Seedream 5 Lite",
    mediaType: "image",
  },
  { value: "fal-ai/bytedance/seedream/v4.5/edit", label: "Seedream 4.5", mediaType: "image" },
  {
    value: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    label: "Seedream 4.5",
    mediaType: "image",
  },
];

export const falNanoBananaAllowedAspects = new Set(
  getModelAllowedAspects("fal-ai/nano-banana", [
    "16:9",
    "3:2",
    "4:3",
    "5:4",
    "1:1",
    "4:5",
    "3:4",
    "2:3",
    "9:16",
  ])
);

export const falNanoBananaProAllowedAspects = new Set(
  getModelAllowedAspects("fal-ai/nano-banana-pro/edit", [
    "auto",
    "16:9",
    "3:2",
    "4:3",
    "5:4",
    "1:1",
    "4:5",
    "3:4",
    "2:3",
    "9:16",
  ])
);

// Kling image-to-video supports a limited aspect list.
export const klingAllowedAspects = new Set(
  getModelAllowedAspects(KIE_KLING_30_MODEL_ID, ["16:9", "9:16", "1:1"])
);

// Map our aspect strings to Fal image_size enum values.
export const falImageSizeMap: Record<string, string> = {
  "1:1": "square",
  "3:4": "portrait_4_3",
  "4:3": "landscape_4_3",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
};

export const promptTemplates: PromptTemplate[] = [
  {
    id: "product-demo",
    label: "Product demo",
    text: "Close-up vertical shot of the product in use with soft window light and a clean backdrop.",
  },
  {
    id: "tutorial",
    label: "Tutorial beat",
    text: "Step-by-step short tutorial showing setup, middle action, and a clear call to action on-screen.",
  },
  {
    id: "mood",
    label: "Moodboard",
    text: "Cinematic stills with shallow depth of field, teal accents, and tactile close-ups.",
  },
  {
    id: "promo",
    label: "Promo CTA",
    text: "Hero shot centered, dark backdrop, crisp text overlay for a quick promo message.",
  },
];

export const previewPlaceholders = [
  "/dashboard/ai-studio-hero.png",
  "/dashboard/welcome-art.png",
  AI_STUDIO_TOOLBAR_LOGO_SRC,
  "/placeholder-portrait.png",
  "/placeholder-portrait-2.png",
];

export const primaryToolList: ToolConfig[] = [
  { id: "create", label: "Create", desc: "Show create tools" },
];

export const editToolList: ToolConfig[] = [
  { id: "edit", label: "Edit", desc: "Edit and refine content" },
  { id: "video", label: "Video", desc: "Generate video content" },
  { id: "sound", label: "Sound", desc: "Open sound properties" },
];

export const soundChildTools: ToolConfig[] = [
  { id: "voices", label: "Voice", desc: "Create and manage voices" },
  { id: "music", label: "Music", desc: "Generate music beds and songs" },
  { id: "sound-effects", label: "SFX", desc: "Generate effects and accents" },
];

export const librariesToolList: ToolConfig[] = [
  { id: "media-library", label: "Media", desc: "Browse library media and prompts" },
  { id: "character", label: "Characters", desc: "Create and manage character references" },
  { id: "elements", label: "Elements", desc: "Create and manage reusable scene elements" },
  { id: "pulse-presets", label: "Pulse Presets", desc: "Browse reusable Pulse presets" },
  { id: "presets", label: "Prompt Presets", desc: "Browse reusable presets" },
  { id: "styles", label: "Styles", desc: "Browse reusable styles" },
];

export const shortcutsToolList: ToolConfig[] = [
  { id: "templates", label: "Templates", desc: "Browse AI templates" },
];

export const creationsToolList: ToolConfig[] = [
  { id: "my-generations", label: "My Generations", desc: "See your outputs" },
  { id: "community", label: "Community", desc: "Browse shared creations" },
];

export const createChildTools: ToolConfig[] = [];
