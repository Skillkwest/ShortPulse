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
import { StudioMode, StudioOutput, ToolId } from "../features/ai-studio/types";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { buildDefaultPricingParams, getModelConfig } from "../features/ai-studio/logic/pricing";
import type { PricingParams } from "../features/ai-studio/logic/pricingTypes";
import { useAiAgent } from "../features/ai-agent/useAiAgent";
import { randomId } from "../features/ai-studio/logic/ids";
import type { AgentActions, AgentMessage } from "../features/ai-agent/types";
import { postGeneratePrompt } from "../features/ai-studio/logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../features/ai-studio/logic/imageDescription";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { filterModelOptions } from "../features/ai-studio/logic/stateParsers";

export default function AiStudioPage() {
  const { balanceCents, balanceLoading, debit } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [agentConversationId] = useState<string>(() => randomId());
  const [isPromptRefining, setIsPromptRefining] = useState(false);

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
  const { messages: agentMessages, isSending: agentIsSending, error: agentError, send: sendToAgent, reset: resetAgentChat } = useAiAgent({
    enabled: true, // allow first-click activation; API will gate if truly disabled server-side
    conversationId: agentConversationId,
  });
  const [agentInput, setAgentInput] = useState("");
  const [agentActions, setAgentActions] = useState<AgentActions | undefined>(undefined);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages],
  );
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
    options?: { captureResult?: boolean; selectedOverride?: StudioOutput | null; modeHint?: "chat" | "enhance" | "describe" | "recreate" },
  ): Promise<{ prompt: string; referenceTitle?: string | null } | void> => {
    const rawInput = typeof textOverride === "string" ? textOverride : agentInput;
    const trimmed = rawInput.trim();
    const fallback = trimmed || prompt.trim();
    if (!fallback) return;
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    if (!trimmed) {
      setAgentInput(fallback);
    }
    const baseContext = getAgentContext({
      lastAssistantMessage: latestAssistantMessage,
      selectedOverride: options?.selectedOverride,
      modeHint: options?.modeHint as any,
    });
    if (latestAgentPrompt) {
      baseContext.activePrompt = latestAgentPrompt;
      baseContext.lastAssistantMessage = latestAgentPrompt;
    }
    let mediaPatchedContext = baseContext;

    if (baseContext.focusedSource === "image" && activeOutput?.previewUrl && !activeOutput?.previewUrl.startsWith("https://")) {
      // Convert blob/object URLs to data URLs for vision payloads.
      const safeUrl = await prepareImageUrl(activeOutput.previewUrl);
      if (safeUrl) {
        mediaPatchedContext = {
          ...baseContext,
          media: [
            {
              id: activeOutput.id,
              kind: "image",
              dataUrl: safeUrl,
              url: activeOutput.previewUrl,
              thumbnailAlt: activeOutput.prompt ?? activeOutput.previewText ?? null,
            },
          ],
        };
      }
    }

    let { actions } = await sendToAgent({
      text: fallback,
      previousPrompt: latestAgentPrompt ?? null,
      context: mediaPatchedContext,
    });
    const appliedPrompt = actions?.applyPrompt ?? latestAgentPrompt ?? prompt;

    // Apply strict prompt update if tool-specific context demands it (create vs recreate).
    if (actions?.applyPrompt) {
      if (options?.modeHint === "recreate") {
        setReferenceText(appliedPrompt);
      } else {
        setPrompt(appliedPrompt);
      }
      setLatestAgentPrompt(appliedPrompt);
    }

    setAgentActions(actions);
    setAgentInput("");

    if (options?.captureResult) {
      return { prompt: appliedPrompt, referenceTitle: actions?.referenceCard?.title };
    }
  };

  const handleAgentEnhanceSend = async () => {
    if (!prompt.trim()) return;
    setIsPromptRefining(true);
    try {
      // Primary: dedicated prompt refiner
      const refined = await postGeneratePrompt(prompt);
      if (refined?.prompt) {
        setPrompt(refined.prompt);
        setLatestAgentPrompt(refined.prompt);
        addAgentPromptReference(refined.prompt, refined.prompt ? "Refined prompt" : undefined);
        return;
      }
      // Fallback: chat agent with enhance hint
      const result = await handleAgentSend(prompt, { captureResult: true, modeHint: "enhance" });
      if (result && result.prompt) {
        addAgentPromptReference(result.prompt, result.referenceTitle);
      }
    } finally {
      setIsPromptRefining(false);
    }
  };

  const handleDescribeReference = async (outputId: string) => {
    if (!outputId) return;
    const target = outputs.find((item) => item.id === outputId) ?? null;
    setActiveOutputId(outputId);
    if (!target?.previewUrl) return;

    // Primary: dedicated describe-image endpoint
    const safeUrl = await prepareImageUrl(target.previewUrl);
    const described = safeUrl ? await postDescribeImage(safeUrl) : null;
    if (described?.description) {
      addAgentPromptReference(described.description, "Image describe");
      setPrompt(described.description);
      setLatestAgentPrompt(described.description);
      return;
    }

    // Fallback: chat agent with describe hint
    const result = await handleAgentSend("Describe this image", {
      captureResult: true,
      selectedOverride: target,
      modeHint: "describe",
    });
    if (result?.prompt) {
      addAgentPromptReference(result.prompt, result.referenceTitle);
      setPrompt(result.prompt);
      setLatestAgentPrompt(result.prompt);
    }
  };

  const handleDownloadReference = (outputId: string) => {
    const target = outputs.find((item) => item.id === outputId);
    if (!target?.previewUrl || typeof window === "undefined") return;
    const link = document.createElement("a");
    link.href = target.previewUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.download = target.prompt || "reference";
    link.click();
  };

  const handleSaveReference = (outputId: string) => {
    if (!outputId) return;
    setActiveOutputId(outputId);
    // Reuse existing persistence hook; assumes active output save writes to media library.
    saveActiveOutput();
  };

  const handleGenerateFromPromptReference = async (outputId: string) => {
    const target = outputs.find((item) => item.id === outputId);
    const promptText = target?.prompt ?? target?.previewText ?? "";
    if (!promptText.trim()) return;
    setActiveOutputId(outputId);
    setSelectedTool("create");
    setMode("image");
    if (target?.modelId) {
      setModel(target.modelId);
    }
    setPrompt(promptText);
    setLatestAgentPrompt(promptText);
    handleGenerate(promptText, {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: promptGenerateCostCredits ?? modelPickerCostCredits ?? currentCostCredits,
    });
  };

  const handleAgentMessageClick = useCallback(
    (message: AgentMessage) => {
      addAgentPromptReference(message.content);
      setIsAgentChatOpen(false);
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

  const handleClearAgentChat = () => {
    resetAgentChat();
    setLatestAgentPrompt(null);
    setAgentActions(undefined);
    setAgentInput("");
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

  const handleSelectOutput = useCallback(
    (id: string) => {
      setActiveOutputId((prev) => (prev === id ? null : id));
    },
    [setActiveOutputId],
  );
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

  const {
    currentCostCredits,
    modelPickerCostCredits,
    promptGenerateCostCredits,
    describeCostCredits,
    hasSufficientCreditsForCost,
    generationGuardrail,
    isGenerateDisabled,
    modelConfig,
  } =
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

  const handleGenerate = (
    promptOverride?: string | null,
    options?: { modeOverride?: StudioMode; toolOverride?: ToolId | null; costOverrideCredits?: number | null },
  ) => {
    const effectiveMode = options?.modeOverride ?? mode;
    const effectiveTool = options?.toolOverride ?? selectedTool;
    const costToDebit = options?.costOverrideCredits ?? currentCostCredits;
    const hasCreditsForDebit =
      costToDebit == null || balanceCredits == null ? true : balanceCredits >= costToDebit;

    if (!options && isGenerateDisabled) {
      handleBlockedGeneration();
      return;
    }

    if (
      effectiveTool === "create" &&
      (effectiveMode === "image" || effectiveMode === "video") &&
      costToDebit &&
      model &&
      hasCreditsForDebit
    ) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(costToDebit, memo, `out-${Date.now()}`).catch(() => { });
    }

    generateOutput(promptOverride, { modeOverride: effectiveMode, selectedToolOverride: effectiveTool });
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
    if (isGenerateDisabled || agentIsSending) {
      handleBlockedGeneration();
      return;
    }
    if (selectedTool === "image-to-video" && currentCostCredits && model && hasSufficientCreditsForCost) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => { });
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
    onAgentEnhanceSend: handleAgentEnhanceSend,
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
    // Treat refine send as a prompt-generating busy state for overlays.
    isPromptGenerating: isPromptGenerating || isPromptRefining,
    costCredits: currentCostCredits,
    isGenerateDisabled: isGenerateDisabled || agentIsSending,
    guardrailReason: generationGuardrail,
    onExpandChat: handleExpandChat,
    onCloseAgentChat: handleCloseAgentChat,
    onClearAgentChat: handleClearAgentChat,
    shouldDisableSave: useReferenceImageIndicator && mode === "enhance",
    onGenerate: handlePrimarySubmit,
    onSavePrompt: savePromptReference,
    onOpenMediaLibrary: () => window.open("/media-library", "_self"),
    agentChatOpen: isAgentChatOpen,
    onAgentApplyPrompt: () => { },
    onAgentSelectVariation: () => { },
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
          resolvePreviewUrlById: (id) => resolvePreviewUrlById(outputs, id), // Wrap to match expected Type
          agentEnabled,
          agentMessages,
          agentActions,
          agentInput,
          agentIsSending,
          agentError: agentError ?? undefined,
          stagedPrompt: latestAgentPrompt,
          onAgentInputChange: setAgentInput,
          onAgentSend: () => handleAgentSend(agentInput || referenceText || "", { modeHint: "recreate" }),
          onAgentEnhanceSend: () => handleAgentSend(referenceText || "", { captureResult: true, modeHint: "recreate" }),
          onAgentMessageClick: handleAgentMessageClick,
          onExpandChat: handleExpandChat,
          onCloseAgentChat: handleCloseAgentChat,
          onClearAgentChat: handleClearAgentChat,
          agentChatOpen: isAgentChatOpen,
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
          resolvePreviewUrlById: (id) => resolvePreviewUrlById(outputs, id), // Wrap to match expected Type
          isGenerateDisabled: isGenerateDisabled || agentIsSending,
          agentEnabled,
          agentMessages,
          agentActions,
          agentInput,
          agentIsSending,
          agentError: agentError ?? undefined,
          stagedPrompt: latestAgentPrompt,
          onAgentInputChange: setAgentInput,
          onAgentSend: () => handleAgentSend(agentInput || referenceText || "", { modeHint: "recreate" }),
          onAgentEnhanceSend: () => handleAgentSend(referenceText || "", { captureResult: true, modeHint: "recreate" }),
          onAgentMessageClick: handleAgentMessageClick,
          onExpandChat: handleExpandChat,
          onCloseAgentChat: handleCloseAgentChat,
          onClearAgentChat: handleClearAgentChat,
          agentChatOpen: isAgentChatOpen,
        }}
        propertiesEnhance={{
          costCredits: currentCostCredits,
          isGenerateDisabled: isGenerateDisabled || agentIsSending,
          resolvePreviewUrlById: (id) => resolvePreviewUrlById(outputs, id),
          onOpenMediaLibrary: () => window.open("/media-library", "_self"),
          onTriggerFileSelect: triggerFilePicker,
        }}
        isTemplateView={isTemplateView}
        referenceCanvasProps={{
          outputs,
          activeOutputId,
          showHeader: false,
          onSelectOutput: handleSelectOutput,
          onOpenDetails: setDetailOutputId,
          onDescribeImage: (output) => handleDescribeReference(output.id),
          onSaveToLibrary: (output) => handleSaveReference(output.id),
          onDownload: (output) => handleDownloadReference(output.id),
          onGeneratePrompt: (output) => handleGenerateFromPromptReference(output.id),
          generateCostCredits: promptGenerateCostCredits,
          describeCostCredits,
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
