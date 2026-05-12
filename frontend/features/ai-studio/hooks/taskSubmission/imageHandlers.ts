/**
 * Image and edit submission handlers for AI Studio task generation.
 */
import { type FalSubmitResponse, submitQueuedGenerationByModelId } from "../../../../lib/falClient";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
} from "../../../../lib/model-runtime/falModelIds";
import type { ImageSubmissionAdapterKey } from "../../../../lib/model-runtime/submissionAdapterMetadata";
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

type ImagePollingProvider =
  | "fal-seedream"
  | "fal-seedream-edit"
  | "fal-seedream-v5-lite-edit"
  | "fal-nano-banana-2-edit"
  | "fal-nano-banana-pro-edit"
  | "fal-flux2-klein"
  | "fal-flux-pro-fill"
  | "fal-flux-kontext-inpaint"
  | "fal-bria-background-remove";

type ImageHandlerContext = {
  id: string;
  finalModel: string;
  cleanedPrompt: string;
  aspect: string;
  requestedResolution?: string;
  preparedImageInputs: string[];
  notifyGenerationFailure: ImageSubmissionArgs["notifyGenerationFailure"];
  startPollingWithGeneration: ImageSubmissionArgs["startPollingWithGeneration"];
  inpaintOverride?: ImageSubmissionArgs["inpaintOverride"];
  shortpulseSubmitPayload: Record<string, unknown>;
};

type ImageSubmissionAdapterResult =
  | { handled: false }
  | {
      handled: true;
      response?: FalSubmitResponse;
      pollingProvider?: ImagePollingProvider;
    };

type ImageSubmissionAdapter = {
  key: ImageSubmissionAdapterKey;
  matches: (modelId: string) => boolean;
  submit: (context: ImageHandlerContext) => Promise<ImageSubmissionAdapterResult>;
};

const handoffSubmitResponse = ({
  response,
  pollingProvider,
  startPollingWithGeneration,
}: {
  response: FalSubmitResponse;
  pollingProvider: ImagePollingProvider;
  startPollingWithGeneration: ImageSubmissionArgs["startPollingWithGeneration"];
}) => {
  const requestId = typeof response.request_id === "string" ? response.request_id : undefined;
  startPollingWithGeneration(requestId, pollingProvider, undefined, response);
};

const imageSubmissionAdapters: ImageSubmissionAdapter[] = [
  {
    key: "bria-background-remove",
    matches: (modelId) => modelId === "fal-ai/bria/background/remove",
    submit: async ({
      id,
      preparedImageInputs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      const sourceImageUrl = preparedImageInputs[0]?.trim();
      if (!sourceImageUrl) {
        notifyGenerationFailure(id, "Background remove requires a source image.");
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId("fal-ai/bria/background/remove", {
        image_url: sourceImageUrl,
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "fal-bria-background-remove",
      };
    },
  },
  {
    key: "flux-pro-fill",
    matches: (modelId) => modelId === "fal-ai/flux-pro/v1/fill",
    submit: async ({
      id,
      cleanedPrompt,
      notifyGenerationFailure,
      inpaintOverride,
      shortpulseSubmitPayload,
    }) => {
      const preparedBaseImage = inpaintOverride?.baseImageInput?.trim();
      const preparedMaskImage = inpaintOverride?.maskInput?.trim();
      if (!preparedBaseImage || !preparedMaskImage) {
        notifyGenerationFailure(id, "FLUX Fill requires both a base image and mask.");
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId("fal-ai/flux-pro/v1/fill", {
        prompt: cleanedPrompt,
        image_url: preparedBaseImage,
        mask_url: preparedMaskImage,
        num_images: 1,
        output_format: inpaintOverride?.outputFormat ?? "png",
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "fal-flux-pro-fill",
      };
    },
  },
  {
    key: "flux-kontext-inpaint",
    matches: (modelId) => modelId === "fal-ai/flux-kontext-lora/inpaint",
    submit: async ({
      id,
      cleanedPrompt,
      notifyGenerationFailure,
      inpaintOverride,
      shortpulseSubmitPayload,
    }) => {
      const preparedBaseImage = inpaintOverride?.baseImageInput?.trim();
      const preparedMaskImage = inpaintOverride?.maskInput?.trim();
      const preparedReferenceImage = inpaintOverride?.referenceImageInput?.trim();
      if (!preparedBaseImage || !preparedMaskImage || !preparedReferenceImage) {
        notifyGenerationFailure(
          id,
          "Reference inpaint requires a base image, mask, and one secondary reference image."
        );
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId("fal-ai/flux-kontext-lora/inpaint", {
        prompt: cleanedPrompt,
        image_url: preparedBaseImage,
        mask_url: preparedMaskImage,
        reference_image_url: preparedReferenceImage,
        num_images: 1,
        output_format: inpaintOverride?.outputFormat ?? "png",
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "fal-flux-kontext-inpaint",
      };
    },
  },
  {
    key: "nano-banana-pro-edit",
    matches: (modelId) => modelId === FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
    submit: async ({
      id,
      cleanedPrompt,
      aspect,
      requestedResolution,
      preparedImageInputs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length) {
        notifyGenerationFailure(id, "Nano Banana Pro Edit requires at least one reference image.");
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId(FAL_NANO_BANANA_PRO_EDIT_MODEL_ID, {
        prompt: cleanedPrompt,
        num_images: 1,
        aspect_ratio: falNanoBananaProAllowedAspects.has(aspect) ? aspect : "auto",
        output_format: "png",
        resolution: normalizeNanoBananaProResolution(requestedResolution, "1K"),
        image_urls: preparedImageInputs.slice(0, 8),
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "fal-nano-banana-pro-edit",
      };
    },
  },
  {
    key: "nano-banana-2-edit",
    matches: (modelId) => modelId === FAL_NANO_BANANA_2_EDIT_MODEL_ID,
    submit: async ({
      id,
      cleanedPrompt,
      aspect,
      requestedResolution,
      preparedImageInputs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length) {
        notifyGenerationFailure(id, "Nano Banana 2 Edit requires at least one reference image.");
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId(FAL_NANO_BANANA_2_EDIT_MODEL_ID, {
        prompt: cleanedPrompt,
        num_images: 1,
        aspect_ratio: normalizeAspectForFalNanoBanana2(aspect),
        output_format: "png",
        resolution: normalizeNanoBanana2Resolution(requestedResolution, "1K"),
        image_urls: preparedImageInputs.slice(0, 8),
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "fal-nano-banana-2-edit",
      };
    },
  },
  {
    key: "seedream-edit",
    matches: (modelId) => modelId === FAL_SEEDREAM_45_EDIT_MODEL_ID,
    submit: async ({
      id,
      finalModel,
      cleanedPrompt,
      aspect,
      requestedResolution,
      preparedImageInputs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length) {
        notifyGenerationFailure(id, "Seedream 4.5 Edit requires at least one reference image.");
        return { handled: true };
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
      return {
        handled: true,
        response,
        pollingProvider: "fal-seedream-edit",
      };
    },
  },
  {
    key: "seedream-v5-lite-edit",
    matches: (modelId) => modelId === FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
    submit: async ({
      id,
      finalModel,
      cleanedPrompt,
      aspect,
      requestedResolution,
      preparedImageInputs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length) {
        notifyGenerationFailure(id, "Seedream 5 Lite Edit requires at least one reference image.");
        return { handled: true };
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
      return {
        handled: true,
        response,
        pollingProvider: "fal-seedream-v5-lite-edit",
      };
    },
  },
  {
    key: "flux-2-klein",
    matches: (modelId) => modelId === FAL_FLUX_2_KLEIN_9B_MODEL_ID,
    submit: async ({ finalModel, cleanedPrompt, aspect, shortpulseSubmitPayload }) => {
      const size = falSizeForAspect(aspect);
      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: cleanedPrompt,
        image_size: { width: size.width, height: size.height },
        num_images: 1,
        output_format: "jpeg",
        num_inference_steps: 4,
        ...resolveImageSubmissionSafetyPayload(finalModel),
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "fal-flux2-klein",
      };
    },
  },
];

export const listImageSubmissionAdapterKeys = (): ImageSubmissionAdapterKey[] =>
  imageSubmissionAdapters.map(({ key }) => key);

export const resolveImageSubmissionAdapterKey = (
  modelId: string
): ImageSubmissionAdapterKey | null =>
  imageSubmissionAdapters.find(({ matches }) => matches(modelId))?.key ?? null;

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
  const shortpulseContextWithInpaintDimensions =
    shortpulseContext && inpaintOverride?.imageWidth && inpaintOverride?.imageHeight
      ? {
          ...shortpulseContext,
          image_width: inpaintOverride.imageWidth,
          image_height: inpaintOverride.imageHeight,
        }
      : shortpulseContext;
  const shortpulseSubmitPayload = {
    ...(generationReplay ? { generation_replay: generationReplay } : {}),
    ...(characterContext ? { character_context: characterContext } : {}),
    ...(styleContext ? { style_context: styleContext } : {}),
    ...(shortpulseContextWithInpaintDimensions
      ? { shortpulse_context: shortpulseContextWithInpaintDimensions }
      : {}),
  };
  const adapter = imageSubmissionAdapters.find(({ matches }) => matches(finalModel));
  if (!adapter) return false;
  const result = await adapter.submit({
    id,
    finalModel,
    cleanedPrompt,
    aspect,
    requestedResolution,
    preparedImageInputs,
    notifyGenerationFailure,
    startPollingWithGeneration,
    inpaintOverride,
    shortpulseSubmitPayload,
  });
  if (result.handled && result.response && result.pollingProvider) {
    handoffSubmitResponse({
      response: result.response,
      pollingProvider: result.pollingProvider,
      startPollingWithGeneration,
    });
  }
  return result.handled;
};
