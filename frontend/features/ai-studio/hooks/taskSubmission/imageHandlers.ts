/**
 * Image and edit submission handlers for AI Studio task generation.
 */
import { type FalSubmitResponse, submitQueuedGenerationByModelId } from "../../../../lib/falClient";
import { falNanoBananaProAllowedAspects } from "../../constants";
import {
  normalizeNanoBanana2Resolution,
  normalizeNanoBananaProResolution,
} from "../../logic/imageResolution";
import { falSizeForAspect } from "../../logic/pricing";
import { resolveSeedreamImageSize } from "../../logic/seedreamSizing";
import { normalizeAspectForFalNanoBanana2 } from "../../logic/stateParsers";
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
    | "fal-seedream-edit"
    | "fal-seedream-v5-lite-edit"
    | "fal-nano-banana-2-edit"
    | "fal-nano-banana-pro-edit"
    | "fal-flux2-klein"
    | "fal-flux-pro-fill"
    | "fal-flux-kontext-inpaint"
    | "fal-bria-background-remove";
  startPollingWithGeneration: ImageSubmissionArgs["startPollingWithGeneration"];
}) => {
  const requestId = typeof response.request_id === "string" ? response.request_id : undefined;
  startPollingWithGeneration(requestId, pollingProvider, undefined, response);
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
  generationReplay,
  characterContext,
  styleContext,
  shortpulseContext,
  startPollingWithGeneration,
  inpaintOverride,
}: ImageSubmissionArgs): Promise<boolean> => {
  const shortpulseSubmitPayload = {
    ...(generationReplay ? { generation_replay: generationReplay } : {}),
    ...(characterContext ? { character_context: characterContext } : {}),
    ...(styleContext ? { style_context: styleContext } : {}),
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };

  if (finalModel === "fal-ai/bria/background/remove") {
    const sourceImageUrl = preparedImageInputs[0]?.trim();
    if (!sourceImageUrl) {
      notifyGenerationFailure(id, "Background remove requires a source image.");
      return true;
    }
    const response = await submitQueuedGenerationByModelId(finalModel, {
      image_url: sourceImageUrl,
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-bria-background-remove",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/flux-pro/v1/fill") {
    const preparedBaseImage = inpaintOverride?.baseImageInput?.trim();
    const preparedMaskImage = inpaintOverride?.maskInput?.trim();
    if (!preparedBaseImage || !preparedMaskImage) {
      notifyGenerationFailure(id, "FLUX Fill requires both a base image and mask.");
      return true;
    }
    const response = await submitQueuedGenerationByModelId(finalModel, {
      prompt: cleanedPrompt,
      image_url: preparedBaseImage,
      mask_url: preparedMaskImage,
      num_images: 1,
      output_format: inpaintOverride?.outputFormat ?? "png",
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-flux-pro-fill",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/flux-kontext-lora/inpaint") {
    const preparedBaseImage = inpaintOverride?.baseImageInput?.trim();
    const preparedMaskImage = inpaintOverride?.maskInput?.trim();
    const preparedReferenceImage = inpaintOverride?.referenceImageInput?.trim();
    if (!preparedBaseImage || !preparedMaskImage || !preparedReferenceImage) {
      notifyGenerationFailure(
        id,
        "Reference inpaint requires a base image, mask, and one secondary reference image."
      );
      return true;
    }
    const response = await submitQueuedGenerationByModelId(finalModel, {
      prompt: cleanedPrompt,
      image_url: preparedBaseImage,
      mask_url: preparedMaskImage,
      reference_image_url: preparedReferenceImage,
      num_images: 1,
      output_format: inpaintOverride?.outputFormat ?? "png",
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-flux-kontext-inpaint",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/nano-banana-pro/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Nano Banana Pro Edit requires at least one reference image.");
      return true;
    }
    const response = await submitQueuedGenerationByModelId(finalModel, {
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: falNanoBananaProAllowedAspects.has(aspect) ? aspect : "auto",
      output_format: "png",
      resolution: normalizeNanoBananaProResolution(requestedResolution, "1K"),
      image_urls: preparedImageInputs.slice(0, 8),
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-nano-banana-pro-edit",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/nano-banana-2/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Nano Banana 2 Edit requires at least one reference image.");
      return true;
    }
    const response = await submitQueuedGenerationByModelId(finalModel, {
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: normalizeAspectForFalNanoBanana2(aspect),
      output_format: "png",
      resolution: normalizeNanoBanana2Resolution(requestedResolution, "1K"),
      image_urls: preparedImageInputs.slice(0, 8),
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-nano-banana-2-edit",
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
    const response = await submitQueuedGenerationByModelId(finalModel, {
      prompt: cleanedPrompt,
      image_size,
      num_images: 1,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      image_urls: preparedImageInputs.slice(0, 10),
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-seedream-edit",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/bytedance/seedream/v5/lite/edit") {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Seedream 5 Lite Edit requires at least one reference image.");
      return true;
    }
    const image_size = resolveSeedreamImageSize(aspect, requestedResolution);
    const response = await submitQueuedGenerationByModelId(finalModel, {
      prompt: cleanedPrompt,
      image_size,
      num_images: 1,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      image_urls: preparedImageInputs.slice(0, 10),
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-seedream-v5-lite-edit",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/flux-2/klein/9b") {
    const size = falSizeForAspect(aspect);
    const falResp = await submitQueuedGenerationByModelId(finalModel, {
      prompt: cleanedPrompt,
      image_size: { width: size.width, height: size.height },
      num_images: 1,
      output_format: "jpeg",
      num_inference_steps: 4,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      ...shortpulseSubmitPayload,
    });
    handoffSubmitResponse({
      response: falResp,
      pollingProvider: "fal-flux2-klein",
      startPollingWithGeneration,
    });
    return true;
  }

  return false;
};
