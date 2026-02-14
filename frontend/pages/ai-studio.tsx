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
  AgentAttachmentDeliveryStatus,
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
import {
  isEditPromptTool,
  isReferencePromptTool,
  shouldApplyAgentPromptToSharedPrompt,
} from "../features/ai-studio/logic/promptTargeting";
import { addBreadcrumb } from "../lib/clientBreadcrumbs";
import {
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
} from "../features/character-manager/logic/characterManagerPersistence";
import {
  composeCharacterModePrompt,
  mergeCharacterAndUserReferences,
  resolveCharacterSheetReferenceUrls,
} from "../features/ai-studio/logic/characterModePayload";

const MAX_AGENT_ATTACHMENTS = 10;
const MAX_AGENT_IMAGE_ATTACHMENTS = 3;
const CHARACTER_MODE_BACKGROUND_MODEL_ID = "fal-ai/bytedance/seedream/v4.5/edit";
const CHARACTER_MODE_BUNDLE_STALE_AFTER_MS = 45 * 60 * 1000;

const attachmentSignature = (attachment: AgentAttachment) =>
  attachment.referenceId
    ? `${attachment.kind}:${attachment.referenceId}`
    : `${attachment.kind}:${attachment.imageUrl ?? attachment.text ?? attachment.id}`;

const isCurrentDocumentUrl = (value: string) => {
  if (typeof window === "undefined") return false;
  try {
    const current = new URL(window.location.href);
    const candidate = new URL(value, window.location.href);
    return (
      candidate.origin === current.origin &&
      candidate.pathname === current.pathname &&
      candidate.search === current.search
    );
  } catch {
    return false;
  }
};

const normalizeAttachmentImageUrl = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isCurrentDocumentUrl(trimmed)) return null;
  return trimmed;
};

const GENERATE_CLICK_COOLDOWN_MS = 700;
type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
};

type CharacterSelectOption = {
  id: string;
  name: string;
  profileImageUrl: string | null;
};

type CharacterModeInjectionBundle = {
  characterId: string;
  characterDescription: string;
  sheetReferenceUrls: string[];
  loadedAtMs: number;
};

type CharacterModeFallbackCode =
  | "no_character_selected"
  | "bundle_loading"
  | "bundle_unavailable"
  | "no_description_or_references"
  | "no_description"
  | "no_references";

export default function AiStudioPage() {
  const { balanceCents, balanceLoading, refreshBalance } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [characterOptions, setCharacterOptions] = useState<CharacterSelectOption[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [isCharacterOptionsLoading, setIsCharacterOptionsLoading] = useState(true);
  const [isCharacterBundleLoading, setIsCharacterBundleLoading] = useState(false);
  const [isCharacterModeEnabled, setIsCharacterModeEnabled] = useState(true);
  const [characterModeInjectionBundle, setCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const optimisticDebitTotal = useMemo(
    () => optimisticDebitEntries.reduce((sum, entry) => sum + entry.credits, 0),
    [optimisticDebitEntries]
  );
  const effectiveBalanceCredits = useMemo(() => {
    if (balanceCredits == null) return null;
    return Math.max(0, balanceCredits - optimisticDebitTotal);
  }, [balanceCredits, optimisticDebitTotal]);
  const [agentConversationId] = useState<string>(() => randomId());
  const [isPromptRefining, setIsPromptRefining] = useState(false);
  const [isReferencePromptEnhancing, setIsReferencePromptEnhancing] = useState(false);
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
  } = useAiStudioState();

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dismissedFailureIds, setDismissedFailureIds] = useState<Set<string>>(new Set());
  const settledGenerationSignaturesRef = useRef<Set<string>>(new Set());
  const seenOutputIdsRef = useRef<Set<string>>(new Set());
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
  const [agentInput, setAgentInput] = useState("");
  const [agentAttachmentError, setAgentAttachmentError] = useState<string | null>(null);
  const [agentActions, setAgentActions] = useState<AgentActions | undefined>(undefined);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const [promptOrigin, setPromptOrigin] = useState<PromptOrigin>("manual");
  const [agentAttachments, setAgentAttachments] = useState<AgentAttachment[]>([]);
  const [isAgentDropActive, setIsAgentDropActive] = useState(false);
  const agentDropDepthRef = useRef(0);
  const describedAgentImageCacheRef = useRef<Map<string, string>>(new Map());
  const generateClickLockUntilRef = useRef(0);
  const generateClickLockTimerRef = useRef<number | null>(null);
  const [isGenerateClickLocked, setIsGenerateClickLocked] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const previousCreateModelBeforeCharacterModeRef = useRef<string | null>(null);
  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const linkedPromptReferenceIds = useMemo(
    () =>
      Array.from(
        new Set(
          agentAttachments
            .filter((attachment) => attachment.kind === "prompt" && attachment.referenceId)
            .map((attachment) => attachment.referenceId as string)
        )
      ),
    [agentAttachments]
  );
  const agentPrimarySource = resolvePromptSourceBadge(promptOrigin);
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
  const trackCharacterModeEvent = useCallback((message: string, data?: Record<string, unknown>) => {
    addBreadcrumb({
      type: "ui",
      message,
      data,
    });
  }, []);
  const toCharacterModeInjectionBundle = useCallback(
    (
      snapshot: Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>
    ): CharacterModeInjectionBundle => ({
      characterId: snapshot.characterId,
      characterDescription: snapshot.characterDescription,
      sheetReferenceUrls: resolveCharacterSheetReferenceUrls(
        snapshot.characterSheetAssignments,
        snapshot.slots
      ),
      loadedAtMs: Date.now(),
    }),
    []
  );

  useEffect(() => {
    let active = true;
    setIsCharacterOptionsLoading(true);
    void listCharacterManagerCharacters()
      .then((items) => {
        if (!active) return;
        const mappedOptions = items.map((item) => ({
          id: item.characterId,
          name: item.characterName,
          profileImageUrl: item.profileImageUrl,
        }));
        setCharacterOptions(mappedOptions);
        setSelectedCharacterId((current) =>
          mappedOptions.some((option) => option.id === current) ? current : ""
        );
      })
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to load Character Manager profiles.";
        const normalized = message.toLowerCase();
        const isSessionTransitionError =
          normalized.includes("no active session") || normalized.includes("not authenticated");
        if (!isSessionTransitionError) {
          setUiError(message);
        }
      })
      .finally(() => {
        if (!active) return;
        setIsCharacterOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setUiError]);

  useEffect(() => {
    let active = true;
    if (!selectedCharacterId) {
      setCharacterModeInjectionBundle(null);
      setIsCharacterBundleLoading(false);
      return () => {
        active = false;
      };
    }

    setIsCharacterBundleLoading(true);
    setCharacterModeInjectionBundle(null);
    void loadCharacterManagerDraftByCharacterId(selectedCharacterId)
      .then((snapshot) => {
        if (!active) return;
        setCharacterModeInjectionBundle(toCharacterModeInjectionBundle(snapshot));
      })
      .catch(() => {
        if (!active) return;
        setCharacterModeInjectionBundle(null);
      })
      .finally(() => {
        if (!active) return;
        setIsCharacterBundleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCharacterId, toCharacterModeInjectionBundle]);

  useEffect(() => {
    const characterModeAppliesToCreate =
      isCharacterModeEnabled && (selectedTool === "create" || selectedTool === "text");

    if (characterModeAppliesToCreate) {
      if (
        model &&
        model !== CHARACTER_MODE_BACKGROUND_MODEL_ID &&
        !previousCreateModelBeforeCharacterModeRef.current
      ) {
        previousCreateModelBeforeCharacterModeRef.current = model;
      }
      if (model !== CHARACTER_MODE_BACKGROUND_MODEL_ID) {
        setModel(CHARACTER_MODE_BACKGROUND_MODEL_ID);
      }
      return;
    }

    const previousModel = previousCreateModelBeforeCharacterModeRef.current;
    previousCreateModelBeforeCharacterModeRef.current = null;
    if (
      model === CHARACTER_MODE_BACKGROUND_MODEL_ID &&
      previousModel &&
      previousModel !== CHARACTER_MODE_BACKGROUND_MODEL_ID
    ) {
      setModel(previousModel);
    }
  }, [isCharacterModeEnabled, model, selectedTool, setModel]);

  const resolveDefaultPromptForTool = useCallback(
    (tool: ToolId | null) => {
      if (tool === "video" || tool === "kling") return videoReferenceText;
      if (tool === "image" || tool === "edit") return editReferenceText;
      return prompt;
    },
    [editReferenceText, prompt, videoReferenceText]
  );

  const refreshCharacterModeInjectionBundleForSubmission = useCallback(
    async (tool: ToolId | null): Promise<CharacterModeInjectionBundle | null> => {
      const isCreateWorkflowTool = tool === "create" || tool === "text";
      if (!isCharacterModeEnabled || !isCreateWorkflowTool) return characterModeInjectionBundle;
      if (!selectedCharacterId) return null;

      const currentBundle = characterModeInjectionBundle;
      const isMissingBundleForSelectedCharacter =
        !currentBundle || currentBundle.characterId !== selectedCharacterId;
      const bundleAgeMs = currentBundle ? Date.now() - currentBundle.loadedAtMs : 0;
      const isBundleStale = currentBundle
        ? bundleAgeMs >= CHARACTER_MODE_BUNDLE_STALE_AFTER_MS
        : true;
      if (!isMissingBundleForSelectedCharacter && !isBundleStale) {
        return currentBundle;
      }

      setIsCharacterBundleLoading(true);
      trackCharacterModeEvent("character_mode_bundle_refresh_before_submit", {
        reason: isMissingBundleForSelectedCharacter ? "missing_bundle" : "stale_signed_urls",
        selected_character_id: selectedCharacterId,
        bundle_age_ms: currentBundle ? bundleAgeMs : null,
      });
      try {
        const snapshot = await loadCharacterManagerDraftByCharacterId(selectedCharacterId);
        const refreshedBundle = toCharacterModeInjectionBundle(snapshot);
        setCharacterModeInjectionBundle(refreshedBundle);
        return refreshedBundle;
      } catch (error) {
        trackCharacterModeEvent("character_mode_bundle_refresh_failed", {
          selected_character_id: selectedCharacterId,
          error:
            error instanceof Error && error.message.trim().length ? error.message : "unknown_error",
        });
        return currentBundle?.characterId === selectedCharacterId ? currentBundle : null;
      } finally {
        setIsCharacterBundleLoading(false);
      }
    },
    [
      characterModeInjectionBundle,
      isCharacterModeEnabled,
      selectedCharacterId,
      toCharacterModeInjectionBundle,
      trackCharacterModeEvent,
    ]
  );

  const resolveCharacterModeSubmissionOverrides = useCallback(
    (
      userPrompt: string,
      tool: ToolId | null,
      bundleOverride?: CharacterModeInjectionBundle | null
    ): {
      submissionPromptOverride: string;
      displayPromptOverride: string;
      referenceInputsOverride: string[];
      characterContextOverride?: StudioOutput["characterContext"];
      notice: string | null;
      fallbackCode: CharacterModeFallbackCode | null;
      characterReferenceCount: number;
      hasCharacterDescription: boolean;
    } | null => {
      const isCreateWorkflowTool = tool === "create" || tool === "text";
      if (!isCharacterModeEnabled || !isCreateWorkflowTool) return null;

      const bundle = bundleOverride ?? characterModeInjectionBundle;
      const characterDescription = bundle?.characterDescription ?? "";
      const characterReferences = bundle?.sheetReferenceUrls ?? [];
      const submissionPrompt = composeCharacterModePrompt({
        characterDescription,
        userPrompt,
      });
      const referenceInputs = mergeCharacterAndUserReferences(characterReferences, []);
      const hasCharacterDescription = Boolean(characterDescription.trim());
      const selectedCharacterOption =
        characterOptions.find((option) => option.id === selectedCharacterId) ?? null;
      const hasCharacterInjection = hasCharacterDescription || referenceInputs.length > 0;
      const characterContextOverride = hasCharacterInjection
        ? {
            applied: true,
            characterId: bundle?.characterId ?? selectedCharacterId,
            characterName: selectedCharacterOption?.name ?? null,
            characterProfileImageUrl: selectedCharacterOption?.profileImageUrl ?? null,
          }
        : undefined;

      let notice: string | null = null;
      let fallbackCode: CharacterModeFallbackCode | null = null;
      if (!selectedCharacterId) {
        notice =
          "Character Mode is enabled with no character selected. Generated without character injection.";
        fallbackCode = "no_character_selected";
      } else if (isCharacterBundleLoading) {
        notice = "Character Mode context is still loading. Generated without character injection.";
        fallbackCode = "bundle_loading";
      } else if (!bundle) {
        notice =
          "Selected character context could not be loaded. Generated without character injection.";
        fallbackCode = "bundle_unavailable";
      } else if (!hasCharacterDescription && referenceInputs.length === 0) {
        notice =
          "Selected character has no description or Character Sheet references. Generated without character injection.";
        fallbackCode = "no_description_or_references";
      } else if (!hasCharacterDescription) {
        notice =
          "Selected character has no description. Generated using Character Sheet references only.";
        fallbackCode = "no_description";
      } else if (referenceInputs.length === 0) {
        notice =
          "Selected character has no Character Sheet references. Generated using description only.";
        fallbackCode = "no_references";
      }

      return {
        submissionPromptOverride: submissionPrompt || userPrompt,
        displayPromptOverride: userPrompt,
        referenceInputsOverride: referenceInputs,
        characterContextOverride,
        notice,
        fallbackCode,
        characterReferenceCount: referenceInputs.length,
        hasCharacterDescription,
      };
    },
    [
      characterModeInjectionBundle,
      characterOptions,
      isCharacterBundleLoading,
      isCharacterModeEnabled,
      selectedCharacterId,
    ]
  );

  const trackAgentUiEvent = useCallback((message: string, data?: Record<string, unknown>) => {
    addBreadcrumb({
      type: "ui",
      message,
      data,
    });
  }, []);
  const trackCharacterModeFallback = useCallback(
    (
      overrides: {
        fallbackCode: CharacterModeFallbackCode | null;
        characterReferenceCount: number;
        hasCharacterDescription: boolean;
      } | null,
      tool: ToolId | null
    ) => {
      if (!overrides?.fallbackCode) return;
      trackCharacterModeEvent("character_mode_injection_fallback", {
        fallback_code: overrides.fallbackCode,
        selected_character_id: selectedCharacterId || null,
        tool: tool ?? null,
        has_character_description: overrides.hasCharacterDescription,
        character_reference_count: overrides.characterReferenceCount,
      });
    },
    [selectedCharacterId, trackCharacterModeEvent]
  );
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
      if (isReferencePromptTool(selectedTool)) {
        if (selectedTool === "video" || selectedTool === "kling") {
          setVideoReferenceText(value);
        } else {
          setEditReferenceText(value);
        }
      } else {
        setSharedPrompt(value);
      }
      setPromptOrigin("manual");
    },
    [selectedTool, setEditReferenceText, setSharedPrompt, setVideoReferenceText]
  );

  const handleEditPromptTextChange = useCallback(
    (value: string) => {
      setEditReferenceText(value);
      setPromptOrigin("manual");
    },
    [setEditReferenceText]
  );

  const handleVideoPromptTextChange = useCallback(
    (value: string) => {
      setVideoReferenceText(value);
      setPromptOrigin("manual");
    },
    [setVideoReferenceText]
  );

  const tryAcquireGenerateClickLock = useCallback(() => {
    const now = Date.now();
    if (now < generateClickLockUntilRef.current) {
      return false;
    }

    generateClickLockUntilRef.current = now + GENERATE_CLICK_COOLDOWN_MS;
    setIsGenerateClickLocked(true);

    if (generateClickLockTimerRef.current) {
      window.clearTimeout(generateClickLockTimerRef.current);
    }
    generateClickLockTimerRef.current = window.setTimeout(() => {
      setIsGenerateClickLocked(false);
      generateClickLockTimerRef.current = null;
      if (Date.now() >= generateClickLockUntilRef.current) {
        generateClickLockUntilRef.current = 0;
      }
    }, GENERATE_CLICK_COOLDOWN_MS);

    return true;
  }, []);

  useEffect(() => {
    return () => {
      if (generateClickLockTimerRef.current) {
        window.clearTimeout(generateClickLockTimerRef.current);
      }
    };
  }, []);

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

  const markAttachmentDelivery = useCallback(
    (
      ids: string[],
      status: AgentAttachmentDeliveryStatus,
      deliveryError?: string | null | ((attachment: AgentAttachment) => string | null)
    ) => {
      if (!ids.length) return;
      setAgentAttachments((prev) =>
        prev.map((attachment) => {
          if (!ids.includes(attachment.id)) return attachment;
          const resolvedError =
            typeof deliveryError === "function" ? deliveryError(attachment) : deliveryError;
          return {
            ...attachment,
            deliveryStatus: attachment.kind === "prompt" ? "ready" : status,
            deliveryError: attachment.kind === "prompt" ? null : (resolvedError ?? null),
          };
        })
      );
    },
    []
  );

  const insertAttachment = useCallback((nextAttachment: AgentAttachment) => {
    setAgentAttachments((prev) => {
      const signature = attachmentSignature(nextAttachment);
      if (prev.some((item) => attachmentSignature(item) === signature)) {
        return prev;
      }
      const normalizedAttachment: AgentAttachment = {
        ...nextAttachment,
        deliveryStatus:
          nextAttachment.kind === "prompt" ? "ready" : (nextAttachment.deliveryStatus ?? "pending"),
        deliveryError:
          nextAttachment.kind === "prompt" ? null : (nextAttachment.deliveryError ?? null),
      };
      let next = [...prev, normalizedAttachment];
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
    setAgentAttachmentError(null);
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
      const transferReferenceUrl = event.dataTransfer.getData("text/reference-url") || null;
      const normalizedPromptText =
        payload.promptText?.trim() ||
        matchedOutput?.prompt?.trim() ||
        matchedOutput?.previewText?.trim() ||
        null;
      const normalizedImageUrl = normalizeAttachmentImageUrl(
        resolvedPreviewUrl ||
          matchedOutput?.previewUrl ||
          transferReferenceUrl ||
          payload.imageUrl ||
          null
      );

      if (!normalizedImageUrl && !normalizedPromptText) return;
      if (!agentSessionEnabled) {
        setAgentSessionEnabled(true);
      }
      setAgentAttachmentError(null);

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
    setAgentAttachmentError(null);
    setAgentAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearAgentAttachments = useCallback(() => {
    setAgentAttachmentError(null);
    setAgentAttachments([]);
  }, []);

  const handleAgentInputChange = useCallback(
    (value: string) => {
      if (agentAttachmentError) {
        setAgentAttachmentError(null);
      }
      setAgentInput(value);
    },
    [agentAttachmentError]
  );

  const handleToolSelect = (tool: ToolId | null) => {
    setSelectedTool(tool);
    if (tool === "create" || tool === "text" || tool === "edit") {
      setMode("image");
    }
    if (!tool) {
      setShowCreateTools(false);
    }
  };

  const editPromptToolSelected = isEditPromptTool(selectedTool);

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
    const hasImageAttachment = agentAttachments.some((attachment) => attachment.kind === "image");
    const shouldAutoDescribeImages = !trimmed && hasImageAttachment;
    const droppedPromptText =
      [...agentAttachments]
        .reverse()
        .find((attachment) => attachment.kind === "prompt" && attachment.text?.trim())
        ?.text?.trim() ?? "";
    const outboundText =
      trimmed ||
      (shouldAutoDescribeImages ? "Describe this image" : "") ||
      droppedPromptText ||
      prompt.trim();
    if (!outboundText) return;
    trackAgentUiEvent("studio_agent_send_requested", {
      mode_hint: options?.modeHint ?? "chat",
      has_attachments: agentAttachments.length > 0,
      image_attachments: agentAttachments.filter((item) => item.kind === "image").length,
      prompt_chars: outboundText.length,
    });
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    setAgentAttachmentError(null);
    agentUiBusyRef.current = true;
    setAgentUiBusy(true);
    const sentFromComposer = typeof textOverride !== "string";
    const optimisticUserMessageId = appendUserMessage(trimmed || outboundText);
    if (sentFromComposer && trimmed) {
      // Clear immediately so the user sees instant send feedback.
      setAgentInput("");
    }
    try {
      const preparedImageUrls = new Map<string, string>();
      const preparedImageDescriptions = new Map<string, string>();
      const imageAttachmentsMissingUrl = agentAttachments.filter(
        (attachment) => attachment.kind === "image" && !attachment.imageUrl?.trim()
      );
      if (imageAttachmentsMissingUrl.length > 0) {
        const failedIds = imageAttachmentsMissingUrl.map((attachment) => attachment.id);
        markAttachmentDelivery(
          failedIds,
          "failed",
          "Image URL missing. Remove this image and attach it again."
        );
        setAgentAttachmentError(
          "One or more attached images are missing a valid URL. Remove failed images and try again."
        );
        trackAgentUiEvent("studio_agent_attachment_missing_url", {
          failed_image_attachments: failedIds.length,
        });
        return;
      }
      const imageAttachments = agentAttachments.filter(
        (attachment): attachment is AgentAttachment =>
          attachment.kind === "image" && Boolean(attachment.imageUrl?.trim())
      );
      if (imageAttachments.length > 0) {
        const imageAttachmentIds = imageAttachments.map((attachment) => attachment.id);
        markAttachmentDelivery(imageAttachmentIds, "preparing");

        const preparedResults = await Promise.allSettled(
          imageAttachments.map(async (attachment) => {
            const sourceUrl = attachment.imageUrl?.trim() ?? "";
            const safeUrl = sourceUrl ? await prepareImageUrl(sourceUrl) : null;
            return {
              attachmentId: attachment.id,
              safeUrl,
            };
          })
        );

        const failedAttachmentIds: string[] = [];
        preparedResults.forEach((result, index) => {
          const attachmentId = imageAttachments[index]?.id;
          if (!attachmentId) return;
          if (result.status === "fulfilled" && result.value.safeUrl?.startsWith("https://")) {
            preparedImageUrls.set(attachmentId, result.value.safeUrl);
            return;
          }
          failedAttachmentIds.push(attachmentId);
        });

        if (failedAttachmentIds.length) {
          markAttachmentDelivery(
            failedAttachmentIds,
            "failed",
            "Image upload/preparation failed. Remove this image and try again."
          );
          setAgentAttachmentError(
            "One or more attached images failed to prepare. Remove failed images and try again."
          );
          trackAgentUiEvent("studio_agent_attachment_prepare_failed", {
            failed_image_attachments: failedAttachmentIds.length,
            attempted_image_attachments: imageAttachmentIds.length,
          });
          return;
        }

        const describedResults = await Promise.allSettled(
          imageAttachments.map(async (attachment) => {
            const safeUrl = preparedImageUrls.get(attachment.id);
            if (!safeUrl) {
              throw new Error("Missing prepared image URL.");
            }
            const cachedDescription = describedAgentImageCacheRef.current.get(safeUrl)?.trim();
            if (cachedDescription) {
              return {
                attachmentId: attachment.id,
                description: cachedDescription,
              };
            }
            const described = await postDescribeImage(safeUrl);
            const description = described.description?.trim();
            if (!description) {
              throw new Error("Describe endpoint returned an empty description.");
            }
            describedAgentImageCacheRef.current.set(safeUrl, description);
            if (describedAgentImageCacheRef.current.size > 64) {
              const oldestCacheKey = describedAgentImageCacheRef.current.keys().next().value;
              if (oldestCacheKey) {
                describedAgentImageCacheRef.current.delete(oldestCacheKey);
              }
            }
            return {
              attachmentId: attachment.id,
              description,
            };
          })
        );

        const failedDescriptionIds: string[] = [];
        describedResults.forEach((result, index) => {
          const attachmentId = imageAttachments[index]?.id;
          if (!attachmentId) return;
          if (result.status === "fulfilled" && result.value.description?.trim()) {
            preparedImageDescriptions.set(attachmentId, result.value.description.trim());
            return;
          }
          failedDescriptionIds.push(attachmentId);
        });

        if (failedDescriptionIds.length) {
          markAttachmentDelivery(
            failedDescriptionIds,
            "failed",
            "Image description failed. Remove this image and attach it again."
          );
          setAgentAttachmentError(
            "One or more attached images could not be described. Remove failed images and try again."
          );
          trackAgentUiEvent("studio_agent_attachment_describe_failed", {
            failed_image_attachments: failedDescriptionIds.length,
            attempted_image_attachments: imageAttachmentIds.length,
          });
          return;
        }

        markAttachmentDelivery(imageAttachmentIds, "ready", null);
      }

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
            const describedImageText = preparedImageDescriptions.get(attachment.id) ?? null;
            const userNote =
              attachmentText && attachmentText !== describedImageText
                ? `User note: ${attachmentText}`
                : null;
            const imageContextSummary =
              [describedImageText, userNote].filter(Boolean).join("\n\n") || attachmentText;
            attachmentRefs.push({
              id: referenceId,
              kind: "image",
              promptSnippet: describedImageText ?? attachmentText,
              aspect: attachment.aspect ?? null,
              caption: imageContextSummary,
            });
            const safeImageUrl = preparedImageUrls.get(attachment.id);
            if (safeImageUrl) {
              attachmentMedia.push({
                id: referenceId,
                kind: "image",
                url: safeImageUrl,
                thumbnailAlt: describedImageText ?? attachmentText,
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

      if (shouldRunPromptRefinerFirst(outboundText, mediaPatchedContext)) {
        try {
          const refined = await postGeneratePrompt(outboundText);
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
        text: outboundText,
        payloadText: refinedPrompt ?? outboundText,
        previousPrompt: latestAgentPrompt ?? refinedPrompt ?? null,
        context: mediaPatchedContext,
        skipUserEcho: true,
        optimisticUserMessageId,
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
        setLatestAgentPrompt(appliedPrompt);
        if (shouldApplyAgentPromptToSharedPrompt(selectedTool)) {
          setSharedPrompt(appliedPrompt);
          setPromptOrigin("agent");
        }
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

  const handleReferencePromptEnhance = async () => {
    const isVideoPromptTool = selectedTool === "video" || selectedTool === "kling";
    const currentPrompt =
      (isVideoPromptTool ? videoReferenceText : editReferenceText)?.trim() ?? "";
    if (!currentPrompt || isReferencePromptEnhancing) return;
    setIsReferencePromptEnhancing(true);
    try {
      const refined = await postGeneratePrompt(currentPrompt);
      const nextPrompt = normalizePromptText(refined?.prompt);
      if (nextPrompt) {
        if (isVideoPromptTool) {
          setVideoReferenceText(nextPrompt);
        } else {
          setEditReferenceText(nextPrompt);
        }
        setPromptOrigin("manual");
      }
    } finally {
      setIsReferencePromptEnhancing(false);
    }
  };

  const handleDescribeReference = async (outputId: string) => {
    if (!outputId) return;
    const target = outputs.find((item) => item.id === outputId) ?? null;
    if (!target?.previewUrl) return;

    const placeholderId = `describe-${randomId()}`;
    const placeholderModelLabel = "OpenAI vision describe";
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
      const safeUrl = await prepareImageUrl(target.previewUrl);
      if (!safeUrl) {
        failPlaceholder(
          "Unable to prepare this image for OpenAI vision. Please remove and re-add the reference."
        );
        return;
      }
      const described = await postDescribeImage(safeUrl);
      resolvePlaceholder(described.description, "Image describe");
    } catch (error: unknown) {
      failPlaceholder(
        error instanceof Error ? error.message : "Unable to describe this image with OpenAI vision."
      );
    } finally {
      setDescribeInFlightCount((count) => Math.max(0, count - 1));
    }
  };

  const handleAgentApplyPrompt = useCallback(
    (nextPrompt: string) => {
      if (editPromptToolSelected) return;
      const normalized = normalizePromptText(nextPrompt);
      if (!normalized) return;
      setSharedPrompt(normalized);
      setLatestAgentPrompt(normalized);
      setPromptOrigin("agent");
      trackAgentUiEvent("studio_agent_apply_prompt");
    },
    [editPromptToolSelected, setSharedPrompt, trackAgentUiEvent]
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

    const isVideoWorkflow = selectedTool === "video" || selectedTool === "kling";
    const isEditWorkflow = selectedTool === "edit" || selectedTool === "image";
    const workflowTool: ToolId = isVideoWorkflow ? "video" : isEditWorkflow ? "edit" : "create";
    const workflowMode: StudioMode = isVideoWorkflow ? "video" : "image";

    if (workflowTool === "video") {
      setVideoReferenceText(promptText);
    } else if (workflowTool === "edit") {
      setEditReferenceText(promptText);
    } else {
      setSharedPrompt(promptText);
      if (selectedTool !== "create" && selectedTool !== "text") {
        setSelectedTool("create");
      }
      setMode("image");
    }

    // Keep the currently selected model. Prompt cards persist historical model metadata.
    setPromptOrigin("reference");
    await handleGenerate(promptText, {
      modeOverride: workflowMode,
      toolOverride: workflowTool,
      costOverrideCredits: currentCostCredits,
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
    setAgentAttachmentError(null);
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

  useEffect(() => {
    const newlySeenOutputIds: string[] = [];
    outputs.forEach((output) => {
      if (!seenOutputIdsRef.current.has(output.id)) {
        newlySeenOutputIds.push(output.id);
      }
      seenOutputIdsRef.current.add(output.id);
    });
    if (!newlySeenOutputIds.length) return;

    setOptimisticDebitEntries((prev) => {
      if (!prev.some((entry) => entry.outputId == null)) return prev;
      const assignedOutputIds = new Set(
        prev.map((entry) => entry.outputId).filter((id): id is string => Boolean(id))
      );
      const newlyPendingOutputIds = newlySeenOutputIds.filter((id) => {
        const item = outputs.find((output) => output.id === id);
        return Boolean(
          item &&
          item.id.startsWith("out-") &&
          item.taskState === "pending" &&
          !assignedOutputIds.has(item.id)
        );
      });
      const fallbackPendingOutputIds = outputs
        .filter(
          (item) =>
            item.id.startsWith("out-") &&
            item.taskState === "pending" &&
            !assignedOutputIds.has(item.id) &&
            !newlyPendingOutputIds.includes(item.id)
        )
        .map((item) => item.id);
      const availableOutputIds = [...newlyPendingOutputIds, ...fallbackPendingOutputIds];
      if (!availableOutputIds.length) return prev;

      let nextIndex = 0;
      let changed = false;
      const next = prev.map((entry) => {
        if (entry.outputId != null || nextIndex >= availableOutputIds.length) {
          return entry;
        }
        changed = true;
        return {
          ...entry,
          outputId: availableOutputIds[nextIndex++] ?? null,
        };
      });
      return changed ? next : prev;
    });
  }, [outputs]);

  useEffect(() => {
    const failedOutputIds = new Set(
      outputs.filter((item) => item.taskState === "fail").map((item) => item.id)
    );
    if (!failedOutputIds.size) return;

    setOptimisticDebitEntries((prev) => {
      const next = prev.filter((entry) => !(entry.outputId && failedOutputIds.has(entry.outputId)));
      return next.length === prev.length ? prev : next;
    });
  }, [outputs]);

  useEffect(() => {
    const settledOutputs = outputs.filter(
      (item) => item.taskState === "success" || item.taskState === "fail"
    );
    const settledSignatures = settledOutputs.map(
      (item) => `${item.id}:${item.taskState}:${item.taskId ?? ""}`
    );
    const nextSignatures = new Set(settledSignatures);
    const newlySettledOutputs = settledOutputs.filter(
      (item) =>
        !settledGenerationSignaturesRef.current.has(
          `${item.id}:${item.taskState}:${item.taskId ?? ""}`
        )
    );
    settledGenerationSignaturesRef.current = nextSignatures;
    if (!newlySettledOutputs.length) return;

    const successfulOutputIds = new Set(
      newlySettledOutputs.filter((item) => item.taskState === "success").map((item) => item.id)
    );
    void (async () => {
      const refreshedBalance = await refreshBalance({ silent: true, preferLedger: true });
      if (refreshedBalance == null || !successfulOutputIds.size) return;
      setOptimisticDebitEntries((prev) => {
        const next = prev.filter(
          (entry) => !(entry.outputId && successfulOutputIds.has(entry.outputId))
        );
        return next.length === prev.length ? prev : next;
      });
    })();
  }, [outputs, refreshBalance]);

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
      return base.filter((opt) => opt.value === "fal-ai/veo3.1/first-last-frame-to-video");
    }
    if (selectedTool === "video" && videoReferenceMode === "kling3") {
      return base.filter((opt) => opt.value === "fal-ai/kling-video/v3/pro/image-to-video");
    }
    return base;
  }, [mode, selectedTool, videoReferenceMode]);

  const promptForViewModel = useMemo(() => {
    if (selectedTool === "video" || selectedTool === "kling") {
      return videoReferenceText;
    }
    if (selectedTool === "image" || selectedTool === "edit") {
      return editReferenceText;
    }
    return prompt;
  }, [editReferenceText, prompt, selectedTool, videoReferenceText]);

  const {
    currentCostCredits,
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

  const isCreateWorkflowSelected = selectedTool === "create" || selectedTool === "text";
  const isEditWorkflowSelected = selectedTool === "edit" || selectedTool === "image";
  const isVideoWorkflowSelected = selectedTool === "video" || selectedTool === "kling";
  const hasModelSelected = Boolean(model);
  const hasPrimaryReferenceImage = Boolean(referenceImageUrl);
  const hasFirstLastFrameReferences = Boolean(referenceImageUrl && extraImageUrls[0]);
  const hasMotionReferences = Boolean(referenceImageUrl && motionReferenceVideoUrl);
  const hasEditPromptText = Boolean(editReferenceText.trim());
  const hasVideoPromptText = Boolean(videoReferenceText.trim());

  // Small prompt-reference Generate button policy (separate from large Generate button rules).
  const canShowCreatePromptReferenceGenerate = hasModelSelected && hasSufficientCreditsForCost;
  const canShowEditPromptReferenceGenerate =
    hasModelSelected &&
    hasSufficientCreditsForCost &&
    hasPrimaryReferenceImage &&
    !hasEditPromptText;
  const videoReferencesReadyForPromptGenerate =
    videoReferenceMode === "standard"
      ? hasPrimaryReferenceImage
      : videoReferenceMode === "keyframes"
        ? hasFirstLastFrameReferences
        : videoReferenceMode === "motion"
          ? hasMotionReferences
          : hasPrimaryReferenceImage;
  const canShowVideoPromptReferenceGenerate =
    hasModelSelected &&
    hasSufficientCreditsForCost &&
    !hasVideoPromptText &&
    videoReferencesReadyForPromptGenerate;
  const showReferencePromptGenerate = isCreateWorkflowSelected
    ? canShowCreatePromptReferenceGenerate
    : isEditWorkflowSelected
      ? canShowEditPromptReferenceGenerate
      : isVideoWorkflowSelected
        ? canShowVideoPromptReferenceGenerate
        : false;
  const disableReferencePromptGenerate = !showReferencePromptGenerate;

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
      const adjustedBalance = Math.max(0, resolvedBalance - optimisticDebitTotal);
      return adjustedBalance >= requiredCredits;
    },
    [balanceCredits, optimisticDebitTotal, refreshBalance]
  );

  const enqueueOptimisticDebit = useCallback((credits: number | null | undefined) => {
    if (credits == null || credits <= 0) return;
    setOptimisticDebitEntries((prev) => [
      ...prev,
      {
        credits,
        outputId: null,
      },
    ]);
  }, []);

  const handleGenerate = async (
    promptOverride?: string | null,
    options?: {
      modeOverride?: StudioMode;
      toolOverride?: ToolId | null;
      costOverrideCredits?: number | null;
    }
  ) => {
    if (!tryAcquireGenerateClickLock()) return;

    const effectiveMode = options?.modeOverride ?? mode;
    const effectiveTool = options?.toolOverride ?? selectedTool;
    const requiredCredits = options?.costOverrideCredits ?? currentCostCredits;

    if (
      options?.costOverrideCredits != null &&
      effectiveBalanceCredits != null &&
      effectiveBalanceCredits < options.costOverrideCredits
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

    const defaultPromptForTool = resolveDefaultPromptForTool(effectiveTool);
    const promptToUse = typeof promptOverride === "string" ? promptOverride : defaultPromptForTool;
    const characterModeBundleForSubmit =
      await refreshCharacterModeInjectionBundleForSubmission(effectiveTool);
    const characterModeOverrides = resolveCharacterModeSubmissionOverrides(
      promptToUse,
      effectiveTool,
      characterModeBundleForSubmit
    );
    trackCharacterModeFallback(characterModeOverrides, effectiveTool);
    enqueueOptimisticDebit(requiredCredits);
    generateOutput(promptToUse, {
      modeOverride: effectiveMode,
      selectedToolOverride: effectiveTool,
      submissionPromptOverride: characterModeOverrides?.submissionPromptOverride,
      displayPromptOverride: characterModeOverrides?.displayPromptOverride,
      referenceInputsOverride: characterModeOverrides?.referenceInputsOverride,
      ...(characterModeOverrides?.characterContextOverride
        ? { characterContextOverride: characterModeOverrides.characterContextOverride }
        : {}),
    });
    if (characterModeOverrides?.notice) {
      setUiNotice(characterModeOverrides.notice);
    }
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
    void handleGenerate();
  };

  const handleRegenerateWithDebit = async () => {
    if (!tryAcquireGenerateClickLock()) return;

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
    const promptToUse = resolveDefaultPromptForTool(selectedTool);
    const characterModeBundleForSubmit =
      await refreshCharacterModeInjectionBundleForSubmission(selectedTool);
    const characterModeOverrides = resolveCharacterModeSubmissionOverrides(
      promptToUse,
      selectedTool,
      characterModeBundleForSubmit
    );
    trackCharacterModeFallback(characterModeOverrides, selectedTool);
    enqueueOptimisticDebit(currentCostCredits);
    regenerateOutput({
      submissionPromptOverride: characterModeOverrides?.submissionPromptOverride,
      displayPromptOverride: characterModeOverrides?.displayPromptOverride,
      referenceInputsOverride: characterModeOverrides?.referenceInputsOverride,
      ...(characterModeOverrides?.characterContextOverride
        ? { characterContextOverride: characterModeOverrides.characterContextOverride }
        : {}),
    });
    if (characterModeOverrides?.notice) {
      setUiNotice(characterModeOverrides.notice);
    }
  };

  const handleImageRegenerateWithDebit = async () => {
    if (!tryAcquireGenerateClickLock()) return;

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
    const promptToUse = resolveDefaultPromptForTool(selectedTool);
    const characterModeBundleForSubmit =
      await refreshCharacterModeInjectionBundleForSubmission(selectedTool);
    const characterModeOverrides = resolveCharacterModeSubmissionOverrides(
      promptToUse,
      selectedTool,
      characterModeBundleForSubmit
    );
    trackCharacterModeFallback(characterModeOverrides, selectedTool);
    enqueueOptimisticDebit(currentCostCredits);
    regenerateOutput({
      submissionPromptOverride: characterModeOverrides?.submissionPromptOverride,
      displayPromptOverride: characterModeOverrides?.displayPromptOverride,
      referenceInputsOverride: characterModeOverrides?.referenceInputsOverride,
      ...(characterModeOverrides?.characterContextOverride
        ? { characterContextOverride: characterModeOverrides.characterContextOverride }
        : {}),
    });
    if (characterModeOverrides?.notice) {
      setUiNotice(characterModeOverrides.notice);
    }
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
    agentError: agentAttachmentError ?? agentError ?? undefined,
    agentPrimarySource,
    stagedPrompt: stagedAgentPrompt,
    stagedAttachments: agentAttachments,
    agentDropActive: isAgentDropActive,
    onAgentInputChange: handleAgentInputChange,
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
    isGenerateDisabled: isGenerateDisabled || agentBusy || isGenerateClickLocked,
    guardrailReason: generationGuardrail,
    onExpandChat: handleExpandChat,
    onClearAgentChat: handleClearAgentChat,
    shouldDisableSave: useReferenceImageIndicator && mode === "text",
    onGenerate: handlePrimarySubmit,
    onSavePrompt: savePromptReference,
    agentChatOpen: isAgentChatOpen,
    characterOptions,
    selectedCharacterId,
    onSelectedCharacterIdChange: setSelectedCharacterId,
    isCharacterOptionsLoading,
    characterModeEnabled: isCharacterModeEnabled,
    onCharacterModeEnabledChange: setIsCharacterModeEnabled,
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
  };

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
          aspect,
          modelId: model,
          modelLabel: currentModelLabel,
          referenceImageUrl,
          extraImageUrls,
          referenceText: editReferenceText,
          aspectOptions,
          isModelModalOpen,
          modelModalAnchor,
          onAspectChange: setAspect,
          onModelPickerOpen: handleOpenModelModal,
          onPrimaryImageChange: setReferenceImageUrl,
          onExtraImageChange: setExtraImageUrl,
          onPromptTextChange: handleEditPromptTextChange,
          onSave: () => savePromptReference(editReferenceText ?? ""),
          onRegenerate: handleImageRegenerateWithDebit,
          costCredits: currentCostCredits,
          isGenerateDisabled: isGenerateDisabled || agentBusy || isGenerateClickLocked,
          referenceImageWarning,
          resolvePreviewUrlById: (id) => resolvePreviewUrlById(outputs, id), // Wrap to match expected Type
          agentIsSending: isReferencePromptEnhancing,
          onAgentEnhanceSend: handleReferencePromptEnhance,
          imageResolution,
          onImageResolutionChange: setImageResolution,
          beginnerMode,
        }}
        propertiesVideo={{
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
          referenceText: videoReferenceText,
          aspectOptions,
          isModelModalOpen,
          modelModalAnchor,
          onAspectChange: setAspect,
          onModelPickerOpen: handleOpenModelModal,
          onPrimaryImageChange: setReferenceImageUrl,
          onExtraImageChange: setExtraImageUrl,
          onPromptTextChange: handleVideoPromptTextChange,
          onSave: () => savePromptReference(videoReferenceText ?? ""),
          onRegenerate: handleRegenerateWithDebit,
          costCredits: currentCostCredits,
          referenceImageWarning,
          resolvePreviewUrlById: (id) => resolvePreviewUrlById(outputs, id), // Wrap to match expected Type
          isGenerateDisabled: isGenerateDisabled || agentBusy || isGenerateClickLocked,
          agentIsSending: agentBusy,
          agentError: agentAttachmentError ?? agentError ?? undefined,
          onAgentEnhanceSend: handleReferencePromptEnhance,
          beginnerMode,
        }}
        isTemplateView={isTemplateView}
        referenceCanvasProps={{
          outputs,
          activeOutputId,
          showHeader: false,
          onOutputMediaLoaded: onReferenceOutputMediaLoaded,
          linkedPromptReferenceIds,
          showPromptGenerate: showReferencePromptGenerate,
          disablePromptGenerate: disableReferencePromptGenerate,
          onSelectOutput: handleSelectOutput,
          onOpenDetails: setDetailOutputId,
          onDescribeImage: (output) => handleDescribeReference(output.id),
          onSaveToLibrary: (output) => handleSaveReference(output.id),
          onDownload: (output) => handleDownloadReference(output.id),
          onGeneratePrompt: (output) => handleGenerateFromPromptReference(output.id),
          onRetryStatus: (output) => retryOutputStatus(output.id),
          onDeleteOutput: deleteOutput,
          generateCostCredits: currentCostCredits,
          selectedTool,
        }}
        studioPreviewProps={{
          activeOutput,
          referenceImageUrl,
          referenceText:
            selectedTool === "video" || selectedTool === "kling"
              ? videoReferenceText
              : editReferenceText,
          onReferenceImageChange: setReferenceImageUrl,
          onReferenceTextChange: handleManualPromptChange,
          onRegenerate: handleRegenerateWithDebit,
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
