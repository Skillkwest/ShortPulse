/**
 * Default submission handlers (OpenAI GPT Image 2, Seedream, and Nano Banana) for AI Studio.
 */
import { submitOpenAiGptImage2 } from "../../../../lib/openAiImageClient";
import {
  normalizeOpenAiGptImage2Quality,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
  resolveOpenAiGptImage2SizeForAspect,
} from "../../../../lib/model-runtime/openAiImage2";
import {
  type FalSubmitResponse,
  submitFalNanoBanana,
  submitFalNanoBanana2,
  submitFalNanoBananaPro,
  submitFalSeedream,
  submitFalSeedreamV5Lite,
} from "../../../../lib/falClient";
import {
  normalizeNanoBanana2Resolution,
  normalizeNanoBananaProResolution,
} from "../../logic/imageResolution";
import {
  normalizeAspectForFalNanoBanana,
  normalizeAspectForFalNanoBanana2,
  normalizeAspectForFalNanoBananaPro,
} from "../../logic/stateParsers";
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
    | "fal-seedream-v5-lite"
    | "fal-nano-banana"
    | "fal-nano-banana-2"
    | "fal-nano-banana-pro";
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
  startPollingWithGeneration(requestId, pollingProvider, undefined, response);
};

/**
 * Handles default/fallback Fal submissions (Seedream + Nano Banana variants).
 */
export const handleDefaultModelSubmission = async ({
  finalModel,
  cleanedPrompt,
  aspect,
  requestedResolution,
  falReferencePayload,
  generationReplay,
  characterContext,
  styleContext,
  shortpulseContext,
  completeGenerationImmediately,
  startPollingWithGeneration,
}: ImageSubmissionArgs): Promise<void> => {
  let response: FalSubmitResponse;
  let pollingProvider:
    | "fal-seedream"
    | "fal-seedream-v5-lite"
    | "fal-nano-banana"
    | "fal-nano-banana-2"
    | "fal-nano-banana-pro";
  const shortpulseSubmitPayload = {
    ...(generationReplay ? { generation_replay: generationReplay } : {}),
    ...(characterContext ? { character_context: characterContext } : {}),
    ...(styleContext ? { style_context: styleContext } : {}),
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };

  if (finalModel === OPENAI_GPT_IMAGE_2_MODEL_ID) {
    const response = await submitOpenAiGptImage2({
      prompt: cleanedPrompt,
      size: resolveOpenAiGptImage2SizeForAspect(aspect),
      quality: normalizeOpenAiGptImage2Quality(requestedResolution),
      ...shortpulseSubmitPayload,
    });
    if (!completeGenerationImmediately) {
      throw new Error("OpenAI image submission requires an immediate completion callback.");
    }
    completeGenerationImmediately({
      provider: "openai-image",
      generationId: response.output.generationId,
      requestId: response.output.requestId,
      previewUrl: response.output.previewUrl,
      resultUrls: response.output.resultUrls,
      previewStoragePath: response.output.previewStoragePath,
      fullStoragePath: response.output.fullStoragePath,
      mimeType: response.output.mimeType,
      savedMediaIds: response.output.savedMediaIds,
    });
    return;
  } else if (
    finalModel === "fal-ai/bytedance/seedream/v4.5/text-to-image" ||
    finalModel === "fal-ai/bytedance/seedream/v5/lite/text-to-image"
  ) {
    const image_size = resolveSeedreamImageSize(aspect, requestedResolution);
    const submitSeedream =
      finalModel === "fal-ai/bytedance/seedream/v5/lite/text-to-image"
        ? submitFalSeedreamV5Lite
        : submitFalSeedream;
    response = await submitSeedream({
      prompt: cleanedPrompt,
      image_size,
      num_images: 1,
      ...resolveImageSubmissionSafetyPayload(finalModel),
      ...(finalModel === "fal-ai/bytedance/seedream/v5/lite/text-to-image"
        ? {}
        : { output_format: "png" }),
      ...shortpulseSubmitPayload,
    });
    pollingProvider =
      finalModel === "fal-ai/bytedance/seedream/v5/lite/text-to-image"
        ? "fal-seedream-v5-lite"
        : "fal-seedream";
  } else if (finalModel === "fal-ai/nano-banana") {
    response = await submitFalNanoBanana({
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: normalizeAspectForFalNanoBanana(aspect),
      output_format: "png",
      ...falReferencePayload,
      ...shortpulseSubmitPayload,
    });
    pollingProvider = "fal-nano-banana";
  } else if (finalModel === "fal-ai/nano-banana-pro") {
    response = await submitFalNanoBananaPro({
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: normalizeAspectForFalNanoBananaPro(aspect),
      output_format: "png",
      resolution: normalizeNanoBananaProResolution(requestedResolution, "1K"),
      ...falReferencePayload,
      ...shortpulseSubmitPayload,
    });
    pollingProvider = "fal-nano-banana-pro";
  } else if (finalModel === "fal-ai/nano-banana-2") {
    response = await submitFalNanoBanana2({
      prompt: cleanedPrompt,
      num_images: 1,
      aspect_ratio: normalizeAspectForFalNanoBanana2(aspect),
      output_format: "png",
      resolution: normalizeNanoBanana2Resolution(requestedResolution, "1K"),
      ...shortpulseSubmitPayload,
    });
    pollingProvider = "fal-nano-banana-2";
  } else {
    throw new Error(`Unsupported model '${finalModel}' for default Fal submission handler.`);
  }

  handoffSubmitResponse({
    response,
    pollingProvider,
    startPollingWithGeneration,
  });
};
