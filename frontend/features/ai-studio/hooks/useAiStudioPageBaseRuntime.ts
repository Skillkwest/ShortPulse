import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { useAiStudioEditSubmitIntent } from "./useAiStudioEditSubmitIntent";
import { useAiStudioInternalDropResolvers } from "./useAiStudioInternalDropResolvers";
import { useAiStudioCreateModeRuntime } from "./useAiStudioCreateModeRuntime";
import { useAiStudioPageLocalState } from "./useAiStudioPageLocalState";
import { useAiStudioPageCharacterRuntime } from "./useAiStudioPageCharacterRuntime";
import { useAiStudioPageCreditDerivations } from "./useAiStudioPageCreditDerivations";
import { useAiStudioPageMediaReferenceRuntime } from "./useAiStudioPageMediaReferenceRuntime";
import { useAiStudioPageOutputAdapters } from "./useAiStudioPageOutputAdapters";
import { useAiStudioPerfAuditRuntime } from "./useAiStudioPerfAuditRuntime";
import { useAiStudioState } from "./useAiStudioState";
import { useCredits } from "./useCredits";
import { useExpertEditPresetPanelPreference } from "./useExpertEditPresetPanelPreference";
import { useExpertEditSystemPresetCatalog } from "./useExpertEditSystemPresetCatalog";
import { useMediaAutosavePreference } from "./useMediaAutosavePreference";
import { useAiStudioProjectIdentity } from "./useAiStudioProjectIdentity";
import { useAiStudioSessionIdentity } from "./useAiStudioSessionIdentity";
import { useActiveModelPricingPolicy } from "./useActiveModelPricingPolicy";
import { useAiStudioCharacterPanelUploadBridge } from "./useAiStudioCharacterPanelUploadBridge";
import { isEditWorkflow } from "../logic/workflowIdentity";
import { createCanvasDetailModalItem } from "../logic/canvasDetailModal";
import {
  PERF_FLAG_AUDIT_RUNTIME,
  PERF_FLAG_OUTPUT_SELECTOR_STORE,
  PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS,
  PERF_FLAG_SELECTOR_CALLBACKS,
} from "../logic/perfProfileFlags";
import type { ToolId } from "../types";

const FLAG_OUTPUT_SELECTOR_STORE = PERF_FLAG_OUTPUT_SELECTOR_STORE;
const FLAG_SELECTOR_CALLBACKS = PERF_FLAG_SELECTOR_CALLBACKS;
const FLAG_REFERENCE_GRID_PRECONNECT_HINTS = PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS;
const FLAG_PERF_AUDIT_RUNTIME = PERF_FLAG_AUDIT_RUNTIME;
const MODEL_PRICING_POLICY_IDLE_TIMEOUT_MS = 1500;
const MODEL_PRICING_POLICY_FALLBACK_DELAY_MS = 250;

const useDeferredModelPricingPolicyLoad = () => {
  const [shouldLoadModelPricingPolicy, setShouldLoadModelPricingPolicy] = useState(false);

  useEffect(() => {
    if (shouldLoadModelPricingPolicy) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const enableModelPricingPolicyLoad = () => {
      if (!cancelled) {
        setShouldLoadModelPricingPolicy(true);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(enableModelPricingPolicyLoad, {
        timeout: MODEL_PRICING_POLICY_IDLE_TIMEOUT_MS,
      });

      return () => {
        cancelled = true;
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(
      enableModelPricingPolicyLoad,
      MODEL_PRICING_POLICY_FALLBACK_DELAY_MS
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [shouldLoadModelPricingPolicy]);

  return shouldLoadModelPricingPolicy;
};

export const useAiStudioPageBaseRuntime = () => {
  const router = useRouter();
  const { sessionId } = useAiStudioSessionIdentity();
  const shouldLoadModelPricingPolicy = useDeferredModelPricingPolicyLoad();

  const { balanceCents, balanceReservedCents, balanceLoading, balanceError, refreshBalance } =
    useCredits();
  const {
    modelPricingPolicy,
    modelPricingPolicyReady,
    modelPricingPolicyLoading,
    modelPricingPolicyError,
  } = useActiveModelPricingPolicy({
    enabled: shouldLoadModelPricingPolicy,
  });
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents));
  }, [balanceCents]);
  const {
    characterCreateRequestKey,
    createCharacterModeInjectionBundle,
    createSelectedCharacterLookId,
    editCharacterModeInjectionBundle,
    editSelectedCharacterId,
    elementCreateRequestKey,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    isEditCharacterBundleLoading,
    isEditCharacterModeEnabled,
    isProjectsModalOpen,
    localSessionTitleOverride,
    mediaProjectNameFocusRequestKey,
    optimisticDebitEntries,
    selectedStyleContext,
    selectedStylePrompt,
    setCharacterCreateRequestKey,
    setCreateCharacterModeInjectionBundle,
    setCreateSelectedCharacterLookId,
    setEditCharacterModeInjectionBundle,
    setEditSelectedCharacterId,
    setElementCreateRequestKey,
    setIsCreateCharacterBundleLoading,
    setIsCreateCharacterModeEnabled,
    setIsEditCharacterBundleLoading,
    setIsEditCharacterModeEnabled,
    setIsProjectsModalOpen,
    setMediaProjectNameFocusRequestKey,
    setOptimisticDebitEntries,
    setSelectedStyleContext,
    setSelectedStylePrompt,
    setSessionTitleOverrideState,
  } = useAiStudioPageLocalState({
    sessionId,
  });
  const {
    bootstrapProjectId,
    requestedProjectId,
    verifiedProjectId,
    projectRouteRequested,
    project,
    status: projectStatus,
    error: projectError,
    errorKind: projectErrorKind,
    refreshProject,
    updateProjectTitle,
  } = useAiStudioProjectIdentity();
  const projectId = verifiedProjectId;
  const shouldGateSessionPersistence = projectRouteRequested && projectStatus !== "ready";
  const activeSessionPersistenceSessionId = shouldGateSessionPersistence ? null : sessionId;
  const sessionPersistenceTitleOverride = project?.title ?? localSessionTitleOverride;
  const {
    expertCreateMode,
    activeCreatePulsePresetId,
    pulseSessionInstanceId,
    pulseWorkflowSession,
    setExpertCreateMode,
    setActiveCreatePulsePresetId,
    setPulseSessionInstanceId,
    setPulseWorkflowSession,
    clearPulseRuntime,
    restartPulse,
    handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange,
  } = useAiStudioCreateModeRuntime();
  const {
    addCharacterReferences,
    pendingCharacterUploadRequest,
    clearPendingCharacterUploadRequest,
  } = useAiStudioCharacterPanelUploadBridge();
  const {
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModel,
    currentModelLabel,
    activeCreatePrompt,
    standardPrompt,
    pulsePrompt,
    outputs,
    setOutputs,
    setStandardCreatePrompt,
    setPulseCreatePrompt,
    resetReferenceGridState,
    curatedReferenceIds,
    removedFromAllRefsIds,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    removeReferencesForDeletedMedia,
    archivedOutputs,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    selectedTool,
    setSelectedTool,
    showCreateTools,
    setShowCreateTools,
    imageReferenceImageUrl,
    referenceImageUrl,
    setReferenceImageUrl,
    setImageReferenceImageUrl,
    setVideoReferenceImageUrl,
    imageExtraImageUrls,
    extraImageUrls,
    setImageExtraImageUrl,
    videoReferenceImageUrl,
    videoExtraImageUrls,
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
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    motionReferenceVideoUrl,
    motionReferenceVideoPending,
    motionReferenceVideoError,
    setMotionReferenceVideoUrl,
    stageMotionVideoSelection,
    clearMotionVideoSelection,
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
    editReferenceText,
    setEditReferenceText,
    videoReferenceText,
    setVideoReferenceText,
    musicPromptDraft,
    setMusicPromptDraft,
    musicLyricsDraft,
    setMusicLyricsDraft,
    musicDurationSeconds,
    setMusicDurationSeconds,
    soundEffectsPromptDraft,
    setSoundEffectsPromptDraft,
    soundEffectsDurationSeconds,
    setSoundEffectsDurationSeconds,
    voiceDesignPromptDraft,
    setVoiceDesignPromptDraft,
    voiceScriptDraft,
    setVoiceScriptDraft,
    createIsGenerating,
    editIsGenerating,
    expertEditSessionState,
    expertEditSessionRevision,
    publishExpertEditSessionState,
    getExpertEditSessionState,
    setExpertEditSessionState,
    useReferenceImageIndicator,
    detailOutput,
    detailSelectionTarget,
    setDetailSelectionTarget,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    isPrimaryEditStageGenerating,
    generateOutput,
    regenerateOutput,
    rerollOutputFromReplay,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    updateOutputById,
    notifyGenerationFailure,
    ensureOutputPersisted,
    saveReferenceToLibrary,
    savePromptToLibrary,
    ingestReferenceFiles,
    addOutputsFromFiles,
    buildProjectWorkspaceSnapshot,
    buildSessionSnapshot,
    addLibraryMediaReference,
    addLibraryMediaReferenceToQuickSlot,
    addLibraryPromptReference,
    addLibraryPromptReferenceToQuickSlot,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
    clearGenerationOutput,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    getDefaultDurationSeconds,
    getAgentContext,
    onReferenceOutputMediaLoaded,
    referenceGridReadyOutputIds,
    retryOutputStatus,
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    insertPastedMediaReference,
    hydrateFromSessionSnapshot,
    getOutputById,
    getOutputSnapshot,
  } = useAiStudioState({
    projectId,
    projectRouteRequested,
    sessionId,
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
    selectedStylePrompt,
    selectedStyleContext,
    expertCreateMode,
    activePulsePresetId: activeCreatePulsePresetId,
    pulseSessionInstanceId,
    setExpertCreateMode,
    setActivePulsePresetId: setActiveCreatePulsePresetId,
    setPulseSessionInstanceId,
  });
  const {
    mediaAutosaveEnabled,
    syncState: mediaAutosaveSyncState,
    error: mediaAutosaveError,
  } = useMediaAutosavePreference({
    enabled: outputs.length > 0,
  });
  const [shouldLoadExpertEditPresetRuntime, setShouldLoadExpertEditPresetRuntime] = useState(() =>
    isEditWorkflow(selectedTool)
  );
  const { systemPresetDefinitions: expertEditSystemPresetDefinitions } =
    useExpertEditSystemPresetCatalog({
      enabled: shouldLoadExpertEditPresetRuntime,
    });
  const {
    presetPanelIds: selectedExpertEditPresetIds,
    customPresetOverrides: expertEditCustomPresetOverrides,
    setPresetPanelIds: setSelectedExpertEditPresetIds,
    setCustomPresetOverrides: setExpertEditCustomPresetOverrides,
  } = useExpertEditPresetPanelPreference({
    enabled: shouldLoadExpertEditPresetRuntime,
    systemPresetDefinitions: expertEditSystemPresetDefinitions,
  });
  useEffect(() => {
    setExpertEditSessionState(null);
  }, [sessionId, setExpertEditSessionState]);
  const { editSubmitIntent, setEditSubmitIntent, resetEditSubmitIntent } =
    useAiStudioEditSubmitIntent({
      selectedTool,
    });
  const setSelectedToolWithEditIntentReset = useCallback(
    (nextTool: ToolId | null) => {
      if (isEditWorkflow(selectedTool) && !isEditWorkflow(nextTool)) {
        resetEditSubmitIntent();
      }
      if (isEditWorkflow(nextTool)) {
        setShouldLoadExpertEditPresetRuntime(true);
      }
      setSelectedTool(nextTool);
    },
    [resetEditSubmitIntent, selectedTool, setSelectedTool]
  );
  const {
    resolveCharacterDropReference,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    resolveComposerInternalImageDropSource,
    resolveElementProfileImageDropSource,
  } = useAiStudioInternalDropResolvers({
    getOutputById,
    getOutputSnapshot,
    ensureOutputPersisted,
  });
  const {
    canvasSessionState,
    handleQuickSlotDroppedFiles,
    handleQuickSlotDroppedMediaReference,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryPromptDrop,
    hydrateCanvasSessionState,
    railCanvasProps,
    resolveVoiceChangerInternalReferenceSource,
  } = useAiStudioPageMediaReferenceRuntime({
    addCuratedReference,
    addLibraryMediaReferenceToQuickSlot,
    addLibraryPromptReferenceToQuickSlot,
    addPastedPromptReference,
    insertPastedMediaReference,
    getOutputById,
    getOutputSnapshot,
    ingestReferenceFiles,
    reorderCuratedReference,
    setActiveOutputId,
    setDetailSelectionTarget,
    setUiError,
  });
  const sharedDetailModalItem = useMemo(() => {
    if (detailSelectionTarget?.kind !== "canvas-item") return null;
    const item = canvasSessionState.items.find(
      (candidate) => candidate.id === detailSelectionTarget.itemId
    );
    if (!item) return null;
    return createCanvasDetailModalItem({
      item,
      instanceId: detailSelectionTarget.instanceId,
    });
  }, [canvasSessionState.items, detailSelectionTarget]);
  const {
    inFlightOutputIds,
    resolvePanelOutputPreviewUrl,
    resolveReferenceInputsForTool,
    findOutputById,
  } = useAiStudioPageOutputAdapters({
    outputs,
    getOutputById,
    referenceImageUrl,
    extraImageUrls,
    outputSelectorStoreEnabled: FLAG_OUTPUT_SELECTOR_STORE,
    selectorCallbacksEnabled: FLAG_SELECTOR_CALLBACKS,
  });
  const {
    optimisticUncoveredDebitCredits,
    pendingHoldCredits,
    effectiveBalanceCredits,
    referenceGridPreconnectOrigin,
  } = useAiStudioPageCreditDerivations({
    optimisticDebitEntries,
    inFlightOutputIds,
    balanceReservedCents,
    balanceCredits,
    referenceGridPreconnectHintsEnabled: FLAG_REFERENCE_GRID_PRECONNECT_HINTS,
  });
  useAiStudioPerfAuditRuntime({
    enabled: FLAG_PERF_AUDIT_RUNTIME,
    aspect,
    currentModelLabel,
    model,
    getOutputSnapshot,
    resetReferenceGridState,
    projectRouteRequested,
    standardCreatePrompt: standardPrompt,
    editReferenceText,
    videoReferenceText,
    setActiveOutputId,
    setStandardCreatePrompt,
    setEditReferenceText,
    setVideoReferenceText,
    setOutputs,
  });

  const referenceGridFileInputRef = useRef<HTMLInputElement | null>(null);
  const trackUiEvent = useCallback((message: string, data?: Record<string, unknown>) => {
    addBreadcrumb({
      type: "ui",
      message,
      data,
    });
  }, []);
  const {
    characterOptions,
    createSelectedCharacterId,
    handleCharacterPanelSelectedCharacterChange,
    handleCreateCharacterSelection,
    handleOpenCharacterCreate,
    handleOpenElementCreate,
    isCharacterOptionsLoading,
    loadCreateCharacterLookOptions,
    refreshCharacterModeInjectionBundleForSubmission,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    resolveCharacterModeSubmissionOverrides,
    resolveIsCharacterModeEnabledForTool,
    resolveSelectedCharacterIdForTool,
    selectedCreateCharacterLookLabel,
    setCreateSelectedCharacterId,
    trackCharacterModeFallback,
  } = useAiStudioPageCharacterRuntime({
    createCharacterModeInjectionBundle,
    createSelectedCharacterLookId,
    editCharacterModeInjectionBundle,
    editSelectedCharacterId,
    expertCreateMode,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    isEditCharacterBundleLoading,
    isEditCharacterModeEnabled,
    projectId,
    projectRouteRequested,
    selectedTool,
    setCharacterCreateRequestKey,
    setCreateCharacterModeInjectionBundle,
    setCreateSelectedCharacterLookId,
    setEditCharacterModeInjectionBundle,
    setElementCreateRequestKey,
    setIsCreateCharacterBundleLoading,
    setIsEditCharacterBundleLoading,
    setSelectedToolWithEditIntentReset,
    setUiError,
    trackCharacterModeEvent: trackUiEvent,
  });
  return {
    activeCreatePrompt,
    activeCreatePulsePresetId,
    activeOutput,
    activeOutputId,
    activeSessionPersistenceSessionId,
    addAgentPromptReference,
    addCharacterReferences,
    addCuratedReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
    removeReferencesForDeletedMedia,
    ingestReferenceFiles,
    addOutputsFromFiles,
    addPastedMediaReference,
    insertPastedMediaReference,
    addPastedPromptReference,
    archivedOutputs,
    aspect,
    balanceCredits,
    balanceError,
    balanceLoading,
    bootstrapProjectId,
    buildProjectWorkspaceSnapshot,
    buildSessionSnapshot,
    canvasSessionState,
    characterCreateRequestKey,
    pendingCharacterUploadRequest,
    clearPendingCharacterUploadRequest,
    clearGenerationOutput,
    clearPulseRuntime,
    closeModelModal,
    createCharacterModeInjectionBundle,
    createIsGenerating,
    characterOptions,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    curatedReferenceIds,
    currentModelLabel,
    deleteOutput,
    detailOutput,
    sharedDetailModalItem,
    detailSelectionTarget,
    editIsGenerating,
    editReferenceText,
    editSelectedCharacterId,
    editSubmitIntent,
    effectiveBalanceCredits,
    elementCreateRequestKey,
    expertCreateMode,
    expertEditCustomPresetOverrides,
    expertEditSystemPresetDefinitions,
    expertEditSessionState,
    expertEditSessionRevision,
    extraImageUrls,
    findOutputById,
    generateOutput,
    getExpertEditSessionState,
    getAgentContext,
    getDefaultDurationSeconds,
    handleActiveCreatePulsePresetIdChange,
    handleCharacterPanelSelectedCharacterChange,
    handleCreateCharacterSelection,
    handleExpertCreateModeChange,
    handleOpenCharacterCreate,
    handleOpenElementCreate,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryPromptDrop,
    handleQuickSlotDroppedFiles,
    handleQuickSlotDroppedMediaReference,
    hydrateCanvasSessionState,
    hydrateFromSessionSnapshot,
    imageExtraImageUrls,
    imageReferenceImageUrl,
    imageResolution,
    insertOptimisticGenerationPlaceholder,
    isCharacterOptionsLoading,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    isEditCharacterModeEnabled,
    isModelModalOpen,
    isPrimaryEditStageGenerating,
    isProjectsModalOpen,
    klingCfgScale,
    klingElements,
    klingMultiPrompts,
    klingNegativePrompt,
    klingShotType,
    klingVoiceIds,
    klingWorkflowMode,
    loadCreateCharacterLookOptions,
    localSessionTitleOverride,
    mediaProjectNameFocusRequestKey,
    mediaAutosaveEnabled,
    mediaAutosaveError,
    mediaAutosaveSyncState,
    mode,
    model,
    modelModalAnchor,
    modelModalContext,
    modelPricingPolicy,
    modelPricingPolicyError,
    modelPricingPolicyLoading,
    modelPricingPolicyReady,
    motionReferenceVideoPending,
    motionReferenceVideoError,
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    onReferenceOutputMediaLoaded,
    openModelModal,
    optimisticDebitEntries,
    optimisticUncoveredDebitCredits,
    outputs,
    pendingHoldCredits,
    publishExpertEditSessionState,
    project,
    projectError,
    projectErrorKind,
    projectId,
    projectRouteRequested,
    projectStatus,
    requestedProjectId,
    pulsePrompt,
    pulseSessionInstanceId,
    pulseWorkflowSession,
    railCanvasProps,
    referenceGridFileInputRef,
    referenceGridPreconnectOrigin,
    referenceGridReadyOutputIds,
    referenceImageUrl,
    refreshBalance,
    refreshCharacterModeInjectionBundleForSubmission,
    refreshCharacterOptions,
    refreshProject,
    regenerateOutput,
    removeCuratedReference,
    removeOptimisticGenerationPlaceholder,
    removedFromAllRefsIds,
    reorderCuratedReference,
    rerollOutputFromReplay,
    resolveCharacterAvatarUrlById,
    resolveCharacterDropReference,
    resolveCharacterModeSubmissionOverrides,
    resolveComposerInternalImageDropSource,
    resolveElementProfileImageDropSource,
    resolveIsCharacterModeEnabledForTool,
    resolveMediaLibraryInternalDropItem,
    resolvePanelOutputPreviewUrl,
    resolveReferenceInputsForTool,
    resolveSelectedCharacterIdForTool,
    resolveStyleLibraryInternalDrop,
    resolveVoiceChangerInternalReferenceSource,
    restartPulse,
    restoreAllArchivedOutputs,
    restoreArchivedOutput,
    retryOutputStatus,
    router,
    savePromptToLibrary,
    saveReferenceToLibrary,
    seedance2InputMode,
    seedance2ReferenceAudioUrls,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
    selectedCreateCharacterLookLabel,
    selectedExpertEditPresetIds,
    selectedStyleContext,
    selectedTool,
    sessionId,
    sessionPersistenceTitleOverride,
    setActiveOutputId,
    setAspect,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setDetailSelectionTarget,
    setDetailOutputId,
    setEditReferenceText,
    setEditSelectedCharacterId,
    setEditSubmitIntent,
    setExpertEditCustomPresetOverrides,
    setExpertEditSessionState,
    setImageExtraImageUrl,
    setImageReferenceImageUrl,
    setImageResolution,
    setIsCreateCharacterModeEnabled,
    setIsEditCharacterModeEnabled,
    setIsProjectsModalOpen,
    setMediaProjectNameFocusRequestKey,
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
    stageMotionVideoSelection,
    clearMotionVideoSelection,
    setMusicLyricsDraft,
    setMusicPromptDraft,
    setOptimisticDebitEntries,
    setOutputs,
    setPulseCreatePrompt,
    setPulseWorkflowSession,
    setReferenceImageUrl,
    setSeedance2InputMode,
    setSeedance2ReferenceAudioUrls,
    setSeedance2ReferenceImageUrls,
    setSeedance2ReferenceVideoUrls,
    setSeedance2ReturnLastFrame,
    setSeedance2WebSearch,
    setSelectedExpertEditPresetIds,
    setSelectedStyleContext,
    setSelectedStylePrompt,
    setSelectedToolWithEditIntentReset,
    setSessionTitleOverrideState,
    setShowCreateTools,
    setSoundEffectsPromptDraft,
    setStandardCreatePrompt,
    setUiError,
    setUiNotice,
    setVideoAutoFix,
    setVideoCameraFixed,
    setVideoDurationSeconds,
    setVideoExtraImageUrl,
    setVideoGenerateAudio,
    setVideoReferenceImageUrl,
    setVideoReferenceMode,
    setVideoReferenceText,
    setVideoResolution,
    setVoiceDesignPromptDraft,
    setVoiceScriptDraft,
    showCreateTools,
    standardPrompt,
    trackCharacterModeFallback,
    trackUiEvent,
    uiError,
    uiNotice,
    updateOutputById,
    updateOutputPrompt,
    updateProjectTitle,
    useReferenceImageIndicator,
    voiceDesignPromptDraft,
    voiceScriptDraft,
    videoAutoFix,
    videoCameraFixed,
    videoDurationSeconds,
    videoExtraImageUrls,
    videoGenerateAudio,
    musicLyricsDraft,
    musicPromptDraft,
    musicDurationSeconds,
    soundEffectsPromptDraft,
    soundEffectsDurationSeconds,
    videoReferenceImageUrl,
    videoReferenceMode,
    videoReferenceText,
    videoResolution,
    setMusicDurationSeconds,
    setSoundEffectsDurationSeconds,
  };
};

export type AiStudioPageBaseRuntime = ReturnType<typeof useAiStudioPageBaseRuntime>;
