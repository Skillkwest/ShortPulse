import React from "react";
import { ImageSquare, MagicWand, Sparkle, SquaresFour, VideoCamera } from "phosphor-react";

import { AspectOption, ModeIconMap, PromptTemplate, StudioMode, ToolId, ToolMeta } from "./types";

export const aspectOptions: AspectOption[] = [
  { label: "9:16 (Vertical)", value: "9:16" },
  { label: "4:5 (Portrait)", value: "4:5" },
  { label: "3:2 (Wide)", value: "3:2" },
  { label: "16:9 (Landscape)", value: "16:9" },
  { label: "1:1 (Square)", value: "1:1" },
];

export const modelOptions = [
  { value: "pulse-vision", label: "Pulse Vision v2" },
  { value: "kinetic-video", label: "Kinetic v1" },
  { value: "aura-diffusion", label: "Aura Diffusion" },
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

export const toolIcons: Record<ToolId, React.ComponentType<any>> = {
  create: Sparkle,
  edit: ImageSquare,
  "image-to-video": VideoCamera,
  organize: SquaresFour,
};

export const toolList: ToolMeta[] = [
  { id: "create", label: "Create", desc: "Prompt and output type" },
  { id: "edit", label: "Image to Image", desc: "Regenerate from a reference" },
  { id: "image-to-video", label: "Image to Video", desc: "Animate a still image" },
  { id: "organize", label: "Organize", desc: "Apply saved layouts" },
];

export const modeLabel = (value: StudioMode) => {
  switch (value) {
    case "video":
      return "Video";
    case "image":
      return "Image";
    default:
      return "Enhance";
  }
};

export const modeIconMap: ModeIconMap = {
  enhance: MagicWand,
  image: ImageSquare,
  video: VideoCamera,
};
