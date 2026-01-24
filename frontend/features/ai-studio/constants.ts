/**
 * Configurable options and fixtures for AI Studio.
 * Centralizes mode/aspect/model lists so components stay lean and consistent.
 */
import { AspectOption, PromptTemplate, ToolId } from "./types";

export type ModelMediaType = "image" | "video" | "edit" | "multi";
export type ModelOption = { value: string; label: string; mediaType?: ModelMediaType };
export type ToolConfig = { id: ToolId; label: string; desc: string };

export const aspectOptions: AspectOption[] = [
  { value: "9:16", ratioLabel: "9:16", name: "Vertical", orientation: "vertical" },
  { value: "4:5", ratioLabel: "4:5", name: "Social Post", orientation: "vertical" },
  { value: "3:4", ratioLabel: "3:4", name: "Traditional", orientation: "vertical" },
  { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
  { value: "4:3", ratioLabel: "4:3", name: "Classic", orientation: "horizontal" },
  { value: "3:2", ratioLabel: "3:2", name: "Standard", orientation: "horizontal" },
  { value: "16:9", ratioLabel: "16:9", name: "Landscape", orientation: "widescreen" },
];

// When you add/remove image models here, update `docs/sop_image_generation.md` → “Supported image models”.
export const modelOptions: ModelOption[] = [
  { value: "fal/kling-video-v1.6", label: "Kling 1.6", mediaType: "video" },
  { value: "fal/kling-video-v1.6-text", label: "Kling 1.6 (Text)", mediaType: "video" },
  { value: "kling/v2-5-turbo-text-to-video-pro", label: "Kling 2.5 Turbo Pro", mediaType: "video" },
  { value: "kling-2.6/text-to-video", label: "Kling 2.6 Pro", mediaType: "video" },
  { value: "veo3", label: "Google Veo 3.1", mediaType: "video" },
  { value: "fal/flux-2-max", label: "FLUX.2 Max", mediaType: "image" },
  { value: "fal/flux-2-pro", label: "FLUX.2 Pro", mediaType: "image" },
  { value: "fal/flux-2", label: "FLUX.2", mediaType: "image" },
  { value: "fal/imagen4/preview/fast", label: "Imagen 4 Fast", mediaType: "image" },
  { value: "google/nano-banana", label: "Nano Banana", mediaType: "image" },
  { value: "nano-banana-pro", label: "Nano Banana Pro", mediaType: "image" },
  { value: "seedream/4.5-text-to-image", label: "Seedream 4.5", mediaType: "image" },
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
  "auto",
]);

// Kling image-to-video supports a limited aspect list.
export const klingAllowedAspects = new Set(["16:9", "9:16", "1:1"]);

export const imagenFastAllowedAspects = new Set(["1:1", "16:9", "9:16", "4:3", "3:4"]);

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
