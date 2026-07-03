/**
 * Configurable options and fixtures for AI Studio.
 * Centralizes mode/aspect/model lists so components stay lean and consistent.
 */
import { AspectOption, PromptTemplate, ToolId } from "./types";
import { getRequiredModelAllowedAspects } from "./logic/modelApiContracts";
import { isSeedance2UiEnabled } from "./logic/seedance2Availability";
import { FAL_NANO_BANANA_PRO_EDIT_MODEL_ID } from "../../lib/model-runtime/falModelIds";
import { KIE_KLING_30_MODEL_ID } from "../../lib/model-runtime/providerModelIds";
import { listPickerModelConfigs, type ModelConfig } from "../../lib/model-runtime/modelRegistry";

export type ModelMediaType = "image" | "video" | "image-to-video" | "edit" | "multi" | "keyframes";
export type ModelOption = { value: string; label: string; mediaType?: ModelMediaType };
export type ToolConfig = { id: ToolId; label: string; desc: string };
export const AI_STUDIO_TOOLBAR_LOGO_SRC = "/small good d.png";
export const FLUX_LOGO_SRC = "/flux-logo.png";
export const GOOGLE_LOGO_SRC = "/google-logo.png";
export const KLING_LOGO_SRC = "/kling-logo.png";
export const SEEDREAM_LOGO_SRC = "/seedream-logo.png";

const MODEL_LOGO_SRC_BY_KEY: Partial<Record<NonNullable<ModelConfig["logoKey"]>, string>> = {
  flux: FLUX_LOGO_SRC,
  google: GOOGLE_LOGO_SRC,
  kling: KLING_LOGO_SRC,
  seedream: SEEDREAM_LOGO_SRC,
};

const isCatalogModelVisible = (config: ModelConfig): boolean => {
  if (!config.visibilityFlag) return true;
  if (config.visibilityFlag === "NEXT_PUBLIC_KIE_SEEDANCE_2_ENABLED") {
    return isSeedance2UiEnabled();
  }
  return false;
};

const mapCatalogMediaTypeToModelOption = (
  mediaType: ModelConfig["mediaType"]
): ModelMediaType | undefined => {
  if (
    mediaType === "image" ||
    mediaType === "video" ||
    mediaType === "image-to-video" ||
    mediaType === "multi"
  ) {
    return mediaType;
  }
  return undefined;
};

// Map model ids to their logo assets used in selectors and chips.
export const modelLogos: Record<string, string> = Object.fromEntries(
  listPickerModelConfigs()
    .map((config) => {
      const logoSrc = config.logoKey ? MODEL_LOGO_SRC_BY_KEY[config.logoKey] : undefined;
      return logoSrc ? [config.id, logoSrc] : null;
    })
    .filter((entry): entry is [string, string] => entry !== null)
);

export const aspectOptions: AspectOption[] = [
  { value: "auto", ratioLabel: "Auto", name: "Auto", orientation: "square" },
  { value: "9:16", ratioLabel: "9:16", name: "Vertical", orientation: "vertical" },
  { value: "4:5", ratioLabel: "4:5", name: "Social Post", orientation: "vertical" },
  { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
  { value: "5:4", ratioLabel: "5:4", name: "Photo", orientation: "horizontal" },
  { value: "16:9", ratioLabel: "16:9", name: "Landscape", orientation: "widescreen" },
];

// AI Studio picker options are derived from the canonical model catalog's picker surface.
export const modelOptions: ModelOption[] = listPickerModelConfigs()
  .filter(isCatalogModelVisible)
  .map((config) => ({
    value: config.id,
    label: config.label.replace(/\s+Edit$/, ""),
    mediaType: mapCatalogMediaTypeToModelOption(config.mediaType),
  }));

export const falNanoBananaProAllowedAspects = new Set(
  getRequiredModelAllowedAspects(FAL_NANO_BANANA_PRO_EDIT_MODEL_ID)
);

// Kling image-to-video supports a limited aspect list.
export const klingAllowedAspects = new Set(getRequiredModelAllowedAspects(KIE_KLING_30_MODEL_ID));

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

export const workflowToolList: ToolConfig[] = [
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
  {
    id: "presets",
    label: "Presets",
    desc: "Browse the Pulse Catalog and Prompt Presets",
  },
  { id: "styles", label: "Styles", desc: "Browse reusable styles" },
];

export const shortcutsToolList: ToolConfig[] = [
  { id: "templates", label: "Templates", desc: "Browse AI templates" },
];

export const creationsToolList: ToolConfig[] = [
  { id: "community", label: "Community", desc: "Browse shared creations" },
];

export const createChildTools: ToolConfig[] = [];
