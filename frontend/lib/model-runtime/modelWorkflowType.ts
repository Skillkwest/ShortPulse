import type { ModelConfig } from "./modelRegistry";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "./providerModelIds";

export type AdminModelWorkflowType =
  | "Text to image"
  | "Text + image edit"
  | "Image to image"
  | "Text to video"
  | "Image to video"
  | "Video to video"
  | "Text"
  | "Multi";

const IMAGE_TO_IMAGE_MODEL_IDS = new Set<string>([
  "fal-ai/bria/background/remove",
  "fal-ai/flux-kontext-lora/inpaint",
  "fal-ai/flux-pro/v1/fill",
]);

const TEXT_TO_VIDEO_MODEL_IDS = new Set<string>([
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
]);

const IMAGE_TO_VIDEO_MODEL_IDS = new Set<string>([KIE_KLING_30_MODEL_ID]);

export const getAdminModelWorkflowType = (
  model: Pick<ModelConfig, "id" | "mediaType" | "supportsTextToImage" | "supportsImageToImage">
): AdminModelWorkflowType => {
  if (model.supportsTextToImage && model.supportsImageToImage) {
    return "Text + image edit";
  }

  if (IMAGE_TO_IMAGE_MODEL_IDS.has(model.id) || model.supportsImageToImage) {
    return "Image to image";
  }

  if (TEXT_TO_VIDEO_MODEL_IDS.has(model.id)) {
    return "Text to video";
  }

  if (IMAGE_TO_VIDEO_MODEL_IDS.has(model.id)) {
    return "Image to video";
  }

  if (model.supportsTextToImage) {
    return "Text to image";
  }

  switch (model.mediaType) {
    case "image":
      return "Text to image";
    case "video":
      return "Text to video";
    case "image-to-video":
      return "Image to video";
    case "text":
      return "Text";
    case "multi":
      return "Multi";
    default:
      return "Text";
  }
};
