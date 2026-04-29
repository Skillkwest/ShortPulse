import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AiStudioKlingElement } from "../logic/klingElements";
import { resolvePulseRuntimeState } from "../logic/pulseSessionState";
import type { ReferenceProjectionState } from "../reference-projections";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import { getDefaultDurationSecondsForModel } from "./aiStudioStateConfig";
import { useAiStudioGenerationPromptComposer } from "./useAiStudioGenerationPromptComposer";
import { useAiStudioOptimisticPlaceholderActions } from "./useAiStudioOptimisticPlaceholderActions";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioRerollController } from "./useAiStudioRerollController";
import { useAiStudioSessionSnapshotController } from "./useAiStudioSessionSnapshotController";
import { useAiStudioSubmissionReferenceResolver } from "./useAiStudioSubmissionReferenceResolver";
import { useAiStudioTaskOrchestration } from "./useAiStudioTaskOrchestration";

type UseAiStudioStateRuntimeControllersParams = {
  activeOutputId: string | null;
  activeOutputPreviewUrl: string | null;
  activePulsePresetId: string | null;
  archivedOutputs: StudioOutput[];
  aspect: string;
  curatedReferenceIds: string[];
  editReferenceText: string;
  expertCreateMode: "standard" | "pulse";
  extraImageUrls: [string | null, string | null, string | null];
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
  notifyGenerationFailure: ReturnType<typeof useAiStudioOutputLifecycle>["notifyGenerationFailure"];
  outputs: StudioOutput[];
  projectId: string | null;
  pulsePrompt: string;
  pulseSessionInstanceId: string | null;
  referenceImageUrl: string | null;
  removedFromAllRefsIds: string[];
  resolveReferenceInputsForTool: (tool: ToolId | null) => {
    referenceImageUrl: string | null;
    extraImageUrls: [string | null, string | null, string | null];
  };
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
  setPanelGenerating: (panel: "create" | "edit" | "video", isGenerating: boolean) => void;
  setPulseCreatePrompt: (value: string) => void;
  setPulseSessionInstanceId: Dispatch<SetStateAction<string | null>>;
  setReferenceImageUrl: (value: string | null) => void;
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
  setVideoReferenceMode: Dispatch<
    SetStateAction<"standard" | "modify" | "keyframes" | "kling3" | "motion">
  >;
  setVideoReferenceText: (value: string) => void;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  standardPrompt: string;
  updateOutputById: ReturnType<typeof useAiStudioOutputLifecycle>["updateOutputById"];
  useReferenceImageIndicator: boolean;
  videoAutoFix: boolean;
  videoCameraFixed: boolean;
  videoDurationSeconds: number;
  videoGenerateAudio: boolean;
  videoReferenceImageUrl: string | null;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoReferenceText: string;
  videoResolution: string;
  ensureGenerationRecord: ReturnType<
    typeof useAiStudioPersistenceActions
  >["ensureGenerationRecord"];
};

export const useAiStudioStateRuntimeControllers = ({
  activeOutputId,
  activeOutputPreviewUrl,
  activePulsePresetId,
  archivedOutputs,
  aspect,
  curatedReferenceIds,
  editReferenceText,
  expertCreateMode,
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
  notifyGenerationFailure,
  outputs,
  projectId,
  pulsePrompt,
  pulseSessionInstanceId,
  referenceImageUrl,
  removedFromAllRefsIds,
  resolveReferenceInputsForTool,
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
  setPanelGenerating,
  setPulseCreatePrompt,
  setPulseSessionInstanceId,
  setReferenceImageUrl,
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
  setVideoReferenceText,
  setVideoResolution,
  standardPrompt,
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
  const { resolveSubmissionReferenceInputsForTool } = useAiStudioSubmissionReferenceResolver({
    resolveReferenceInputsForTool,
  });
  const pulseWorkspaceState = resolvePulseRuntimeState({
    expertCreateMode,
    activePulsePresetId,
    pulseSessionInstanceId,
  });
  const activeCreatePrompt = expertCreateMode === "pulse" ? pulsePrompt : standardPrompt;

  const { submitTask, onReferenceOutputMediaLoaded, retryOutputStatus, abandonTaskOutput } =
    useAiStudioTaskOrchestration({
      taskSubmissionConfig: {
        aspect,
        mode,
        projectId,
        model,
        prompt: activeCreatePrompt,
        selectedTool,
        imageResolution,
        videoDurationSeconds,
        videoResolution,
        videoGenerateAudio,
        videoReferenceMode,
        videoReferenceImageUrl,
        motionReferenceVideoUrl,
        videoCameraFixed,
        videoAutoFix,
        seedance2InputMode,
        seedance2ReferenceImageUrls,
        seedance2ReferenceVideoUrls,
        seedance2ReferenceAudioUrls,
        seedance2ReturnLastFrame,
        seedance2WebSearch,
        klingNegativePrompt,
        klingCfgScale,
        klingWorkflowMode,
        klingShotType,
        klingVoiceIds,
        klingMultiPrompts,
        klingElements,
        setPanelGenerating,
        setUiError,
        setUiNotice,
        setOutputs,
        setSaved,
        getDefaultDurationSeconds: getDefaultDurationSecondsForModel,
        notifyGenerationFailure,
        updateOutputById,
        ensureGenerationRecord,
      },
      outputs,
      findOutputById,
      setPrimaryEditReferenceImageUrl: setImageReferenceImageUrl,
      projectId,
    });

  const handleReferenceOutputMediaLoaded = useCallback(
    (outputId: string) => {
      onReferenceOutputMediaLoaded(outputId);
      markReferenceGridReady(outputId);
    },
    [markReferenceGridReady, onReferenceOutputMediaLoaded]
  );

  const { generateOutput, regenerateOutput } = useAiStudioGenerationPromptComposer({
    model,
    prompt: activeCreatePrompt,
    editReferenceText,
    videoReferenceText,
    selectedStylePrompt,
    selectedStyleContext,
    selectedTool,
    videoReferenceMode,
    useReferenceImageIndicator,
    activeOutputPreviewUrl,
    resolveReferenceInputsForTool: resolveSubmissionReferenceInputsForTool,
    submitTask,
  });

  const { rerollOutputFromReplay } = useAiStudioRerollController({
    findOutputById,
    setUiNotice,
    submitTask,
  });

  const { insertOptimisticGenerationPlaceholder, removeOptimisticGenerationPlaceholder } =
    useAiStudioOptimisticPlaceholderActions({
      mode,
      selectedTool,
      aspect,
      model,
      setOutputs,
      setSaved,
    });

  const { hydrateFromSessionSnapshot, buildSessionSnapshot } = useAiStudioSessionSnapshotController(
    {
      mode,
      selectedTool,
      prompt: activeCreatePrompt,
      standardCreatePrompt: standardPrompt,
      pulseCreatePrompt: pulsePrompt,
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
    }
  );

  return {
    buildSessionSnapshot,
    generateOutput,
    handleReferenceOutputMediaLoaded,
    hydrateFromSessionSnapshot,
    insertOptimisticGenerationPlaceholder,
    pulseWorkspaceState,
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
    rerollOutputFromReplay,
    retryOutputStatus,
    abandonTaskOutput,
  };
};
