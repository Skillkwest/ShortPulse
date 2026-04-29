/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import { AiStudioProjectEntryState } from "../features/ai-studio/components/AiStudioProjectEntryState";
import {
  normalizeAiStudioProjectName,
  resolveProjectEntryPhase,
} from "../features/ai-studio/logic/aiStudioPageProjectState";
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
import { useAiStudioAudioGeneration } from "../features/ai-studio/hooks/useAiStudioAudioGeneration";
import { useAiStudioCreateCharacterLookState } from "../features/ai-studio/hooks/useAiStudioCreateCharacterLookState";
import { useAiStudioDualCanvasWorkspaceState } from "../features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState";
import { useAiStudioCreateModeRuntime } from "../features/ai-studio/hooks/useAiStudioCreateModeRuntime";
import { useCreatePulsePresetPageRuntime } from "../features/ai-studio/hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime";
import { usePulseWorkflowSessionReconciliation } from "../features/ai-studio/hooks/createPulsePageRuntime/usePulseWorkflowSessionReconciliation";
import { usePulseCreatePrimarySubmit } from "../features/ai-studio/hooks/pulseCreateRuntime/usePulseCreatePrimarySubmit";
import { useStandardCreateChatMode } from "../features/ai-studio/hooks/standardCreateRuntime/useStandardCreateChatMode";
import { useStandardCreatePrimarySubmit } from "../features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit";
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
  createVoiceChangerSourceFromFile,
  createVoiceChangerSourceFromReference,
  type ResolveVoiceChangerInternalReferenceSource,
} from "../features/ai-studio/components/VoiceChangerSourceDropzone";
import {
  normalizeOptionalText,
  resolveVoiceChangerBlobFilename,
  resolveVoiceChangerOutputLocalUrl,
  resolveVoiceChangerOutputRemoteUrl,
  resolveVoiceChangerOutputStoragePath,
} from "../features/ai-studio/logic/voiceChangerReferenceSource";
import {
  createEmptyAiStudioSessionAgentState,
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotWorkspace,
  type AiStudioSessionAgentV1,
  type AiStudioSessionAgentRuntimesV2,
} from "../features/ai-studio/logic/sessionSnapshot";
import { AiStudioModalActivityProvider } from "../features/ai-studio/components/modal-layer/AiStudioModalLayer";
import { isEditWorkflow } from "../features/ai-studio/logic/workflowIdentity";
import type { StudioOutput, ToolId } from "../features/ai-studio/types";
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
  const { balanceCents, balanceReservedCents, balanceLoading, refreshBalance } = useCredits();
  const {
    modelPricingPolicy,
    modelPricingPolicyReady,
    modelPricingPolicyLoading,
    modelPricingPolicyError,
  } = useActiveModelPricingPolicy({
    enabled: true,
  });
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [isCreateCharacterBundleLoading, setIsCreateCharacterBundleLoading] = useState(false);
  const [isEditCharacterBundleLoading, setIsEditCharacterBundleLoading] = useState(false);
  const [isCreateCharacterModeEnabled, setIsCreateCharacterModeEnabled] = useState(false);
  const [isEditCharacterModeEnabled, setIsEditCharacterModeEnabled] = useState(false);
  const [createSelectedCharacterLookId, setCreateSelectedCharacterLookId] = useState("");
  const [characterCreateRequestKey, setCharacterCreateRequestKey] = useState(0);
  const [elementCreateRequestKey, setElementCreateRequestKey] = useState(0);
  const [editSelectedCharacterId, setEditSelectedCharacterId] = useState("");
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
  const { standardChatModeEnabled, defaultStandardChatModeEnabled, setStandardChatModeEnabled } =
    useStandardCreateChatMode({
      projectId,
      projectRouteRequested,
    });
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
    handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange,
  } = useAiStudioCreateModeRuntime();
  // Character workflow state (shared with Character tool workflows and error surfaces)
  const {
    error: characterError,
    addReferences: addCharacterReferences,
    clearError: clearCharacterError,
  } = useCharacterWorkflow();
  const {
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
    setPulseCreatePrompt,
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
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
    clearGenerationOutput,
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
    setExpertCreateMode,
    setActivePulsePresetId: setActiveCreatePulsePresetId,
    setPulseSessionInstanceId,
  });
  const clearPulsePromptForPage = useCallback(() => {
    setPulseCreatePrompt("");
  }, [setPulseCreatePrompt]);

  const {
    activeCreatePulsePresetSnapshot,
    setActiveCreatePulsePresetSnapshot,
    clearPulseRuntimeForPage,
    handleExpertCreateModeChangeForPage,
    handleActiveCreatePulsePresetIdChangeForPage,
    hasActivePulseSession,
    createModeAgentContextResolver,
  } = useCreatePulsePresetPageRuntime({
    selectedTool,
    expertCreateMode,
    activeCreatePulsePresetId,
    pulseSessionInstanceId,
    pulseWorkflowSession,
    getAgentContext,
    clearPulseRuntime,
    clearPulsePrompt: clearPulsePromptForPage,
    handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange,
  });

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
  const resolveVoiceChangerInternalReferenceSource =
    useCallback<ResolveVoiceChangerInternalReferenceSource>(
      async (payload) => {
        const outputId = (payload.outputId ?? payload.referenceId ?? "").trim();
        const output = outputId ? getOutputById(outputId) : null;
        if (!output || (output.mode !== "audio" && output.mode !== "video")) return null;

        const kind = output.mode;
        const referenceMediaId =
          payload.mediaId?.trim() || resolveSavedMediaIdFromOutput(output, payload.imageIndex ?? 0);
        const storagePath = resolveVoiceChangerOutputStoragePath(output);
        const remoteUrl = resolveVoiceChangerOutputRemoteUrl({
          output,
          kind,
          payloadReferenceUrl: payload.referenceUrl,
        });
        const displayName =
          normalizeOptionalText(output.prompt || output.previewText) ?? `Reference Grid ${kind}`;

        if (storagePath || remoteUrl) {
          return createVoiceChangerSourceFromReference({
            kind,
            origin: "reference-grid",
            name: displayName,
            mimeType: output.mimeType ?? null,
            sourceUrl: remoteUrl,
            previewUrl: kind === "video" ? remoteUrl : null,
            storagePath,
            durationMs: output.durationMs ?? null,
            referenceOutputId: outputId || null,
            referenceMediaId,
          });
        }

        const localUrl = resolveVoiceChangerOutputLocalUrl(output);
        if (!localUrl) return null;

        try {
          const response = await fetch(localUrl);
          if (!response.ok) return null;
          const blob = await response.blob();
          if (!(blob instanceof Blob) || blob.size <= 0) return null;
          const mimeType =
            blob.type || output.mimeType || (kind === "audio" ? "audio/mpeg" : "video/mp4");
          const file = new File(
            [blob],
            resolveVoiceChangerBlobFilename({ output, kind, mimeType }),
            { type: mimeType }
          );
          return createVoiceChangerSourceFromFile(file, {
            origin: "reference-grid",
            referenceOutputId: outputId || null,
            referenceMediaId,
            durationMs: output.durationMs ?? null,
          });
        } catch (error) {
          addBreadcrumb({
            type: "ui",
            level: "warn",
            message: "voice_changer.internal_reference_resolve_failed",
            data: {
              outputId,
              mediaId: referenceMediaId,
              mode: output.mode,
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          });
          return null;
        }
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
  const {
    handleCreateCharacterSelection,
    loadCreateCharacterLookOptions,
    selectedCreateCharacterLookLabel,
  } = useAiStudioCreateCharacterLookState({
    createSelectedCharacterId,
    setCreateSelectedCharacterId,
    createSelectedCharacterLookId,
    setCreateSelectedCharacterLookId,
    createCharacterModeInjectionBundle,
  });
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
    agentIsSending,
    agentUiBusy,
    agentBusy,
    agentInput,
    directOpenAiBypassEnabled,
    chatModeEnabled,
    setChatModeEnabled,
    agentAttachmentError,
    agentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    persistedAgentRuntimes,
    setPromptOrigin,
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
    handleAssistantMessageEdit,
    handleClearAgentChat,
    resetProjectAgentConversation,
    hydrateFromSessionAgentSnapshot,
  } = useAiStudioAgentBridge({
    sessionId,
    mode,
    selectedTool,
    expertCreateMode,
    activePulsePresetId: activeCreatePulsePresetId,
    pulseSessionInstanceId,
    pulseWorkflowSession,
    standardChatModeEnabled,
    defaultStandardChatModeEnabled,
    setStandardChatModeEnabled,
    prompt,
    setSharedPrompt,
    getAgentContext: createModeAgentContextResolver,
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
    clearPulseRuntime: clearPulseRuntimeForPage,
    restartPulse,
    trackAgentUiEvent: trackUiEvent,
  });

  const handleCreatePulsePresetStart = useCallback(
    async (
      preset: Parameters<typeof handlePulsePresetStart>[0],
      options?: Parameters<typeof handlePulsePresetStart>[1]
    ) => {
      setActiveCreatePulsePresetSnapshot(preset);
      const result = await handlePulsePresetStart(preset, {
        pulseSessionInstanceId: options?.pulseSessionInstanceId ?? null,
      });
      if (result.status !== "started") {
        setActiveCreatePulsePresetSnapshot((current) =>
          current?.presetId === preset.presetId ? null : current
        );
      }
      return result;
    },
    [handlePulsePresetStart, setActiveCreatePulsePresetSnapshot]
  );

  usePulseWorkflowSessionReconciliation({
    hasActivePulseSession,
    activeCreatePulsePresetId,
    activeCreatePulsePresetSnapshot,
    agentBusy,
    agentMessages,
    pulseWorkflowSession,
    setPulseWorkflowSession,
  });

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

  const sessionAgentRuntimes = useMemo<AiStudioSessionAgentRuntimesV2>(() => {
    if (expertCreateMode === "pulse" && hasActivePulseSession) {
      return {
        ...persistedAgentRuntimes,
        pulsePresetId: activeCreatePulsePresetId,
        pulse: {
          ...persistedAgentRuntimes.pulse,
          pulseWorkflowSession: pulseWorkflowSession ?? null,
        },
      };
    }
    return {
      standard: persistedAgentRuntimes.standard,
      pulsePresetId: null,
      pulse: createEmptyAiStudioSessionAgentState(),
    };
  }, [
    activeCreatePulsePresetId,
    expertCreateMode,
    hasActivePulseSession,
    persistedAgentRuntimes,
    pulseWorkflowSession,
  ]);
  const sessionAgentRuntime = useMemo<AiStudioSessionAgentV1>(() => {
    if (expertCreateMode === "pulse") {
      return hasActivePulseSession
        ? sessionAgentRuntimes.pulse
        : createEmptyAiStudioSessionAgentState();
    }
    return sessionAgentRuntimes.standard;
  }, [expertCreateMode, hasActivePulseSession, sessionAgentRuntimes]);

  const {
    sessionRestoreCandidate,
    projectBootstrapApplied,
    projectBootstrapError,
    retryProjectBootstrap,
  } = useAiStudioPageSessionPersistence({
    projectId,
    projectRouteRequested,
    sessionId: activeSessionPersistenceSessionId,
    sessionTitleOverride: sessionPersistenceTitleOverride,
    buildSessionSnapshot: buildProjectAwareSessionSnapshot,
    agentRuntime: sessionAgentRuntime,
    agentRuntimes: sessionAgentRuntimes,
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
    pricingPolicyReady: modelPricingPolicyReady,
    pricingPolicyLoading: modelPricingPolicyLoading,
    pricingPolicyError: modelPricingPolicyError,
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

  const handleStandardAgentCaptureResult = useCallback(
    (promptText: string, referenceTitle?: string | null) => {
      addAgentPromptReference(promptText, referenceTitle ?? undefined);
      setPromptOrigin("agent");
    },
    [addAgentPromptReference, setPromptOrigin]
  );
  const {
    handleGenerate,
    handlePrimarySubmit: handleProviderPrimarySubmit,
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
  const handleStandardCreatePrimarySubmit = useStandardCreatePrimarySubmit({
    mode,
    selectedTool,
    chatModeEnabled,
    agentInput,
    prompt,
    handleAgentSend,
    handleProviderPrimarySubmit,
    handleStandardAgentCaptureResult,
  });
  const {
    pulseArtifactGenerateGuardrail,
    pulseArtifactGenerateDisabled,
    handlePulseCreatePrimarySubmit,
  } = usePulseCreatePrimarySubmit({
    mode,
    selectedTool,
    hasActivePulseSession,
    pulseWorkflowSession,
    effectiveGenerationGuardrail,
    promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits ?? null,
    currentCostCredits,
    handleGenerate,
    handleProviderPrimarySubmit,
    setUiNotice,
  });
  const handlePrimarySubmit =
    expertCreateMode === "pulse"
      ? handlePulseCreatePrimarySubmit
      : handleStandardCreatePrimarySubmit;
  const { assistantBubbleMedia, handleGenerateFromAgentOutputPrompt } =
    useAiStudioAgentOutputGenerationBridge({
      outputs,
      referenceGridReadyOutputIds,
      mode,
      selectedTool,
      isGenerateDisabled: effectiveIsGenerateDisabled,
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
    agentEnabled,
    agentBootstrapReady,
    agentMessages,
    agentInput,
    chatModeEnabled,
    directOpenAiBypassEnabled,
    agentBusy,
    agentIsSending,
    agentUiBusy,
    agentAttachmentError,
    agentError,
    stagedAgentPrompt,
    agentAttachments,
    isAgentDropActive,
    handleAgentInputChange,
    setChatModeEnabled,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleAgentAttachmentDrop,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAssistantMessageEdit: handleAssistantBubbleMessageEdit,
    handleGenerateFromAgentOutputPrompt,
    assistantBubbleMedia,
    useReferenceImageIndicator,
    isModelModalOpen,
    modelModalAnchor,
    handleOpenModelModal,
    handleManualPromptChange,
    createIsGenerating,
    editIsGenerating,
    isPrimaryEditStageGenerating,
    isPromptRefining,
    describeInFlightCount,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    generationGuardrail: effectiveGenerationGuardrail,
    handleClearAgentChat,
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
  const panelPropsWithCreateModeRuntime = useMemo(() => {
    const standardCreateProperties = {
      ...panelProps.propertiesCreate.standard,
    };
    const pulseCreateProperties = {
      ...panelProps.propertiesCreate.pulse,
      hasActivePulseSession,
      isGenerateDisabled: pulseArtifactGenerateDisabled,
      guardrailReason: pulseArtifactGenerateGuardrail,
      pulseWorkflowSession,
      activePulsePresetId: activeCreatePulsePresetId,
      activePulsePresetLabel: activeCreatePulsePresetSnapshot?.label ?? null,
      onActivePulsePresetIdChange: handleActiveCreatePulsePresetIdChangeForPage,
      onPulsePresetStart: handleCreatePulsePresetStart,
    };
    return {
      ...panelProps,
      propertiesCreate:
        expertCreateMode === "pulse"
          ? {
              expertCreateMode,
              onExpertCreateModeChange: handleExpertCreateModeChangeForPage,
              pulse: pulseCreateProperties,
            }
          : {
              expertCreateMode,
              onExpertCreateModeChange: handleExpertCreateModeChangeForPage,
              standard: standardCreateProperties,
            },
    };
  }, [
    activeCreatePulsePresetId,
    activeCreatePulsePresetSnapshot?.label,
    expertCreateMode,
    handleActiveCreatePulsePresetIdChangeForPage,
    handleCreatePulsePresetStart,
    handleExpertCreateModeChangeForPage,
    hasActivePulseSession,
    panelProps,
    pulseArtifactGenerateDisabled,
    pulseArtifactGenerateGuardrail,
    pulseWorkflowSession,
  ]);
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
    panelProps: panelPropsWithCreateModeRuntime,
    referenceGridProps: referenceGridPageProps,
    previewDetailProps,
  });
  const handleOpenMediaLibraryPanelOnly = useCallback(() => {
    handleCloseMediaLibrary();
    setShowCreateTools(false);
    setSelectedToolWithEditIntentReset("media-library");
  }, [handleCloseMediaLibrary, setSelectedToolWithEditIntentReset, setShowCreateTools]);
  const {
    musicIsGenerating,
    voicesIsGenerating,
    soundEffectsIsGenerating,
    handleVoicesGenerate,
    handleMusicGenerate,
    handleSoundEffectsGenerate,
  } = useAiStudioAudioGeneration({
    setUiError,
    insertOptimisticGenerationPlaceholder,
    notifyGenerationFailure,
    updateOutputById,
    setOutputs,
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
  const modelModalState = useMemo(
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

  if (shouldGateProjectBootstrap) {
    return (
      <AiStudioModalActivityProvider>
        <Head>
          <title>ShortPulse · AI Studio</title>
          <meta name="description" content="AI Studio — prompt, generate, preview, save." />
        </Head>
        {projectStatus === "error" || projectBootstrapError ? (
          <AiStudioProjectEntryState
            variant="error"
            phase={projectEntryPhase}
            projectTitle={project?.title ?? null}
            errorTitle={
              projectStatus === "error" ? "Project unavailable" : "Project workspace unavailable"
            }
            errorMessage={
              projectStatus === "error"
                ? (projectError ?? "Failed to load project.")
                : (projectBootstrapError ?? "Failed to load project workspace.")
            }
            primaryActionLabel={
              projectStatus === "error" ? "Retry project load" : "Retry workspace load"
            }
            onPrimaryAction={projectStatus === "error" ? refreshProject : retryProjectBootstrap}
            secondaryActionLabel="Back to dashboard"
            onSecondaryAction={() => {
              window.location.assign("/dashboard");
            }}
          />
        ) : (
          <AiStudioProjectEntryState
            variant="loading"
            phase={projectEntryPhase}
            projectTitle={project?.title ?? null}
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
          balanceCredits: effectiveBalanceCredits,
          isGenerating: musicIsGenerating,
          onGenerate: handleMusicGenerate,
          pricingPolicy: modelPricingPolicy,
        }}
        propertiesSoundEffects={{
          balanceCredits: effectiveBalanceCredits,
          isGenerating: soundEffectsIsGenerating,
          onGenerate: handleSoundEffectsGenerate,
          pricingPolicy: modelPricingPolicy,
        }}
        propertiesVoices={{
          balanceCredits: effectiveBalanceCredits,
          isGenerating: voicesIsGenerating,
          onGenerate: handleVoicesGenerate,
          pricingPolicy: modelPricingPolicy,
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
        modelModalState={modelModalState}
        handleReferenceGridFiles={handleReferenceGridFiles}
        triggerFilePicker={triggerFilePicker}
        resolveCharacterDropReference={resolveCharacterDropReference}
        resolveElementProfileImageDropSource={resolveElementProfileImageDropSource}
        resolveVoiceChangerInternalReferenceSource={resolveVoiceChangerInternalReferenceSource}
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
