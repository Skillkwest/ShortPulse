/**
 * Public facade for AI Studio video model submissions.
 */
import type { FalSubmitResponse } from "../../../../lib/falClient";
import type { VideoSubmissionAdapterKey } from "../../../../lib/model-runtime/submissionAdapterMetadata";
import { videoSubmissionAdapters, type VideoPollingProvider } from "./videoAdapters";
import type { VideoSubmissionArgs } from "./types";

const handoffSubmitResponse = ({
  response,
  pollingProvider,
  patch,
  startPollingWithGeneration,
}: {
  response: FalSubmitResponse;
  pollingProvider: VideoPollingProvider;
  patch?: Parameters<VideoSubmissionArgs["startPollingWithGeneration"]>[2];
  startPollingWithGeneration: VideoSubmissionArgs["startPollingWithGeneration"];
}) => {
  const requestId = typeof response.request_id === "string" ? response.request_id : undefined;
  startPollingWithGeneration(requestId, pollingProvider, patch, response);
};

export const listVideoSubmissionAdapterKeys = (): VideoSubmissionAdapterKey[] =>
  videoSubmissionAdapters.map(({ key }) => key);

export const resolveVideoSubmissionAdapterKey = (
  modelId: string
): VideoSubmissionAdapterKey | null =>
  videoSubmissionAdapters.find(({ matches }) => matches(modelId))?.key ?? null;

/**
 * Handles video model submissions. Returns true when a matching model is handled.
 */
export const handleVideoModelSubmission = async ({
  id,
  finalModel,
  cleanedPrompt,
  aspect,
  requestedDurationSeconds,
  requestedResolution,
  requestedAudio,
  preparedImageInputs,
  rawImageInputs = preparedImageInputs,
  internalMediaRefs,
  modelConfig,
  notifyGenerationFailure,
  updateOutputById,
  generationReplay,
  workflowReload,
  characterContext,
  styleContext,
  shortpulseContext,
  startPollingWithGeneration,
  videoReferenceMode,
  videoReferenceImageUrl,
  motionReferenceVideoUrl,
  lipSyncAudio,
  lipSyncTurboMode,
  seedance2InputMode = "text",
  seedance2ReferenceImageUrls = [],
  seedance2ReferenceVideoUrls = [],
  seedance2ReferenceAudioUrls = [],
  seedance2ReturnLastFrame = false,
  seedance2WebSearch = false,
  klingCfgScale,
  klingWorkflowMode,
  klingMultiPrompts,
  klingElements,
}: VideoSubmissionArgs): Promise<boolean> => {
  const shortpulseSubmitPayload = {
    ...(generationReplay ? { generation_replay: generationReplay } : {}),
    ...(workflowReload ? { workflow_reload: workflowReload } : {}),
    ...(characterContext ? { character_context: characterContext } : {}),
    ...(styleContext ? { style_context: styleContext } : {}),
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };
  const adapter = videoSubmissionAdapters.find(({ matches }) => matches(finalModel));
  if (!adapter) return false;
  const result = await adapter.submit({
    id,
    finalModel,
    cleanedPrompt,
    aspect,
    requestedDurationSeconds,
    requestedResolution,
    requestedAudio,
    preparedImageInputs,
    rawImageInputs,
    internalMediaRefs,
    modelConfig,
    notifyGenerationFailure,
    updateOutputById,
    videoReferenceMode,
    videoReferenceImageUrl,
    motionReferenceVideoUrl,
    lipSyncAudio,
    lipSyncTurboMode,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
    klingCfgScale,
    klingWorkflowMode,
    klingMultiPrompts,
    klingElements,
    shortpulseSubmitPayload,
  });
  if (result.handled && result.response && result.pollingProvider) {
    handoffSubmitResponse({
      response: result.response,
      pollingProvider: result.pollingProvider,
      patch: result.patch,
      startPollingWithGeneration,
    });
  }
  return result.handled;
};
