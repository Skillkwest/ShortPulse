/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import { aspectOptions, modelOptions } from "../features/ai-studio/constants";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import { ToolId } from "../features/ai-studio/types";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { buildDefaultPricingParams, getModelConfig } from "../features/ai-studio/logic/pricing";
import type { PricingParams } from "../features/ai-studio/logic/pricingTypes";
import { useAiAgent } from "../features/ai-agent/useAiAgent";
import type { AgentActions, AgentMessage } from "../features/ai-agent/types";
import { postGeneratePrompt } from "../features/ai-studio/logic/promptGeneration";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { filterModelOptions } from "../features/ai-studio/logic/stateParsers";

export default function AiStudioPage() {
  const { balanceCents, balanceLoading, debit } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);

  // Character workflow state (used when Character tool is active)
  const {
    identity,
    aspect: characterAspect,
    modelId: characterModelId,
    engine: characterEngine,
    prompt: characterPrompt,
    poseId: characterPoseId,
    results: characterResults,
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
    setPrompt,
    outputs,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    saved,
    selectedTool,
    setSelectedTool,
    showEditTools,
    setShowEditTools,
    referenceImageUrl,
    setReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    referenceText,
    setReferenceText,
    useReferenceImageIndicator,
    detailOutput,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalPosition,
    isPromptGenerating,
    generateOutput,
    regenerateOutput,
    saveActiveOutput,
    savePromptReference,
    addOutputsFromFiles,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
    resolvePreviewUrlById,
    updateOutputPrompt,
    uiError,
    setUiError,
    getDefaultDurationSeconds,
    getAgentContext,
    addAgentPromptReference,
  } = useAiStudioState({ onDebitCredits: debit });

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dismissedFailureIds, setDismissedFailureIds] = useState<Set<string>>(new Set());
  const [beginnerMode, setBeginnerMode] = useState<boolean>(true);
  const agentFlag = process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(true);
  const agentEnabled = agentFlag || agentSessionEnabled;
  const { messages: agentMessages, isSending: agentIsSending, error: agentError, send: sendToAgent } = useAiAgent({
    enabled: true, // allow first-click activation; API will gate if truly disabled server-side
  });
  const [agentInput, setAgentInput] = useState("");
  const [agentActions, setAgentActions] = useState<AgentActions | undefined>(undefined);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const handleOpenModelModal = (anchorId: string, target: HTMLElement) => {
    openModelModal(anchorId, target);
  };

  const handleSelectModelFromModal = (value: string) => {
    setModel(value);
    closeModelModal();
  };

  const handleToolSelect = (tool: ToolId | null) => {
    setSelectedTool(tool);
    if (!tool) {
      setShowEditTools(false);
    }
  };

  const handleAgentSend = async (
    textOverride?: string,
    options?: { captureResult?: boolean },
  ): Promise<{ prompt: string; referenceTitle?: string | null } | void> => {
    const rawInput = typeof textOverride === "string" ? textOverride : agentInput;
    const trimmed = rawInput.trim();
    const fallback = trimmed || prompt.trim();
    if (!fallback) return;
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    if (!trimmed) {
      setAgentInput(fallback);
    }
    let { actions } = await sendToAgent({ text: fallback, context: getAgentContext() });
    let refinedPrompt: string | null = null;

    // If the agent didn't return an apply_prompt, fall back to prompt refinement to keep the flow unblocked.
    if (!actions?.apply_prompt) {
      const refined = await postGeneratePrompt(fallback);
      if (refined?.prompt) {
        refinedPrompt = refined.prompt;
        actions = {
          ...actions,
          apply_prompt: refined.prompt,
          referenceCard: { title: actions?.referenceCard?.title ?? "Refined Prompt", prompt: refined.prompt },
        };
      }
    }

    const appliedPrompt = actions?.apply_prompt ?? refinedPrompt ?? fallback;

    setPrompt(appliedPrompt);
    setLatestAgentPrompt(appliedPrompt);

    setAgentActions(actions);
    setAgentInput("");

    if (options?.captureResult) {
      return { prompt: appliedPrompt, referenceTitle: actions?.referenceCard?.title };
    }
  };

  const handleAgentApplyPrompt = (promptText: string) => {
    setPrompt(promptText);
    setLatestAgentPrompt(promptText);
  };

  const handleAgentSelectVariation = (promptText: string) => {
    setAgentInput(promptText);
  };

  const handleAgentMessageClick = useCallback(
    (message: AgentMessage) => {
      addAgentPromptReference(message.content);
    },
    [addAgentPromptReference],
  );

  const handleExpandChat = () => {
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    setIsAgentChatOpen((prev) => !prev);
  };

  const handleAgentAddToGrid = () => {
    if (latestAgentPrompt) {
      addAgentPromptReference(latestAgentPrompt, agentActions?.referenceCard?.title);
    }
    setIsAgentChatOpen(false);
  };

  const handleAgentUsePrompt = () => {
    if (latestAgentPrompt) {
      setPrompt(latestAgentPrompt);
      addAgentPromptReference(latestAgentPrompt, agentActions?.referenceCard?.title);
    }
    setIsAgentChatOpen(false);
  };

  const handleModeChange = (nextMode: StudioMode) => {
    setMode(nextMode);
    setIsAgentChatOpen(false);
  };

  const handleCloseAgentChat = () => {
    setIsAgentChatOpen(false);
  };

  const handleFileBrowserSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      if (selectedTool === "character") {
        addCharacterReferences(files);
      } else {
        addOutputsFromFiles(files);
      }
    }
    event.target.value = "";
  };

  const handleReferenceCanvasFiles = (files: FileList) => {
    if (selectedTool === "character") {
      addCharacterReferences(files);
    } else {
      addOutputsFromFiles(files);
    }
  };
  const triggerFilePicker = () => referenceCanvasFileInputRef.current?.click();
  const dismissError = () => setUiError(null);

  const failedOutputs = useMemo(
    () => outputs.filter((item) => item.taskState === "fail" && item.errorMessage),
    [outputs],
  );

  const visibleFailures = useMemo(
    () => failedOutputs.filter((item) => !dismissedFailureIds.has(item.id)),
    [dismissedFailureIds, failedOutputs],
  );

  useEffect(() => {
    setDismissedFailureIds((prev) => {
      if (!prev.size) return prev;
      const activeIds = new Set(failedOutputs.map((item) => item.id));
      const filtered = Array.from(prev).filter((id) => activeIds.has(id));
      if (filtered.length === prev.size) return prev;
      return new Set(filtered);
    });
  }, [failedOutputs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("aiStudioBeginnerMode");
    if (stored === "off") setBeginnerMode(false);
    if (stored === "on") setBeginnerMode(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("aiStudioBeginnerMode", beginnerMode ? "on" : "off");
  }, [beginnerMode]);

  const dismissFailure = (id: string) => {
    setDismissedFailureIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const focusFailure = (id: string) => {
    setActiveOutputId(id);
    setDetailOutputId(id);
  };

  const isTemplateView =
    selectedTool === "templates" || selectedTool === "workflows" || selectedTool === "my-generations" || selectedTool === "community";

  const defaultPricingParams = useMemo(
    () => (model ? buildDefaultPricingParams(model) : {}),
    [model],
  );

  const costParamsForModel = useCallback(
    (overrides: Omit<PricingParams, "modelId"> = {}) => ({
      ...defaultPricingParams,
      aspect,
      ...overrides,
    }),
    [aspect, defaultPricingParams],
  );

  const filteredModelOptions = useMemo(
    () => filterModelOptions(mode, selectedTool, modelOptions, getModelConfig),
    [mode, selectedTool],
  );

  const { currentCostCredits, hasSufficientCreditsForCost, generationGuardrail, isGenerateDisabled, modelConfig } =
    useAiStudioViewModel({
      mode,
      model,
      aspect,
      prompt,
      referenceImageUrl,
      activeOutput,
      extraImageUrls,
      selectedTool,
      useReferenceImageIndicator,
      getDefaultDurationSeconds,
      balanceCredits,
      costParamsForModel,
    });

  const handleBlockedGeneration = () => {
    if (generationGuardrail) {
      setUiError(generationGuardrail);
    }
  };

  const handleGenerate = () => {
    if (isGenerateDisabled) {
      handleBlockedGeneration();
      return;
    }
    if (
      selectedTool === "create" &&
      (mode === "image" || mode === "video") &&
      currentCostCredits &&
      model &&
      hasSufficientCreditsForCost
    ) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => {});
    }
    generateOutput();
  };

  const handlePrimarySubmit = () => {
    if (selectedTool === "create" && mode === "enhance") {
      handleAgentSend(agentInput || prompt, { captureResult: true }).then((result) => {
        if (result?.prompt) {
          addAgentPromptReference(result.prompt, result.referenceTitle);
        }
      });
      return;
    }
    handleGenerate();
  };

  const handleRegenerateWithDebit = () => {
    if (isGenerateDisabled) {
      handleBlockedGeneration();
      return;
    }
    if (selectedTool === "image-to-video" && currentCostCredits && model && hasSufficientCreditsForCost) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => {});
    }
    regenerateOutput();
  };

  const propertiesCreate = {
    mode,
    aspect,
    modelId: model,
    modelLabel: currentModelLabel,
    prompt,
    promptRef,
    agentEnabled,
    agentMessages,
    agentActions,
    agentInput,
    agentIsSending,
    agentError: agentError ?? undefined,
    stagedPrompt: latestAgentPrompt,
    onAgentInputChange: setAgentInput,
    onAgentSend: handleAgentSend,
    onAgentApplyPrompt: handleAgentApplyPrompt,
    onAgentSelectVariation: handleAgentSelectVariation,
    onAgentMessageClick: handleAgentMessageClick,
    useReferenceImageIndicator,
    hasReferencePreview: Boolean(activeOutput?.previewUrl),
    isModelModalOpen,
    modelModalAnchor,
    onModeChange: handleModeChange,
    onAspectChange: setAspect,
    onModelPickerOpen: handleOpenModelModal,
    onPromptChange: setPrompt,
    onToggleReferenceIndicator: toggleReferenceIndicator,
    isPromptGenerating,
    costCredits: currentCostCredits,
    isGenerateDisabled,
    guardrailReason: generationGuardrail,
    onExpandChat: handleExpandChat,
    shouldDisableSave: useReferenceImageIndicator && mode === "enhance",
    onGenerate: handlePrimarySubmit,
    onSavePrompt: savePromptReference,
    onOpenMediaLibrary: () => window.open("/media-library", "_self"),
    agentChatOpen: isAgentChatOpen,
  } as const;

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
        characterError={characterError}
        onDismissUiError={dismissError}
        onDismissCharacterError={clearCharacterError}
        beginnerMode={beginnerMode}
        onBeginnerModeChange={setBeginnerMode}
        balanceCredits={balanceCredits}
        balanceLoading={balanceLoading}
        visibleFailures={visibleFailures}
        onDismissFailure={dismissFailure}
        onInspectFailure={focusFailure}
        selectedTool={selectedTool}
        showEditTools={showEditTools}
        onSelectTool={handleToolSelect}
        onToggleEditTools={setShowEditTools}
        propertiesCreate={propertiesCreate}
        propertiesCharacter={{
          identity,
          aspect: characterAspect,
          modelId: characterModelId,
          engine: characterEngine,
          prompt: characterPrompt,
          poseId: characterPoseId,
          isBuildingIdentity,
          isGenerating: isCharacterGenerating,
          identityToken: identity.identityToken,
          quality: identity.quality,
          hasWebGpu: characterHasWebGpu,
          modelsAvailable: characterModelsAvailable,
          capabilityMessage: characterCapabilityMessage,
          canBuildIdentity: identity.references.length > 0,
          onPromptChange: setCharacterPrompt,
          onAspectChange: setCharacterAspect,
          onModelChange: (value) => setCharacterModelId(value as any),
          onEngineChange: setCharacterEngine,
          onPoseChange: setCharacterPoseId,
          onUploadClick: triggerFilePicker,
          onDropFiles: (files) => addCharacterReferences(files),
          onRemoveReference: removeCharacterReference,
          onBuildIdentity: buildCharacterIdentity,
          onGenerate: () => generateCharacter(),
        }}
        propertiesRecreate={{
          variant: "image-to-image",
          aspect,
          modelId: model,
          modelLabel: currentModelLabel,
          referenceImageUrl,
          extraImageUrls,
          referenceText,
          aspectOptions,
          isModelModalOpen,
          modelModalAnchor,
          onAspectChange: setAspect,
          onModelPickerOpen: handleOpenModelModal,
          onPrimaryImageChange: setReferenceImageUrl,
          onExtraImageChange: setExtraImageUrl,
          onClearImages: clearReferenceImages,
          onPromptTextChange: setReferenceText,
          onSave: saveActiveOutput,
          onRegenerate: regenerateOutput,
          costCredits: currentCostCredits,
          guardrailReason: generationGuardrail,
          resolvePreviewUrlById,
        }}
        propertiesRecreateVideo={{
          variant: "image-to-video",
          aspect,
          modelId: model,
          modelLabel: currentModelLabel,
          referenceImageUrl,
          extraImageUrls,
          referenceText,
          aspectOptions,
          isModelModalOpen,
          modelModalAnchor,
          onAspectChange: setAspect,
          onModelPickerOpen: handleOpenModelModal,
          onPrimaryImageChange: setReferenceImageUrl,
          onExtraImageChange: setExtraImageUrl,
          onClearImages: clearReferenceImages,
          onPromptTextChange: setReferenceText,
          onSave: saveActiveOutput,
          onRegenerate: handleRegenerateWithDebit,
          costCredits: currentCostCredits,
          guardrailReason: generationGuardrail,
          resolvePreviewUrlById,
          isGenerateDisabled,
        }}
        propertiesEnhance={{
          costCredits: currentCostCredits,
          isGenerateDisabled,
          resolvePreviewUrlById,
          onOpenMediaLibrary: () => window.open("/media-library", "_self"),
          onTriggerFileSelect: triggerFilePicker,
        }}
        isTemplateView={isTemplateView}
        referenceCanvasProps={{
          outputs,
          activeOutputId,
          showHeader: false,
          onSelectOutput: setActiveOutputId,
          onOpenDetails: setDetailOutputId,
        }}
        studioPreviewProps={{
          activeOutput,
          referenceImageUrl,
          referenceText,
          onReferenceImageChange: setReferenceImageUrl,
          onReferenceTextChange: setReferenceText,
          onRegenerate: regenerateOutput,
        }}
        detailModalOutput={detailOutput}
        onDetailClose={() => setDetailOutputId(null)}
        onUpdateOutputPrompt={updateOutputPrompt}
        modelModalState={{
          isOpen: isModelModalOpen,
          position: modelModalPosition,
          options: filteredModelOptions,
          onClose: closeModelModal,
          onSelect: handleSelectModelFromModal,
        }}
        agentChat={{
          isOpen: isAgentChatOpen,
          agentMessages,
          agentInput,
          agentActions,
          agentIsSending,
          latestAgentPrompt,
          onInputChange: setAgentInput,
          onSend: handleAgentSend,
          onApplyPrompt: handleAgentApplyPrompt,
          onSelectVariation: handleAgentSelectVariation,
          onAddToGrid: handleAgentAddToGrid,
          onUsePrompt: handleAgentUsePrompt,
          onClose: handleCloseAgentChat,
          onMessageClick: handleAgentMessageClick,
        }}
        handleReferenceCanvasFiles={handleReferenceCanvasFiles}
        triggerFilePicker={triggerFilePicker}
      />
    </>
  );
}
