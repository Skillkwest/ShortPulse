import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { CreateRuntimeAgentHydrationPayload } from "../createRuntime/sessionAgentHydrationBoundary";
import { useAiStudioEditSubmitIntent } from "./useAiStudioEditSubmitIntent";
import { useAiStudioInternalDropResolvers } from "./useAiStudioInternalDropResolvers";
import { useAiStudioCreateModeRuntime } from "./useAiStudioCreateModeRuntime";
import { useAiStudioPageCharacterRuntime } from "./useAiStudioPageCharacterRuntime";
import { useAiStudioPageCreditDerivations } from "./useAiStudioPageCreditDerivations";
import { useAiStudioPageMediaReferenceRuntime } from "./useAiStudioPageMediaReferenceRuntime";
import { useAiStudioPageOutputAdapters } from "./useAiStudioPageOutputAdapters";
import { useAiStudioPerfAuditRuntime } from "./useAiStudioPerfAuditRuntime";
import { useAiStudioState } from "./useAiStudioState";
import { useCredits } from "./useCredits";
import { useEffectiveBeginnerModePreference } from "./useEffectiveBeginnerModePreference";
import { useExpertEditPresetPanelPreference } from "./useExpertEditPresetPanelPreference";
import { useMediaAutosavePreference } from "./useMediaAutosavePreference";
import { useAiStudioMediaAutosaveOrchestrator } from "./useAiStudioMediaAutosaveOrchestrator";
import { useAiStudioProjectIdentity } from "./useAiStudioProjectIdentity";
import { useAiStudioSessionIdentity } from "./useAiStudioSessionIdentity";
import { useActiveModelPricingPolicy } from "./useActiveModelPricingPolicy";
import { useCharacterWorkflow } from "../../character/hooks/useCharacterWorkflow";
import { isEditWorkflow } from "../logic/workflowIdentity";
import {
  PERF_FLAG_AUDIT_RUNTIME,
  PERF_FLAG_OUTPUT_SELECTOR_STORE,
  PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS,
  PERF_FLAG_SELECTOR_CALLBACKS,
} from "../logic/perfProfileFlags";
import type { StudioOutput, ToolId } from "../types";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";

const FLAG_OUTPUT_SELECTOR_STORE = PERF_FLAG_OUTPUT_SELECTOR_STORE;
const FLAG_SELECTOR_CALLBACKS = PERF_FLAG_SELECTOR_CALLBACKS;
const FLAG_REFERENCE_GRID_PRECONNECT_HINTS = PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS;
const FLAG_PERF_AUDIT_RUNTIME = PERF_FLAG_AUDIT_RUNTIME;

type OptimisticDebitEntry = { credits: number; outputId: string | null; createdAtMs?: number };

export const useAiStudioPageBaseRuntime = () => {
  const router = useRouter();
  const { sessionId } = useAiStudioSessionIdentity();

  const {
    mediaAutosaveEnabled,
    syncState: mediaAutosaveSyncState,
    error: mediaAutosaveError,
  } = useMediaAutosavePreference();
  const {
    presetPanelIds: selectedExpertEditPresetIds,
    customPresetOverrides: expertEditCustomPresetOverrides,
    setPresetPanelIds: setSelectedExpertEditPresetIds,
    setCustomPresetOverrides: setExpertEditCustomPresetOverrides,
  } = useExpertEditPresetPanelPreference();
  const { balanceCents, balanceReservedCents, balanceLoading, refreshBalance } = useCredits();
  const {
    modelPricingPolicy,
    modelPricingPolicyReady,
    modelPricingPolicyLoading,
    modelPricingPolicyError,
  } = useActiveModelPricingPolicy({
    enabled: true,
  });
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents));
  }, [balanceCents]);
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [isCreateCharacterBundleLoading, setIsCreateCharacterBundleLoading] = useState(false);
  const [isEditCharacterBundleLoading, setIsEditCharacterBundleLoading] = useState(false);
  const [isCreateCharacterModeEnabled, setIsCreateCharacterModeEnabled] = useState(false);
  const [isEditCharacterModeEnabled, setIsEditCharacterModeEnabled] = useState(false);
  const [createSelectedCharacterLookId, setCreateSelectedCharacterLookId] = useState("");
  const [characterCreateRequestKey, setCharacterCreateRequestKey] = useState(0);
  const [elementCreateRequestKey, setElementCreateRequestKey] = useState(0);
  const [editSelectedCharacterId, setEditSelectedCharacterId] = useState("");
  const [selectedStylePrompt, setSelectedStylePrompt] = useState<string | null>(null);
  const [selectedStyleContext, setSelectedStyleContext] = useState<
    StudioOutput["styleContext"] | null
  >(null);
  const [sessionTitleOverrideState, setSessionTitleOverrideState] = useState<{
    sessionId: string;
    title: string | null;
  } | null>(null);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [createCharacterModeInjectionBundle, setCreateCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const [editCharacterModeInjectionBundle, setEditCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const localSessionTitleOverride =
    sessionTitleOverrideState?.sessionId === sessionId ? sessionTitleOverrideState.title : null;
  const {
    verifiedProjectId,
    projectRouteRequested,
    project,
    status: projectStatus,
    error: projectError,
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
    error: characterError,
    addReferences: addCharacterReferences,
    clearError: clearCharacterError,
  } = useCharacterWorkflow();
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
    setMotionReferenceVideoUrl,
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
    createIsGenerating,
    editIsGenerating,
    expertEditSessionState,
    expertEditSessionRevision,
    publishExpertEditSessionState,
    getExpertEditSessionState,
    setExpertEditSessionState,
    useReferenceImageIndicator,
    detailOutput,
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
    savePromptReference,
    savePromptToLibrary,
    addOutputsFromFiles,
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
      setSelectedTool(nextTool);
    },
    [resetEditSubmitIntent, selectedTool, setSelectedTool]
  );
  const {
    resolveCharacterDropReference,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    resolveElementProfileImageDropSource,
  } = useAiStudioInternalDropResolvers({
    getOutputById,
    getOutputSnapshot,
    ensureOutputPersisted,
  });
  const {
    canvasSessionState,
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
    getOutputById,
    reorderCuratedReference,
    setActiveOutputId,
  });
  useAiStudioMediaAutosaveOrchestrator({
    outputs,
    mediaAutosaveEnabled,
    saveReferenceToLibrary,
  });
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
    setActiveOutputId,
    setOutputs,
  });

  const referenceGridFileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    beginnerMode,
    loading: beginnerModeLoading,
    error: beginnerModeError,
    syncState: beginnerModeSyncState,
    showBeginnerModeToggle,
    setBeginnerMode,
  } = useEffectiveBeginnerModePreference();
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
    handleCreateCharacterSelection,
    handleOpenCharacterCreate,
    handleOpenCharacterLibrary,
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
  const pendingCreateRuntimeAgentHydrationRef = useRef<CreateRuntimeAgentHydrationPayload | null>(
    null
  );
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
    addOutputsFromFiles,
    addPastedMediaReference,
    addPastedPromptReference,
    archivedOutputs,
    aspect,
    balanceCredits,
    balanceLoading,
    beginnerMode,
    beginnerModeError,
    beginnerModeLoading,
    beginnerModeSyncState,
    buildSessionSnapshot,
    canvasSessionState,
    characterCreateRequestKey,
    characterError,
    clearCharacterError,
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
    editIsGenerating,
    editReferenceText,
    editSelectedCharacterId,
    editSubmitIntent,
    effectiveBalanceCredits,
    elementCreateRequestKey,
    expertCreateMode,
    expertEditCustomPresetOverrides,
    expertEditSessionState,
    expertEditSessionRevision,
    extraImageUrls,
    findOutputById,
    generateOutput,
    getExpertEditSessionState,
    getAgentContext,
    getDefaultDurationSeconds,
    handleActiveCreatePulsePresetIdChange,
    handleCreateCharacterSelection,
    handleExpertCreateModeChange,
    handleOpenCharacterCreate,
    handleOpenCharacterLibrary,
    handleOpenElementCreate,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryPromptDrop,
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
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    onReferenceOutputMediaLoaded,
    openModelModal,
    optimisticDebitEntries,
    optimisticUncoveredDebitCredits,
    outputs,
    pendingCreateRuntimeAgentHydrationRef,
    pendingHoldCredits,
    publishExpertEditSessionState,
    project,
    projectError,
    projectId,
    projectRouteRequested,
    projectStatus,
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
    savePromptReference,
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
    setBeginnerMode,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
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
    showBeginnerModeToggle,
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
    videoAutoFix,
    videoCameraFixed,
    videoDurationSeconds,
    videoExtraImageUrls,
    videoGenerateAudio,
    videoReferenceImageUrl,
    videoReferenceMode,
    videoReferenceText,
    videoResolution,
  };
};

export type AiStudioPageBaseRuntime = ReturnType<typeof useAiStudioPageBaseRuntime>;
