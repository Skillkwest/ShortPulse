/**
 * AI Studio audio generation hook.
 * Owns page-scoped audio submit flows so the AI Studio page stays focused on orchestration.
 */
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  resolveRequiredAudioMusicModelId,
  resolveRequiredAudioSoundEffectsModelId,
  resolveRequiredAudioVoiceChangerModelId,
  resolveRequiredAudioVoiceoverModelId,
  resolveModelLabelById,
} from "../../../lib/model-runtime/modelCatalog";
import type { MusicGenerateRequest } from "../components/MusicPropertiesPanel";
import type { SoundEffectsGenerateRequest } from "../components/SoundEffectsPropertiesPanel";
import type { VoicesGenerateRequest } from "../components/VoicesPropertiesPanel";
import type {
  StudioMode,
  StudioOutput,
  StudioOutputSaveState,
  ToolId,
  WorkflowReloadConfig,
  WorkflowReloadMusicMode,
} from "../types";
import { buildWorkflowReloadConfigV1 } from "../logic/workflowReload";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { readGenerationAdmissionErrorMessage } from "../../../lib/generationAdmissionErrors";
import {
  getReferenceGridAvailableSlots,
  REFERENCE_GRID_CAP_REACHED_MESSAGE,
} from "../reference-grid/logic/referenceGridLimits";

type VoicesGenerateSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    companionArtUrl: string | null;
    companionArtStoragePath: string | null;
    companionArtStatus: "pending" | "processing" | "ready" | "failed" | null;
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: number[] | null;
    modelId: string;
    voiceId: string;
    voiceName: string;
    transcriptText?: string | null;
    saveState?: StudioOutputSaveState;
    saveError?: string | null;
  };
  remuxedVideo?: {
    provider: "elevenlabs";
    mode: "video";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    previewPosterUrl: string | null;
    resultUrls: string[];
    previewPosterStoragePath: string | null;
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: "video/mp4" | "video/webm";
    modelId: string;
    transcriptText?: string | null;
    saveState?: StudioOutputSaveState;
    saveError?: string | null;
  };
};

type SoundEffectsGenerateSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    companionArtUrl: string | null;
    companionArtStoragePath: string | null;
    companionArtStatus: "pending" | "processing" | "ready" | "failed" | null;
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: number[] | null;
    modelId: string;
    characterCost: number | null;
    saveState?: StudioOutputSaveState;
    saveError?: string | null;
  };
};

type MusicGenerateSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    companionArtUrl: string | null;
    companionArtStoragePath: string | null;
    companionArtStatus: "pending" | "processing" | "ready" | "failed" | null;
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: number[] | null;
    lyricsText?: string | null;
    musicMode?: WorkflowReloadMusicMode | null;
    title?: string | null;
    modelId: string;
    saveState?: StudioOutputSaveState;
    saveError?: string | null;
  };
};

type AudioGenerateErrorResponse = {
  error?: string;
  details?: string;
  code?: string;
  retryAfterSeconds?: number | string;
  admissionScope?: "shared_provider" | "per_user";
};

type UseAiStudioAudioGenerationParams = {
  projectId?: string | null;
  workspaceRuntimeKey?: string | null;
  outputs?: StudioOutput[];
  setUiError: Dispatch<SetStateAction<string | null>>;
  insertOptimisticGenerationPlaceholder: (args: {
    prompt: string;
    modeOverride?: StudioMode;
    selectedToolOverride?: ToolId | null;
    modelLabelOverride?: string | null;
    modelIdOverride?: string | null;
    providerOverride?: string | null;
    submissionModeOverride?: "provider-task" | "direct-request";
  }) => string | null;
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
};

const buildVoicesOutputPrompt = (request: VoicesGenerateRequest): string =>
  request.mode === "voiceover"
    ? request.script
    : `${request.source.extractedFrom?.name ?? request.source.name} -> ${request.voice.name}`;

const VOICEOVER_MODEL_ID = resolveRequiredAudioVoiceoverModelId();
const VOICE_CHANGER_MODEL_ID = resolveRequiredAudioVoiceChangerModelId();
const MUSIC_MODEL_ID = resolveRequiredAudioMusicModelId();
const SOUND_EFFECTS_MODEL_ID = resolveRequiredAudioSoundEffectsModelId();

const buildVoicesOutputModelLabel = (request: VoicesGenerateRequest): string =>
  request.mode === "voiceover"
    ? (resolveModelLabelById(VOICEOVER_MODEL_ID) ?? "Voiceover")
    : (resolveModelLabelById(VOICE_CHANGER_MODEL_ID) ?? "Voice Changer");

const buildMusicOutputModelLabel = (): string => resolveModelLabelById(MUSIC_MODEL_ID) ?? "Music";
const buildSoundEffectsOutputModelLabel = (): string =>
  resolveModelLabelById(SOUND_EFFECTS_MODEL_ID) ?? "Sound Effects";

const resolveAudioGenerateErrorMessage = ({
  response,
  payload,
}: {
  response: { status: number; headers?: Pick<Headers, "get"> | null };
  payload: AudioGenerateErrorResponse | null;
}): string =>
  sanitizeCustomerFacingProviderText(
    readGenerationAdmissionErrorMessage(response, payload) ||
      payload?.details?.trim() ||
      payload?.error?.trim(),
    "Audio generation failed."
  );

const buildAudioShortpulseContext = ({
  selectedTool,
  displayedBilledCredits,
  pricingPolicyReady = true,
  workspaceRuntimeKey = null,
}: {
  selectedTool: "music" | "sound-effects" | "voiceover" | "voice-changer";
  displayedBilledCredits: number | null | undefined;
  pricingPolicyReady?: boolean;
  workspaceRuntimeKey?: string | null;
}) => ({
  mode: "audio",
  selected_tool: selectedTool,
  workspace_runtime_key: workspaceRuntimeKey,
  workspace_runtime_key_present: Boolean(workspaceRuntimeKey),
  pricing_display_source: "pricing_grid",
  pricing_policy_ready: pricingPolicyReady,
  displayed_billed_credits:
    typeof displayedBilledCredits === "number" ? displayedBilledCredits : null,
});

const attachWorkflowReloadToAudioOutput = ({
  outputId,
  updateOutputById,
  workflowReload,
}: {
  outputId: string;
  updateOutputById: UseAiStudioAudioGenerationParams["updateOutputById"];
  workflowReload: WorkflowReloadConfig | null;
}) => {
  if (!workflowReload) return;
  updateOutputById(outputId, (item) => ({
    ...item,
    workflowReload,
  }));
};

const buildVoiceWorkflowReload = ({
  projectId,
  request,
}: {
  projectId?: string | null;
  request: VoicesGenerateRequest;
}): WorkflowReloadConfig | null => {
  if (request.mode === "voiceover") {
    return buildWorkflowReloadConfigV1({
      originTool: "text-to-speech",
      panelKind: "voices",
      outputMode: "audio",
      projectId,
      prompt: {
        display: request.script,
        submission: request.script,
      },
      model: {
        id: request.config.model_id,
      },
      payload: {
        kind: "voiceover",
        script: request.script,
        voiceId: request.voice.id,
        voiceName: request.voice.name,
        outputFormat: request.outputFormat,
        config: request.config,
      },
    });
  }
  const source = request.source;
  return buildWorkflowReloadConfigV1({
    originTool: "voice-changer",
    panelKind: "voices",
    outputMode: "audio",
    projectId,
    prompt: {
      display: buildVoicesOutputPrompt(request),
      submission: buildVoicesOutputPrompt(request),
    },
    model: {
      id: request.modelId,
    },
    payload: {
      kind: "voice-changer",
      source: {
        name: source.extractedFrom?.name ?? source.name,
        origin: source.origin,
        sourceUrl: source.sourceUrl,
        storagePath: source.storagePath,
        referenceOutputId: source.referenceOutputId,
        referenceMediaId: source.referenceMediaId,
        mimeType: source.mimeType,
        aspect: source.aspect,
        extractedFrom: source.extractedFrom
          ? {
              name: source.extractedFrom.name,
              sourceUrl: source.extractedFrom.sourceUrl,
              storagePath: source.extractedFrom.storagePath,
              referenceOutputId: source.extractedFrom.referenceOutputId,
              referenceMediaId: source.extractedFrom.referenceMediaId,
              mimeType: source.extractedFrom.mimeType,
              aspect: source.extractedFrom.aspect,
            }
          : null,
      },
      voiceId: request.voice.id,
      voiceName: request.voice.name,
      outputFormat: request.outputFormat,
      modelId: request.modelId,
      inputFormat: request.inputFormat,
      removeBackgroundNoise: request.removeBackgroundNoise,
      voiceSettings: request.voiceSettings,
    },
  });
};

const buildMusicWorkflowReload = ({
  projectId,
  request,
}: {
  projectId?: string | null;
  request: MusicGenerateRequest;
}): WorkflowReloadConfig | null =>
  buildWorkflowReloadConfigV1({
    originTool: "music",
    panelKind: "music",
    outputMode: "audio",
    projectId,
    prompt: {
      display: request.text,
      submission: request.text,
    },
    model: {
      id: request.modelId,
    },
    payload: {
      kind: "music",
      text: request.text,
      lyrics: request.lyrics ?? "",
      durationSeconds: request.durationSeconds,
      bpm: request.bpm,
      mode: request.mode,
      structure: request.structure,
      energyPercent: request.energyPercent,
      outputFormat: request.outputFormat,
      composerMode: request.composerMode ?? null,
      instrumentalEnabled: request.instrumentalEnabled ?? null,
      singerEnabled: request.singerEnabled ?? null,
      songBatchCount: request.songBatchCount ?? null,
    },
  });

const buildSoundEffectsWorkflowReload = ({
  projectId,
  request,
}: {
  projectId?: string | null;
  request: SoundEffectsGenerateRequest;
}): WorkflowReloadConfig | null =>
  buildWorkflowReloadConfigV1({
    originTool: "sound-effects",
    panelKind: "sound-effects",
    outputMode: "audio",
    projectId,
    prompt: {
      display: request.text,
      submission: request.text,
    },
    model: {
      id: request.modelId,
    },
    payload: {
      kind: "sound-effects",
      text: request.text,
      durationSeconds: request.durationSeconds,
      loop: request.loop,
      promptInfluence: null,
      outputFormat: request.outputFormat,
    },
  });

const toSavedMediaIds = (mediaFileId: string | null | undefined): string[] =>
  typeof mediaFileId === "string" && mediaFileId.trim().length > 0 ? [mediaFileId] : [];

const resolveGeneratedOutputSaveState = ({
  mediaFileId,
  saveState,
}: {
  mediaFileId: string | null | undefined;
  saveState?: StudioOutputSaveState;
}): StudioOutputSaveState => {
  if (typeof saveState === "string") return saveState;
  return typeof mediaFileId === "string" && mediaFileId.trim().length > 0 ? "saved" : "idle";
};

const buildVoiceChangerRemuxedVideoOutput = ({
  request,
  payload,
}: {
  request: Extract<VoicesGenerateRequest, { mode: "voice-changer" }>;
  payload: NonNullable<VoicesGenerateSuccessResponse["remuxedVideo"]>;
}): StudioOutput => {
  const savedMediaIds = toSavedMediaIds(payload.mediaFileId);
  const sourceLabel = request.source.extractedFrom?.name ?? request.source.name;
  return {
    id: `generated:${payload.generationId}`,
    prompt: `${sourceLabel} -> ${request.voice.name} video`,
    transcriptText: payload.transcriptText ?? null,
    mode: "video",
    aspect: request.source.extractedFrom?.aspect ?? "1:1",
    model: buildVoicesOutputModelLabel(request),
    createdAt: new Date().toISOString(),
    modelId: payload.modelId,
    provider: payload.provider,
    generationId: payload.generationId,
    savedMediaIds,
    sourceRef: payload.requestId,
    status: "ready",
    timestamp: "Just now",
    taskState: "success",
    resultUrls: payload.resultUrls,
    previewUrl: payload.previewUrl,
    previewPosterUrl: payload.previewPosterUrl,
    previewPosterStoragePath: payload.previewPosterStoragePath,
    previewStoragePath: payload.previewStoragePath,
    fullStoragePath: payload.fullStoragePath,
    previewTier: "preview_loop",
    mimeType: payload.mimeType,
    audioSourceMode: null,
    mediaSource: "generated",
    localObjectUrl: null,
    saveState: resolveGeneratedOutputSaveState(payload),
    saveError: sanitizeCustomerFacingProviderText(payload.saveError, "") || null,
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
  };
};

const applyAudioOutputToPlaceholder = ({
  updateOutputById,
  outputId,
  promptText,
  modelLabel,
  payload,
  audioSourceMode,
}: {
  updateOutputById: UseAiStudioAudioGenerationParams["updateOutputById"];
  outputId: string;
  promptText: string;
  modelLabel: string;
  payload:
    | VoicesGenerateSuccessResponse["output"]
    | MusicGenerateSuccessResponse["output"]
    | SoundEffectsGenerateSuccessResponse["output"];
  audioSourceMode: StudioOutput["audioSourceMode"];
}) => {
  const savedMediaIds = toSavedMediaIds(payload.mediaFileId);
  updateOutputById(outputId, (item) => ({
    ...item,
    mode: "audio",
    prompt: promptText,
    title: (payload as { title?: string | null }).title ?? item.title ?? null,
    transcriptText:
      (payload as { transcriptText?: string | null }).transcriptText ?? item.transcriptText ?? null,
    lyricsText: (payload as { lyricsText?: string | null }).lyricsText ?? item.lyricsText ?? null,
    musicMode:
      (payload as { musicMode?: WorkflowReloadMusicMode | null }).musicMode ??
      item.musicMode ??
      null,
    model: modelLabel,
    modelId: payload.modelId,
    provider: payload.provider,
    generationId: payload.generationId,
    savedMediaIds,
    sourceRef: payload.requestId,
    status: "ready",
    timestamp: "Just now",
    taskState: "success",
    resultUrls: payload.resultUrls,
    previewUrl: payload.previewUrl,
    previewStoragePath: payload.previewStoragePath,
    fullStoragePath: payload.fullStoragePath,
    companionArtUrl: payload.companionArtUrl,
    companionArtStoragePath: payload.companionArtStoragePath,
    companionArtStatus: payload.companionArtStatus,
    previewTier: "full",
    mimeType: payload.mimeType,
    audioSourceMode,
    durationMs: payload.durationMs,
    waveformPeaks: payload.waveformPeaks,
    mediaSource: "generated",
    localObjectUrl: null,
    saveState: resolveGeneratedOutputSaveState(payload),
    saveError: sanitizeCustomerFacingProviderText(payload.saveError, "") || null,
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
  }));
};

/**
 * Returns AI Studio audio generation handlers and loading state for Music, Sound Effects, and Voices.
 */
export const useAiStudioAudioGeneration = ({
  projectId = null,
  workspaceRuntimeKey = null,
  outputs = [],
  setUiError,
  insertOptimisticGenerationPlaceholder,
  notifyGenerationFailure,
  updateOutputById,
  setOutputs,
}: UseAiStudioAudioGenerationParams) => {
  const [musicGenerationCount, setMusicGenerationCount] = useState(0);
  const [voicesGenerationCount, setVoicesGenerationCount] = useState(0);
  const [soundEffectsGenerationCount, setSoundEffectsGenerationCount] = useState(0);
  const musicIsGenerating = musicGenerationCount > 0;
  const voicesIsGenerating = voicesGenerationCount > 0;
  const soundEffectsIsGenerating = soundEffectsGenerationCount > 0;

  const handleVoicesGenerate = useCallback(
    async (request: VoicesGenerateRequest) => {
      const promptText = buildVoicesOutputPrompt(request).trim();
      if (!promptText) return;
      const requiredVisibleSlots =
        request.mode === "voice-changer" && request.source.extractedFrom ? 2 : 1;
      if (getReferenceGridAvailableSlots(outputs) < requiredVisibleSlots) {
        setUiError(REFERENCE_GRID_CAP_REACHED_MESSAGE);
        return;
      }

      setUiError(null);
      setVoicesGenerationCount((count) => count + 1);

      const optimisticOutputId = insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "audio",
        selectedToolOverride: request.mode === "voiceover" ? "text-to-speech" : "voice-changer",
        modelLabelOverride: buildVoicesOutputModelLabel(request),
        modelIdOverride: request.mode === "voiceover" ? request.config.model_id : request.modelId,
        providerOverride: "elevenlabs",
        submissionModeOverride: "direct-request",
      });

      if (!optimisticOutputId) {
        setVoicesGenerationCount((count) => Math.max(0, count - 1));
        return;
      }
      const workflowReload = buildVoiceWorkflowReload({ projectId, request });
      attachWorkflowReloadToAudioOutput({
        outputId: optimisticOutputId,
        updateOutputById,
        workflowReload,
      });

      try {
        const response =
          request.mode === "voiceover"
            ? await fetchWithAuth("/api/elevenlabs/text-to-speech", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  voiceId: request.voice.id,
                  voiceName: request.voice.name,
                  text: request.script,
                  outputFormat: request.outputFormat,
                  config: request.config,
                  shortpulse_context: buildAudioShortpulseContext({
                    selectedTool: "voiceover",
                    displayedBilledCredits: request.displayedBilledCredits,
                    pricingPolicyReady: request.pricingPolicyReady,
                    workspaceRuntimeKey: projectId ? null : workspaceRuntimeKey,
                  }),
                  ...(workflowReload ? { workflow_reload: workflowReload } : {}),
                  ...(projectId ? { project_id: projectId } : {}),
                }),
                shortpulseLogScope: "generation",
                shortpulseSkipErrorLogging: true,
              })
            : await (async () => {
                const formData = new FormData();
                formData.append("voiceId", request.voice.id);
                formData.append("voiceName", request.voice.name);
                formData.append("outputFormat", request.outputFormat);
                formData.append("modelId", request.modelId);
                formData.append("inputFormat", request.inputFormat);
                formData.append(
                  "removeBackgroundNoise",
                  request.removeBackgroundNoise ? "true" : "false"
                );
                formData.append("voiceSettings", JSON.stringify(request.voiceSettings));
                if (projectId) {
                  formData.append("project_id", projectId);
                }
                formData.append(
                  "shortpulseContext",
                  JSON.stringify(
                    buildAudioShortpulseContext({
                      selectedTool: "voice-changer",
                      displayedBilledCredits: request.displayedBilledCredits,
                      pricingPolicyReady: request.pricingPolicyReady,
                      workspaceRuntimeKey: projectId ? null : workspaceRuntimeKey,
                    })
                  )
                );
                if (workflowReload) {
                  formData.append("workflowReload", JSON.stringify(workflowReload));
                }
                formData.append(
                  "sourceName",
                  request.source.extractedFrom?.name ?? request.source.name
                );
                formData.append("sourceOrigin", request.source.origin);
                if (request.source.storagePath) {
                  formData.append("sourceStoragePath", request.source.storagePath);
                } else if (request.source.sourceUrl) {
                  formData.append("sourceUrl", request.source.sourceUrl);
                }
                if (request.source.extractedFrom?.storagePath) {
                  formData.append(
                    "originalVideoStoragePath",
                    request.source.extractedFrom.storagePath
                  );
                } else if (request.source.extractedFrom?.sourceUrl) {
                  formData.append("originalVideoSourceUrl", request.source.extractedFrom.sourceUrl);
                }
                if (request.source.extractedFrom?.name) {
                  formData.append("originalVideoName", request.source.extractedFrom.name);
                }
                if (request.source.extractedFrom?.mimeType) {
                  formData.append("originalVideoMimeType", request.source.extractedFrom.mimeType);
                }
                if (request.source.extractedFrom?.aspect) {
                  formData.append("originalVideoAspect", request.source.extractedFrom.aspect);
                }
                return await fetchWithAuth("/api/elevenlabs/speech-to-speech", {
                  method: "POST",
                  body: formData,
                  shortpulseLogScope: "generation",
                  shortpulseSkipErrorLogging: true,
                });
              })();

        const payload = (await response.json().catch(() => null)) as
          | VoicesGenerateSuccessResponse
          | AudioGenerateErrorResponse
          | null;

        if (!response.ok || !payload || !("output" in payload)) {
          const errorPayload = payload as AudioGenerateErrorResponse | null;
          const message = resolveAudioGenerateErrorMessage({ response, payload: errorPayload });
          notifyGenerationFailure(
            optimisticOutputId,
            message,
            sanitizeCustomerFacingProviderText(errorPayload?.details, message)
          );
          setUiError(message);
          return;
        }

        applyAudioOutputToPlaceholder({
          updateOutputById,
          outputId: optimisticOutputId,
          promptText,
          modelLabel: buildVoicesOutputModelLabel(request),
          payload: payload.output,
          audioSourceMode: request.mode,
        });

        if (request.mode === "voice-changer" && payload.remuxedVideo) {
          const remuxedVideoOutput = buildVoiceChangerRemuxedVideoOutput({
            request,
            payload: payload.remuxedVideo,
          });
          setOutputs((prev) => [
            remuxedVideoOutput,
            ...prev.filter((item) => item.id !== remuxedVideoOutput.id),
          ]);
        }
      } catch (error) {
        const message = sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Voice generation failed."
        );
        notifyGenerationFailure(optimisticOutputId, message, message);
        setUiError(message);
      } finally {
        setVoicesGenerationCount((count) => Math.max(0, count - 1));
      }
    },
    [
      insertOptimisticGenerationPlaceholder,
      notifyGenerationFailure,
      outputs,
      projectId,
      setOutputs,
      setUiError,
      updateOutputById,
      workspaceRuntimeKey,
    ]
  );

  const handleMusicGenerate = useCallback(
    async (request: MusicGenerateRequest) => {
      const promptText = request.text.trim();
      if (!promptText) return false;
      const { displayedBilledCredits, pricingPolicyReady = true } = request;
      const providerRequest = {
        text: request.text,
        lyrics: request.lyrics ?? "",
        durationSeconds: request.durationSeconds,
        bpm: request.bpm,
        mode: request.mode,
        structure: request.structure,
        energyPercent: request.energyPercent,
        outputFormat: request.outputFormat,
        modelId: request.modelId,
      };

      setUiError(null);
      setMusicGenerationCount((count) => count + 1);

      const optimisticOutputId = insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "audio",
        selectedToolOverride: "music",
        modelLabelOverride: buildMusicOutputModelLabel(),
        modelIdOverride: request.modelId,
        providerOverride: "elevenlabs",
        submissionModeOverride: "direct-request",
      });

      if (!optimisticOutputId) {
        setMusicGenerationCount((count) => Math.max(0, count - 1));
        return false;
      }
      const workflowReload = buildMusicWorkflowReload({ projectId, request });
      attachWorkflowReloadToAudioOutput({
        outputId: optimisticOutputId,
        updateOutputById,
        workflowReload,
      });

      try {
        const response = await fetchWithAuth("/api/elevenlabs/music", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...providerRequest,
            shortpulse_context: buildAudioShortpulseContext({
              selectedTool: "music",
              displayedBilledCredits,
              pricingPolicyReady,
              workspaceRuntimeKey: projectId ? null : workspaceRuntimeKey,
            }),
            ...(workflowReload ? { workflow_reload: workflowReload } : {}),
            ...(projectId ? { project_id: projectId } : {}),
          }),
          shortpulseLogScope: "generation",
          shortpulseSkipErrorLogging: true,
        });

        const payload = (await response.json().catch(() => null)) as
          | MusicGenerateSuccessResponse
          | AudioGenerateErrorResponse
          | null;

        if (!response.ok || !payload || !("output" in payload)) {
          const errorPayload = payload as AudioGenerateErrorResponse | null;
          const message = resolveAudioGenerateErrorMessage({ response, payload: errorPayload });
          notifyGenerationFailure(
            optimisticOutputId,
            message,
            sanitizeCustomerFacingProviderText(errorPayload?.details, message)
          );
          setUiError(message);
          return false;
        }

        applyAudioOutputToPlaceholder({
          updateOutputById,
          outputId: optimisticOutputId,
          promptText,
          modelLabel: buildMusicOutputModelLabel(),
          payload: payload.output,
          audioSourceMode: "music",
        });
        return true;
      } catch (error) {
        const message = sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Music generation failed."
        );
        notifyGenerationFailure(optimisticOutputId, message, message);
        setUiError(message);
        return false;
      } finally {
        setMusicGenerationCount((count) => Math.max(0, count - 1));
      }
    },
    [
      insertOptimisticGenerationPlaceholder,
      notifyGenerationFailure,
      projectId,
      setUiError,
      updateOutputById,
      workspaceRuntimeKey,
    ]
  );

  const handleSoundEffectsGenerate = useCallback(
    async (request: SoundEffectsGenerateRequest) => {
      const promptText = request.text.trim();
      if (!promptText) return;
      const { displayedBilledCredits, pricingPolicyReady = true, ...providerRequest } = request;

      setUiError(null);
      setSoundEffectsGenerationCount((count) => count + 1);

      const optimisticOutputId = insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "audio",
        selectedToolOverride: "sound-effects",
        modelLabelOverride: buildSoundEffectsOutputModelLabel(),
        modelIdOverride: request.modelId,
        providerOverride: "elevenlabs",
        submissionModeOverride: "direct-request",
      });

      if (!optimisticOutputId) {
        setSoundEffectsGenerationCount((count) => Math.max(0, count - 1));
        return;
      }
      const workflowReload = buildSoundEffectsWorkflowReload({ projectId, request });
      attachWorkflowReloadToAudioOutput({
        outputId: optimisticOutputId,
        updateOutputById,
        workflowReload,
      });

      try {
        const response = await fetchWithAuth("/api/elevenlabs/sound-effects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...providerRequest,
            shortpulse_context: buildAudioShortpulseContext({
              selectedTool: "sound-effects",
              displayedBilledCredits,
              pricingPolicyReady,
              workspaceRuntimeKey: projectId ? null : workspaceRuntimeKey,
            }),
            ...(workflowReload ? { workflow_reload: workflowReload } : {}),
            ...(projectId ? { project_id: projectId } : {}),
          }),
          shortpulseLogScope: "generation",
          shortpulseSkipErrorLogging: true,
        });

        const payload = (await response.json().catch(() => null)) as
          | SoundEffectsGenerateSuccessResponse
          | AudioGenerateErrorResponse
          | null;

        if (!response.ok || !payload || !("output" in payload)) {
          const errorPayload = payload as AudioGenerateErrorResponse | null;
          const message = resolveAudioGenerateErrorMessage({ response, payload: errorPayload });
          notifyGenerationFailure(
            optimisticOutputId,
            message,
            sanitizeCustomerFacingProviderText(errorPayload?.details, message)
          );
          setUiError(message);
          return;
        }

        applyAudioOutputToPlaceholder({
          updateOutputById,
          outputId: optimisticOutputId,
          promptText,
          modelLabel: buildSoundEffectsOutputModelLabel(),
          payload: payload.output,
          audioSourceMode: "sound-effects",
        });
      } catch (error) {
        const message = sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Sound effect generation failed."
        );
        notifyGenerationFailure(optimisticOutputId, message, message);
        setUiError(message);
      } finally {
        setSoundEffectsGenerationCount((count) => Math.max(0, count - 1));
      }
    },
    [
      insertOptimisticGenerationPlaceholder,
      notifyGenerationFailure,
      projectId,
      setUiError,
      updateOutputById,
      workspaceRuntimeKey,
    ]
  );

  return {
    musicIsGenerating,
    voicesIsGenerating,
    soundEffectsIsGenerating,
    handleVoicesGenerate,
    handleMusicGenerate,
    handleSoundEffectsGenerate,
  };
};
