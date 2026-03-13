/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput } from "../types";
import { DEFAULT_KLING_DURATION_SECONDS, getModelConfig } from "../logic/pricing";
import { resolvePreviewUrlById, resolveModelLabel } from "../logic/stateParsers";
import { canRerollOutput, isGenerationReplayConfigV1 } from "../logic/generationReplay";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioOutputObjectUrlLifecycle } from "./useAiStudioOutputObjectUrlLifecycle";
import { useAiStudioGenerationPromptComposer } from "./useAiStudioGenerationPromptComposer";
import { useAiStudioAllowedModelOptions } from "./useAiStudioAllowedModelOptions";
import { useAiStudioReferenceIngestionActions } from "./useAiStudioReferenceIngestionActions";
import { useAiStudioReferenceProjectionEffects } from "./useAiStudioReferenceProjectionEffects";
import { useAiStudioReferenceGridStateActions } from "./useAiStudioReferenceGridStateActions";
import { useAiStudioReferenceSelectionState } from "./useAiStudioReferenceSelectionState";
import { useAiStudioTaskOrchestration } from "./useAiStudioTaskOrchestration";
import { useAiStudioWorkflowSettings } from "./useAiStudioWorkflowSettings";
import { useAiStudioStateEffects } from "./useAiStudioStateEffects";
import { useAiStudioOutputCollectionState } from "./useAiStudioOutputCollectionState";
import { useAiStudioOptimisticPlaceholderActions } from "./useAiStudioOptimisticPlaceholderActions";
import { useAiStudioOutputStoreSelectors } from "./useAiStudioOutputStoreSelectors";
import { useAiStudioSessionReferenceDurability } from "./useAiStudioSessionReferenceDurability";
import type { ExpertEditLayerSessionState } from "../components/edit/ExpertEditPanelView";
import {
  buildAiStudioSessionSnapshot,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";
import {
  buildAiStudioSessionHydrationPayload,
  type AiStudioSessionHydrationPayload,
} from "../logic/sessionSnapshotHydrator";
import type { AgentMessage } from "../../../prefabs/agent/types";
import {
  applySessionRestoreSignedUrls,
  buildSessionOutputSigningFingerprintById,
  resolveSessionRestoreSignedUrls,
} from "../logic/sessionRestoreMediaSigning";
import {
  createEmptyReferenceProjectionState,
  markReferenceRemovedFromAllRefs,
  type ReferenceProjectionState,
} from "../reference-projections";

const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS; // current general fallback (10s)
const DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT = 500;
const DEFAULT_ARCHIVE_PREVIEW_KEEP_COUNT = 120;
const REFERENCE_GRID_FLAG_SOFT_ARCHIVE =
  process.env.NEXT_PUBLIC_REFERENCE_GRID_SOFT_ARCHIVE !== "false";
const REFERENCE_GRID_ACTIVE_LIMIT = Number(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT ?? DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT
);
const REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT = Number(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT ??
    DEFAULT_ARCHIVE_PREVIEW_KEEP_COUNT
);
/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
export const useAiStudioState = ({
  isCharacterModeEnabled = false,
  selectedStylePrompt = null,
  selectedStyleContext = null,
}: {
  isCharacterModeEnabled?: boolean;
  selectedStylePrompt?: string | null;
  selectedStyleContext?: StudioOutput["styleContext"] | null;
} = {}) => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [editReferenceText, setEditReferenceTextState] = useState<string>("");
  const [videoReferenceText, setVideoReferenceTextState] = useState<string>("");
  const [expertEditLayerSessionState, setExpertEditLayerSessionState] =
    useState<ExpertEditLayerSessionState | null>(null);

  // Output management
  const {
    activeOutputState,
    setActiveOutputState,
    archivedOutputState,
    setArchivedOutputState,
    activeOutputByIdRef,
    outputs,
    archivedOutputs,
    activeOutputById,
    setOutputsState,
    setArchivedOutputs,
  } = useAiStudioOutputCollectionState();
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [referenceProjectionState, setReferenceProjectionState] =
    useState<ReferenceProjectionState>(createEmptyReferenceProjectionState);
  const referenceProjectionStateRef = useRef<ReferenceProjectionState>(referenceProjectionState);
  const curatedReferenceIds = referenceProjectionState.quickSlotIds;
  const removedFromAllRefsIds = referenceProjectionState.removedFromAllRefsIds;
  const [saved, setSaved] = useState(false);
  const pendingAutoSavesRef = useRef<Record<string, unknown>>({});
  const pendingFinalizeRemovalIdsRef = useRef<Set<string>>(new Set());
  const sessionHydrationSigningRevisionRef = useRef(0);
  const activeOutput = useMemo(
    () => (activeOutputId ? (activeOutputById[activeOutputId] ?? null) : null),
    [activeOutputById, activeOutputId]
  );
  const isPrimaryEditStageGenerating = useMemo(
    () =>
      outputs.some(
        (output) =>
          output.mode === "image" &&
          output.hiddenInReferenceGrid === true &&
          output.modelId !== BRIA_BACKGROUND_REMOVE_MODEL_ID &&
          output.taskState !== "success" &&
          output.taskState !== "fail"
      ),
    [outputs]
  );

  // UI selections and references (tracked per workflow)
  const {
    selectedTool,
    setSelectedTool,
    showCreateTools,
    setShowCreateTools,
    videoReferenceImageUrl,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    useReferenceImageIndicator,
    setUseReferenceImageIndicator,
    detailOutputId,
    setDetailOutputId,
    referenceImageUrl,
    setReferenceImageUrl,
    setImageReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    clearReferenceImages,
    toggleReferenceIndicator,
    resolveReferenceInputsForTool,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    modelModalPosition,
    setIsModelModalOpen,
    setModelModalAnchor,
    setModelModalPosition,
    openModelModal,
    closeModelModal,
  } = useAiStudioReferenceSelectionState({
    activeOutputPreviewUrl: activeOutput?.previewUrl ?? null,
  });

  const VIDEO_DURATION_STORAGE_KEY = "aiStudioVideoDuration";
  const VIDEO_RESOLUTION_STORAGE_KEY = "aiStudioVideoResolution";
  const IMAGE_RESOLUTION_STORAGE_KEY = "aiStudioImageResolution";

  const [videoReferenceMode, setVideoReferenceMode] = useState<
    "standard" | "keyframes" | "kling3" | "motion"
  >("standard");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 6;
    const stored = window.sessionStorage.getItem(VIDEO_DURATION_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : 6;
  });
  const [videoResolution, setVideoResolution] = useState<string>(() => {
    if (typeof window === "undefined") return "1080p";
    const stored = window.sessionStorage.getItem(VIDEO_RESOLUTION_STORAGE_KEY);
    return stored || "1080p";
  });
  const [imageResolution, setImageResolution] = useState<string>(() => {
    if (typeof window === "undefined") return "model_default";
    const stored = window.sessionStorage.getItem(IMAGE_RESOLUTION_STORAGE_KEY);
    return stored || "model_default";
  });
  const [hasUserVideoPrefs, setHasUserVideoPrefs] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      window.sessionStorage.getItem(VIDEO_DURATION_STORAGE_KEY) ||
      window.sessionStorage.getItem(VIDEO_RESOLUTION_STORAGE_KEY)
    );
  });
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<boolean>(false);
  const [videoCameraFixed, setVideoCameraFixed] = useState<boolean>(false);
  const [videoAutoFix, setVideoAutoFix] = useState<boolean>(false);
  const [klingNegativePrompt, setKlingNegativePrompt] = useState<string>(
    "blur, distort, and low quality"
  );
  const [klingCfgScale, setKlingCfgScale] = useState<number>(0.5);
  const [klingShotType, setKlingShotType] = useState<"customize" | "intelligent">("customize");
  const [klingVoiceIds, setKlingVoiceIds] = useState<[string, string]>(["", ""]);
  const [klingMultiPrompts, setKlingMultiPrompts] = useState<
    { id: string; prompt: string; duration: number }[]
  >([]);
  const [klingElements, setKlingElements] = useState<
    { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
  >([{ id: randomId(), frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" }]);
  const [isPromptGenerating, setIsPromptGenerating] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const lastVideoReferenceModeRef = useRef(videoReferenceMode);
  const lastNonKling3VideoModelRef = useRef<string | null>(null);
  const lastNonKeyframesVideoModelRef = useRef<string | null>(null);
  const lastNonMotionVideoModelRef = useRef<string | null>(null);
  const { hasPendingWorkflowRestore } = useAiStudioWorkflowSettings({
    selectedTool,
    mode,
    model,
    aspect,
    imageResolution,
    videoReferenceMode,
    videoDurationSeconds,
    videoResolution,
    videoGenerateAudio,
    videoCameraFixed,
    videoAutoFix,
    klingNegativePrompt,
    klingCfgScale,
    klingShotType,
    klingVoiceIds,
    klingMultiPrompts,
    klingElements,
    setMode,
    setModelState,
    setAspect,
    setImageResolution,
    setVideoReferenceMode,
    setVideoDurationSeconds,
    setVideoResolution,
    setVideoGenerateAudio,
    setVideoCameraFixed,
    setVideoAutoFix,
    setKlingNegativePrompt,
    setKlingCfgScale,
    setKlingShotType,
    setKlingVoiceIds,
    setKlingMultiPrompts,
    setKlingElements,
  });

  const detailOutput = useMemo(
    () => (detailOutputId ? (activeOutputById[detailOutputId] ?? null) : null),
    [activeOutputById, detailOutputId]
  );
  const currentModelLabel = useMemo(() => resolveModelLabel(model ?? undefined), [model]);
  const setSharedPrompt = useCallback((value: string) => {
    setPrompt((prev) => (prev === value ? prev : value));
  }, []);
  const setEditReferenceText = useCallback((value: string) => {
    setEditReferenceTextState((prev) => (prev === value ? prev : value));
  }, []);
  const setVideoReferenceText = useCallback((value: string) => {
    setVideoReferenceTextState((prev) => (prev === value ? prev : value));
  }, []);
  const {
    archiveOlderOutputs,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    setOutputs,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    clearCuratedReferences,
    resetReferenceGridState,
  } = useAiStudioReferenceGridStateActions({
    activeOutputId,
    outputsLength: outputs.length,
    setActiveOutputId,
    setOutputsState,
    setArchivedOutputs,
    setReferenceProjectionState,
    pendingFinalizeRemovalIdsRef,
    config: {
      softArchiveEnabled: REFERENCE_GRID_FLAG_SOFT_ARCHIVE,
      activeLimit: REFERENCE_GRID_ACTIVE_LIMIT,
      archivePreviewKeepCount: REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT,
      defaultActiveLimit: DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT,
    },
  });

  const findActiveOutputById = useCallback(
    (id: string) => {
      return activeOutputByIdRef.current[id] ?? null;
    },
    [activeOutputByIdRef]
  );

  const updateActiveOutputById = useCallback(
    (id: string, updater: (item: StudioOutput) => StudioOutput) => {
      setActiveOutputState((prevState) => {
        const current = prevState.byId[id];
        if (!current) return prevState;
        const nextItem = updater(current);
        if (nextItem === current) return prevState;
        return {
          order: prevState.order,
          byId: {
            ...prevState.byId,
            [id]: nextItem,
          },
        };
      });
    },
    [setActiveOutputState]
  );

  const allowedModelOptions = useAiStudioAllowedModelOptions({
    selectedTool,
    videoReferenceMode,
    mode,
    isCharacterModeEnabled,
  });
  const allowedModelValues = useMemo(
    () => allowedModelOptions.map((option) => option.value),
    [allowedModelOptions]
  );

  const setModel = useCallback((value: string | null) => {
    setModelState(value);
  }, []);

  const getDefaultDurationSeconds = useCallback((modelId: string | null) => {
    if (!modelId) return VIDEO_DEFAULT_DURATION_SECONDS;
    const config = getModelConfig(modelId);
    if (config?.defaultDurationSeconds) return config.defaultDurationSeconds;
    return VIDEO_DEFAULT_DURATION_SECONDS;
  }, []);

  useAiStudioStateEffects({
    promptRef,
    aspect,
    setAspect,
    activeOutputPreviewUrl: activeOutput?.previewUrl,
    setUseReferenceImageIndicator,
    model,
    selectedTool,
    videoReferenceMode,
    setVideoReferenceMode,
    setModel,
    lastVideoReferenceModeRef,
    lastNonKling3VideoModelRef,
    lastNonKeyframesVideoModelRef,
    lastNonMotionVideoModelRef,
    showCreateTools,
    setShowCreateTools,
    videoDurationStorageKey: VIDEO_DURATION_STORAGE_KEY,
    videoResolutionStorageKey: VIDEO_RESOLUTION_STORAGE_KEY,
    imageResolutionStorageKey: IMAGE_RESOLUTION_STORAGE_KEY,
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    imageResolution,
    setImageResolution,
    hasUserVideoPrefs,
    setHasUserVideoPrefs,
    setVideoGenerateAudio,
    allowedModelValues,
    isCharacterModeEnabled,
    mode,
    isModelModalOpen,
    modelModalAnchor,
    setDetailOutputId,
    setIsModelModalOpen,
    setModelModalAnchor,
    setModelModalPosition,
    hasPendingWorkflowRestore,
  });

  useAiStudioReferenceProjectionEffects({
    referenceProjectionState,
    setReferenceProjectionState,
    referenceProjectionStateRef,
    activeOutputOrder: activeOutputState.order,
    archivedOutputOrder: archivedOutputState.order,
    curatedReferenceIds,
    setActiveOutputState,
    setArchivedOutputState,
    setOutputs,
  });

  useAiStudioOutputObjectUrlLifecycle({
    outputs,
    archivedOutputs,
  });
  useAiStudioSessionReferenceDurability({
    outputs,
    archivedOutputs,
    setOutputsState,
    setArchivedOutputs,
  });

  // --- Output + prompt actions -------------------------------------------
  const {
    updateOutputById,
    findOutputById,
    deleteOutput: deleteOutputFromLifecycle,
    notifyGenerationFailure,
    updateOutputPrompt,
  } = useAiStudioOutputLifecycle({
    outputs,
    setOutputs,
    updateOutputByIdFast: updateActiveOutputById,
    findOutputByIdFast: findActiveOutputById,
    activeOutputId,
    setActiveOutputId,
    pendingAutoSavesRef,
    setUiError,
  });
  const deleteOutput = useCallback(
    (id: string) => {
      const outputId = id.trim();
      if (!outputId) return;
      if (referenceProjectionStateRef.current.quickSlotIds.includes(outputId)) {
        setReferenceProjectionState((prev) => markReferenceRemovedFromAllRefs(prev, outputId));
        setActiveOutputId((prev) => (prev === outputId ? null : prev));
        return;
      }
      deleteOutputFromLifecycle(outputId);
    },
    [deleteOutputFromLifecycle, setActiveOutputId]
  );

  useEffect(() => {
    if (pendingFinalizeRemovalIdsRef.current.size === 0) return;
    const quickSlotIds = new Set(referenceProjectionState.quickSlotIds);
    const readyToFinalize = [...pendingFinalizeRemovalIdsRef.current].filter(
      (candidateId) => !quickSlotIds.has(candidateId)
    );
    if (!readyToFinalize.length) return;
    readyToFinalize.forEach((candidateId) =>
      pendingFinalizeRemovalIdsRef.current.delete(candidateId)
    );
    readyToFinalize.forEach((candidateId) => {
      deleteOutputFromLifecycle(candidateId);
    });
  }, [deleteOutputFromLifecycle, referenceProjectionState.quickSlotIds]);

  const {
    ensureGenerationRecord,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
  } = useAiStudioPersistenceActions({
    findOutputById,
    updateOutputById,
    setUiError,
    setOutputs,
    setSaved,
    activeOutputId,
    model,
    aspect,
    prompt,
  });

  const { submitTask, onReferenceOutputMediaLoaded, retryOutputStatus } =
    useAiStudioTaskOrchestration({
      taskSubmissionConfig: {
        aspect,
        mode,
        model,
        prompt,
        selectedTool,
        imageResolution,
        videoDurationSeconds,
        videoResolution,
        videoGenerateAudio,
        videoReferenceMode,
        videoReferenceImageUrl,
        motionReferenceVideoUrl,
        videoCameraFixed,
        videoAutoFix,
        klingNegativePrompt,
        klingCfgScale,
        klingShotType,
        klingVoiceIds,
        klingMultiPrompts,
        klingElements,
        setIsPromptGenerating,
        setUiError,
        setUiNotice,
        setOutputs,
        setSaved,
        getDefaultDurationSeconds,
        notifyGenerationFailure,
        updateOutputById,
        ensureGenerationRecord,
      },
      outputs,
      findOutputById,
      setPrimaryEditReferenceImageUrl: setImageReferenceImageUrl,
    });
  const { generateOutput, regenerateOutput } = useAiStudioGenerationPromptComposer({
    model,
    prompt,
    editReferenceText,
    videoReferenceText,
    selectedStylePrompt,
    selectedStyleContext,
    selectedTool,
    videoReferenceMode,
    useReferenceImageIndicator,
    activeOutputPreviewUrl: activeOutput?.previewUrl ?? null,
    resolveReferenceInputsForTool,
    submitTask,
  });
  const rerollOutputFromReplay = useCallback(
    (outputId: string) => {
      const normalizedOutputId = outputId.trim();
      if (!normalizedOutputId) return;
      const output = findOutputById(normalizedOutputId);
      if (!output || !canRerollOutput(output)) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "missing_output_or_replay",
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }
      const replay = output.generationReplay;
      if (!isGenerationReplayConfigV1(replay)) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "invalid_replay_payload",
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }
      const hasLocalOnlyReplayReference = replay.referenceInputs.some(
        (input) => /^blob:/i.test(input) || /^data:/i.test(input)
      );
      if (hasLocalOnlyReplayReference) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "local_reference",
          },
        });
        setUiNotice(
          "Re-roll is unavailable because original reference media are no longer accessible."
        );
        return;
      }
      addBreadcrumb({
        type: "ui",
        level: "info",
        message: "reroll_started",
        data: {
          output_id: normalizedOutputId,
          model_id: replay.modelId,
          tool: replay.submitTool,
          reference_count: replay.referenceInputs.length,
        },
      });
      void submitTask(replay.submissionPrompt, replay.referenceInputs, {
        modeOverride: "image",
        selectedToolOverride: replay.submitTool,
        displayPromptOverride: replay.displayPrompt,
        characterContextOverride: replay.characterContext,
        modelIdOverride: replay.modelId,
        aspectOverride: replay.aspect,
        imageResolutionOverride: replay.imageResolution ?? "model_default",
        ...(replay.styleContext ? { styleContextOverride: replay.styleContext } : {}),
      });
    },
    [findOutputById, setUiNotice, submitTask]
  );
  const { insertOptimisticGenerationPlaceholder, removeOptimisticGenerationPlaceholder } =
    useAiStudioOptimisticPlaceholderActions({
      mode,
      selectedTool,
      aspect,
      model,
      setOutputs,
      setSaved,
    });

  const hydrateFromSessionSnapshot = useCallback(
    (snapshot: AiStudioSessionSnapshot): AiStudioSessionHydrationPayload => {
      const payload = buildAiStudioSessionHydrationPayload(snapshot);
      const workspace = payload.workspace;
      const outputPayload = payload.outputs;

      setMode(workspace.mode);
      setSelectedTool(workspace.selectedTool);
      setSharedPrompt(workspace.prompt);
      setModel(workspace.model);
      setAspect(workspace.aspect);
      setReferenceImageUrl(workspace.referenceImageUrl);
      workspace.extraImageUrls.forEach((url, index) => {
        setExtraImageUrl(index, url);
      });
      setEditReferenceText(workspace.editReferenceText);
      setVideoReferenceText(workspace.videoReferenceText);
      setVideoReferenceMode(workspace.videoReferenceMode);
      setVideoDurationSeconds(workspace.videoDurationSeconds);
      setVideoResolution(workspace.videoResolution);
      setImageResolution(workspace.imageResolution);
      setVideoGenerateAudio(workspace.videoGenerateAudio);
      setVideoCameraFixed(workspace.videoCameraFixed);
      setVideoAutoFix(workspace.videoAutoFix);
      setKlingNegativePrompt(workspace.klingNegativePrompt);
      setKlingCfgScale(workspace.klingCfgScale);
      setKlingShotType(workspace.klingShotType);
      setKlingVoiceIds(workspace.klingVoiceIds);
      setKlingMultiPrompts(workspace.klingMultiPrompts);
      setKlingElements(workspace.klingElements);
      setMotionReferenceVideoUrl(workspace.motionReferenceVideoUrl);

      setOutputsState(outputPayload.active);
      setArchivedOutputs(outputPayload.archived);
      setReferenceProjectionState({
        quickSlotIds: outputPayload.curatedReferenceIds,
        removedFromAllRefsIds: outputPayload.removedFromAllRefsIds,
      });
      setActiveOutputId(outputPayload.activeOutputId);
      setSaved(false);

      const signingRevision = sessionHydrationSigningRevisionRef.current + 1;
      sessionHydrationSigningRevisionRef.current = signingRevision;
      const activeBaselineById = buildSessionOutputSigningFingerprintById(outputPayload.active);
      const archivedBaselineById = buildSessionOutputSigningFingerprintById(outputPayload.archived);
      const hydrationOutputs = [...outputPayload.active, ...outputPayload.archived];
      void resolveSessionRestoreSignedUrls(hydrationOutputs)
        .then((signedByPath) => {
          if (sessionHydrationSigningRevisionRef.current !== signingRevision) return;
          if (signedByPath.size === 0) return;

          setOutputsState((rows) => {
            const patched = applySessionRestoreSignedUrls(rows, signedByPath, {
              baselineById: activeBaselineById,
            });
            return patched.changed ? patched.outputs : rows;
          });
          setArchivedOutputs((rows) => {
            const patched = applySessionRestoreSignedUrls(rows, signedByPath, {
              baselineById: archivedBaselineById,
            });
            return patched.changed ? patched.outputs : rows;
          });
        })
        .catch((error) => {
          addBreadcrumb({
            type: "ui",
            level: "warn",
            message: "ai_studio_session_restore_sign_batch_failed",
            data: {
              error: error instanceof Error ? error.message : "unknown_error",
            },
          });
        });

      return payload;
    },
    [
      setAspect,
      setEditReferenceText,
      setExtraImageUrl,
      setImageResolution,
      setKlingCfgScale,
      setKlingElements,
      setKlingMultiPrompts,
      setKlingNegativePrompt,
      setKlingShotType,
      setKlingVoiceIds,
      setMode,
      setModel,
      setMotionReferenceVideoUrl,
      setReferenceImageUrl,
      setSelectedTool,
      setSharedPrompt,
      setVideoAutoFix,
      setVideoCameraFixed,
      setVideoDurationSeconds,
      setVideoGenerateAudio,
      setVideoReferenceMode,
      setVideoReferenceText,
      setVideoResolution,
      setActiveOutputId,
      setSaved,
      setOutputsState,
      setArchivedOutputs,
      setReferenceProjectionState,
    ]
  );

  const buildSessionSnapshot = useCallback(
    ({
      sessionId,
      updatedAt,
      agentMessages,
      agentInput,
      latestAgentPrompt,
      promptOrigin,
      chatModeEnabled,
      canvasState,
    }: {
      sessionId: string;
      updatedAt?: string;
      agentMessages: AgentMessage[];
      agentInput: string;
      latestAgentPrompt: string | null;
      promptOrigin: "manual" | "agent" | "reference";
      chatModeEnabled: boolean;
      canvasState: AiStudioSessionCanvasState;
    }): AiStudioSessionSnapshotV2 =>
      buildAiStudioSessionSnapshot({
        sessionId,
        updatedAt,
        mode,
        selectedTool,
        prompt,
        model,
        aspect,
        referenceImageUrl,
        extraImageUrls,
        editReferenceText,
        videoReferenceText,
        videoReferenceMode,
        videoDurationSeconds,
        videoResolution,
        imageResolution,
        videoGenerateAudio,
        videoCameraFixed,
        videoAutoFix,
        klingNegativePrompt,
        klingCfgScale,
        klingShotType,
        klingVoiceIds,
        klingMultiPrompts,
        klingElements,
        motionReferenceVideoUrl,
        outputs,
        archivedOutputs,
        activeOutputId,
        curatedReferenceIds,
        removedFromAllRefsIds,
        agentMessages,
        agentInput,
        latestAgentPrompt,
        promptOrigin,
        chatModeEnabled,
        canvasState,
      }),
    [
      activeOutputId,
      archivedOutputs,
      aspect,
      curatedReferenceIds,
      editReferenceText,
      extraImageUrls,
      imageResolution,
      klingCfgScale,
      klingElements,
      klingMultiPrompts,
      klingNegativePrompt,
      klingShotType,
      klingVoiceIds,
      mode,
      model,
      motionReferenceVideoUrl,
      outputs,
      prompt,
      referenceImageUrl,
      removedFromAllRefsIds,
      selectedTool,
      videoAutoFix,
      videoCameraFixed,
      videoDurationSeconds,
      videoGenerateAudio,
      videoReferenceMode,
      videoReferenceText,
      videoResolution,
    ]
  );

  const {
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    getAgentContext,
  } = useAiStudioReferenceIngestionActions({
    mode,
    aspect,
    model,
    setOutputs,
    setSharedPrompt,
    setUiError,
  });

  const {
    selectActiveOutputs,
    selectArchivedOutputs,
    getOutputById,
    subscribeOutputs,
    getOutputSnapshot,
    selectOutputById,
  } = useAiStudioOutputStoreSelectors({
    outputs,
    archivedOutputs,
  });

  return {
    isPromptGenerating,
    isPrimaryEditStageGenerating,
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
    outputOrder: activeOutputState.order,
    outputById: activeOutputState.byId,
    setOutputs,
    resetReferenceGridState,
    curatedReferenceIds,
    removedFromAllRefsIds,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    clearCuratedReferences,
    archivedOutputs,
    archivedOutputOrder: archivedOutputState.order,
    archivedOutputById: archivedOutputState.byId,
    selectActiveOutputs,
    selectArchivedOutputs,
    selectOutputById,
    getOutputById,
    subscribeOutputs,
    getOutputSnapshot,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    saved,
    setSaved,
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
    expertEditLayerSessionState,
    setExpertEditLayerSessionState,
    setSharedPrompt,
    resolvePreviewUrlById,
    useReferenceImageIndicator,
    detailOutput,
    detailOutputId,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    modelModalPosition,
    generateOutput,
    regenerateOutput,
    rerollOutputFromReplay,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    buildSessionSnapshot,
    hydrateFromSessionSnapshot,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    archiveOlderOutputs,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    getDefaultDurationSeconds,
    getAgentContext,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
  };
};
