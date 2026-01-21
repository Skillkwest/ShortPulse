/**
 * Configurable options and fixtures for AI Studio.
 * Centralizes mode/aspect/model lists so components stay lean and consistent.
 */
import { AspectOption, PromptTemplate, ToolId } from "./types";

export type ModelOption = { value: string; label: string };
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
];

export const modelOptions: ModelOption[] = [
  { value: "pulse-vision", label: "Pulse Vision v2" },
  { value: "kinetic-video", label: "Kinetic v1" },
  { value: "aura-diffusion", label: "Aura Diffusion" },
  { value: "lumen-pro", label: "Lumen Pro" },
  { value: "vortex-hd", label: "Vortex HD" },
  { value: "studio-core", label: "Studio Core" },
  { value: "nebula-gen", label: "Nebula Gen" },
  { value: "flux-motion", label: "Flux Motion" },
  { value: "echo-style", label: "Echo Style" },
];

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

export const toolList: ToolConfig[] = [
  { id: "create", label: "Create", desc: "Prompt and output type" },
  { id: "edit-parent", label: "Pulse", desc: "Show edit tools" },
];

export const editChildTools: ToolConfig[] = [
  { id: "image-to-image", label: "Image to Image", desc: "Regenerate from a reference" },
  { id: "image-to-video", label: "Image to Video", desc: "Animate a still image" },
];
