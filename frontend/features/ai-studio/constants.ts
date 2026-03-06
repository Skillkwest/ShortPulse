/**
 * Configurable options and fixtures for AI Studio.
 * Centralizes mode/aspect/model lists so components stay lean and consistent.
 */
import { AspectOption, PromptTemplate, ToolId } from "./types";
import { getModelAllowedAspects } from "./logic/modelApiContracts";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../lib/model-runtime/providerModelIds";

export type ModelMediaType = "image" | "video" | "image-to-video" | "edit" | "multi" | "keyframes";
export type ModelOption = { value: string; label: string; mediaType?: ModelMediaType };
export type ToolConfig = { id: ToolId; label: string; desc: string };
export const AI_STUDIO_TOOLBAR_LOGO_SRC = "/ai-studio-toolbar-logo.png";
export const FLUX_LOGO_SRC = "/flux-logo.png";
export const GOOGLE_LOGO_SRC = "/google-logo.png";
export const KLING_LOGO_SRC = "/kling-logo.png";
export const SEEDREAM_LOGO_SRC = "/seedream-logo.png";
export const SORA2_LOGO_SRC = "/sora-2-logo.png";

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
  "fal-ai/kling-video/v3/pro/text-to-video": KLING_LOGO_SRC,
  "fal-ai/kling-video/v3/pro/image-to-video": KLING_LOGO_SRC,
  "fal-ai/veo3.1/first-last-frame-to-video": GOOGLE_LOGO_SRC,
  "fal-ai/veo3.1/image-to-video": GOOGLE_LOGO_SRC,
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": SEEDREAM_LOGO_SRC,
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": SEEDREAM_LOGO_SRC,
  "fal-ai/veo3.1": GOOGLE_LOGO_SRC,
  "fal-ai/sora-2/text-to-video/pro": SORA2_LOGO_SRC,
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: GOOGLE_LOGO_SRC,
  [KIE_KLING_30_MODEL_ID]: KLING_LOGO_SRC,
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
    value: "fal-ai/kling-video/v3/pro/text-to-video",
    label: "Kling 3.0",
    mediaType: "video",
  },
  {
    value: "fal-ai/kling-video/v3/pro/image-to-video",
    label: "Kling 3.0",
    mediaType: "image-to-video",
  },
  {
    value: "fal-ai/veo3.1/first-last-frame-to-video",
    label: "Veo 3.1",
    mediaType: "keyframes",
  },
  {
    value: "fal-ai/veo3.1/image-to-video",
    label: "Veo 3.1",
    mediaType: "image-to-video",
  },
  {
    value: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    label: "Seedance 1.5 Pro",
    mediaType: "image-to-video",
  },
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
    value: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    label: "Seedance 1.5 Pro",
    mediaType: "video",
  },
  { value: "fal-ai/veo3.1", label: "Google Veo 3.1", mediaType: "video" },
  { value: "fal-ai/sora-2/text-to-video/pro", label: "Sora 2 Pro", mediaType: "video" },
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
  getModelAllowedAspects("fal-ai/kling-video/v3/pro/text-to-video", ["16:9", "9:16", "1:1"])
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
  { id: "canvas", label: "Canvas", desc: "Canvas workspace (coming soon)" },
];

export const lowerToolList: ToolConfig[] = [
  { id: "character", label: "Characters", desc: "Create and manage character references" },
  { id: "presets", label: "Presets", desc: "Browse reusable presets" },
  { id: "styles", label: "Styles", desc: "Browse reusable styles" },
  { id: "templates", label: "Templates", desc: "Browse AI templates" },
];

export const creationsToolList: ToolConfig[] = [
  { id: "my-generations", label: "My Generations", desc: "See your outputs" },
  { id: "community", label: "Community", desc: "Browse shared creations" },
];

export const createChildTools: ToolConfig[] = [];
