/**
 * Image and edit submission handlers for AI Studio task generation.
 */
import {
  type FalSubmitResponse,
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

const handoffSubmitResponse = ({
  response,
  pollingProvider,
  startPollingWithGeneration,
}: {
  response: FalSubmitResponse;
  pollingProvider:
    | "fal-seedream"
    | "fal-nano-banana-edit"
    | "fal-nano-banana-pro-edit"
    | "fal-flux2"
    | "fal-flux2-klein"
    | "fal-flux2-edit"
    | "fal-flux2-pro"
    | "fal-flux2-pro-edit";
  startPollingWithGeneration: ImageSubmissionArgs["startPollingWithGeneration"];
}) => {
  if ("status" in response && response.status === "queued") {
    startPollingWithGeneration(undefined, pollingProvider, undefined, response);
    return;
  }
  const requestId =
    "request_id" in response && typeof response.request_id === "string"
      ? response.request_id
      : undefined;
  startPollingWithGeneration(requestId, pollingProvider);
};

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
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-nano-banana-edit",
      startPollingWithGeneration,
    });
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
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-nano-banana-pro-edit",
      startPollingWithGeneration,
    });
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
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-seedream",
      startPollingWithGeneration,
    });
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
    handoffSubmitResponse({
      response: falResp,
      pollingProvider: "fal-flux2",
      startPollingWithGeneration,
    });
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
    handoffSubmitResponse({
      response: falResp,
      pollingProvider: "fal-flux2-klein",
      startPollingWithGeneration,
    });
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
    handoffSubmitResponse({
      response: falResp,
      pollingProvider: "fal-flux2-edit",
      startPollingWithGeneration,
    });
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
    handoffSubmitResponse({
      response: falResp,
      pollingProvider: "fal-flux2-pro-edit",
      startPollingWithGeneration,
    });
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
    handoffSubmitResponse({
      response: falResp,
      pollingProvider: "fal-flux2-pro",
      startPollingWithGeneration,
    });
    return true;
  }

  return false;
};
