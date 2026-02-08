/**
 * Configurable options and fixtures for AI Studio.
 * Centralizes mode/aspect/model lists so components stay lean and consistent.
 */
import { AspectOption, PromptTemplate, ToolId } from "./types";

export type ModelMediaType = "image" | "video" | "image-to-video" | "edit" | "multi" | "keyframes";
export type ModelOption = { value: string; label: string; mediaType?: ModelMediaType };
export type ToolConfig = { id: ToolId; label: string; desc: string };

// Map model ids to their logo assets used in selectors and chips.
export const modelLogos: Record<string, string> = {
  "fal-ai/flux-2/klein/9b": "/flux%20LOGO.png",
  "fal/flux-2": "/flux%20LOGO.png",
  "fal/flux-2/edit": "/flux%20LOGO.png",
  "fal/flux-2-pro": "/flux%20LOGO.png",
  "fal/flux-2-pro/edit": "/flux%20LOGO.png",
  "fal-ai/nano-banana": "/Google%20LOGO.png",
  "fal-ai/nano-banana/edit": "/Google%20LOGO.png",
  "fal-ai/nano-banana-pro": "/Google%20LOGO.png",
  "fal-ai/nano-banana-pro/edit": "/Google%20LOGO.png",
  "fal-ai/bytedance/seedream/v4.5/text-to-image": "/Seedream%20LOGO.png",
  "fal-ai/bytedance/seedream/v4.5/edit": "/Seedream%20LOGO.png",
  "fal-ai/kling-video/v3/pro/text-to-video": "/Kling%20LOGO.png",
  "fal-ai/kling-video/v3/pro/image-to-video": "/Kling%20LOGO.png",
  "fal-ai/kling-video/v2.6/pro/motion-control": "/Kling%20LOGO.png",
  "fal-ai/veo3.1/first-last-frame-to-video": "/Google%20LOGO.png",
  "fal-ai/veo3.1/image-to-video": "/Google%20LOGO.png",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": "/Seedream%20LOGO.png",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": "/Seedream%20LOGO.png",
  "fal-ai/veo3.1": "/Google%20LOGO.png",
  "fal-ai/sora-2/text-to-video/pro": "/Sora%202%20LOGO.png",
};

export const aspectOptions: AspectOption[] = [
  { value: "9:16", ratioLabel: "9:16", name: "Vertical", orientation: "vertical" },
  { value: "4:5", ratioLabel: "4:5", name: "Social Post", orientation: "vertical" },
  { value: "3:4", ratioLabel: "3:4", name: "Traditional", orientation: "vertical" },
  { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
  { value: "4:3", ratioLabel: "4:3", name: "Classic", orientation: "horizontal" },
  { value: "3:2", ratioLabel: "3:2", name: "Standard", orientation: "horizontal" },
  { value: "16:9", ratioLabel: "16:9", name: "Landscape", orientation: "widescreen" },
];

// When you add/remove image models here, update `docs/sop_image_generation.md` → "Supported image models".
export const modelOptions: ModelOption[] = [
  { value: "fal-ai/kling-video/v3/pro/text-to-video", label: "Kling 3.0 (Text to Video)", mediaType: "video" },
  { value: "fal-ai/kling-video/v3/pro/image-to-video", label: "Kling 3.0 (Start/End Frame)", mediaType: "image-to-video" },
  { value: "fal-ai/kling-video/v2.6/pro/motion-control", label: "Kling 2.6 Motion Control", mediaType: "image-to-video" },
  { value: "fal-ai/veo3.1/first-last-frame-to-video", label: "Veo 3.1 (First/Last Frame)", mediaType: "keyframes" },
  { value: "fal-ai/veo3.1/image-to-video", label: "Veo 3.1 (Image to Video)", mediaType: "image-to-video" },
  {
    value: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    label: "Seedance 1.5 Pro (Image to Video)",
    mediaType: "image-to-video",
  },
  { value: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video", label: "Seedance 1.5 Pro", mediaType: "video" },
  { value: "fal-ai/veo3.1", label: "Google Veo 3.1", mediaType: "video" },
  { value: "fal-ai/sora-2/text-to-video/pro", label: "Sora 2 Pro", mediaType: "video" },
  { value: "fal/flux-2-pro/edit", label: "FLUX.2 Pro Edit", mediaType: "image" },
  { value: "fal/flux-2/edit", label: "FLUX.2 Edit", mediaType: "image" },
  { value: "fal/flux-2-pro", label: "FLUX.2 Pro", mediaType: "image" },
  { value: "fal/flux-2", label: "FLUX.2", mediaType: "image" },
  { value: "fal-ai/flux-2/klein/9b", label: "FLUX.2 Lite", mediaType: "image" },
  { value: "fal-ai/nano-banana", label: "Nano Banana", mediaType: "image" },
  { value: "fal-ai/nano-banana/edit", label: "Nano Banana Edit", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro", label: "Nano Banana Pro", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro/edit", label: "Nano Banana Pro Edit", mediaType: "image" },
  { value: "fal-ai/bytedance/seedream/v4.5/edit", label: "Seedream 4.5 Edit", mediaType: "image" },
  { value: "fal-ai/bytedance/seedream/v4.5/text-to-image", label: "Seedream 4.5", mediaType: "image" },
];

export const falNanoBananaAllowedAspects = new Set([
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
  "auto",
]);

export const falNanoBananaProAllowedAspects = new Set([
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
  "auto",
]);

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
  { id: "create", label: "Create", desc: "Show create tools" },
];

export const editToolList: ToolConfig[] = [
  { id: "edit", label: "Edit", desc: "Edit and refine content" },
  { id: "canvas", label: "Canvas", desc: "Build automation workflows" },
];

export const lowerToolList: ToolConfig[] = [
  { id: "templates", label: "Templates", desc: "Browse AI templates" },
  { id: "workflows", label: "Workflows", desc: "Open workflow templates" },
];

export const creationsToolList: ToolConfig[] = [
  { id: "my-generations", label: "My Generations", desc: "See your outputs" },
  { id: "community", label: "Community", desc: "Browse shared creations" },
];

export const createChildTools: ToolConfig[] = [
  { id: "text", label: "Text", desc: "Create from text prompts" },
  { id: "image", label: "Image", desc: "Generate from a reference" },
  { id: "video", label: "Video", desc: "Animate a still image" },
  { id: "character", label: "Character", desc: "Build character variants" },
];
