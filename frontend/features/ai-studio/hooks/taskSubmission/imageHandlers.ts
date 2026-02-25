/**
 * Image and edit submission handlers for AI Studio task generation.
 */
import {
  submitFalFlux2,
  submitFalFlux2Edit,
  submitFalFlux2Klein,
  submitFalFlux2Pro,
  submitFalFlux2ProEdit,
  submitFalNanoBananaEdit,
  submitFalNanoBananaProEdit,
  submitFalSeedreamEdit,
} from "../../../../lib/falClient";
import { falNanoBananaAllowedAspects, falNanoBananaProAllowedAspects } from "../../constants";
import { normalizeNanoBananaProResolution } from "../../logic/imageResolution";
import { falSizeForAspect } from "../../logic/pricing";
import { resolveSeedreamImageSize } from "../../logic/seedreamSizing";
import { resolveImageSubmissionSafetyPayload } from "./safetyPolicy";
import type { ImageSubmissionArgs } from "./types";

/**
 * Handles image/image-edit model submissions. Returns true when a matching model is handled.
 */
export const handleImageModelSubmission = async ({
  id,
  finalModel,
  cleanedPrompt,
  aspect,
  requestedResolution,
  preparedImageInputs,
  notifyGenerationFailure,
  startPollingWithGeneration,
  falReferencePayload,
}: ImageSubmissionArgs): Promise<boolean> => {
  if (finalModel === "fal-ai/nano-banana/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Nano Banana Edit requires at least one reference image.");
      return true;
    }
    const response = await submitFalNanoBananaEdit({
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: falNanoBananaAllowedAspects.has(aspect) ? aspect : "auto",
      output_format: "png",
      image_urls: preparedImageInputs.slice(0, 8),
    });
    startPollingWithGeneration(response.request_id, "fal-nano-banana-edit");
    return true;
  }

  if (finalModel === "fal-ai/nano-banana-pro/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Nano Banana Pro Edit requires at least one reference image.");
      return true;
    }
    const response = await submitFalNanoBananaProEdit({
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: falNanoBananaProAllowedAspects.has(aspect) ? aspect : "auto",
      output_format: "png",
      resolution: normalizeNanoBananaProResolution(requestedResolution, "1K"),
      image_urls: preparedImageInputs.slice(0, 8),
    });
    startPollingWithGeneration(response.request_id, "fal-nano-banana-pro-edit");
    return true;
  }

  if (finalModel === "fal-ai/bytedance/seedream/v4.5/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Seedream 4.5 Edit requires at least one reference image.");
      return true;
    }
    const image_size = resolveSeedreamImageSize(aspect, requestedResolution);
    const response = await submitFalSeedreamEdit({
      prompt: cleanedPrompt,
      image_size,
      num_images: 1,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      image_urls: preparedImageInputs.slice(0, 10),
    });
    startPollingWithGeneration(response.request_id, "fal-seedream");
    return true;
  }

  if (finalModel === "fal/flux-2") {
    const size = falSizeForAspect(aspect);
    const falResp = await submitFalFlux2({
      prompt: cleanedPrompt,
      image_size: { width: size.width, height: size.height },
      num_images: 1,
      output_format: "png",
      guidance_scale: 15,
      num_inference_steps: 41,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      ...falReferencePayload,
    });
    startPollingWithGeneration(falResp.request_id, "fal-flux2");
    return true;
  }

  if (finalModel === "fal-ai/flux-2/klein/9b") {
    const size = falSizeForAspect(aspect);
    const falResp = await submitFalFlux2Klein({
      prompt: cleanedPrompt,
      image_size: { width: size.width, height: size.height },
      num_images: 1,
      output_format: "jpeg",
      num_inference_steps: 4,
      ...resolveImageSubmissionSafetyPayload(finalModel),
    });
    startPollingWithGeneration(falResp.request_id, "fal-flux2-klein");
    return true;
  }

  if (finalModel === "fal/flux-2/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "FLUX.2 Edit requires at least one reference image.");
      return true;
    }
    const size = falSizeForAspect(aspect);
    const falResp = await submitFalFlux2Edit({
      prompt: cleanedPrompt,
      image_size: { width: size.width, height: size.height },
      num_images: 1,
      output_format: "png",
      guidance_scale: 2.5,
      num_inference_steps: 28,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      image_urls: preparedImageInputs.slice(0, 4),
    });
    startPollingWithGeneration(falResp.request_id, "fal-flux2-edit");
    return true;
  }

  if (finalModel === "fal/flux-2-pro/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "FLUX.2 Pro Edit requires at least one reference image.");
      return true;
    }
    const size = falSizeForAspect(aspect);
    const falResp = await submitFalFlux2ProEdit({
      prompt: cleanedPrompt,
      image_size: { width: size.width, height: size.height },
      num_images: 1,
      output_format: "png",
      guidance_scale: 2.5,
      num_inference_steps: 28,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      image_urls: preparedImageInputs.slice(0, 4),
    });
    startPollingWithGeneration(falResp.request_id, "fal-flux2-pro-edit");
    return true;
  }

  if (finalModel === "fal/flux-2-pro") {
    const size = falSizeForAspect(aspect);
    const falResp = await submitFalFlux2Pro({
      prompt: cleanedPrompt,
      image_size: { width: size.width, height: size.height },
      num_images: 1,
      output_format: "png",
      ...resolveImageSubmissionSafetyPayload(finalModel),
      ...falReferencePayload,
    });
    startPollingWithGeneration(falResp.request_id, "fal-flux2-pro");
    return true;
  }

  return false;
};
