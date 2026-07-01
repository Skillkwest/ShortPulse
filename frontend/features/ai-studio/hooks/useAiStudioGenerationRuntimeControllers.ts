/**
 * AI Studio generation runtime controllers.
 * Owns submission, prompt composition, reroll, optimistic placeholders, and reference-output wiring.
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type {
  LipSyncAudioState,
  StudioMode,
  StudioOutput,
  ToolId,
  VideoReferenceMode,
} from "../types";
import { getDefaultDurationSecondsForModel } from "./aiStudioStateConfig";
import { useAiStudioGenerationPromptComposer } from "./useAiStudioGenerationPromptComposer";
import { useAiStudioOptimisticPlaceholderActions } from "./useAiStudioOptimisticPlaceholderActions";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioRerollController } from "./useAiStudioRerollController";
import { useAiStudioSubmissionReferenceResolver } from "./useAiStudioSubmissionReferenceResolver";
import { useAiStudioTaskOrchestration } from "./useAiStudioTaskOrchestration";

type UseAiStudioGenerationRuntimeControllersParams = {
  activeOutputPreviewUrl: string | null;
  aspect: string;
  editReferenceText: string;
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
  resolveReferenceInputsForTool: (tool: ToolId | null) => {
    referenceImageUrl: string | null;
    extraImageUrls: readonly (string | null)[];
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
  setImageReferenceImageUrl: (value: string | null) => void;
  setOutputs: (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => void;
  beginPanelGeneration: (panel: "create" | "edit" | "video") => void;
  endPanelGeneration: (panel: "create" | "edit" | "video") => void;
  setSaved: Dispatch<SetStateAction<boolean>>;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
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
  prompt: string;
};

/**
 * Returns generation-oriented runtime controllers used by AI Studio state.
 */
export const useAiStudioGenerationRuntimeControllers = ({
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
  workspaceRuntimeKey = null,
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
  prompt,
}: UseAiStudioGenerationRuntimeControllersParams) => {
  const { resolveSubmissionReferenceInputsForTool } = useAiStudioSubmissionReferenceResolver({
    resolveReferenceInputsForTool,
  });

  const { submitTask, onReferenceOutputMediaLoaded, retryOutputStatus, abandonTaskOutput } =
    useAiStudioTaskOrchestration({
      taskSubmissionConfig: {
        aspect,
        mode,
        projectId,
        workspaceRuntimeKey,
        model,
        prompt,
        selectedTool,
        imageResolution,
        videoDurationSeconds,
        videoResolution,
        videoGenerateAudio,
        videoReferenceMode,
        videoReferenceImageUrl,
        motionReferenceVideoUrl,
        lipSyncAudio,
        lipSyncTurboMode,
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
        beginPanelGeneration,
        endPanelGeneration,
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
    prompt,
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

  const { rerollOutputFromReplay, rerollStudioOutputFromReplay } = useAiStudioRerollController({
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
      outputs,
      setOutputs,
      setSaved,
      setUiError,
    });

  return {
    abandonTaskOutput,
    generateOutput,
    handleReferenceOutputMediaLoaded,
    insertOptimisticGenerationPlaceholder,
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
    rerollOutputFromReplay,
    rerollStudioOutputFromReplay,
    retryOutputStatus,
  };
};
