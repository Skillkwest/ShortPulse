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
import { KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import type { ImageSubmissionAdapterKey } from "../../../../lib/model-runtime/submissionAdapterMetadata";
import { falNanoBananaProAllowedAspects } from "../../constants";
import {
  normalizeKieGptImage2ResolutionForAspect,
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
  | "fal-bria-background-remove"
  | "kie-gpt-image-2-edit";

type ImageHandlerContext = {
  id: string;
  finalModel: string;
  cleanedPrompt: string;
  aspect: string;
  requestedResolution?: string;
  preparedImageInputs: string[];
  internalMediaRefs?: ImageSubmissionArgs["internalMediaRefs"];
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

const VALIDATION_FAILURE_CONTEXT = {
  telemetryMode: "validation",
  reasonCode: "USER_INPUT_VALIDATION",
} as const;

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

const hasInternalMediaRefs = (
  refs: ImageSubmissionArgs["internalMediaRefs"] | undefined
): boolean => Boolean(refs?.some((ref) => Boolean(ref)));

const hasInternalEditMediaRefs = (
  inpaintOverride: ImageSubmissionArgs["inpaintOverride"] | undefined
): boolean =>
  Boolean(
    inpaintOverride?.baseImageInternalMediaRef ||
    inpaintOverride?.maskInternalMediaRef ||
    inpaintOverride?.referenceImageInternalMediaRef
  );

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
        notifyGenerationFailure(
          id,
          "Background remove requires a source image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
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
    key: "kie-gpt-image-2-edit",
    matches: (modelId) => modelId === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
    submit: async ({
      id,
      cleanedPrompt,
      aspect,
      requestedResolution,
      preparedImageInputs,
      internalMediaRefs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length && !hasInternalMediaRefs(internalMediaRefs)) {
        notifyGenerationFailure(
          id,
          "Kie GPT Image 2 Edit requires at least one reference image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId(
        KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        {
          prompt: cleanedPrompt,
          input_urls: preparedImageInputs.slice(0, 16),
          aspect_ratio: aspect,
          resolution: normalizeKieGptImage2ResolutionForAspect({
            aspect,
            resolution: requestedResolution,
          }),
          ...resolveImageSubmissionSafetyPayload(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID),
          ...shortpulseSubmitPayload,
        }
      );
      return {
        handled: true,
        response,
        pollingProvider: "kie-gpt-image-2-edit",
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
      internalMediaRefs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length && !hasInternalMediaRefs(internalMediaRefs)) {
        notifyGenerationFailure(
          id,
          "Nano Banana Pro Edit requires at least one reference image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
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
      internalMediaRefs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length && !hasInternalMediaRefs(internalMediaRefs)) {
        notifyGenerationFailure(
          id,
          "Nano Banana 2 Edit requires at least one reference image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
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
      internalMediaRefs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length && !hasInternalMediaRefs(internalMediaRefs)) {
        notifyGenerationFailure(
          id,
          "Seedream 4.5 Edit requires at least one reference image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
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
      internalMediaRefs,
      notifyGenerationFailure,
      shortpulseSubmitPayload,
    }) => {
      if (!preparedImageInputs.length && !hasInternalMediaRefs(internalMediaRefs)) {
        notifyGenerationFailure(
          id,
          "Seedream 5 Lite Edit requires at least one reference image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
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
  workflowReload,
  internalMediaRefs,
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
    ...(workflowReload ? { workflow_reload: workflowReload } : {}),
    ...(hasInternalMediaRefs(internalMediaRefs)
      ? { shortpulse_internal_media_refs: internalMediaRefs }
      : {}),
    ...(hasInternalEditMediaRefs(inpaintOverride)
      ? {
          shortpulse_internal_edit_media_refs: {
            base_image: inpaintOverride?.baseImageInternalMediaRef ?? null,
            mask_image: inpaintOverride?.maskInternalMediaRef ?? null,
            reference_image: inpaintOverride?.referenceImageInternalMediaRef ?? null,
          },
        }
      : {}),
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
    internalMediaRefs,
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
