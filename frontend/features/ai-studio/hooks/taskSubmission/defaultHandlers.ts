/**
 * Default submission handlers (Seedream + Nano Banana) for AI Studio.
 */
import {
  submitFalNanoBanana,
  submitFalNanoBananaPro,
  submitFalSeedream,
} from "../../../../lib/falClient";
import {
  isSeedreamAutoImageSize,
  normalizeNanoBananaProResolution,
} from "../../logic/imageResolution";
import {
  normalizeAspectForFalNanoBanana,
  normalizeAspectForFalNanoBananaPro,
  resolveSeedreamImageSize,
} from "../../logic/stateParsers";
import type { ImageSubmissionArgs } from "./types";

/**
 * Handles default/fallback Fal submissions (Seedream + Nano Banana variants).
 */
export const handleDefaultModelSubmission = async ({
  finalModel,
  cleanedPrompt,
  aspect,
  requestedResolution,
  falReferencePayload,
  startPollingWithGeneration,
}: ImageSubmissionArgs): Promise<void> => {
  let taskId: string;
  let pollingProvider: "fal-seedream" | "fal-nano-banana" | "fal-nano-banana-pro";

  if (finalModel === "fal-ai/bytedance/seedream/v4.5/text-to-image") {
    const image_size = isSeedreamAutoImageSize(requestedResolution)
      ? requestedResolution
      : resolveSeedreamImageSize(aspect);
    const response = await submitFalSeedream({
      prompt: cleanedPrompt,
      image_size,
      num_images: 1,
      enable_safety_checker: false,
      output_format: "png",
    });
    taskId = response.request_id;
    pollingProvider = "fal-seedream";
  } else if (finalModel === "fal-ai/nano-banana") {
    const response = await submitFalNanoBanana({
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: normalizeAspectForFalNanoBanana(aspect),
      output_format: "png",
      ...falReferencePayload,
    });
    taskId = response.request_id;
    pollingProvider = "fal-nano-banana";
  } else if (finalModel === "fal-ai/nano-banana-pro") {
    const response = await submitFalNanoBananaPro({
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: normalizeAspectForFalNanoBananaPro(aspect),
      output_format: "png",
      resolution: normalizeNanoBananaProResolution(requestedResolution, "1K"),
      ...falReferencePayload,
    });
    taskId = response.request_id;
    pollingProvider = "fal-nano-banana-pro";
  } else {
    throw new Error(`Unsupported model '${finalModel}' for default Fal submission handler.`);
  }

  startPollingWithGeneration(taskId, pollingProvider);
};
