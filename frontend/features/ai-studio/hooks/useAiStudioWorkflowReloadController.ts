/**
 * AI Studio workflow reload controller.
 * Navigates to the originating workflow and hydrates generation-critical state without submitting.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { InternalMediaRef } from "../../../lib/media/internalMediaRefs";
import type { VoiceChangerSource } from "../components/VoiceChangerSourceDropzone";
import {
  canReloadWorkflowOutput,
  resolveWorkflowReloadConfigForOutput,
} from "../logic/workflowReload";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type {
  StudioOutput,
  ToolId,
  WorkflowReloadConfigV1,
  WorkflowReloadCreateMode,
  WorkflowReloadImagePayload,
  WorkflowReloadMusicComposerMode,
  WorkflowReloadMusicSongBatchCount,
  WorkflowReloadSoundEffectsPayload,
  WorkflowReloadVideoPayload,
  WorkflowReloadVoiceChangerPayload,
  WorkflowReloadVoiceChangerSource,
  WorkflowReloadVoiceoverPayload,
} from "../types";
import type { ReferenceSelectionAuthorityStateSeed } from "./useAiStudioReferenceSelectionState";
import { useSharedVoicesGrid } from "./useSharedVoicesGrid";

export type WorkflowReloadResultStatus =
  | "success"
  | "output_not_found"
  | "invalid_metadata"
  | "unsupported_legacy_output"
  | "source_unavailable"
  | "voice_unavailable";

export type WorkflowReloadResult = {
  status: WorkflowReloadResultStatus;
  outputId: string;
  targetTool?: ToolId;
};

type SetReferenceSelectionState = (nextState: ReferenceSelectionAuthorityStateSeed) => void;

type UseAiStudioWorkflowReloadControllerParams = {
  beginManualWorkflowReload: () => void;
  findOutputById: (id: string) => StudioOutput | null;
  prepareStandardCreateWorkflowReload?: (prompt: string) => void;
  setAspect: Dispatch<SetStateAction<string>>;
  setEditReferenceText: (value: string) => void;
  setExpertCreateMode: Dispatch<SetStateAction<"standard" | "pulse">>;
  setImageResolution: Dispatch<SetStateAction<string>>;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  setKlingElements: Dispatch<SetStateAction<AiStudioKlingElement[]>>;
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  setKlingWorkflowMode: Dispatch<SetStateAction<"single" | "multi" | "custom">>;
  setModel: (value: string | null) => void;
  setMotionReferenceVideoUrl: Dispatch<SetStateAction<string | null>>;
  setMusicComposerMode: Dispatch<SetStateAction<WorkflowReloadMusicComposerMode>>;
  setMusicDurationSeconds: Dispatch<SetStateAction<number | null>>;
  setMusicLyricsDraft: (value: string) => void;
  setMusicPromptDraft: (value: string) => void;
  setMusicSingerEnabled: Dispatch<SetStateAction<boolean>>;
  setMusicSongBatchCount: Dispatch<SetStateAction<WorkflowReloadMusicSongBatchCount>>;
  setReferenceSelectionState: SetReferenceSelectionState;
  setSeedance2InputMode: Dispatch<
    SetStateAction<"text" | "first-frame" | "first-last" | "multimodal">
  >;
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  setSelectedTool: Dispatch<SetStateAction<ToolId | null>>;
  setShowCreateTools: Dispatch<SetStateAction<boolean>>;
  setSoundEffectsDurationSeconds: Dispatch<SetStateAction<number | null>>;
  setSoundEffectsLoopEnabled: Dispatch<SetStateAction<boolean>>;
  setSoundEffectsPromptDraft: (value: string) => void;
  setStandardCreatePrompt: (value: string) => void;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  setVideoReferenceMode: Dispatch<
    SetStateAction<"standard" | "modify" | "keyframes" | "kling3" | "motion">
  >;
  setVideoReferenceText: (value: string) => void;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  setVoiceChangerSource: (source: VoiceChangerSource | null) => void;
  setVoiceScriptDraft: (value: string) => void;
  setVoiceSelectedVoiceId: Dispatch<SetStateAction<string | null>>;
};

const RELOAD_MISSING_NOTICE =
  "Workflow reload is unavailable because original generation settings are missing.";
const RELOAD_SOURCE_NOTICE =
  "Workflow reload is unavailable because the original source media is no longer accessible.";
const RELOAD_VOICE_NOTICE =
  "Workflow reload is unavailable because the original voice is no longer available.";

const hasLocalOnlyReference = (
  referenceInputs: readonly string[],
  internalRefs: readonly unknown[]
) =>
  referenceInputs.some((input, index) => {
    if (!/^blob:|^data:/i.test(input)) return false;
    return !internalRefs[index];
  });

const toReferenceSelectionState = ({
  tool,
  referenceInputs,
  internalMediaRefs = [],
  motionReferenceVideoUrl = null,
}: {
  tool: ToolId;
  referenceInputs: readonly string[];
  internalMediaRefs?: Array<InternalMediaRef | null>;
  motionReferenceVideoUrl?: string | null;
}): ReferenceSelectionAuthorityStateSeed => ({
  selectedTool: tool,
  showCreateTools: tool === "create" || tool === "edit" || tool === "image",
  referenceImageUrl: referenceInputs[0] ?? null,
  extraImageUrls: [
    referenceInputs[1] ?? null,
    referenceInputs[2] ?? null,
    referenceInputs[3] ?? null,
  ],
  referenceImageInternalMediaRefs: internalMediaRefs.slice(0, 4),
  motionReferenceVideoUrl,
  useReferenceImageIndicator: referenceInputs.length > 0,
});

const resolveTargetTool = (config: WorkflowReloadConfigV1): ToolId => {
  if (config.payload.kind === "voiceover") return "text-to-speech";
  if (config.payload.kind === "voice-changer") return "voice-changer";
  if (config.payload.kind === "video") return config.originTool === "kling" ? "kling" : "video";
  return config.originTool;
};

const resolveCreateMode = (createMode: WorkflowReloadCreateMode | null | undefined) =>
  createMode === "pulse" ? "pulse" : "standard";

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

const normalizeVoiceChangerSourceOrigin = (
  source: WorkflowReloadVoiceChangerSource
): VoiceChangerSource["origin"] => {
  if (source.origin === "reference-grid") return "reference-grid";
  if (source.origin === "url") return "url";
  if (source.referenceOutputId || source.referenceMediaId) return "reference-grid";
  if (source.sourceUrl) return "url";
  return "local";
};

const buildVoiceChangerSource = (
  payload: WorkflowReloadVoiceChangerPayload
): VoiceChangerSource | null => {
  if (!hasVoiceChangerSourceAuthority(payload.source)) return null;
  const source = payload.source;
  const extracted = source.extractedFrom;
  return {
    id: `workflow-reload:${payload.voiceId}:${source.referenceOutputId ?? source.storagePath ?? source.sourceUrl ?? "source"}`,
    kind: "audio",
    origin: normalizeVoiceChangerSourceOrigin(source),
    status: "ready",
    aspect: null,
    durationMs: null,
    name: source.name ?? "Reloaded voice source",
    mimeType: source.mimeType ?? null,
    file: null,
    previewUrl: null,
    sourceUrl: source.sourceUrl ?? null,
    objectUrl: null,
    storagePath: source.storagePath ?? source.internalMediaRef?.storagePath ?? null,
    referenceOutputId: source.referenceOutputId ?? null,
    referenceMediaId: source.referenceMediaId ?? null,
    errorMessage: null,
    extractedFrom: extracted
      ? {
          kind: "video",
          name: extracted.name ?? source.name ?? "Reloaded source video",
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

const mapKlingElements = (
  elements: readonly Record<string, unknown>[] = []
): AiStudioKlingElement[] => elements.map((element) => ({ ...element }) as AiStudioKlingElement);

export const useAiStudioWorkflowReloadController = ({
  beginManualWorkflowReload,
  findOutputById,
  prepareStandardCreateWorkflowReload,
  setAspect,
  setEditReferenceText,
  setExpertCreateMode,
  setImageResolution,
  setKlingCfgScale,
  setKlingElements,
  setKlingMultiPrompts,
  setKlingNegativePrompt,
  setKlingShotType,
  setKlingVoiceIds,
  setKlingWorkflowMode,
  setModel,
  setMotionReferenceVideoUrl,
  setMusicComposerMode,
  setMusicDurationSeconds,
  setMusicLyricsDraft,
  setMusicPromptDraft,
  setMusicSingerEnabled,
  setMusicSongBatchCount,
  setReferenceSelectionState,
  setSeedance2InputMode,
  setSeedance2ReferenceAudioUrls,
  setSeedance2ReferenceImageUrls,
  setSeedance2ReferenceVideoUrls,
  setSeedance2ReturnLastFrame,
  setSeedance2WebSearch,
  setSelectedTool,
  setShowCreateTools,
  setSoundEffectsDurationSeconds,
  setSoundEffectsLoopEnabled,
  setSoundEffectsPromptDraft,
  setStandardCreatePrompt,
  setUiNotice,
  setVideoAutoFix,
  setVideoCameraFixed,
  setVideoDurationSeconds,
  setVideoGenerateAudio,
  setVideoReferenceMode,
  setVideoReferenceText,
  setVideoResolution,
  setVoiceChangerSource,
  setVoiceScriptDraft,
  setVoiceSelectedVoiceId,
}: UseAiStudioWorkflowReloadControllerParams) => {
  const { voices, setSelectedVoice } = useSharedVoicesGrid();

  const fail = useCallback(
    (
      status: WorkflowReloadResultStatus,
      outputId: string,
      notice: string
    ): WorkflowReloadResult => {
      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "workflow_reload_blocked",
        data: { output_id: outputId, status },
      });
      setUiNotice(notice);
      return { status, outputId };
    },
    [setUiNotice]
  );

  const reloadWorkflowFromStudioOutput = useCallback(
    (output: StudioOutput): WorkflowReloadResult => {
      const normalizedOutputId = output.id.trim();
      if (!canReloadWorkflowOutput(output)) {
        return fail(
          output.mediaSource === "generated" ? "unsupported_legacy_output" : "invalid_metadata",
          normalizedOutputId,
          RELOAD_MISSING_NOTICE
        );
      }

      const config = resolveWorkflowReloadConfigForOutput(output);
      if (!config) {
        return fail("invalid_metadata", normalizedOutputId, RELOAD_MISSING_NOTICE);
      }

      const targetTool = resolveTargetTool(config);
      const payload = config.payload;
      if (
        (payload.kind === "image" || payload.kind === "video") &&
        hasLocalOnlyReference(payload.referenceInputs, payload.internalMediaRefs ?? [])
      ) {
        return fail("source_unavailable", normalizedOutputId, RELOAD_SOURCE_NOTICE);
      }
      if (
        (payload.kind === "voiceover" || payload.kind === "voice-changer") &&
        !voices.some((voice) => voice.id === payload.voiceId)
      ) {
        return fail("voice_unavailable", normalizedOutputId, RELOAD_VOICE_NOTICE);
      }
      if (payload.kind === "voice-changer" && !buildVoiceChangerSource(payload)) {
        return fail("source_unavailable", normalizedOutputId, RELOAD_SOURCE_NOTICE);
      }

      beginManualWorkflowReload();
      setShowCreateTools(
        targetTool === "create" || targetTool === "edit" || targetTool === "image"
      );
      setSelectedTool(targetTool);
      setModel(config.model.id);

      if (payload.kind === "image") {
        const imagePayload: WorkflowReloadImagePayload = payload;
        const nextCreateMode = resolveCreateMode(config.createMode);
        setExpertCreateMode(nextCreateMode);
        if (targetTool === "create") {
          if (nextCreateMode === "standard") {
            prepareStandardCreateWorkflowReload?.(config.prompt.display);
          }
          setStandardCreatePrompt(config.prompt.display);
        } else {
          setEditReferenceText(config.prompt.display);
        }
        setAspect(imagePayload.aspect);
        setImageResolution(imagePayload.imageResolution ?? "model_default");
        setReferenceSelectionState(
          toReferenceSelectionState({
            tool: targetTool,
            referenceInputs: imagePayload.referenceInputs,
            internalMediaRefs: imagePayload.internalMediaRefs,
          })
        );
      }

      if (payload.kind === "video") {
        const videoPayload: WorkflowReloadVideoPayload = payload;
        setVideoReferenceText(config.prompt.display);
        setAspect(videoPayload.aspect);
        setVideoReferenceMode(videoPayload.videoReferenceMode);
        if (videoPayload.durationSeconds != null)
          setVideoDurationSeconds(videoPayload.durationSeconds);
        if (videoPayload.resolution) setVideoResolution(videoPayload.resolution);
        if (videoPayload.generateAudio != null) setVideoGenerateAudio(videoPayload.generateAudio);
        if (videoPayload.cameraFixed != null) setVideoCameraFixed(videoPayload.cameraFixed);
        if (videoPayload.autoFix != null) setVideoAutoFix(videoPayload.autoFix);
        setReferenceSelectionState(
          toReferenceSelectionState({
            tool: targetTool,
            referenceInputs: videoPayload.referenceInputs,
            internalMediaRefs: videoPayload.internalMediaRefs,
            motionReferenceVideoUrl: videoPayload.motionReferenceVideoUrl ?? null,
          })
        );
        setMotionReferenceVideoUrl(videoPayload.motionReferenceVideoUrl ?? null);
        if (videoPayload.seedance2InputMode) setSeedance2InputMode(videoPayload.seedance2InputMode);
        setSeedance2ReferenceImageUrls(videoPayload.seedance2ReferenceImageUrls ?? []);
        setSeedance2ReferenceVideoUrls(videoPayload.seedance2ReferenceVideoUrls ?? []);
        setSeedance2ReferenceAudioUrls(videoPayload.seedance2ReferenceAudioUrls ?? []);
        if (videoPayload.seedance2ReturnLastFrame != null) {
          setSeedance2ReturnLastFrame(videoPayload.seedance2ReturnLastFrame);
        }
        if (videoPayload.seedance2WebSearch != null) {
          setSeedance2WebSearch(videoPayload.seedance2WebSearch);
        }
        if (videoPayload.klingNegativePrompt != null) {
          setKlingNegativePrompt(videoPayload.klingNegativePrompt);
        }
        if (videoPayload.klingCfgScale != null) setKlingCfgScale(videoPayload.klingCfgScale);
        if (videoPayload.klingWorkflowMode) setKlingWorkflowMode(videoPayload.klingWorkflowMode);
        if (videoPayload.klingShotType) setKlingShotType(videoPayload.klingShotType);
        if (videoPayload.klingVoiceIds) setKlingVoiceIds(videoPayload.klingVoiceIds);
        setKlingMultiPrompts(videoPayload.klingMultiPrompts ?? []);
        setKlingElements(mapKlingElements(videoPayload.klingElements));
      }

      if (payload.kind === "music") {
        setMusicPromptDraft(payload.text);
        setMusicLyricsDraft(payload.lyrics ?? "");
        if (payload.durationSeconds != null) setMusicDurationSeconds(payload.durationSeconds);
        if (payload.composerMode) setMusicComposerMode(payload.composerMode);
        if (payload.singerEnabled != null) setMusicSingerEnabled(payload.singerEnabled);
        if (payload.songBatchCount) setMusicSongBatchCount(payload.songBatchCount);
      }

      if (payload.kind === "sound-effects") {
        const soundPayload: WorkflowReloadSoundEffectsPayload = payload;
        setSoundEffectsPromptDraft(soundPayload.text);
        if (soundPayload.durationSeconds != null) {
          setSoundEffectsDurationSeconds(soundPayload.durationSeconds);
        }
        if (soundPayload.loop != null) setSoundEffectsLoopEnabled(soundPayload.loop);
      }

      if (payload.kind === "voiceover") {
        const voicePayload: WorkflowReloadVoiceoverPayload = payload;
        setSelectedVoice(voicePayload.voiceId);
        setVoiceSelectedVoiceId(voicePayload.voiceId);
        setVoiceScriptDraft(voicePayload.script);
        setVoiceChangerSource(null);
      }

      if (payload.kind === "voice-changer") {
        const voiceChangerPayload: WorkflowReloadVoiceChangerPayload = payload;
        const source = buildVoiceChangerSource(voiceChangerPayload);
        if (!source) return fail("source_unavailable", normalizedOutputId, RELOAD_SOURCE_NOTICE);
        setSelectedVoice(voiceChangerPayload.voiceId);
        setVoiceSelectedVoiceId(voiceChangerPayload.voiceId);
        setVoiceChangerSource(source);
      }

      addBreadcrumb({
        type: "ui",
        level: "info",
        message: "workflow_reload_completed",
        data: {
          output_id: normalizedOutputId,
          target_tool: targetTool,
          payload_kind: payload.kind,
        },
      });
      return { status: "success", outputId: normalizedOutputId, targetTool };
    },
    [
      beginManualWorkflowReload,
      fail,
      prepareStandardCreateWorkflowReload,
      setAspect,
      setEditReferenceText,
      setExpertCreateMode,
      setImageResolution,
      setKlingCfgScale,
      setKlingElements,
      setKlingMultiPrompts,
      setKlingNegativePrompt,
      setKlingShotType,
      setKlingVoiceIds,
      setKlingWorkflowMode,
      setModel,
      setMotionReferenceVideoUrl,
      setMusicComposerMode,
      setMusicDurationSeconds,
      setMusicLyricsDraft,
      setMusicPromptDraft,
      setMusicSingerEnabled,
      setMusicSongBatchCount,
      setReferenceSelectionState,
      setSeedance2InputMode,
      setSeedance2ReferenceAudioUrls,
      setSeedance2ReferenceImageUrls,
      setSeedance2ReferenceVideoUrls,
      setSeedance2ReturnLastFrame,
      setSeedance2WebSearch,
      setSelectedTool,
      setSelectedVoice,
      setShowCreateTools,
      setSoundEffectsDurationSeconds,
      setSoundEffectsLoopEnabled,
      setSoundEffectsPromptDraft,
      setStandardCreatePrompt,
      setVideoAutoFix,
      setVideoCameraFixed,
      setVideoDurationSeconds,
      setVideoGenerateAudio,
      setVideoReferenceMode,
      setVideoReferenceText,
      setVideoResolution,
      setVoiceChangerSource,
      setVoiceScriptDraft,
      setVoiceSelectedVoiceId,
      voices,
    ]
  );

  const reloadWorkflowFromOutput = useCallback(
    (outputId: string): WorkflowReloadResult => {
      const normalizedOutputId = outputId.trim();
      const output = normalizedOutputId ? findOutputById(normalizedOutputId) : null;
      if (!output) {
        return fail("output_not_found", normalizedOutputId, RELOAD_MISSING_NOTICE);
      }
      return reloadWorkflowFromStudioOutput(output);
    },
    [fail, findOutputById, reloadWorkflowFromStudioOutput]
  );

  return { reloadWorkflowFromOutput, reloadWorkflowFromStudioOutput };
};
