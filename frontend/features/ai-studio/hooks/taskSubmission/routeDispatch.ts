/**
 * Provider route dispatch for AI Studio task submission.
 * Keeps handler selection and argument fanout out of the main submit hook.
 */
import {
  handleDefaultModelSubmission,
  handleImageModelSubmission,
  handleVideoModelSubmission,
  resolveSubmissionHandlerRoute,
} from "../taskSubmissionHandlers";
import type { FalSubmitResponse } from "../../../../lib/falClient";
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { AiStudioKlingElement } from "../../logic/klingElements";
import type { Provider } from "../../logic/stateParsers";
import type { StudioMode, StudioOutput } from "../../types";
import type {
  ImmediateGenerationResult,
  SubmissionHandlerRoute,
  SubmissionModelConfig,
  SubmissionPatch,
} from "./types";

export type DispatchSubmissionByRouteParams = {
  id: string;
  projectId?: string | null;
  finalModel: string;
  cleanedPrompt: string;
  outputMode: StudioMode;
  effectiveAspect: string;
  requestedDurationSeconds: number;
  requestedResolution?: string;
  requestedAudio: boolean;
  preparedImageInputs: string[];
  modelConfig: SubmissionModelConfig;
  generationReplay?: Record<string, unknown> | null;
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
  shortpulseContext?: Record<string, unknown>;
  falReferencePayload: { image_url: string; image_urls: string[] } | Record<string, never>;
  inpaintOverride?: InpaintSubmissionOverride | null;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  videoCameraFixed: boolean;
  rawImageInputs?: string[];
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean;
  seedance2WebSearch?: boolean;
  klingCfgScale: number;
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  startPollingWithGeneration: (
    taskId: string | undefined,
    provider: Provider,
    patch?: SubmissionPatch,
    submitResponse?: FalSubmitResponse
  ) => void;
  completeGenerationImmediately?: (result: ImmediateGenerationResult) => void;
  createSubmitNotStartedError: (detail: string) => Error;
};

type SubmissionRouteAdapter = (params: DispatchSubmissionByRouteParams) => Promise<void>;

const submissionRouteAdapters: Record<
  Exclude<SubmissionHandlerRoute, "unsupported">,
  SubmissionRouteAdapter
> = {
  video: async ({
    id,
    finalModel,
    cleanedPrompt,
    effectiveAspect,
    requestedDurationSeconds,
    requestedResolution,
    requestedAudio,
    preparedImageInputs,
    modelConfig,
    notifyGenerationFailure,
    updateOutputById,
    generationReplay,
    characterContext,
    styleContext,
    shortpulseContext,
    startPollingWithGeneration,
    completeGenerationImmediately,
    videoReferenceMode,
    videoReferenceImageUrl,
    motionReferenceVideoUrl,
    videoCameraFixed,
    rawImageInputs,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
    klingCfgScale,
    klingMultiPrompts,
    klingElements,
  }) => {
    await handleVideoModelSubmission({
      id,
      finalModel,
      cleanedPrompt,
      aspect: effectiveAspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      modelConfig,
      notifyGenerationFailure,
      updateOutputById,
      generationReplay,
      characterContext,
      styleContext,
      shortpulseContext,
      startPollingWithGeneration,
      completeGenerationImmediately,
      videoReferenceMode,
      videoReferenceImageUrl,
      motionReferenceVideoUrl,
      videoCameraFixed,
      rawImageInputs,
      seedance2InputMode,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReferenceAudioUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingCfgScale,
      klingMultiPrompts,
      klingElements,
    });
  },
  image: async ({
    id,
    projectId = null,
    finalModel,
    cleanedPrompt,
    effectiveAspect,
    requestedDurationSeconds,
    requestedResolution,
    requestedAudio,
    preparedImageInputs,
    modelConfig,
    generationReplay,
    characterContext,
    styleContext,
    shortpulseContext,
    falReferencePayload,
    inpaintOverride,
    notifyGenerationFailure,
    updateOutputById,
    startPollingWithGeneration,
    completeGenerationImmediately,
    createSubmitNotStartedError,
  }) => {
    const handled = await handleImageModelSubmission({
      id,
      projectId,
      finalModel,
      cleanedPrompt,
      aspect: effectiveAspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      modelConfig,
      notifyGenerationFailure,
      updateOutputById,
      generationReplay,
      characterContext,
      styleContext,
      shortpulseContext,
      startPollingWithGeneration,
      completeGenerationImmediately,
      falReferencePayload,
      inpaintOverride,
    });
    if (!handled) {
      throw createSubmitNotStartedError(
        `Image submission route did not handle model '${finalModel}'.`
      );
    }
  },
  default: async ({
    id,
    projectId = null,
    finalModel,
    cleanedPrompt,
    effectiveAspect,
    requestedDurationSeconds,
    requestedResolution,
    requestedAudio,
    preparedImageInputs,
    modelConfig,
    generationReplay,
    characterContext,
    styleContext,
    shortpulseContext,
    falReferencePayload,
    inpaintOverride,
    notifyGenerationFailure,
    updateOutputById,
    startPollingWithGeneration,
    completeGenerationImmediately,
  }) => {
    await handleDefaultModelSubmission({
      id,
      projectId,
      finalModel,
      cleanedPrompt,
      aspect: effectiveAspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      modelConfig,
      notifyGenerationFailure,
      updateOutputById,
      generationReplay,
      characterContext,
      styleContext,
      shortpulseContext,
      startPollingWithGeneration,
      completeGenerationImmediately,
      falReferencePayload,
      inpaintOverride,
    });
  },
};

export const dispatchSubmissionByRoute = async ({
  id,
  projectId = null,
  finalModel,
  cleanedPrompt,
  outputMode,
  effectiveAspect,
  requestedDurationSeconds,
  requestedResolution,
  requestedAudio,
  preparedImageInputs,
  modelConfig,
  generationReplay,
  characterContext,
  styleContext,
  shortpulseContext,
  falReferencePayload,
  inpaintOverride,
  videoReferenceMode,
  videoReferenceImageUrl,
  motionReferenceVideoUrl,
  videoCameraFixed,
  rawImageInputs,
  seedance2InputMode,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
  klingCfgScale,
  klingMultiPrompts,
  klingElements,
  notifyGenerationFailure,
  updateOutputById,
  startPollingWithGeneration,
  completeGenerationImmediately,
  createSubmitNotStartedError,
}: DispatchSubmissionByRouteParams) => {
  const route = resolveSubmissionHandlerRoute(finalModel);
  const routeAdapter =
    route === "unsupported"
      ? null
      : submissionRouteAdapters[route as Exclude<SubmissionHandlerRoute, "unsupported">];
  if (!routeAdapter) {
    throw createSubmitNotStartedError(
      `Model '${finalModel}' is not registered for AI Studio generation submission.`
    );
  }
  await routeAdapter({
    id,
    projectId,
    finalModel,
    cleanedPrompt,
    outputMode,
    effectiveAspect,
    requestedDurationSeconds,
    requestedResolution,
    requestedAudio,
    preparedImageInputs,
    modelConfig,
    generationReplay,
    characterContext,
    styleContext,
    shortpulseContext,
    falReferencePayload,
    inpaintOverride,
    videoReferenceMode,
    videoReferenceImageUrl,
    motionReferenceVideoUrl,
    videoCameraFixed,
    rawImageInputs,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
    klingCfgScale,
    klingMultiPrompts,
    klingElements,
    notifyGenerationFailure,
    updateOutputById,
    startPollingWithGeneration,
    completeGenerationImmediately,
    createSubmitNotStartedError,
  });
};
