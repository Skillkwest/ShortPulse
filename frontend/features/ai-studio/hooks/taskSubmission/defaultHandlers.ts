/**
 * Default queued image submission handlers for AI Studio.
 */
import {
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_45_TEXT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../../../../lib/model-runtime/falModelIds";
import { KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import {
  normalizeKieGptImage2AspectRatio,
  normalizeKieGptImage2ResolutionForAspect,
} from "../../../../lib/model-runtime/kieGptImage2";
import type { DefaultSubmissionAdapterKey } from "../../../../lib/model-runtime/submissionAdapterMetadata";
import { type FalSubmitResponse, submitQueuedGenerationByModelId } from "../../../../lib/falClient";
import {
  normalizeNanoBanana2Resolution,
  normalizeNanoBananaProResolution,
} from "../../logic/imageResolution";
import {
  normalizeAspectForFalNanoBanana2,
  normalizeAspectForFalNanoBananaPro,
} from "../../logic/stateParsers";
import { resolveSeedreamImageSize } from "../../logic/seedreamSizing";
import { resolveImageSubmissionSafetyPayload } from "./safetyPolicy";
import type { ImageSubmissionArgs } from "./types";

type DefaultPollingProvider =
  | "fal-seedream"
  | "fal-seedream-v5-lite"
  | "kie-gpt-image-2"
  | "fal-nano-banana-2"
  | "fal-nano-banana-pro";

type DefaultHandlerContext = {
  finalModel: string;
  cleanedPrompt: string;
  aspect: string;
  requestedResolution?: string;
  falReferencePayload: ImageSubmissionArgs["falReferencePayload"];
  shortpulseSubmitPayload: Record<string, unknown>;
};

type DefaultSubmissionAdapterResult = {
  terminal: "queued";
  response: FalSubmitResponse;
  pollingProvider: DefaultPollingProvider;
};

type DefaultSubmissionAdapter = {
  key: DefaultSubmissionAdapterKey;
  matches: (modelId: string) => boolean;
  submit: (context: DefaultHandlerContext) => Promise<DefaultSubmissionAdapterResult>;
};

const handoffSubmitResponse = ({
  response,
  pollingProvider,
  startPollingWithGeneration,
}: {
  response: FalSubmitResponse;
  pollingProvider: DefaultPollingProvider;
  startPollingWithGeneration: ImageSubmissionArgs["startPollingWithGeneration"];
}) => {
  const requestId = typeof response.request_id === "string" ? response.request_id : undefined;
  startPollingWithGeneration(requestId, pollingProvider, undefined, response);
};

const hasInternalMediaRefs = (
  refs: ImageSubmissionArgs["internalMediaRefs"] | undefined
): boolean => Boolean(refs?.some((ref) => Boolean(ref)));

const hasInternalEditMediaRefs = (inpaintOverride: ImageSubmissionArgs["inpaintOverride"]) =>
  Boolean(
    inpaintOverride?.baseImageInternalMediaRef ||
    inpaintOverride?.maskInternalMediaRef ||
    inpaintOverride?.referenceImageInternalMediaRef
  );

const defaultSubmissionAdapters: DefaultSubmissionAdapter[] = [
  {
    key: "kie-gpt-image-2-text",
    matches: (modelId) => modelId === KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
    submit: async ({ cleanedPrompt, aspect, requestedResolution, shortpulseSubmitPayload }) => {
      const aspect_ratio = normalizeKieGptImage2AspectRatio(aspect);
      const resolution = normalizeKieGptImage2ResolutionForAspect({
        aspect: aspect_ratio,
        resolution: requestedResolution,
      });
      const response = await submitQueuedGenerationByModelId(
        KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
        {
          prompt: cleanedPrompt,
          aspect_ratio,
          resolution,
          ...resolveImageSubmissionSafetyPayload(KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID),
          ...shortpulseSubmitPayload,
        }
      );
      return {
        terminal: "queued",
        response,
        pollingProvider: "kie-gpt-image-2",
      };
    },
  },
  {
    key: "seedream-text",
    matches: (modelId) => modelId === FAL_SEEDREAM_45_TEXT_MODEL_ID,
    submit: async ({
      finalModel,
      cleanedPrompt,
      aspect,
      requestedResolution,
      shortpulseSubmitPayload,
    }) => {
      const image_size = resolveSeedreamImageSize(aspect, requestedResolution);
      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: cleanedPrompt,
        image_size,
        num_images: 1,
        ...resolveImageSubmissionSafetyPayload(finalModel),
        output_format: "png",
        ...shortpulseSubmitPayload,
      });
      return {
        terminal: "queued",
        response,
        pollingProvider: "fal-seedream",
      };
    },
  },
  {
    key: "seedream-v5-lite-text",
    matches: (modelId) => modelId === FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
    submit: async ({
      finalModel,
      cleanedPrompt,
      aspect,
      requestedResolution,
      shortpulseSubmitPayload,
    }) => {
      const image_size = resolveSeedreamImageSize(aspect, requestedResolution);
      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: cleanedPrompt,
        image_size,
        num_images: 1,
        ...resolveImageSubmissionSafetyPayload(finalModel),
        ...(finalModel === FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID ? {} : { output_format: "png" }),
        ...shortpulseSubmitPayload,
      });
      return {
        terminal: "queued",
        response,
        pollingProvider: "fal-seedream-v5-lite",
      };
    },
  },
  {
    key: "nano-banana-pro-text",
    matches: (modelId) => modelId === FAL_NANO_BANANA_PRO_MODEL_ID,
    submit: async ({
      cleanedPrompt,
      aspect,
      requestedResolution,
      falReferencePayload,
      shortpulseSubmitPayload,
    }) => {
      const response = await submitQueuedGenerationByModelId(FAL_NANO_BANANA_PRO_MODEL_ID, {
        prompt: cleanedPrompt,
        num_images: 1,
        aspect_ratio: normalizeAspectForFalNanoBananaPro(aspect),
        output_format: "png",
        resolution: normalizeNanoBananaProResolution(requestedResolution, "1K"),
        ...falReferencePayload,
        ...shortpulseSubmitPayload,
      });
      return {
        terminal: "queued",
        response,
        pollingProvider: "fal-nano-banana-pro",
      };
    },
  },
  {
    key: "nano-banana-2-text",
    matches: (modelId) => modelId === FAL_NANO_BANANA_2_MODEL_ID,
    submit: async ({
      cleanedPrompt,
      aspect,
      requestedResolution,
      falReferencePayload,
      shortpulseSubmitPayload,
    }) => {
      const response = await submitQueuedGenerationByModelId(FAL_NANO_BANANA_2_MODEL_ID, {
        prompt: cleanedPrompt,
        num_images: 1,
        aspect_ratio: normalizeAspectForFalNanoBanana2(aspect),
        output_format: "png",
        resolution: normalizeNanoBanana2Resolution(requestedResolution, "1K"),
        ...falReferencePayload,
        ...shortpulseSubmitPayload,
      });
      return {
        terminal: "queued",
        response,
        pollingProvider: "fal-nano-banana-2",
      };
    },
  },
];

export const listDefaultSubmissionAdapterKeys = (): DefaultSubmissionAdapterKey[] =>
  defaultSubmissionAdapters.map(({ key }) => key);

export const resolveDefaultSubmissionAdapterKey = (
  modelId: string
): DefaultSubmissionAdapterKey | null =>
  defaultSubmissionAdapters.find(({ matches }) => matches(modelId))?.key ?? null;

/**
 * Handles default image submissions (Seedream + Nano Banana variants).
 */
export const handleDefaultModelSubmission = async ({
  finalModel,
  cleanedPrompt,
  aspect,
  requestedResolution,
  falReferencePayload,
  generationReplay,
  workflowReload,
  internalMediaRefs,
  characterContext,
  styleContext,
  shortpulseContext,
  startPollingWithGeneration,
  inpaintOverride,
}: ImageSubmissionArgs): Promise<void> => {
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
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };

  const adapter = defaultSubmissionAdapters.find(({ matches }) => matches(finalModel));
  if (!adapter) {
    throw new Error(`Unsupported model '${finalModel}' for default Fal submission handler.`);
  }
  const result = await adapter.submit({
    finalModel,
    cleanedPrompt,
    aspect,
    requestedResolution,
    falReferencePayload,
    shortpulseSubmitPayload,
  });
  if (result.terminal === "queued") {
    handoffSubmitResponse({
      response: result.response,
      pollingProvider: result.pollingProvider,
      startPollingWithGeneration,
    });
  }
};
