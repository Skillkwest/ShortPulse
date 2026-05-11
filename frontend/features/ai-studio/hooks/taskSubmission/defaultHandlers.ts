/**
 * Default image submission handlers (OpenAI GPT Image 2, Seedream, and Nano Banana) for AI Studio.
 */
import {
  submitOpenAiGptImage2,
  submitOpenAiGptImage2Edit,
} from "../../../../lib/openAiImageClient";
import {
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_45_TEXT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../../../../lib/model-runtime/falModelIds";
import {
  normalizeOpenAiGptImage2Quality,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
  resolveOpenAiGptImage2SizeForAspect,
} from "../../../../lib/model-runtime/openAiImage2";
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
  | "fal-nano-banana-2"
  | "fal-nano-banana-pro";

type DefaultHandlerContext = {
  projectId?: string | null;
  finalModel: string;
  cleanedPrompt: string;
  aspect: string;
  requestedResolution?: string;
  preparedImageInputs: string[];
  falReferencePayload: ImageSubmissionArgs["falReferencePayload"];
  inpaintOverride?: ImageSubmissionArgs["inpaintOverride"];
  completeGenerationImmediately?: ImageSubmissionArgs["completeGenerationImmediately"];
  shortpulseSubmitPayload: Record<string, unknown>;
};

type DefaultSubmissionAdapterResult =
  | { terminal: "immediate" }
  | {
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

const defaultSubmissionAdapters: DefaultSubmissionAdapter[] = [
  {
    key: "openai-gpt-image-2",
    matches: (modelId) => modelId === OPENAI_GPT_IMAGE_2_MODEL_ID,
    submit: async ({
      projectId,
      cleanedPrompt,
      aspect,
      requestedResolution,
      preparedImageInputs,
      inpaintOverride,
      shortpulseSubmitPayload,
      completeGenerationImmediately,
    }) => {
      const size = resolveOpenAiGptImage2SizeForAspect(aspect);
      const quality = normalizeOpenAiGptImage2Quality(requestedResolution);
      const openAiReferenceImages = inpaintOverride?.baseImageInput?.trim()
        ? [
            inpaintOverride.baseImageInput.trim(),
            ...(inpaintOverride.referenceImageInput?.trim()
              ? [inpaintOverride.referenceImageInput.trim()]
              : []),
          ]
        : preparedImageInputs.slice(0, 8);
      const maskImageUrl = inpaintOverride?.maskInput?.trim();
      const response =
        openAiReferenceImages.length > 0 || maskImageUrl
          ? await submitOpenAiGptImage2Edit({
              prompt: cleanedPrompt,
              size,
              quality,
              images: openAiReferenceImages.map((imageUrl) => ({ image_url: imageUrl })),
              ...(maskImageUrl ? { mask: { image_url: maskImageUrl } } : {}),
              ...(projectId ? { project_id: projectId } : {}),
              ...shortpulseSubmitPayload,
            })
          : await submitOpenAiGptImage2({
              prompt: cleanedPrompt,
              size,
              quality,
              ...(projectId ? { project_id: projectId } : {}),
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
      return {
        terminal: "immediate",
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
    submit: async ({ cleanedPrompt, aspect, requestedResolution, shortpulseSubmitPayload }) => {
      const response = await submitQueuedGenerationByModelId(FAL_NANO_BANANA_2_MODEL_ID, {
        prompt: cleanedPrompt,
        num_images: 1,
        aspect_ratio: normalizeAspectForFalNanoBanana2(aspect),
        output_format: "png",
        resolution: normalizeNanoBanana2Resolution(requestedResolution, "1K"),
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
  projectId,
  finalModel,
  cleanedPrompt,
  aspect,
  requestedResolution,
  preparedImageInputs,
  falReferencePayload,
  generationReplay,
  characterContext,
  styleContext,
  shortpulseContext,
  completeGenerationImmediately,
  startPollingWithGeneration,
  inpaintOverride,
}: ImageSubmissionArgs): Promise<void> => {
  const shortpulseSubmitPayload = {
    ...(generationReplay ? { generation_replay: generationReplay } : {}),
    ...(characterContext ? { character_context: characterContext } : {}),
    ...(styleContext ? { style_context: styleContext } : {}),
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };

  const adapter = defaultSubmissionAdapters.find(({ matches }) => matches(finalModel));
  if (!adapter) {
    throw new Error(`Unsupported model '${finalModel}' for default Fal submission handler.`);
  }
  const result = await adapter.submit({
    projectId,
    finalModel,
    cleanedPrompt,
    aspect,
    requestedResolution,
    preparedImageInputs,
    falReferencePayload,
    inpaintOverride,
    completeGenerationImmediately,
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
