/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput } from "../types";
import { DEFAULT_KLING_DURATION_SECONDS, getModelConfig } from "../logic/pricing";
import { resolvePreviewUrlById, resolveModelLabel } from "../logic/stateParsers";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioOutputObjectUrlLifecycle } from "./useAiStudioOutputObjectUrlLifecycle";
import { useAiStudioGenerationPromptComposer } from "./useAiStudioGenerationPromptComposer";
import { useAiStudioAllowedModelOptions } from "./useAiStudioAllowedModelOptions";
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
  createEmptyReferenceProjectionState,
  markReferenceRemovedFromAllRefs,
  type ReferenceProjectionState,
} from "../reference-projections";

const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS; // current general fallback (10s)
const DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT = 500;
const DEFAULT_ARCHIVE_PREVIEW_KEEP_COUNT = 120;
const REFERENCE_GRID_FLAG_SOFT_ARCHIVE =
  process.env.NEXT_PUBLIC_REFERENCE_GRID_SOFT_ARCHIVE !== "false";
const REFERENCE_GRID_ACTIVE_LIMIT = Number(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT ?? DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT
);
const REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT = Number(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT ??
    DEFAULT_ARCHIVE_PREVIEW_KEEP_COUNT
);
/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
export const useAiStudioState = ({
  isCharacterModeEnabled = false,
}: {
  isCharacterModeEnabled?: boolean;
} = {}) => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [editReferenceText, setEditReferenceTextState] = useState<string>("");
  const [videoReferenceText, setVideoReferenceTextState] = useState<string>("");

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
    extraImageUrls,
    setExtraImageUrl,
    clearReferenceImages,
    toggleReferenceIndicator,
    resolveReferenceInputsForTool,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    modelModalPosition,
    setIsModelModalOpen,
    setModelModalAnchor,
    setModelModalPosition,
    openModelModal,
    closeModelModal,
  } = useAiStudioReferenceSelectionState({
    activeOutputPreviewUrl: activeOutput?.previewUrl ?? null,
  });

  const VIDEO_DURATION_STORAGE_KEY = "aiStudioVideoDuration";
  const VIDEO_RESOLUTION_STORAGE_KEY = "aiStudioVideoResolution";
  const IMAGE_RESOLUTION_STORAGE_KEY = "aiStudioImageResolution";

  const [videoReferenceMode, setVideoReferenceMode] = useState<
    "standard" | "keyframes" | "kling3" | "motion"
  >("standard");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 6;
    const stored = window.sessionStorage.getItem(VIDEO_DURATION_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : 6;
  });
  const [videoResolution, setVideoResolution] = useState<string>(() => {
    if (typeof window === "undefined") return "1080p";
    const stored = window.sessionStorage.getItem(VIDEO_RESOLUTION_STORAGE_KEY);
    return stored || "1080p";
  });
  const [imageResolution, setImageResolution] = useState<string>(() => {
    if (typeof window === "undefined") return "model_default";
    const stored = window.sessionStorage.getItem(IMAGE_RESOLUTION_STORAGE_KEY);
    return stored || "model_default";
  });
  const [hasUserVideoPrefs, setHasUserVideoPrefs] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      window.sessionStorage.getItem(VIDEO_DURATION_STORAGE_KEY) ||
      window.sessionStorage.getItem(VIDEO_RESOLUTION_STORAGE_KEY)
    );
  });
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

  const detailOutput = useMemo(
    () => (detailOutputId ? (activeOutputById[detailOutputId] ?? null) : null),
    [activeOutputById, detailOutputId]
  );
  const currentModelLabel = useMemo(() => resolveModelLabel(model ?? undefined), [model]);
  const setSharedPrompt = useCallback((value: string) => {
    setPrompt((prev) => (prev === value ? prev : value));
  }, []);
  const setEditReferenceText = useCallback((value: string) => {
    setEditReferenceTextState((prev) => (prev === value ? prev : value));
  }, []);
  const setVideoReferenceText = useCallback((value: string) => {
    setVideoReferenceTextState((prev) => (prev === value ? prev : value));
  }, []);
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

  const findActiveOutputById = useCallback(
    (id: string) => {
      return activeOutputByIdRef.current[id] ?? null;
    },
    [activeOutputByIdRef]
  );

  const updateActiveOutputById = useCallback(
    (id: string, updater: (item: StudioOutput) => StudioOutput) => {
      setActiveOutputState((prevState) => {
        const current = prevState.byId[id];
        if (!current) return prevState;
        const nextItem = updater(current);
        if (nextItem === current) return prevState;
        return {
          order: prevState.order,
          byId: {
            ...prevState.byId,
            [id]: nextItem,
          },
        };
      });
    },
    [setActiveOutputState]
  );

  const allowedModelOptions = useAiStudioAllowedModelOptions({
    selectedTool,
    videoReferenceMode,
    mode,
    isCharacterModeEnabled,
  });

  const setModel = useCallback((value: string | null) => {
    setModelState(value);
  }, []);

  const getDefaultDurationSeconds = useCallback((modelId: string | null) => {
    if (!modelId) return VIDEO_DEFAULT_DURATION_SECONDS;
    const config = getModelConfig(modelId);
    if (config?.defaultDurationSeconds) return config.defaultDurationSeconds;
    return VIDEO_DEFAULT_DURATION_SECONDS;
  }, []);

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
    allowedModelValues: allowedModelOptions.map((option) => option.value),
    isCharacterModeEnabled,
    mode,
    isModelModalOpen,
    modelModalAnchor,
    setDetailOutputId,
    setIsModelModalOpen,
    setModelModalAnchor,
    setModelModalPosition,
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
  const deleteOutput = useCallback(
    (id: string) => {
      const outputId = id.trim();
      if (!outputId) return;
      if (referenceProjectionStateRef.current.quickSlotIds.includes(outputId)) {
        setReferenceProjectionState((prev) => markReferenceRemovedFromAllRefs(prev, outputId));
        setActiveOutputId((prev) => (prev === outputId ? null : prev));
        return;
      }
      deleteOutputFromLifecycle(outputId);
    },
    [deleteOutputFromLifecycle, setActiveOutputId]
  );

  useEffect(() => {
    if (pendingFinalizeRemovalIdsRef.current.size === 0) return;
    const quickSlotIds = new Set(referenceProjectionState.quickSlotIds);
    const readyToFinalize = [...pendingFinalizeRemovalIdsRef.current].filter(
      (candidateId) => !quickSlotIds.has(candidateId)
    );
    if (!readyToFinalize.length) return;
    readyToFinalize.forEach((candidateId) =>
      pendingFinalizeRemovalIdsRef.current.delete(candidateId)
    );
    readyToFinalize.forEach((candidateId) => {
      deleteOutputFromLifecycle(candidateId);
    });
  }, [deleteOutputFromLifecycle, referenceProjectionState.quickSlotIds]);

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
    });
  const { generateOutput, regenerateOutput } = useAiStudioGenerationPromptComposer({
    prompt,
    editReferenceText,
    videoReferenceText,
    selectedTool,
    videoReferenceMode,
    useReferenceImageIndicator,
    activeOutputPreviewUrl: activeOutput?.previewUrl ?? null,
    resolveReferenceInputsForTool,
    submitTask,
    setUiError,
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
    setSharedPrompt,
    resolvePreviewUrlById,
    useReferenceImageIndicator,
    detailOutput,
    detailOutputId,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    modelModalPosition,
    generateOutput,
    regenerateOutput,
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
