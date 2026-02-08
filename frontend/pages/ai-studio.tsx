/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import { aspectOptions, modelOptions } from "../features/ai-studio/constants";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import type { ModelModalContext } from "../features/ai-studio/components/ModelModal";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import { StudioMode, StudioOutput, ToolId } from "../features/ai-studio/types";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { buildDefaultPricingParams, computeCostForModel, getModelConfig } from "../features/ai-studio/logic/pricing";
import type { PricingParams } from "../features/ai-studio/logic/pricingTypes";
import { useAiAgent } from "../features/ai-agent/useAiAgent";
import { randomId } from "../features/ai-studio/logic/ids";
import type { AgentActions, AgentContext, AgentMessage } from "../prefabs/agent";
import { postGeneratePrompt, TEXT_PROMPT_MODEL_ID } from "../features/ai-studio/logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../features/ai-studio/logic/imageDescription";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { ensureSupabaseClient } from "../lib/supabaseClient";
import { filterModelOptions } from "../features/ai-studio/logic/stateParsers";
import { estimatePromptTokens } from "../features/ai-studio/logic/tokenEstimates";
import { MediaLibraryModal } from "../features/ai-studio/components/MediaLibraryModal";

export default function AiStudioPage() {
  const { balanceCents, balanceLoading, debit } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [agentConversationId] = useState<string>(() => randomId());
  const [isPromptRefining, setIsPromptRefining] = useState(false);
  const [describeInFlightCount, setDescribeInFlightCount] = useState(0);

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
    outputs,
    setOutputs,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    saved,
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
    videoGenerateAudio,
    setVideoGenerateAudio,
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
    motionCharacterOrientation,
    setMotionCharacterOrientation,
    motionKeepOriginalSound,
    setMotionKeepOriginalSound,
    motionCharacterUrl,
    setMotionCharacterUrl,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    referenceText,
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
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
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
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages],
  );
  const handleOpenModelModal = (
    anchorId: string,
    target: HTMLElement,
    context: ModelModalContext | null = null,
  ) => {
    openModelModal(anchorId, target, context);
  };

  const handleSelectModelFromModal = (value: string) => {
    setModel(value);
    closeModelModal();
  };

  const shouldRunPromptRefinerFirst = useCallback(
    (text: string, context: AgentContext) => {
      const trimmed = text.trim();
      const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
      const hasReferenceContext = (context.references?.length ?? 0) > 0 || (context.media?.length ?? 0) > 0;
      const hasExistingPrompt = Boolean(context.activePrompt?.trim());
      const hasRecentAssistant = Boolean(context.lastAssistantMessage?.trim());
      const isVeryShort = wordCount < 6 || trimmed.length < 30;
      return !hasReferenceContext && !hasExistingPrompt && !hasRecentAssistant && isVeryShort;
    },
    [],
  );

  const handleToolSelect = (tool: ToolId | null) => {
    setSelectedTool(tool);
    if (!tool) {
      setShowCreateTools(false);
    }
  };

  const handleAgentSend = async (
    textOverride?: string,
    options?: { captureResult?: boolean; selectedOverride?: StudioOutput | null; modeHint?: "chat" | "text" | "describe" | "reference" },
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
      modeHint: options?.modeHint,
    });
    if (latestAgentPrompt) {
      baseContext.activePrompt = latestAgentPrompt;
      baseContext.lastAssistantMessage = latestAgentPrompt;
    }
    let mediaPatchedContext = baseContext;
    let refinedPrompt: string | null = null;

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

    if (shouldRunPromptRefinerFirst(fallback, mediaPatchedContext)) {
      try {
        const refined = await postGeneratePrompt(fallback);
        if (refined?.prompt) {
          refinedPrompt = refined.prompt.trim();
          mediaPatchedContext = {
            ...mediaPatchedContext,
            activePrompt: refinedPrompt,
            lastAssistantMessage: refinedPrompt,
          };
        }
      } catch {
        // If refinement fails, continue with the original input.
      }
    }

    let { actions } = await sendToAgent({
      text: fallback,
      payloadText: refinedPrompt ?? fallback,
      previousPrompt: latestAgentPrompt ?? refinedPrompt ?? null,
      context: mediaPatchedContext,
    });
    const appliedPrompt = actions?.applyPrompt ?? latestAgentPrompt ?? prompt;

    // Apply strict prompt update if tool-specific context demands it (create vs reference).
    if (actions?.applyPrompt) {
      setSharedPrompt(appliedPrompt);
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
      const debitPromptRefine = () => {
        if (promptRefineCostCredits == null) return;
        debit(promptRefineCostCredits, "Prompt refine", `prompt-${Date.now()}`).catch(() => {});
      };
      // Primary: dedicated prompt refiner
      const refined = await postGeneratePrompt(prompt);
      if (refined?.prompt) {
        setSharedPrompt(refined.prompt);
        setLatestAgentPrompt(refined.prompt);
        addAgentPromptReference(refined.prompt, refined.prompt ? "Refined prompt" : undefined);
        debitPromptRefine();
        return;
      }
      // Fallback: chat agent with text hint
      const result = await handleAgentSend(prompt, { captureResult: true, modeHint: "text" });
      if (result && typeof result === "object" && "prompt" in result) {
        addAgentPromptReference(result.prompt, result.referenceTitle ?? undefined);
        debitPromptRefine();
      }
    } finally {
      setIsPromptRefining(false);
    }
  };

  const handleDescribeReference = async (outputId: string) => {
    if (!outputId) return;
    const target = outputs.find((item) => item.id === outputId) ?? null;
    if (!target?.previewUrl) return;
    const debitDescribe = () => {
      if (describeCostCredits == null) return;
      debit(describeCostCredits, "Image describe", `describe-${Date.now()}`).catch(() => {});
    };

    const placeholderId = `describe-${randomId()}`;
    const placeholderModelLabel = model ? (getModelConfig(model)?.label ?? model) : "Model pending selection";
    setOutputs((prev) => [
      {
        id: placeholderId,
        prompt: "Describing image…",
        mode: "text",
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "ready",
        timestamp: "Describing…",
        taskState: "running",
        saveState: "idle",
        saveError: null,
      },
      ...prev,
    ]);
    setActiveOutputId(placeholderId);
    setDescribeInFlightCount((count) => count + 1);

    const resolvePlaceholder = (text: string, title?: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      setOutputs((prev) =>
        prev.map((item) =>
          item.id === placeholderId
            ? {
                ...item,
                prompt: cleaned,
                previewText: cleaned,
                status: "ready",
                timestamp: title ?? "Image describe",
                taskState: "success",
                saveState: "idle",
                saveError: null,
                errorMessage: null,
              }
            : item,
        ),
      );
      setSharedPrompt(cleaned);
      setLatestAgentPrompt(cleaned);
      debitDescribe();
    };

    const failPlaceholder = (message: string) => {
      setOutputs((prev) =>
        prev.map((item) =>
          item.id === placeholderId
            ? {
                ...item,
                taskState: "fail",
                timestamp: "Failed",
                errorMessage: message,
              }
            : item,
        ),
      );
    };

    try {
      // Primary: dedicated describe-image endpoint
      const safeUrl = await prepareImageUrl(target.previewUrl);
      const described = safeUrl ? await postDescribeImage(safeUrl) : null;
      if (described?.description) {
        resolvePlaceholder(described.description, "Image describe");
        return;
      }

      // Fallback: chat agent with describe hint
      const result = await handleAgentSend("Describe this image", {
        captureResult: true,
        selectedOverride: target,
        modeHint: "describe",
      });
      if (result?.prompt) {
        resolvePlaceholder(result.prompt, result.referenceTitle ?? "Image describe");
        return;
      }
      failPlaceholder("Unable to describe this image.");
    } catch (error: any) {
      failPlaceholder(error?.message || "Unable to describe this image.");
    } finally {
      setDescribeInFlightCount((count) => Math.max(0, count - 1));
    }
  };

  const handleDownloadReference = async (outputId: string) => {
    const target = outputs.find((item) => item.id === outputId);
    if (!target || typeof window === "undefined") return;
    try {
      const supabase = ensureSupabaseClient();
      let fileRecord: { storage_path: string; filename: string } | null = null;

      if (target.savedMediaIds?.length) {
        const { data } = await supabase
          .from("media_files")
          .select("storage_path, filename, created_at")
          .in("id", target.savedMediaIds)
          .order("created_at", { ascending: false })
          .limit(1);
        fileRecord = data?.[0] ?? null;
      } else if (target.generationId) {
        const { data } = await supabase
          .from("media_files")
          .select("storage_path, filename")
          .eq("source_ref", target.generationId)
          .order("created_at", { ascending: false })
          .limit(1);
        fileRecord = data?.[0] ?? null;
      }

      if (fileRecord?.storage_path) {
        const { data, error } = await supabase.storage.from("media_library").download(fileRecord.storage_path);
        if (error) throw error;
        const blob = data as Blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileRecord.filename || target.prompt || "reference";
        link.click();
        window.URL.revokeObjectURL(url);
        return;
      }

      if (target.previewUrl) {
        const link = document.createElement("a");
        link.href = target.previewUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.download = target.prompt || "reference";
        link.click();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to download media.";
      setUiError(message);
    }
  };

  const handleSaveReference = (outputId: string) => {
    if (!outputId) return;
    saveReferenceToLibrary(outputId);
  };

  const handleGenerateFromPromptReference = async (outputId: string) => {
    const target = outputs.find((item) => item.id === outputId);
    const promptText = target?.prompt ?? target?.previewText ?? "";
    if (!promptText.trim()) return;
    setSelectedTool("create");
    setMode("image");
    if (target?.modelId) {
      setModel(target.modelId);
    }
    setSharedPrompt(promptText);
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

  const handleOpenMediaLibrary = useCallback(() => {
    setIsMediaLibraryOpen(true);
  }, []);

  const handleCloseMediaLibrary = useCallback(() => {
    setIsMediaLibraryOpen(false);
  }, []);

  const handleAgentUsePrompt = () => {
    if (latestAgentPrompt) {
      setSharedPrompt(latestAgentPrompt);
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
      modelId: model ?? "",
      ...defaultPricingParams,
      aspect,
      ...overrides,
    }),
    [aspect, defaultPricingParams, model],
  );

  const filteredModelOptions = useMemo(() => {
    const base = filterModelOptions(mode, selectedTool, modelOptions, getModelConfig);
    if (selectedTool === "video" && videoReferenceMode === "standard") {
      return base.filter((opt) => opt.mediaType === "image-to-video");
    }
    if (selectedTool === "video" && videoReferenceMode === "keyframes") {
      // Show both Veo first/last frame and Kling 3.0 (supports optional end frame)
      return base.filter(
        (opt) =>
          opt.value === "fal-ai/veo3.1/first-last-frame-to-video" ||
          opt.value === "fal-ai/kling-video/v3/pro/image-to-video",
      );
    }
    if (selectedTool === "video" && videoReferenceMode === "kling3") {
      return base.filter((opt) => opt.value === "fal-ai/kling-video/v3/pro/image-to-video");
    }
    return base;
  }, [mode, selectedTool, videoReferenceMode]);

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
      videoDurationSeconds,
      videoResolution,
      videoGenerateAudio,
      balanceCredits,
      costParamsForModel,
    });

  const promptRefineCostCredits = useMemo(() => {
    const breakdown = computeCostForModel(TEXT_PROMPT_MODEL_ID, estimatePromptTokens(prompt));
    return breakdown?.credits ?? null;
  }, [prompt]);


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
      (((effectiveTool === "create" || effectiveTool === "text") && (effectiveMode === "image" || effectiveMode === "video")) ||
        effectiveTool === "image" ||
        effectiveTool === "video") &&
      costToDebit &&
      model &&
      hasCreditsForDebit
    ) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(costToDebit, memo, `out-${Date.now()}`).catch(() => { });
    }

    const promptToUse = typeof promptOverride === "string" ? promptOverride : prompt;
    generateOutput(promptToUse, { modeOverride: effectiveMode, selectedToolOverride: effectiveTool });
  };

  const handlePrimarySubmit = () => {
    if ((selectedTool === "create" || selectedTool === "text") && mode === "text") {
      handleAgentSend(agentInput || prompt, { captureResult: true }).then((result) => {
        const agentRes = result as { prompt: string; referenceTitle?: string } | undefined;
        if (agentRes?.prompt) {
          addAgentPromptReference(agentRes.prompt, agentRes.referenceTitle);
        }
      });
      return;
    }
    handleGenerate(prompt);
  };

  const handleRegenerateWithDebit = () => {
    if (isGenerateDisabled || agentIsSending) {
      handleBlockedGeneration();
      return;
    }
    if (selectedTool === "video" && currentCostCredits && model && hasSufficientCreditsForCost) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => { });
    }
    regenerateOutput();
  };

  const handleImageRegenerateWithDebit = () => {
    if (isGenerateDisabled || agentIsSending) {
      handleBlockedGeneration();
      return;
    }
    if (currentCostCredits && model && hasSufficientCreditsForCost) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => { });
    }
    regenerateOutput();
  };

  const propertiesText = {
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
    onPromptChange: setSharedPrompt,
    onToggleReferenceIndicator: toggleReferenceIndicator,
    // Treat refine send as a prompt-generating busy state for overlays.
    isPromptGenerating: isPromptGenerating || isPromptRefining || describeInFlightCount > 0,
    costCredits: currentCostCredits,
    isGenerateDisabled: isGenerateDisabled || agentIsSending,
    guardrailReason: generationGuardrail,
    onExpandChat: handleExpandChat,
    onCloseAgentChat: handleCloseAgentChat,
    onClearAgentChat: handleClearAgentChat,
    shouldDisableSave: useReferenceImageIndicator && mode === "text",
    onGenerate: handlePrimarySubmit,
    onSavePrompt: savePromptReference,
    onOpenMediaLibrary: handleOpenMediaLibrary,
    agentChatOpen: isAgentChatOpen,
    onAgentApplyPrompt: () => { },
    onAgentSelectVariation: () => { },
    beginnerMode,
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
          showCreateTools={showCreateTools}
          onSelectTool={handleToolSelect}
          onToggleCreateTools={setShowCreateTools}
        propertiesText={propertiesText}
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
        propertiesImage={{
          variant: "image",
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
          onPromptTextChange: setSharedPrompt,
          onSave: () => savePromptReference(referenceText ?? ""),
          onRegenerate: handleImageRegenerateWithDebit,
          onOpenMediaLibrary: handleOpenMediaLibrary,
          costCredits: currentCostCredits,
          isGenerateDisabled: isGenerateDisabled || agentIsSending,
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
          onAgentSend: () => handleAgentSend(agentInput || referenceText || "", { modeHint: "reference" }),
          onAgentEnhanceSend: () => handleAgentSend(referenceText || "", { captureResult: true, modeHint: "reference" }),
          onAgentMessageClick: handleAgentMessageClick,
          onExpandChat: handleExpandChat,
          onCloseAgentChat: handleCloseAgentChat,
          onClearAgentChat: handleClearAgentChat,
          agentChatOpen: isAgentChatOpen,
          beginnerMode,
        }}
        propertiesVideo={{
          variant: "video",
          aspect,
          modelId: model,
          modelLabel: currentModelLabel,
          referenceImageUrl,
          extraImageUrls,
          videoReferenceMode,
          onVideoReferenceModeChange: setVideoReferenceMode,
          videoDurationSeconds,
          videoResolution,
          videoGenerateAudio,
          onVideoDurationChange: setVideoDurationSeconds,
          onVideoResolutionChange: setVideoResolution,
          onVideoGenerateAudioChange: setVideoGenerateAudio,
          klingNegativePrompt,
          klingCfgScale,
          klingShotType,
          klingVoiceIds,
          klingMultiPrompts,
          klingElements,
          onKlingNegativePromptChange: setKlingNegativePrompt,
          onKlingCfgScaleChange: setKlingCfgScale,
          onKlingShotTypeChange: setKlingShotType,
          onKlingVoiceIdChange: (index, value) =>
            setKlingVoiceIds((prev) => {
              const next: [string, string] = [...prev] as [string, string];
              next[index] = value;
              return next;
            }),
          onKlingMultiPromptsChange: setKlingMultiPrompts,
          onKlingElementsChange: setKlingElements,
          motionCharacterOrientation,
          motionKeepOriginalSound,
          motionVideoUrl: motionReferenceVideoUrl,
          onMotionCharacterOrientationChange: setMotionCharacterOrientation,
          onMotionKeepOriginalSoundChange: setMotionKeepOriginalSound,
          onMotionVideoChange: setMotionReferenceVideoUrl,
          referenceText,
          aspectOptions,
          isModelModalOpen,
          modelModalAnchor,
          onAspectChange: setAspect,
          onModelPickerOpen: handleOpenModelModal,
          onPrimaryImageChange: setReferenceImageUrl,
          onExtraImageChange: setExtraImageUrl,
          onPromptTextChange: setSharedPrompt,
          onSave: saveActiveOutput,
          onRegenerate: handleRegenerateWithDebit,
          onOpenMediaLibrary: handleOpenMediaLibrary,
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
          onAgentSend: () => handleAgentSend(agentInput || referenceText || "", { modeHint: "reference" }),
          onAgentEnhanceSend: () => handleAgentSend(referenceText || "", { captureResult: true, modeHint: "reference" }),
          onAgentMessageClick: handleAgentMessageClick,
          onExpandChat: handleExpandChat,
          onCloseAgentChat: handleCloseAgentChat,
          onClearAgentChat: handleClearAgentChat,
          agentChatOpen: isAgentChatOpen,
          beginnerMode,
        }}
        isTemplateView={isTemplateView}
        referenceCanvasProps={{
          outputs,
          activeOutputId,
          showHeader: false,
          disablePromptGenerate: !model,
          onSelectOutput: handleSelectOutput,
          onOpenDetails: setDetailOutputId,
          onDescribeImage: (output) => handleDescribeReference(output.id),
          onSaveToLibrary: (output) => handleSaveReference(output.id),
          onDownload: (output) => handleDownloadReference(output.id),
          onGeneratePrompt: (output) => handleGenerateFromPromptReference(output.id),
          onDeleteOutput: deleteOutput,
          generateCostCredits: promptGenerateCostCredits,
          describeCostCredits,
          selectedTool,
        }}
        studioPreviewProps={{
          activeOutput,
          referenceImageUrl,
          referenceText,
          onReferenceImageChange: setReferenceImageUrl,
          onReferenceTextChange: setSharedPrompt,
          onRegenerate: regenerateOutput,
        }}
        detailModalOutput={detailOutput}
        onDetailClose={() => setDetailOutputId(null)}
        onUpdateOutputPrompt={updateOutputPrompt}
        onDeleteOutput={deleteOutput}
        onDetailDownload={handleDownloadReference}
        onDetailSavePrompt={savePromptReference}
        onOpenMediaLibrary={handleOpenMediaLibrary}
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
          generateCost: currentCostCredits,
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
