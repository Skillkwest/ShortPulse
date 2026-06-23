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
  type ResolveWorkflowReloadConfigOptions,
  resolveWorkflowReloadConfigForOutput,
} from "../logic/workflowReload";
import type { AiStudioKlingElement } from "../logic/klingElements";
import {
  createEmptyExpertEditSecondaryImageUrls,
  MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT,
} from "../logic/expertEditReferenceSlots";
import { createLipSyncAudioStateFromDurableUrl } from "../logic/lipSyncAudioState";
import { registerInternalMediaRefsForUrls } from "../logic/referenceInputInternalMediaRegistry";
import type {
  LipSyncAudioState,
  StudioOutput,
  ToolId,
  WorkflowReloadConfigV1,
  WorkflowReloadCreateMode,
  WorkflowReloadImagePayload,
  WorkflowReloadMusicComposerMode,
  WorkflowReloadMusicSongBatchCount,
  WorkflowReloadSoundEffectsPayload,
  WorkflowReloadVideoMediaSlot,
  WorkflowReloadVideoPayload,
  WorkflowReloadVideoReferences,
  WorkflowReloadVoiceChangerPayload,
  WorkflowReloadVoiceChangerSource,
  WorkflowReloadVoiceoverPayload,
  VideoReferenceMode,
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
type SetReferenceSelectionStateForCreateMode = (
  createMode: "standard" | "pulse",
  nextState: ReferenceSelectionAuthorityStateSeed
) => void;

type ReloadReferenceSelectionInput = {
  referenceImageUrl: string | null;
  extraImageUrls: (string | null)[];
  referenceImageInternalMediaRefs: Array<InternalMediaRef | null>;
};

type UseAiStudioWorkflowReloadControllerParams = {
  beginManualWorkflowReload: () => void;
  findOutputById: (id: string) => StudioOutput | null;
  prepareCreateCharacterWorkflowReload?: (
    characterContext: StudioOutput["characterContext"] | null
  ) => void;
  prepareImageStyleWorkflowReload?: (styleContext: StudioOutput["styleContext"] | null) => void;
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
  setLipSyncAudio: Dispatch<SetStateAction<LipSyncAudioState>>;
  setLipSyncTurboMode: Dispatch<SetStateAction<boolean>>;
  setModel: (value: string | null) => void;
  setMotionReferenceVideoUrl: Dispatch<SetStateAction<string | null>>;
  setMusicComposerMode: Dispatch<SetStateAction<WorkflowReloadMusicComposerMode>>;
  setMusicDurationSeconds: Dispatch<SetStateAction<number | null>>;
  setMusicInstrumentalEnabled: Dispatch<SetStateAction<boolean>>;
  setMusicLyricsDraft: (value: string) => void;
  setMusicPromptDraft: (value: string) => void;
  setMusicSingerEnabled: Dispatch<SetStateAction<boolean>>;
  setMusicSongBatchCount: Dispatch<SetStateAction<WorkflowReloadMusicSongBatchCount>>;
  setReferenceSelectionState: SetReferenceSelectionState;
  setReferenceSelectionStateForCreateMode: SetReferenceSelectionStateForCreateMode;
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
  setVideoReferenceMode: Dispatch<SetStateAction<VideoReferenceMode>>;
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

const buildMappedExpertEditReferenceSelectionInput = ({
  referenceInputs,
  internalMediaRefs,
  expertEditReferences,
}: {
  referenceInputs: readonly string[];
  internalMediaRefs: Array<InternalMediaRef | null>;
  expertEditReferences: NonNullable<WorkflowReloadImagePayload["expertEditReferences"]>;
}): ReloadReferenceSelectionInput => {
  const primaryReferenceInputIndex = expertEditReferences.primaryReferenceInputIndex ?? 0;
  const extraImageUrls = createEmptyExpertEditSecondaryImageUrls();
  const referenceImageInternalMediaRefs: Array<InternalMediaRef | null> = Array.from(
    { length: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT + 1 },
    () => null
  );
  referenceImageInternalMediaRefs[0] = internalMediaRefs[primaryReferenceInputIndex] ?? null;
  expertEditReferences.restoreSecondarySlots?.forEach((slot) => {
    const url = slot.sourceUrl.trim();
    if (!url) return;
    extraImageUrls[slot.slotIndex] = url;
    referenceImageInternalMediaRefs[slot.slotIndex + 1] = slot.internalMediaRef ?? null;
  });
  expertEditReferences.secondarySlots.forEach((slot) => {
    const url = referenceInputs[slot.referenceInputIndex] ?? null;
    if (!url) return;
    extraImageUrls[slot.slotIndex] = url;
    referenceImageInternalMediaRefs[slot.slotIndex + 1] =
      slot.internalMediaRef ?? internalMediaRefs[slot.referenceInputIndex] ?? null;
  });
  registerInternalMediaRefsForUrls(
    [referenceInputs[primaryReferenceInputIndex] ?? referenceInputs[0] ?? null, ...extraImageUrls],
    referenceImageInternalMediaRefs
  );
  return {
    referenceImageUrl: referenceInputs[primaryReferenceInputIndex] ?? referenceInputs[0] ?? null,
    extraImageUrls,
    referenceImageInternalMediaRefs,
  };
};

const toReferenceSelectionState = ({
  tool,
  referenceInputs,
  internalMediaRefs = [],
  expertEditReferences,
  motionReferenceVideoUrl = null,
}: {
  tool: ToolId;
  referenceInputs: readonly string[];
  internalMediaRefs?: Array<InternalMediaRef | null>;
  expertEditReferences?: WorkflowReloadImagePayload["expertEditReferences"];
  motionReferenceVideoUrl?: string | null;
}): ReferenceSelectionAuthorityStateSeed => {
  const isImageTool = tool === "create" || tool === "edit" || tool === "image";
  const mappedImageRefs =
    isImageTool && expertEditReferences
      ? buildMappedExpertEditReferenceSelectionInput({
          referenceInputs,
          internalMediaRefs,
          expertEditReferences,
        })
      : null;
  const extraSlotCount = isImageTool ? MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT : 3;
  const legacyExtraImageUrls = Array.from(
    { length: extraSlotCount },
    (_, index) => referenceInputs[index + 1] ?? null
  );
  const referenceImageInternalMediaRefs = mappedImageRefs
    ? mappedImageRefs.referenceImageInternalMediaRefs
    : internalMediaRefs.slice(0, extraSlotCount + 1);
  return {
    selectedTool: tool,
    showCreateTools: isImageTool,
    referenceImageUrl: mappedImageRefs?.referenceImageUrl ?? referenceInputs[0] ?? null,
    extraImageUrls: mappedImageRefs?.extraImageUrls ?? legacyExtraImageUrls,
    referenceImageInternalMediaRefs,
    motionReferenceVideoUrl,
    useReferenceImageIndicator: referenceInputs.length > 0,
  };
};

const resolveTargetTool = (config: WorkflowReloadConfigV1): ToolId => {
  if (config.payload.kind === "voiceover") return "text-to-speech";
  if (config.payload.kind === "voice-changer") return "voice-changer";
  if (config.payload.kind === "video") return "video";
  return config.originTool;
};

const resolveCreateMode = (createMode: WorkflowReloadCreateMode | null | undefined) =>
  createMode === "pulse" ? "pulse" : "standard";

const resolveVoiceIdForReload = (
  requestedVoiceId: string,
  voices: ReturnType<typeof useSharedVoicesGrid>["voices"]
): string | null => {
  if (voices.some((voice) => voice.id === requestedVoiceId)) return requestedVoiceId;
  return (
    voices.find((voice) => voice.isFallback || voice.librarySection === "default")?.id ??
    voices[0]?.id ??
    null
  );
};

const resolveCreateImageCharacterContextForReload = (
  output: StudioOutput,
  payload: WorkflowReloadImagePayload
): StudioOutput["characterContext"] | null => {
  if (payload.characterContext?.applied) return payload.characterContext;
  if (output.characterContext?.applied) return output.characterContext;
  return null;
};

const resolveImageStyleContextForReload = (
  output: StudioOutput,
  payload: WorkflowReloadImagePayload
): StudioOutput["styleContext"] | null => {
  if (payload.styleContext?.applied) return payload.styleContext;
  if (output.styleContext?.applied) return output.styleContext;
  return null;
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

const mediaSlotsToUrls = (slots?: readonly WorkflowReloadVideoMediaSlot[]): string[] =>
  slots?.map((slot) => slot.sourceUrl) ?? [];

const splitReferenceImageUrls = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const registerVideoReferenceSlots = (
  videoReferences: WorkflowReloadVideoReferences | null | undefined
): void => {
  if (!videoReferences) return;
  const urls: Array<string | null> = [];
  const refs: Array<InternalMediaRef | null> = [];
  const push = (url: string | null | undefined, ref: InternalMediaRef | null | undefined) => {
    const normalizedUrl = typeof url === "string" ? url.trim() : "";
    if (!normalizedUrl) return;
    urls.push(normalizedUrl);
    refs.push(ref ?? null);
  };

  push(videoReferences.firstFrame?.sourceUrl, videoReferences.firstFrame?.internalMediaRef);
  push(videoReferences.lastFrame?.sourceUrl, videoReferences.lastFrame?.internalMediaRef);
  videoReferences.seedance2ReferenceImages?.forEach((slot) =>
    push(slot.sourceUrl, slot.internalMediaRef)
  );
  videoReferences.seedance2ReferenceVideos?.forEach((slot) =>
    push(slot.sourceUrl, slot.internalMediaRef)
  );
  videoReferences.seedance2ReferenceAudio?.forEach((slot) =>
    push(slot.sourceUrl, slot.internalMediaRef)
  );
  videoReferences.klingElementSlots?.forEach((slot) => {
    const element = slot.element;
    push(element.profileImageUrl as string | null | undefined, slot.profileImageInternalMediaRef);
    push(element.frontalImageUrl as string | null | undefined, slot.frontalImageInternalMediaRef);
    splitReferenceImageUrls(element.referenceImageUrls).forEach((url, index) => {
      push(url, slot.referenceImageInternalMediaRefs?.[index] ?? null);
    });
    push(element.videoUrl as string | null | undefined, slot.videoInternalMediaRef);
  });

  registerInternalMediaRefsForUrls(urls, refs);
};

const toVideoReferenceSelectionState = ({
  tool,
  videoPayload,
}: {
  tool: ToolId;
  videoPayload: WorkflowReloadVideoPayload;
}): ReferenceSelectionAuthorityStateSeed => {
  const videoReferences = videoPayload.videoReferences;
  if (!videoReferences) {
    return toReferenceSelectionState({
      tool,
      referenceInputs: videoPayload.referenceInputs,
      internalMediaRefs: videoPayload.internalMediaRefs,
      motionReferenceVideoUrl: videoPayload.motionReferenceVideoUrl ?? null,
    });
  }

  const referenceImageUrl =
    videoReferences.firstFrame?.sourceUrl ?? videoPayload.referenceInputs[0] ?? null;
  const lastFrameUrl =
    videoReferences.lastFrame?.sourceUrl ?? videoPayload.referenceInputs[1] ?? null;
  const extraImageUrls = [lastFrameUrl, null, null];
  const referenceImageInternalMediaRefs: Array<InternalMediaRef | null> = [
    videoReferences.firstFrame?.internalMediaRef ?? videoPayload.internalMediaRefs?.[0] ?? null,
    videoReferences.lastFrame?.internalMediaRef ?? videoPayload.internalMediaRefs?.[1] ?? null,
    null,
    null,
  ];
  registerInternalMediaRefsForUrls(
    [referenceImageUrl, ...extraImageUrls],
    referenceImageInternalMediaRefs
  );

  return {
    selectedTool: tool,
    showCreateTools: false,
    referenceImageUrl,
    extraImageUrls,
    referenceImageInternalMediaRefs,
    motionReferenceVideoUrl: videoPayload.motionReferenceVideoUrl ?? null,
    useReferenceImageIndicator: Boolean(referenceImageUrl || extraImageUrls.some(Boolean)),
  };
};

export const useAiStudioWorkflowReloadController = ({
  beginManualWorkflowReload,
  findOutputById,
  prepareCreateCharacterWorkflowReload,
  prepareImageStyleWorkflowReload,
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
  setLipSyncAudio,
  setLipSyncTurboMode,
  setModel,
  setMotionReferenceVideoUrl,
  setMusicComposerMode,
  setMusicDurationSeconds,
  setMusicInstrumentalEnabled,
  setMusicLyricsDraft,
  setMusicPromptDraft,
  setMusicSingerEnabled,
  setMusicSongBatchCount,
  setReferenceSelectionState,
  setReferenceSelectionStateForCreateMode,
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
    (
      output: StudioOutput,
      options: ResolveWorkflowReloadConfigOptions = {}
    ): WorkflowReloadResult => {
      const normalizedOutputId = output.id.trim();
      if (!canReloadWorkflowOutput(output, options)) {
        return fail(
          output.mediaSource === "generated" ? "unsupported_legacy_output" : "invalid_metadata",
          normalizedOutputId,
          RELOAD_MISSING_NOTICE
        );
      }

      const config = resolveWorkflowReloadConfigForOutput(output, options);
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
      const voiceReloadId =
        payload.kind === "voiceover" || payload.kind === "voice-changer"
          ? resolveVoiceIdForReload(payload.voiceId, voices)
          : null;
      if ((payload.kind === "voiceover" || payload.kind === "voice-changer") && !voiceReloadId) {
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

      if (payload.kind === "image") {
        setModel(config.model.id);
        const imagePayload: WorkflowReloadImagePayload = payload;
        const nextCreateMode = resolveCreateMode(config.createMode);
        prepareImageStyleWorkflowReload?.(resolveImageStyleContextForReload(output, imagePayload));
        setExpertCreateMode(nextCreateMode);
        if (targetTool === "create") {
          if (nextCreateMode === "standard") {
            prepareStandardCreateWorkflowReload?.(config.prompt.display);
            prepareCreateCharacterWorkflowReload?.(
              resolveCreateImageCharacterContextForReload(output, imagePayload)
            );
          }
          setStandardCreatePrompt(config.prompt.display);
        } else {
          setEditReferenceText(config.prompt.display);
        }
        setAspect(imagePayload.aspect);
        setImageResolution(imagePayload.imageResolution ?? "model_default");
        setReferenceSelectionStateForCreateMode(
          nextCreateMode,
          toReferenceSelectionState({
            tool: targetTool,
            referenceInputs: imagePayload.referenceInputs,
            internalMediaRefs: imagePayload.internalMediaRefs,
            expertEditReferences: imagePayload.expertEditReferences,
          })
        );
      }

      if (payload.kind === "video") {
        const videoPayload: WorkflowReloadVideoPayload = payload;
        const videoReferences = videoPayload.videoReferences;
        setModel(config.model.id);
        prepareImageStyleWorkflowReload?.(videoPayload.styleContext ?? output.styleContext ?? null);
        registerVideoReferenceSlots(videoReferences);
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
          toVideoReferenceSelectionState({ tool: targetTool, videoPayload })
        );
        setMotionReferenceVideoUrl(videoPayload.motionReferenceVideoUrl ?? null);
        if (videoPayload.seedance2InputMode) {
          setSeedance2InputMode(videoPayload.seedance2InputMode);
        }
        setSeedance2ReferenceImageUrls(
          videoReferences?.seedance2ReferenceImages
            ? mediaSlotsToUrls(videoReferences.seedance2ReferenceImages)
            : (videoPayload.seedance2ReferenceImageUrls ?? [])
        );
        setSeedance2ReferenceVideoUrls(
          videoReferences?.seedance2ReferenceVideos
            ? mediaSlotsToUrls(videoReferences.seedance2ReferenceVideos)
            : (videoPayload.seedance2ReferenceVideoUrls ?? [])
        );
        setSeedance2ReferenceAudioUrls(
          videoReferences?.seedance2ReferenceAudio
            ? mediaSlotsToUrls(videoReferences.seedance2ReferenceAudio)
            : (videoPayload.seedance2ReferenceAudioUrls ?? [])
        );
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
        setKlingElements(
          videoReferences?.klingElementSlots?.length
            ? mapKlingElements(videoReferences.klingElementSlots.map((slot) => slot.element))
            : mapKlingElements(videoPayload.klingElements)
        );
        if (videoPayload.videoReferenceMode === "lip-sync") {
          setLipSyncAudio(
            createLipSyncAudioStateFromDurableUrl({
              url: videoPayload.lipSyncAudioUrl ?? null,
              title: "Reloaded lip sync audio",
              durationMs: videoPayload.lipSyncAudioDurationMs ?? null,
              sourceKind: "reference",
              storagePath: videoPayload.lipSyncAudioStoragePath ?? null,
            })
          );
          if (videoPayload.lipSyncTurboMode != null) {
            setLipSyncTurboMode(videoPayload.lipSyncTurboMode);
          }
        }
      }

      if (payload.kind === "music") {
        setModel(config.model.id);
        setMusicPromptDraft(payload.prompt ?? payload.text);
        setMusicLyricsDraft(payload.lyrics ?? "");
        if (payload.durationSeconds != null) setMusicDurationSeconds(payload.durationSeconds);
        if (payload.composerMode) setMusicComposerMode(payload.composerMode);
        if (payload.instrumentalEnabled != null) {
          setMusicInstrumentalEnabled(payload.instrumentalEnabled);
        }
        if (payload.singerEnabled != null) setMusicSingerEnabled(payload.singerEnabled);
        if (payload.songBatchCount) setMusicSongBatchCount(payload.songBatchCount);
      }

      if (payload.kind === "sound-effects") {
        setModel(config.model.id);
        const soundPayload: WorkflowReloadSoundEffectsPayload = payload;
        setSoundEffectsPromptDraft(soundPayload.text);
        if (soundPayload.durationSeconds != null) {
          setSoundEffectsDurationSeconds(soundPayload.durationSeconds);
        }
        if (soundPayload.loop != null) setSoundEffectsLoopEnabled(soundPayload.loop);
      }

      if (payload.kind === "voiceover") {
        setModel(config.model.id);
        const voicePayload: WorkflowReloadVoiceoverPayload = payload;
        const nextVoiceId = voiceReloadId ?? voicePayload.voiceId;
        setSelectedVoice(nextVoiceId);
        setVoiceSelectedVoiceId(nextVoiceId);
        setVoiceScriptDraft(voicePayload.script);
        setVoiceChangerSource(null);
      }

      if (payload.kind === "voice-changer") {
        setModel(config.model.id);
        const voiceChangerPayload: WorkflowReloadVoiceChangerPayload = payload;
        const source = buildVoiceChangerSource(voiceChangerPayload);
        if (!source) return fail("source_unavailable", normalizedOutputId, RELOAD_SOURCE_NOTICE);
        const nextVoiceId = voiceReloadId ?? voiceChangerPayload.voiceId;
        setSelectedVoice(nextVoiceId);
        setVoiceSelectedVoiceId(nextVoiceId);
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
      prepareCreateCharacterWorkflowReload,
      prepareImageStyleWorkflowReload,
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
      setLipSyncAudio,
      setLipSyncTurboMode,
      setModel,
      setMotionReferenceVideoUrl,
      setMusicComposerMode,
      setMusicDurationSeconds,
      setMusicInstrumentalEnabled,
      setMusicLyricsDraft,
      setMusicPromptDraft,
      setMusicSingerEnabled,
      setMusicSongBatchCount,
      setReferenceSelectionState,
      setReferenceSelectionStateForCreateMode,
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
