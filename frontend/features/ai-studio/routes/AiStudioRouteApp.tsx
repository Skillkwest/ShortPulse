/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import React, { useCallback, useState } from "react";
import { AiStudioPageShell } from "../components/AiStudioPageShell";
import { resolveClientBilledCredits } from "../logic/clientPricingDisplay";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { buildDefaultPricingParams } from "../logic/pricing";
import { resolveAiStudioMediaAutosaveRouteEnabled } from "../logic/mediaAutosaveRouteReadiness";
import {
  resolveWorkflowReloadCharacterContextCandidate,
  resolveWorkflowReloadCharacterSelection,
} from "../logic/workflowReloadCharacterRestore";
import { useAiStudioPageUiNotices } from "../hooks/useAiStudioPageUiNotices";
import {
  useAiStudioPageBaseRuntime,
  type AiStudioPageBaseRuntime,
} from "../hooks/useAiStudioPageBaseRuntime";
import { useAiStudioPageContentRuntime } from "../hooks/useAiStudioPageContentRuntime";
import { useAiStudioPageGenerationRuntime } from "../hooks/useAiStudioPageGenerationRuntime";
import { useAiStudioMediaAutosaveOrchestrator } from "../hooks/useAiStudioMediaAutosaveOrchestrator";
import { useAiStudioPageProjectSessionRuntime } from "../hooks/useAiStudioPageProjectSessionRuntime";
import { useAiStudioShellRuntime } from "../hooks/useAiStudioShellRuntime";
import { useAiStudioCreatePanelRuntime } from "../hooks/useAiStudioCreatePanelRuntime";
import { useAiStudioEditVideoPanelRuntimes } from "../hooks/useAiStudioEditVideoPanelRuntimes";
import { useAiStudioReferenceExperienceRuntime } from "../hooks/useAiStudioReferenceExperienceRuntime";
import { useMediaStorageQuotaSummary } from "../../billing/useMediaStorageQuotaSummary";
import { useResolvedAccountPlan } from "../../billing/useResolvedAccountPlan";
import { useCreatePulsePresetPageRuntime } from "../hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime";
import type { CreatePageAgentRuntime } from "../createRuntime/contracts";
import { usePulseCreateAgentRuntime } from "../createRuntime/usePulseCreateAgentRuntime";
import { useStandardCreateAgentRuntime } from "../createRuntime/useStandardCreateAgentRuntime";
import type { MediaFileRow } from "../logic/mediaLibraryModalModel";
import {
  createEmptyPulseChatProjectState,
  type PulseChatProjectState,
} from "../pulseChats/pulseChatThread";
import {
  patchAiStudioSessionSnapshotPulseChats,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import { PERF_FLAG_PAGE_OUTPUT_DECOUPLE } from "../logic/perfProfileFlags";
const FLAG_PAGE_OUTPUT_DECOUPLE = PERF_FLAG_PAGE_OUTPUT_DECOUPLE;
type CreatePulsePresetPageRuntime = ReturnType<typeof useCreatePulsePresetPageRuntime>;
type CreateRuntimeRootSharedProps = {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
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
  const projectScopeKey = base.projectRouteRequested
    ? `project:${base.projectId ?? "__pending__"}`
    : "standalone";
  return (
    <CreateAgentRuntimeHost
      key={projectScopeKey}
      base={base}
      createPulsePageRuntime={createPulsePageRuntime}
    />
  );
};

const CreateAgentRuntimeHost = ({ base, createPulsePageRuntime }: CreateRuntimeRootSharedProps) => {
  const [projectPulseChatState, setProjectPulseChatState] = useState(() =>
    createEmptyPulseChatProjectState()
  );
  const standardCreateAgentRuntime = useStandardCreateAgentRuntime({
    sessionId: base.sessionId,
    mode: base.mode,
    selectedTool: base.selectedTool,
    prompt: base.standardPrompt,
    getAgentContext: base.getAgentContext,
    setStandardCreatePrompt: base.setStandardCreatePrompt,
    findOutputById: base.findOutputById,
    resolvePanelOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    resolveInternalImageDropSource: base.resolveComposerInternalImageDropSource,
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
    resolveInternalImageDropSource: base.resolveComposerInternalImageDropSource,
    setUiNotice: base.setUiNotice,
    trackAgentUiEvent: base.trackUiEvent,
  });
  const activeCreateAgentRuntime =
    base.expertCreateMode === "pulse" ? pulseCreateAgentRuntime : standardCreateAgentRuntime;
  const { setStandardCreateWorkflowReloadPrep } = base;
  React.useEffect(() => {
    setStandardCreateWorkflowReloadPrep(standardCreateAgentRuntime.prepareForWorkflowReload);
    return () => {
      setStandardCreateWorkflowReloadPrep(null);
    };
  }, [setStandardCreateWorkflowReloadPrep, standardCreateAgentRuntime.prepareForWorkflowReload]);

  return (
    <AiStudioPageRuntimeBody
      base={base}
      createPulsePageRuntime={createPulsePageRuntime}
      projectPulseChatState={projectPulseChatState}
      setProjectPulseChatState={setProjectPulseChatState}
      standardCreateAgentRuntime={standardCreateAgentRuntime}
      pulseCreateAgentRuntime={pulseCreateAgentRuntime}
      activeCreateAgentRuntime={activeCreateAgentRuntime}
    />
  );
};

const AiStudioPageRuntimeBody = ({
  base,
  createPulsePageRuntime,
  projectPulseChatState,
  setProjectPulseChatState,
  standardCreateAgentRuntime,
  pulseCreateAgentRuntime,
  activeCreateAgentRuntime,
}: {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
  projectPulseChatState: PulseChatProjectState;
  setProjectPulseChatState: React.Dispatch<React.SetStateAction<PulseChatProjectState>>;
  standardCreateAgentRuntime: ReturnType<typeof useStandardCreateAgentRuntime>;
  pulseCreateAgentRuntime: ReturnType<typeof usePulseCreateAgentRuntime>;
  activeCreateAgentRuntime: CreatePageAgentRuntime;
}) => {
  const { resolvedPlan } = useResolvedAccountPlan();
  const {
    activeCreatePrompt,
    activeCreatePulsePresetId,
    activeOutput,
    activeOutputId,
    activeSessionPersistenceSessionId,
    addCharacterReferences,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    aspect,
    balanceCredits,
    balanceError,
    balanceLoading,
    buildProjectWorkspaceSnapshot,
    buildSessionSnapshot,
    canvasSessionState,
    characterCreateRequestKey,
    closeModelModal,
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    handleCharacterPanelSelectedCharacterChange,
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
    isRailCanvasInteractionActive,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    isProjectsModalOpen,
    klingElements,
    klingMultiPrompts,
    klingWorkflowMode,
    mediaAutosaveEnabled,
    mediaAutosaveError,
    mediaAutosaveSyncState,
    mode,
    model,
    modelPricingPolicy,
    modelPricingPolicyError,
    modelPricingPolicyLoading,
    modelPricingPolicyReady,
    motionReferenceVideoError,
    motionReferenceVideoPending,
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    openModelModal,
    optimisticDebitEntries,
    outputs,
    pendingCharacterUploadRequest,
    pendingHoldCredits,
    project,
    projectError,
    projectId,
    projectRouteRequested,
    projectStatus,
    pulseWorkflowSession,
    referenceGridFileInputRef,
    referenceGridPreconnectOrigin,
    referenceImageUrl,
    refreshBalance,
    refreshCharacterModeInjectionBundleForSubmission,
    refreshCharacterOptions,
    regenerateOutput,
    lipSyncAudio,
    removedFromAllRefsIds,
    removeOptimisticGenerationPlaceholder,
    removeReferencesForDeletedMedia,
    saveReferenceToLibrary,
    clearPendingCharacterUploadRequest,
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
    setCreateCharacterWorkflowReloadPrep,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setDetailOutputId,
    setEditReferenceText,
    setExpertEditSessionState,
    setIsCreateCharacterModeEnabled,
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
  const workspaceRuntimeKey = projectId ? null : sessionId ? `session:${sessionId}` : null;
  const { quotaSummary } = useMediaStorageQuotaSummary({
    enabled: true,
  });
  const isMediaStorageFull = quotaSummary?.isOverLimit === true;
  const { activeCreatePulsePresetSnapshot, beginPulseActivation, hasActivePulseSession } =
    createPulsePageRuntime;
  const {
    linkedPromptReferenceIds,
    setPromptOrigin,
    persistedAgentRuntime,
    resetProjectAgentConversation: resetActiveProjectAgentConversation,
    hydrateFromSessionAgentSnapshot: hydrateActiveFromSessionAgentSnapshot,
  } = activeCreateAgentRuntime;
  const visiblePulseCreateAgentRuntime =
    activeCreateAgentRuntime.kind === "pulse" ? activeCreateAgentRuntime : null;
  const handlePulsePresetStart = visiblePulseCreateAgentRuntime?.handlePulsePresetStart;
  const handlePulsePresetRestartRuntime = visiblePulseCreateAgentRuntime?.handlePulsePresetRestart;
  const createCharacterWorkflowReloadRequestRef = React.useRef(0);
  React.useEffect(() => {
    setCreateCharacterWorkflowReloadPrep((characterContext) => {
      const requestId = createCharacterWorkflowReloadRequestRef.current + 1;
      createCharacterWorkflowReloadRequestRef.current = requestId;
      const candidateSelection = resolveWorkflowReloadCharacterContextCandidate(characterContext);
      const clearCharacterWorkflowReloadSelection = () => {
        if (createCharacterWorkflowReloadRequestRef.current !== requestId) return;
        setIsCreateCharacterModeEnabled(false);
        setCreateSelectedCharacterId("");
        setCreateSelectedCharacterLookId("");
      };
      const applyCharacterWorkflowReloadSelection = ({
        characterId,
        lookId,
      }: {
        characterId: string;
        lookId: string;
      }) => {
        if (createCharacterWorkflowReloadRequestRef.current !== requestId) return;
        setIsCreateCharacterModeEnabled(true);
        setCreateSelectedCharacterId(characterId);
        setCreateSelectedCharacterLookId(lookId);
      };

      if (!candidateSelection) {
        clearCharacterWorkflowReloadSelection();
        return;
      }
      applyCharacterWorkflowReloadSelection(candidateSelection);
      void refreshCharacterOptions()
        .then((refreshedCharacterOptions) => {
          const refreshedSelection = resolveWorkflowReloadCharacterSelection({
            characterContext,
            characterOptions: refreshedCharacterOptions,
          });
          if (!refreshedSelection) {
            clearCharacterWorkflowReloadSelection();
            return;
          }
          applyCharacterWorkflowReloadSelection(refreshedSelection);
        })
        .catch(() => {
          // Submit-time character refresh remains the fail-closed guard if live options cannot load.
        });
    });
    return () => {
      createCharacterWorkflowReloadRequestRef.current += 1;
      setCreateCharacterWorkflowReloadPrep(null);
    };
  }, [
    refreshCharacterOptions,
    setCreateCharacterWorkflowReloadPrep,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setIsCreateCharacterModeEnabled,
  ]);
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
  const setCreatePromptForActiveMode =
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
      const activation = beginPulseActivation(preset);
      try {
        const result = await handlePulsePresetStart(preset, {
          pulseSessionInstanceId: options?.pulseSessionInstanceId ?? null,
          deferWorkflowSessionCommit: options?.deferWorkflowSessionCommit ?? false,
          activationIsCurrent: activation.isCurrent,
          allowInterruptCurrentPulse: options?.allowInterruptCurrentPulse,
        });
        if (!activation.isCurrent()) {
          return {
            status: "failed" as const,
            reason: "scope_discarded" as const,
            message: "Pulse session changed before kickoff completed. Try again.",
          };
        }
        if (result.status !== "started") {
          activation.restoreSnapshot(previousActivePresetSnapshot ?? null);
        }
        return result;
      } catch (error) {
        activation.restoreSnapshot(previousActivePresetSnapshot ?? null);
        throw error;
      } finally {
        activation.clearPending();
      }
    },
    [activeCreatePulsePresetSnapshot, beginPulseActivation, handlePulsePresetStart]
  );
  const handleCreatePulsePresetRestart = useCallback(
    async (
      preset: Parameters<NonNullable<typeof handlePulsePresetRestartRuntime>>[0]
    ): Promise<void> => {
      if (!handlePulsePresetRestartRuntime) return;
      const previousActivePresetSnapshot = activeCreatePulsePresetSnapshot;
      const activation = beginPulseActivation(preset);
      try {
        await handlePulsePresetRestartRuntime(preset, {
          activationIsCurrent: activation.isCurrent,
        });
      } catch (error) {
        activation.restoreSnapshot(previousActivePresetSnapshot ?? null);
        throw error;
      } finally {
        activation.clearPending();
      }
    },
    [activeCreatePulsePresetSnapshot, beginPulseActivation, handlePulsePresetRestartRuntime]
  );
  const patchProjectWorkspaceSnapshot = useCallback(
    (snapshot: AiStudioSessionSnapshot) => {
      if (snapshot.schemaVersion < 2) {
        return snapshot;
      }
      return patchAiStudioSessionSnapshotPulseChats(
        snapshot as AiStudioSessionSnapshotV2,
        projectPulseChatState.threads.length > 0 ? projectPulseChatState : null
      );
    },
    [projectPulseChatState]
  );
  const {
    sessionRestoreCandidate,
    projectBootstrapSettled,
    projectBootstrapApplied,
    projectBootstrapError,
    retryProjectBootstrap,
    resetProjectWorkspace,
  } = useAiStudioPageProjectSessionRuntime({
    activeCreateAgentKind: activeCreateAgentRuntime.kind,
    activeCreatePulsePresetId,
    activeSessionPersistenceSessionId,
    buildProjectWorkspaceSnapshot,
    buildSessionSnapshot,
    projectBootstrapId: base.bootstrapProjectId,
    canvasSessionState,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    expertCreateMode,
    expertEditSessionRevision,
    getExpertEditSessionState,
    hasActivePulseSession,
    hydrateActiveFromSessionAgentSnapshot,
    hydratePulseFromSessionAgentSnapshot: pulseCreateAgentRuntime.hydrateFromSessionAgentSnapshot,
    hydrateStandardFromSessionAgentSnapshot:
      standardCreateAgentRuntime.hydrateFromSessionAgentSnapshot,
    hydrateCanvasSessionState,
    hydrateFromSessionSnapshot,
    isAutosaveWorkDeferred: isRailCanvasInteractionActive,
    patchProjectWorkspaceSnapshot,
    persistedAgentRuntime,
    persistedPulseAgentRuntime: pulseCreateAgentRuntime.persistedAgentRuntime,
    persistedStandardAgentRuntime: standardCreateAgentRuntime.persistedAgentRuntime,
    projectId,
    projectRouteRequested,
    setProjectPulseChatState,
    pulseSessionInstanceId: base.pulseSessionInstanceId,
    pulseWorkflowSession,
    resetActiveProjectAgentConversation,
    resetPulseProjectAgentConversation: pulseCreateAgentRuntime.resetProjectAgentConversation,
    resetStandardProjectAgentConversation: standardCreateAgentRuntime.resetProjectAgentConversation,
    sessionPersistenceTitleOverride,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setIsCreateCharacterModeEnabled,
    setExpertEditSessionState,
    setMusicPromptDraft: base.setMusicPromptDraft,
    setMusicLyricsDraft: base.setMusicLyricsDraft,
    setSoundEffectsPromptDraft: base.setSoundEffectsPromptDraft,
    setUiNotice,
    setVoiceDesignPromptDraft: base.setVoiceDesignPromptDraft,
    setVoiceScriptDraft: base.setVoiceScriptDraft,
  });
  useAiStudioMediaAutosaveOrchestrator({
    enabled: resolveAiStudioMediaAutosaveRouteEnabled({
      projectRouteRequested,
      projectStatus,
      projectBootstrapSettled,
    }),
    isMediaStorageFull,
    outputs,
    mediaAutosaveEnabled,
    mediaAutosaveSyncState,
    saveReferenceToLibrary,
  });
  const triggerFilePicker = useCallback(() => {
    referenceGridFileInputRef.current?.click();
  }, [referenceGridFileInputRef]);
  const dismissError = () => setUiError(null);
  const dismissNotice = () => setUiNotice(null);
  const { effectiveUiNotice } = useAiStudioPageUiNotices({
    expertCreateMode,
    uiNotice,
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
    referenceImageWarning,
    resolveModelPickerCredits,
    soundEffectsIsGenerating,
    visibleFailures,
    voicesIsGenerating,
  } = useAiStudioPageGenerationRuntime({
    activeCreatePrompt,
    activeOutput,
    activeOutputId,
    addCharacterReferences,
    addOutputsFromFiles,
    aspect,
    balanceCredits,
    balanceError,
    balanceLoading,
    closeModelModal,
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    editReferenceText,
    editSubmitIntent,
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
    lipSyncAudio,
    motionReferenceVideoError,
    motionReferenceVideoPending,
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    optimisticDebitEntries,
    removedFromAllRefsIds,
    outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
    openModelModal,
    projectId,
    workspaceRuntimeKey,
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
    setCreatePromptForActiveMode,
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
  const resolveExpertEditVariantCostCredits = useCallback(
    ({
      modelId,
      imageWidth,
      imageHeight,
    }: {
      modelId: string;
      imageWidth: number;
      imageHeight: number;
    }): number | null => {
      if (!modelPricingPolicyReady) return null;
      return resolveClientBilledCredits({
        modelId,
        params: {
          ...buildDefaultPricingParams(modelId),
          aspect,
          imageWidth,
          imageHeight,
        },
        pricingPolicy: modelPricingPolicy,
        pricingPolicyReady: true,
      });
    },
    [aspect, modelPricingPolicy, modelPricingPolicyReady]
  );
  const removeBackgroundCostCredits =
    resolveModelPickerCredits(BRIA_BACKGROUND_REMOVE_MODEL_ID) ?? null;
  const { editExpertPanelProps, videoPanelProps } = useAiStudioEditVideoPanelRuntimes({
    base,
    currentCostCredits,
    removeBackgroundCostCredits,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    referenceImageWarning,
    handleOpenModelModal,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleImageRegenerateWithDebit,
    handleRegenerateWithDebit,
    resolveExpertEditVariantCostCredits,
  });
  const propertiesCreate = useAiStudioCreatePanelRuntime({
    base,
    createPulsePageRuntime,
    projectPulseChatState,
    setProjectPulseChatState,
    activeCreateAgentRuntime,
    pulseCreateAgentRuntime,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    handleStandardCreatePromptChange,
    handlePulseCreatePromptChange,
    handleExpertCreateModeChangeForPage: createPulsePageRuntime.handleExpertCreateModeChangeForPage,
    handleActiveCreatePulsePresetIdChangeForPage:
      createPulsePageRuntime.handleActiveCreatePulsePresetIdChangeForPage,
    handleCreatePulsePresetStart,
    handleCreatePulsePresetRestart,
    handleGenerate,
    handleOpenModelModal,
    canvasTearOutTargetRegistry: base.canvasTearOutTargetRegistry,
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
    isMediaStorageFull,
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
    handleCreateProjectFromModal,
    handleSelectProjectFromModal,
    handleOpenMediaLibraryPanelOnly,
    handleOpenMediaLibraryProjectNameEditor,
    mediaProjectNameFocusRequestKey,
    shouldGateProjectBootstrap,
    projectEntryPhase,
    modelModalState,
  } = useAiStudioShellRuntime({
    base,
    sessionRestoreCandidate,
    projectBootstrapSettled,
    projectBootstrapApplied,
    filteredModelOptions,
    resolveModelPickerCredits,
    handleSelectModelFromModal,
  });

  const handleDeleteMediaRowsFromWorkspace = useCallback(
    (rows: MediaFileRow[]) => {
      removeReferencesForDeletedMedia(
        rows.map((row) => ({
          mediaId: row.id,
          storagePath: row.storage_path,
          previewStoragePath: row.preview_storage_path ?? row.preview_variant_path ?? null,
          previewPosterStoragePath: row.poster_variant_path ?? null,
        }))
      );
    },
    [removeReferencesForDeletedMedia]
  );

  const pageContentProps = useAiStudioPageContentRuntime({
    sessionId,
    referenceGridFileInputRef,
    onFileBrowserSelection: handleFileBrowserSelection,
    uiError,
    uiNotice: effectiveUiNotice,
    onDismissUiError: dismissError,
    onDismissUiNotice: dismissNotice,
    balanceCredits: effectiveBalanceCredits,
    creditTotalCredits: resolvedPlan?.monthlyCreditsCents ?? null,
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
      balanceCredits,
      isGenerating: musicIsGenerating,
      onGenerate: handleMusicGenerate,
      onComposerModeChange: base.setMusicComposerMode,
      onDurationChange: base.setMusicDurationSeconds,
      onInstrumentalEnabledChange: base.setMusicInstrumentalEnabled,
      onLyricsChange: base.setMusicLyricsDraft,
      onPromptChange: base.setMusicPromptDraft,
      onSingerEnabledChange: base.setMusicSingerEnabled,
      onSongBatchCountChange: base.setMusicSongBatchCount,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
      composerMode: base.musicComposerMode,
      durationSeconds: base.musicDurationSeconds,
      instrumentalEnabled: base.musicInstrumentalEnabled,
      lyrics: base.musicLyricsDraft,
      prompt: base.musicPromptDraft,
      singerEnabled: base.musicSingerEnabled,
      songBatchCount: base.musicSongBatchCount,
    },
    propertiesSoundEffects: {
      balanceCredits,
      isGenerating: soundEffectsIsGenerating,
      onGenerate: handleSoundEffectsGenerate,
      onDurationChange: base.setSoundEffectsDurationSeconds,
      onLoopEnabledChange: base.setSoundEffectsLoopEnabled,
      onPromptChange: base.setSoundEffectsPromptDraft,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
      durationSeconds: base.soundEffectsDurationSeconds,
      loopEnabled: base.soundEffectsLoopEnabled,
      prompt: base.soundEffectsPromptDraft,
    },
    propertiesVoices: {
      balanceCredits,
      isGenerating: voicesIsGenerating,
      onGenerate: handleVoicesGenerate,
      onSelectedVoiceIdChange: base.setVoiceSelectedVoiceId,
      onVoiceChangerSourceChange: base.handleVoiceChangerSourceChange,
      onVoicePromptChange: base.setVoiceDesignPromptDraft,
      onVoiceScriptChange: base.setVoiceScriptDraft,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
      selectedVoiceId: base.voiceSelectedVoiceId ?? undefined,
      voiceChangerSource: base.voiceChangerSource,
      voicePrompt: base.voiceDesignPromptDraft,
      voiceScript: base.voiceScriptDraft,
    },
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    isTemplateView,
    referenceGridProps,
    studioPreviewProps,
    detailModalOutput,
    sharedDetailModalItem: base.sharedDetailModalItem,
    isMediaStorageFull,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSaveReference,
    onDetailReloadWorkflow: base.reloadWorkflowFromStudioOutput,
    onMediaLibraryReloadWorkflow: base.reloadWorkflowFromStudioOutput,
    onDetailSavePrompt,
    onAddLibraryMediaReference: addLibraryMediaReference,
    onAddLibraryPromptReference: addLibraryPromptReference,
    onDeleteMediaRowsFromWorkspace: handleDeleteMediaRowsFromWorkspace,
    mediaLibraryDetailSelectionTarget:
      base.detailSelectionTarget?.kind === "media-file" &&
      (base.detailSelectionTarget.surface === "media-library-panel" ||
        base.detailSelectionTarget.surface === "character-media-panel" ||
        base.detailSelectionTarget.surface === "elements-media-panel")
        ? base.detailSelectionTarget
        : null,
    onMediaLibraryDetailSelectionTargetChange: base.setDetailSelectionTarget,
    projectId,
    projectRouteRequested,
    projectName: effectiveProjectName,
    onProjectNameCommit: handleProjectNameCommit,
    onOpenProjectNameEditor: handleOpenMediaLibraryProjectNameEditor,
    mediaLibraryProjectNameFocusRequestKey: mediaProjectNameFocusRequestKey,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    onOpenMediaLibrary: handleOpenMediaLibraryPanelOnly,
    modelModalState,
    handleReferenceGridFiles,
    triggerFilePicker,
    resolveCharacterDropReference,
    pendingCharacterUploadRequest,
    onCharacterUploadRequestHandled: clearPendingCharacterUploadRequest,
    createSelectedCharacterId,
    onCreateSelectedCharacterIdChange: handleCharacterPanelSelectedCharacterChange,
    resolveElementProfileImageDropSource,
    resolveVoiceChangerInternalReferenceSource,
    onRegisterWorkflowReloadStylePrep: base.setImageStyleWorkflowReloadPrep,
    onSelectedStylePromptChange: setSelectedStylePrompt,
    onSelectedStyleContextChange: setSelectedStyleContext,
  });

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
      retryProjectBootstrap={retryProjectBootstrap}
      resetProjectWorkspace={resetProjectWorkspace}
      onOpenProjectsModal={handleOpenProjectsModal}
      onCloseProjectsModal={handleCloseProjectsModal}
      onSelectProjectFromModal={handleSelectProjectFromModal}
      onCreateProjectFromModal={handleCreateProjectFromModal}
    />
  );
};
