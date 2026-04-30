import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { StudioOutput } from "../types";
import {
  listVisibleGeneratedOutputs,
  resolveVisibleGenerationReconcile,
} from "../logic/generatedMediaAuthority";
import { mergeCanonicalGeneratedOutputs } from "../logic/generatedOutputHydration";
import { resolvePreviewUrlById } from "../logic/stateParsers";
import { abandonGenerationOutput } from "../logic/generationAbandonment";
import { useAiStudioCreationState } from "./useAiStudioCreationState";
import { useAiStudioOutputDerivations } from "./useAiStudioOutputDerivations";
import { useAiStudioReferenceGridStateActions } from "./useAiStudioReferenceGridStateActions";
import { useAiStudioReferenceSelectionState } from "./useAiStudioReferenceSelectionState";
import { useAiStudioWorkflowSettings } from "./useAiStudioWorkflowSettings";
import { useAiStudioStateEffects } from "./useAiStudioStateEffects";
import { useAiStudioOutputCollectionState } from "./useAiStudioOutputCollectionState";
import { useAiStudioOutputPersistenceEffects } from "./useAiStudioOutputPersistenceEffects";
import { useAiStudioReferenceGridPreviewState } from "./useAiStudioReferenceGridPreviewState";
import {
  DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT,
  getDefaultDurationSecondsForModel,
  IMAGE_RESOLUTION_STORAGE_KEY,
  REFERENCE_GRID_ACTIVE_LIMIT,
  REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT,
  REFERENCE_GRID_FLAG_SOFT_ARCHIVE,
  VIDEO_DURATION_STORAGE_KEY,
  VIDEO_RESOLUTION_STORAGE_KEY,
} from "./aiStudioStateConfig";
import { useAiStudioStableTextSetters } from "./useAiStudioStableTextSetters";
import { useAiStudioStateOutputControllers } from "./useAiStudioStateOutputControllers";
import { useAiStudioStateRuntimeControllers } from "./useAiStudioStateRuntimeControllers";
import { useAiStudioStateSupportControllers } from "./useAiStudioStateSupportControllers";
import {
  createEmptyReferenceProjectionState,
  type ReferenceProjectionState,
} from "../reference-projections";

type AiStudioRuntimeUiState = {
  activeOutputId: string | null;
  referenceProjectionState: ReferenceProjectionState;
  saved: boolean;
};

const isPlainSessionGeneratedOutputHydrationEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_AI_STUDIO_PLAIN_SESSION_GENERATED_OUTPUT_HYDRATION_ENABLED === "true";

const CANONICAL_GENERATED_OUTPUT_SYNC_INTERVAL_MS = 5_000;
const CANONICAL_GENERATED_OUTPUT_SYNC_IDLE_GRACE_MS = 120_000;
const GENERATED_VIDEO_POSTER_REPAIR_BATCH_SIZE = 4;

const isCanonicalGeneratedOutputSyncCandidate = (output: StudioOutput): boolean => {
  const hasGenerationIdentity = Boolean(output.generationId || output.taskId);
  if (output.mediaSource !== "generated" && !hasGenerationIdentity) return false;
  if (output.taskState === "success" || output.taskState === "fail") return false;
  return hasGenerationIdentity || Boolean(output.sourceRef);
};

const isGeneratedVideoPosterRepairCandidate = (output: StudioOutput): boolean => {
  if (output.mode !== "video") return false;
  if (output.taskState !== "success") return false;
  if (output.previewPosterUrl?.trim()) return false;
  if (output.mediaSource !== "generated" && !output.generationId && !output.taskId) return false;
  return Boolean(output.generationId || output.taskId);
};

const buildGeneratedVideoPosterRepairKey = (output: StudioOutput): string =>
  [
    output.id,
    output.generationId ?? "",
    output.taskId ?? "",
    output.previewUrl ?? "",
    output.previewPosterStoragePath ?? "",
    output.previewStoragePath ?? "",
    output.fullStoragePath ?? "",
    output.resultUrls?.join("|") ?? "",
  ].join("::");

export const useAiStudioState = ({
  projectId = null,
  projectRouteRequested = false,
  sessionId = null,
  isCharacterModeEnabled = false,
  selectedStylePrompt = null,
  selectedStyleContext = null,
  expertCreateMode = "standard",
  activePulsePresetId = null,
  pulseSessionInstanceId = null,
  setExpertCreateMode,
  setActivePulsePresetId,
  setPulseSessionInstanceId,
}: {
  projectId?: string | null;
  projectRouteRequested?: boolean;
  sessionId?: string | null;
  isCharacterModeEnabled?: boolean;
  selectedStylePrompt?: string | null;
  selectedStyleContext?: StudioOutput["styleContext"] | null;
  expertCreateMode?: "standard" | "pulse";
  activePulsePresetId?: string | null;
  pulseSessionInstanceId?: string | null;
  setExpertCreateMode?: Dispatch<SetStateAction<"standard" | "pulse">>;
  setActivePulsePresetId?: Dispatch<SetStateAction<string | null>>;
  setPulseSessionInstanceId?: Dispatch<SetStateAction<string | null>>;
} = {}) => {
  const {
    promptRef,
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModelState,
    standardPrompt,
    setStandardPrompt,
    pulsePrompt,
    setPulsePrompt,
    editReferenceText,
    setEditReferenceTextState,
    videoReferenceText,
    setVideoReferenceTextState,
    expertEditSessionState,
    setExpertEditSessionState,
    videoReferenceMode,
    setVideoReferenceMode,
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    imageResolution,
    setImageResolution,
    hasUserVideoPrefs,
    setHasUserVideoPrefs,
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
    klingWorkflowMode,
    setKlingWorkflowMode,
    seedance2InputMode,
    setSeedance2InputMode,
    seedance2ReferenceImageUrls,
    setSeedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    setSeedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    setSeedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    setSeedance2ReturnLastFrame,
    seedance2WebSearch,
    setSeedance2WebSearch,
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    createIsGenerating,
    editIsGenerating,
    videoIsGenerating,
    setPanelGenerating,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    lastVideoReferenceModeRef,
    lastNonKling3VideoModelRef,
    lastNonKeyframesVideoModelRef,
    lastNonMotionVideoModelRef,
  } = useAiStudioCreationState({
    projectRouteRequested,
  });

  const baseRuntimeAuthorityKey =
    projectRouteRequested && !projectId
      ? "project:pending"
      : projectId
        ? `project:${projectId}`
        : sessionId
          ? `session:${sessionId}`
          : "session:pending";
  const runtimeAuthorityKey = `${baseRuntimeAuthorityKey}::create-mode:${expertCreateMode}`;

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
    setOutputCollectionsForAuthority,
  } = useAiStudioOutputCollectionState({
    authorityKey: runtimeAuthorityKey,
  });
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
  const canonicalGeneratedHydrationStartedRef = useRef(false);
  const canonicalGeneratedOutputSyncInFlightRef = useRef(false);
  const canonicalGeneratedOutputSyncLastActiveAtRef = useRef<number | null>(null);
  const generatedVideoPosterRepairKeySetRef = useRef<Set<string>>(new Set());
  const activeBaseRuntimeAuthorityKeyRef = useRef(baseRuntimeAuthorityKey);
  const activeRuntimeAuthorityKeyRef = useRef(runtimeAuthorityKey);
  const runtimeUiStateByAuthorityKeyRef = useRef<Record<string, AiStudioRuntimeUiState>>({});

  const getRuntimeAuthorityKeyForCreateMode = useCallback(
    (createMode: "standard" | "pulse") => `${baseRuntimeAuthorityKey}::create-mode:${createMode}`,
    [baseRuntimeAuthorityKey]
  );

  const setRuntimeUiStateForCreateMode = useCallback(
    (createMode: "standard" | "pulse", nextState: AiStudioRuntimeUiState) => {
      const targetAuthorityKey = getRuntimeAuthorityKeyForCreateMode(createMode);
      runtimeUiStateByAuthorityKeyRef.current[targetAuthorityKey] = nextState;
      if (activeRuntimeAuthorityKeyRef.current !== targetAuthorityKey) return;
      setActiveOutputId(nextState.activeOutputId);
      setReferenceProjectionState(nextState.referenceProjectionState);
      setSaved(nextState.saved);
    },
    [getRuntimeAuthorityKeyForCreateMode]
  );

  const setOutputCollectionsForCreateMode = useCallback(
    (
      createMode: "standard" | "pulse",
      activeRows: StudioOutput[],
      archivedRows: StudioOutput[]
    ) => {
      setOutputCollectionsForAuthority(
        getRuntimeAuthorityKeyForCreateMode(createMode),
        activeRows,
        archivedRows
      );
    },
    [getRuntimeAuthorityKeyForCreateMode, setOutputCollectionsForAuthority]
  );

  useEffect(() => {
    if (activeRuntimeAuthorityKeyRef.current === runtimeAuthorityKey) return;
    const previousRuntimeAuthorityKey = activeRuntimeAuthorityKeyRef.current;
    runtimeUiStateByAuthorityKeyRef.current[previousRuntimeAuthorityKey] = {
      activeOutputId,
      referenceProjectionState,
      saved,
    };
    const baseAuthorityChanged =
      activeBaseRuntimeAuthorityKeyRef.current !== baseRuntimeAuthorityKey;
    if (baseAuthorityChanged) {
      activeBaseRuntimeAuthorityKeyRef.current = baseRuntimeAuthorityKey;
      canonicalGeneratedHydrationStartedRef.current = false;
      generatedVideoPosterRepairKeySetRef.current.clear();
    }
    activeRuntimeAuthorityKeyRef.current = runtimeAuthorityKey;
    const restoredState = baseAuthorityChanged
      ? null
      : (runtimeUiStateByAuthorityKeyRef.current[runtimeAuthorityKey] ?? null);

    setActiveOutputId(restoredState?.activeOutputId ?? null);
    setReferenceProjectionState(
      restoredState?.referenceProjectionState ?? createEmptyReferenceProjectionState()
    );
    pendingAutoSavesRef.current = {};
    pendingFinalizeRemovalIdsRef.current = new Set();
    sessionHydrationSigningRevisionRef.current += 1;
    setSaved(restoredState?.saved ?? false);
  }, [
    activeOutputId,
    baseRuntimeAuthorityKey,
    referenceProjectionState,
    runtimeAuthorityKey,
    saved,
  ]);

  const {
    activeOutput,
    activeOutputPreviewUrl,
    markReferenceGridReady,
    referenceGridReadyOutputIds: visibleReferenceGridReadyOutputIds,
  } = useAiStudioReferenceGridPreviewState({
    activeOutputById,
    activeOutputId,
    outputs,
    archivedOutputs,
  });
  const singleImageContextOutput = (() => {
    if (activeOutput) return activeOutput;
    const imageOutputs = outputs.filter((output) => output.mode === "image" && output.previewUrl);
    return imageOutputs.length === 1 ? (imageOutputs[0] ?? null) : null;
  })();
  const {
    selectedTool,
    setSelectedTool,
    showCreateTools,
    setShowCreateTools,
    imageReferenceImageUrl,
    imageExtraImageUrls,
    videoReferenceImageUrl,
    videoExtraImageUrls,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    useReferenceImageIndicator,
    setUseReferenceImageIndicator,
    detailOutputId,
    setDetailOutputId,
    referenceImageUrl,
    setReferenceImageUrl,
    setImageReferenceImageUrl,
    setVideoReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    setImageExtraImageUrl,
    setVideoExtraImageUrl,
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
    activeOutputPreviewUrl,
    authorityKey: runtimeAuthorityKey,
  });

  const { detailOutput, currentModelLabel, isPrimaryEditStageGenerating } =
    useAiStudioOutputDerivations({ outputs, activeOutputById, detailOutputId, model });
  const { hasPendingWorkflowRestore } = useAiStudioWorkflowSettings({
    projectId,
    projectRouteRequested,
    sessionId,
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
  });
  const {
    setSharedPrompt,
    setStandardCreatePrompt,
    setPulseCreatePrompt,
    setEditReferenceText,
    setVideoReferenceText,
  } = useAiStudioStableTextSetters({
    expertCreateMode,
    setStandardPromptState: setStandardPrompt,
    setPulsePromptState: setPulsePrompt,
    setEditReferenceTextState,
    setVideoReferenceTextState,
  });
  const createStateRuntime = useMemo(
    () =>
      expertCreateMode === "pulse"
        ? {
            kind: "pulse" as const,
            prompt: pulsePrompt,
            activePulsePresetId,
            pulseSessionInstanceId,
          }
        : {
            kind: "standard" as const,
            prompt: standardPrompt,
            activePulsePresetId: null,
            pulseSessionInstanceId: null,
          },
    [activePulsePresetId, expertCreateMode, pulsePrompt, pulseSessionInstanceId, standardPrompt]
  );
  const activeCreatePrompt = createStateRuntime.prompt;
  const createStatePrompts = useMemo(
    () => ({
      standard: standardPrompt,
      pulse: pulsePrompt,
    }),
    [pulsePrompt, standardPrompt]
  );
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
  useAiStudioStateEffects({
    promptRef,
    aspect,
    setAspect,
    activeOutputPreviewUrl,
    setUseReferenceImageIndicator,
    model,
    referenceImageUrl,
    extraImageUrls,
    selectedTool,
    videoReferenceMode,
    setVideoReferenceMode,
    setModel: setModelState,
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
    isCharacterModeEnabled,
    mode,
    setDetailOutputId,
    setIsModelModalOpen,
    setModelModalAnchor,
    hasPendingWorkflowRestore,
  });

  useAiStudioOutputPersistenceEffects({
    outputs,
    archivedOutputs,
    setOutputsState,
    setArchivedOutputs,
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

  useEffect(() => {
    const shouldHydrateProjectGeneratedOutputs = Boolean(projectId) && !hasPendingWorkflowRestore;
    const shouldHydratePlainSessionGeneratedOutputs =
      !projectRouteRequested && !projectId && isPlainSessionGeneratedOutputHydrationEnabled();
    if (
      canonicalGeneratedHydrationStartedRef.current ||
      (!shouldHydrateProjectGeneratedOutputs && !shouldHydratePlainSessionGeneratedOutputs)
    ) {
      return;
    }
    canonicalGeneratedHydrationStartedRef.current = true;
    let cancelled = false;

    void (async () => {
      const hydratedOutputs = await listVisibleGeneratedOutputs({
        projectId: projectId ?? null,
      });
      if (cancelled || hydratedOutputs.length === 0) return;
      setOutputsState((currentOutputs) =>
        mergeCanonicalGeneratedOutputs(currentOutputs, hydratedOutputs)
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPendingWorkflowRestore, projectId, projectRouteRequested, setOutputsState]);

  useEffect(() => {
    if (!projectId || hasPendingWorkflowRestore) {
      canonicalGeneratedOutputSyncLastActiveAtRef.current = null;
      return;
    }

    const hasActiveGeneratedOutput = outputs.some(isCanonicalGeneratedOutputSyncCandidate);
    if (hasActiveGeneratedOutput) {
      canonicalGeneratedOutputSyncLastActiveAtRef.current = Date.now();
    }
  }, [hasPendingWorkflowRestore, outputs, projectId]);

  useEffect(() => {
    if (!projectId || hasPendingWorkflowRestore) return;
    let cancelled = false;

    const syncCanonicalGeneratedOutputs = async () => {
      if (cancelled || canonicalGeneratedOutputSyncInFlightRef.current) return;
      const lastActiveAt = canonicalGeneratedOutputSyncLastActiveAtRef.current;
      const withinIdleGrace =
        lastActiveAt != null &&
        Date.now() - lastActiveAt <= CANONICAL_GENERATED_OUTPUT_SYNC_IDLE_GRACE_MS;
      if (!withinIdleGrace) return;

      canonicalGeneratedOutputSyncInFlightRef.current = true;
      try {
        const hydratedOutputs = await listVisibleGeneratedOutputs({ projectId });
        if (cancelled || hydratedOutputs.length === 0) return;
        setOutputsState((currentOutputs) =>
          mergeCanonicalGeneratedOutputs(currentOutputs, hydratedOutputs)
        );
      } finally {
        canonicalGeneratedOutputSyncInFlightRef.current = false;
      }
    };

    const intervalId = globalThis.setInterval(
      syncCanonicalGeneratedOutputs,
      CANONICAL_GENERATED_OUTPUT_SYNC_INTERVAL_MS
    );
    void syncCanonicalGeneratedOutputs();

    return () => {
      cancelled = true;
      globalThis.clearInterval(intervalId);
    };
  }, [hasPendingWorkflowRestore, projectId, setOutputsState]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    const repairCandidates = outputs
      .filter(isGeneratedVideoPosterRepairCandidate)
      .map((output) => ({
        output,
        repairKey: buildGeneratedVideoPosterRepairKey(output),
      }))
      .filter(({ repairKey }) => !generatedVideoPosterRepairKeySetRef.current.has(repairKey))
      .slice(0, GENERATED_VIDEO_POSTER_REPAIR_BATCH_SIZE);
    if (!repairCandidates.length) return;

    repairCandidates.forEach(({ repairKey }) => {
      generatedVideoPosterRepairKeySetRef.current.add(repairKey);
    });

    let cancelled = false;
    void (async () => {
      const repairs = await Promise.all(
        repairCandidates.map(async ({ output, repairKey }) => {
          const reconcile = await resolveVisibleGenerationReconcile({
            generationId: output.generationId ?? null,
            requestId: output.taskId ?? null,
            projectId: projectId ?? null,
          });
          return {
            outputId: output.id,
            generationId: output.generationId ?? null,
            taskId: output.taskId ?? null,
            repairKey,
            reconcile,
          };
        })
      );
      if (cancelled) return;

      const repairByOutputId = new Map(
        repairs
          .filter((repair) => repair.reconcile?.previewPosterUrl)
          .map((repair) => [repair.outputId, repair])
      );
      if (repairByOutputId.size === 0) return;

      setOutputsState((currentOutputs) => {
        let changed = false;
        const patchedOutputs = currentOutputs.map((output) => {
          const repair = repairByOutputId.get(output.id);
          if (!repair?.reconcile?.previewPosterUrl) return output;
          if (output.previewPosterUrl?.trim()) return output;
          if (repair.generationId && output.generationId !== repair.generationId) return output;
          if (!repair.generationId && repair.taskId && output.taskId !== repair.taskId)
            return output;
          changed = true;
          return {
            ...output,
            previewPosterUrl: repair.reconcile.previewPosterUrl,
            previewPosterStoragePath:
              repair.reconcile.previewPosterStoragePath ?? output.previewPosterStoragePath ?? null,
            previewStoragePath:
              repair.reconcile.previewStoragePath ?? output.previewStoragePath ?? null,
            fullStoragePath: repair.reconcile.fullStoragePath ?? output.fullStoragePath ?? null,
            previewUrl: repair.reconcile.previewUrl ?? output.previewUrl,
            resultUrls:
              repair.reconcile.resultUrls.length > 0
                ? repair.reconcile.resultUrls
                : output.resultUrls,
          };
        });
        return changed ? patchedOutputs : currentOutputs;
      });
    })().catch(() => {
      repairCandidates.forEach(({ repairKey }) => {
        generatedVideoPosterRepairKeySetRef.current.delete(repairKey);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [hasPendingWorkflowRestore, outputs, projectId, setOutputsState]);

  const {
    deleteOutput,
    ensureGenerationRecord,
    ensureOutputPersisted,
    findOutputById,
    forceDeleteOutput,
    notifyGenerationFailure,
    saveActiveOutput,
    savePromptReference,
    savePromptToLibrary,
    saveReferenceToLibrary,
    updateOutputById,
    updateOutputPrompt,
  } = useAiStudioStateOutputControllers({
    activeOutputByIdRef,
    activeOutputId,
    aspect,
    model,
    pendingAutoSavesRef,
    pendingFinalizeRemovalIdsRef,
    projectId,
    createPrompt: activeCreatePrompt,
    quickSlotIds: referenceProjectionState.quickSlotIds,
    setActiveOutputId,
    setActiveOutputState,
    setOutputs,
    setReferenceProjectionState,
    setSaved,
    setUiError,
    outputs,
  });

  const {
    buildSessionSnapshot,
    generateOutput,
    handleReferenceOutputMediaLoaded,
    hydrateFromSessionSnapshot,
    insertOptimisticGenerationPlaceholder,
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
    rerollOutputFromReplay,
    retryOutputStatus,
    abandonTaskOutput,
  } = useAiStudioStateRuntimeControllers({
    activeOutputId,
    activeOutputPreviewUrl,
    archivedOutputs,
    aspect,
    createPrompts: createStatePrompts,
    createRuntime: createStateRuntime,
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
    notifyGenerationFailure,
    outputs,
    projectId,
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
    setActivePulsePresetId: setActivePulsePresetId ?? (() => undefined),
    setArchivedOutputs,
    setAspect,
    setEditReferenceText,
    setExpertCreateMode: setExpertCreateMode ?? (() => undefined),
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
    setModel: setModelState,
    setMotionReferenceVideoUrl,
    setOutputCollectionsForCreateMode,
    setOutputs,
    setOutputsState,
    setPanelGenerating,
    setPulseCreatePrompt,
    setPulseSessionInstanceId: setPulseSessionInstanceId ?? (() => undefined),
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

  const clearGenerationOutput = useCallback(
    (outputId: string) => {
      const output = findOutputById(outputId);
      abandonTaskOutput(outputId);
      forceDeleteOutput(outputId);
      if (!output) return;
      void abandonGenerationOutput({ output }).catch((error) => {
        console.warn("[ai-studio] failed to persist generation abandonment", error);
      });
    },
    [abandonTaskOutput, findOutputById, forceDeleteOutput]
  );

  const {
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    addLibraryMediaReference,
    addLibraryMediaReferenceToQuickSlot,
    addLibraryPromptReference,
    addLibraryPromptReferenceToQuickSlot,
    addOutputsFromFiles,
    getAgentContext,
    getOutputById,
    getOutputSnapshot,
    selectActiveOutputs,
    selectArchivedOutputs,
    selectOutputById,
    subscribeOutputs,
  } = useAiStudioStateSupportControllers({
    activeOutput: singleImageContextOutput,
    archivedOutputs,
    aspect,
    mode,
    model,
    outputs,
    setOutputs,
    setSharedPrompt,
    setUiError,
    updateOutputById,
  });

  return {
    isPrimaryEditStageGenerating,
    promptRef,
    mode,
    setMode: setMode,
    aspect,
    setAspect,
    model,
    setModel: setModelState,
    currentModelLabel,
    activeCreatePrompt,
    setPrompt: setSharedPrompt,
    standardPrompt,
    pulsePrompt,
    setPulseCreatePrompt,
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
    imageReferenceImageUrl,
    imageExtraImageUrls,
    videoReferenceImageUrl,
    videoExtraImageUrls,
    referenceImageUrl,
    setReferenceImageUrl,
    setImageReferenceImageUrl,
    setVideoReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    setImageExtraImageUrl,
    setVideoExtraImageUrl,
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
    klingWorkflowMode,
    setKlingWorkflowMode,
    seedance2InputMode,
    setSeedance2InputMode,
    seedance2ReferenceImageUrls,
    setSeedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    setSeedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    setSeedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    setSeedance2ReturnLastFrame,
    seedance2WebSearch,
    setSeedance2WebSearch,
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    createIsGenerating,
    editIsGenerating,
    videoIsGenerating,
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
    updateOutputById,
    notifyGenerationFailure,
    saveActiveOutput,
    ensureOutputPersisted,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    addLibraryMediaReference,
    addLibraryMediaReferenceToQuickSlot,
    addLibraryPromptReference,
    addLibraryPromptReferenceToQuickSlot,
    addOutputsFromFiles,
    buildSessionSnapshot,
    hydrateFromSessionSnapshot,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
    clearGenerationOutput,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    archiveOlderOutputs,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    getDefaultDurationSeconds: getDefaultDurationSecondsForModel,
    getAgentContext,
    onReferenceOutputMediaLoaded: handleReferenceOutputMediaLoaded,
    referenceGridReadyOutputIds: visibleReferenceGridReadyOutputIds,
    retryOutputStatus,
  };
};
