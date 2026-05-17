/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import React, { useCallback, useMemo } from "react";
import { AiStudioPageShell } from "../features/ai-studio/components/AiStudioPageShell";
import type { AiStudioPageContentProps } from "../features/ai-studio/components/AiStudioPageContent";
import {
  normalizeAiStudioProjectName,
  resolveProjectEntryPhase,
} from "../features/ai-studio/logic/aiStudioPageProjectState";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { useAiStudioGenerationController } from "../features/ai-studio/hooks/useAiStudioGenerationController";
import { useAiStudioReferenceAssetActions } from "../features/ai-studio/hooks/useAiStudioReferenceAssetActions";
import { useAiStudioWorkspaceActions } from "../features/ai-studio/hooks/useAiStudioWorkspaceActions";
import { useAiStudioPageDerivations } from "../features/ai-studio/hooks/useAiStudioPageDerivations";
import { useAiStudioEditExpertPanelProps } from "../features/ai-studio/hooks/useAiStudioEditExpertPanelProps";
import { useAiStudioReferenceGridProps } from "../features/ai-studio/hooks/useAiStudioReferenceGridProps";
import { useAiStudioPreviewDetailProps } from "../features/ai-studio/hooks/useAiStudioPreviewDetailProps";
import { useAiStudioVideoPanelProps } from "../features/ai-studio/hooks/useAiStudioVideoPanelProps";
import { resolveClientBilledCredits } from "../features/ai-studio/logic/clientPricingDisplay";
import { buildDefaultPricingParams } from "../features/ai-studio/logic/pricing";
import { mapHookContractsToPageContentProps } from "../features/ai-studio/hooks/contracts/pageContentAdapter";
import { useAiStudioPageSessionPersistence } from "../features/ai-studio/hooks/useAiStudioPageSessionPersistence";
import { useAiStudioPageUiNotices } from "../features/ai-studio/hooks/useAiStudioPageUiNotices";
import {
  useAiStudioPageBaseRuntime,
  type AiStudioPageBaseRuntime,
} from "../features/ai-studio/hooks/useAiStudioPageBaseRuntime";
import { useAiStudioPageContentRuntime } from "../features/ai-studio/hooks/useAiStudioPageContentRuntime";
import { useAiStudioPageGenerationRuntime } from "../features/ai-studio/hooks/useAiStudioPageGenerationRuntime";
import { useAiStudioMediaAutosaveOrchestrator } from "../features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator";
import { useAiStudioPageProjectSessionRuntime } from "../features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime";
import { useAiStudioProjectRouteRecovery } from "../features/ai-studio/hooks/useAiStudioProjectRouteRecovery";
import { useMediaStorageQuotaSummary } from "../features/billing/useMediaStorageQuotaSummary";
import { createWorkflowBeginnerModePolicy } from "../features/ai-studio/logic/beginnerWorkflowPolicy";
import { useCreatePulsePresetPageRuntime } from "../features/ai-studio/hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime";
import { buildPulseCreateRuntimeResult } from "../features/ai-studio/createRuntime/buildPulseCreateRuntimeResult";
import { buildStandardCreateRuntimeResult } from "../features/ai-studio/createRuntime/buildStandardCreateRuntimeResult";
import type {
  CreatePageAgentRuntime,
  PulseCreatePageAgentRuntime,
} from "../features/ai-studio/createRuntime/contracts";
import { usePulseCreateAgentRuntime } from "../features/ai-studio/createRuntime/usePulseCreateAgentRuntime";
import { useStandardCreateAgentRuntime } from "../features/ai-studio/createRuntime/useStandardCreateAgentRuntime";
import {
  resolvePulseArtifactGenerationRoute,
  usePulseCreatePrimarySubmit,
} from "../features/ai-studio/hooks/pulseCreateRuntime/usePulseCreatePrimarySubmit";
import { useStandardCreatePrimarySubmit } from "../features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit";
import type { StudioMode, ToolId } from "../features/ai-studio/types";
import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../features/ai-studio/logic/chatModeDefaults";
import { PERF_FLAG_PAGE_OUTPUT_DECOUPLE } from "../features/ai-studio/logic/perfProfileFlags";
import { MEDIA_STORAGE_FULL_USER_MESSAGE } from "../lib/mediaStorageQuota";
const FLAG_PAGE_OUTPUT_DECOUPLE = PERF_FLAG_PAGE_OUTPUT_DECOUPLE;
type CreatePulsePresetPageRuntime = ReturnType<typeof useCreatePulsePresetPageRuntime>;
type CreateRuntimeRootSharedProps = {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
};
type CreatePanelProps = AiStudioPageContentProps["propertiesCreate"];
type EditPanelProps = AiStudioPageContentProps["propertiesEditExpert"];
type VideoPanelProps = AiStudioPageContentProps["propertiesVideo"];
type PageContentRuntimeProps = ReturnType<typeof mapHookContractsToPageContentProps>;
type ModelModalState = AiStudioPageContentProps["modelModalState"];
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
  resolveExpertEditVariantCostCredits: (input: {
    modelId: string;
    imageWidth: number;
    imageHeight: number;
  }) => number | null;
};
type UseAiStudioReferenceExperienceRuntimeParams = {
  base: AiStudioPageBaseRuntime;
  isMediaStorageFull: boolean;
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
}: UseAiStudioCreatePanelRuntimeParams): CreatePanelProps => {
  const {
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
    selectedCreateCharacterLookLabel,
    selectedTool,
    setAspect,
    setImageResolution,
    setIsCreateCharacterModeEnabled,
    setStandardCreatePrompt,
    setUiNotice,
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
  const noopApplyAgentOutputPrompt = useCallback(() => undefined, []);
  const chatModeEnabled =
    standardCreateAgentRuntime?.chatModeEnabled ?? STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED;
  const setChatModeEnabled =
    standardCreateAgentRuntime?.setChatModeEnabled ?? noopSetChatModeEnabled;
  const handleApplyAgentOutputPrompt =
    standardCreateAgentRuntime?.handleApplyAgentOutputPrompt ?? noopApplyAgentOutputPrompt;
  const handleProviderPrimarySubmit = useCallback(() => {
    void handleGenerate();
  }, [handleGenerate]);
  const handleStandardCreatePrimarySubmit = useStandardCreatePrimarySubmit({
    selectedTool,
    chatModeEnabled,
    agentInput,
    prompt: standardPrompt,
    currentCostCredits,
    promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits ?? null,
    handleGenerate,
    handleProviderPrimarySubmit,
    setSharedPrompt: setStandardCreatePrompt,
  });
  const assistantBubbleMedia = undefined;
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
  const {
    pulsePreferenceRuntime,
    displayCreatePulsePresetId,
    displayCreatePulsePresetSnapshot,
    hasActivePulseSession,
  } = createPulsePageRuntime;

  return useMemo<CreatePanelProps>(() => {
    if (expertCreateMode === "pulse") {
      const pulseRuntime = buildPulseCreateRuntimeResult({
        props: {
          pulsePrompt,
          hasActiveSession: hasActivePulseSession,
          activePresetId: displayCreatePulsePresetId,
          activePresetLabel: displayCreatePulsePresetSnapshot?.label ?? null,
          activePresetKind: displayCreatePulsePresetSnapshot?.pulseKind ?? null,
          workflowSession: base.pulseWorkflowSession,
          createIsGenerating,
          currentCostCredits: pulseGenerateCostCredits,
          isGenerateDisabled: pulseArtifactGenerateDisabled,
          generationGuardrail: pulseArtifactGenerateGuardrail,
          expertCreateUiEligible: expertCreatePolicy.expertCreateEligible,
          onPulsePromptChange: handlePulseCreatePromptChange,
          onActivePresetIdChange: handleActiveCreatePulsePresetIdChangeForPage,
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
          activePulsePresetId: displayCreatePulsePresetId,
          activePulsePresetLabel: displayCreatePulsePresetSnapshot?.label ?? null,
          activePulsePresetKind: displayCreatePulsePresetSnapshot?.pulseKind ?? null,
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
        onApplyAgentOutputPrompt: handleApplyAgentOutputPrompt,
        onClearAgentChat: handleClearAgentChat,
        onPrimarySubmit: handleStandardCreatePrimarySubmit,
      },
    });
    return {
      expertCreateMode: "standard",
      onExpertCreateModeChange: handleExpertCreateModeChangeForPage,
      standard: standardRuntime.panelProps,
    };
  }, [
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
    displayCreatePulsePresetId,
    displayCreatePulsePresetSnapshot?.label,
    displayCreatePulsePresetSnapshot?.pulseKind,
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
    handleApplyAgentOutputPrompt,
    handleAssistantMessageEdit,
    handleClearAgentAttachments,
    handleClearAgentChat,
    handleCreateCharacterSelection,
    handleGenerate,
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
  resolveExpertEditVariantCostCredits,
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
    resolveVariantCostCredits: resolveExpertEditVariantCostCredits,
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
    systemPresetDefinitions: base.expertEditSystemPresetDefinitions,
    sessionState: base.expertEditSessionState,
    onSessionStateChange: base.publishExpertEditSessionState,
  });
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
    handleRegenerateWithDebit,
    currentCostCredits,
    referenceImageWarning,
    resolveOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    generationGuardrail: effectiveGenerationGuardrail,
    onCreateCharacter: base.handleOpenCharacterCreate,
    onCreateElement: base.handleOpenElementCreate,
  });
  return { editExpertPanelProps, videoPanelProps };
};

const useAiStudioReferenceExperienceRuntime = ({
  base,
  isMediaStorageFull,
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
    isMediaStorageFull,
  });
  const referenceGridHookProps = useAiStudioReferenceGridProps({
    outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
    archivedOutputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : archivedOutputs,
    activeOutputId,
    topNotice: isMediaStorageFull ? MEDIA_STORAGE_FULL_USER_MESSAGE : null,
    curatedReferenceIds,
    removedFromAllRefsIds,
    isMediaStorageFull,
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
    isMediaStorageFull,
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
    projectErrorKind,
    projectId,
    projectRouteRequested,
    projectStatus,
    requestedProjectId,
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
  const navigateToProjectRoute = useCallback(
    async (nextProjectId: string) => {
      const didNavigate = await router.push({
        pathname: "/ai-studio",
        query: { projectId: nextProjectId },
      });
      if (!didNavigate) {
        throw new Error("Failed to open project.");
      }
    },
    [router]
  );
  const handleSelectProjectFromModal = useCallback(
    async (nextProjectId: string) => {
      if (nextProjectId === projectId) return;
      await navigateToProjectRoute(nextProjectId);
    },
    [navigateToProjectRoute, projectId]
  );
  const handleOpenMediaLibraryPanelOnly = useCallback(() => {
    setShowCreateTools(false);
    setSelectedToolWithEditIntentReset("media-library");
  }, [setSelectedToolWithEditIntentReset, setShowCreateTools]);
  const handleClearStaleProjectRoute = useCallback(async () => {
    const nextQuery = { ...router.query };
    delete nextQuery.projectId;
    return await router.replace({
      pathname: "/ai-studio",
      query: nextQuery,
    });
  }, [router]);

  useAiStudioProjectRouteRecovery({
    requestedProjectId,
    projectRouteRequested,
    projectStatus,
    projectErrorKind,
    onClearStaleProjectRoute: handleClearStaleProjectRoute,
    onOpenProjectsModal: handleOpenProjectsModal,
  });

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
    handleCreateProjectFromModal: navigateToProjectRoute,
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
    resolveInternalImageDropSource: base.resolveComposerInternalImageDropSource,
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
    resolveInternalImageDropSource: base.resolveComposerInternalImageDropSource,
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
    addCharacterReferences,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    aspect,
    balanceCredits,
    balanceLoading,
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
    mediaAutosaveEnabled,
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
    outputs,
    pendingCharacterUploadRequest,
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
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
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
  const { quotaSummary } = useMediaStorageQuotaSummary({
    enabled: true,
  });
  const isMediaStorageFull = quotaSummary?.isOverLimit === true;
  const beginnerMode = false;
  const beginnerModeError = null;
  const beginnerModeLoading = false;
  const beginnerModeSyncState = "ready" as const;
  const showBeginnerModeToggle = false;
  const setBeginnerMode = () => {};
  const {
    activeCreatePulsePresetSnapshot,
    setPendingCreatePulsePresetSnapshot,
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
      setPendingCreatePulsePresetSnapshot(preset);
      setActiveCreatePulsePresetSnapshot(preset);
      try {
        const result = await handlePulsePresetStart(preset, {
          pulseSessionInstanceId: options?.pulseSessionInstanceId ?? null,
          deferWorkflowSessionCommit: options?.deferWorkflowSessionCommit ?? false,
        });
        if (result.status !== "started") {
          setActiveCreatePulsePresetSnapshot(previousActivePresetSnapshot ?? null);
        }
        return result;
      } catch (error) {
        setActiveCreatePulsePresetSnapshot(previousActivePresetSnapshot ?? null);
        throw error;
      } finally {
        setPendingCreatePulsePresetSnapshot(null);
      }
    },
    [
      activeCreatePulsePresetSnapshot,
      handlePulsePresetStart,
      setActiveCreatePulsePresetSnapshot,
      setPendingCreatePulsePresetSnapshot,
    ]
  );
  const {
    sessionRestoreCandidate,
    projectBootstrapApplied,
    projectBootstrapError,
    retryProjectBootstrap,
    resetProjectWorkspace,
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
    setIsCreateCharacterModeEnabled,
    setExpertEditSessionState,
    setUiNotice,
  });
  useAiStudioMediaAutosaveOrchestrator({
    enabled: !projectRouteRequested || (projectStatus === "ready" && projectBootstrapApplied),
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
  const workflowBeginnerPolicy = useMemo(
    () => createWorkflowBeginnerModePolicy(beginnerMode, true),
    [beginnerMode]
  );
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
    resolveExpertEditVariantCostCredits,
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

  const pageContentProps = useAiStudioPageContentRuntime({
    sessionId,
    referenceGridFileInputRef,
    onFileBrowserSelection: handleFileBrowserSelection,
    uiError,
    uiNotice: effectiveUiNotice,
    characterError,
    onDismissUiError: dismissError,
    onDismissUiNotice: dismissNotice,
    onDismissCharacterError: clearCharacterError,
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
      balanceCredits,
      isGenerating: musicIsGenerating,
      onGenerate: handleMusicGenerate,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
    },
    propertiesSoundEffects: {
      balanceCredits,
      isGenerating: soundEffectsIsGenerating,
      onGenerate: handleSoundEffectsGenerate,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
    },
    propertiesVoices: {
      balanceCredits,
      isGenerating: voicesIsGenerating,
      onGenerate: handleVoicesGenerate,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
    },
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    isTemplateView,
    referenceGridProps,
    studioPreviewProps,
    detailModalOutput,
    isMediaStorageFull,
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
    pendingCharacterUploadRequest,
    onCharacterUploadRequestHandled: clearPendingCharacterUploadRequest,
    resolveElementProfileImageDropSource,
    resolveVoiceChangerInternalReferenceSource,
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
