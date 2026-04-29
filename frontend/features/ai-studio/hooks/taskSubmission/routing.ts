/**
 * Routing utilities for AI Studio task submission handlers.
 */
import type { SubmissionHandlerRoute } from "./types";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";

const VIDEO_MODELS = new Set([
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
]);

const IMAGE_MODELS = new Set([
  "fal-ai/bria/background/remove",
  "fal-ai/nano-banana/edit",
  "fal-ai/nano-banana-2/edit",
  "fal-ai/nano-banana-pro/edit",
  "fal-ai/bytedance/seedream/v4.5/edit",
  "fal-ai/bytedance/seedream/v5/lite/edit",
  "fal-ai/flux-2/klein/9b",
  "fal-ai/flux-pro/v1/fill",
  "fal-ai/flux-kontext-lora/inpaint",
]);

/**
 * Resolves which submission handler family should process a model.
 */
export const resolveSubmissionHandlerRoute = (modelId: string): SubmissionHandlerRoute => {
  if (VIDEO_MODELS.has(modelId)) return "video";
  if (IMAGE_MODELS.has(modelId)) return "image";
  return "default";
};
