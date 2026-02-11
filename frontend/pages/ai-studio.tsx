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
import { buildDefaultPricingParams, getModelConfig } from "../features/ai-studio/logic/pricing";
import type { PricingParams } from "../features/ai-studio/logic/pricingTypes";
import { useAiAgent } from "../features/ai-agent/useAiAgent";
import { randomId } from "../features/ai-studio/logic/ids";
import type {
  AgentActions,
  AgentAttachment,
  AgentContext,
  AgentMediaPreview,
  AgentMessage,
  AgentReferenceSummary,
} from "../prefabs/agent";
import { postGeneratePrompt } from "../features/ai-studio/logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../features/ai-studio/logic/imageDescription";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { ensureSupabaseClient } from "../lib/supabaseClient";
import { filterModelOptions } from "../features/ai-studio/logic/stateParsers";
import { MediaLibraryModal } from "../features/ai-studio/components/MediaLibraryModal";
import { useBeginnerModePreference } from "../features/ai-studio/hooks/useBeginnerModePreference";
import { extractDragDropPayload } from "../features/ai-studio/utils/dragDrop";
import {
  getStagedAgentPrompt,
  normalizePromptText,
  resolvePromptSourceBadge,
  type PromptOrigin,
} from "../features/ai-studio/logic/agentPromptOwnership";
import { addBreadcrumb } from "../lib/clientBreadcrumbs";

const MAX_AGENT_ATTACHMENTS = 10;
const MAX_AGENT_IMAGE_ATTACHMENTS = 3;

const attachmentSignature = (attachment: AgentAttachment) =>
  attachment.referenceId
    ? `${attachment.kind}:${attachment.referenceId}`
    : `${attachment.kind}:${attachment.imageUrl ?? attachment.text ?? attachment.id}`;

export default function AiStudioPage() {
  const { balanceCents, balanceLoading, refreshBalance } = useCredits();
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
    uiNotice,
    setUiNotice,
    getDefaultDurationSeconds,
    getAgentContext,
    addAgentPromptReference,
  } = useAiStudioState();

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dismissedFailureIds, setDismissedFailureIds] = useState<Set<string>>(new Set());
  const { beginnerMode, setBeginnerMode } = useBeginnerModePreference();
  const agentFlag = process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(true);
  const agentEnabled = agentFlag || agentSessionEnabled;
  const {
    messages: agentMessages,
    isSending: agentIsSending,
    error: agentError,
    send: sendToAgent,
    reset: resetAgentChat,
  } = useAiAgent({
    enabled: true, // allow first-click activation; API will gate if truly disabled server-side
    conversationId: agentConversationId,
  });
  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const agentBusy = agentIsSending || agentUiBusy;
  const [agentInput, setAgentInput] = useState("");
  const [agentActions, setAgentActions] = useState<AgentActions | undefined>(undefined);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const [promptOrigin, setPromptOrigin] = useState<PromptOrigin>("manual");
  const [agentAttachments, setAgentAttachments] = useState<AgentAttachment[]>([]);
  const [isAgentDropActive, setIsAgentDropActive] = useState(false);
  const agentDropDepthRef = useRef(0);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const agentPrimarySource = resolvePromptSourceBadge(promptOrigin);
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
  const trackAgentUiEvent = useCallback((message: string, data?: Record<string, unknown>) => {
    addBreadcrumb({
      type: "ui",
      message,
      data,
    });
  }, []);
  const handleOpenModelModal = (
    anchorId: string,
    target: HTMLElement,
    context: ModelModalContext | null = null
  ) => {
    openModelModal(anchorId, target, context);
  };

  const handleSelectModelFromModal = (value: string) => {
    setModel(value);
    closeModelModal();
  };

  const handleManualPromptChange = useCallback(
    (value: string) => {
      setSharedPrompt(value);
      setPromptOrigin("manual");
    },
    [setSharedPrompt]
  );

  const shouldRunPromptRefinerFirst = useCallback((text: string, context: AgentContext) => {
    const trimmed = text.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const hasReferenceContext =
      (context.references?.length ?? 0) > 0 || (context.media?.length ?? 0) > 0;
    const hasExistingPrompt = Boolean(context.activePrompt?.trim());
    const hasRecentAssistant = Boolean(context.lastAssistantMessage?.trim());
    const isVeryShort = wordCount < 6 || trimmed.length < 30;
    return !hasReferenceContext && !hasExistingPrompt && !hasRecentAssistant && isVeryShort;
  }, []);

  const isSupportedAttachmentDrag = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types ?? []);
    return (
      types.includes("Files") ||
      types.includes("text/reference-id") ||
      types.includes("text/reference-url") ||
      types.includes("text/uri-list") ||
      types.includes("image/url") ||
      types.includes("text/prompt") ||
      types.includes("text/plain")
    );
  }, []);

  const insertAttachment = useCallback((nextAttachment: AgentAttachment) => {
    setAgentAttachments((prev) => {
      const signature = attachmentSignature(nextAttachment);
      if (prev.some((item) => attachmentSignature(item) === signature)) {
        return prev;
      }
      let next = [...prev, nextAttachment];
      if (nextAttachment.kind === "image") {
        const imageCount = next.filter((item) => item.kind === "image").length;
        if (imageCount > MAX_AGENT_IMAGE_ATTACHMENTS) {
          const oldestImageIndex = next.findIndex((item) => item.kind === "image");
          if (oldestImageIndex >= 0) {
            next = next.filter((_, index) => index !== oldestImageIndex);
          }
        }
      }
      if (next.length > MAX_AGENT_ATTACHMENTS) {
        next = next.slice(next.length - MAX_AGENT_ATTACHMENTS);
      }
      return next;
    });
  }, []);

  const handleAgentAttachmentDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isSupportedAttachmentDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [isSupportedAttachmentDrag]
  );

  const handleAgentAttachmentDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isSupportedAttachmentDrag(event)) return;
      event.preventDefault();
      agentDropDepthRef.current += 1;
      setIsAgentDropActive(true);
    },
    [isSupportedAttachmentDrag]
  );

  const handleAgentAttachmentDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    agentDropDepthRef.current = Math.max(0, agentDropDepthRef.current - 1);
    if (agentDropDepthRef.current === 0) {
      setIsAgentDropActive(false);
    }
  }, []);

  const handleAgentAttachmentDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      agentDropDepthRef.current = 0;
      setIsAgentDropActive(false);
      const payload = extractDragDropPayload(event.dataTransfer);
      const droppedReferenceId = payload.referenceId ?? null;
      const matchedOutput = droppedReferenceId
        ? (outputs.find((item) => item.id === droppedReferenceId) ?? null)
        : null;
      const resolvedPreviewUrl = droppedReferenceId
        ? resolvePreviewUrlById(outputs, droppedReferenceId)
        : null;
      const normalizedPromptText =
        payload.promptText?.trim() ||
        matchedOutput?.prompt?.trim() ||
        matchedOutput?.previewText?.trim() ||
        null;
      const normalizedImageUrl =
        payload.imageUrl || resolvedPreviewUrl || matchedOutput?.previewUrl || null;

      if (!normalizedImageUrl && !normalizedPromptText) return;
      if (!agentSessionEnabled) {
        setAgentSessionEnabled(true);
      }

      if (normalizedImageUrl) {
        insertAttachment({
          id: randomId(),
          kind: "image",
          referenceId: droppedReferenceId,
          imageUrl: normalizedImageUrl,
          text: normalizedPromptText,
          aspect: matchedOutput?.aspect ?? null,
        });
        return;
      }

      if (normalizedPromptText) {
        insertAttachment({
          id: randomId(),
          kind: "prompt",
          referenceId: droppedReferenceId,
          text: normalizedPromptText,
          aspect: matchedOutput?.aspect ?? null,
        });
      }
    },
    [agentSessionEnabled, insertAttachment, outputs, resolvePreviewUrlById]
  );

  const handleRemoveAgentAttachment = useCallback((id: string) => {
    setAgentAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearAgentAttachments = useCallback(() => {
    setAgentAttachments([]);
  }, []);

  const handleToolSelect = (tool: ToolId | null) => {
    setSelectedTool(tool);
    if (tool === "create" || tool === "text" || tool === "edit") {
      setMode("image");
    }
    if (!tool) {
      setShowCreateTools(false);
    }
  };

  const handleAgentSend = async (
    textOverride?: string,
    options?: {
      captureResult?: boolean;
      selectedOverride?: StudioOutput | null;
      modeHint?: "chat" | "text" | "describe" | "reference";
    }
  ): Promise<{ prompt: string; referenceTitle?: string | null } | void> => {
    if (agentIsSending || agentUiBusyRef.current) return;
    const rawInput = typeof textOverride === "string" ? textOverride : agentInput;
    const trimmed = rawInput.trim();
    const fallback = trimmed || prompt.trim();
    if (!fallback) return;
    trackAgentUiEvent("studio_agent_send_requested", {
      mode_hint: options?.modeHint ?? "chat",
      has_attachments: agentAttachments.length > 0,
      image_attachments: agentAttachments.filter((item) => item.kind === "image").length,
      prompt_chars: fallback.length,
    });
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    agentUiBusyRef.current = true;
    setAgentUiBusy(true);
    const sentFromComposer = typeof textOverride !== "string";
    if (sentFromComposer && trimmed) {
      // Clear immediately so the user can draft the next message while the agent responds.
      setAgentInput("");
    }
    try {
      const baseContext = getAgentContext({
        lastAssistantMessage: latestAssistantMessage,
        selectedOverride: options?.selectedOverride,
        modeHint: options?.modeHint ?? (agentAttachments.length ? "reference" : undefined),
      });
      if (latestAgentPrompt) {
        baseContext.activePrompt = latestAgentPrompt;
        baseContext.lastAssistantMessage = latestAgentPrompt;
      }
      let mediaPatchedContext = baseContext;
      let refinedPrompt: string | null = null;

      if (agentAttachments.length) {
        const attachmentRefs: AgentReferenceSummary[] = [];
        const attachmentMedia: AgentMediaPreview[] = [];
        const selectedAttachmentIds: string[] = [];

        agentAttachments.forEach((attachment) => {
          const referenceId = attachment.referenceId ?? attachment.id;
          const attachmentText = attachment.text?.trim() || null;
          if (attachment.referenceId) {
            selectedAttachmentIds.push(attachment.referenceId);
          }
          if (attachment.kind === "image") {
            attachmentRefs.push({
              id: referenceId,
              kind: "image",
              promptSnippet: attachmentText,
              aspect: attachment.aspect ?? null,
              caption: attachmentText,
            });
            if (attachment.imageUrl) {
              attachmentMedia.push({
                id: referenceId,
                kind: "image",
                url: attachment.imageUrl,
                thumbnailAlt: attachmentText,
              });
            }
            return;
          }
          attachmentRefs.push({
            id: referenceId,
            kind: "prompt",
            promptSnippet: attachmentText,
            aspect: attachment.aspect ?? null,
            caption: null,
          });
        });

        const dedupedRefs = [...attachmentRefs, ...(mediaPatchedContext.references ?? [])].filter(
          (item, index, all) =>
            all.findIndex(
              (candidate) => candidate.id === item.id && candidate.kind === item.kind
            ) === index
        );
        const dedupedMedia = [...attachmentMedia, ...(mediaPatchedContext.media ?? [])].filter(
          (item, index, all) =>
            all.findIndex((candidate) => candidate.id === item.id && candidate.url === item.url) ===
            index
        );
        const mergedSelectedReferenceIds = Array.from(
          new Set([...(mediaPatchedContext.selectedReferenceIds ?? []), ...selectedAttachmentIds])
        ).slice(0, 8);
        const hasImageAttachments = attachmentMedia.length > 0;

        mediaPatchedContext = {
          ...mediaPatchedContext,
          references: dedupedRefs.slice(0, 24),
          media: dedupedMedia.slice(0, MAX_AGENT_IMAGE_ATTACHMENTS),
          selectedReferenceIds: mergedSelectedReferenceIds,
          focusedSource: hasImageAttachments ? "image" : "prompt",
          focusedReferenceId:
            mergedSelectedReferenceIds.length === 1 ? mergedSelectedReferenceIds[0] : null,
        };
      }

      if (mediaPatchedContext.media?.length) {
        const hydratedMedia: AgentMediaPreview[] = [];
        for (const mediaItem of mediaPatchedContext.media.slice(0, MAX_AGENT_IMAGE_ATTACHMENTS)) {
          const sourceUrl = mediaItem.url?.trim() || mediaItem.dataUrl?.trim() || "";
          if (!sourceUrl) continue;
          const safeUrl = await prepareImageUrl(sourceUrl);
          if (safeUrl?.startsWith("https://")) {
            hydratedMedia.push({ ...mediaItem, url: safeUrl, dataUrl: undefined });
            continue;
          }
        }
        mediaPatchedContext = {
          ...mediaPatchedContext,
          media: hydratedMedia,
        };
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

      const { response, actions } = await sendToAgent({
        text: fallback,
        payloadText: refinedPrompt ?? fallback,
        previousPrompt: latestAgentPrompt ?? refinedPrompt ?? null,
        context: mediaPatchedContext,
      });

      if (!response) {
        trackAgentUiEvent("studio_agent_response_empty", {
          mode_hint: options?.modeHint ?? "chat",
        });
        if (options?.captureResult) return;
        return;
      }

      const appliedPrompt = normalizePromptText(actions?.applyPrompt);
      trackAgentUiEvent("studio_agent_response_received", {
        mode_hint: options?.modeHint ?? "chat",
        has_apply_prompt: Boolean(appliedPrompt),
        variation_count: actions?.variations?.length ?? 0,
        question_count: actions?.questions?.length ?? 0,
        describe_target_count: actions?.describeTargets?.length ?? 0,
      });

      if (appliedPrompt) {
        setSharedPrompt(appliedPrompt);
        setLatestAgentPrompt(appliedPrompt);
        setPromptOrigin("agent");
      }

      setAgentActions(actions);
      if (agentAttachments.length) {
        setAgentAttachments([]);
      }

      if (options?.captureResult && appliedPrompt) {
        return { prompt: appliedPrompt, referenceTitle: actions?.referenceCard?.title };
      }
    } finally {
      agentUiBusyRef.current = false;
      setAgentUiBusy(false);
    }
  };

  const handleAgentEnhanceSend = async () => {
    if (!prompt.trim()) return;
    setIsPromptRefining(true);
    try {
      // Primary: dedicated prompt refiner
      const refined = await postGeneratePrompt(prompt);
      if (refined?.prompt) {
        setSharedPrompt(refined.prompt);
        setLatestAgentPrompt(refined.prompt);
        addAgentPromptReference(refined.prompt, refined.prompt ? "Refined prompt" : undefined);
        setPromptOrigin("agent");
        return;
      }
      // Fallback: chat agent with text hint
      const result = await handleAgentSend(prompt, { captureResult: true, modeHint: "text" });
      if (result && typeof result === "object" && "prompt" in result) {
        addAgentPromptReference(result.prompt, result.referenceTitle ?? undefined);
        setPromptOrigin("agent");
      }
    } finally {
      setIsPromptRefining(false);
    }
  };

  const handleDescribeReference = async (outputId: string) => {
    if (!outputId) return;
    const target = outputs.find((item) => item.id === outputId) ?? null;
    if (!target?.previewUrl) return;

    const placeholderId = `describe-${randomId()}`;
    const placeholderModelLabel = model
      ? (getModelConfig(model)?.label ?? model)
      : "Model pending selection";
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
            : item
        )
      );
      setSharedPrompt(cleaned);
      setLatestAgentPrompt(cleaned);
      setPromptOrigin("agent");
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
            : item
        )
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
      if (result && typeof result === "object" && "prompt" in result && result.prompt) {
        resolvePlaceholder(result.prompt, result.referenceTitle ?? "Image describe");
        return;
      }
      failPlaceholder("Unable to describe this image.");
    } catch (error: unknown) {
      failPlaceholder(error instanceof Error ? error.message : "Unable to describe this image.");
    } finally {
      setDescribeInFlightCount((count) => Math.max(0, count - 1));
    }
  };

  const handleAgentApplyPrompt = useCallback(
    (nextPrompt: string) => {
      const normalized = normalizePromptText(nextPrompt);
      if (!normalized) return;
      setSharedPrompt(normalized);
      setLatestAgentPrompt(normalized);
      setPromptOrigin("agent");
      trackAgentUiEvent("studio_agent_apply_prompt");
    },
    [setSharedPrompt, trackAgentUiEvent]
  );

  const handleAgentSelectVariation = useCallback(
    (variation: string) => {
      const normalized = normalizePromptText(variation);
      if (!normalized) return;
      setAgentInput(normalized);
      handleAgentApplyPrompt(normalized);
      trackAgentUiEvent("studio_agent_select_variation");
    },
    [handleAgentApplyPrompt, trackAgentUiEvent]
  );

  const handleAgentUseQuestion = useCallback(
    (question: string) => {
      const normalized = normalizePromptText(question);
      if (!normalized) return;
      setAgentInput(normalized);
      trackAgentUiEvent("studio_agent_use_question");
    },
    [trackAgentUiEvent]
  );

  const handleAgentDescribeTargets = (targets: string[]) => {
    const validTargets = targets.filter((targetId) =>
      outputs.some((output) => output.id === targetId)
    );
    trackAgentUiEvent("studio_agent_describe_targets", {
      requested_count: targets.length,
      valid_count: validTargets.length,
    });
    if (!validTargets.length) {
      setUiNotice("No valid reference targets were available to describe.");
      return;
    }
    void Promise.all(validTargets.map((targetId) => handleDescribeReference(targetId)));
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
        const { data, error } = await supabase.storage
          .from("media_library")
          .download(fileRecord.storage_path);
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
    setPromptOrigin("reference");
    await handleGenerate(promptText, {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits:
        promptGenerateCostCredits ?? modelPickerCostCredits ?? currentCostCredits,
    });
  };

  const handleAgentMessageClick = useCallback(
    (message: AgentMessage) => {
      const normalizedMessagePrompt = normalizePromptText(message.content);
      if (!normalizedMessagePrompt) return;
      if (message.role === "assistant") {
        setLatestAgentPrompt(normalizedMessagePrompt);
        setPromptOrigin("agent");
      } else {
        setPromptOrigin("manual");
      }
      addAgentPromptReference(message.content);
      setIsAgentChatOpen(false);
    },
    [addAgentPromptReference]
  );

  const handleExpandChat = () => {
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    setIsAgentChatOpen((prev) => !prev);
  };

  const handleAgentAddToGrid = () => {
    if (latestAgentPrompt) {
      addAgentPromptReference(latestAgentPrompt, agentActions?.referenceCard?.title);
      setPromptOrigin("agent");
      trackAgentUiEvent("studio_agent_add_to_grid");
    }
    setIsAgentChatOpen(false);
  };

  const handleClearAgentChat = () => {
    resetAgentChat();
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    setAgentActions(undefined);
    setAgentInput("");
    setAgentAttachments([]);
    setIsAgentDropActive(false);
    agentDropDepthRef.current = 0;
    setIsAgentChatOpen(false);
    trackAgentUiEvent("studio_agent_chat_cleared");
  };

  const handleOpenMediaLibrary = useCallback(() => {
    setIsMediaLibraryOpen(true);
  }, []);

  const handleCloseMediaLibrary = useCallback(() => {
    setIsMediaLibraryOpen(false);
  }, []);

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
    [setActiveOutputId]
  );
  const triggerFilePicker = () => referenceCanvasFileInputRef.current?.click();
  const dismissError = () => setUiError(null);
  const dismissNotice = () => setUiNotice(null);

  const failedOutputs = useMemo(
    () => outputs.filter((item) => item.taskState === "fail" && item.errorMessage),
    [outputs]
  );

  const visibleFailures = useMemo(
    () => failedOutputs.filter((item) => !dismissedFailureIds.has(item.id)),
    [dismissedFailureIds, failedOutputs]
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
    selectedTool === "templates" ||
    selectedTool === "workflows" ||
    selectedTool === "my-generations" ||
    selectedTool === "community";

  const defaultPricingParams = useMemo(
    () => (model ? buildDefaultPricingParams(model) : {}),
    [model]
  );

  const costParamsForModel = useCallback(
    (overrides: Omit<PricingParams, "modelId"> = {}) => ({
      modelId: model ?? "",
      ...defaultPricingParams,
      aspect,
      ...overrides,
    }),
    [aspect, defaultPricingParams, model]
  );

  const filteredModelOptions = useMemo(() => {
    const base = filterModelOptions(mode, selectedTool, modelOptions, getModelConfig);
    if (selectedTool === "video" && videoReferenceMode === "standard") {
      return base.filter(
        (opt) => opt.mediaType === "image-to-video" && !opt.value.includes("kling")
      );
    }
    if (selectedTool === "video" && videoReferenceMode === "keyframes") {
      // Show both Veo first/last frame and Kling 3.0 (supports optional end frame)
      return base.filter(
        (opt) =>
          opt.value === "fal-ai/veo3.1/first-last-frame-to-video" ||
          opt.value === "fal-ai/kling-video/v3/pro/image-to-video"
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
    isCreditGuardrail,
    generationGuardrail,
    isGenerateDisabled,
    referenceImageWarning,
  } = useAiStudioViewModel({
    mode,
    model,
    aspect,
    prompt,
    referenceImageUrl,
    activeOutput,
    selectedTool,
    useReferenceImageIndicator,
    getDefaultDurationSeconds,
    videoDurationSeconds,
    videoResolution,
    imageResolution,
    videoGenerateAudio,
    balanceCredits,
    costParamsForModel,
  });

  const handleBlockedGeneration = () => {
    if (generationGuardrail) {
      setUiError(generationGuardrail);
    }
  };

  const ensureFreshCreditsForRun = useCallback(
    async (requiredCredits: number | null | undefined): Promise<boolean> => {
      if (requiredCredits == null) return true;
      const latestBalance = await refreshBalance({ silent: true });
      const resolvedBalance = latestBalance ?? balanceCredits;
      if (resolvedBalance == null) return true;
      return resolvedBalance >= requiredCredits;
    },
    [balanceCredits, refreshBalance]
  );

  const handleGenerate = async (
    promptOverride?: string | null,
    options?: {
      modeOverride?: StudioMode;
      toolOverride?: ToolId | null;
      costOverrideCredits?: number | null;
    }
  ) => {
    const effectiveMode = options?.modeOverride ?? mode;
    const effectiveTool = options?.toolOverride ?? selectedTool;
    const requiredCredits = options?.costOverrideCredits ?? currentCostCredits;

    if (
      options?.costOverrideCredits != null &&
      balanceCredits != null &&
      balanceCredits < options.costOverrideCredits
    ) {
      const hasFreshCredits = await ensureFreshCreditsForRun(options.costOverrideCredits);
      if (!hasFreshCredits) {
        setUiError("You do not have enough credits for this run.");
        return;
      }
    }

    if (!options && isGenerateDisabled) {
      if (isCreditGuardrail) {
        const hasFreshCredits = await ensureFreshCreditsForRun(requiredCredits);
        if (!hasFreshCredits) {
          handleBlockedGeneration();
          return;
        }
      } else {
        handleBlockedGeneration();
        return;
      }
    }

    const promptToUse = typeof promptOverride === "string" ? promptOverride : prompt;
    generateOutput(promptToUse, {
      modeOverride: effectiveMode,
      selectedToolOverride: effectiveTool,
    });
  };

  const handlePrimarySubmit = () => {
    if ((selectedTool === "create" || selectedTool === "text") && mode === "text") {
      handleAgentSend(agentInput || prompt, { captureResult: true }).then((result) => {
        const agentRes = result as { prompt: string; referenceTitle?: string } | undefined;
        if (agentRes?.prompt) {
          addAgentPromptReference(agentRes.prompt, agentRes.referenceTitle);
          setPromptOrigin("agent");
        }
      });
      return;
    }
    void handleGenerate(prompt);
  };

  const handleRegenerateWithDebit = async () => {
    if (agentBusy) {
      handleBlockedGeneration();
      return;
    }
    if (isGenerateDisabled && !isCreditGuardrail) {
      handleBlockedGeneration();
      return;
    }
    if (isCreditGuardrail) {
      const hasFreshCredits = await ensureFreshCreditsForRun(currentCostCredits);
      if (!hasFreshCredits) {
        handleBlockedGeneration();
        return;
      }
    }
    regenerateOutput();
  };

  const handleImageRegenerateWithDebit = async () => {
    if (agentBusy) {
      handleBlockedGeneration();
      return;
    }
    if (isGenerateDisabled && !isCreditGuardrail) {
      handleBlockedGeneration();
      return;
    }
    if (isCreditGuardrail) {
      const hasFreshCredits = await ensureFreshCreditsForRun(currentCostCredits);
      if (!hasFreshCredits) {
        handleBlockedGeneration();
        return;
      }
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
    agentIsSending: agentBusy,
    agentError: agentError ?? undefined,
    agentPrimarySource,
    stagedPrompt: stagedAgentPrompt,
    stagedAttachments: agentAttachments,
    agentDropActive: isAgentDropActive,
    onAgentInputChange: setAgentInput,
    onAgentSend: handleAgentSend,
    onAgentEnhanceSend: handleAgentEnhanceSend,
    onAgentMessageClick: handleAgentMessageClick,
    onAgentAttachmentDrop: handleAgentAttachmentDrop,
    onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
    onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
    onRemoveAgentAttachment: handleRemoveAgentAttachment,
    onClearAgentAttachments: handleClearAgentAttachments,
    onAgentApplyPrompt: handleAgentApplyPrompt,
    onAgentSelectVariation: handleAgentSelectVariation,
    onAgentUseQuestion: handleAgentUseQuestion,
    onAgentDescribeTargets: handleAgentDescribeTargets,
    useReferenceImageIndicator,
    hasReferencePreview: Boolean(activeOutput?.previewUrl),
    isModelModalOpen,
    modelModalAnchor,
    onAspectChange: setAspect,
    onModelPickerOpen: handleOpenModelModal,
    onPromptChange: handleManualPromptChange,
    onToggleReferenceIndicator: toggleReferenceIndicator,
    // Treat refine send as a prompt-generating busy state for overlays.
    isPromptGenerating: isPromptGenerating || isPromptRefining || describeInFlightCount > 0,
    costCredits: currentCostCredits,
    isGenerateDisabled: isGenerateDisabled || agentBusy,
    guardrailReason: generationGuardrail,
    onExpandChat: handleExpandChat,
    onClearAgentChat: handleClearAgentChat,
    shouldDisableSave: useReferenceImageIndicator && mode === "text",
    onGenerate: handlePrimarySubmit,
    onSavePrompt: savePromptReference,
    agentChatOpen: isAgentChatOpen,
    // Video settings props
    videoDurationSeconds,
    videoResolution,
    imageResolution,
    videoGenerateAudio,
    videoCameraFixed,
    videoAutoFix,
    onVideoDurationChange: setVideoDurationSeconds,
    onVideoResolutionChange: setVideoResolution,
    onImageResolutionChange: setImageResolution,
    onVideoGenerateAudioChange: setVideoGenerateAudio,
    onVideoCameraFixedChange: setVideoCameraFixed,
    onVideoAutoFixChange: setVideoAutoFix,
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
        uiNotice={uiNotice}
        characterError={characterError}
        onDismissUiError={dismissError}
        onDismissUiNotice={dismissNotice}
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
          onModelChange: (value) =>
            setCharacterModelId(value as Parameters<typeof setCharacterModelId>[0]),
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
          onPromptTextChange: handleManualPromptChange,
          onSave: () => savePromptReference(referenceText ?? ""),
          onRegenerate: handleImageRegenerateWithDebit,
          costCredits: currentCostCredits,
          isGenerateDisabled: isGenerateDisabled || agentBusy,
          guardrailReason: generationGuardrail,
          referenceImageWarning,
          resolvePreviewUrlById: (id) => resolvePreviewUrlById(outputs, id), // Wrap to match expected Type
          agentEnabled,
          agentMessages,
          agentActions,
          agentInput,
          agentIsSending: agentBusy,
          agentError: agentError ?? undefined,
          stagedPrompt: stagedAgentPrompt,
          agentPrimarySource,
          onAgentInputChange: setAgentInput,
          onAgentSend: () => handleAgentSend(undefined, { modeHint: "reference" }),
          onAgentEnhanceSend: () =>
            handleAgentSend(referenceText || "", { captureResult: true, modeHint: "reference" }),
          onAgentMessageClick: handleAgentMessageClick,
          onAgentApplyPrompt: handleAgentApplyPrompt,
          onAgentSelectVariation: handleAgentSelectVariation,
          onAgentUseQuestion: handleAgentUseQuestion,
          onAgentDescribeTargets: handleAgentDescribeTargets,
          onExpandChat: handleExpandChat,
          onClearAgentChat: handleClearAgentChat,
          agentChatOpen: isAgentChatOpen,
          imageResolution,
          onImageResolutionChange: setImageResolution,
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
          videoCameraFixed,
          onVideoCameraFixedChange: setVideoCameraFixed,
          videoAutoFix,
          onVideoAutoFixChange: setVideoAutoFix,
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
          motionVideoUrl: motionReferenceVideoUrl,
          onMotionVideoChange: setMotionReferenceVideoUrl,
          referenceText,
          aspectOptions,
          isModelModalOpen,
          modelModalAnchor,
          onAspectChange: setAspect,
          onModelPickerOpen: handleOpenModelModal,
          onPrimaryImageChange: setReferenceImageUrl,
          onExtraImageChange: setExtraImageUrl,
          onPromptTextChange: handleManualPromptChange,
          onSave: saveActiveOutput,
          onRegenerate: handleRegenerateWithDebit,
          costCredits: currentCostCredits,
          guardrailReason: generationGuardrail,
          referenceImageWarning,
          resolvePreviewUrlById: (id) => resolvePreviewUrlById(outputs, id), // Wrap to match expected Type
          isGenerateDisabled: isGenerateDisabled || agentBusy,
          agentEnabled,
          agentMessages,
          agentActions,
          agentInput,
          agentIsSending: agentBusy,
          agentError: agentError ?? undefined,
          stagedPrompt: stagedAgentPrompt,
          agentPrimarySource,
          onAgentInputChange: setAgentInput,
          onAgentSend: () => handleAgentSend(undefined, { modeHint: "reference" }),
          onAgentEnhanceSend: () =>
            handleAgentSend(referenceText || "", { captureResult: true, modeHint: "reference" }),
          onAgentMessageClick: handleAgentMessageClick,
          onAgentApplyPrompt: handleAgentApplyPrompt,
          onAgentSelectVariation: handleAgentSelectVariation,
          onAgentUseQuestion: handleAgentUseQuestion,
          onAgentDescribeTargets: handleAgentDescribeTargets,
          onExpandChat: handleExpandChat,
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
          onReferenceTextChange: handleManualPromptChange,
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
          agentActions,
          agentInput,
          agentIsSending: agentBusy,
          latestAgentPrompt,
          agentPrimarySource,
          stagedAttachments: agentAttachments,
          agentDropActive: isAgentDropActive,
          onInputChange: setAgentInput,
          onSend: handleAgentSend,
          onAddToGrid: handleAgentAddToGrid,
          onClose: handleCloseAgentChat,
          onAttachmentDrop: handleAgentAttachmentDrop,
          onAttachmentDragOver: handleAgentAttachmentDragOver,
          onAttachmentDragEnter: handleAgentAttachmentDragEnter,
          onAttachmentDragLeave: handleAgentAttachmentDragLeave,
          onRemoveAttachment: handleRemoveAgentAttachment,
          onClearAttachments: handleClearAgentAttachments,
          onMessageClick: handleAgentMessageClick,
          onAgentApplyPrompt: handleAgentApplyPrompt,
          onAgentSelectVariation: handleAgentSelectVariation,
          onAgentUseQuestion: handleAgentUseQuestion,
          onAgentDescribeTargets: handleAgentDescribeTargets,
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
