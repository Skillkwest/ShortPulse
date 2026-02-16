/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useAiAgent } from "../features/ai-agent/useAiAgent";
import { randomId } from "../features/ai-studio/logic/ids";
import type { AgentActions } from "../prefabs/agent";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { MediaLibraryModal } from "../features/ai-studio/components/MediaLibraryModal";
import { useBeginnerModePreference } from "../features/ai-studio/hooks/useBeginnerModePreference";
import {
  getStagedAgentPrompt,
  resolvePromptSourceBadge,
  type PromptOrigin,
} from "../features/ai-studio/logic/agentPromptOwnership";
import { isEditPromptTool } from "../features/ai-studio/logic/promptTargeting";
import { addBreadcrumb } from "../lib/clientBreadcrumbs";
import { useAiStudioAgentComposer } from "../features/ai-studio/hooks/useAiStudioAgentComposer";
import { useAiStudioAgentOrchestration } from "../features/ai-studio/hooks/useAiStudioAgentOrchestration";
import { useAiStudioAgentInteractions } from "../features/ai-studio/hooks/useAiStudioAgentInteractions";
import { useAiStudioGenerationController } from "../features/ai-studio/hooks/useAiStudioGenerationController";
import {
  useAiStudioCharacterModeController,
  type CharacterModeInjectionBundle,
} from "../features/ai-studio/hooks/useAiStudioCharacterModeController";
import { useAiStudioCharacterModeLifecycle } from "../features/ai-studio/hooks/useAiStudioCharacterModeLifecycle";
import { useAiStudioReferenceAssetActions } from "../features/ai-studio/hooks/useAiStudioReferenceAssetActions";
import { useAiStudioOptimisticDebitReconciliation } from "../features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation";
import { useAiStudioWorkspaceActions } from "../features/ai-studio/hooks/useAiStudioWorkspaceActions";
import { useAiStudioPageDerivations } from "../features/ai-studio/hooks/useAiStudioPageDerivations";
import { useAiStudioPanelProps } from "../features/ai-studio/hooks/useAiStudioPanelProps";
import { useAiStudioCharacterPanelProps } from "../features/ai-studio/hooks/useAiStudioCharacterPanelProps";
import { useAiStudioReferenceCanvasProps } from "../features/ai-studio/hooks/useAiStudioReferenceCanvasProps";
import { useAiStudioPreviewDetailProps } from "../features/ai-studio/hooks/useAiStudioPreviewDetailProps";

const CHARACTER_MODE_BACKGROUND_MODEL_ID = "fal-ai/bytedance/seedream/v4.5/edit";
const CHARACTER_MODE_BUNDLE_STALE_AFTER_MS = 45 * 60 * 1000;

type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
};

export default function AiStudioPage() {
  const { balanceCents, balanceReservedCents, balanceLoading, refreshBalance } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [isCharacterBundleLoading, setIsCharacterBundleLoading] = useState(false);
  const [isCharacterModeEnabled, setIsCharacterModeEnabled] = useState(false);
  const [characterModeInjectionBundle, setCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const [agentConversationId] = useState<string>(() => randomId());

  // Character workflow state (used when Character tool is active)
  const {
    identity,
    aspect: characterAspect,
    modelId: characterModelId,
    engine: characterEngine,
    prompt: characterPrompt,
    poseId: characterPoseId,
    isBuildingIdentity,
    isGenerating: isCharacterGenerating,
    error: characterError,
    hasWebGpu: characterHasWebGpu,
    modelsAvailable: characterModelsAvailable,
    capabilityMessage: characterCapabilityMessage,
    setPrompt: setCharacterPrompt,
    setAspect: setCharacterAspect,
    setModelId: setCharacterModelId,
    setEngine: setCharacterEngine,
    setPoseId: setCharacterPoseId,
    addReferences: addCharacterReferences,
    removeReference: removeCharacterReference,
    buildIdentity: buildCharacterIdentity,
    generate: generateCharacter,
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
    activeOutput,
    activeOutputId,
    setActiveOutputId,
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
    useReferenceImageIndicator,
    detailOutput,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    modelModalPosition,
    isPromptGenerating,
    generateOutput,
    regenerateOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
    addOutputsFromFiles,
    addLibraryMediaReference,
    addLibraryPromptReference,
    toggleReferenceIndicator,
    openModelModal,
    closeModelModal,
    resolvePreviewUrlById,
    updateOutputPrompt,
    deleteOutput,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    getDefaultDurationSeconds,
    getAgentContext,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
  } = useAiStudioState({
    isCharacterModeEnabled,
  });
  const inFlightOutputIds = useMemo(
    () =>
      new Set(
        outputs
          .filter((output) => output.taskState === "pending" || output.taskState === "running")
          .map((output) => output.id)
      ),
    [outputs]
  );
  const optimisticInFlightDebitCredits = useMemo(
    () =>
      optimisticDebitEntries.reduce((sum, entry) => {
        if (entry.outputId == null) return sum + entry.credits;
        if (inFlightOutputIds.has(entry.outputId)) return sum + entry.credits;
        return sum;
      }, 0),
    [optimisticDebitEntries, inFlightOutputIds]
  );
  const reservedCredits = useMemo(
    () => Math.max(0, Math.floor(balanceReservedCents ?? 0)),
    [balanceReservedCents]
  );
  const optimisticUncoveredDebitCredits = useMemo(
    () => Math.max(0, optimisticInFlightDebitCredits - reservedCredits),
    [optimisticInFlightDebitCredits, reservedCredits]
  );
  const pendingHoldCredits = useMemo(() => {
    return reservedCredits + optimisticUncoveredDebitCredits;
  }, [reservedCredits, optimisticUncoveredDebitCredits]);
  const effectiveBalanceCredits = useMemo(() => {
    if (balanceCredits == null) return null;
    return Math.max(0, balanceCredits - optimisticUncoveredDebitCredits);
  }, [balanceCredits, optimisticUncoveredDebitCredits]);

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);
  const { beginnerMode, setBeginnerMode } = useBeginnerModePreference();
  const agentFlag = process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(true);
  const agentEnabled = agentFlag || agentSessionEnabled;
  const {
    messages: agentMessages,
    isSending: agentIsSending,
    error: agentError,
    send: sendToAgent,
    appendUserMessage,
    reset: resetAgentChat,
  } = useAiAgent({
    enabled: true, // allow first-click activation; API will gate if truly disabled server-side
    conversationId: agentConversationId,
  });
  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const agentBusy = agentIsSending || agentUiBusy;
  const [agentActions, setAgentActions] = useState<AgentActions | undefined>(undefined);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const [promptOrigin, setPromptOrigin] = useState<PromptOrigin>("manual");
  const ensureAgentSession = useCallback(() => {
    setAgentSessionEnabled(true);
  }, []);
  const {
    agentInput,
    setAgentInput,
    handleAgentInputChange,
    agentAttachmentError,
    setAgentAttachmentError,
    agentAttachments,
    setAgentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    describedAgentImageCacheRef,
    markAttachmentDelivery,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    resetAgentComposer,
  } = useAiStudioAgentComposer({
    agentSessionEnabled,
    ensureAgentSession,
    outputs,
    resolvePreviewUrlById,
  });
  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const agentPrimarySource = resolvePromptSourceBadge(promptOrigin);
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
  const trackUiEvent = useCallback((message: string, data?: Record<string, unknown>) => {
    addBreadcrumb({
      type: "ui",
      message,
      data,
    });
  }, []);
  const {
    characterOptions,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
  } = useAiStudioCharacterModeLifecycle({
    isCharacterModeEnabled,
    selectedTool,
    model,
    setModel,
    setUiError,
    setCharacterModeInjectionBundle,
    setIsCharacterBundleLoading,
    backgroundModelId: CHARACTER_MODE_BACKGROUND_MODEL_ID,
  });
  const {
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
  } = useAiStudioCharacterModeController({
    isCharacterModeEnabled,
    selectedCharacterId,
    characterModeInjectionBundle,
    isCharacterBundleLoading,
    characterOptions,
    setCharacterModeInjectionBundle,
    setIsCharacterBundleLoading,
    trackCharacterModeEvent: trackUiEvent,
    bundleStaleAfterMs: CHARACTER_MODE_BUNDLE_STALE_AFTER_MS,
  });

  const editPromptToolSelected = isEditPromptTool(selectedTool);

  const {
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleDescribeReference,
    handleAgentDescribeTargets,
  } = useAiStudioAgentOrchestration({
    agentIsSending,
    agentUiBusyRef,
    setAgentUiBusy,
    agentSessionEnabled,
    setAgentSessionEnabled,
    agentInput,
    setAgentInput,
    agentAttachments,
    setAgentAttachments,
    setAgentAttachmentError,
    markAttachmentDelivery,
    describedAgentImageCacheRef,
    prompt,
    latestAgentPrompt,
    setLatestAgentPrompt,
    setAgentActions,
    selectedTool,
    setSharedPrompt,
    setPromptOrigin,
    sendToAgent,
    appendUserMessage,
    getAgentContext,
    trackAgentUiEvent: trackUiEvent,
    addAgentPromptReference,
    editReferenceText,
    setEditReferenceText,
    videoReferenceText,
    setVideoReferenceText,
    outputs,
    aspect,
    model,
    setOutputs,
    setActiveOutputId,
    lastAssistantMessage: latestAssistantMessage,
    setUiNotice,
  });

  const {
    handleAgentApplyPrompt,
    handleAgentSelectVariation,
    handleAgentUseQuestion,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  } = useAiStudioAgentInteractions({
    editPromptToolSelected,
    setSharedPrompt,
    setLatestAgentPrompt,
    setPromptOrigin,
    trackAgentUiEvent: trackUiEvent,
    setAgentInput,
    addAgentPromptReference,
    setIsAgentChatOpen,
    agentSessionEnabled,
    setAgentSessionEnabled,
    latestAgentPrompt,
    agentActions,
    resetAgentChat,
    resetAgentComposer,
    setAgentActions,
  });
  const triggerFilePicker = () => referenceCanvasFileInputRef.current?.click();
  const dismissError = () => setUiError(null);
  const dismissNotice = () => setUiNotice(null);

  const { visibleFailures, dismissFailure, focusFailure } =
    useAiStudioOptimisticDebitReconciliation({
      outputs,
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
  });

  const {
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForCost,
    isCreditGuardrail,
    generationGuardrail,
    isGenerateDisabled,
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
    balanceCredits: effectiveBalanceCredits,
    costParamsForModel,
  });
  const {
    isMediaLibraryOpen,
    handleOpenModelModal,
    handleSelectModelFromModal,
    handleManualPromptChange,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleToolSelect,
    handleOpenMediaLibrary,
    handleCloseMediaLibrary,
    handleFileBrowserSelection,
    handleReferenceCanvasFiles,
    handleSelectOutput,
    showReferencePromptGenerate,
    disableReferencePromptGenerate,
  } = useAiStudioWorkspaceActions({
    selectedTool,
    setSelectedTool,
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
    model,
    hasSufficientCreditsForCost,
    referenceImageUrl,
    extraImageUrls,
    motionReferenceVideoUrl,
    editReferenceText,
    videoReferenceText,
    videoReferenceMode,
  });

  const {
    isGenerateClickLocked,
    handleGenerate,
    handlePrimarySubmit,
    handleRegenerateWithDebit,
    handleImageRegenerateWithDebit,
  } = useAiStudioGenerationController({
    mode,
    selectedTool,
    prompt,
    agentInput,
    agentBusy,
    currentCostCredits,
    isGenerateDisabled,
    isCreditGuardrail,
    generationGuardrail,
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
    trackCharacterModeFallback,
    generateOutput,
    regenerateOutput,
  });
  const handleGenerateFromAgentOutputPrompt = useCallback(
    (promptText: string) => {
      const normalizedPrompt = promptText.trim();
      if (!normalizedPrompt) return;
      setPromptOrigin("agent");
      void handleGenerate(normalizedPrompt, {
        costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
      });
    },
    [currentCostCredits, handleGenerate, promptReferenceGenerateCostCredits, setPromptOrigin]
  );
  const { handleDownloadReference, handleSaveReference, handleGenerateFromPromptReference } =
    useAiStudioReferenceAssetActions({
      outputs,
      selectedTool,
      currentCostCredits,
      setVideoReferenceText,
      setEditReferenceText,
      setSharedPrompt,
      setSelectedTool,
      setMode,
      setPromptOrigin,
      handleGenerate,
      saveReferenceToLibrary,
      setUiError,
    });

  const { propertiesText, propertiesImage, propertiesVideo } = useAiStudioPanelProps({
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
    agentBusy,
    agentAttachmentError,
    agentError,
    agentPrimarySource,
    stagedAgentPrompt,
    agentAttachments,
    isAgentDropActive,
    handleAgentInputChange,
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
    handleAgentUseQuestion,
    handleAgentDescribeTargets,
    handleGenerateFromAgentOutputPrompt,
    useReferenceImageIndicator,
    activeOutput,
    isModelModalOpen,
    modelModalAnchor,
    handleOpenModelModal,
    setModel,
    handleManualPromptChange,
    toggleReferenceIndicator,
    isPromptGenerating,
    isPromptRefining,
    describeInFlightCount,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    isGenerateDisabled,
    isGenerateClickLocked,
    generationGuardrail,
    handleExpandChat,
    handleClearAgentChat,
    isAgentChatOpen,
    handlePrimarySubmit,
    savePromptReference,
    characterOptions,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
    isCharacterModeEnabled,
    setIsCharacterModeEnabled,
    videoDurationSeconds,
    videoResolution,
    imageResolution,
    videoGenerateAudio,
    videoCameraFixed,
    videoAutoFix,
    setAspect,
    setVideoDurationSeconds,
    setVideoResolution,
    setImageResolution,
    setVideoGenerateAudio,
    setVideoCameraFixed,
    setVideoAutoFix,
    beginnerMode,
    referenceImageUrl,
    extraImageUrls,
    editReferenceText,
    handleImageRegenerateWithDebit,
    referenceImageWarning,
    resolvePreviewUrlById,
    outputs,
    isReferencePromptEnhancing,
    handleReferencePromptEnhance,
    setReferenceImageUrl,
    setExtraImageUrl,
    handleEditPromptTextChange,
    videoReferenceText,
    videoReferenceMode,
    setVideoReferenceMode,
    klingNegativePrompt,
    klingCfgScale,
    klingShotType,
    klingVoiceIds,
    klingMultiPrompts,
    klingElements,
    setKlingNegativePrompt,
    setKlingCfgScale,
    setKlingShotType,
    setKlingVoiceIds,
    setKlingMultiPrompts,
    setKlingElements,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    handleVideoPromptTextChange,
    handleRegenerateWithDebit,
  });
  const propertiesCharacter = useAiStudioCharacterPanelProps({
    identity,
    characterAspect,
    characterModelId,
    characterEngine,
    characterPrompt,
    characterPoseId,
    isBuildingIdentity,
    isCharacterGenerating,
    characterHasWebGpu,
    characterModelsAvailable,
    characterCapabilityMessage,
    setCharacterPrompt,
    setCharacterAspect,
    setCharacterModelId,
    setCharacterEngine,
    setCharacterPoseId,
    addCharacterReferences,
    removeCharacterReference,
    buildCharacterIdentity,
    generateCharacter,
    triggerFilePicker,
  });
  const referenceCanvasProps = useAiStudioReferenceCanvasProps({
    outputs,
    activeOutputId,
    onReferenceOutputMediaLoaded,
    linkedPromptReferenceIds,
    showReferencePromptGenerate,
    disableReferencePromptGenerate,
    handleSelectOutput,
    setDetailOutputId,
    handleDescribeReference,
    handleSaveReference,
    handleDownloadReference,
    handleGenerateFromPromptReference,
    handlePasteTextReference: addPastedPromptReference,
    handlePasteMediaReference: addPastedMediaReference,
    retryOutputStatus,
    deleteOutput,
    currentCostCredits,
    selectedTool,
  });
  const {
    studioPreviewProps,
    detailModalOutput,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSavePrompt,
    onOpenMediaLibrary,
  } = useAiStudioPreviewDetailProps({
    activeOutput,
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
    handleDownloadReference,
    savePromptToLibrary,
    handleOpenMediaLibrary,
  });

  return (
    <>
      <Head>
        <title>ShortPulse · AI Studio</title>
        <meta name="description" content="AI Studio — prompt, generate, preview, save." />
      </Head>
      <AiStudioPageContent
        referenceCanvasFileInputRef={referenceCanvasFileInputRef}
        onFileBrowserSelection={handleFileBrowserSelection}
        uiError={uiError}
        uiNotice={uiNotice}
        characterError={characterError}
        onDismissUiError={dismissError}
        onDismissUiNotice={dismissNotice}
        onDismissCharacterError={clearCharacterError}
        beginnerMode={beginnerMode}
        onBeginnerModeChange={setBeginnerMode}
        balanceCredits={effectiveBalanceCredits}
        pendingHoldCredits={pendingHoldCredits > 0 ? pendingHoldCredits : null}
        balanceLoading={balanceLoading}
        visibleFailures={visibleFailures}
        onDismissFailure={dismissFailure}
        onInspectFailure={focusFailure}
        selectedTool={selectedTool}
        showCreateTools={showCreateTools}
        onSelectTool={handleToolSelect}
        onToggleCreateTools={setShowCreateTools}
        propertiesText={propertiesText}
        propertiesCharacter={propertiesCharacter}
        propertiesImage={propertiesImage}
        propertiesVideo={propertiesVideo}
        isTemplateView={isTemplateView}
        referenceCanvasProps={referenceCanvasProps}
        studioPreviewProps={studioPreviewProps}
        detailModalOutput={detailModalOutput}
        onDetailClose={onDetailClose}
        onUpdateOutputPrompt={onUpdateOutputPrompt}
        onDeleteOutput={onDeleteOutput}
        onDetailDownload={onDetailDownload}
        onDetailSavePrompt={onDetailSavePrompt}
        onOpenMediaLibrary={onOpenMediaLibrary}
        modelModalState={{
          isOpen: isModelModalOpen,
          position: modelModalPosition,
          options: filteredModelOptions,
          anchorId: modelModalAnchor,
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
          onAgentUseQuestion: handleAgentUseQuestion,
          onAgentDescribeTargets: handleAgentDescribeTargets,
          onGenerateFromOutputPrompt: handleGenerateFromAgentOutputPrompt,
          outputGenerateCostCredits: promptReferenceGenerateCostCredits,
        }}
        handleReferenceCanvasFiles={handleReferenceCanvasFiles}
        triggerFilePicker={triggerFilePicker}
      />
      <MediaLibraryModal
        isOpen={isMediaLibraryOpen}
        onClose={handleCloseMediaLibrary}
        onSelectMedia={(payload) => addLibraryMediaReference(payload)}
        onSelectPrompt={(payload) => addLibraryPromptReference(payload)}
      />
    </>
  );
}
