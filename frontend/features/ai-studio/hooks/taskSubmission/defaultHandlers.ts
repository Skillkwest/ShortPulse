/**
 * Default submission handlers (Seedream, Nano Banana, Kei fallback) for AI Studio.
 */
import { createKeiTask } from "../../../../lib/keiClient";
import {
  submitFalNanoBanana,
  submitFalNanoBananaPro,
  submitFalSeedream,
} from "../../../../lib/falClient";
import {
  isModelDefaultImageResolution,
  isSeedreamAutoImageSize,
  normalizeNanoBananaProResolution,
} from "../../logic/imageResolution";
import {
  normalizeAspectForFalNanoBanana,
  normalizeAspectForFalNanoBananaPro,
  normalizeAspectForKei,
  resolveSeedreamImageSize,
} from "../../logic/stateParsers";
import type { ImageSubmissionArgs } from "./types";

/**
 * Handles default/fallback submissions (Seedream, Nano Banana, and Kei).
 */
export const handleDefaultModelSubmission = async ({
  finalModel,
  cleanedPrompt,
  aspect,
  requestedResolution,
  preparedImageInputs,
  falReferencePayload,
  startPollingWithGeneration,
}: ImageSubmissionArgs): Promise<void> => {
  let taskId: string;
  let pollingProvider: "kei" | "fal-seedream" | "fal-nano-banana" | "fal-nano-banana-pro" = "kei";

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
    const result = await createKeiTask({
      model: finalModel,
      input: {
        prompt: cleanedPrompt,
        image_input: preparedImageInputs,
        aspect_ratio: normalizeAspectForKei(aspect),
        resolution: isModelDefaultImageResolution(requestedResolution) ? "1K" : requestedResolution,
        output_format: "png",
      },
    });
    taskId = result.taskId;
  }

  startPollingWithGeneration(taskId, pollingProvider);
};
