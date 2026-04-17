/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { useAiStudioEditSubmitIntent } from "../features/ai-studio/hooks/useAiStudioEditSubmitIntent";
import { MediaLibraryModal } from "../features/ai-studio/components/MediaLibraryModal";
import { useEffectiveBeginnerModePreference } from "../features/ai-studio/hooks/useEffectiveBeginnerModePreference";
import { useMediaAutosavePreference } from "../features/ai-studio/hooks/useMediaAutosavePreference";
import { useExpertEditPresetPanelPreference } from "../features/ai-studio/hooks/useExpertEditPresetPanelPreference";
import { useAiStudioMediaAutosaveOrchestrator } from "../features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator";
import {
  CHARACTER_LOADING_GENERATION_GUARDRAIL,
  shouldDisableGenerateWhileCharacterLoading,
} from "../features/ai-studio/logic/createGenerationGuards";
import { addBreadcrumb } from "../lib/clientBreadcrumbs";
import { useAiStudioAgentBridge } from "../features/ai-studio/hooks/useAiStudioAgentBridge";
import { useAiStudioAgentOutputGenerationBridge } from "../features/ai-studio/hooks/useAiStudioAgentOutputGenerationBridge";
import { useAiStudioGenerationController } from "../features/ai-studio/hooks/useAiStudioGenerationController";
import {
  hasUsableCharacterModeInjectionBundle,
  useAiStudioCharacterModeController,
  type CharacterModeInjectionBundle,
} from "../features/ai-studio/hooks/useAiStudioCharacterModeController";
import { useAiStudioCharacterModeLifecycle } from "../features/ai-studio/hooks/useAiStudioCharacterModeLifecycle";
import { useAiStudioReferenceAssetActions } from "../features/ai-studio/hooks/useAiStudioReferenceAssetActions";
import { useAiStudioOptimisticDebitReconciliation } from "../features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation";
import { useAiStudioWorkspaceActions } from "../features/ai-studio/hooks/useAiStudioWorkspaceActions";
import { useAiStudioPageDerivations } from "../features/ai-studio/hooks/useAiStudioPageDerivations";
import { useAiStudioPanelProps } from "../features/ai-studio/hooks/useAiStudioPanelProps";
import { useAiStudioReferenceGridProps } from "../features/ai-studio/hooks/useAiStudioReferenceGridProps";
import { useAiStudioPreviewDetailProps } from "../features/ai-studio/hooks/useAiStudioPreviewDetailProps";
import { useAiStudioInternalDropResolvers } from "../features/ai-studio/hooks/useAiStudioInternalDropResolvers";
import { mapHookContractsToPageContentProps } from "../features/ai-studio/hooks/contracts/pageContentAdapter";
import { useAiStudioSessionIdentity } from "../features/ai-studio/hooks/useAiStudioSessionIdentity";
import { useAiStudioPageSessionPersistence } from "../features/ai-studio/hooks/useAiStudioPageSessionPersistence";
import { useAiStudioPageOutputAdapters } from "../features/ai-studio/hooks/useAiStudioPageOutputAdapters";
import { useAiStudioPageUiNotices } from "../features/ai-studio/hooks/useAiStudioPageUiNotices";
import { useAiStudioPageCreditDerivations } from "../features/ai-studio/hooks/useAiStudioPageCreditDerivations";
import { useAiStudioPerfAuditRuntime } from "../features/ai-studio/hooks/useAiStudioPerfAuditRuntime";
import { getAiStudioSessionSnapshotViaApi } from "../features/ai-studio/logic/sessionApiClient";
import { readAiStudioSessionPersistencePolicy } from "../features/ai-studio/logic/sessionPersistencePolicy";
import { resolveAiStudioSessionSnapshotTitle } from "../features/ai-studio/logic/sessionSnapshotTitle";
import { AiStudioModalActivityProvider } from "../features/ai-studio/components/modal-layer/AiStudioModalLayer";
import { isEditWorkflow } from "../features/ai-studio/logic/workflowIdentity";
import type { StudioOutput, ToolId } from "../features/ai-studio/types";
import {
  PERF_FLAG_AUDIT_RUNTIME,
  PERF_FLAG_OUTPUT_SELECTOR_STORE,
  PERF_FLAG_PAGE_OUTPUT_DECOUPLE,
  PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS,
  PERF_FLAG_SELECTOR_CALLBACKS,
} from "../features/ai-studio/logic/perfProfileFlags";

const CHARACTER_MODE_BUNDLE_STALE_AFTER_MS = 45 * 60 * 1000;
const FLAG_OUTPUT_SELECTOR_STORE = PERF_FLAG_OUTPUT_SELECTOR_STORE;
const FLAG_SELECTOR_CALLBACKS = PERF_FLAG_SELECTOR_CALLBACKS;
const FLAG_PAGE_OUTPUT_DECOUPLE = PERF_FLAG_PAGE_OUTPUT_DECOUPLE;
const FLAG_REFERENCE_GRID_PRECONNECT_HINTS = PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS;
const FLAG_PERF_AUDIT_RUNTIME = PERF_FLAG_AUDIT_RUNTIME;
const { restoreRemoteEnabled: AI_STUDIO_REMOTE_SESSION_FETCH_ENABLED } =
  readAiStudioSessionPersistencePolicy();

type OptimisticDebitEntry = { credits: number; outputId: string | null; createdAtMs?: number };

const normalizeAiStudioProjectName = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 120) : null;
};

export default function AiStudioPage() {
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
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [isCreateCharacterBundleLoading, setIsCreateCharacterBundleLoading] = useState(false);
  const [isEditCharacterBundleLoading, setIsEditCharacterBundleLoading] = useState(false);
  const [isCreateCharacterModeEnabled, setIsCreateCharacterModeEnabled] = useState(false);
  const [isEditCharacterModeEnabled, setIsEditCharacterModeEnabled] = useState(false);
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
  const [createCharacterModeInjectionBundle, setCreateCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const [editCharacterModeInjectionBundle, setEditCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const sessionTitleOverride =
    sessionTitleOverrideState?.sessionId === sessionId ? sessionTitleOverrideState.title : null;

  // Character workflow state (shared with Character tool workflows and error surfaces)
  const {
    error: characterError,
    addReferences: addCharacterReferences,
    clearError: clearCharacterError,
  } = useCharacterWorkflow();

  const {
    promptRef,
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModel,
    currentModelLabel,
    prompt,
    outputs,
    setOutputs,
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
    videoIsGenerating,
    expertEditSessionState,
    setExpertEditSessionState,
    setSharedPrompt,
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
    toggleReferenceIndicator,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
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
    sessionId,
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
    selectedStylePrompt,
    selectedStyleContext,
  });

  const handleQuickSlotLibraryMediaDrop = useCallback(
    async (
      payload: Parameters<typeof addLibraryMediaReferenceToQuickSlot>[0],
      options?: {
        targetId: string | null;
        placement: "before" | "after" | "end";
      }
    ) => {
      const insertedId = await addLibraryMediaReferenceToQuickSlot(payload, options);
      if (!insertedId) return null;
      addCuratedReference(insertedId);
      if (options?.targetId || options?.placement === "end") {
        reorderCuratedReference(insertedId, options?.targetId ?? null, options?.placement ?? "end");
      }
      setActiveOutputId(insertedId);
      return insertedId;
    },
    [
      addCuratedReference,
      addLibraryMediaReferenceToQuickSlot,
      reorderCuratedReference,
      setActiveOutputId,
    ]
  );

  const handleQuickSlotLibraryPromptDrop = useCallback(
    (
      payload: Parameters<typeof addLibraryPromptReferenceToQuickSlot>[0],
      options?: {
        targetId: string | null;
        placement: "before" | "after" | "end";
      }
    ) => {
      const insertedId = addLibraryPromptReferenceToQuickSlot(payload, options);
      if (!insertedId) return null;
      addCuratedReference(insertedId);
      if (options?.targetId || options?.placement === "end") {
        reorderCuratedReference(insertedId, options?.targetId ?? null, options?.placement ?? "end");
      }
      setActiveOutputId(insertedId);
      return insertedId;
    },
    [
      addCuratedReference,
      addLibraryPromptReferenceToQuickSlot,
      reorderCuratedReference,
      setActiveOutputId,
    ]
  );

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
  const handleOpenCharacterCreate = useCallback(() => {
    setSelectedToolWithEditIntentReset("character");
    setCharacterCreateRequestKey((current) => current + 1);
  }, [setSelectedToolWithEditIntentReset]);
  const handleOpenElementCreate = useCallback(() => {
    setSelectedToolWithEditIntentReset("elements");
    setElementCreateRequestKey((current) => current + 1);
  }, [setSelectedToolWithEditIntentReset]);
  const {
    resolveCharacterDropReference,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    resolveElementProfileImageDropSource,
  } = useAiStudioInternalDropResolvers({
    getOutputById,
    getOutputSnapshot,
    ensureOutputPersisted,
    saveReferenceToLibrary,
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
    selectedCharacterId: createSelectedCharacterId,
    setSelectedCharacterId: setCreateSelectedCharacterId,
    isCharacterOptionsLoading,
    refreshCharacterOptions,
    resolveCharacterOptionById,
  } = useAiStudioCharacterModeLifecycle({
    selectedTool,
    setUiError,
    setCharacterModeInjectionBundle: setCreateCharacterModeInjectionBundle,
    setIsCharacterBundleLoading: setIsCreateCharacterBundleLoading,
  });
  const resolveIsCharacterModeEnabledForTool = useCallback(
    (tool: ToolId | null): boolean => {
      if (tool === "create" || tool === "text") return isCreateCharacterModeEnabled;
      if (tool === "edit" || tool === "image") return isEditCharacterModeEnabled;
      return false;
    },
    [isCreateCharacterModeEnabled, isEditCharacterModeEnabled]
  );
  const resolveCharacterAvatarUrlById = useCallback(
    (characterId: string | null | undefined): string | null => {
      return resolveCharacterOptionById(characterId)?.profileImageUrl?.trim() ?? null;
    },
    [resolveCharacterOptionById]
  );
  const {
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
  } = useAiStudioCharacterModeController({
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
    selectedCharacterId: createSelectedCharacterId,
    characterModeInjectionBundle: createCharacterModeInjectionBundle,
    isCharacterBundleLoading: isCreateCharacterBundleLoading,
    editCharacterModeEnabled: isEditCharacterModeEnabled,
    editSelectedCharacterId,
    editCharacterModeInjectionBundle,
    isEditCharacterBundleLoading,
    characterOptions,
    setCharacterModeInjectionBundle: setCreateCharacterModeInjectionBundle,
    setIsCharacterBundleLoading: setIsCreateCharacterBundleLoading,
    setEditCharacterModeInjectionBundle,
    setIsEditCharacterBundleLoading,
    trackCharacterModeEvent: trackUiEvent,
    bundleStaleAfterMs: CHARACTER_MODE_BUNDLE_STALE_AFTER_MS,
  });
  const {
    agentEnabled,
    agentMessages,
    agentError,
    agentBusy,
    agentInput,
    chatModeEnabled,
    setChatModeEnabled,
    agentAssistToggleAvailable,
    agentAssistEnabled,
    setAgentAssistEnabled,
    agentAttachmentError,
    agentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    agentActions,
    isAgentChatOpen,
    latestAgentPrompt,
    promptOrigin,
    setPromptOrigin,
    agentPrimarySource,
    stagedAgentPrompt,
    isPromptRefining,
    describeInFlightCount,
    handleAgentInputChange,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleAgentDescribeTargets,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
    handleAgentSelectVariation,
    handleAssistantMessageEdit,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
    hydrateFromSessionAgentSnapshot,
  } = useAiStudioAgentBridge({
    sessionId,
    mode,
    selectedTool,
    prompt,
    setSharedPrompt,
    getAgentContext,
    addAgentPromptReference,
    editReferenceText,
    setEditReferenceText,
    videoReferenceText,
    setVideoReferenceText,
    findOutputById,
    resolvePanelOutputPreviewUrl,
    aspect,
    model,
    setOutputs,
    setActiveOutputId,
    setUiNotice,
    trackAgentUiEvent: trackUiEvent,
  });

  const { sessionSnapshot } = useAiStudioPageSessionPersistence({
    sessionId,
    sessionTitleOverride,
    buildSessionSnapshot,
    agentMessages,
    agentInput,
    latestAgentPrompt,
    promptOrigin,
    chatModeEnabled,
    expertEditSessionState,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionExpertEditSnapshot: setExpertEditSessionState,
    setUiNotice,
  });

  useEffect(() => {
    let cancelled = false;
    if (!sessionId || !AI_STUDIO_REMOTE_SESSION_FETCH_ENABLED) return () => void 0;

    void getAiStudioSessionSnapshotViaApi({ sessionId })
      .then((payload) => {
        if (cancelled) return;
        setSessionTitleOverrideState((current) => {
          if (current?.sessionId === sessionId && current.title !== null) return current;
          return {
            sessionId,
            title: normalizeAiStudioProjectName(payload?.title ?? null),
          };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSessionTitleOverrideState({
          sessionId,
          title: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const effectiveProjectName = useMemo(
    () =>
      sessionTitleOverride ??
      (sessionSnapshot ? resolveAiStudioSessionSnapshotTitle(sessionSnapshot) : null),
    [sessionSnapshot, sessionTitleOverride]
  );
  const handleProjectNameCommit = useCallback(
    (value: string) => {
      if (!sessionId) return;
      setSessionTitleOverrideState({
        sessionId,
        title: normalizeAiStudioProjectName(value),
      });
    },
    [sessionId]
  );

  const triggerFilePicker = useCallback(() => {
    referenceGridFileInputRef.current?.click();
  }, []);
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

  const { visibleFailures, dismissFailure, focusFailure } =
    useAiStudioOptimisticDebitReconciliation({
      outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
      optimisticDebitEntries,
      setOptimisticDebitEntries,
      refreshBalance,
      setDetailOutputId,
    });
  const {
    isTemplateView,
    costParamsForModel,
    filteredModelOptions,
    resolveDefaultPromptForTool,
    promptForViewModel,
  } = useAiStudioPageDerivations({
    mode,
    selectedTool,
    model,
    aspect,
    prompt,
    editReferenceText,
    videoReferenceText,
    videoReferenceMode,
    referenceImageUrl,
    extraImageUrls,
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
  });

  const {
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    resolveModelPickerCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    isCreditGuardrail,
    generationGuardrail,
    referenceImageWarning,
  } = useAiStudioViewModel({
    mode,
    model,
    aspect,
    prompt: promptForViewModel,
    referenceImageUrl,
    activeOutput,
    selectedTool,
    useReferenceImageIndicator,
    getDefaultDurationSeconds,
    videoDurationSeconds,
    videoResolution,
    videoReferenceMode,
    motionReferenceVideoUrl,
    extraImageUrls,
    imageResolution,
    videoGenerateAudio,
    klingWorkflowMode,
    klingMultiPrompts,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    balanceCredits: effectiveBalanceCredits,
    editSubmitIntent,
    costParamsForModel,
  });
  const isCharacterLoadingGenerateDisabled = useMemo(() => {
    const hasUsableCreateCharacterBundle = hasUsableCharacterModeInjectionBundle({
      selectedCharacterId: createSelectedCharacterId,
      bundle: createCharacterModeInjectionBundle,
    });
    return shouldDisableGenerateWhileCharacterLoading({
      selectedTool,
      characterModeEnabled: isCreateCharacterModeEnabled,
      selectedCharacterId: createSelectedCharacterId,
      isCharacterBundleLoading: isCreateCharacterBundleLoading,
      hasUsableCharacterBundle: hasUsableCreateCharacterBundle,
    });
  }, [
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    selectedTool,
  ]);
  const effectiveGenerationGuardrail =
    generationGuardrail ??
    (isCharacterLoadingGenerateDisabled ? CHARACTER_LOADING_GENERATION_GUARDRAIL : null);
  const effectiveIsGenerateDisabled = Boolean(effectiveGenerationGuardrail);

  const {
    isMediaLibraryOpen,
    isMediaLibraryPanelEnabled,
    handleOpenModelModal,
    handleSelectModelFromModal,
    handleManualPromptChange,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleToolSelect,
    handleOpenMediaLibrary,
    handleCloseMediaLibrary,
    handleFileBrowserSelection,
    handleReferenceGridFiles,
    handleSelectOutput,
  } = useAiStudioWorkspaceActions({
    selectedTool,
    setSelectedTool: setSelectedToolWithEditIntentReset,
    setMode,
    setShowCreateTools,
    setVideoReferenceText,
    setEditReferenceText,
    setSharedPrompt,
    setPromptOrigin,
    openModelModal,
    closeModelModal,
    setModel,
    addCharacterReferences,
    addOutputsFromFiles,
    setActiveOutputId,
  });

  useEffect(() => {
    if (isMediaLibraryPanelEnabled) return;
    if (selectedTool !== "media-library") return;
    setSelectedToolWithEditIntentReset(null);
  }, [isMediaLibraryPanelEnabled, selectedTool, setSelectedToolWithEditIntentReset]);

  const {
    isCreateGenerateClickLocked,
    isEditGenerateClickLocked,
    isVideoGenerateClickLocked,
    handleGenerate,
    handlePrimarySubmit,
    handleChatOffInlineGenerate,
    handleRegenerateWithDebit,
    handleImageRegenerateWithDebit,
  } = useAiStudioGenerationController({
    mode,
    selectedTool,
    model,
    setModel,
    isCharacterModeEnabled: resolveIsCharacterModeEnabledForTool(selectedTool),
    resolveIsCharacterModeEnabledForTool,
    prompt,
    agentInput,
    chatModeEnabled,
    currentCostCredits,
    resolveCostCreditsForModel: resolveModelPickerCredits,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    isCreditGuardrail,
    generationGuardrail: effectiveGenerationGuardrail,
    effectiveBalanceCredits,
    balanceCredits,
    optimisticUncoveredDebitTotal: optimisticUncoveredDebitCredits,
    setUiError,
    setUiNotice,
    setPromptOrigin,
    setOptimisticDebitEntries,
    refreshBalance,
    handleAgentSend,
    addAgentPromptReference,
    resolveDefaultPromptForTool,
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    resolveReferenceInputsForTool,
    trackCharacterModeFallback,
    trackCharacterModeEvent: trackUiEvent,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    generateOutput,
    regenerateOutput,
    activeOutputId,
  });
  const { assistantBubbleMedia, handleGenerateFromAgentOutputPrompt, disableAgentOutputGenerate } =
    useAiStudioAgentOutputGenerationBridge({
      outputs,
      referenceGridReadyOutputIds,
      mode,
      selectedTool,
      isGenerateDisabled: effectiveIsGenerateDisabled,
      isGenerateClickLocked: isCreateGenerateClickLocked,
      hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
      model,
      characterModeEnabled: isCreateCharacterModeEnabled,
      selectedCharacterId: createSelectedCharacterId,
      currentCostCredits,
      promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits ?? null,
      setVideoReferenceText,
      setEditReferenceText,
      setSharedPrompt,
      setSelectedToolWithEditIntentReset,
      setMode,
      setPromptOrigin,
      handleGenerate,
    });
  const handleAssistantBubbleMessageEdit = handleAssistantMessageEdit;
  const { handleDownloadReference, handleSaveReference } = useAiStudioReferenceAssetActions({
    findOutputById,
    saveReferenceToLibrary,
    setUiError,
  });

  const panelProps = useAiStudioPanelProps({
    mode,
    aspect,
    model,
    currentModelLabel,
    prompt,
    promptRef,
    agentEnabled,
    agentMessages,
    agentActions,
    agentInput,
    chatModeEnabled,
    agentAssistToggleAvailable,
    agentAssistEnabled,
    agentBusy,
    agentAttachmentError,
    agentError,
    agentPrimarySource,
    stagedAgentPrompt,
    agentAttachments,
    isAgentDropActive,
    handleAgentInputChange,
    setChatModeEnabled,
    setAgentAssistEnabled,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleAgentAttachmentDrop,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
    handleAgentSelectVariation,
    handleAgentDescribeTargets,
    handleAssistantMessageEdit: handleAssistantBubbleMessageEdit,
    handleGenerateFromAgentOutputPrompt,
    assistantBubbleMedia,
    useReferenceImageIndicator,
    activeOutput,
    isModelModalOpen,
    modelModalAnchor,
    handleOpenModelModal,
    handleManualPromptChange,
    toggleReferenceIndicator,
    createIsGenerating,
    editIsGenerating,
    videoIsGenerating,
    isPrimaryEditStageGenerating,
    isPromptRefining,
    describeInFlightCount,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    isCreateGenerateClickLocked,
    isEditGenerateClickLocked,
    isVideoGenerateClickLocked,
    generationGuardrail: effectiveGenerationGuardrail,
    handleExpandChat,
    handleClearAgentChat,
    isAgentChatOpen,
    handlePrimarySubmit,
    handleChatOffInlineGenerate,
    savePromptReference,
    characterOptions,
    selectedCharacterId: createSelectedCharacterId,
    setSelectedCharacterId: setCreateSelectedCharacterId,
    isCharacterOptionsLoading,
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
    setIsCharacterModeEnabled: setIsCreateCharacterModeEnabled,
    editSelectedCharacterId,
    setEditSelectedCharacterId,
    isEditCharacterModeEnabled,
    setIsEditCharacterModeEnabled,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    selectedExpertEditPresetIds,
    onSelectedExpertEditPresetIdsChange: setSelectedExpertEditPresetIds,
    expertEditCustomPresetOverrides,
    onExpertEditCustomPresetOverridesChange: setExpertEditCustomPresetOverrides,
    expertEditSessionState,
    onExpertEditSessionStateChange: setExpertEditSessionState,
    videoDurationSeconds,
    videoResolution,
    imageResolution,
    videoGenerateAudio,
    videoCameraFixed,
    videoAutoFix,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
    setAspect,
    setVideoDurationSeconds,
    setVideoResolution,
    setImageResolution,
    setVideoGenerateAudio,
    setVideoCameraFixed,
    setVideoAutoFix,
    setSeedance2InputMode,
    setSeedance2ReferenceImageUrls,
    setSeedance2ReferenceVideoUrls,
    setSeedance2ReferenceAudioUrls,
    setSeedance2ReturnLastFrame,
    setSeedance2WebSearch,
    beginnerMode,
    editReferenceImageUrl: imageReferenceImageUrl,
    editExtraImageUrls: imageExtraImageUrls,
    editReferenceText,
    handleImageRegenerateWithDebit,
    insertOptimisticGenerationPlaceholder: (promptText: string) =>
      insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "image",
        selectedToolOverride: "edit",
      }),
    removeOptimisticGenerationPlaceholder,
    onEditSubmitIntentChange: setEditSubmitIntent,
    addSessionMediaReference: addPastedMediaReference,
    referenceImageWarning,
    resolveOutputPreviewUrl: resolvePanelOutputPreviewUrl,
    setEditReferenceImageUrl: setImageReferenceImageUrl,
    setEditExtraImageUrl: setImageExtraImageUrl,
    handleEditPromptTextChange,
    videoReferenceText,
    videoReferenceImageUrl,
    videoExtraImageUrls,
    videoReferenceMode,
    setVideoReferenceMode,
    klingNegativePrompt,
    klingCfgScale,
    klingWorkflowMode,
    klingShotType,
    klingVoiceIds,
    klingMultiPrompts,
    klingElements,
    setKlingNegativePrompt,
    setKlingCfgScale,
    setKlingWorkflowMode,
    setKlingShotType,
    setKlingVoiceIds,
    setKlingMultiPrompts,
    setKlingElements,
    motionReferenceVideoUrl,
    setVideoReferenceImageUrl,
    setVideoExtraImageUrl,
    setMotionReferenceVideoUrl,
    handleVideoPromptTextChange,
    handleRegenerateWithDebit,
    onCreateCharacter: handleOpenCharacterCreate,
    onCreateElement: handleOpenElementCreate,
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
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
  });
  const referenceGridPageProps = useMemo(
    () => ({
      ...referenceGridHookProps,
      onAddLibraryMediaReferenceToQuickSlot: handleQuickSlotLibraryMediaDrop,
      onAddLibraryPromptReferenceToQuickSlot: handleQuickSlotLibraryPromptDrop,
    }),
    [handleQuickSlotLibraryMediaDrop, handleQuickSlotLibraryPromptDrop, referenceGridHookProps]
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
  const {
    propertiesCreate,
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
  } = mapHookContractsToPageContentProps({
    panelProps,
    referenceGridProps: referenceGridPageProps,
    previewDetailProps,
  });
  const handleOpenMediaLibraryPanelOnly = useCallback(() => {
    handleCloseMediaLibrary();
    setShowCreateTools(false);
    setSelectedToolWithEditIntentReset("media-library");
  }, [handleCloseMediaLibrary, setSelectedToolWithEditIntentReset, setShowCreateTools]);

  return (
    <AiStudioModalActivityProvider>
      <Head>
        <title>ShortPulse · AI Studio</title>
        <meta name="description" content="AI Studio — prompt, generate, preview, save." />
        {referenceGridPreconnectOrigin ? (
          <>
            <link rel="preconnect" href={referenceGridPreconnectOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={referenceGridPreconnectOrigin} />
          </>
        ) : null}
      </Head>
      <AiStudioPageContent
        referenceGridFileInputRef={referenceGridFileInputRef}
        onFileBrowserSelection={handleFileBrowserSelection}
        uiError={uiError}
        uiNotice={effectiveUiNotice}
        characterError={characterError}
        onDismissUiError={dismissError}
        onDismissUiNotice={dismissNotice}
        onDismissCharacterError={clearCharacterError}
        beginnerMode={beginnerMode}
        showBeginnerModeToggle={showBeginnerModeToggle}
        onBeginnerModeChange={handleBeginnerModeChange}
        balanceCredits={effectiveBalanceCredits}
        pendingHoldCredits={pendingHoldCredits > 0 ? pendingHoldCredits : null}
        balanceLoading={balanceLoading}
        visibleFailures={visibleFailures}
        onDismissFailure={dismissFailure}
        onInspectFailure={focusFailure}
        selectedTool={selectedTool}
        characterCreateRequestKey={characterCreateRequestKey}
        elementCreateRequestKey={elementCreateRequestKey}
        showCreateTools={showCreateTools}
        onSelectTool={handleToolSelect}
        onToggleCreateTools={setShowCreateTools}
        propertiesCreate={propertiesCreate}
        propertiesEditExpert={propertiesEditExpert}
        propertiesVideo={propertiesVideo}
        refreshCharacterOptions={refreshCharacterOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
        isTemplateView={isTemplateView}
        referenceGridProps={referenceGridProps}
        studioPreviewProps={studioPreviewProps}
        detailModalOutput={detailModalOutput}
        onDetailClose={onDetailClose}
        onUpdateOutputPrompt={onUpdateOutputPrompt}
        onDeleteOutput={onDeleteOutput}
        onDetailDownload={onDetailDownload}
        onDetailSaveReference={onDetailSaveReference}
        onDetailSavePrompt={onDetailSavePrompt}
        onAddLibraryMediaReference={addLibraryMediaReference}
        onAddLibraryPromptReference={addLibraryPromptReference}
        projectName={effectiveProjectName}
        onProjectNameCommit={handleProjectNameCommit}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
        resolveStyleLibraryInternalDrop={resolveStyleLibraryInternalDrop}
        onOpenMediaLibrary={handleOpenMediaLibraryPanelOnly}
        modelModalState={{
          isOpen: isModelModalOpen,
          options: filteredModelOptions,
          resolveCreditsForModel: resolveModelPickerCredits,
          context: modelModalContext,
          onClose: closeModelModal,
          onSelect: handleSelectModelFromModal,
        }}
        agentChat={{
          isOpen: isAgentChatOpen,
          agentMessages,
          agentActions,
          agentInput,
          agentIsSending: agentBusy,
          latestAgentPrompt,
          agentPrimarySource,
          stagedAttachments: agentAttachments,
          agentDropActive: isAgentDropActive,
          onInputChange: handleAgentInputChange,
          onSend: handleAgentSend,
          onAddToGrid: handleAgentAddToGrid,
          onClose: handleCloseAgentChat,
          onAttachmentDrop: handleAgentAttachmentDrop,
          onAttachmentDragOver: handleAgentAttachmentDragOver,
          onAttachmentDragEnter: handleAgentAttachmentDragEnter,
          onAttachmentDragLeave: handleAgentAttachmentDragLeave,
          onRemoveAttachment: handleRemoveAgentAttachment,
          onClearAttachments: handleClearAgentAttachments,
          onAgentApplyPrompt: handleAgentApplyPrompt,
          onAgentSelectVariation: handleAgentSelectVariation,
          onAgentDescribeTargets: handleAgentDescribeTargets,
          onAssistantMessageEdit: handleAssistantBubbleMessageEdit,
          onGenerateFromOutputPrompt: handleGenerateFromAgentOutputPrompt,
          assistantBubbleMedia,
          outputGenerateCostCredits: promptReferenceGenerateCostCredits,
          disableOutputGenerate: disableAgentOutputGenerate,
          outputGenerateGuardrailReason: disableAgentOutputGenerate ? generationGuardrail : null,
        }}
        handleReferenceGridFiles={handleReferenceGridFiles}
        triggerFilePicker={triggerFilePicker}
        resolveCharacterDropReference={resolveCharacterDropReference}
        resolveElementProfileImageDropSource={resolveElementProfileImageDropSource}
        onSelectedStylePromptChange={setSelectedStylePrompt}
        onSelectedStyleContextChange={setSelectedStyleContext}
      />
      {!isMediaLibraryPanelEnabled ? (
        <MediaLibraryModal
          isOpen={isMediaLibraryOpen}
          onClose={handleCloseMediaLibrary}
          onSelectMedia={(payload) => addLibraryMediaReference(payload)}
          onSelectPrompt={(payload) => addLibraryPromptReference(payload)}
        />
      ) : null}
    </AiStudioModalActivityProvider>
  );
}
