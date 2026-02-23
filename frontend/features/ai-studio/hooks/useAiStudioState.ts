/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { modelOptions } from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";
import { DEFAULT_KLING_DURATION_SECONDS, getModelConfig } from "../logic/pricing";
import type { AgentContext } from "../../ai-agent/types";
import { resolvePreviewUrlById, resolveModelLabel } from "../logic/stateParsers";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioGenerationPromptComposer } from "./useAiStudioGenerationPromptComposer";
import { useAiStudioReferenceSelectionState } from "./useAiStudioReferenceSelectionState";
import { useAiStudioTaskOrchestration } from "./useAiStudioTaskOrchestration";
import { useAiStudioWorkflowSettings } from "./useAiStudioWorkflowSettings";
import { useAiStudioStateEffects } from "./useAiStudioStateEffects";
import {
  getAiStudioOutputById,
  getAiStudioOutputSnapshot,
  setAiStudioOutputStoreSnapshot,
  subscribeAiStudioOutputs,
  type AiStudioOutputStoreSnapshot,
} from "./aiStudioOutputStore";
import { logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import {
  pruneCuratedReferenceIds,
  syncCuratedPinnedOutputsByOrder,
} from "../logic/curatedReferences";
import {
  addQuickSlotReference,
  applyAllRefsSuppressionCompatibility,
  clearQuickSlotReferences,
  createEmptyReferenceProjectionState,
  markReferenceRemovedFromAllRefs,
  pruneReferenceProjectionState,
  removeQuickSlotReference,
  reorderQuickSlotReference,
  shouldFinalizeRemovalOnQuickSlotDetach,
  type ReferenceProjectionState,
} from "../reference-projections";
import { buildAiStudioAgentContext } from "./stateAdapters/agentContextAdapter";
import {
  buildStudioOutputsFromReferenceInput,
  buildStudioOutputsFromReferenceInputSync,
} from "../reference-ingestion";
import {
  areStudioOutputCollectionStatesEqual,
  denormalizeStudioOutputCollection,
  EMPTY_STUDIO_OUTPUT_COLLECTION_STATE,
  normalizeStudioOutputCollection,
  type StudioOutputCollectionState,
} from "../reference-domain";

const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS; // current general fallback (10s)
const CHARACTER_MODE_PENDING_MODEL_LABEL = "Pulse Character Model";
const DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT = 500;
const DEFAULT_ARCHIVE_PREVIEW_KEEP_COUNT = 120;
const REFERENCE_GRID_FLAG_SOFT_ARCHIVE =
  process.env.NEXT_PUBLIC_REFERENCE_GRID_SOFT_ARCHIVE !== "false";
const REFERENCE_GRID_FLAG_NORMALIZED_STATE =
  process.env.NEXT_PUBLIC_REFERENCE_GRID_NORMALIZED_STATE !== "false";
const REFERENCE_GRID_ACTIVE_LIMIT = Number(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT ?? DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT
);
const REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT = Number(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT ??
    DEFAULT_ARCHIVE_PREVIEW_KEEP_COUNT
);

const isBlobObjectUrl = (value?: string | null) =>
  typeof value === "string" && value.startsWith("blob:");

const stripVideoMarkerFromBlobUrl = (value: string): string => value.replace(/#video=1$/, "");

const toIsoNow = () => new Date().toISOString();

type OutputCollectionState = StudioOutputCollectionState;

const EMPTY_OUTPUT_COLLECTION_STATE: OutputCollectionState = EMPTY_STUDIO_OUTPUT_COLLECTION_STATE;
/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
export const useAiStudioState = ({
  isCharacterModeEnabled = false,
}: {
  isCharacterModeEnabled?: boolean;
} = {}) => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [editReferenceText, setEditReferenceTextState] = useState<string>("");
  const [videoReferenceText, setVideoReferenceTextState] = useState<string>("");

  // Output management
  const [activeOutputState, setActiveOutputState] = useState<OutputCollectionState>(
    EMPTY_OUTPUT_COLLECTION_STATE
  );
  const [archivedOutputState, setArchivedOutputState] = useState<OutputCollectionState>(
    EMPTY_OUTPUT_COLLECTION_STATE
  );
  const activeOutputStateRef = useRef<OutputCollectionState>(EMPTY_OUTPUT_COLLECTION_STATE);
  const archivedOutputStateRef = useRef<OutputCollectionState>(EMPTY_OUTPUT_COLLECTION_STATE);
  const outputStorePublishQueuedRef = useRef(false);
  const outputStorePublisherUnmountedRef = useRef(false);
  const outputStorePublishEpochRef = useRef(0);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [referenceProjectionState, setReferenceProjectionState] =
    useState<ReferenceProjectionState>(createEmptyReferenceProjectionState);
  const referenceProjectionStateRef = useRef<ReferenceProjectionState>(referenceProjectionState);
  const curatedReferenceIds = referenceProjectionState.quickSlotIds;
  const removedFromAllRefsIds = referenceProjectionState.removedFromAllRefsIds;
  const [saved, setSaved] = useState(false);
  const pendingAutoSavesRef = useRef<Record<string, unknown>>({});
  const pendingFinalizeRemovalIdsRef = useRef<Set<string>>(new Set());
  const outputObjectUrlByIdRef = useRef<Record<string, string>>({});
  const lastOutputUrlsByIdRef = useRef<Record<string, string>>({});
  const activeOutputByIdRef = useRef<Record<string, StudioOutput>>({});
  const activeOutputs = useMemo(
    () => denormalizeStudioOutputCollection(activeOutputState),
    [activeOutputState]
  );
  const outputs = activeOutputs;
  const archivedOutputs = useMemo(
    () => denormalizeStudioOutputCollection(archivedOutputState),
    [archivedOutputState]
  );
  const syncOutputStoreSnapshot = useCallback(
    (nextActiveState: OutputCollectionState, nextArchivedState: OutputCollectionState) => {
      activeOutputStateRef.current = nextActiveState;
      archivedOutputStateRef.current = nextArchivedState;
      if (outputStorePublishQueuedRef.current) return;
      outputStorePublishQueuedRef.current = true;
      const publishEpoch = outputStorePublishEpochRef.current;
      const scheduleFlush =
        typeof queueMicrotask === "function"
          ? queueMicrotask
          : (task: () => void) => Promise.resolve().then(task);
      scheduleFlush(() => {
        if (publishEpoch !== outputStorePublishEpochRef.current) return;
        outputStorePublishQueuedRef.current = false;
        if (outputStorePublisherUnmountedRef.current) return;
        const latestActiveState = activeOutputStateRef.current;
        const latestArchivedState = archivedOutputStateRef.current;
        setAiStudioOutputStoreSnapshot({
          outputOrder: latestActiveState.order,
          outputById: latestActiveState.byId,
          archivedOutputOrder: latestArchivedState.order,
          archivedOutputById: latestArchivedState.byId,
        });
      });
    },
    []
  );
  const setOutputsState = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>((nextValue) => {
    setActiveOutputState((prevState) => {
      const prevRows = denormalizeStudioOutputCollection(prevState);
      const resolved = typeof nextValue === "function" ? nextValue(prevRows) : nextValue;
      const nextState = normalizeStudioOutputCollection(resolved);
      if (areStudioOutputCollectionStatesEqual(prevState, nextState)) {
        activeOutputStateRef.current = prevState;
        return prevState;
      }
      activeOutputStateRef.current = nextState;
      return nextState;
    });
  }, []);
  const setArchivedOutputs = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>((nextValue) => {
    setArchivedOutputState((prevState) => {
      const prevRows = denormalizeStudioOutputCollection(prevState);
      const resolved = typeof nextValue === "function" ? nextValue(prevRows) : nextValue;
      const nextState = normalizeStudioOutputCollection(resolved);
      if (areStudioOutputCollectionStatesEqual(prevState, nextState)) {
        archivedOutputStateRef.current = prevState;
        return prevState;
      }
      archivedOutputStateRef.current = nextState;
      return nextState;
    });
  }, []);
  const activeOutputById = useMemo(() => activeOutputState.byId, [activeOutputState.byId]);
  const activeOutput = useMemo(
    () => (activeOutputId ? (activeOutputById[activeOutputId] ?? null) : null),
    [activeOutputById, activeOutputId]
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

  const resolveTrackedObjectUrl = useCallback((output: StudioOutput): string | null => {
    const explicit = output.localObjectUrl?.trim();
    if (explicit && isBlobObjectUrl(explicit)) {
      return stripVideoMarkerFromBlobUrl(explicit);
    }
    const preview = output.previewUrl?.trim();
    if (!preview || !isBlobObjectUrl(preview)) return null;
    return stripVideoMarkerFromBlobUrl(preview);
  }, []);

  const compactArchivedOutputs = useCallback((rows: StudioOutput[]): StudioOutput[] => {
    if (!rows.length) return rows;
    const keepCount = Math.max(0, REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT);
    if (rows.length <= keepCount) return rows;
    let changed = false;
    const next = rows.map((item, index) => {
      if (index < keepCount) return item;
      if (!item.previewUrl && !item.localObjectUrl) return item;
      changed = true;
      return {
        ...item,
        previewUrl: undefined,
        localObjectUrl: null,
        archiveReason: item.archiveReason ?? "cleanup",
      };
    });
    return changed ? next : rows;
  }, []);

  const archiveOlderOutputs = useCallback(
    (activeRows: StudioOutput[]): StudioOutput[] => {
      const activeLimit = Number.isFinite(REFERENCE_GRID_ACTIVE_LIMIT)
        ? Math.max(20, REFERENCE_GRID_ACTIVE_LIMIT)
        : DEFAULT_REFERENCE_GRID_ACTIVE_LIMIT;
      if (!REFERENCE_GRID_FLAG_SOFT_ARCHIVE || activeRows.length <= activeLimit) {
        return activeRows;
      }
      const nextActive: StudioOutput[] = [];
      const newlyArchived: StudioOutput[] = [];
      activeRows.forEach((item, index) => {
        const canArchive =
          index >= activeLimit &&
          item.id !== activeOutputId &&
          !item.pinned &&
          item.taskState !== "pending" &&
          item.taskState !== "running";
        if (!canArchive) {
          nextActive.push(item);
          return;
        }
        newlyArchived.push({
          ...item,
          archivedAt: item.archivedAt ?? toIsoNow(),
          archiveReason: item.archiveReason ?? "soft_limit",
        });
      });
      if (!newlyArchived.length) return activeRows;
      setArchivedOutputs((prev) => compactArchivedOutputs([...newlyArchived, ...prev]));
      logMediaPerf("media.grid.archive.transition", {
        surface: "reference-grid",
        archived_count: newlyArchived.length,
        active_count: nextActive.length,
      });
      return nextActive;
    },
    [activeOutputId, compactArchivedOutputs, setArchivedOutputs]
  );

  const restoreArchivedOutput = useCallback(
    (outputId: string) => {
      setArchivedOutputs((prev) => {
        const target = prev.find((item) => item.id === outputId) ?? null;
        if (!target) return prev;
        setOutputsState((current) =>
          archiveOlderOutputs([
            {
              ...target,
              archivedAt: null,
              archiveReason: null,
            },
            ...current,
          ])
        );
        setActiveOutputId(target.id);
        logMediaPerf("media.grid.archive.transition", {
          surface: "reference-grid",
          restored_count: 1,
          active_count_hint: outputs.length + 1,
          archived_count_hint: Math.max(0, prev.length - 1),
        });
        return target ? prev.filter((item) => item.id !== outputId) : prev;
      });
    },
    [archiveOlderOutputs, outputs.length, setArchivedOutputs, setOutputsState]
  );

  const restoreAllArchivedOutputs = useCallback(() => {
    let moved: StudioOutput[] = [];
    setArchivedOutputs((prev) => {
      moved = prev;
      return [];
    });
    if (!moved.length) return;
    setOutputsState((prev) =>
      archiveOlderOutputs([
        ...moved.map((item) => ({
          ...item,
          archivedAt: null,
          archiveReason: null,
        })),
        ...prev,
      ])
    );
    logMediaPerf("media.grid.archive.transition", {
      surface: "reference-grid",
      restored_count: moved.length,
      active_count_hint: outputs.length + moved.length,
      archived_count_hint: 0,
    });
  }, [archiveOlderOutputs, outputs.length, setArchivedOutputs, setOutputsState]);

  const setOutputs = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>(
    (nextValue) => {
      setOutputsState((prev) => {
        const resolved = typeof nextValue === "function" ? nextValue(prev) : nextValue;
        return archiveOlderOutputs(resolved);
      });
    },
    [archiveOlderOutputs, setOutputsState]
  );
  const addCuratedReference = useCallback((id: string) => {
    setReferenceProjectionState((prev) => addQuickSlotReference(prev, id));
  }, []);
  const removeCuratedReference = useCallback((id: string) => {
    setReferenceProjectionState((prev) => {
      if (shouldFinalizeRemovalOnQuickSlotDetach(prev, id)) {
        pendingFinalizeRemovalIdsRef.current.add(id);
      }
      return removeQuickSlotReference(prev, id);
    });
  }, []);
  const reorderCuratedReference = useCallback(
    (id: string, targetId: string | null, placement: "before" | "after" | "end") => {
      setReferenceProjectionState((prev) =>
        reorderQuickSlotReference(prev, id, targetId, placement)
      );
    },
    []
  );
  const clearCuratedReferences = useCallback(() => {
    setReferenceProjectionState((prev) => {
      prev.removedFromAllRefsIds.forEach((id) => {
        pendingFinalizeRemovalIdsRef.current.add(id);
      });
      return clearQuickSlotReferences(prev);
    });
  }, []);
  const resetReferenceGridState = useCallback(() => {
    setOutputsState([]);
    setArchivedOutputs([]);
    setActiveOutputId(null);
    clearCuratedReferences();
  }, [clearCuratedReferences, setArchivedOutputs, setOutputsState]);

  const findActiveOutputById = useCallback((id: string) => {
    return activeOutputByIdRef.current[id] ?? null;
  }, []);

  const updateActiveOutputById = useCallback(
    (id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (!REFERENCE_GRID_FLAG_NORMALIZED_STATE) {
        setOutputs((prev) => {
          const targetIndex = prev.findIndex((item) => item.id === id);
          if (targetIndex === -1) return prev;
          const current = prev[targetIndex];
          if (!current) return prev;
          const nextItem = updater(current);
          if (nextItem === current) return prev;
          const next = [...prev];
          next[targetIndex] = nextItem;
          return next;
        });
        return;
      }

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
    [setOutputs]
  );

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

  useEffect(() => {
    activeOutputByIdRef.current = activeOutputById;
  }, [activeOutputById]);

  useEffect(() => {
    activeOutputStateRef.current = activeOutputState;
    archivedOutputStateRef.current = archivedOutputState;
    // Sync external selector store after commit in a passive effect.
    // Publishing from layout effects can create nested sync update loops when
    // selector subscribers schedule immediate re-renders during the same commit.
    syncOutputStoreSnapshot(activeOutputState, archivedOutputState);
  }, [activeOutputState, archivedOutputState, syncOutputStoreSnapshot]);

  useEffect(() => {
    // React StrictMode mounts, cleans up, and re-runs effects in development.
    // Re-arm the publisher on each mount so decoupled selector consumers continue receiving updates.
    outputStorePublisherUnmountedRef.current = false;
    outputStorePublishQueuedRef.current = false;
    outputStorePublishEpochRef.current += 1;
    return () => {
      outputStorePublisherUnmountedRef.current = true;
      outputStorePublishQueuedRef.current = false;
      outputStorePublishEpochRef.current += 1;
    };
  }, []);

  useEffect(() => {
    referenceProjectionStateRef.current = referenceProjectionState;
  }, [referenceProjectionState]);

  useEffect(() => {
    const validOutputIds = [...activeOutputState.order, ...archivedOutputState.order];
    // Keep projection ids aligned with output lifecycle transitions (active + archived stores).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReferenceProjectionState((prev) => {
      const nextQuickSlotIds = pruneCuratedReferenceIds(prev.quickSlotIds, validOutputIds);
      const withPrunedQuickSlots =
        nextQuickSlotIds === prev.quickSlotIds
          ? prev
          : {
              ...prev,
              quickSlotIds: nextQuickSlotIds,
            };
      return pruneReferenceProjectionState(withPrunedQuickSlots, validOutputIds);
    });
  }, [activeOutputState.order, archivedOutputState.order]);

  useEffect(() => {
    const syncPinnedState = (prevState: OutputCollectionState): OutputCollectionState => {
      const nextById = syncCuratedPinnedOutputsByOrder(
        prevState.order,
        prevState.byId,
        curatedReferenceIds
      );
      if (nextById === prevState.byId) return prevState;
      return {
        order: prevState.order,
        byId: nextById,
      };
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveOutputState(syncPinnedState);
    setArchivedOutputState(syncPinnedState);
  }, [curatedReferenceIds]);

  useEffect(() => {
    setOutputs((prev) => applyAllRefsSuppressionCompatibility(prev, referenceProjectionState));
  }, [referenceProjectionState, setOutputs]);

  useEffect(() => {
    const currentUrlMap: Record<string, string> = {};
    [...outputs, ...archivedOutputs].forEach((item) => {
      const tracked = resolveTrackedObjectUrl(item);
      if (!tracked) return;
      currentUrlMap[item.id] = tracked;
    });
    const previousUrlMap = lastOutputUrlsByIdRef.current;
    Object.entries(previousUrlMap).forEach(([outputId, objectUrl]) => {
      const stillTracked = currentUrlMap[outputId];
      if (stillTracked === objectUrl) return;
      if (typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(objectUrl);
      }
      delete outputObjectUrlByIdRef.current[outputId];
    });
    Object.entries(currentUrlMap).forEach(([outputId, objectUrl]) => {
      outputObjectUrlByIdRef.current[outputId] = objectUrl;
    });
    lastOutputUrlsByIdRef.current = currentUrlMap;
  }, [archivedOutputs, outputs, resolveTrackedObjectUrl]);

  useEffect(
    () => () => {
      Object.values(lastOutputUrlsByIdRef.current).forEach((objectUrl) => {
        if (typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(objectUrl);
        }
      });
      lastOutputUrlsByIdRef.current = {};
      outputObjectUrlByIdRef.current = {};
    },
    []
  );

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
    updateOutputByIdFast: REFERENCE_GRID_FLAG_NORMALIZED_STATE ? updateActiveOutputById : undefined,
    findOutputByIdFast: REFERENCE_GRID_FLAG_NORMALIZED_STATE ? findActiveOutputById : undefined,
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
        isCharacterModeEnabled,
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
    });
  const { generateOutput, regenerateOutput } = useAiStudioGenerationPromptComposer({
    prompt,
    editReferenceText,
    videoReferenceText,
    selectedTool,
    videoReferenceMode,
    useReferenceImageIndicator,
    activeOutputPreviewUrl: activeOutput?.previewUrl ?? null,
    resolveReferenceInputsForTool,
    submitTask,
    setUiError,
  });
  const insertOptimisticGenerationPlaceholder = useCallback(
    ({
      prompt: promptText,
      modeOverride,
      selectedToolOverride,
    }: {
      prompt: string;
      modeOverride?: StudioMode;
      selectedToolOverride?: ToolId | null;
    }) => {
      const cleanedPrompt = promptText.trim();
      if (!cleanedPrompt) return null;
      const effectiveMode = modeOverride ?? mode;
      const effectiveTool = selectedToolOverride ?? selectedTool;
      const outputMode: StudioMode =
        effectiveTool === "video" || effectiveTool === "kling"
          ? "video"
          : effectiveTool === "image" || effectiveTool === "edit"
            ? "image"
            : effectiveMode;
      const isCharacterModeCreateRun =
        isCharacterModeEnabled && (effectiveTool === "create" || effectiveTool === "text");
      const id = `out-${randomId()}`;
      const nextOutput: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: outputMode,
        aspect,
        model: isCharacterModeCreateRun
          ? CHARACTER_MODE_PENDING_MODEL_LABEL
          : resolveModelLabel(model ?? undefined),
        modelId: model ?? undefined,
        status: "ready",
        taskState: "pending",
        timestamp: "Submitting...",
        errorMessage: null,
        errorMessageShort: null,
        errorDetail: null,
        mediaSource: "generated",
        previewTier: outputMode === "video" ? "preview_loop" : "full",
        archivedAt: null,
        archiveReason: null,
        saveState: "idle",
        saveError: null,
      };
      setOutputs((prev) => [nextOutput, ...prev]);
      setSaved(false);
      return id;
    },
    [aspect, isCharacterModeEnabled, mode, model, selectedTool, setOutputs]
  );
  const removeOptimisticGenerationPlaceholder = useCallback(
    (outputId: string) => {
      if (!outputId) return;
      setOutputs((prev) => prev.filter((item) => item.id !== outputId));
    },
    [setOutputs]
  );

  const addAgentPromptReference = useCallback(
    (promptText: string, title?: string | null) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "prompt",
          source: "agent",
          promptText,
          title,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
        }
      );
      const [promptReference] = result.outputs;
      if (!promptReference) return;
      setOutputs((prev) => [promptReference, ...prev]);
      setSharedPrompt(promptReference.prompt);
    },
    [aspect, mode, model, setOutputs, setSharedPrompt]
  );

  const addPastedPromptReference = useCallback(
    (promptText: string) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "prompt",
          source: "paste",
          promptText,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addPastedMediaReference = useCallback(
    (payload: { url: string; mimeType?: string | null }) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "mediaUrl",
          source: "paste",
          url: payload.url,
          mimeType: payload.mimeType,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addLibraryMediaReference = useCallback(
    (payload: {
      id: string;
      url: string;
      fileType: "image" | "video";
      filename?: string | null;
      promptText?: string | null;
      source?: string | null;
      previewStoragePath?: string | null;
      fullStoragePath?: string | null;
      previewUrl?: string | null;
      fullUrl?: string | null;
    }) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "libraryMedia",
          source: "mediaLibrary",
          payload,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addLibraryPromptReference = useCallback(
    (payload: { id: string; promptText: string; title?: string | null }) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "libraryPrompt",
          source: "mediaLibrary",
          payload,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addOutputsFromFiles = useCallback(
    async (files: FileList, source: "filePicker" | "drop" = "filePicker") => {
      const result = await buildStudioOutputsFromReferenceInput(
        {
          kind: "files",
          source,
          files,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, model, mode, setOutputs]
  );

  const getAgentContext = useCallback(
    (options?: {
      lastAssistantMessage?: string | null;
      selectedOverride?: StudioOutput | null;
      modeHint?: "chat" | "text" | "describe" | "reference";
    }): AgentContext => {
      return buildAiStudioAgentContext({
        selected: options?.selectedOverride ?? null,
        model,
        mode,
        lastAssistantMessage: options?.lastAssistantMessage ?? null,
        modeHint: options?.modeHint,
      });
    },
    [model, mode]
  );

  const selectActiveOutputs = useCallback(() => outputs, [outputs]);
  const selectArchivedOutputs = useCallback(() => archivedOutputs, [archivedOutputs]);
  const getOutputById = useCallback((id: string) => {
    return getAiStudioOutputById(id);
  }, []);
  const subscribeOutputs = useCallback((listener: () => void) => {
    return subscribeAiStudioOutputs(listener);
  }, []);
  const getOutputSnapshot = useCallback((): AiStudioOutputStoreSnapshot => {
    return getAiStudioOutputSnapshot();
  }, []);
  const selectOutputById = useCallback((id: string) => getOutputById(id), [getOutputById]);

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
