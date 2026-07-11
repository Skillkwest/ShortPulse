/**
 * Audio reroll controller for AI Studio workflow metadata.
 * Reconstructs existing audio generation requests without hydrating panels.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { MusicGenerateRequest } from "../components/MusicPropertiesPanel";
import type { SoundEffectsGenerateRequest } from "../components/SoundEffectsPropertiesPanel";
import type { VoicesGenerateRequest } from "../components/VoicesPropertiesPanel";
import type { VoiceChangerSource } from "../components/VoiceChangerSourceDropzone";
import {
  buildVoiceChangerRequestSettings,
  buildVoiceoverRequestConfig,
  hardcodedVoiceChangerInputFormat,
  hardcodedVoiceOutputFormat,
  type ElevenVoiceoverRequestConfig,
} from "../utils/voiceAudioModelConfig";
import { canRerollOutput, resolveWorkflowRerollConfigForOutput } from "../logic/workflowReroll";
import type {
  StudioOutput,
  WorkflowReloadVoiceChangerPayload,
  WorkflowReloadVoiceChangerSource,
} from "../types";
import { useSharedVoicesGrid, type SharedVoiceOption } from "./useSharedVoicesGrid";

type UseAiStudioAudioRerollControllerParams = {
  findOutputById: (id: string) => StudioOutput | null;
  handleVoicesGenerate: (request: VoicesGenerateRequest) => Promise<void> | void;
  handleMusicGenerate: (request: MusicGenerateRequest) => Promise<boolean | void> | boolean | void;
  handleSoundEffectsGenerate: (request: SoundEffectsGenerateRequest) => Promise<void> | void;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
};

const REROLL_MISSING_NOTICE =
  "Re-roll is unavailable because original generation settings are missing.";
const REROLL_SOURCE_NOTICE =
  "Re-roll is unavailable because original reference media are no longer accessible.";
const REROLL_VOICE_NOTICE =
  "Re-roll is unavailable because the original voice is no longer available.";

const resolveVoiceForReroll = (
  requestedVoiceId: string,
  voices: readonly SharedVoiceOption[]
): SharedVoiceOption | null =>
  voices.find((voice) => voice.id === requestedVoiceId) ??
  voices.find((voice) => voice.isFallback || voice.librarySection === "default") ??
  voices[0] ??
  null;

const normalizeVoiceChangerSourceOrigin = (
  source: WorkflowReloadVoiceChangerSource
): VoiceChangerSource["origin"] => {
  if (source.origin === "reference-grid") return "reference-grid";
  if (source.origin === "url") return "url";
  if (source.referenceOutputId || source.referenceMediaId) return "reference-grid";
  if (source.sourceUrl) return "url";
  return "local";
};

const hasVoiceChangerSourceAuthority = (source: WorkflowReloadVoiceChangerSource): boolean =>
  Boolean(
    source.sourceUrl ||
    source.storagePath ||
    source.internalMediaRef ||
    source.referenceOutputId ||
    source.referenceMediaId ||
    source.extractedFrom?.sourceUrl ||
    source.extractedFrom?.storagePath ||
    source.extractedFrom?.internalMediaRef
  );

const buildVoiceChangerSource = (
  payload: WorkflowReloadVoiceChangerPayload
): VoiceChangerSource | null => {
  if (!hasVoiceChangerSourceAuthority(payload.source)) return null;
  const source = payload.source;
  const extracted = source.extractedFrom;
  return {
    id: `workflow-reroll:${payload.voiceId}:${source.referenceOutputId ?? source.storagePath ?? source.sourceUrl ?? "source"}`,
    kind: "audio",
    displayKind: extracted ? "video" : "audio",
    origin: normalizeVoiceChangerSourceOrigin(source),
    status: "ready",
    aspect: null,
    durationMs: null,
    name: source.name ?? "Re-rolled voice source",
    mimeType: source.mimeType ?? null,
    file: null,
    previewUrl: null,
    posterUrl: null,
    sourceUrl: source.sourceUrl ?? null,
    objectUrl: null,
    storagePath: source.storagePath ?? source.internalMediaRef?.storagePath ?? null,
    referenceOutputId: source.referenceOutputId ?? null,
    referenceMediaId: source.referenceMediaId ?? null,
    errorMessage: null,
    extractedFrom: extracted
      ? {
          kind: "video",
          name: extracted.name ?? source.name ?? "Re-rolled source video",
          mimeType: extracted.mimeType ?? null,
          previewUrl: extracted.sourceUrl ?? null,
          sourceUrl: extracted.sourceUrl ?? null,
          storagePath: extracted.storagePath ?? extracted.internalMediaRef?.storagePath ?? null,
          aspect: extracted.aspect ?? null,
          referenceOutputId: extracted.referenceOutputId ?? source.referenceOutputId ?? null,
          referenceMediaId: extracted.referenceMediaId ?? source.referenceMediaId ?? null,
        }
      : null,
  };
};

const resolveVoiceoverConfig = (
  rawConfig: Record<string, unknown> | undefined,
  modelId: string
): ElevenVoiceoverRequestConfig => {
  const fallback = buildVoiceoverRequestConfig();
  const candidate = rawConfig ?? {};
  return {
    ...fallback,
    ...candidate,
    model_id: typeof candidate.model_id === "string" ? candidate.model_id : modelId,
    voice_settings:
      candidate.voice_settings && typeof candidate.voice_settings === "object"
        ? {
            ...fallback.voice_settings,
            ...(candidate.voice_settings as Record<string, unknown>),
          }
        : fallback.voice_settings,
  } as ElevenVoiceoverRequestConfig;
};

/**
 * Returns an output-id reroll handler for workflow-backed audio outputs.
 */
export const useAiStudioAudioRerollController = ({
  findOutputById,
  handleVoicesGenerate,
  handleMusicGenerate,
  handleSoundEffectsGenerate,
  setUiNotice,
}: UseAiStudioAudioRerollControllerParams) => {
  const { voices } = useSharedVoicesGrid();

  const rerollAudioStudioOutputFromWorkflow = useCallback(
    (output: StudioOutput): boolean => {
      const normalizedOutputId = output.id.trim();
      if (!normalizedOutputId || !canRerollOutput(output, { mediaKindHint: "audio" })) {
        return false;
      }
      const config = resolveWorkflowRerollConfigForOutput(output, { mediaKindHint: "audio" });
      const payload = config?.payload;
      if (!config || !payload) {
        setUiNotice(REROLL_MISSING_NOTICE);
        return true;
      }

      if (payload.kind === "music") {
        void handleMusicGenerate({
          text: payload.text,
          rawPrompt: payload.prompt ?? payload.text,
          lyrics: payload.lyrics ?? "",
          durationSeconds: payload.durationSeconds,
          bpm: payload.bpm ?? 112,
          mode: payload.mode ?? "instrumental",
          structure: payload.structure ?? "loop",
          energyPercent: payload.energyPercent ?? 58,
          outputFormat: payload.outputFormat ?? "mp3_44100_128",
          composerMode: payload.composerMode ?? "simple",
          instrumentalEnabled: payload.instrumentalEnabled ?? payload.mode !== "vocal",
          singerEnabled: payload.singerEnabled ?? payload.mode === "vocal",
          songBatchCount: 1,
          modelId: config.model.id as MusicGenerateRequest["modelId"],
        });
        return true;
      }

      if (payload.kind === "sound-effects") {
        void handleSoundEffectsGenerate({
          text: payload.text,
          durationSeconds: payload.durationSeconds,
          loop: payload.loop ?? false,
          outputFormat: payload.outputFormat ?? "mp3_44100_128",
          modelId: config.model.id as SoundEffectsGenerateRequest["modelId"],
        });
        return true;
      }

      if (payload.kind === "voiceover") {
        const voice = resolveVoiceForReroll(payload.voiceId, voices);
        if (!voice) {
          setUiNotice(REROLL_VOICE_NOTICE);
          return true;
        }
        void handleVoicesGenerate({
          mode: "voiceover",
          voice,
          script: payload.script,
          outputFormat: payload.outputFormat || hardcodedVoiceOutputFormat,
          config: resolveVoiceoverConfig(payload.config, config.model.id),
        });
        return true;
      }

      if (payload.kind === "voice-changer") {
        const voice = resolveVoiceForReroll(payload.voiceId, voices);
        const source = buildVoiceChangerSource(payload);
        if (!voice) {
          setUiNotice(REROLL_VOICE_NOTICE);
          return true;
        }
        if (!source) {
          setUiNotice(REROLL_SOURCE_NOTICE);
          return true;
        }
        void handleVoicesGenerate({
          mode: "voice-changer",
          voice,
          source,
          outputFormat: payload.outputFormat || hardcodedVoiceOutputFormat,
          removeBackgroundNoise: payload.removeBackgroundNoise ?? false,
          modelId: payload.modelId,
          voiceSettings: {
            ...buildVoiceChangerRequestSettings(),
            ...(payload.voiceSettings ?? {}),
          },
          inputFormat: payload.inputFormat ?? hardcodedVoiceChangerInputFormat,
        });
        return true;
      }

      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "audio_reroll_blocked_unsupported_payload",
        data: { output_id: normalizedOutputId, payload_kind: payload.kind },
      });
      setUiNotice(REROLL_MISSING_NOTICE);
      return true;
    },
    [handleMusicGenerate, handleSoundEffectsGenerate, handleVoicesGenerate, setUiNotice, voices]
  );

  const rerollAudioOutputFromWorkflow = useCallback(
    (outputId: string): boolean => {
      const normalizedOutputId = outputId.trim();
      const output = normalizedOutputId ? findOutputById(normalizedOutputId) : null;
      return output ? rerollAudioStudioOutputFromWorkflow(output) : false;
    },
    [findOutputById, rerollAudioStudioOutputFromWorkflow]
  );

  return { rerollAudioOutputFromWorkflow, rerollAudioStudioOutputFromWorkflow };
};
