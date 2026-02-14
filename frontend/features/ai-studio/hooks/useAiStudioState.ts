/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { modelOptions } from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";
import type { ModelModalContext } from "../components/ModelModal";
import { DEFAULT_KLING_DURATION_SECONDS, getModelConfig } from "../logic/pricing";
import type { AgentContext, AgentMediaPreview, AgentReferenceSummary } from "../../ai-agent/types";
import {
  Provider,
  computeModalPosition,
  isVideoUrl,
  resolvePreviewUrlById,
  resolveModelLabel,
  mapUploadsFromFiles,
} from "../logic/stateParsers";
import { logMediaEvent, updateGenerationRecord } from "../logic/mediaLibraryPersistence";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioTaskSubmission } from "./useAiStudioTaskSubmission";
import { useAiStudioTasks } from "./useAiStudioTasks";
import { useAiStudioStateEffects } from "./useAiStudioStateEffects";
import { normalizeErrorText } from "../../../lib/errorText";
import {
  buildImageReferenceInputs,
  buildRegenerateReferencePool,
  buildVideoReferenceInputs,
} from "../logic/referenceInputs";
import { evaluateStaleOutputCleanup, type OutputLifecycleMap } from "../logic/staleOutputCleanup";

const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS; // current general fallback (10s)
const STALE_LOADING_TIMEOUT_MS = 3 * 60 * 1000;
const AUTO_FAILED_OUTPUT_REMOVAL_MS = 2 * 60 * 1000;
const STALE_OUTPUT_SWEEP_INTERVAL_MS = 15_000;

type ModelModalPosition = { top: number; left: number };
type PendingAutoSave = {
  taskId: string;
  provider: Provider;
  resultUrls: string[];
};
type WorkflowSettingsKey = "create" | "edit" | "video" | "kling";
type VideoReferenceMode = "standard" | "keyframes" | "kling3" | "motion";
type KlingShotType = "customize" | "intelligent";
type KlingPromptShot = { id: string; prompt: string; duration: number };
type KlingElement = {
  id: string;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
};
type GenerateSubmissionOverrides = {
  submissionPromptOverride?: string | null;
  displayPromptOverride?: string | null;
  referenceInputsOverride?: string[];
  characterContextOverride?: StudioOutput["characterContext"];
};
type WorkflowSettingsSnapshot = {
  mode: StudioMode;
  model: string | null;
  aspect: string;
  imageResolution: string;
  videoReferenceMode: VideoReferenceMode;
  videoDurationSeconds: number;
  videoResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingShotType: KlingShotType;
  klingVoiceIds: [string, string];
  klingMultiPrompts: KlingPromptShot[];
  klingElements: KlingElement[];
};

const WORKFLOW_SETTINGS_SESSION_KEY = "aiStudioWorkflowSettingsByTool.v1";
const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettingsSnapshot = {
  mode: "image",
  model: null,
  aspect: "9:16",
  imageResolution: "model_default",
  videoReferenceMode: "standard",
  videoDurationSeconds: 6,
  videoResolution: "1080p",
  videoGenerateAudio: false,
  videoCameraFixed: false,
  videoAutoFix: false,
  klingNegativePrompt: "blur, distort, and low quality",
  klingCfgScale: 0.5,
  klingShotType: "customize",
  klingVoiceIds: ["", ""],
  klingMultiPrompts: [],
  klingElements: [{ id: randomId(), frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" }],
};

const resolveWorkflowSettingsKey = (tool: ToolId | null): WorkflowSettingsKey | null => {
  if (tool === "create" || tool === "text") return "create";
  if (tool === "edit" || tool === "image") return "edit";
  if (tool === "video") return "video";
  if (tool === "kling") return "kling";
  return null;
};

const cloneWorkflowSettingsSnapshot = (
  snapshot: Partial<WorkflowSettingsSnapshot> | null | undefined
): WorkflowSettingsSnapshot => ({
  mode:
    snapshot?.mode === "image" || snapshot?.mode === "text" || snapshot?.mode === "video"
      ? snapshot.mode
      : DEFAULT_WORKFLOW_SETTINGS.mode,
  model:
    typeof snapshot?.model === "string" || snapshot?.model === null
      ? snapshot.model
      : DEFAULT_WORKFLOW_SETTINGS.model,
  aspect: typeof snapshot?.aspect === "string" ? snapshot.aspect : DEFAULT_WORKFLOW_SETTINGS.aspect,
  imageResolution:
    typeof snapshot?.imageResolution === "string"
      ? snapshot.imageResolution
      : DEFAULT_WORKFLOW_SETTINGS.imageResolution,
  videoReferenceMode:
    snapshot?.videoReferenceMode === "standard" ||
    snapshot?.videoReferenceMode === "keyframes" ||
    snapshot?.videoReferenceMode === "kling3" ||
    snapshot?.videoReferenceMode === "motion"
      ? snapshot.videoReferenceMode
      : DEFAULT_WORKFLOW_SETTINGS.videoReferenceMode,
  videoDurationSeconds:
    typeof snapshot?.videoDurationSeconds === "number" &&
    Number.isFinite(snapshot.videoDurationSeconds)
      ? snapshot.videoDurationSeconds
      : DEFAULT_WORKFLOW_SETTINGS.videoDurationSeconds,
  videoResolution:
    typeof snapshot?.videoResolution === "string"
      ? snapshot.videoResolution
      : DEFAULT_WORKFLOW_SETTINGS.videoResolution,
  videoGenerateAudio:
    typeof snapshot?.videoGenerateAudio === "boolean"
      ? snapshot.videoGenerateAudio
      : DEFAULT_WORKFLOW_SETTINGS.videoGenerateAudio,
  videoCameraFixed:
    typeof snapshot?.videoCameraFixed === "boolean"
      ? snapshot.videoCameraFixed
      : DEFAULT_WORKFLOW_SETTINGS.videoCameraFixed,
  videoAutoFix:
    typeof snapshot?.videoAutoFix === "boolean"
      ? snapshot.videoAutoFix
      : DEFAULT_WORKFLOW_SETTINGS.videoAutoFix,
  klingNegativePrompt:
    typeof snapshot?.klingNegativePrompt === "string"
      ? snapshot.klingNegativePrompt
      : DEFAULT_WORKFLOW_SETTINGS.klingNegativePrompt,
  klingCfgScale:
    typeof snapshot?.klingCfgScale === "number" && Number.isFinite(snapshot.klingCfgScale)
      ? snapshot.klingCfgScale
      : DEFAULT_WORKFLOW_SETTINGS.klingCfgScale,
  klingShotType:
    snapshot?.klingShotType === "intelligent" || snapshot?.klingShotType === "customize"
      ? snapshot.klingShotType
      : DEFAULT_WORKFLOW_SETTINGS.klingShotType,
  klingVoiceIds: [
    Array.isArray(snapshot?.klingVoiceIds) ? String(snapshot?.klingVoiceIds?.[0] ?? "") : "",
    Array.isArray(snapshot?.klingVoiceIds) ? String(snapshot?.klingVoiceIds?.[1] ?? "") : "",
  ],
  klingMultiPrompts: Array.isArray(snapshot?.klingMultiPrompts)
    ? snapshot.klingMultiPrompts
        .map((shot) => ({
          id: typeof shot?.id === "string" ? shot.id : randomId(),
          prompt: typeof shot?.prompt === "string" ? shot.prompt : "",
          duration:
            typeof shot?.duration === "number" && Number.isFinite(shot.duration)
              ? shot.duration
              : 6,
        }))
        .filter((shot) => Boolean(shot.id))
    : [],
  klingElements: Array.isArray(snapshot?.klingElements)
    ? snapshot.klingElements
        .map((element) => ({
          id: typeof element?.id === "string" ? element.id : randomId(),
          frontalImageUrl:
            typeof element?.frontalImageUrl === "string" ? element.frontalImageUrl : "",
          referenceImageUrls:
            typeof element?.referenceImageUrls === "string" ? element.referenceImageUrls : "",
          videoUrl: typeof element?.videoUrl === "string" ? element.videoUrl : "",
        }))
        .filter((element) => Boolean(element.id))
    : DEFAULT_WORKFLOW_SETTINGS.klingElements.map((element) => ({ ...element })),
});

/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
export const useAiStudioState = () => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [editReferenceText, setEditReferenceTextState] = useState<string>("");
  const [videoReferenceText, setVideoReferenceTextState] = useState<string>("");

  // Output management
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const outputsRef = useRef<StudioOutput[]>([]);
  const pendingAutoSavesRef = useRef<Record<string, PendingAutoSave>>({});
  const staleOutputLifecycleRef = useRef<OutputLifecycleMap>({});

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  // UI selections and references (tracked per workflow)
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [showCreateTools, setShowCreateTools] = useState<boolean>(false);
  const [imageReferenceImageUrl, setImageReferenceImageUrl] = useState<string | null>(null);
  const [imageExtraImageUrls, setImageExtraImageUrls] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
  const [videoReferenceImageUrl, setVideoReferenceImageUrl] = useState<string | null>(null);
  const [videoExtraImageUrls, setVideoExtraImageUrls] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
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
  const [motionReferenceVideoUrl, setMotionReferenceVideoUrl] = useState<string | null>(null);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [modelModalAnchor, setModelModalAnchor] = useState<string | null>(null);
  const [modelModalContext, setModelModalContext] = useState<ModelModalContext | null>(null);
  const [modelModalPosition, setModelModalPosition] = useState<ModelModalPosition | null>(null);
  const [isPromptGenerating, setIsPromptGenerating] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const lastVideoReferenceModeRef = useRef(videoReferenceMode);
  const lastNonKling3VideoModelRef = useRef<string | null>(null);
  const lastNonKeyframesVideoModelRef = useRef<string | null>(null);
  const lastNonMotionVideoModelRef = useRef<string | null>(null);
  const [workflowSettingsHydrated, setWorkflowSettingsHydrated] = useState<boolean>(false);
  const workflowSettingsRef = useRef<
    Partial<Record<WorkflowSettingsKey, WorkflowSettingsSnapshot>>
  >({});
  const previousWorkflowSettingsKeyRef = useRef<WorkflowSettingsKey | null>(null);
  const activeWorkflowSettingsKey = useMemo(
    () => resolveWorkflowSettingsKey(selectedTool),
    [selectedTool]
  );
  const hasPendingWorkflowRestore =
    workflowSettingsHydrated &&
    Boolean(activeWorkflowSettingsKey) &&
    previousWorkflowSettingsKeyRef.current !== activeWorkflowSettingsKey;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        Record<WorkflowSettingsKey, Partial<WorkflowSettingsSnapshot>>
      >;
      const next: Partial<Record<WorkflowSettingsKey, WorkflowSettingsSnapshot>> = {};
      (["create", "edit", "video", "kling"] as const).forEach((key) => {
        next[key] = cloneWorkflowSettingsSnapshot(parsed?.[key]);
      });
      workflowSettingsRef.current = next;
    } catch {
      workflowSettingsRef.current = {};
    } finally {
      setWorkflowSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!workflowSettingsHydrated) return;
    if (!activeWorkflowSettingsKey) {
      previousWorkflowSettingsKeyRef.current = null;
      return;
    }

    const previous = previousWorkflowSettingsKeyRef.current;
    previousWorkflowSettingsKeyRef.current = activeWorkflowSettingsKey;
    if (previous === activeWorkflowSettingsKey) return;

    let snapshot = workflowSettingsRef.current[activeWorkflowSettingsKey];
    if (!snapshot) {
      snapshot = cloneWorkflowSettingsSnapshot(DEFAULT_WORKFLOW_SETTINGS);
      workflowSettingsRef.current[activeWorkflowSettingsKey] = snapshot;
    }

    if (activeWorkflowSettingsKey === "create") {
      setMode(snapshot.mode);
    }
    setModelState(snapshot.model);
    setAspect(snapshot.aspect);
    setImageResolution(snapshot.imageResolution);
    setVideoReferenceMode(snapshot.videoReferenceMode);
    setVideoDurationSeconds(snapshot.videoDurationSeconds);
    setVideoResolution(snapshot.videoResolution);
    setVideoGenerateAudio(snapshot.videoGenerateAudio);
    setVideoCameraFixed(snapshot.videoCameraFixed);
    setVideoAutoFix(snapshot.videoAutoFix);
    setKlingNegativePrompt(snapshot.klingNegativePrompt);
    setKlingCfgScale(snapshot.klingCfgScale);
    setKlingShotType(snapshot.klingShotType);
    setKlingVoiceIds([...snapshot.klingVoiceIds] as [string, string]);
    setKlingMultiPrompts(snapshot.klingMultiPrompts.map((shot) => ({ ...shot })));
    setKlingElements(snapshot.klingElements.map((element) => ({ ...element })));
  }, [activeWorkflowSettingsKey, workflowSettingsHydrated]);

  useEffect(() => {
    if (!workflowSettingsHydrated) return;
    if (!activeWorkflowSettingsKey) return;
    if (hasPendingWorkflowRestore) return;
    const snapshot: WorkflowSettingsSnapshot = {
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
      klingVoiceIds: [...klingVoiceIds] as [string, string],
      klingMultiPrompts: klingMultiPrompts.map((shot) => ({ ...shot })),
      klingElements: klingElements.map((element) => ({ ...element })),
    };
    workflowSettingsRef.current[activeWorkflowSettingsKey] = snapshot;
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify(workflowSettingsRef.current)
    );
  }, [
    activeWorkflowSettingsKey,
    aspect,
    imageResolution,
    klingCfgScale,
    klingElements,
    klingMultiPrompts,
    klingNegativePrompt,
    klingShotType,
    klingVoiceIds,
    mode,
    model,
    videoAutoFix,
    videoCameraFixed,
    videoDurationSeconds,
    videoGenerateAudio,
    videoReferenceMode,
    videoResolution,
    workflowSettingsHydrated,
    hasPendingWorkflowRestore,
  ]);

  const activeOutput = useMemo(
    () => outputs.find((item) => item.id === activeOutputId) ?? null,
    [activeOutputId, outputs]
  );
  const detailOutput = useMemo(
    () => outputs.find((item) => item.id === detailOutputId) ?? null,
    [detailOutputId, outputs]
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
  const isVideoReferenceTool = selectedTool === "video" || selectedTool === "kling";
  const referenceImageUrl = isVideoReferenceTool ? videoReferenceImageUrl : imageReferenceImageUrl;
  const extraImageUrls = isVideoReferenceTool ? videoExtraImageUrls : imageExtraImageUrls;

  const allowedModelOptions = useMemo(() => {
    if (selectedTool === "video" || selectedTool === "kling") {
      const isKeyframesMode = videoReferenceMode === "keyframes";
      const isMotionMode = videoReferenceMode === "motion";
      const isKling3Mode = videoReferenceMode === "kling3";
      return modelOptions.filter((opt) => {
        // In keyframes mode, only show Veo 3.1 First/Last Frame.
        if (isKeyframesMode) {
          return opt.value === "fal-ai/veo3.1/first-last-frame-to-video";
        }
        // In motion mode, only show Kling 3.0 Image-to-Video.
        if (isMotionMode) {
          return opt.value === "fal-ai/kling-video/v3/pro/image-to-video";
        }
        // Dedicated Kling mode only allows Kling 3.0 image-to-video.
        if (selectedTool === "kling" || isKling3Mode) {
          return opt.value === "fal-ai/kling-video/v3/pro/image-to-video";
        }
        // Standard video mode intentionally supports image-to-video only.
        return opt.mediaType === "image-to-video" && !opt.value.includes("kling-video");
      });
    }
    if ((selectedTool === "create" || selectedTool === "text") && mode === "video") {
      return modelOptions.filter(
        (opt) => !opt.mediaType || opt.mediaType === "video" || opt.mediaType === "multi"
      );
    }
    if ((selectedTool === "create" || selectedTool === "text") && mode === "image") {
      return modelOptions.filter((opt) => {
        const matchesMedia =
          !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsTextToImage);
      });
    }
    if (selectedTool === "image" || selectedTool === "edit") {
      return modelOptions.filter((opt) => {
        const matchesMedia =
          !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsImageToImage);
      });
    }
    return modelOptions;
  }, [mode, selectedTool, videoReferenceMode]);

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
    allowedModelValues: allowedModelOptions.map((option) => option.value),
    isModelModalOpen,
    modelModalAnchor,
    setDetailOutputId,
    setIsModelModalOpen,
    setModelModalAnchor,
    setModelModalPosition,
    hasPendingWorkflowRestore,
  });

  // --- Output + prompt actions -------------------------------------------
  const updateOutputById = useCallback(
    (id: string, updater: (item: StudioOutput) => StudioOutput) => {
      setOutputs((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
    },
    []
  );

  const sweepStaleOutputs = useCallback(() => {
    const now = Date.now();
    const lifecycle = staleOutputLifecycleRef.current;
    const outputsSnapshot = outputsRef.current;
    const cleanup = evaluateStaleOutputCleanup(outputsSnapshot, lifecycle, now, {
      loadingTimeoutMs: STALE_LOADING_TIMEOUT_MS,
      autoFailedRetentionMs: AUTO_FAILED_OUTPUT_REMOVAL_MS,
    });
    const staleLoadingSet = new Set(cleanup.staleLoadingIds);
    const removableSet = new Set(cleanup.removableIds);

    staleLoadingSet.forEach((id) => {
      const existing = cleanup.nextLifecycle[id] ?? {};
      cleanup.nextLifecycle[id] = {
        ...existing,
        autoFailedAtMs: now,
      };
      delete cleanup.nextLifecycle[id].pendingSinceMs;
    });

    staleOutputLifecycleRef.current = cleanup.nextLifecycle;

    if (!staleLoadingSet.size && !removableSet.size) return;

    setOutputs((prev) => {
      let changed = false;
      const next: StudioOutput[] = [];

      prev.forEach((item) => {
        if (removableSet.has(item.id)) {
          changed = true;
          return;
        }
        if (!staleLoadingSet.has(item.id)) {
          next.push(item);
          return;
        }
        changed = true;
        next.push({
          ...item,
          status: "ready",
          taskState: "fail",
          timestamp: "Timed out",
          errorMessage: "Generation timed out before preview was ready.",
          errorMessageShort: "Generation timed out.",
          errorDetail:
            "This preview remained unresolved for several minutes and was marked as failed.",
        });
      });

      return changed ? next : prev;
    });

    if (removableSet.size) {
      setActiveOutputId((prev) => (prev && removableSet.has(prev) ? null : prev));
      removableSet.forEach((id) => {
        delete pendingAutoSavesRef.current[id];
      });
    }
  }, [setActiveOutputId, setOutputs]);

  useEffect(() => {
    sweepStaleOutputs();
  }, [outputs, sweepStaleOutputs]);

  useEffect(() => {
    const timeoutId = window.setInterval(sweepStaleOutputs, STALE_OUTPUT_SWEEP_INTERVAL_MS);
    return () => window.clearInterval(timeoutId);
  }, [sweepStaleOutputs]);

  const findOutputById = useCallback(
    (id: string) => outputsRef.current.find((item) => item.id === id) ?? null,
    []
  );

  const {
    markOutputSaved,
    markOutputSaveFailed,
    ensureGenerationRecord,
    persistMediaUrls,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
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

  const deleteOutput = useCallback(
    (id: string) => {
      delete pendingAutoSavesRef.current[id];
      delete staleOutputLifecycleRef.current[id];
      setOutputs((prev) => prev.filter((item) => item.id !== id));
      if (activeOutputId === id) {
        setActiveOutputId(null);
      }
    },
    [activeOutputId]
  );

  const notifyGenerationFailure = useCallback(
    (outputId: string, message: string, detail?: string) => {
      delete pendingAutoSavesRef.current[outputId];
      const safeMessage = normalizeErrorText(message, {
        fallback: "Generation failed",
        maxLength: 140,
      });
      const safeDetail = normalizeErrorText(detail ?? message, {
        fallback: safeMessage,
        maxLength: 320,
      });
      let contextLabel: string | null = null;
      setOutputs((prev) =>
        prev.map((item) => {
          if (item.id !== outputId) return item;
          contextLabel = item.model ?? item.modelId ?? "Generation";
          return {
            ...item,
            taskState: "fail",
            status: "ready",
            timestamp: "Failed",
            errorMessage: safeMessage,
            errorMessageShort: safeMessage,
            errorDetail: safeDetail,
          };
        })
      );
      const label = contextLabel ?? "Generation";
      const detailMessage = safeDetail;
      setUiError(
        detailMessage ? `${label} failed: ${detailMessage}` : `${label} failed to complete.`
      );
    },
    [setOutputs, setUiError]
  );

  const finalizeDeferredAutoSave = useCallback(
    async (outputId: string) => {
      const pending = pendingAutoSavesRef.current[outputId];
      if (!pending) return;
      delete pendingAutoSavesRef.current[outputId];

      const output = findOutputById(outputId);
      if (!output || output.savedMediaIds?.length) return;

      const urls = pending.resultUrls.filter(Boolean);
      if (!urls.length) return;

      const generationId =
        output.generationId ??
        (await ensureGenerationRecord({
          outputId,
          provider: pending.provider,
          taskId: pending.taskId,
        }));

      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: "saving",
        saveError: null,
      }));
      const { mediaFileIds, errors } = await persistMediaUrls({
        outputId,
        urls,
        provider: pending.provider,
        source: "ai_studio",
        generationId: generationId ?? null,
      });
      if (mediaFileIds.length) {
        markOutputSaved(outputId, mediaFileIds, { showPill: true });
      } else if (errors.length) {
        const message = errors[0] ?? "Unable to save media.";
        markOutputSaveFailed(outputId, message, { showPill: true });
      }
      if (generationId) {
        try {
          await updateGenerationRecord(generationId, {
            provider: pending.provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            requestId: pending.taskId,
            status: "success",
            metadata: {
              result_urls: urls,
              media_file_ids: mediaFileIds,
            },
          });
        } catch {
          // best-effort update
        }
      }
    },
    [
      ensureGenerationRecord,
      findOutputById,
      markOutputSaveFailed,
      markOutputSaved,
      persistMediaUrls,
      updateOutputById,
    ]
  );

  const handleGenerationSuccess = useCallback(
    ({
      outputId,
      taskId,
      provider,
      resultUrls,
    }: {
      outputId: string;
      taskId: string;
      provider: Provider;
      resultUrls: string[];
    }) => {
      const output = findOutputById(outputId);
      if (!output) return;
      if (output.savedMediaIds?.length) return;
      const urls = resultUrls.filter(Boolean);
      if (!urls.length) return;
      pendingAutoSavesRef.current[outputId] = {
        taskId,
        provider,
        resultUrls: urls,
      };
    },
    [findOutputById]
  );

  const handleGenerationFailure = useCallback(
    async ({
      outputId,
      taskId,
      provider,
      message,
      reasonCode,
    }: {
      outputId: string;
      taskId?: string;
      provider: Provider;
      message: string;
      reasonCode?:
        | "no_media_after_terminal_success"
        | "poll_timeout"
        | "provider_error"
        | "status_poll_error";
    }) => {
      delete pendingAutoSavesRef.current[outputId];
      const output = findOutputById(outputId);
      if (!output) return;
      const generationId =
        output.generationId ??
        (await ensureGenerationRecord({
          outputId,
          provider,
          taskId,
        }));
      if (generationId) {
        try {
          await updateGenerationRecord(generationId, {
            provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            requestId: taskId ?? output.taskId,
            status: "fail",
            metadata: {
              error: message,
              failure_reason_code: reasonCode ?? null,
            },
          });
          await logMediaEvent({
            eventType: "generation_failed",
            entityType: "ai_generation",
            entityId: generationId,
            metadata: {
              error: message,
              provider,
              model_id: output.modelId ?? output.model,
              failure_reason_code: reasonCode ?? null,
            },
          });
        } catch {
          // best-effort updates
        }
      }
    },
    [ensureGenerationRecord, findOutputById]
  );

  const onReferenceOutputMediaLoaded = useCallback(
    (outputId: string) => {
      void finalizeDeferredAutoSave(outputId);
    },
    [finalizeDeferredAutoSave]
  );

  const { startPollingTask, clearPollTimer } = useAiStudioTasks({
    updateOutputById,
    notifyGenerationFailure,
    onGenerationSuccess: handleGenerationSuccess,
    onGenerationFailure: handleGenerationFailure,
  });

  const retryOutputStatus = useCallback(
    (outputId: string) => {
      const output = findOutputById(outputId);
      if (!output) return;
      const taskId = output.taskId?.trim();
      if (!taskId) {
        setUiNotice("Unable to retry status because this generation has no task id.");
        return;
      }
      const provider = (output.provider as Provider | undefined) ?? "kei";
      updateOutputById(outputId, (item) => ({
        ...item,
        taskState: "running",
        status: "ready",
        timestamp: "Retrying status...",
        errorMessage: null,
        errorMessageShort: null,
        errorDetail: null,
      }));
      clearPollTimer(outputId);
      startPollingTask(taskId, outputId, 0, provider);
    },
    [clearPollTimer, findOutputById, setUiNotice, startPollingTask, updateOutputById]
  );

  const updateOutputPrompt = useCallback(
    (id: string, promptText: string) => {
      const nextPrompt = promptText.trim();
      if (!nextPrompt) return;
      updateOutputById(id, (item) => ({
        ...item,
        prompt: nextPrompt,
        previewText: item.previewText ? nextPrompt : item.previewText,
        timestamp: "Edited",
      }));
    },
    [updateOutputById]
  );

  const submitTask = useAiStudioTaskSubmission({
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
    startPollingTask,
    ensureGenerationRecord,
  });
  const resolveReferenceInputsForTool = useCallback(
    (tool: ToolId | null) => {
      if (tool === "video" || tool === "kling") {
        return {
          referenceImageUrl: videoReferenceImageUrl,
          extraImageUrls: videoExtraImageUrls,
        };
      }
      return {
        referenceImageUrl: imageReferenceImageUrl,
        extraImageUrls: imageExtraImageUrls,
      };
    },
    [imageExtraImageUrls, imageReferenceImageUrl, videoExtraImageUrls, videoReferenceImageUrl]
  );

  const generateOutput = useCallback(
    (
      promptOverride?: string | null,
      options?: {
        modeOverride?: StudioMode;
        selectedToolOverride?: ToolId | null;
      } & GenerateSubmissionOverrides
    ) => {
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const referencePromptForTool =
        effectiveTool === "video" || effectiveTool === "kling"
          ? videoReferenceText
          : editReferenceText;
      const defaultPromptForTool =
        effectiveTool === "image" ||
        effectiveTool === "edit" ||
        effectiveTool === "video" ||
        effectiveTool === "kling"
          ? referencePromptForTool
          : prompt;
      const displayPromptToSubmit =
        typeof options?.displayPromptOverride === "string"
          ? options.displayPromptOverride
          : typeof promptOverride === "string"
            ? promptOverride
            : defaultPromptForTool;
      const submissionPromptToSubmit =
        typeof options?.submissionPromptOverride === "string"
          ? options.submissionPromptOverride
          : displayPromptToSubmit;
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } =
        resolveReferenceInputsForTool(effectiveTool);
      const isVideoGenerationTool = effectiveTool === "video" || effectiveTool === "kling";
      const baseInputs =
        effectiveTool === "image" || effectiveTool === "edit"
          ? buildImageReferenceInputs(referenceUrl, extraUrls)
          : isVideoGenerationTool
            ? buildVideoReferenceInputs(referenceUrl, extraUrls, videoReferenceMode)
            : [referenceUrl, ...extraUrls].filter((url): url is string => Boolean(url));
      const imageInputs = (
        Array.isArray(options?.referenceInputsOverride)
          ? options.referenceInputsOverride
          : baseInputs
      ).slice(0, 8);
      submitTask(submissionPromptToSubmit, imageInputs, {
        modeOverride: options?.modeOverride,
        selectedToolOverride: options?.selectedToolOverride,
        displayPromptOverride: displayPromptToSubmit,
        characterContextOverride: options?.characterContextOverride,
      });
    },
    [
      editReferenceText,
      prompt,
      resolveReferenceInputsForTool,
      selectedTool,
      submitTask,
      videoReferenceMode,
      videoReferenceText,
    ]
  );

  const regenerateOutput = useCallback(
    (options?: GenerateSubmissionOverrides) => {
      const referencePromptForTool =
        selectedTool === "video" || selectedTool === "kling"
          ? videoReferenceText
          : editReferenceText;
      const promptForTool =
        selectedTool === "image" ||
        selectedTool === "edit" ||
        selectedTool === "video" ||
        selectedTool === "kling"
          ? referencePromptForTool
          : prompt;
      const displayPromptToUse =
        typeof options?.displayPromptOverride === "string"
          ? options.displayPromptOverride.trim()
          : promptForTool.trim();
      const submissionPromptToUse =
        typeof options?.submissionPromptOverride === "string"
          ? options.submissionPromptOverride.trim()
          : displayPromptToUse;
      if (!submissionPromptToUse) {
        setUiError("Add a prompt to start a generation.");
        return;
      }
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } =
        resolveReferenceInputsForTool(selectedTool);
      const referencePool = buildRegenerateReferencePool({
        selectedTool,
        useReferenceImageIndicator,
        activeOutputPreviewUrl: activeOutput?.previewUrl,
        referenceUrl,
        extraUrls,
        videoReferenceMode,
      });
      const imageInputs = (
        Array.isArray(options?.referenceInputsOverride)
          ? options.referenceInputsOverride
          : referencePool
      ).slice(0, 8);
      submitTask(submissionPromptToUse, imageInputs, {
        displayPromptOverride: displayPromptToUse,
        characterContextOverride: options?.characterContextOverride,
      });
    },
    [
      activeOutput,
      editReferenceText,
      prompt,
      resolveReferenceInputsForTool,
      selectedTool,
      setUiError,
      submitTask,
      useReferenceImageIndicator,
      videoReferenceMode,
      videoReferenceText,
    ]
  );

  const addAgentPromptReference = useCallback(
    (promptText: string, title?: string | null) => {
      void title;
      const cleanedPrompt = promptText?.trim();
      if (!cleanedPrompt) return;
      const id = `prompt-${randomId()}`;
      const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
      const promptReference: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: "text",
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "ready",
        timestamp: "Agent",
        // Always show the actual prompt text on the reference card.
        previewText: cleanedPrompt,
        saveState: "idle",
        saveError: null,
      };
      setOutputs((prev) => [promptReference, ...prev]);
      setSharedPrompt(cleanedPrompt);
    },
    [aspect, model, setSharedPrompt]
  );

  const addLibraryMediaReference = useCallback(
    (payload: {
      id: string;
      url: string;
      fileType: "image" | "video";
      filename?: string | null;
      source?: string | null;
    }) => {
      if (!payload.url) return;
      const id = `library-${randomId()}`;
      const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
      const nextOutput: StudioOutput = {
        id,
        prompt: payload.filename ?? "Media reference",
        mode: payload.fileType === "video" ? "video" : "image",
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "ready",
        timestamp: payload.source === "ai_studio" ? "Generation" : "Library",
        previewUrl: payload.url,
        saveState: "idle",
        saveError: null,
        savedMediaIds: payload.id ? [payload.id] : undefined,
      };
      setOutputs((prev) => [nextOutput, ...prev]);
    },
    [aspect, model]
  );

  const addLibraryPromptReference = useCallback(
    (payload: { id: string; promptText: string; title?: string | null }) => {
      const cleanedPrompt = payload.promptText?.trim();
      if (!cleanedPrompt) return;
      const id = `prompt-library-${randomId()}`;
      const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
      const promptReference: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: "text",
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "saved",
        timestamp: "Library",
        previewText: cleanedPrompt,
        saveState: "idle",
        saveError: null,
        promptId: payload.id,
      };
      setOutputs((prev) => [promptReference, ...prev]);
    },
    [aspect, model]
  );

  const addOutputsFromFiles = useCallback(
    async (files: FileList) => {
      const newEntries = await mapUploadsFromFiles(
        files,
        mode,
        aspect,
        model,
        resolveModelLabel,
        randomId
      );
      if (!newEntries.length) return;
      setOutputs((prev) => [...newEntries, ...prev]);
    },
    [aspect, model, mode]
  );

  const toggleReferenceIndicator = useCallback(() => {
    if (!activeOutput?.previewUrl) return;
    setUseReferenceImageIndicator((prev) => !prev);
  }, [activeOutput?.previewUrl]);

  const clearReferenceImages = useCallback(() => {
    setImageReferenceImageUrl(null);
    setImageExtraImageUrls([null, null, null]);
    setVideoReferenceImageUrl(null);
    setVideoExtraImageUrls([null, null, null]);
    setMotionReferenceVideoUrl(null);
  }, []);

  const setReferenceImageUrl = useCallback(
    (url: string | null) => {
      if (isVideoReferenceTool) {
        setVideoReferenceImageUrl(url);
      } else {
        setImageReferenceImageUrl(url);
      }
    },
    [isVideoReferenceTool]
  );

  const setExtraImageUrl = useCallback(
    (index: number, url: string | null) => {
      if (isVideoReferenceTool) {
        setVideoExtraImageUrls((prev) => {
          const next: [string | null, string | null, string | null] = [...prev];
          next[index] = url;
          return next;
        });
        return;
      }
      setImageExtraImageUrls((prev) => {
        const next: [string | null, string | null, string | null] = [...prev];
        next[index] = url;
        return next;
      });
    },
    [isVideoReferenceTool]
  );

  const getAgentContext = useCallback(
    (options?: {
      lastAssistantMessage?: string | null;
      selectedOverride?: StudioOutput | null;
      modeHint?: "chat" | "text" | "describe" | "reference";
    }): AgentContext => {
      const selected = options?.selectedOverride ?? activeOutput ?? null;
      const selectedReferenceIds = selected ? [selected.id] : [];

      // Default fallback: rely on the latest assistant output.
      let focusedSource: AgentContext["focusedSource"] = "agent-output";
      let focusedReferenceId: string | null = null;
      let media: AgentMediaPreview[] = [];
      let references: AgentReferenceSummary[] = [];
      let activePromptValue: string | null = null;

      if (selected) {
        focusedReferenceId = selected.id;
        const hasImage = selected.previewUrl && !isVideoUrl(selected.previewUrl);
        if (hasImage) {
          // Vision-first: supply the selected image for description; keep prompt metadata secondary.
          focusedSource = "image";
          media = [
            {
              id: selected.id,
              kind: "image",
              url: selected.previewUrl as string,
              thumbnailAlt: selected.prompt ?? selected.previewText ?? null,
            },
          ];
          references = [
            {
              id: selected.id,
              kind: "prompt",
              promptSnippet: selected.prompt ?? selected.previewText ?? null,
              aspect: selected.aspect ?? null,
              caption: selected.previewText ?? null,
            },
          ];
        } else {
          // Prompt-selected (includes video cards; we read prompt text, no media).
          focusedSource = "prompt";
          const promptSnippet = selected.prompt ?? selected.previewText ?? null;
          activePromptValue = promptSnippet;
          references = promptSnippet
            ? [
                {
                  id: selected.id,
                  kind: "prompt",
                  promptSnippet,
                  aspect: selected.aspect ?? null,
                  caption: selected.previewText ?? null,
                },
              ]
            : [];
        }
      } else {
        // No selection: use the last assistant chat message if provided.
        activePromptValue = options?.lastAssistantMessage ?? null;
      }

      return {
        activePrompt: activePromptValue,
        modelId: model,
        mode,
        references,
        media,
        selectedReferenceIds,
        focusedSource,
        focusedReferenceId,
        lastAssistantMessage: options?.lastAssistantMessage ?? null,
        modeHint: options?.modeHint ?? undefined,
      };
    },
    [activeOutput, model, mode]
  );

  const openModelModal = useCallback(
    (anchorId: string, target: HTMLElement, context: ModelModalContext | null = null) => {
      setModelModalAnchor(anchorId);
      setModelModalContext(context);
      setModelModalPosition(computeModalPosition(target));
      setIsModelModalOpen(true);
    },
    []
  );

  const closeModelModal = useCallback(() => {
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
    setModelModalContext(null);
  }, []);

  return {
    isPromptGenerating,
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
    setOutputs,
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
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    addAgentPromptReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
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
  };
};
