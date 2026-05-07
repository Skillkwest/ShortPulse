/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiStudioPageShell } from "../features/ai-studio/components/AiStudioPageShell";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import {
  normalizeAiStudioProjectName,
  resolveProjectEntryPhase,
} from "../features/ai-studio/logic/aiStudioPageProjectState";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { useActiveModelPricingPolicy } from "../features/ai-studio/hooks/useActiveModelPricingPolicy";
import { useAiStudioEditSubmitIntent } from "../features/ai-studio/hooks/useAiStudioEditSubmitIntent";
import { useEffectiveBeginnerModePreference } from "../features/ai-studio/hooks/useEffectiveBeginnerModePreference";
import { useMediaAutosavePreference } from "../features/ai-studio/hooks/useMediaAutosavePreference";
import { useExpertEditPresetPanelPreference } from "../features/ai-studio/hooks/useExpertEditPresetPanelPreference";
import { useAiStudioMediaAutosaveOrchestrator } from "../features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator";
import { addBreadcrumb } from "../lib/clientBreadcrumbs";
import { useAiStudioAgentOutputGenerationBridge } from "../features/ai-studio/hooks/useAiStudioAgentOutputGenerationBridge";
import { useAiStudioGenerationController } from "../features/ai-studio/hooks/useAiStudioGenerationController";
import { type CharacterModeInjectionBundle } from "../features/ai-studio/hooks/useAiStudioCharacterModeController";
import { useAiStudioReferenceAssetActions } from "../features/ai-studio/hooks/useAiStudioReferenceAssetActions";
import { useAiStudioWorkspaceActions } from "../features/ai-studio/hooks/useAiStudioWorkspaceActions";
import { useAiStudioPageDerivations } from "../features/ai-studio/hooks/useAiStudioPageDerivations";
import { useAiStudioEditExpertPanelProps } from "../features/ai-studio/hooks/useAiStudioEditExpertPanelProps";
import { useAiStudioReferenceGridProps } from "../features/ai-studio/hooks/useAiStudioReferenceGridProps";
import { useAiStudioPreviewDetailProps } from "../features/ai-studio/hooks/useAiStudioPreviewDetailProps";
import { useAiStudioVideoPanelProps } from "../features/ai-studio/hooks/useAiStudioVideoPanelProps";
import { useAiStudioInternalDropResolvers } from "../features/ai-studio/hooks/useAiStudioInternalDropResolvers";
import { mapHookContractsToPageContentProps } from "../features/ai-studio/hooks/contracts/pageContentAdapter";
import { useAiStudioProjectIdentity } from "../features/ai-studio/hooks/useAiStudioProjectIdentity";
import { useAiStudioSessionIdentity } from "../features/ai-studio/hooks/useAiStudioSessionIdentity";
import { useAiStudioPageSessionPersistence } from "../features/ai-studio/hooks/useAiStudioPageSessionPersistence";
import { useAiStudioPageOutputAdapters } from "../features/ai-studio/hooks/useAiStudioPageOutputAdapters";
import { useAiStudioPageUiNotices } from "../features/ai-studio/hooks/useAiStudioPageUiNotices";
import { useAiStudioPageCreditDerivations } from "../features/ai-studio/hooks/useAiStudioPageCreditDerivations";
import { useAiStudioPerfAuditRuntime } from "../features/ai-studio/hooks/useAiStudioPerfAuditRuntime";
import { useAiStudioPageGenerationRuntime } from "../features/ai-studio/hooks/useAiStudioPageGenerationRuntime";
import { useAiStudioPageMediaReferenceRuntime } from "../features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime";
import { useAiStudioPageProjectSessionRuntime } from "../features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime";
import { useAiStudioPageCharacterRuntime } from "../features/ai-studio/hooks/useAiStudioPageCharacterRuntime";
import { createWorkflowBeginnerModePolicy } from "../features/ai-studio/logic/beginnerWorkflowPolicy";
import { useAiStudioCreateModeRuntime } from "../features/ai-studio/hooks/useAiStudioCreateModeRuntime";
import { useCreatePulsePresetPageRuntime } from "../features/ai-studio/hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime";
import { buildPulseCreateRuntimeResult } from "../features/ai-studio/createRuntime/buildPulseCreateRuntimeResult";
import { buildStandardCreateRuntimeResult } from "../features/ai-studio/createRuntime/buildStandardCreateRuntimeResult";
import type {
  CreatePageAgentRuntime,
  PulseCreatePageAgentRuntime,
} from "../features/ai-studio/createRuntime/contracts";
import type { CreateRuntimeAgentHydrationPayload } from "../features/ai-studio/createRuntime/sessionAgentHydrationBoundary";
import { usePulseCreateAgentRuntime } from "../features/ai-studio/createRuntime/usePulseCreateAgentRuntime";
import { useStandardCreateAgentRuntime } from "../features/ai-studio/createRuntime/useStandardCreateAgentRuntime";
import {
  resolvePulseArtifactGenerationRoute,
  usePulseCreatePrimarySubmit,
} from "../features/ai-studio/hooks/pulseCreateRuntime/usePulseCreatePrimarySubmit";
import { useStandardCreateInlineGenerate } from "../features/ai-studio/hooks/standardCreateRuntime/useStandardCreateInlineGenerate";
import { useStandardCreatePrimarySubmit } from "../features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit";
import { isEditWorkflow } from "../features/ai-studio/logic/workflowIdentity";
import type { StudioMode, StudioOutput, ToolId } from "../features/ai-studio/types";
import {
  PERF_FLAG_AUDIT_RUNTIME,
  PERF_FLAG_OUTPUT_SELECTOR_STORE,
  PERF_FLAG_PAGE_OUTPUT_DECOUPLE,
  PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS,
  PERF_FLAG_SELECTOR_CALLBACKS,
} from "../features/ai-studio/logic/perfProfileFlags";
const FLAG_OUTPUT_SELECTOR_STORE = PERF_FLAG_OUTPUT_SELECTOR_STORE;
const FLAG_SELECTOR_CALLBACKS = PERF_FLAG_SELECTOR_CALLBACKS;
const FLAG_PAGE_OUTPUT_DECOUPLE = PERF_FLAG_PAGE_OUTPUT_DECOUPLE;
const FLAG_REFERENCE_GRID_PRECONNECT_HINTS = PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS;
const FLAG_PERF_AUDIT_RUNTIME = PERF_FLAG_AUDIT_RUNTIME;
type OptimisticDebitEntry = { credits: number; outputId: string | null; createdAtMs?: number };

const useAiStudioPageBaseRuntime = () => {
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
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
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
  // Character workflow state (shared with Character tool workflows and error surfaces)
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

type AiStudioPageBaseRuntime = ReturnType<typeof useAiStudioPageBaseRuntime>;
type CreatePulsePresetPageRuntime = ReturnType<typeof useCreatePulsePresetPageRuntime>;
type CreateRuntimeRootSharedProps = {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
};
type CreatePanelProps = React.ComponentProps<typeof AiStudioPageContent>["propertiesCreate"];
type EditPanelProps = React.ComponentProps<typeof AiStudioPageContent>["propertiesEditExpert"];
type VideoPanelProps = React.ComponentProps<typeof AiStudioPageContent>["propertiesVideo"];
type PageContentRuntimeProps = ReturnType<typeof mapHookContractsToPageContentProps>;
type ModelModalState = React.ComponentProps<typeof AiStudioPageContent>["modelModalState"];
type CreatePanelGenerateOptions = {
  modeOverride?: StudioMode;
  toolOverride?: ToolId | null;
  costOverrideCredits?: number | null;
  suppressStyle?: boolean;
};
type CreatePanelGenerateResult = {
  accepted: boolean;
  optimisticOutputId: string | null;
};
type CreatePanelHandleGenerate = (
  promptOverride?: string | null,
  options?: CreatePanelGenerateOptions
) => Promise<CreatePanelGenerateResult>;
type CreatePanelHandlePulsePresetStart = NonNullable<
  PulseCreatePageAgentRuntime["handlePulsePresetStart"]
>;
type UseAiStudioCreatePanelRuntimeParams = {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
  activeCreateAgentRuntime: CreatePageAgentRuntime;
  workflowBeginnerPolicy: ReturnType<typeof createWorkflowBeginnerModePolicy>;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  effectiveGenerationGuardrail: string | null;
  effectiveIsGenerateDisabled: boolean;
  pulseArtifactTarget: Parameters<typeof resolvePulseArtifactGenerationRoute>[0];
  pulseCurrentCostCredits: number | null;
  pulsePromptReferenceGenerateCostCredits: number | null;
  pulseGenerationGuardrail: string | null;
  pulseGenerateCostCredits: number | null;
  handleStandardCreatePromptChange: (value: string) => void;
  handlePulseCreatePromptChange: (value: string) => void;
  handleExpertCreateModeChangeForPage: (value: "standard" | "pulse") => void;
  handleActiveCreatePulsePresetIdChangeForPage: (
    presetId: string | null,
    options?: Parameters<
      CreatePulsePresetPageRuntime["handleActiveCreatePulsePresetIdChangeForPage"]
    >[1]
  ) => string | null | void;
  handleCreatePulsePresetStart: CreatePanelHandlePulsePresetStart;
  handleGenerate: CreatePanelHandleGenerate;
  handleOpenModelModal: ReturnType<typeof useAiStudioWorkspaceActions>["handleOpenModelModal"];
  handleStandardAgentCaptureResult: (promptText: string, referenceTitle?: string | null) => void;
};
type UseAiStudioEditVideoPanelRuntimesParams = {
  base: AiStudioPageBaseRuntime;
  workflowBeginnerPolicy: ReturnType<typeof createWorkflowBeginnerModePolicy>;
  currentCostCredits: number | null;
  effectiveGenerationGuardrail: string | null;
  effectiveIsGenerateDisabled: boolean;
  referenceImageWarning: string | null;
  handleOpenModelModal: ReturnType<typeof useAiStudioWorkspaceActions>["handleOpenModelModal"];
  handleEditPromptTextChange: ReturnType<
    typeof useAiStudioWorkspaceActions
  >["handleEditPromptTextChange"];
  handleVideoPromptTextChange: ReturnType<
    typeof useAiStudioWorkspaceActions
  >["handleVideoPromptTextChange"];
  handleImageRegenerateWithDebit: ReturnType<
    typeof useAiStudioGenerationController
  >["handleImageRegenerateWithDebit"];
  handleRegenerateWithDebit: ReturnType<
    typeof useAiStudioGenerationController
  >["handleRegenerateWithDebit"];
};
type UseAiStudioReferenceExperienceRuntimeParams = {
  base: AiStudioPageBaseRuntime;
  linkedPromptReferenceIds: string[];
  propertiesCreate: CreatePanelProps;
  propertiesEditExpert: EditPanelProps;
  propertiesVideo: VideoPanelProps;
  handleSelectOutput: ReturnType<typeof useAiStudioWorkspaceActions>["handleSelectOutput"];
  handleManualPromptChange: ReturnType<
    typeof useAiStudioWorkspaceActions
  >["handleManualPromptChange"];
  handleRegenerateWithDebit: ReturnType<
    typeof useAiStudioGenerationController
  >["handleRegenerateWithDebit"];
  handleOpenMediaLibrary: ReturnType<typeof useAiStudioWorkspaceActions>["handleOpenMediaLibrary"];
};
type UseAiStudioShellRuntimeParams = {
  base: AiStudioPageBaseRuntime;
  sessionRestoreCandidate: ReturnType<
    typeof useAiStudioPageSessionPersistence
  >["sessionRestoreCandidate"];
  projectBootstrapApplied: boolean;
  filteredModelOptions: ReturnType<typeof useAiStudioPageDerivations>["filteredModelOptions"];
  resolveModelPickerCredits: ReturnType<typeof useAiStudioViewModel>["resolveModelPickerCredits"];
  handleSelectModelFromModal: ReturnType<
    typeof useAiStudioWorkspaceActions
  >["handleSelectModelFromModal"];
};

const useAiStudioCreatePanelRuntime = ({
  base,
  createPulsePageRuntime,
  activeCreateAgentRuntime,
  workflowBeginnerPolicy,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  hasSufficientCreditsForPromptReferenceGenerate,
  effectiveGenerationGuardrail,
  effectiveIsGenerateDisabled,
  pulseArtifactTarget,
  pulseCurrentCostCredits,
  pulsePromptReferenceGenerateCostCredits,
  pulseGenerationGuardrail,
  pulseGenerateCostCredits,
  handleStandardCreatePromptChange,
  handlePulseCreatePromptChange,
  handleExpertCreateModeChangeForPage,
  handleActiveCreatePulsePresetIdChangeForPage,
  handleCreatePulsePresetStart,
  handleGenerate,
  handleOpenModelModal,
  handleStandardAgentCaptureResult,
}: UseAiStudioCreatePanelRuntimeParams): CreatePanelProps => {
  const {
    activeCreatePulsePresetId,
    aspect,
    characterOptions,
    createIsGenerating,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    currentModelLabel,
    expertCreateMode,
    handleCreateCharacterSelection,
    handleOpenCharacterLibrary,
    imageResolution,
    isCharacterOptionsLoading,
    isCreateCharacterModeEnabled,
    mode,
    model,
    modelModalAnchor,
    pulsePrompt,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    savePromptReference,
    selectedCreateCharacterLookLabel,
    selectedTool,
    setAspect,
    setImageResolution,
    setIsCreateCharacterModeEnabled,
    setMode,
    setSelectedToolWithEditIntentReset,
    setStandardCreatePrompt,
    setUiNotice,
    setVideoReferenceText,
    standardPrompt,
    useReferenceImageIndicator,
  } = base;
  const {
    agentAttachmentError,
    agentAttachments,
    agentBootstrapReady,
    agentBusy,
    agentEnabled,
    agentError,
    agentInput,
    agentIsSending,
    agentMessages,
    agentUiBusy,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDrop,
    handleAgentInputChange,
    handleAgentSend,
    handleAssistantMessageEdit,
    isPromptRefining,
    describeInFlightCount,
    handleClearAgentAttachments,
    handleClearAgentChat,
    handleRemoveAgentAttachment,
    isAgentDropActive,
    persistedAgentRuntime,
    setPromptOrigin,
    stagedAgentPrompt,
  } = activeCreateAgentRuntime;
  const standardCreateAgentRuntime =
    activeCreateAgentRuntime.kind === "standard" ? activeCreateAgentRuntime : null;
  const pulseCreateAgentRuntime =
    activeCreateAgentRuntime.kind === "pulse" ? activeCreateAgentRuntime : null;
  const noopSetChatModeEnabled = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    () => undefined,
    []
  );
  const chatModeEnabled = standardCreateAgentRuntime?.chatModeEnabled ?? true;
  const setChatModeEnabled =
    standardCreateAgentRuntime?.setChatModeEnabled ?? noopSetChatModeEnabled;
  const handleProviderPrimarySubmit = useCallback(() => {
    void handleGenerate();
  }, [handleGenerate]);
  const handleStandardCreatePrimarySubmit = useStandardCreatePrimarySubmit({
    mode,
    selectedTool,
    chatModeEnabled,
    agentInput,
    prompt: standardPrompt,
    currentCostCredits,
    promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits ?? null,
    handleAgentSend,
    handleGenerate,
    handleProviderPrimarySubmit,
    handleStandardAgentCaptureResult,
    setPromptOrigin,
  });
  const handleChatOffInlineGenerate = useStandardCreateInlineGenerate({
    agentInput,
    prompt: standardPrompt,
    currentCostCredits,
    promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits ?? null,
    handleGenerate,
    setPromptOrigin,
  });
  const { assistantBubbleMedia, handleGenerateFromAgentOutputPrompt } =
    useAiStudioAgentOutputGenerationBridge({
      enabled: expertCreateMode !== "pulse",
      outputs: base.outputs,
      referenceGridReadyOutputIds: base.referenceGridReadyOutputIds,
      mode,
      selectedTool,
      isGenerateDisabled: effectiveIsGenerateDisabled,
      hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
      model,
      characterModeEnabled: isCreateCharacterModeEnabled,
      selectedCharacterId: createSelectedCharacterId,
      currentCostCredits,
      promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits ?? null,
      setVideoReferenceText,
      setEditReferenceText: base.setEditReferenceText,
      setSharedPrompt: setStandardCreatePrompt,
      setSelectedToolWithEditIntentReset,
      setMode,
      setPromptOrigin,
      handleGenerate,
    });
  const pulsePrimarySubmitGuardrail =
    pulseArtifactTarget != null ? pulseGenerationGuardrail : effectiveGenerationGuardrail;
  const pulsePrimarySubmitCostCredits =
    pulseArtifactTarget != null ? pulseCurrentCostCredits : currentCostCredits;
  const {
    pulseArtifactGenerateGuardrail,
    pulseArtifactGenerateDisabled,
    handlePulseCreatePrimarySubmit,
  } = usePulseCreatePrimarySubmit({
    hasActivePulseSession: createPulsePageRuntime.hasActivePulseSession,
    pulseKind: createPulsePageRuntime.activeCreatePulsePresetSnapshot?.pulseKind ?? null,
    pulseWorkflowSession: base.pulseWorkflowSession,
    latestAgentPrompt: pulseCreateAgentRuntime?.latestAgentPrompt ?? null,
    artifactTarget: pulseArtifactTarget,
    effectiveGenerationGuardrail: pulsePrimarySubmitGuardrail,
    promptReferenceGenerateCostCredits: pulsePromptReferenceGenerateCostCredits ?? null,
    currentCostCredits: pulsePrimarySubmitCostCredits,
    handleGenerate,
    setUiNotice,
  });
  const createGenerateCostCredits =
    mode === "text" && !chatModeEnabled
      ? (promptReferenceGenerateCostCredits ?? currentCostCredits)
      : currentCostCredits;
  const expertCreatePolicy = workflowBeginnerPolicy.create;
  const { pulsePreferenceRuntime, activeCreatePulsePresetSnapshot, hasActivePulseSession } =
    createPulsePageRuntime;

  return useMemo<CreatePanelProps>(() => {
    if (expertCreateMode === "pulse") {
      const pulseRuntime = buildPulseCreateRuntimeResult({
        props: {
          pulsePrompt,
          hasActiveSession: hasActivePulseSession,
          activePresetId: activeCreatePulsePresetId,
          activePresetLabel: activeCreatePulsePresetSnapshot?.label ?? null,
          activePresetKind: activeCreatePulsePresetSnapshot?.pulseKind ?? null,
          workflowSession: base.pulseWorkflowSession,
          createIsGenerating,
          currentCostCredits: pulseGenerateCostCredits,
          isGenerateDisabled: pulseArtifactGenerateDisabled,
          generationGuardrail: pulseArtifactGenerateGuardrail,
          expertCreateUiEligible: expertCreatePolicy.expertCreateEligible,
          onPulsePromptChange: handlePulseCreatePromptChange,
          onActivePresetIdChange: handleActiveCreatePulsePresetIdChangeForPage,
          onSavePromptReference: savePromptReference,
          pulsePreferenceRuntime,
          generationServices: { handleGenerate },
        },
        agentRuntime: {
          agentEnabled,
          agentBootstrapReady,
          agentMessages,
          agentInput,
          agentBusy,
          agentIsSending,
          agentUiBusy,
          agentAttachmentError,
          agentError,
          stagedAgentPrompt,
          agentAttachments,
          isAgentDropActive,
          workflowSession: base.pulseWorkflowSession,
          persistedAgentRuntime,
        },
        actions: {
          onAgentInputChange: handleAgentInputChange,
          onAgentSend: handleAgentSend,
          onAgentAttachmentDrop: handleAgentAttachmentDrop,
          onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
          onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
          onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
          onRemoveAgentAttachment: handleRemoveAgentAttachment,
          onClearAgentAttachments: handleClearAgentAttachments,
          onAssistantMessageEdit: handleAssistantMessageEdit,
          onClearAgentChat: handleClearAgentChat,
          onGenerateArtifact: handlePulseCreatePrimarySubmit,
          onPresetStart: handleCreatePulsePresetStart,
        },
      });
      return {
        expertCreateMode: "pulse",
        onExpertCreateModeChange: handleExpertCreateModeChangeForPage,
        pulse: {
          ...pulseRuntime.panelProps,
          hasActivePulseSession,
          pulseWorkflowSession: base.pulseWorkflowSession,
          activePulsePresetId: activeCreatePulsePresetId,
          activePulsePresetLabel: activeCreatePulsePresetSnapshot?.label ?? null,
          activePulsePresetKind: activeCreatePulsePresetSnapshot?.pulseKind ?? null,
          onActivePulsePresetIdChange: handleActiveCreatePulsePresetIdChangeForPage,
          onPulsePresetStart: handleCreatePulsePresetStart,
        },
      };
    }

    const standardRuntime = buildStandardCreateRuntimeResult({
      props: {
        prompt: standardPrompt,
        mode,
        selectedTool,
        aspect,
        model,
        currentModelLabel,
        createIsGenerating,
        isPromptRefining,
        describeInFlightCount,
        createGenerateCostCredits,
        promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits ?? null,
        hasSufficientCreditsForPromptReferenceGenerate,
        isGenerateDisabled: effectiveIsGenerateDisabled,
        generationGuardrail: effectiveGenerationGuardrail,
        useReferenceImageIndicator,
        isModelModalOpen: base.isModelModalOpen,
        modelModalAnchor,
        characterOptions,
        selectedCharacterId: createSelectedCharacterId,
        selectedCharacterLookId: createSelectedCharacterLookId,
        selectedCharacterLookLabel: selectedCreateCharacterLookLabel,
        isCharacterOptionsLoading,
        isCharacterModeEnabled: isCreateCharacterModeEnabled,
        imageResolution,
        beginnerCreateMode: expertCreatePolicy.beginnerMode,
        expertCreateUiEligible: expertCreatePolicy.expertCreateEligible,
        onPromptChange: handleStandardCreatePromptChange,
        onAspectChange: setAspect,
        onModelPickerOpen: handleOpenModelModal,
        onSavePromptReference: savePromptReference,
        onSelectedCharacterChange: handleCreateCharacterSelection,
        onOpenCharacterLibrary: handleOpenCharacterLibrary,
        onCharacterModeChange: setIsCreateCharacterModeEnabled,
        onRefreshCharacterOptions: refreshCharacterOptions,
        onLoadCharacterLookOptions: base.loadCreateCharacterLookOptions,
        resolveCharacterAvatarUrlById,
        onImageResolutionChange: setImageResolution,
        generationServices: { handleGenerate },
      },
      agentRuntime: {
        agentEnabled,
        agentBootstrapReady,
        agentMessages,
        agentInput,
        chatModeEnabled,
        agentBusy,
        agentIsSending,
        agentUiBusy,
        agentAttachmentError,
        agentError,
        stagedAgentPrompt,
        assistantBubbleMedia,
        agentAttachments,
        isAgentDropActive,
        persistedAgentRuntime,
      },
      actions: {
        onAgentInputChange: handleAgentInputChange,
        onChatModeChange: setChatModeEnabled,
        onAgentSend: handleAgentSend,
        onAgentAttachmentDrop: handleAgentAttachmentDrop,
        onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
        onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
        onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
        onRemoveAgentAttachment: handleRemoveAgentAttachment,
        onClearAgentAttachments: handleClearAgentAttachments,
        onAssistantMessageEdit: handleAssistantMessageEdit,
        onGenerateFromAgentOutputPrompt: handleGenerateFromAgentOutputPrompt,
        onClearAgentChat: handleClearAgentChat,
        onPrimarySubmit: handleStandardCreatePrimarySubmit,
        onChatOffInlineGenerate: handleChatOffInlineGenerate,
      },
    });
    return {
      expertCreateMode: "standard",
      onExpertCreateModeChange: handleExpertCreateModeChangeForPage,
      standard: standardRuntime.panelProps,
    };
  }, [
    activeCreatePulsePresetId,
    activeCreatePulsePresetSnapshot?.label,
    activeCreatePulsePresetSnapshot?.pulseKind,
    agentAttachmentError,
    agentAttachments,
    agentBootstrapReady,
    agentBusy,
    agentEnabled,
    agentError,
    agentInput,
    agentIsSending,
    agentMessages,
    agentUiBusy,
    aspect,
    assistantBubbleMedia,
    base,
    characterOptions,
    chatModeEnabled,
    createGenerateCostCredits,
    createIsGenerating,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    currentModelLabel,
    describeInFlightCount,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    expertCreateMode,
    expertCreatePolicy.beginnerMode,
    expertCreatePolicy.expertCreateEligible,
    handleActiveCreatePulsePresetIdChangeForPage,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDrop,
    handleAgentInputChange,
    handleAgentSend,
    handleAssistantMessageEdit,
    handleChatOffInlineGenerate,
    handleClearAgentAttachments,
    handleClearAgentChat,
    handleCreateCharacterSelection,
    handleGenerate,
    handleGenerateFromAgentOutputPrompt,
    handleOpenCharacterLibrary,
    handleOpenModelModal,
    handlePulseCreatePromptChange,
    handlePulseCreatePrimarySubmit,
    handleRemoveAgentAttachment,
    handleStandardCreatePromptChange,
    handleStandardCreatePrimarySubmit,
    handleCreatePulsePresetStart,
    handleExpertCreateModeChangeForPage,
    hasActivePulseSession,
    hasSufficientCreditsForPromptReferenceGenerate,
    imageResolution,
    isAgentDropActive,
    isCharacterOptionsLoading,
    isCreateCharacterModeEnabled,
    isPromptRefining,
    mode,
    model,
    modelModalAnchor,
    persistedAgentRuntime,
    promptReferenceGenerateCostCredits,
    pulseArtifactGenerateDisabled,
    pulseArtifactGenerateGuardrail,
    pulseGenerateCostCredits,
    pulsePreferenceRuntime,
    pulsePrompt,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    savePromptReference,
    selectedCreateCharacterLookLabel,
    selectedTool,
    setAspect,
    setChatModeEnabled,
    setImageResolution,
    setIsCreateCharacterModeEnabled,
    stagedAgentPrompt,
    standardPrompt,
    useReferenceImageIndicator,
  ]);
};

const useAiStudioEditVideoPanelRuntimes = ({
  base,
  workflowBeginnerPolicy,
  currentCostCredits,
  effectiveGenerationGuardrail,
  effectiveIsGenerateDisabled,
  referenceImageWarning,
  handleOpenModelModal,
  handleEditPromptTextChange,
  handleVideoPromptTextChange,
  handleImageRegenerateWithDebit,
  handleRegenerateWithDebit,
}: UseAiStudioEditVideoPanelRuntimesParams) => {
  const expertEditEligible = workflowBeginnerPolicy.edit.expertEditEligible;
  const editExpertPanelProps = useAiStudioEditExpertPanelProps({
    expertEditEligible,
    aspect: base.aspect,
    model: base.model,
    currentModelLabel: base.currentModelLabel,
    referenceImageUrl: base.imageReferenceImageUrl,
    extraImageUrls: base.imageExtraImageUrls,
    editReferenceText: base.editReferenceText,
    isModelModalOpen: base.isModelModalOpen,
    modelModalAnchor: base.modelModalAnchor,
    setAspect: base.setAspect,
    handleOpenModelModal,
    setReferenceImageUrl: base.setImageReferenceImageUrl,
    setExtraImageUrl: base.setImageExtraImageUrl,
    handleEditPromptTextChange,
    handleImageRegenerateWithDebit,
    insertOptimisticGenerationPlaceholder: (promptText: string) =>
      base.insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "image",
        selectedToolOverride: "edit",
      }),
    removeOptimisticGenerationPlaceholder: base.removeOptimisticGenerationPlaceholder,
    notifyGenerationFailure: base.notifyGenerationFailure,
    onEditSubmitIntentChange: base.setEditSubmitIntent,
    addSessionMediaReference: base.addPastedMediaReference,
    currentCostCredits,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    isGenerateBusy: base.editIsGenerating,
    generationGuardrail: effectiveGenerationGuardrail,
    isPrimaryStageGenerating: base.isPrimaryEditStageGenerating,
    referenceImageWarning,
    resolveOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    imageResolution: base.imageResolution,
    setImageResolution: base.setImageResolution,
    characterOptions: base.characterOptions,
    selectedCharacterId: base.editSelectedCharacterId,
    setSelectedCharacterId: base.setEditSelectedCharacterId,
    isCharacterOptionsLoading: base.isCharacterOptionsLoading,
    isCharacterModeEnabled: base.isEditCharacterModeEnabled,
    setIsCharacterModeEnabled: base.setIsEditCharacterModeEnabled,
    refreshCharacterOptions: base.refreshCharacterOptions,
    resolveCharacterAvatarUrlById: base.resolveCharacterAvatarUrlById,
    selectedPresetIds: base.selectedExpertEditPresetIds,
    onSelectedPresetIdsChange: base.setSelectedExpertEditPresetIds,
    customPresetOverrides: base.expertEditCustomPresetOverrides,
    onCustomPresetOverridesChange: base.setExpertEditCustomPresetOverrides,
    sessionState: base.expertEditSessionState,
    onSessionStateChange: base.publishExpertEditSessionState,
  });
  const handleVideoPromptSave = useCallback(() => {
    base.savePromptReference(base.videoReferenceText ?? "");
  }, [base]);
  const handleKlingVoiceIdChange = useCallback(
    (index: number, value: string) => {
      base.setKlingVoiceIds((prev) => {
        const next: [string, string] = [...prev] as [string, string];
        next[index] = value;
        return next;
      });
    },
    [base]
  );
  const videoPanelProps = useAiStudioVideoPanelProps({
    aspect: base.aspect,
    model: base.model,
    currentModelLabel: base.currentModelLabel,
    referenceImageUrl: base.videoReferenceImageUrl,
    extraImageUrls: base.videoExtraImageUrls,
    videoReferenceMode: base.videoReferenceMode,
    setVideoReferenceMode: base.setVideoReferenceMode,
    videoDurationSeconds: base.videoDurationSeconds,
    videoResolution: base.videoResolution,
    videoGenerateAudio: base.videoGenerateAudio,
    videoCameraFixed: base.videoCameraFixed,
    videoAutoFix: base.videoAutoFix,
    seedance2InputMode: base.seedance2InputMode,
    seedance2ReferenceImageUrls: base.seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls: base.seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls: base.seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame: base.seedance2ReturnLastFrame,
    seedance2WebSearch: base.seedance2WebSearch,
    setAspect: base.setAspect,
    setVideoDurationSeconds: base.setVideoDurationSeconds,
    setVideoResolution: base.setVideoResolution,
    setVideoGenerateAudio: base.setVideoGenerateAudio,
    setVideoCameraFixed: base.setVideoCameraFixed,
    setVideoAutoFix: base.setVideoAutoFix,
    setSeedance2InputMode: base.setSeedance2InputMode,
    setSeedance2ReferenceImageUrls: base.setSeedance2ReferenceImageUrls,
    setSeedance2ReferenceVideoUrls: base.setSeedance2ReferenceVideoUrls,
    setSeedance2ReferenceAudioUrls: base.setSeedance2ReferenceAudioUrls,
    setSeedance2ReturnLastFrame: base.setSeedance2ReturnLastFrame,
    setSeedance2WebSearch: base.setSeedance2WebSearch,
    videoReferenceText: base.videoReferenceText,
    klingNegativePrompt: base.klingNegativePrompt,
    klingCfgScale: base.klingCfgScale,
    klingWorkflowMode: base.klingWorkflowMode,
    klingShotType: base.klingShotType,
    klingVoiceIds: base.klingVoiceIds,
    klingMultiPrompts: base.klingMultiPrompts,
    klingElements: base.klingElements,
    setKlingNegativePrompt: base.setKlingNegativePrompt,
    setKlingCfgScale: base.setKlingCfgScale,
    setKlingWorkflowMode: base.setKlingWorkflowMode,
    setKlingShotType: base.setKlingShotType,
    handleKlingVoiceIdChange,
    setKlingMultiPrompts: base.setKlingMultiPrompts,
    setKlingElements: base.setKlingElements,
    motionReferenceVideoUrl: base.motionReferenceVideoUrl,
    isModelModalOpen: base.isModelModalOpen,
    modelModalAnchor: base.modelModalAnchor,
    handleOpenModelModal,
    setReferenceImageUrl: base.setVideoReferenceImageUrl,
    setExtraImageUrl: base.setVideoExtraImageUrl,
    setMotionReferenceVideoUrl: base.setMotionReferenceVideoUrl,
    handleVideoPromptTextChange,
    handleVideoPromptSave,
    handleRegenerateWithDebit,
    currentCostCredits,
    referenceImageWarning,
    resolveOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    generationGuardrail: effectiveGenerationGuardrail,
    beginnerMode: workflowBeginnerPolicy.video.beginnerMode,
    onCreateCharacter: base.handleOpenCharacterCreate,
    onCreateElement: base.handleOpenElementCreate,
  });
  return { editExpertPanelProps, videoPanelProps };
};

const useAiStudioReferenceExperienceRuntime = ({
  base,
  linkedPromptReferenceIds,
  propertiesCreate,
  propertiesEditExpert,
  propertiesVideo,
  handleSelectOutput,
  handleManualPromptChange,
  handleRegenerateWithDebit,
  handleOpenMediaLibrary,
}: UseAiStudioReferenceExperienceRuntimeParams): PageContentRuntimeProps => {
  const {
    activeOutput,
    activeOutputId,
    addCuratedReference,
    addPastedMediaReference,
    addPastedPromptReference,
    archivedOutputs,
    clearGenerationOutput,
    curatedReferenceIds,
    deleteOutput,
    detailOutput,
    editReferenceText,
    findOutputById,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryPromptDrop,
    onReferenceOutputMediaLoaded,
    outputs,
    projectId,
    railCanvasProps,
    referenceGridReadyOutputIds,
    referenceImageUrl,
    removedFromAllRefsIds,
    removeCuratedReference,
    reorderCuratedReference,
    rerollOutputFromReplay,
    restoreAllArchivedOutputs,
    restoreArchivedOutput,
    retryOutputStatus,
    savePromptToLibrary,
    saveReferenceToLibrary,
    selectedTool,
    setDetailOutputId,
    setReferenceImageUrl,
    setUiError,
    updateOutputPrompt,
    videoReferenceText,
  } = base;
  const { handleDownloadReference, handleSaveReference } = useAiStudioReferenceAssetActions({
    projectId,
    findOutputById,
    saveReferenceToLibrary,
    setUiError,
  });
  const referenceGridHookProps = useAiStudioReferenceGridProps({
    outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
    archivedOutputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : archivedOutputs,
    activeOutputId,
    topNotice: null,
    curatedReferenceIds,
    removedFromAllRefsIds,
    onReferenceOutputMediaLoaded,
    linkedPromptReferenceIds,
    handleSelectOutput,
    setDetailOutputId,
    handleSaveReference,
    handleDownloadReference,
    handlePasteTextReference: addPastedPromptReference,
    handlePasteMediaReference: addPastedMediaReference,
    retryOutputStatus,
    handleRerollOutput: rerollOutputFromReplay,
    deleteOutput,
    clearGenerationOutput,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
  });
  const referenceGridPageProps = useMemo(
    () => ({
      ...referenceGridHookProps,
      railCanvasProps,
      onAddLibraryMediaReferenceToQuickSlot: handleQuickSlotLibraryMediaDrop,
      onAddLibraryPromptReferenceToQuickSlot: handleQuickSlotLibraryPromptDrop,
    }),
    [
      handleQuickSlotLibraryMediaDrop,
      handleQuickSlotLibraryPromptDrop,
      railCanvasProps,
      referenceGridHookProps,
    ]
  );
  const previewDetailProps = useAiStudioPreviewDetailProps({
    activeOutput,
    referenceGridReadyOutputIds,
    referenceImageUrl,
    selectedTool,
    videoReferenceText,
    editReferenceText,
    setReferenceImageUrl,
    handleManualPromptChange,
    handleRegenerateWithDebit,
    detailOutput,
    setDetailOutputId,
    updateOutputPrompt,
    deleteOutput,
    handleSaveReference,
    handleDownloadReference,
    savePromptToLibrary,
    handleOpenMediaLibrary,
  });

  return mapHookContractsToPageContentProps({
    panelProps: {
      propertiesCreate,
      propertiesEditExpert,
      propertiesVideo,
    },
    referenceGridProps: referenceGridPageProps,
    previewDetailProps,
  });
};

const useAiStudioShellRuntime = ({
  base,
  sessionRestoreCandidate,
  projectBootstrapApplied,
  filteredModelOptions,
  resolveModelPickerCredits,
  handleSelectModelFromModal,
}: UseAiStudioShellRuntimeParams) => {
  const {
    closeModelModal,
    isModelModalOpen,
    localSessionTitleOverride,
    modelModalContext,
    project,
    projectId,
    projectRouteRequested,
    projectStatus,
    router,
    sessionId,
    setIsProjectsModalOpen,
    setSelectedToolWithEditIntentReset,
    setSessionTitleOverrideState,
    setShowCreateTools,
    setUiError,
    updateProjectTitle,
  } = base;
  const effectiveProjectName = useMemo(
    () => project?.title ?? localSessionTitleOverride ?? null,
    [localSessionTitleOverride, project?.title]
  );
  const handleProjectNameCommit = useCallback(
    async (value: string) => {
      if (projectId) {
        try {
          await updateProjectTitle(value);
        } catch (error) {
          setUiError(error instanceof Error ? error.message : "Failed to update project title.");
        }
        return;
      }
      if (!sessionId) return;
      setSessionTitleOverrideState({
        sessionId,
        title: normalizeAiStudioProjectName(value),
      });
    },
    [projectId, sessionId, setSessionTitleOverrideState, setUiError, updateProjectTitle]
  );
  const handleOpenProjectsModal = useCallback(() => {
    setIsProjectsModalOpen(true);
  }, [setIsProjectsModalOpen]);
  const handleCloseProjectsModal = useCallback(() => {
    setIsProjectsModalOpen(false);
  }, [setIsProjectsModalOpen]);
  const handleSelectProjectFromModal = useCallback(
    async (nextProjectId: string) => {
      if (nextProjectId === projectId) return;
      const didNavigate = await router.push({
        pathname: "/ai-studio",
        query: { projectId: nextProjectId },
      });
      if (!didNavigate) {
        throw new Error("Failed to open project.");
      }
    },
    [projectId, router]
  );
  const handleOpenMediaLibraryPanelOnly = useCallback(() => {
    setShowCreateTools(false);
    setSelectedToolWithEditIntentReset("media-library");
  }, [setSelectedToolWithEditIntentReset, setShowCreateTools]);
  const shouldGateProjectBootstrap =
    projectRouteRequested &&
    (projectStatus !== "ready" || (Boolean(projectId) && !projectBootstrapApplied));
  const projectEntryPhase = resolveProjectEntryPhase({
    projectStatus,
    projectRouteRequested,
    projectBootstrapApplied,
    workspaceRestoreCandidate: sessionRestoreCandidate,
  });
  const modelModalState = useMemo<ModelModalState>(
    () => ({
      isOpen: isModelModalOpen,
      options: filteredModelOptions,
      resolveCreditsForModel: resolveModelPickerCredits,
      context: modelModalContext,
      onClose: closeModelModal,
      onSelect: handleSelectModelFromModal,
    }),
    [
      closeModelModal,
      filteredModelOptions,
      handleSelectModelFromModal,
      isModelModalOpen,
      modelModalContext,
      resolveModelPickerCredits,
    ]
  );

  return {
    effectiveProjectName,
    handleProjectNameCommit,
    handleOpenProjectsModal,
    handleCloseProjectsModal,
    handleSelectProjectFromModal,
    handleOpenMediaLibraryPanelOnly,
    shouldGateProjectBootstrap,
    projectEntryPhase,
    modelModalState,
  };
};

export default function AiStudioPage() {
  const base = useAiStudioPageBaseRuntime();
  return <CreateRuntimeRoot base={base} />;
}

const CreateRuntimeRoot = ({ base }: { base: AiStudioPageBaseRuntime }) => {
  const { setPulseCreatePrompt } = base;
  const clearPulsePromptForPage = useCallback(() => {
    setPulseCreatePrompt("");
  }, [setPulseCreatePrompt]);
  const createPulsePageRuntime = useCreatePulsePresetPageRuntime({
    selectedTool: base.selectedTool,
    expertCreateMode: base.expertCreateMode,
    activeCreatePulsePresetId: base.activeCreatePulsePresetId,
    pulseSessionInstanceId: base.pulseSessionInstanceId,
    pulseWorkflowSession: base.pulseWorkflowSession,
    loadSavedPresetPreferences: base.expertCreateMode === "pulse",
    getAgentContext: base.getAgentContext,
    clearPulseRuntime: base.clearPulseRuntime,
    clearPulsePrompt: clearPulsePromptForPage,
    handleExpertCreateModeChange: base.handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange: base.handleActiveCreatePulsePresetIdChange,
  });
  return <CreateAgentRuntimeHost base={base} createPulsePageRuntime={createPulsePageRuntime} />;
};

const CreateAgentRuntimeHost = ({ base, createPulsePageRuntime }: CreateRuntimeRootSharedProps) => {
  const standardCreateAgentRuntime = useStandardCreateAgentRuntime({
    sessionId: base.sessionId,
    mode: base.mode,
    selectedTool: base.selectedTool,
    prompt: base.standardPrompt,
    projectId: base.projectId,
    projectRouteRequested: base.projectRouteRequested,
    getAgentContext: base.getAgentContext,
    setStandardCreatePrompt: base.setStandardCreatePrompt,
    addAgentPromptReference: base.addAgentPromptReference,
    editReferenceText: base.editReferenceText,
    setEditReferenceText: base.setEditReferenceText,
    videoReferenceText: base.videoReferenceText,
    setVideoReferenceText: base.setVideoReferenceText,
    findOutputById: base.findOutputById,
    resolvePanelOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    aspect: base.aspect,
    model: base.model,
    setOutputs: base.setOutputs,
    setActiveOutputId: base.setActiveOutputId,
    setUiNotice: base.setUiNotice,
    trackAgentUiEvent: base.trackUiEvent,
  });
  const pulseCreateAgentRuntime = usePulseCreateAgentRuntime({
    sessionId: base.sessionId,
    mode: base.mode,
    selectedTool: base.selectedTool,
    prompt: base.pulsePrompt,
    activePresetSnapshot: createPulsePageRuntime.activeCreatePulsePresetSnapshot,
    activePresetId: base.activeCreatePulsePresetId,
    sessionInstanceId: base.pulseSessionInstanceId,
    workflowSession: base.pulseWorkflowSession,
    setWorkflowSession: base.setPulseWorkflowSession,
    clearRuntime: createPulsePageRuntime.clearPulseRuntimeForPage,
    restartPulse: base.restartPulse,
    getAgentContext: createPulsePageRuntime.pulseCreateAgentContextResolver,
    setPulseCreatePrompt: base.setPulseCreatePrompt,
    findOutputById: base.findOutputById,
    resolvePanelOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    setUiNotice: base.setUiNotice,
    trackAgentUiEvent: base.trackUiEvent,
  });
  const activeCreateAgentRuntime =
    base.expertCreateMode === "pulse" ? pulseCreateAgentRuntime : standardCreateAgentRuntime;

  return (
    <AiStudioPageRuntimeBody
      base={base}
      createPulsePageRuntime={createPulsePageRuntime}
      activeCreateAgentRuntime={activeCreateAgentRuntime}
    />
  );
};

const AiStudioPageRuntimeBody = ({
  base,
  createPulsePageRuntime,
  activeCreateAgentRuntime,
}: {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
  activeCreateAgentRuntime: CreatePageAgentRuntime;
}) => {
  const {
    activeCreatePrompt,
    activeCreatePulsePresetId,
    activeOutput,
    activeOutputId,
    activeSessionPersistenceSessionId,
    addAgentPromptReference,
    addCharacterReferences,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
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
    closeModelModal,
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    editReferenceText,
    editSubmitIntent,
    effectiveBalanceCredits,
    elementCreateRequestKey,
    expertCreateMode,
    expertEditSessionRevision,
    extraImageUrls,
    generateOutput,
    getExpertEditSessionState,
    getDefaultDurationSeconds,
    hydrateCanvasSessionState,
    hydrateFromSessionSnapshot,
    imageResolution,
    insertOptimisticGenerationPlaceholder,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    isProjectsModalOpen,
    klingElements,
    klingMultiPrompts,
    klingWorkflowMode,
    mediaAutosaveError,
    mediaAutosaveSyncState,
    mode,
    model,
    modelPricingPolicy,
    modelPricingPolicyError,
    modelPricingPolicyLoading,
    modelPricingPolicyReady,
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    openModelModal,
    optimisticDebitEntries,
    optimisticUncoveredDebitCredits,
    outputs,
    pendingHoldCredits,
    project,
    projectError,
    projectId,
    projectRouteRequested,
    projectStatus,
    pulsePrompt,
    pulseWorkflowSession,
    referenceGridFileInputRef,
    referenceGridPreconnectOrigin,
    referenceImageUrl,
    refreshBalance,
    refreshCharacterModeInjectionBundleForSubmission,
    refreshCharacterOptions,
    refreshProject,
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
    resolveCharacterAvatarUrlById,
    resolveCharacterDropReference,
    resolveCharacterModeSubmissionOverrides,
    resolveElementProfileImageDropSource,
    resolveIsCharacterModeEnabledForTool,
    resolveMediaLibraryInternalDropItem,
    resolveReferenceInputsForTool,
    resolveSelectedCharacterIdForTool,
    resolveStyleLibraryInternalDrop,
    resolveVoiceChangerInternalReferenceSource,
    seedance2InputMode,
    seedance2ReferenceAudioUrls,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    selectedStyleContext,
    selectedTool,
    sessionId,
    sessionPersistenceTitleOverride,
    setActiveOutputId,
    setBeginnerMode,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setDetailOutputId,
    setEditReferenceText,
    setExpertEditSessionState,
    setMode,
    setModel,
    setOptimisticDebitEntries,
    setOutputs,
    setPulseCreatePrompt,
    setSelectedStyleContext,
    setSelectedStylePrompt,
    setSelectedToolWithEditIntentReset,
    setShowCreateTools,
    setStandardCreatePrompt,
    setUiError,
    setUiNotice,
    setVideoReferenceText,
    showBeginnerModeToggle,
    showCreateTools,
    trackCharacterModeFallback,
    trackUiEvent,
    uiError,
    uiNotice,
    updateOutputById,
    useReferenceImageIndicator,
    videoDurationSeconds,
    videoGenerateAudio,
    videoReferenceMode,
    videoReferenceText,
    videoResolution,
  } = base;
  const {
    activeCreatePulsePresetSnapshot,
    setActiveCreatePulsePresetSnapshot,
    hasActivePulseSession,
  } = createPulsePageRuntime;
  const {
    linkedPromptReferenceIds,
    setPromptOrigin,
    persistedAgentRuntime,
    resetProjectAgentConversation: resetActiveProjectAgentConversation,
    hydrateFromSessionAgentSnapshot: hydrateActiveFromSessionAgentSnapshot,
  } = activeCreateAgentRuntime;
  const pulseCreateAgentRuntime =
    activeCreateAgentRuntime.kind === "pulse" ? activeCreateAgentRuntime : null;
  const handlePulsePresetStart = pulseCreateAgentRuntime?.handlePulsePresetStart;
  const handleStandardCreatePromptChange = useCallback(
    (value: string) => {
      setStandardCreatePrompt(value);
      setPromptOrigin("manual");
    },
    [setPromptOrigin, setStandardCreatePrompt]
  );
  const handlePulseCreatePromptChange = useCallback(
    (value: string) => {
      setPulseCreatePrompt(value);
      setPromptOrigin("manual");
    },
    [setPromptOrigin, setPulseCreatePrompt]
  );
  const setActiveCreatePrompt =
    activeCreateAgentRuntime.kind === "pulse" ? setPulseCreatePrompt : setStandardCreatePrompt;

  const handleCreatePulsePresetStart = useCallback(
    async (
      preset: Parameters<NonNullable<typeof handlePulsePresetStart>>[0],
      options?: Parameters<NonNullable<typeof handlePulsePresetStart>>[1]
    ) => {
      if (!handlePulsePresetStart) {
        return {
          status: "failed" as const,
          reason: "scope_discarded" as const,
          message: "Pulse runtime is inactive.",
        };
      }
      const previousActivePresetSnapshot = activeCreatePulsePresetSnapshot;
      setActiveCreatePulsePresetSnapshot(preset);
      const result = await handlePulsePresetStart(preset, {
        pulseSessionInstanceId: options?.pulseSessionInstanceId ?? null,
        deferWorkflowSessionCommit: options?.deferWorkflowSessionCommit ?? false,
      });
      if (result.status !== "started") {
        setActiveCreatePulsePresetSnapshot(previousActivePresetSnapshot ?? null);
      }
      return result;
    },
    [activeCreatePulsePresetSnapshot, handlePulsePresetStart, setActiveCreatePulsePresetSnapshot]
  );
  const {
    sessionRestoreCandidate,
    projectBootstrapApplied,
    projectBootstrapError,
    retryProjectBootstrap,
  } = useAiStudioPageProjectSessionRuntime({
    activeCreateAgentKind: activeCreateAgentRuntime.kind,
    activeCreatePulsePresetId,
    activeSessionPersistenceSessionId,
    buildSessionSnapshot,
    canvasSessionState,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    expertCreateMode,
    expertEditSessionRevision,
    getExpertEditSessionState,
    hasActivePulseSession,
    hydrateActiveFromSessionAgentSnapshot,
    hydrateCanvasSessionState,
    hydrateFromSessionSnapshot,
    pendingCreateRuntimeAgentHydrationRef: base.pendingCreateRuntimeAgentHydrationRef,
    persistedAgentRuntime,
    projectId,
    projectRouteRequested,
    pulseWorkflowSession,
    resetActiveProjectAgentConversation,
    sessionPersistenceTitleOverride,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setExpertEditSessionState,
    setUiNotice,
  });
  const triggerFilePicker = useCallback(() => {
    referenceGridFileInputRef.current?.click();
  }, [referenceGridFileInputRef]);
  const dismissError = () => setUiError(null);
  const dismissNotice = () => setUiNotice(null);
  const { effectiveUiNotice, handleBeginnerModeChange } = useAiStudioPageUiNotices({
    uiNotice,
    beginnerModeError,
    beginnerModeLoading,
    beginnerModeSyncState,
    showBeginnerModeToggle,
    setBeginnerMode,
    mediaAutosaveError,
    mediaAutosaveSyncState,
  });
  const {
    currentCostCredits,
    dismissFailure,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    filteredModelOptions,
    focusFailure,
    handleEditPromptTextChange,
    handleFileBrowserSelection,
    handleGenerate,
    handleImageRegenerateWithDebit,
    handleManualPromptChange,
    handleMusicGenerate,
    handleOpenMediaLibrary,
    handleOpenModelModal,
    handleReferenceGridFiles,
    handleRegenerateWithDebit,
    handleSelectModelFromModal,
    handleSelectOutput,
    handleSoundEffectsGenerate,
    handleToolSelect,
    handleVideoPromptTextChange,
    handleVoicesGenerate,
    hasSufficientCreditsForPromptReferenceGenerate,
    isTemplateView,
    musicIsGenerating,
    promptReferenceGenerateCostCredits,
    pulseArtifactTarget,
    pulseCurrentCostCredits,
    pulseGenerateCostCredits,
    pulseGenerationGuardrail,
    pulsePromptReferenceGenerateCostCredits,
    referenceImageWarning,
    resolveModelPickerCredits,
    soundEffectsIsGenerating,
    visibleFailures,
    voicesIsGenerating,
  } = useAiStudioPageGenerationRuntime({
    activeCreatePrompt,
    activeCreatePulsePresetSnapshot,
    activeOutput,
    activeOutputId,
    addCharacterReferences,
    addOutputsFromFiles,
    aspect,
    balanceCredits,
    closeModelModal,
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    editReferenceText,
    editSubmitIntent,
    effectiveBalanceCredits,
    extraImageUrls,
    generateOutput,
    getDefaultDurationSeconds,
    imageResolution,
    insertOptimisticGenerationPlaceholder,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    klingElements,
    klingMultiPrompts,
    klingWorkflowMode,
    mode,
    model,
    modelPricingPolicy,
    modelPricingPolicyError,
    modelPricingPolicyLoading,
    modelPricingPolicyReady,
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    optimisticDebitEntries,
    optimisticUncoveredDebitCredits,
    outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
    openModelModal,
    projectId,
    pulsePrompt,
    referenceImageUrl,
    refreshBalance,
    refreshCharacterModeInjectionBundleForSubmission,
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
    resolveCharacterModeSubmissionOverrides,
    resolveIsCharacterModeEnabledForTool,
    resolveReferenceInputsForTool,
    resolveSelectedCharacterIdForTool,
    seedance2InputMode,
    seedance2ReferenceAudioUrls,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    selectedStyleContext,
    selectedTool,
    setActiveOutputId,
    setDetailOutputId,
    setEditReferenceText,
    setMode,
    setModel,
    setOptimisticDebitEntries,
    setOutputs,
    setPromptOrigin,
    setSharedPrompt: setActiveCreatePrompt,
    setShowCreateTools,
    setUiError,
    setUiNotice,
    setVideoReferenceText,
    setSelectedToolWithEditIntentReset,
    trackCharacterModeFallback,
    trackUiEvent,
    updateOutputById,
    useReferenceImageIndicator,
    videoDurationSeconds,
    videoGenerateAudio,
    videoReferenceMode,
    videoReferenceText,
    videoResolution,
  });

  const handleStandardAgentCaptureResult = useCallback(
    (promptText: string, referenceTitle?: string | null) => {
      addAgentPromptReference(promptText, referenceTitle ?? undefined);
      setPromptOrigin("agent");
    },
    [addAgentPromptReference, setPromptOrigin]
  );
  const workflowBeginnerPolicy = useMemo(
    () => createWorkflowBeginnerModePolicy(beginnerMode, true),
    [beginnerMode]
  );
  const { editExpertPanelProps, videoPanelProps } = useAiStudioEditVideoPanelRuntimes({
    base,
    workflowBeginnerPolicy,
    currentCostCredits,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    referenceImageWarning,
    handleOpenModelModal,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleImageRegenerateWithDebit,
    handleRegenerateWithDebit,
  });
  const propertiesCreate = useAiStudioCreatePanelRuntime({
    base,
    createPulsePageRuntime,
    activeCreateAgentRuntime,
    workflowBeginnerPolicy,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    pulseArtifactTarget,
    pulseCurrentCostCredits,
    pulsePromptReferenceGenerateCostCredits,
    pulseGenerationGuardrail,
    pulseGenerateCostCredits,
    handleStandardCreatePromptChange,
    handlePulseCreatePromptChange,
    handleExpertCreateModeChangeForPage: createPulsePageRuntime.handleExpertCreateModeChangeForPage,
    handleActiveCreatePulsePresetIdChangeForPage:
      createPulsePageRuntime.handleActiveCreatePulsePresetIdChangeForPage,
    handleCreatePulsePresetStart,
    handleGenerate,
    handleOpenModelModal,
    handleStandardAgentCaptureResult,
  });
  const {
    propertiesCreate: pagePropertiesCreate,
    propertiesEditExpert,
    propertiesVideo,
    referenceGridProps,
    studioPreviewProps,
    detailModalOutput,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSaveReference,
    onDetailSavePrompt,
  } = useAiStudioReferenceExperienceRuntime({
    base,
    linkedPromptReferenceIds,
    propertiesCreate,
    propertiesEditExpert: editExpertPanelProps,
    propertiesVideo: videoPanelProps,
    handleSelectOutput,
    handleManualPromptChange,
    handleRegenerateWithDebit,
    handleOpenMediaLibrary,
  });
  const {
    effectiveProjectName,
    handleProjectNameCommit,
    handleOpenProjectsModal,
    handleCloseProjectsModal,
    handleSelectProjectFromModal,
    handleOpenMediaLibraryPanelOnly,
    shouldGateProjectBootstrap,
    projectEntryPhase,
    modelModalState,
  } = useAiStudioShellRuntime({
    base,
    sessionRestoreCandidate,
    projectBootstrapApplied,
    filteredModelOptions,
    resolveModelPickerCredits,
    handleSelectModelFromModal,
  });

  const pageContentProps = {
    sessionId,
    referenceGridFileInputRef,
    onFileBrowserSelection: handleFileBrowserSelection,
    uiError,
    uiNotice: effectiveUiNotice,
    characterError,
    onDismissUiError: dismissError,
    onDismissUiNotice: dismissNotice,
    onDismissCharacterError: clearCharacterError,
    beginnerMode,
    showBeginnerModeToggle,
    onBeginnerModeChange: handleBeginnerModeChange,
    balanceCredits: effectiveBalanceCredits,
    pendingHoldCredits: pendingHoldCredits > 0 ? pendingHoldCredits : null,
    balanceLoading,
    visibleFailures,
    onDismissFailure: dismissFailure,
    onInspectFailure: focusFailure,
    selectedTool,
    characterCreateRequestKey,
    elementCreateRequestKey,
    showCreateTools,
    onOpenProjects: handleOpenProjectsModal,
    onSelectTool: handleToolSelect,
    onToggleCreateTools: setShowCreateTools,
    propertiesCreate: pagePropertiesCreate,
    propertiesEditExpert,
    propertiesVideo,
    propertiesMusic: {
      balanceCredits: effectiveBalanceCredits,
      isGenerating: musicIsGenerating,
      onGenerate: handleMusicGenerate,
      pricingPolicy: modelPricingPolicy,
    },
    propertiesSoundEffects: {
      balanceCredits: effectiveBalanceCredits,
      isGenerating: soundEffectsIsGenerating,
      onGenerate: handleSoundEffectsGenerate,
      pricingPolicy: modelPricingPolicy,
    },
    propertiesVoices: {
      balanceCredits: effectiveBalanceCredits,
      isGenerating: voicesIsGenerating,
      onGenerate: handleVoicesGenerate,
      pricingPolicy: modelPricingPolicy,
    },
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    isTemplateView,
    referenceGridProps,
    studioPreviewProps,
    detailModalOutput,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSaveReference,
    onDetailSavePrompt,
    onAddLibraryMediaReference: addLibraryMediaReference,
    onAddLibraryPromptReference: addLibraryPromptReference,
    projectId,
    projectName: effectiveProjectName,
    onProjectNameCommit: handleProjectNameCommit,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    onOpenMediaLibrary: handleOpenMediaLibraryPanelOnly,
    modelModalState,
    handleReferenceGridFiles,
    triggerFilePicker,
    resolveCharacterDropReference,
    resolveElementProfileImageDropSource,
    resolveVoiceChangerInternalReferenceSource,
    onSelectedStylePromptChange: setSelectedStylePrompt,
    onSelectedStyleContextChange: setSelectedStyleContext,
  } satisfies React.ComponentProps<typeof AiStudioPageContent>;

  return (
    <AiStudioPageShell
      shouldGateProjectBootstrap={shouldGateProjectBootstrap}
      projectStatus={projectStatus}
      projectBootstrapError={projectBootstrapError}
      projectError={projectError}
      projectEntryPhase={projectEntryPhase}
      projectTitle={project?.title ?? null}
      referenceGridPreconnectOrigin={referenceGridPreconnectOrigin}
      pageContentProps={pageContentProps}
      projectsModalOpen={isProjectsModalOpen}
      projectId={projectId}
      refreshProject={refreshProject}
      retryProjectBootstrap={retryProjectBootstrap}
      onCloseProjectsModal={handleCloseProjectsModal}
      onSelectProjectFromModal={handleSelectProjectFromModal}
    />
  );
};
