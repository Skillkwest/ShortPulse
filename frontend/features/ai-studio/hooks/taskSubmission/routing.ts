/**
 * Routing utilities for AI Studio task submission handlers.
 */
import type { SubmissionHandlerRoute } from "./types";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";

const VIDEO_MODELS = new Set([
  "fal-ai/kling-video/v3/pro/image-to-video",
  "fal-ai/veo3.1/image-to-video",
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
  "fal-ai/veo3.1/first-last-frame-to-video",
  "fal-ai/sora-2/text-to-video/pro",
  "fal-ai/veo3.1",
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
]);

const IMAGE_MODELS = new Set([
  "fal-ai/bria/background/remove",
  "fal-ai/nano-banana/edit",
  "fal-ai/nano-banana-2/edit",
  "fal-ai/nano-banana-pro/edit",
  "fal-ai/bytedance/seedream/v4.5/edit",
  "fal-ai/bytedance/seedream/v5/lite/edit",
  "fal/flux-2",
  "fal-ai/flux-2/klein/9b",
  "fal/flux-2/edit",
  "fal/flux-2-pro/edit",
  "fal/flux-2-pro",
  "fal-ai/flux-pro/v1/fill",
]);

/**
 * Resolves which submission handler family should process a model.
 */
export const resolveSubmissionHandlerRoute = (modelId: string): SubmissionHandlerRoute => {
  if (VIDEO_MODELS.has(modelId)) return "video";
  if (IMAGE_MODELS.has(modelId)) return "image";
  return "default";
};
