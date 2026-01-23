/**
 * Configurable options and fixtures for AI Studio.
 * Centralizes mode/aspect/model lists so components stay lean and consistent.
 */
import { AspectOption, PromptTemplate, ToolId } from "./types";

export type ModelMediaType = "image" | "video" | "edit" | "multi";
export type ModelOption = { value: string; label: string; mediaType?: ModelMediaType };
export type ToolConfig = { id: ToolId; label: string; desc: string };

export const aspectOptions: AspectOption[] = [
  { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
  { value: "16:9", ratioLabel: "16:9", name: "Widescreen", orientation: "widescreen" },
  { value: "9:16", ratioLabel: "9:16", name: "Social story", orientation: "vertical" },
  { value: "2:3", ratioLabel: "2:3", name: "Portrait", orientation: "vertical" },
  { value: "3:4", ratioLabel: "3:4", name: "Traditional", orientation: "vertical" },
  { value: "1:2", ratioLabel: "1:2", name: "Vertical", orientation: "vertical" },
  { value: "2:1", ratioLabel: "2:1", name: "Horizontal", orientation: "horizontal" },
  { value: "4:5", ratioLabel: "4:5", name: "Social post", orientation: "vertical" },
  { value: "3:2", ratioLabel: "3:2", name: "Standard", orientation: "horizontal" },
  { value: "4:3", ratioLabel: "4:3", name: "Classic", orientation: "horizontal" },
  { value: "21:9", ratioLabel: "21:9", name: "Ultra-wide", orientation: "widescreen" },
];

export const modelOptions: ModelOption[] = [
  { value: "nano-banana-pro", label: "Nano Banana Pro (Image)", mediaType: "image" },
  { value: "veo-3", label: "Veo 3 (Video)", mediaType: "video" },
  { value: "flux-kontext", label: "Flux Kontext (Image editing)", mediaType: "edit" },
  { value: "kling-2.5-turbo", label: "Kling 2.5 Turbo (Video/Image-to-video)", mediaType: "video" },
  { value: "gpt-image-1", label: "4o Image (GPT Image 1)", mediaType: "image" },
  { value: "seedream/4.5-text-to-image", label: "Seedream 4.5 (Image)", mediaType: "image" },
  { value: "fal/flux-dev", label: "Fal Flux Dev (Image)", mediaType: "image" },
];

// Kie.ai expects one of these aspect ratios; anything else falls back to "auto" when sending requests.
export const keiAllowedAspects = new Set([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
  "auto",
]);

// GPT-4o Image only allows these sizes.
export const gptImageAllowedAspects = new Set(["1:1", "3:2", "2:3"]);

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
  "/brand-logo.png",
  "/placeholder-portrait.png",
  "/placeholder-portrait-2.png",
];

export const primaryToolList: ToolConfig[] = [
  { id: "create", label: "Create", desc: "Prompt and output type" },
  { id: "edit-parent", label: "Pulse", desc: "Show edit tools" },
];

export const lowerToolList: ToolConfig[] = [
  { id: "templates", label: "Templates", desc: "Browse AI templates" },
  { id: "workflows", label: "Workflows", desc: "Open workflow templates" },
];

export const creationsToolList: ToolConfig[] = [
  { id: "my-generations", label: "My Generations", desc: "See your outputs" },
  { id: "community", label: "Community", desc: "Browse shared creations" },
];

export const editChildTools: ToolConfig[] = [
  { id: "image-to-image", label: "Image", desc: "Regenerate from a reference" },
  { id: "image-to-video", label: "Video", desc: "Animate a still image" },
  { id: "enhance", label: "Enhance", desc: "Upscale and polish outputs" },
  { id: "character", label: "Character", desc: "Build character variants" },
];
