/**
 * Create-panel runtime assembly for AI Studio.
 * Keeps Standard and Pulse create panel wiring out of the page composition root while preserving the same panel contract.
 */
import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
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
import { usePulseChatThreads } from "./usePulseChatThreads";
import { useStandardCreatePrimarySubmit } from "./standardCreateRuntime/useStandardCreatePrimarySubmit";
import { shouldShowProjectPulseChatHistory } from "../logic/projectPulseChatRuntime";
import {
  buildPulseChatHydrationPayload,
  type PulseChatProjectState,
  type PulseChatThreadSnapshot,
} from "../pulseChats/pulseChatThread";
import type { StudioMode, ToolId } from "../types";
import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../logic/chatModeDefaults";
import type { CanvasTearOutComposerTargetRegistry } from "./useAiStudioCanvasTearOutTargets";
import type { GenerationAccessCta } from "../logic/generationAccessCta";

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
  projectPulseChatState: PulseChatProjectState;
  setProjectPulseChatState: Dispatch<SetStateAction<PulseChatProjectState>>;
  activeCreateAgentRuntime: CreatePageAgentRuntime;
  pulseCreateAgentRuntime: PulseCreatePageAgentRuntime;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  effectiveGenerationGuardrail: string | null;
  effectiveIsGenerateDisabled: boolean;
  generationAccessResolving?: boolean;
  generationAccessCta?: GenerationAccessCta | null;
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
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
};

export const resolveStandardCreatePrimaryCostCredits = ({
  mode,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
}: {
  mode: StudioMode;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
}): number | null =>
  mode === "text" ? (promptReferenceGenerateCostCredits ?? currentCostCredits) : currentCostCredits;

export const SAVED_PULSE_CHAT_RESTORE_ERROR_MESSAGE = "Saved Pulse chat could not be restored.";

export const shouldRejectSavedPulseChatRestoreActivation = (
  activationResult: string | null | void
): boolean => activationResult === null;

/**
 * Builds the discriminated create-panel props for Standard and Pulse mode using the active create agent runtime.
 */
export const useAiStudioCreatePanelRuntime = ({
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
  generationAccessResolving = false,
  generationAccessCta = null,
  handleStandardCreatePromptChange,
  handlePulseCreatePromptChange,
  handleExpertCreateModeChangeForPage,
  handleActiveCreatePulsePresetIdChangeForPage,
  handleCreatePulsePresetStart,
  handleCreatePulsePresetRestart,
  handleGenerate,
  handleOpenModelModal,
  canvasTearOutTargetRegistry,
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
    acceptAgentComposerDropPayload,
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
  const noopSetChatModeEnabled = useCallback<Dispatch<SetStateAction<boolean>>>(
    () => undefined,
    []
  );
  const chatModeEnabled =
    standardCreateAgentRuntime?.chatModeEnabled ?? STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED;
  const setChatModeEnabled =
    standardCreateAgentRuntime?.setChatModeEnabled ?? noopSetChatModeEnabled;
  const createGenerateCostCredits = resolveStandardCreatePrimaryCostCredits({
    mode,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
  });
  const handleProviderPrimarySubmit = useCallback(() => {
    void handleGenerate();
  }, [handleGenerate]);
  const handleStandardCreatePrimarySubmit = useStandardCreatePrimarySubmit({
    enabled: true,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    selectedTool,
    chatModeEnabled,
    agentInput,
    prompt: standardPrompt,
    createGenerateCostCredits,
    agentAttachments,
    handleGenerate,
    handleProviderPrimarySubmit,
    setVisibleCreatePrompt: setStandardCreatePrompt,
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
    setCreatePrompt: setStandardCreatePrompt,
    setSelectedToolWithEditIntentReset,
    setMode,
    setPromptOrigin,
    handleGenerate,
  });
  const {
    pulsePreferenceRuntime,
    displayCreatePulsePresetId,
    displayCreatePulsePresetSnapshot,
    hasActivePulseSession,
    isPulseStartupPending,
  } = createPulsePageRuntime;
  const handlePulsePresetRestart = useMemo(
    () => handleCreatePulsePresetRestart ?? (async () => undefined),
    [handleCreatePulsePresetRestart]
  );
  const pendingPulseChatOpenRef = useRef<{
    snapshot: PulseChatThreadSnapshot;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);
  const pendingPulseChatOpenTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null
  );
  const openPulseChatSnapshot = useCallback(
    async ({ snapshot }: { snapshot: PulseChatThreadSnapshot }) => {
      const isAlreadyActive =
        base.expertCreateMode === "pulse" &&
        base.activeCreatePulsePresetId === snapshot.workspace.activePulsePresetId &&
        base.pulseSessionInstanceId === snapshot.workspace.pulseSessionInstanceId;
      if (isAlreadyActive) {
        base.setPulseCreatePrompt(snapshot.workspace.pulsePrompt);
        pulseCreateAgentRuntime.hydrateFromSessionAgentSnapshot(
          buildPulseChatHydrationPayload(snapshot)
        );
        return;
      }
      await new Promise<void>((resolve, reject) => {
        if (pendingPulseChatOpenTimerRef.current) {
          globalThis.clearTimeout(pendingPulseChatOpenTimerRef.current);
          pendingPulseChatOpenTimerRef.current = null;
        }
        pendingPulseChatOpenRef.current = {
          snapshot,
          resolve,
          reject,
        };
        pendingPulseChatOpenTimerRef.current = globalThis.setTimeout(() => {
          if (pendingPulseChatOpenRef.current?.snapshot !== snapshot) return;
          pendingPulseChatOpenRef.current = null;
          pendingPulseChatOpenTimerRef.current = null;
          reject(new Error(SAVED_PULSE_CHAT_RESTORE_ERROR_MESSAGE));
        }, 8000);
        const activationResult = handleActiveCreatePulsePresetIdChangeForPage(
          snapshot.workspace.activePulsePresetId,
          {
            sessionInstanceIdOverride: snapshot.workspace.pulseSessionInstanceId,
            workflowSessionOverride: snapshot.runtime.pulseWorkflowSession ?? null,
          }
        );
        if (shouldRejectSavedPulseChatRestoreActivation(activationResult)) {
          pendingPulseChatOpenRef.current = null;
          if (pendingPulseChatOpenTimerRef.current) {
            globalThis.clearTimeout(pendingPulseChatOpenTimerRef.current);
            pendingPulseChatOpenTimerRef.current = null;
          }
          reject(new Error(SAVED_PULSE_CHAT_RESTORE_ERROR_MESSAGE));
          return;
        }
        base.setPulseCreatePrompt(snapshot.workspace.pulsePrompt);
      });
    },
    [
      base,
      handleActiveCreatePulsePresetIdChangeForPage,
      pendingPulseChatOpenTimerRef,
      pulseCreateAgentRuntime,
    ]
  );
  useEffect(() => {
    const pending = pendingPulseChatOpenRef.current;
    if (!pending) return;
    if (
      base.expertCreateMode !== "pulse" ||
      base.activeCreatePulsePresetId !== pending.snapshot.workspace.activePulsePresetId ||
      base.pulseSessionInstanceId !== pending.snapshot.workspace.pulseSessionInstanceId
    ) {
      return;
    }
    pendingPulseChatOpenRef.current = null;
    if (pendingPulseChatOpenTimerRef.current) {
      globalThis.clearTimeout(pendingPulseChatOpenTimerRef.current);
      pendingPulseChatOpenTimerRef.current = null;
    }
    try {
      pulseCreateAgentRuntime.hydrateFromSessionAgentSnapshot(
        buildPulseChatHydrationPayload(pending.snapshot)
      );
      pending.resolve();
    } catch (error) {
      pending.reject(
        error instanceof Error ? error : new Error("Failed to restore the saved Pulse chat.")
      );
    }
  }, [
    base.activeCreatePulsePresetId,
    base.expertCreateMode,
    base.pulseSessionInstanceId,
    pendingPulseChatOpenTimerRef,
    pulseCreateAgentRuntime,
  ]);
  useEffect(
    () => () => {
      if (pendingPulseChatOpenTimerRef.current) {
        globalThis.clearTimeout(pendingPulseChatOpenTimerRef.current);
      }
    },
    []
  );
  const pulseChatHistory = usePulseChatThreads({
    enabled: base.projectRouteRequested,
    projectPulseChatState,
    setProjectPulseChatState,
    expertCreateMode: base.expertCreateMode,
    activePresetId: base.activeCreatePulsePresetId,
    activePresetLabel: displayCreatePulsePresetSnapshot?.label ?? null,
    pulseSessionInstanceId: base.pulseSessionInstanceId,
    pulsePrompt: base.pulsePrompt,
    persistedAgentRuntime: pulseCreateAgentRuntime.persistedAgentRuntime,
    openThreadSnapshot: openPulseChatSnapshot,
    setUiNotice: base.setUiNotice,
  });
  const shouldShowPulseChatHistory = shouldShowProjectPulseChatHistory({
    projectRouteRequested: base.projectRouteRequested,
    projectId: base.projectId,
    threadCount: projectPulseChatState.threads.length,
  });

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
          onPulsePromptChange: handlePulseCreatePromptChange,
          onActivePresetIdChange: handleActiveCreatePulsePresetIdChangeForPage,
          pulsePreferenceRuntime,
          pulseChatHistory: shouldShowPulseChatHistory
            ? {
                threads: pulseChatHistory.threads,
                activeThreadId: pulseChatHistory.activeThreadId,
                loading: pulseChatHistory.loading,
                error: pulseChatHistory.error,
                openingThreadId: pulseChatHistory.openingThreadId,
                onOpenThread: pulseChatHistory.openThread,
                onRenameThread: pulseChatHistory.renameThread,
                onDeleteThread: pulseChatHistory.deleteThread,
              }
            : undefined,
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
          onAgentComposerDirectDrop: acceptAgentComposerDropPayload,
          onRemoveAgentAttachment: handleRemoveAgentAttachment,
          onClearAgentAttachments: handleClearAgentAttachments,
          onAssistantMessageEdit: handleAssistantMessageEdit,
          onClearAgentChat: handleClearAgentChat,
          onPresetRestart: handlePulsePresetRestart,
          onPresetStart: handleCreatePulsePresetStart,
        },
      });
      return {
        expertCreateMode: "pulse",
        onExpertCreateModeChange: handleExpertCreateModeChangeForPage,
        pulse: {
          ...pulseRuntime.panelProps,
          canvasTearOutTargetRegistry,
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
        generationAccessResolving,
        generationAccessCta,
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
        onModelPickerClose: base.closeModelModal,
        onSelectedCharacterChange: handleCreateCharacterSelection,
        onCreateCharacter: base.handleOpenCharacterCreate,
        onCharacterModeChange: setIsCreateCharacterModeEnabled,
        onRefreshCharacterOptions: refreshCharacterOptions,
        onLoadCharacterLookOptions: base.loadCreateCharacterLookOptions,
        resolveCharacterAvatarUrlById,
        onImageResolutionChange: setImageResolution,
        onPinPromptReference: base.addAgentPromptReference,
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
        onAgentComposerDirectDrop: acceptAgentComposerDropPayload,
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
      standard: {
        ...standardRuntime.panelProps,
        canvasTearOutTargetRegistry,
      },
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
    canvasTearOutTargetRegistry,
    characterOptions,
    chatModeEnabled,
    createGenerateCostCredits,
    createIsGenerating,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    currentModelLabel,
    displayCreatePulsePresetId,
    displayCreatePulsePresetSnapshot,
    describeInFlightCount,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    generationAccessResolving,
    generationAccessCta,
    expertCreateMode,
    handleActiveCreatePulsePresetIdChangeForPage,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDrop,
    acceptAgentComposerDropPayload,
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
    handlePulseCreatePromptChange,
    handlePulsePresetRestart,
    handleRemoveAgentAttachment,
    shouldShowPulseChatHistory,
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
    pulsePreferenceRuntime,
    pulseChatHistory.activeThreadId,
    pulseChatHistory.deleteThread,
    pulseChatHistory.error,
    pulseChatHistory.loading,
    pulseChatHistory.openThread,
    pulseChatHistory.openingThreadId,
    pulseChatHistory.renameThread,
    pulseChatHistory.threads,
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
