/**
 * Create-panel runtime assembly for AI Studio.
 * Keeps Standard and Pulse create panel wiring out of the page composition root while preserving the same panel contract.
 */
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import type { ModelModalContext } from "../components/ModelModal";
import { useAiStudioAgentOutputGenerationBridge } from "./useAiStudioAgentOutputGenerationBridge";
import type { AiStudioPageBaseRuntime } from "./useAiStudioPageBaseRuntime";
import { useCreatePulsePresetPageRuntime } from "./createPulsePageRuntime/useCreatePulsePresetPageRuntime";
import { buildPulseCreateRuntimeResult } from "../createRuntime/buildPulseCreateRuntimeResult";
import { buildStandardCreateRuntimeResult } from "../createRuntime/buildStandardCreateRuntimeResult";
import type {
  CreatePageAgentRuntime,
  PulseCreatePageAgentRuntime,
} from "../createRuntime/contracts";
import {
  resolvePulseArtifactGenerationRoute,
  usePulseCreatePrimarySubmit,
} from "./pulseCreateRuntime/usePulseCreatePrimarySubmit";
import { useStandardCreatePrimarySubmit } from "./standardCreateRuntime/useStandardCreatePrimarySubmit";
import type { StudioMode, ToolId } from "../types";
import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../logic/chatModeDefaults";

type CreatePulsePresetPageRuntime = ReturnType<typeof useCreatePulsePresetPageRuntime>;
type CreatePanelProps = AiStudioPageContentProps["propertiesCreate"];
type CreatePanelGenerateOptions = {
  modeOverride?: StudioMode;
  toolOverride?: ToolId | null;
  costOverrideCredits?: number | null;
  suppressStyle?: boolean;
  suppressCharacter?: boolean;
  ignoreGenerationGuardrail?: boolean;
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
type CreatePanelHandlePulsePresetRestart = NonNullable<
  PulseCreatePageAgentRuntime["handlePulsePresetRestart"]
>;
type UseAiStudioCreatePanelRuntimeParams = {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
  activeCreateAgentRuntime: CreatePageAgentRuntime;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  effectiveGenerationGuardrail: string | null;
  effectiveIsGenerateDisabled: boolean;
  pulseArtifactTarget: Parameters<typeof resolvePulseArtifactGenerationRoute>[0];
  pulseCurrentCostCredits: number | null;
  pulsePromptReferenceGenerateCostCredits: number | null;
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
  handleCreatePulsePresetRestart: CreatePanelHandlePulsePresetRestart;
  handleGenerate: CreatePanelHandleGenerate;
  handleOpenModelModal: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
};

/**
 * Builds the discriminated create-panel props for Standard and Pulse mode using the active create agent runtime.
 */
export const useAiStudioCreatePanelRuntime = ({
  base,
  createPulsePageRuntime,
  activeCreateAgentRuntime,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  hasSufficientCreditsForPromptReferenceGenerate,
  effectiveGenerationGuardrail,
  effectiveIsGenerateDisabled,
  pulseArtifactTarget,
  pulseCurrentCostCredits,
  pulsePromptReferenceGenerateCostCredits,
  pulseGenerateCostCredits,
  handleStandardCreatePromptChange,
  handlePulseCreatePromptChange,
  handleExpertCreateModeChangeForPage,
  handleActiveCreatePulsePresetIdChangeForPage,
  handleCreatePulsePresetStart,
  handleCreatePulsePresetRestart,
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
    imageResolution,
    isCharacterOptionsLoading,
    isCreateCharacterModeEnabled,
    mode,
    model,
    modelModalAnchor,
    pulsePrompt,
    referenceGridReadyOutputIds,
    refreshCharacterOptions,
    removedFromAllRefsIds,
    resolveCharacterAvatarUrlById,
    setEditReferenceText,
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
    stagedAgentPrompt,
    setPromptOrigin,
  } = activeCreateAgentRuntime;
  const standardCreateAgentRuntime =
    activeCreateAgentRuntime.kind === "standard" ? activeCreateAgentRuntime : null;
  const pulseCreateAgentRuntime =
    activeCreateAgentRuntime.kind === "pulse" ? activeCreateAgentRuntime : null;
  const noopSetChatModeEnabled = useCallback<Dispatch<SetStateAction<boolean>>>(
    () => undefined,
    []
  );
  const chatModeEnabled =
    standardCreateAgentRuntime?.chatModeEnabled ?? STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED;
  const setChatModeEnabled =
    standardCreateAgentRuntime?.setChatModeEnabled ?? noopSetChatModeEnabled;
  const createGenerateCostCredits =
    mode === "text" && !chatModeEnabled
      ? (promptReferenceGenerateCostCredits ?? currentCostCredits)
      : currentCostCredits;
  const handleProviderPrimarySubmit = useCallback(() => {
    void handleGenerate();
  }, [handleGenerate]);
  const handleStandardCreatePrimarySubmit = useStandardCreatePrimarySubmit({
    selectedTool,
    chatModeEnabled,
    agentInput,
    prompt: standardPrompt,
    createGenerateCostCredits,
    handleGenerate,
    handleProviderPrimarySubmit,
    setSharedPrompt: setStandardCreatePrompt,
  });
  const { assistantBubbleMedia } = useAiStudioAgentOutputGenerationBridge({
    outputs: base.outputs.filter((output) => !removedFromAllRefsIds.includes(output.id)),
    referenceGridReadyOutputIds,
    mode,
    selectedTool,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
    model,
    characterModeEnabled: isCreateCharacterModeEnabled,
    selectedCharacterId: createSelectedCharacterId,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    setVideoReferenceText,
    setEditReferenceText,
    setSharedPrompt: setStandardCreatePrompt,
    setSelectedToolWithEditIntentReset,
    setMode,
    setPromptOrigin,
    handleGenerate,
  });
  const pulsePrimarySubmitCostCredits =
    pulseArtifactTarget != null ? pulseCurrentCostCredits : currentCostCredits;
  const {
    pulsePreferenceRuntime,
    displayCreatePulsePresetId,
    displayCreatePulsePresetSnapshot,
    hasActivePulseSession,
    isPulseStartupPending,
  } = createPulsePageRuntime;
  const {
    pulseArtifactGenerateGuardrail,
    pulseArtifactGenerateDisabled,
    handlePulseCreatePrimarySubmit,
  } = usePulseCreatePrimarySubmit({
    hasActivePulseSession: createPulsePageRuntime.hasActivePulseSession,
    isPulseStartupPending: createPulsePageRuntime.isPulseStartupPending,
    pulseKind: displayCreatePulsePresetSnapshot?.pulseKind ?? null,
    pulseWorkflowSession: base.pulseWorkflowSession,
    latestAgentPrompt: pulseCreateAgentRuntime?.latestAgentPrompt ?? null,
    artifactTarget: pulseArtifactTarget,
    promptReferenceGenerateCostCredits: pulsePromptReferenceGenerateCostCredits ?? null,
    currentCostCredits: pulsePrimarySubmitCostCredits,
    handleGenerate,
    setUiNotice,
  });
  const handlePulsePresetRestart = useMemo(
    () => handleCreatePulsePresetRestart ?? (async () => undefined),
    [handleCreatePulsePresetRestart]
  );

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
          onPresetRestart: handlePulsePresetRestart,
          onPresetStart: handleCreatePulsePresetStart,
        },
      });
      return {
        expertCreateMode: "pulse",
        onExpertCreateModeChange: handleExpertCreateModeChangeForPage,
        pulse: {
          ...pulseRuntime.panelProps,
          hasActivePulseSession,
          isPulseStartupPending,
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
        onPromptChange: handleStandardCreatePromptChange,
        onAspectChange: setAspect,
        onModelPickerOpen: handleOpenModelModal,
        onSelectedCharacterChange: handleCreateCharacterSelection,
        onCreateCharacter: base.handleOpenCharacterCreate,
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
    handleActiveCreatePulsePresetIdChangeForPage,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDrop,
    handleAgentInputChange,
    handleAgentSend,
    handleAssistantMessageEdit,
    handleClearAgentAttachments,
    handleClearAgentChat,
    handleCreateCharacterSelection,
    handleCreatePulsePresetStart,
    handleExpertCreateModeChangeForPage,
    handleGenerate,
    handleOpenModelModal,
    handlePulseCreatePrimarySubmit,
    handlePulseCreatePromptChange,
    handlePulsePresetRestart,
    handleRemoveAgentAttachment,
    handleStandardCreatePromptChange,
    handleStandardCreatePrimarySubmit,
    hasActivePulseSession,
    imageResolution,
    isAgentDropActive,
    isCharacterOptionsLoading,
    isCreateCharacterModeEnabled,
    isPromptRefining,
    isPulseStartupPending,
    mode,
    model,
    modelModalAnchor,
    persistedAgentRuntime,
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
