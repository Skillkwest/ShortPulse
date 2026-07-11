/**
 * AI Studio runtime controller composition.
 * Bridges generation/runtime authority with session snapshot authority for the state hook.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AiStudioKlingElement } from "../logic/klingElements";
import { resolvePulseRuntimeState } from "../logic/pulseSessionState";
import type { ReferenceProjectionState } from "../reference-projections";
import type {
  LipSyncAudioState,
  StudioMode,
  StudioOutput,
  ToolId,
  VideoReferenceMode,
  WorkflowReloadConfigV1,
} from "../types";
import type { RerollPricingEvidence } from "../logic/rerollPricingEvidence";
import type { ReferenceSelectionAuthorityStateSeed } from "./useAiStudioReferenceSelectionState";
import { useAiStudioGenerationRuntimeControllers } from "./useAiStudioGenerationRuntimeControllers";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioSessionSnapshotController } from "./useAiStudioSessionSnapshotController";

type UseAiStudioStateRuntimeControllersParams = {
  activeOutputId: string | null;
  activeOutputPreviewUrl: string | null;
  archivedOutputs: StudioOutput[];
  aspect: string;
  createPrompts: {
    standard: string;
    pulse: string;
  };
  createRuntime: {
    kind: "standard" | "pulse";
    prompt: string;
    activePulsePresetId: string | null;
    pulseSessionInstanceId: string | null;
  };
  curatedReferenceIds: string[];
  editReferenceText: string;
  extraImageUrls: readonly (string | null)[];
  findOutputById: (id: string) => StudioOutput | null;
  imageResolution: string;
  klingCfgScale: number;
  klingElements: AiStudioKlingElement[];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingNegativePrompt: string;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingWorkflowMode: "single" | "multi" | "custom";
  markReferenceGridReady: (outputId: string) => void;
  mode: StudioMode;
  model: string | null;
  motionReferenceVideoUrl: string | null;
  lipSyncAudio: LipSyncAudioState;
  lipSyncTurboMode: boolean;
  notifyGenerationFailure: ReturnType<typeof useAiStudioOutputLifecycle>["notifyGenerationFailure"];
  outputs: StudioOutput[];
  projectId: string | null;
  workspaceRuntimeKey?: string | null;
  referenceImageUrl: string | null;
  removedFromAllRefsIds: string[];
  resolveReferenceInputsForTool: (tool: ToolId | null) => {
    referenceImageUrl: string | null;
    extraImageUrls: readonly (string | null)[];
  };
  resolveRerollPricingEvidence?: (config: WorkflowReloadConfigV1) => RerollPricingEvidence | null;
  seedance2InputMode: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceAudioUrls: string[];
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  selectedStyleContext: StudioOutput["styleContext"] | null;
  selectedStylePrompt: string | null;
  selectedTool: ToolId | null;
  sessionHydrationSigningRevisionRef: MutableRefObject<number>;
  setActivePulsePresetId: Dispatch<SetStateAction<string | null>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setAspect: Dispatch<SetStateAction<string>>;
  setEditReferenceText: (value: string) => void;
  setExpertCreateMode: Dispatch<SetStateAction<"standard" | "pulse">>;
  setExtraImageUrl: (index: number, value: string | null) => void;
  setImageReferenceImageUrl: (value: string | null) => void;
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
  setMode: Dispatch<SetStateAction<StudioMode>>;
  setModel: (value: string | null) => void;
  setMotionReferenceVideoUrl: Dispatch<SetStateAction<string | null>>;
  setOutputCollectionsForCreateMode: (
    createMode: "standard" | "pulse",
    activeRows: StudioOutput[],
    archivedRows: StudioOutput[]
  ) => void;
  setOutputs: (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => void;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  beginPanelGeneration: (panel: "create" | "edit" | "video") => void;
  endPanelGeneration: (panel: "create" | "edit" | "video") => void;
  setPulseCreatePrompt: (value: string) => void;
  setPulseSessionInstanceId: Dispatch<SetStateAction<string | null>>;
  setReferenceImageUrl: (value: string | null) => void;
  setReferenceSelectionStateForCreateMode: (
    createMode: "standard" | "pulse",
    nextState: ReferenceSelectionAuthorityStateSeed
  ) => void;
  getReferenceSelectionStateForCreateMode: (
    createMode: "standard" | "pulse"
  ) => ReferenceSelectionAuthorityStateSeed;
  setRuntimeUiStateForCreateMode: (
    createMode: "standard" | "pulse",
    nextState: {
      activeOutputId: string | null;
      referenceProjectionState: ReferenceProjectionState;
      saved: boolean;
    }
  ) => void;
  setSaved: Dispatch<SetStateAction<boolean>>;
  setSeedance2InputMode: Dispatch<
    SetStateAction<"text" | "first-frame" | "first-last" | "multimodal">
  >;
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  setSelectedTool: Dispatch<SetStateAction<ToolId | null>>;
  setStandardCreatePrompt: (value: string) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  setVideoReferenceMode: Dispatch<SetStateAction<VideoReferenceMode>>;
  setLipSyncAudio: Dispatch<SetStateAction<LipSyncAudioState>>;
  setLipSyncTurboMode: Dispatch<SetStateAction<boolean>>;
  setVideoReferenceText: (value: string) => void;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  updateOutputById: ReturnType<typeof useAiStudioOutputLifecycle>["updateOutputById"];
  useReferenceImageIndicator: boolean;
  videoAutoFix: boolean;
  videoCameraFixed: boolean;
  videoDurationSeconds: number;
  videoGenerateAudio: boolean;
  videoReferenceImageUrl: string | null;
  videoReferenceMode: VideoReferenceMode;
  videoReferenceText: string;
  videoResolution: string;
  ensureGenerationRecord: ReturnType<
    typeof useAiStudioPersistenceActions
  >["ensureGenerationRecord"];
};

export const useAiStudioStateRuntimeControllers = ({
  activeOutputId,
  activeOutputPreviewUrl,
  archivedOutputs,
  aspect,
  createPrompts,
  createRuntime,
  curatedReferenceIds,
  editReferenceText,
  extraImageUrls,
  findOutputById,
  imageResolution,
  klingCfgScale,
  klingElements,
  klingMultiPrompts,
  klingNegativePrompt,
  klingShotType,
  klingVoiceIds,
  klingWorkflowMode,
  markReferenceGridReady,
  mode,
  model,
  motionReferenceVideoUrl,
  lipSyncAudio,
  lipSyncTurboMode,
  notifyGenerationFailure,
  outputs,
  projectId,
  workspaceRuntimeKey = null,
  referenceImageUrl,
  removedFromAllRefsIds,
  resolveReferenceInputsForTool,
  resolveRerollPricingEvidence,
  seedance2InputMode,
  seedance2ReferenceAudioUrls,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
  selectedStyleContext,
  selectedStylePrompt,
  selectedTool,
  sessionHydrationSigningRevisionRef,
  setActivePulsePresetId,
  setArchivedOutputs,
  setAspect,
  setEditReferenceText,
  setExpertCreateMode,
  setExtraImageUrl,
  setImageReferenceImageUrl,
  setImageResolution,
  setKlingCfgScale,
  setKlingElements,
  setKlingMultiPrompts,
  setKlingNegativePrompt,
  setKlingShotType,
  setKlingVoiceIds,
  setKlingWorkflowMode,
  setMode,
  setModel,
  setMotionReferenceVideoUrl,
  setOutputCollectionsForCreateMode,
  setOutputs,
  setOutputsState,
  beginPanelGeneration,
  endPanelGeneration,
  setPulseCreatePrompt,
  setPulseSessionInstanceId,
  setReferenceImageUrl,
  setReferenceSelectionStateForCreateMode,
  getReferenceSelectionStateForCreateMode,
  setRuntimeUiStateForCreateMode,
  setSaved,
  setSeedance2InputMode,
  setSeedance2ReferenceAudioUrls,
  setSeedance2ReferenceImageUrls,
  setSeedance2ReferenceVideoUrls,
  setSeedance2ReturnLastFrame,
  setSeedance2WebSearch,
  setSelectedTool,
  setStandardCreatePrompt,
  setUiError,
  setUiNotice,
  setVideoAutoFix,
  setVideoCameraFixed,
  setVideoDurationSeconds,
  setVideoGenerateAudio,
  setVideoReferenceMode,
  setLipSyncAudio,
  setLipSyncTurboMode,
  setVideoReferenceText,
  setVideoResolution,
  updateOutputById,
  useReferenceImageIndicator,
  videoAutoFix,
  videoCameraFixed,
  videoDurationSeconds,
  videoGenerateAudio,
  videoReferenceImageUrl,
  videoReferenceMode,
  videoReferenceText,
  videoResolution,
  ensureGenerationRecord,
}: UseAiStudioStateRuntimeControllersParams) => {
  const pulseWorkspaceState = resolvePulseRuntimeState({
    expertCreateMode: createRuntime.kind,
    activePulsePresetId: createRuntime.activePulsePresetId,
    pulseSessionInstanceId: createRuntime.pulseSessionInstanceId,
  });

  const {
    handleReferenceOutputMediaLoaded,
    generateOutput,
    regenerateOutput,
    rerollOutputFromReplay,
    rerollStudioOutputFromReplay,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    retryOutputStatus,
    abandonTaskOutput,
  } = useAiStudioGenerationRuntimeControllers({
    activeOutputPreviewUrl,
    aspect,
    editReferenceText,
    findOutputById,
    imageResolution,
    klingCfgScale,
    klingElements,
    klingMultiPrompts,
    klingNegativePrompt,
    klingShotType,
    klingVoiceIds,
    klingWorkflowMode,
    markReferenceGridReady,
    mode,
    model,
    motionReferenceVideoUrl,
    lipSyncAudio,
    lipSyncTurboMode,
    notifyGenerationFailure,
    outputs,
    projectId,
    workspaceRuntimeKey,
    prompt: createRuntime.prompt,
    resolveReferenceInputsForTool,
    resolveRerollPricingEvidence,
    seedance2InputMode,
    seedance2ReferenceAudioUrls,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
    selectedStyleContext,
    selectedStylePrompt,
    selectedTool,
    setImageReferenceImageUrl,
    setOutputs,
    beginPanelGeneration,
    endPanelGeneration,
    setSaved,
    setUiError,
    setUiNotice,
    updateOutputById,
    useReferenceImageIndicator,
    videoAutoFix,
    videoCameraFixed,
    videoDurationSeconds,
    videoGenerateAudio,
    videoReferenceImageUrl,
    videoReferenceMode,
    videoReferenceText,
    videoResolution,
    ensureGenerationRecord,
  });

  const { hydrateFromSessionSnapshot, buildSessionSnapshot, buildProjectWorkspaceSnapshot } =
    useAiStudioSessionSnapshotController({
      mode,
      selectedTool,
      standardCreatePrompt: createPrompts.standard,
      pulseCreatePrompt: createPrompts.pulse,
      model,
      aspect,
      pulseWorkspaceState,
      referenceImageUrl,
      extraImageUrls,
      editReferenceText,
      videoReferenceText,
      videoReferenceMode,
      videoDurationSeconds,
      videoResolution,
      imageResolution,
      videoGenerateAudio,
      videoCameraFixed,
      videoAutoFix,
      klingNegativePrompt,
      klingCfgScale,
      klingWorkflowMode,
      seedance2InputMode,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReferenceAudioUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingShotType,
      klingVoiceIds,
      klingMultiPrompts,
      klingElements,
      motionReferenceVideoUrl,
      lipSyncAudio,
      setLipSyncAudio,
      lipSyncTurboMode,
      setLipSyncTurboMode,
      outputs,
      archivedOutputs,
      activeOutputId,
      curatedReferenceIds,
      removedFromAllRefsIds,
      sessionHydrationSigningRevisionRef,
      setMode,
      setSelectedTool,
      setStandardCreatePrompt,
      setPulseCreatePrompt,
      setModel,
      setAspect,
      setExpertCreateMode,
      setActivePulsePresetId,
      setPulseSessionInstanceId,
      setReferenceImageUrl,
      setReferenceSelectionStateForCreateMode,
      getReferenceSelectionStateForCreateMode,
      setExtraImageUrl,
      setEditReferenceText,
      setVideoReferenceText,
      setVideoReferenceMode,
      setVideoDurationSeconds,
      setVideoResolution,
      setImageResolution,
      setVideoGenerateAudio,
      setVideoCameraFixed,
      setVideoAutoFix,
      setKlingNegativePrompt,
      setKlingCfgScale,
      setKlingWorkflowMode,
      setSeedance2InputMode,
      setSeedance2ReferenceImageUrls,
      setSeedance2ReferenceVideoUrls,
      setSeedance2ReferenceAudioUrls,
      setSeedance2ReturnLastFrame,
      setSeedance2WebSearch,
      setKlingShotType,
      setKlingVoiceIds,
      setKlingMultiPrompts,
      setKlingElements,
      setMotionReferenceVideoUrl,
      setOutputCollectionsForCreateMode,
      setOutputsState,
      setArchivedOutputs,
      setRuntimeUiStateForCreateMode,
    });

  return {
    buildProjectWorkspaceSnapshot,
    buildSessionSnapshot,
    generateOutput,
    handleReferenceOutputMediaLoaded,
    hydrateFromSessionSnapshot,
    insertOptimisticGenerationPlaceholder,
    pulseWorkspaceState,
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
    rerollOutputFromReplay,
    rerollStudioOutputFromReplay,
    retryOutputStatus,
    abandonTaskOutput,
  };
};
