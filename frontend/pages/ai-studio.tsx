/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { useActiveModelPricingPolicy } from "../features/ai-studio/hooks/useActiveModelPricingPolicy";
import { useAiStudioEditSubmitIntent } from "../features/ai-studio/hooks/useAiStudioEditSubmitIntent";
import { MediaLibraryModal } from "../features/ai-studio/components/MediaLibraryModal";
import { ProjectsModal } from "../features/ai-studio/components/ProjectsModal";
import { useEffectiveBeginnerModePreference } from "../features/ai-studio/hooks/useEffectiveBeginnerModePreference";
import { useMediaAutosavePreference } from "../features/ai-studio/hooks/useMediaAutosavePreference";
import { useExpertEditPresetPanelPreference } from "../features/ai-studio/hooks/useExpertEditPresetPanelPreference";
import { useCreatePulsePresetPanelPreference } from "../features/ai-studio/hooks/useCreatePulsePresetPanelPreference";
import {
  isCreatePulseBuiltInPresetId,
  resolveCreatePulsePresetById,
  type CreatePulseResolvedPreset,
} from "../features/ai-studio/components/create/createPulsePresets";
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
import {
  resolveSavedMediaIdFromOutput,
  useAiStudioInternalDropResolvers,
} from "../features/ai-studio/hooks/useAiStudioInternalDropResolvers";
import { mapHookContractsToPageContentProps } from "../features/ai-studio/hooks/contracts/pageContentAdapter";
import { useAiStudioProjectIdentity } from "../features/ai-studio/hooks/useAiStudioProjectIdentity";
import { useAiStudioSessionIdentity } from "../features/ai-studio/hooks/useAiStudioSessionIdentity";
import { useAiStudioPageSessionPersistence } from "../features/ai-studio/hooks/useAiStudioPageSessionPersistence";
import { useAiStudioPageOutputAdapters } from "../features/ai-studio/hooks/useAiStudioPageOutputAdapters";
import { useAiStudioPageUiNotices } from "../features/ai-studio/hooks/useAiStudioPageUiNotices";
import { useAiStudioPageCreditDerivations } from "../features/ai-studio/hooks/useAiStudioPageCreditDerivations";
import { useAiStudioPerfAuditRuntime } from "../features/ai-studio/hooks/useAiStudioPerfAuditRuntime";
import { useAiStudioDualCanvasWorkspaceState } from "../features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState";
import { useAiStudioCreateModeRuntime } from "../features/ai-studio/hooks/useAiStudioCreateModeRuntime";
import { loadCharacterManagerDraftByCharacterId } from "../features/character-manager/logic/characterManagerPersistence";
import type {
  CanvasDropResolution,
  PrepareCanvasMediaLibraryDrop,
  ResolveCanvasDropReference,
} from "../features/ai-studio/components/canvas/canvasTypes";
import {
  CANVAS_AUDIO_ITEM_HEIGHT,
  CANVAS_AUDIO_ITEM_WIDTH,
} from "../features/ai-studio/components/canvas/canvasGeometry";
import {
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotWorkspace,
} from "../features/ai-studio/logic/sessionSnapshot";
import {
  buildCharacterModeLookOptions,
  type CharacterModeLookOption,
} from "../features/ai-studio/logic/characterModeLookSelection";
import {
  arePulseWorkflowSessionsEqual,
  derivePulseWorkflowSession,
  reconcilePulseWorkflowSession,
} from "../features/ai-studio/logic/pulseWorkflowSession";
import { AiStudioModalActivityProvider } from "../features/ai-studio/components/modal-layer/AiStudioModalLayer";
import { isEditWorkflow } from "../features/ai-studio/logic/workflowIdentity";
import type { AgentContext } from "../prefabs/agent";
import type { MusicGenerateRequest } from "../features/ai-studio/components/MusicPropertiesPanel";
import type { SoundEffectsGenerateRequest } from "../features/ai-studio/components/SoundEffectsPropertiesPanel";
import type { VoicesGenerateRequest } from "../features/ai-studio/components/VoicesPropertiesPanel";
import type { StudioOutput, ToolId } from "../features/ai-studio/types";
import { fetchWithAuth } from "../lib/authenticatedFetch";
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
type OptimisticDebitEntry = { credits: number; outputId: string | null; createdAtMs?: number };

type VoicesGenerateSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: number[] | null;
    modelId: string;
    voiceId: string;
    voiceName: string;
  };
  remuxedVideo?: {
    provider: "elevenlabs";
    mode: "video";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: "video/mp4" | "video/webm";
    modelId: string;
  };
};

type SoundEffectsGenerateSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: number[] | null;
    modelId: string;
    characterCost: number | null;
  };
};

type MusicGenerateSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: number[] | null;
    modelId: string;
  };
};

type AudioGenerateErrorResponse = {
  error?: string;
  details?: string;
};

const normalizeAiStudioProjectName = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 120) : null;
};

const AiStudioProjectEntryState = ({
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) => (
  <main>
    <h1>{title}</h1>
    <p>{message}</p>
    {actionLabel && onAction ? (
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
    {secondaryActionLabel && onSecondaryAction ? (
      <button type="button" onClick={onSecondaryAction}>
        {secondaryActionLabel}
      </button>
    ) : null}
  </main>
);

const buildVoicesOutputPrompt = (request: VoicesGenerateRequest): string =>
  request.mode === "voiceover"
    ? request.script
    : `${request.source.extractedFrom?.name ?? request.source.name} -> ${request.voice.name}`;

const buildVoicesOutputModelLabel = (request: VoicesGenerateRequest): string =>
  request.mode === "voiceover" ? "ElevenLabs Voiceover" : "ElevenLabs Voice Changer";

const buildMusicOutputModelLabel = (): string => "ElevenLabs Music";
const buildSoundEffectsOutputModelLabel = (): string => "ElevenLabs Sound Effects";

const resolveAudioGenerateErrorMessage = (payload: AudioGenerateErrorResponse | null): string =>
  payload?.error?.trim() || payload?.details?.trim() || "Audio generation failed.";

const toSavedMediaIds = (mediaFileId: string | null | undefined): string[] =>
  typeof mediaFileId === "string" && mediaFileId.trim().length > 0 ? [mediaFileId] : [];

const buildVoiceChangerRemuxedVideoOutput = ({
  request,
  payload,
}: {
  request: Extract<VoicesGenerateRequest, { mode: "voice-changer" }>;
  payload: NonNullable<VoicesGenerateSuccessResponse["remuxedVideo"]>;
}): StudioOutput => {
  const savedMediaIds = toSavedMediaIds(payload.mediaFileId);
  const sourceLabel = request.source.extractedFrom?.name ?? request.source.name;
  return {
    id: `generated:${payload.generationId}`,
    prompt: `${sourceLabel} -> ${request.voice.name} video`,
    mode: "video",
    aspect: request.source.extractedFrom?.aspect ?? "1:1",
    model: buildVoicesOutputModelLabel(request),
    modelId: payload.modelId,
    provider: payload.provider,
    generationId: payload.generationId,
    savedMediaIds,
    sourceRef: payload.requestId,
    status: "ready",
    timestamp: "Just now",
    taskState: "success",
    resultUrls: payload.resultUrls,
    previewUrl: payload.previewUrl,
    previewStoragePath: payload.previewStoragePath,
    fullStoragePath: payload.fullStoragePath,
    previewTier: "preview_loop",
    mimeType: payload.mimeType,
    mediaSource: "generated",
    localObjectUrl: null,
    saveState: savedMediaIds.length > 0 ? "saved" : "idle",
    saveError: null,
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
  };
};

export default function AiStudioPage() {
  const router = useRouter();
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
  const {
    presetPanelIds: selectedCreatePulsePresetIds,
    savedPresets: savedCreatePulsePresets,
    setPresetPanelIds: setSelectedCreatePulsePresetIds,
    setSavedPresets: setSavedCreatePulsePresets,
  } = useCreatePulsePresetPanelPreference();
  const { balanceCents, balanceReservedCents, balanceLoading, refreshBalance } = useCredits();
  const { modelPricingPolicy } = useActiveModelPricingPolicy({
    enabled: true,
  });
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [musicIsGenerating, setMusicIsGenerating] = useState(false);
  const [voicesIsGenerating, setVoicesIsGenerating] = useState(false);
  const [soundEffectsIsGenerating, setSoundEffectsIsGenerating] = useState(false);
  const [isCreateCharacterBundleLoading, setIsCreateCharacterBundleLoading] = useState(false);
  const [isEditCharacterBundleLoading, setIsEditCharacterBundleLoading] = useState(false);
  const [isCreateCharacterModeEnabled, setIsCreateCharacterModeEnabled] = useState(false);
  const [isEditCharacterModeEnabled, setIsEditCharacterModeEnabled] = useState(false);
  const [characterCreateRequestKey, setCharacterCreateRequestKey] = useState(0);
  const [elementCreateRequestKey, setElementCreateRequestKey] = useState(0);
  const [editSelectedCharacterId, setEditSelectedCharacterId] = useState("");
  const [createSelectedCharacterLookId, setCreateSelectedCharacterLookId] = useState("");
  const [createCharacterLookOptionsByCharacterId, setCreateCharacterLookOptionsByCharacterId] =
    useState<Record<string, CharacterModeLookOption[]>>({});
  const [selectedStylePrompt, setSelectedStylePrompt] = useState<string | null>(null);
  const [selectedStyleContext, setSelectedStyleContext] = useState<
    StudioOutput["styleContext"] | null
  >(null);
  const [sessionTitleOverrideState, setSessionTitleOverrideState] = useState<{
    sessionId: string;
    title: string | null;
  } | null>(null);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [createCharacterModeInjectionBundle, setCreateCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const [editCharacterModeInjectionBundle, setEditCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const localSessionTitleOverride =
    sessionTitleOverrideState?.sessionId === sessionId ? sessionTitleOverrideState.title : null;
  const {
    projectId,
    projectRouteRequested,
    project,
    status: projectStatus,
    error: projectError,
    refreshProject,
    updateProjectTitle,
  } = useAiStudioProjectIdentity();
  const shouldGateSessionPersistence = Boolean(projectId) && projectStatus !== "ready";
  const activeSessionPersistenceSessionId = shouldGateSessionPersistence ? null : sessionId;
  const sessionPersistenceTitleOverride = project?.title ?? localSessionTitleOverride;

  const {
    expertCreateMode,
    activeCreatePulsePresetId,
    pulseSessionInstanceId,
    pulseWorkflowSession,
    setExpertCreateMode,
    setActiveCreatePulsePresetId,
    setPulseSessionInstanceId,
    setPulseWorkflowSession,
    clearPulseRuntime,
    restartPulse,
    deactivatePulse,
    handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange,
  } = useAiStudioCreateModeRuntime({
    projectId,
    selectedCreatePulsePresetIds,
    savedCreatePulsePresets,
  });

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
    updateOutputById,
    notifyGenerationFailure,
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
    projectId,
    projectRouteRequested,
    sessionId,
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
    selectedStylePrompt,
    selectedStyleContext,
    expertCreateMode,
    activePulsePresetId: activeCreatePulsePresetId,
    pulseSessionInstanceId,
    pulseWorkflowSession,
    setExpertCreateMode,
    setActivePulsePresetId: setActiveCreatePulsePresetId,
    setPulseSessionInstanceId,
  });

  const hasActivePulseSession =
    selectedTool === "create" &&
    expertCreateMode === "pulse" &&
    Boolean(activeCreatePulsePresetId) &&
    Boolean(pulseSessionInstanceId);

  const getPulseAwareAgentContext = useCallback(
    (params: {
      lastAssistantMessage: string | null;
      selectedOverride?: StudioOutput | null;
      modeHint?: "chat" | "text" | "describe" | "reference";
    }): AgentContext => {
      const baseContext = getAgentContext(params);
      if (!hasActivePulseSession || !activeCreatePulsePresetId) {
        return baseContext;
      }
      const resolvedPulsePreset = resolveCreatePulsePresetById(
        activeCreatePulsePresetId,
        savedCreatePulsePresets
      );
      const instructions = resolvedPulsePreset?.systemInstructions?.trim() ?? "";
      if (!resolvedPulsePreset || !instructions) return baseContext;
      return {
        ...baseContext,
        pulse: {
          presetId: activeCreatePulsePresetId,
          label: resolvedPulsePreset.label,
          description: resolvedPulsePreset.description,
          instructions,
          runtimeMode: resolvedPulsePreset.runtimeMode,
          activationMode: resolvedPulsePreset.activationMode,
          starterAssistantMessage: resolvedPulsePreset.starterAssistantMessage,
          workflowStageHints: resolvedPulsePreset.workflowStageHints,
          outputMode: resolvedPulsePreset.outputMode,
          memoryPolicy: resolvedPulsePreset.memoryPolicy,
          source: isCreatePulseBuiltInPresetId(activeCreatePulsePresetId)
            ? ("builtin" as const)
            : ("custom" as const),
          workflowSession: pulseWorkflowSession,
        },
      };
    },
    [
      activeCreatePulsePresetId,
      expertCreateMode,
      getAgentContext,
      hasActivePulseSession,
      pulseWorkflowSession,
      savedCreatePulsePresets,
      selectedTool,
    ]
  );

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
  const handleOpenCharacterLibrary = useCallback(() => {
    setSelectedToolWithEditIntentReset("character");
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
  });
  const resolveCanvasDropReference = useCallback<ResolveCanvasDropReference>(
    (payload) => {
      const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
      const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
      const output = outputId ? getOutputById(outputId) : null;
      if (!output) return null;
      if (output.mode === "text") {
        const text = (output.prompt || output.previewText || "").trim();
        if (!text) return null;
        return {
          kind: "text",
          outputId: outputId || null,
          text,
          sourceSurface: payload.sourceSurface ?? null,
        };
      }
      if (output.mode === "audio") {
        const audioUrl =
          output.resultUrls?.[0] ?? output.previewUrl ?? payload.referenceUrl ?? null;
        if (!audioUrl) return null;
        return {
          kind: "audio",
          outputId: outputId || null,
          mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
          audioUrl,
          title: (output.prompt || output.previewText || "Canvas audio").trim() || null,
          durationMs: output.durationMs ?? null,
          waveformPeaks: output.waveformPeaks ?? null,
          width: CANVAS_AUDIO_ITEM_WIDTH,
          height: CANVAS_AUDIO_ITEM_HEIGHT,
          sourceSurface: payload.sourceSurface ?? null,
        };
      }
      if (output.mode !== "image") return null;
      const sourceUrl =
        output.resultUrls?.[imageIndex] ?? output.previewUrl ?? payload.referenceUrl ?? null;
      if (!sourceUrl) return null;
      return {
        kind: "image",
        outputId: outputId || null,
        mediaId: resolveSavedMediaIdFromOutput(output, imageIndex),
        src: sourceUrl,
        alt: (output.prompt || output.previewText || "Canvas reference").trim(),
        sourceSurface: payload.sourceSurface ?? null,
      };
    },
    [getOutputById]
  );
  const prepareCanvasMediaLibraryDrop = useCallback<PrepareCanvasMediaLibraryDrop>(
    async (payload): Promise<CanvasDropResolution | null> => {
      if (payload.kind === "libraryMedia") {
        const outputId = await addLibraryMediaReferenceToQuickSlot(payload.payload);
        if (!outputId) return null;
        const previewSrc =
          (payload.payload.fullUrl ?? "").trim() ||
          (payload.payload.previewUrl ?? "").trim() ||
          (payload.payload.url ?? "").trim();
        if (!previewSrc) return null;
        if (payload.payload.fileType === "audio") {
          return {
            kind: "audio",
            outputId,
            mediaId: payload.payload.id,
            audioUrl: previewSrc,
            title:
              (payload.payload.filename || payload.payload.promptText || "Canvas audio").trim() ||
              null,
            width: CANVAS_AUDIO_ITEM_WIDTH,
            height: CANVAS_AUDIO_ITEM_HEIGHT,
          };
        }
        const width =
          typeof payload.payload.width === "number" &&
          Number.isFinite(payload.payload.width) &&
          payload.payload.width > 0
            ? payload.payload.width
            : undefined;
        const height =
          typeof payload.payload.height === "number" &&
          Number.isFinite(payload.payload.height) &&
          payload.payload.height > 0
            ? payload.payload.height
            : undefined;
        return {
          kind: "image",
          outputId,
          mediaId: payload.payload.id,
          src: previewSrc,
          alt: (payload.payload.filename || payload.payload.promptText || "Canvas media").trim(),
          width,
          height,
        };
      }

      const promptText = payload.payload.promptText.trim();
      if (!promptText) return null;
      const outputId = addLibraryPromptReferenceToQuickSlot(payload.payload);
      if (!outputId) return null;
      return {
        kind: "text",
        outputId,
        text: promptText,
      };
    },
    [addLibraryMediaReferenceToQuickSlot, addLibraryPromptReferenceToQuickSlot]
  );
  const {
    railCanvasProps,
    sessionState: canvasSessionState,
    hydrateSessionState: hydrateCanvasSessionState,
  } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference,
    prepareCanvasMediaLibraryDrop,
    onPinTextReference: addPastedPromptReference,
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
    projectId,
    projectRouteRequested,
    selectedTool,
    selectedCharacterLookId: createSelectedCharacterLookId,
    setUiError,
    setCharacterModeInjectionBundle: setCreateCharacterModeInjectionBundle,
    setIsCharacterBundleLoading: setIsCreateCharacterBundleLoading,
  });
  const loadCreateCharacterLookOptions = useCallback(async (characterId: string) => {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId) return [];
    const snapshot = await loadCharacterManagerDraftByCharacterId(normalizedCharacterId);
    const nextOptions = buildCharacterModeLookOptions(snapshot);
    setCreateCharacterLookOptionsByCharacterId((current) => {
      const existingOptions = current[normalizedCharacterId] ?? null;
      const isUnchanged =
        existingOptions != null &&
        existingOptions.length === nextOptions.length &&
        existingOptions.every(
          (option, index) =>
            option.id === nextOptions[index]?.id &&
            option.label === nextOptions[index]?.label &&
            option.isDefault === nextOptions[index]?.isDefault
        );
      if (isUnchanged) return current;
      return {
        ...current,
        [normalizedCharacterId]: nextOptions,
      };
    });
    return nextOptions;
  }, []);
  const resolveCreateCharacterLookLabelById = useCallback(
    (characterId: string | null | undefined, lookId: string | null | undefined): string | null => {
      const normalizedCharacterId = characterId?.trim() ?? "";
      const normalizedLookId = lookId?.trim() ?? "";
      if (!normalizedCharacterId || !normalizedLookId) return null;
      const lookOptions = createCharacterLookOptionsByCharacterId[normalizedCharacterId] ?? [];
      return lookOptions.find((option) => option.id === normalizedLookId)?.label ?? null;
    },
    [createCharacterLookOptionsByCharacterId]
  );
  const handleCreateCharacterSelection = useCallback(
    (characterId: string, lookId: string) => {
      setCreateSelectedCharacterId(characterId);
      setCreateSelectedCharacterLookId(lookId);
    },
    [setCreateSelectedCharacterId]
  );
  useEffect(() => {
    const normalizedCharacterId = createSelectedCharacterId.trim();
    if (!normalizedCharacterId) {
      setCreateSelectedCharacterLookId("");
      return;
    }
    if (createCharacterLookOptionsByCharacterId[normalizedCharacterId]) return;
    void loadCreateCharacterLookOptions(normalizedCharacterId).catch(() => {
      // Best-effort cache warm-up so selected look labels survive reload/restore.
    });
  }, [
    createCharacterLookOptionsByCharacterId,
    createSelectedCharacterId,
    loadCreateCharacterLookOptions,
  ]);
  useEffect(() => {
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedLookId = createSelectedCharacterLookId.trim();
    if (!normalizedCharacterId || !normalizedLookId) return;
    const lookOptions = createCharacterLookOptionsByCharacterId[normalizedCharacterId] ?? [];
    if (lookOptions.length === 0) return;
    if (lookOptions.some((option) => option.id === normalizedLookId)) return;
    const fallbackLookId =
      lookOptions.find((option) => option.isDefault)?.id ?? lookOptions[0]?.id ?? "";
    if (!fallbackLookId) return;
    setCreateSelectedCharacterLookId(fallbackLookId);
  }, [
    createCharacterLookOptionsByCharacterId,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
  ]);
  const selectedCreateCharacterLookLabel = useMemo(() => {
    if (createCharacterModeInjectionBundle?.characterId === createSelectedCharacterId) {
      const bundleLookName = createCharacterModeInjectionBundle.characterLookName?.trim() ?? "";
      if (bundleLookName) return bundleLookName;
    }
    return (
      resolveCreateCharacterLookLabelById(
        createSelectedCharacterId,
        createSelectedCharacterLookId
      ) ?? null
    );
  }, [
    createCharacterModeInjectionBundle?.characterId,
    createCharacterModeInjectionBundle?.characterLookName,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    resolveCreateCharacterLookLabelById,
  ]);
  const resolveIsCharacterModeEnabledForTool = useCallback(
    (tool: ToolId | null): boolean => {
      if (tool === "create" || tool === "text") return isCreateCharacterModeEnabled;
      if (tool === "edit" || tool === "image") return isEditCharacterModeEnabled;
      return false;
    },
    [isCreateCharacterModeEnabled, isEditCharacterModeEnabled]
  );
  const resolveSelectedCharacterIdForTool = useCallback(
    (tool: ToolId | null): string | null => {
      if (tool === "create" || tool === "text") {
        return createSelectedCharacterId?.trim() || null;
      }
      if (tool === "edit" || tool === "image") {
        return editSelectedCharacterId?.trim() || null;
      }
      return null;
    },
    [createSelectedCharacterId, editSelectedCharacterId]
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
    selectedCharacterLookId: createSelectedCharacterLookId,
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
    agentBootstrapReady,
    agentMessages,
    agentError,
    agentBusy,
    agentInput,
    directOpenAiBypassEnabled,
    chatModeEnabled,
    setChatModeEnabled,
    agentAttachmentError,
    agentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    agentActions,
    isAgentChatOpen,
    latestAgentPrompt,
    promptOrigin,
    persistedAgentRuntimes,
    setPromptOrigin,
    agentPrimarySource,
    stagedAgentPrompt,
    isPromptRefining,
    describeInFlightCount,
    handleAgentInputChange,
    handleAgentSend,
    handlePulsePresetStart,
    handleAgentEnhanceSend,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
    handleAssistantMessageEdit,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
    resetProjectAgentConversation,
    hydrateFromSessionAgentSnapshot,
  } = useAiStudioAgentBridge({
    projectId,
    projectRouteRequested,
    sessionId,
    mode,
    selectedTool,
    expertCreateMode,
    activePulsePresetId: activeCreatePulsePresetId,
    pulseSessionInstanceId,
    pulseWorkflowSession,
    prompt,
    setSharedPrompt,
    getAgentContext: getPulseAwareAgentContext,
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
    setPulseWorkflowSession,
    clearPulseRuntime,
    trackAgentUiEvent: trackUiEvent,
  });

  const handleCreatePulsePresetStart = useCallback(
    (
      preset: CreatePulseResolvedPreset,
      options?: {
        pulseSessionInstanceId?: string | null;
      }
    ) =>
      handlePulsePresetStart(preset, {
        pulseSessionInstanceId: options?.pulseSessionInstanceId ?? null,
      }),
    [handlePulsePresetStart]
  );

  const handleCreatePulsePresetRestart = useCallback(
    async (preset: CreatePulseResolvedPreset) => {
      const restartedPulse = restartPulse();
      if (!restartedPulse || restartedPulse.presetId !== preset.presetId) {
        return;
      }
      const result = await handlePulsePresetStart(preset, {
        pulseSessionInstanceId: restartedPulse.sessionInstanceId,
      });
      if (result !== "started") {
        deactivatePulse();
      }
    },
    [deactivatePulse, handlePulsePresetStart, restartPulse]
  );

  const activeWorkflowPulsePreset = useMemo(() => {
    if (!hasActivePulseSession || !activeCreatePulsePresetId) {
      return null;
    }
    const resolvedPreset = resolveCreatePulsePresetById(
      activeCreatePulsePresetId,
      savedCreatePulsePresets
    );
    if (!resolvedPreset || resolvedPreset.runtimeMode !== "workflow_gpt") return null;
    return resolvedPreset;
  }, [activeCreatePulsePresetId, hasActivePulseSession, savedCreatePulsePresets]);

  const derivedPulseWorkflowSession = useMemo(
    () =>
      derivePulseWorkflowSession({
        preset: activeWorkflowPulsePreset
          ? {
              presetId: activeWorkflowPulsePreset.presetId,
              runtimeMode: activeWorkflowPulsePreset.runtimeMode,
              starterAssistantMessage: activeWorkflowPulsePreset.starterAssistantMessage,
              workflowStageHints: activeWorkflowPulsePreset.workflowStageHints,
            }
          : null,
        agentMessages,
        isSending: agentBusy,
      }),
    [activeWorkflowPulsePreset, agentBusy, agentMessages]
  );

  const reconciledPulseWorkflowSession = useMemo(
    () =>
      reconcilePulseWorkflowSession({
        authoritative: pulseWorkflowSession,
        derived: derivedPulseWorkflowSession,
        isSending: agentBusy,
      }),
    [agentBusy, derivedPulseWorkflowSession, pulseWorkflowSession]
  );

  useEffect(() => {
    if (!hasActivePulseSession) {
      setPulseWorkflowSession(null);
      return;
    }
    setPulseWorkflowSession((current) =>
      arePulseWorkflowSessionsEqual(current, reconciledPulseWorkflowSession)
        ? current
        : reconciledPulseWorkflowSession
    );
  }, [hasActivePulseSession, reconciledPulseWorkflowSession, setPulseWorkflowSession]);

  const buildProjectAwareSessionSnapshot = useCallback(
    (args: Parameters<typeof buildSessionSnapshot>[0]) =>
      patchAiStudioSessionSnapshotCanvas(
        patchAiStudioSessionSnapshotWorkspace(buildSessionSnapshot(args), {
          selectedCharacterId: createSelectedCharacterId || null,
          selectedCharacterLookId: createSelectedCharacterLookId || null,
        }),
        canvasSessionState
      ),
    [
      buildSessionSnapshot,
      canvasSessionState,
      createSelectedCharacterId,
      createSelectedCharacterLookId,
    ]
  );

  const hydrateProjectAwareSessionSnapshot = useCallback(
    (snapshot: Parameters<typeof hydrateFromSessionSnapshot>[0]) => {
      const payload = hydrateFromSessionSnapshot(snapshot);
      setCreateSelectedCharacterId(payload.workspace.selectedCharacterId ?? "");
      setCreateSelectedCharacterLookId(payload.workspace.selectedCharacterLookId ?? "");
      return payload;
    },
    [hydrateFromSessionSnapshot, setCreateSelectedCharacterId, setCreateSelectedCharacterLookId]
  );

  const applyEmptyProjectState = useCallback(() => {
    const payload = hydrateProjectAwareSessionSnapshot(createEmptyAiStudioSessionSnapshot());
    resetProjectAgentConversation();
    setExpertEditSessionState(payload.expertEdit);
    hydrateCanvasSessionState(payload.canvas);
  }, [
    hydrateCanvasSessionState,
    hydrateProjectAwareSessionSnapshot,
    resetProjectAgentConversation,
    setExpertEditSessionState,
  ]);

  const { projectBootstrapApplied, projectBootstrapError, retryProjectBootstrap } =
    useAiStudioPageSessionPersistence({
      projectId,
      projectRouteRequested,
      sessionId: activeSessionPersistenceSessionId,
      sessionTitleOverride: sessionPersistenceTitleOverride,
      buildSessionSnapshot: buildProjectAwareSessionSnapshot,
      agentMessages,
      agentInput,
      latestAgentPrompt,
      promptOrigin,
      chatModeEnabled,
      pulseWorkflowSession,
      agentRuntimes: {
        ...persistedAgentRuntimes,
        pulsePresetId: hasActivePulseSession ? activeCreatePulsePresetId : null,
        pulse: {
          ...persistedAgentRuntimes.pulse,
          pulseWorkflowSession: hasActivePulseSession ? (pulseWorkflowSession ?? null) : null,
        },
      },
      expertEditSessionState,
      hydrateFromSessionSnapshot: hydrateProjectAwareSessionSnapshot,
      hydrateFromSessionAgentSnapshot,
      hydrateFromSessionCanvasSnapshot: hydrateCanvasSessionState,
      hydrateFromSessionExpertEditSnapshot: setExpertEditSessionState,
      applyEmptyProjectState,
      resetProjectAgentConversation,
      setUiNotice,
    });

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
    [projectId, sessionId, setUiError, updateProjectTitle]
  );
  const handleOpenProjectsModal = useCallback(() => {
    setIsProjectsModalOpen(true);
  }, []);
  const handleCloseProjectsModal = useCallback(() => {
    setIsProjectsModalOpen(false);
  }, []);
  const handleSelectProjectFromModal = useCallback(
    async (nextProjectId: string) => {
      if (nextProjectId === projectId) return;
      const didNavigate = await router.push({
        pathname: "/ai-studio",
        query: { projectId: nextProjectId },
      });
      if (!didNavigate) {
        throw new Error("Failed to open project.");
      }
    },
    [projectId, router]
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
    klingElements,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    balanceCredits: effectiveBalanceCredits,
    editSubmitIntent,
    costParamsForModel,
    pricingPolicy: modelPricingPolicy,
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
    projectId,
    isCharacterModeEnabled: resolveIsCharacterModeEnabledForTool(selectedTool),
    resolveIsCharacterModeEnabledForTool,
    resolveSelectedCharacterIdForTool,
    prompt,
    selectedStyleContext,
    agentInput,
    chatModeEnabled,
    usesAgentLane: expertCreateMode === "pulse" || chatModeEnabled,
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
    projectId,
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
    agentBootstrapReady,
    agentMessages,
    agentActions,
    pulseWorkflowSession,
    hasActivePulseSession,
    agentInput,
    chatModeEnabled,
    directOpenAiBypassEnabled,
    agentBusy,
    agentAttachmentError,
    agentError,
    agentPrimarySource,
    stagedAgentPrompt,
    agentAttachments,
    isAgentDropActive,
    handleAgentInputChange,
    setChatModeEnabled,
    handleAgentSend,
    onCreatePulsePresetStart: handleCreatePulsePresetStart,
    onCreatePulsePresetRestart: handleCreatePulsePresetRestart,
    handleAgentEnhanceSend,
    handleAgentAttachmentDrop,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
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
    setSelectedCharacterId: handleCreateCharacterSelection,
    selectedCharacterLookId: createSelectedCharacterLookId,
    selectedCharacterLookLabel: selectedCreateCharacterLookLabel,
    onOpenCharacterLibrary: handleOpenCharacterLibrary,
    loadCharacterLookOptions: loadCreateCharacterLookOptions,
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
    selectedCreatePulsePresetIds,
    onSelectedCreatePulsePresetIdsChange: setSelectedCreatePulsePresetIds,
    savedCreatePulsePresets,
    onSavedCreatePulsePresetsChange: setSavedCreatePulsePresets,
    expertCreateMode,
    onExpertCreateModeChange: handleExpertCreateModeChange,
    activeCreatePulsePresetId,
    onActiveCreatePulsePresetIdChange: handleActiveCreatePulsePresetIdChange,
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

  const handleVoicesGenerate = useCallback(
    async (request: VoicesGenerateRequest) => {
      const promptText = buildVoicesOutputPrompt(request).trim();
      if (!promptText) return;

      setUiError(null);
      setVoicesIsGenerating(true);

      const optimisticOutputId = insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "audio",
        selectedToolOverride: request.mode === "voiceover" ? "text-to-speech" : "voice-changer",
        modelLabelOverride: buildVoicesOutputModelLabel(request),
        modelIdOverride: request.mode === "voiceover" ? request.config.model_id : request.modelId,
        providerOverride: "elevenlabs",
      });

      if (!optimisticOutputId) {
        setVoicesIsGenerating(false);
        return;
      }

      try {
        const response =
          request.mode === "voiceover"
            ? await fetchWithAuth("/api/elevenlabs/text-to-speech", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  voiceId: request.voice.id,
                  voiceName: request.voice.name,
                  text: request.script,
                  outputFormat: request.outputFormat,
                  config: request.config,
                }),
                shortpulseLogScope: "generation",
              })
            : await (async () => {
                const formData = new FormData();
                formData.append("voiceId", request.voice.id);
                formData.append("voiceName", request.voice.name);
                formData.append("outputFormat", request.outputFormat);
                formData.append("modelId", request.modelId);
                formData.append("inputFormat", request.inputFormat);
                formData.append(
                  "removeBackgroundNoise",
                  request.removeBackgroundNoise ? "true" : "false"
                );
                formData.append("voiceSettings", JSON.stringify(request.voiceSettings));
                formData.append(
                  "sourceName",
                  request.source.extractedFrom?.name ?? request.source.name
                );
                formData.append("sourceOrigin", request.source.origin);
                if (request.source.storagePath) {
                  formData.append("sourceStoragePath", request.source.storagePath);
                } else if (request.source.file) {
                  formData.append("file", request.source.file, request.source.file.name);
                } else if (request.source.sourceUrl) {
                  formData.append("sourceUrl", request.source.sourceUrl);
                }
                if (request.source.extractedFrom?.storagePath) {
                  formData.append(
                    "originalVideoStoragePath",
                    request.source.extractedFrom.storagePath
                  );
                } else if (request.source.extractedFrom?.sourceUrl) {
                  formData.append("originalVideoSourceUrl", request.source.extractedFrom.sourceUrl);
                }
                if (request.source.extractedFrom?.name) {
                  formData.append("originalVideoName", request.source.extractedFrom.name);
                }
                if (request.source.extractedFrom?.mimeType) {
                  formData.append("originalVideoMimeType", request.source.extractedFrom.mimeType);
                }
                if (request.source.extractedFrom?.aspect) {
                  formData.append("originalVideoAspect", request.source.extractedFrom.aspect);
                }
                return await fetchWithAuth("/api/elevenlabs/speech-to-speech", {
                  method: "POST",
                  body: formData,
                  shortpulseLogScope: "generation",
                });
              })();

        const payload = (await response.json().catch(() => null)) as
          | VoicesGenerateSuccessResponse
          | AudioGenerateErrorResponse
          | null;

        if (!response.ok || !payload || !("output" in payload)) {
          const errorPayload = payload as AudioGenerateErrorResponse | null;
          const message = resolveAudioGenerateErrorMessage(errorPayload);
          notifyGenerationFailure(optimisticOutputId, message, errorPayload?.details ?? message);
          setUiError(message);
          return;
        }

        const savedMediaIds = toSavedMediaIds(payload.output.mediaFileId);

        updateOutputById(optimisticOutputId, (item) => ({
          ...item,
          mode: "audio",
          prompt: promptText,
          model: buildVoicesOutputModelLabel(request),
          modelId: payload.output.modelId,
          provider: payload.output.provider,
          generationId: payload.output.generationId,
          savedMediaIds,
          sourceRef: payload.output.requestId,
          status: "ready",
          timestamp: "Just now",
          taskState: "success",
          resultUrls: payload.output.resultUrls,
          previewUrl: payload.output.previewUrl,
          previewStoragePath: payload.output.previewStoragePath,
          fullStoragePath: payload.output.fullStoragePath,
          previewTier: "full",
          mimeType: payload.output.mimeType,
          durationMs: payload.output.durationMs,
          waveformPeaks: payload.output.waveformPeaks,
          mediaSource: "generated",
          localObjectUrl: null,
          saveState: savedMediaIds.length > 0 ? "saved" : "idle",
          saveError: null,
          errorMessage: null,
          errorMessageShort: null,
          errorDetail: null,
        }));

        if (request.mode === "voice-changer" && payload.remuxedVideo) {
          const remuxedVideoOutput = buildVoiceChangerRemuxedVideoOutput({
            request,
            payload: payload.remuxedVideo,
          });
          setOutputs((prev) => [
            remuxedVideoOutput,
            ...prev.filter((item) => item.id !== remuxedVideoOutput.id),
          ]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Voice generation failed.";
        notifyGenerationFailure(optimisticOutputId, message, message);
        setUiError(message);
      } finally {
        setVoicesIsGenerating(false);
      }
    },
    [
      insertOptimisticGenerationPlaceholder,
      notifyGenerationFailure,
      setOutputs,
      setUiError,
      updateOutputById,
    ]
  );

  const handleMusicGenerate = useCallback(
    async (request: MusicGenerateRequest) => {
      const promptText = request.text.trim();
      if (!promptText) return;

      setUiError(null);
      setMusicIsGenerating(true);

      const optimisticOutputId = insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "audio",
        selectedToolOverride: "music",
        modelLabelOverride: buildMusicOutputModelLabel(),
        modelIdOverride: request.modelId,
        providerOverride: "elevenlabs",
      });

      if (!optimisticOutputId) {
        setMusicIsGenerating(false);
        return;
      }

      try {
        const response = await fetchWithAuth("/api/elevenlabs/music", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
          shortpulseLogScope: "generation",
        });

        const payload = (await response.json().catch(() => null)) as
          | MusicGenerateSuccessResponse
          | AudioGenerateErrorResponse
          | null;

        if (!response.ok || !payload || !("output" in payload)) {
          const errorPayload = payload as AudioGenerateErrorResponse | null;
          const message = resolveAudioGenerateErrorMessage(errorPayload);
          notifyGenerationFailure(optimisticOutputId, message, errorPayload?.details ?? message);
          setUiError(message);
          return;
        }

        const savedMediaIds = toSavedMediaIds(payload.output.mediaFileId);

        updateOutputById(optimisticOutputId, (item) => ({
          ...item,
          mode: "audio",
          prompt: promptText,
          model: buildMusicOutputModelLabel(),
          modelId: payload.output.modelId,
          provider: payload.output.provider,
          generationId: payload.output.generationId,
          savedMediaIds,
          sourceRef: payload.output.requestId,
          status: "ready",
          timestamp: "Just now",
          taskState: "success",
          resultUrls: payload.output.resultUrls,
          previewUrl: payload.output.previewUrl,
          previewStoragePath: payload.output.previewStoragePath,
          fullStoragePath: payload.output.fullStoragePath,
          previewTier: "full",
          mimeType: payload.output.mimeType,
          durationMs: payload.output.durationMs,
          waveformPeaks: payload.output.waveformPeaks,
          mediaSource: "generated",
          localObjectUrl: null,
          saveState: savedMediaIds.length > 0 ? "saved" : "idle",
          saveError: null,
          errorMessage: null,
          errorMessageShort: null,
          errorDetail: null,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Music generation failed.";
        notifyGenerationFailure(optimisticOutputId, message, message);
        setUiError(message);
      } finally {
        setMusicIsGenerating(false);
      }
    },
    [insertOptimisticGenerationPlaceholder, notifyGenerationFailure, setUiError, updateOutputById]
  );

  const handleSoundEffectsGenerate = useCallback(
    async (request: SoundEffectsGenerateRequest) => {
      const promptText = request.text.trim();
      if (!promptText) return;

      setUiError(null);
      setSoundEffectsIsGenerating(true);

      const optimisticOutputId = insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "audio",
        selectedToolOverride: "sound-effects",
        modelLabelOverride: buildSoundEffectsOutputModelLabel(),
        modelIdOverride: request.modelId,
        providerOverride: "elevenlabs",
      });

      if (!optimisticOutputId) {
        setSoundEffectsIsGenerating(false);
        return;
      }

      try {
        const response = await fetchWithAuth("/api/elevenlabs/sound-effects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
          shortpulseLogScope: "generation",
        });

        const payload = (await response.json().catch(() => null)) as
          | SoundEffectsGenerateSuccessResponse
          | AudioGenerateErrorResponse
          | null;

        if (!response.ok || !payload || !("output" in payload)) {
          const errorPayload = payload as AudioGenerateErrorResponse | null;
          const message = resolveAudioGenerateErrorMessage(errorPayload);
          notifyGenerationFailure(optimisticOutputId, message, errorPayload?.details ?? message);
          setUiError(message);
          return;
        }

        const savedMediaIds = toSavedMediaIds(payload.output.mediaFileId);

        updateOutputById(optimisticOutputId, (item) => ({
          ...item,
          mode: "audio",
          prompt: promptText,
          model: buildSoundEffectsOutputModelLabel(),
          modelId: payload.output.modelId,
          provider: payload.output.provider,
          generationId: payload.output.generationId,
          savedMediaIds,
          sourceRef: payload.output.requestId,
          status: "ready",
          timestamp: "Just now",
          taskState: "success",
          resultUrls: payload.output.resultUrls,
          previewUrl: payload.output.previewUrl,
          previewStoragePath: payload.output.previewStoragePath,
          fullStoragePath: payload.output.fullStoragePath,
          previewTier: "full",
          mimeType: payload.output.mimeType,
          durationMs: payload.output.durationMs,
          waveformPeaks: payload.output.waveformPeaks,
          mediaSource: "generated",
          localObjectUrl: null,
          saveState: savedMediaIds.length > 0 ? "saved" : "idle",
          saveError: null,
          errorMessage: null,
          errorMessageShort: null,
          errorDetail: null,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sound effect generation failed.";
        notifyGenerationFailure(optimisticOutputId, message, message);
        setUiError(message);
      } finally {
        setSoundEffectsIsGenerating(false);
      }
    },
    [insertOptimisticGenerationPlaceholder, notifyGenerationFailure, setUiError, updateOutputById]
  );

  const shouldGateProjectBootstrap =
    projectRouteRequested &&
    (projectStatus !== "ready" || (Boolean(projectId) && !projectBootstrapApplied));

  if (shouldGateProjectBootstrap) {
    return (
      <AiStudioModalActivityProvider>
        <Head>
          <title>ShortPulse · AI Studio</title>
          <meta name="description" content="AI Studio — prompt, generate, preview, save." />
        </Head>
        {projectStatus === "error" || projectBootstrapError ? (
          <AiStudioProjectEntryState
            title={
              projectStatus === "error" ? "Project unavailable" : "Project workspace unavailable"
            }
            message={
              projectStatus === "error"
                ? (projectError ?? "Failed to load project.")
                : (projectBootstrapError ?? "Failed to load project workspace.")
            }
            actionLabel={projectStatus === "error" ? "Retry project load" : "Retry workspace load"}
            onAction={projectStatus === "error" ? refreshProject : retryProjectBootstrap}
            secondaryActionLabel="Back to dashboard"
            onSecondaryAction={() => {
              window.location.assign("/dashboard");
            }}
          />
        ) : (
          <AiStudioProjectEntryState
            title="Loading project..."
            message="Resolving your saved project before AI Studio restore continues."
          />
        )}
      </AiStudioModalActivityProvider>
    );
  }

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
        sessionId={sessionId}
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
        onOpenProjects={handleOpenProjectsModal}
        onSelectTool={handleToolSelect}
        onToggleCreateTools={setShowCreateTools}
        propertiesCreate={propertiesCreate}
        propertiesEditExpert={propertiesEditExpert}
        propertiesVideo={propertiesVideo}
        propertiesMusic={{
          isGenerating: musicIsGenerating,
          onGenerate: handleMusicGenerate,
        }}
        propertiesSoundEffects={{
          isGenerating: soundEffectsIsGenerating,
          onGenerate: handleSoundEffectsGenerate,
        }}
        propertiesVoices={{
          isGenerating: voicesIsGenerating,
          onGenerate: handleVoicesGenerate,
        }}
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
        projectId={projectId}
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
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        currentProjectId={projectId}
        onClose={handleCloseProjectsModal}
        onSelectProject={handleSelectProjectFromModal}
      />
    </AiStudioModalActivityProvider>
  );
}
