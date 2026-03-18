/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput } from "../types";
import { resolvePreviewUrlById } from "../logic/stateParsers";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioOutputObjectUrlLifecycle } from "./useAiStudioOutputObjectUrlLifecycle";
import { useAiStudioGenerationPromptComposer } from "./useAiStudioGenerationPromptComposer";
import { useAiStudioAllowedModelOptions } from "./useAiStudioAllowedModelOptions";
import { useAiStudioOutputDerivations } from "./useAiStudioOutputDerivations";
import { useAiStudioReferenceIngestionActions } from "./useAiStudioReferenceIngestionActions";
import { useAiStudioReferenceProjectionEffects } from "./useAiStudioReferenceProjectionEffects";
import { useAiStudioReferenceGridStateActions } from "./useAiStudioReferenceGridStateActions";
import { useAiStudioReferenceSelectionState } from "./useAiStudioReferenceSelectionState";
import { useAiStudioTaskOrchestration } from "./useAiStudioTaskOrchestration";
import { useAiStudioWorkflowSettings } from "./useAiStudioWorkflowSettings";
import { useAiStudioStateEffects } from "./useAiStudioStateEffects";
import { useAiStudioOutputCollectionState } from "./useAiStudioOutputCollectionState";
import { useAiStudioOptimisticPlaceholderActions } from "./useAiStudioOptimisticPlaceholderActions";
import { useAiStudioOutputStoreSelectors } from "./useAiStudioOutputStoreSelectors";
import {
  DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT,
  getDefaultDurationSecondsForModel,
  hasStoredVideoPreferences,
  IMAGE_RESOLUTION_STORAGE_KEY,
  readSessionStorageNumberPreference,
  readSessionStorageStringPreference,
  REFERENCE_GRID_ACTIVE_LIMIT,
  REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT,
  REFERENCE_GRID_FLAG_SOFT_ARCHIVE,
  VIDEO_DURATION_STORAGE_KEY,
  VIDEO_RESOLUTION_STORAGE_KEY,
} from "./aiStudioStateConfig";
import { useAiStudioDeleteOutputController } from "./useAiStudioDeleteOutputController";
import { useAiStudioFastOutputAccess } from "./useAiStudioFastOutputAccess";
import { useAiStudioRerollController } from "./useAiStudioRerollController";
import { useAiStudioSessionSnapshotController } from "./useAiStudioSessionSnapshotController";
import { useAiStudioSessionReferenceDurability } from "./useAiStudioSessionReferenceDurability";
import { useAiStudioStableTextSetters } from "./useAiStudioStableTextSetters";
import { useAiStudioSubmissionReferenceResolver } from "./useAiStudioSubmissionReferenceResolver";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import {
  createEmptyReferenceProjectionState,
  type ReferenceProjectionState,
} from "../reference-projections";
/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
export const useAiStudioState = ({
  isCharacterModeEnabled = false,
  selectedStylePrompt = null,
  selectedStyleContext = null,
}: {
  isCharacterModeEnabled?: boolean;
  selectedStylePrompt?: string | null;
  selectedStyleContext?: StudioOutput["styleContext"] | null;
} = {}) => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [editReferenceText, setEditReferenceTextState] = useState<string>("");
  const [videoReferenceText, setVideoReferenceTextState] = useState<string>("");
  const [expertEditSessionState, setExpertEditSessionState] =
    useState<ExpertEditSessionState | null>(null);

  // Output management
  const {
    activeOutputState,
    setActiveOutputState,
    archivedOutputState,
    setArchivedOutputState,
    activeOutputByIdRef,
    outputs,
    archivedOutputs,
    activeOutputById,
    setOutputsState,
    setArchivedOutputs,
  } = useAiStudioOutputCollectionState();
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [referenceProjectionState, setReferenceProjectionState] =
    useState<ReferenceProjectionState>(createEmptyReferenceProjectionState);
  const referenceProjectionStateRef = useRef<ReferenceProjectionState>(referenceProjectionState);
  const curatedReferenceIds = referenceProjectionState.quickSlotIds;
  const removedFromAllRefsIds = referenceProjectionState.removedFromAllRefsIds;
  const [saved, setSaved] = useState(false);
  const pendingAutoSavesRef = useRef<Record<string, unknown>>({});
  const pendingFinalizeRemovalIdsRef = useRef<Set<string>>(new Set());
  const sessionHydrationSigningRevisionRef = useRef(0);
  const activeOutput = useMemo(
    () => (activeOutputId ? (activeOutputById[activeOutputId] ?? null) : null),
    [activeOutputById, activeOutputId]
  );
  // UI selections and references (tracked per workflow)
  const {
    selectedTool,
    setSelectedTool,
    showCreateTools,
    setShowCreateTools,
    videoReferenceImageUrl,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    useReferenceImageIndicator,
    setUseReferenceImageIndicator,
    detailOutputId,
    setDetailOutputId,
    referenceImageUrl,
    setReferenceImageUrl,
    setImageReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    clearReferenceImages,
    toggleReferenceIndicator,
    resolveReferenceInputsForTool,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    setIsModelModalOpen,
    setModelModalAnchor,
    openModelModal,
    closeModelModal,
  } = useAiStudioReferenceSelectionState({
    activeOutputPreviewUrl: activeOutput?.previewUrl ?? null,
  });

  const [videoReferenceMode, setVideoReferenceMode] = useState<
    "standard" | "keyframes" | "kling3" | "motion"
  >("standard");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(() =>
    readSessionStorageNumberPreference(VIDEO_DURATION_STORAGE_KEY, 6)
  );
  const [videoResolution, setVideoResolution] = useState<string>(() =>
    readSessionStorageStringPreference(VIDEO_RESOLUTION_STORAGE_KEY, "1080p")
  );
  const [imageResolution, setImageResolution] = useState<string>(() =>
    readSessionStorageStringPreference(IMAGE_RESOLUTION_STORAGE_KEY, "model_default")
  );
  const [hasUserVideoPrefs, setHasUserVideoPrefs] = useState<boolean>(hasStoredVideoPreferences);
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<boolean>(false);
  const [videoCameraFixed, setVideoCameraFixed] = useState<boolean>(false);
  const [videoAutoFix, setVideoAutoFix] = useState<boolean>(false);
  const [klingNegativePrompt, setKlingNegativePrompt] = useState<string>(
    "blur, distort, and low quality"
  );
  const [klingCfgScale, setKlingCfgScale] = useState<number>(0.5);
  const [klingShotType, setKlingShotType] = useState<"customize" | "intelligent">("customize");
  const [klingVoiceIds, setKlingVoiceIds] = useState<[string, string]>(["", ""]);
  const [klingMultiPrompts, setKlingMultiPrompts] = useState<
    { id: string; prompt: string; duration: number }[]
  >([]);
  const [klingElements, setKlingElements] = useState<
    { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
  >([{ id: randomId(), frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" }]);
  const [isPromptGenerating, setIsPromptGenerating] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const lastVideoReferenceModeRef = useRef(videoReferenceMode);
  const lastNonKling3VideoModelRef = useRef<string | null>(null);
  const lastNonKeyframesVideoModelRef = useRef<string | null>(null);
  const lastNonMotionVideoModelRef = useRef<string | null>(null);
  const { detailOutput, currentModelLabel, isPrimaryEditStageGenerating } =
    useAiStudioOutputDerivations({ outputs, activeOutputById, detailOutputId, model });
  const { hasPendingWorkflowRestore } = useAiStudioWorkflowSettings({
    selectedTool,
    mode,
    model,
    aspect,
    imageResolution,
    videoReferenceMode,
    videoDurationSeconds,
    videoResolution,
    videoGenerateAudio,
    videoCameraFixed,
    videoAutoFix,
    klingNegativePrompt,
    klingCfgScale,
    klingShotType,
    klingVoiceIds,
    klingMultiPrompts,
    klingElements,
    setMode,
    setModelState,
    setAspect,
    setImageResolution,
    setVideoReferenceMode,
    setVideoDurationSeconds,
    setVideoResolution,
    setVideoGenerateAudio,
    setVideoCameraFixed,
    setVideoAutoFix,
    setKlingNegativePrompt,
    setKlingCfgScale,
    setKlingShotType,
    setKlingVoiceIds,
    setKlingMultiPrompts,
    setKlingElements,
  });
  const { setSharedPrompt, setEditReferenceText, setVideoReferenceText } =
    useAiStudioStableTextSetters({
      setPrompt,
      setEditReferenceTextState,
      setVideoReferenceTextState,
    });
  const {
    archiveOlderOutputs,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    setOutputs,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    clearCuratedReferences,
    resetReferenceGridState,
  } = useAiStudioReferenceGridStateActions({
    activeOutputId,
    outputsLength: outputs.length,
    setActiveOutputId,
    setOutputsState,
    setArchivedOutputs,
    setReferenceProjectionState,
    pendingFinalizeRemovalIdsRef,
    config: {
      softArchiveEnabled: REFERENCE_GRID_FLAG_SOFT_ARCHIVE,
      activeLimit: REFERENCE_GRID_ACTIVE_LIMIT,
      archivePreviewKeepCount: REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT,
      defaultActiveLimit: DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT,
    },
  });
  const { findActiveOutputById, updateActiveOutputById } = useAiStudioFastOutputAccess({
    activeOutputByIdRef,
    setActiveOutputState,
  });

  const allowedModelOptions = useAiStudioAllowedModelOptions({
    selectedTool,
    videoReferenceMode,
    mode,
    isCharacterModeEnabled,
  });
  const allowedModelValues = useMemo(
    () => allowedModelOptions.map((option) => option.value),
    [allowedModelOptions]
  );

  const setModel = useCallback((value: string | null) => {
    setModelState(value);
  }, []);

  const getDefaultDurationSeconds = useCallback(
    (modelId: string | null) => getDefaultDurationSecondsForModel(modelId),
    []
  );

  useAiStudioStateEffects({
    promptRef,
    aspect,
    setAspect,
    activeOutputPreviewUrl: activeOutput?.previewUrl,
    setUseReferenceImageIndicator,
    model,
    selectedTool,
    videoReferenceMode,
    setVideoReferenceMode,
    setModel,
    lastVideoReferenceModeRef,
    lastNonKling3VideoModelRef,
    lastNonKeyframesVideoModelRef,
    lastNonMotionVideoModelRef,
    showCreateTools,
    setShowCreateTools,
    videoDurationStorageKey: VIDEO_DURATION_STORAGE_KEY,
    videoResolutionStorageKey: VIDEO_RESOLUTION_STORAGE_KEY,
    imageResolutionStorageKey: IMAGE_RESOLUTION_STORAGE_KEY,
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    imageResolution,
    setImageResolution,
    hasUserVideoPrefs,
    setHasUserVideoPrefs,
    setVideoGenerateAudio,
    allowedModelValues,
    isCharacterModeEnabled,
    mode,
    setDetailOutputId,
    setIsModelModalOpen,
    setModelModalAnchor,
    hasPendingWorkflowRestore,
  });

  useAiStudioReferenceProjectionEffects({
    referenceProjectionState,
    setReferenceProjectionState,
    referenceProjectionStateRef,
    activeOutputOrder: activeOutputState.order,
    archivedOutputOrder: archivedOutputState.order,
    curatedReferenceIds,
    setActiveOutputState,
    setArchivedOutputState,
    setOutputs,
  });

  useAiStudioOutputObjectUrlLifecycle({
    outputs,
    archivedOutputs,
  });
  useAiStudioSessionReferenceDurability({
    outputs,
    archivedOutputs,
    setOutputsState,
    setArchivedOutputs,
  });

  // --- Output + prompt actions -------------------------------------------
  const {
    updateOutputById,
    findOutputById,
    deleteOutput: deleteOutputFromLifecycle,
    notifyGenerationFailure,
    updateOutputPrompt,
  } = useAiStudioOutputLifecycle({
    outputs,
    setOutputs,
    updateOutputByIdFast: updateActiveOutputById,
    findOutputByIdFast: findActiveOutputById,
    activeOutputId,
    setActiveOutputId,
    pendingAutoSavesRef,
    setUiError,
  });
  const { deleteOutput } = useAiStudioDeleteOutputController({
    quickSlotIds: referenceProjectionState.quickSlotIds,
    setReferenceProjectionState,
    setActiveOutputId,
    deleteOutputFromLifecycle,
    pendingFinalizeRemovalIdsRef,
  });

  const {
    ensureGenerationRecord,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
  } = useAiStudioPersistenceActions({
    findOutputById,
    updateOutputById,
    setUiError,
    setOutputs,
    setSaved,
    activeOutputId,
    model,
    aspect,
    prompt,
  });

  const { submitTask, onReferenceOutputMediaLoaded, retryOutputStatus } =
    useAiStudioTaskOrchestration({
      taskSubmissionConfig: {
        aspect,
        mode,
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
        videoCameraFixed,
        videoAutoFix,
        klingNegativePrompt,
        klingCfgScale,
        klingShotType,
        klingVoiceIds,
        klingMultiPrompts,
        klingElements,
        setIsPromptGenerating,
        setUiError,
        setUiNotice,
        setOutputs,
        setSaved,
        getDefaultDurationSeconds,
        notifyGenerationFailure,
        updateOutputById,
        ensureGenerationRecord,
      },
      outputs,
      findOutputById,
      setPrimaryEditReferenceImageUrl: setImageReferenceImageUrl,
    });
  const { resolveSubmissionReferenceInputsForTool } = useAiStudioSubmissionReferenceResolver({
    resolveReferenceInputsForTool,
  });
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
    activeOutputPreviewUrl: activeOutput?.previewUrl ?? null,
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
      prompt,
      model,
      aspect,
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
      setSharedPrompt,
      setModel,
      setAspect,
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
      setKlingShotType,
      setKlingVoiceIds,
      setKlingMultiPrompts,
      setKlingElements,
      setMotionReferenceVideoUrl,
      setOutputsState,
      setArchivedOutputs,
      setReferenceProjectionState,
      setActiveOutputId,
      setSaved,
    }
  );

  const {
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    getAgentContext,
  } = useAiStudioReferenceIngestionActions({
    mode,
    aspect,
    model,
    setOutputs,
    setSharedPrompt,
    setUiError,
  });

  const {
    selectActiveOutputs,
    selectArchivedOutputs,
    getOutputById,
    subscribeOutputs,
    getOutputSnapshot,
    selectOutputById,
  } = useAiStudioOutputStoreSelectors({
    outputs,
    archivedOutputs,
  });

  return {
    isPromptGenerating,
    isPrimaryEditStageGenerating,
    promptRef,
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModel,
    currentModelLabel,
    prompt,
    setPrompt,
    outputs,
    outputOrder: activeOutputState.order,
    outputById: activeOutputState.byId,
    setOutputs,
    resetReferenceGridState,
    curatedReferenceIds,
    removedFromAllRefsIds,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    clearCuratedReferences,
    archivedOutputs,
    archivedOutputOrder: archivedOutputState.order,
    archivedOutputById: archivedOutputState.byId,
    selectActiveOutputs,
    selectArchivedOutputs,
    selectOutputById,
    getOutputById,
    subscribeOutputs,
    getOutputSnapshot,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    saved,
    setSaved,
    selectedTool,
    setSelectedTool,
    showCreateTools,
    setShowCreateTools,
    referenceImageUrl,
    setReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    videoReferenceMode,
    setVideoReferenceMode,
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    imageResolution,
    setImageResolution,
    videoGenerateAudio,
    setVideoGenerateAudio,
    videoCameraFixed,
    setVideoCameraFixed,
    videoAutoFix,
    setVideoAutoFix,
    klingNegativePrompt,
    setKlingNegativePrompt,
    klingCfgScale,
    setKlingCfgScale,
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    editReferenceText,
    setEditReferenceText,
    videoReferenceText,
    setVideoReferenceText,
    expertEditSessionState,
    setExpertEditSessionState,
    setSharedPrompt,
    resolvePreviewUrlById,
    useReferenceImageIndicator,
    detailOutput,
    detailOutputId,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    generateOutput,
    regenerateOutput,
    rerollOutputFromReplay,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    buildSessionSnapshot,
    hydrateFromSessionSnapshot,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    archiveOlderOutputs,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    getDefaultDurationSeconds,
    getAgentContext,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
  };
};
