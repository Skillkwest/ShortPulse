/**
 * Workflow settings persistence hook for AI Studio state.
 * Hydrates/restores per-tool workflow preferences and persists updates to session storage.
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
import { randomId } from "../logic/ids";
import { type AiStudioKlingElement } from "../logic/klingElements";
import { normalizeSeedance2UiModelId } from "../logic/seedance2Availability";
import type { StudioMode, ToolId } from "../types";
import { resolveWorkflowId } from "../logic/workflowIdentity";
import { getModelConfig } from "../logic/pricing";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import {
  resolveCreateWorkflowStartupModel,
  resolveEditWorkflowStartupModel,
} from "../logic/modelSelectionPolicy";

export const WORKFLOW_SETTINGS_SESSION_KEY = "aiStudioWorkflowSettingsByTool.v1";
const WORKFLOW_SETTINGS_SESSION_ID_KEY = "aiStudioWorkflowSettingsSessionId.v1";
const SHARED_ASPECT_SESSION_KEY = "aiStudioSharedAspect.v1";
const WORKFLOW_SETTINGS_PERSIST_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_WORKFLOW_SETTINGS_PERSIST_ENABLED !== "false";
const DEFAULT_SHARED_ASPECT = "9:16";

type WorkflowSettingsKey = "create" | "edit" | "video" | "kling";

type VideoReferenceMode = "standard" | "modify" | "keyframes" | "kling3" | "motion";
type KlingWorkflowMode = "single" | "multi" | "custom";
type Seedance2InputMode = "text" | "first-frame" | "first-last" | "multimodal";
type KlingShotType = "customize" | "intelligent";
type KlingPromptShot = { id: string; prompt: string; duration: number };
type KlingElement = AiStudioKlingElement;
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
  klingWorkflowMode: KlingWorkflowMode;
  seedance2InputMode: Seedance2InputMode;
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  klingShotType: KlingShotType;
  klingVoiceIds: [string, string];
  klingMultiPrompts: KlingPromptShot[];
  klingElements: KlingElement[];
};

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettingsSnapshot = {
  mode: "image",
  model: null,
  aspect: DEFAULT_SHARED_ASPECT,
  imageResolution: "model_default",
  videoReferenceMode: "standard",
  videoDurationSeconds: 6,
  videoResolution: "1080p",
  videoGenerateAudio: false,
  videoCameraFixed: false,
  videoAutoFix: false,
  klingNegativePrompt: "blur, distort, and low quality",
  klingCfgScale: 0.5,
  klingWorkflowMode: "single",
  seedance2InputMode: "text",
  seedance2ReferenceImageUrls: [],
  seedance2ReferenceVideoUrls: [],
  seedance2ReferenceAudioUrls: [],
  seedance2ReturnLastFrame: false,
  seedance2WebSearch: false,
  klingShotType: "customize",
  klingVoiceIds: ["", ""],
  klingMultiPrompts: [],
  klingElements: [],
};

const resolveDefaultWorkflowSettingsForKey = (): WorkflowSettingsSnapshot =>
  DEFAULT_WORKFLOW_SETTINGS;

const resolveWorkflowSettingsKey = (tool: ToolId | null): WorkflowSettingsKey | null => {
  const workflowId = resolveWorkflowId(tool);
  if (workflowId === "create") return "create";
  if (workflowId === "edit") return "edit";
  if (workflowId === "video" && tool === "video") return "video";
  if (tool === "kling") return "kling";
  return null;
};

const cloneWorkflowSettingsSnapshot = (
  snapshot: Partial<WorkflowSettingsSnapshot> | null | undefined,
  defaults: WorkflowSettingsSnapshot = DEFAULT_WORKFLOW_SETTINGS
): WorkflowSettingsSnapshot => ({
  mode:
    snapshot?.mode === "image" || snapshot?.mode === "text" || snapshot?.mode === "video"
      ? snapshot.mode
      : defaults.mode,
  model:
    typeof snapshot?.model === "string" || snapshot?.model === null
      ? (normalizeSeedance2UiModelId(snapshot.model) ?? null)
      : defaults.model,
  aspect: typeof snapshot?.aspect === "string" ? snapshot.aspect : defaults.aspect,
  imageResolution:
    typeof snapshot?.imageResolution === "string"
      ? snapshot.imageResolution
      : defaults.imageResolution,
  videoReferenceMode:
    snapshot?.videoReferenceMode === "standard" ||
    snapshot?.videoReferenceMode === "modify" ||
    snapshot?.videoReferenceMode === "keyframes" ||
    snapshot?.videoReferenceMode === "kling3" ||
    snapshot?.videoReferenceMode === "motion"
      ? snapshot.videoReferenceMode
      : defaults.videoReferenceMode,
  videoDurationSeconds:
    typeof snapshot?.videoDurationSeconds === "number" &&
    Number.isFinite(snapshot.videoDurationSeconds)
      ? snapshot.videoDurationSeconds
      : defaults.videoDurationSeconds,
  videoResolution:
    typeof snapshot?.videoResolution === "string"
      ? snapshot.videoResolution
      : defaults.videoResolution,
  videoGenerateAudio:
    typeof snapshot?.videoGenerateAudio === "boolean"
      ? snapshot.videoGenerateAudio
      : defaults.videoGenerateAudio,
  videoCameraFixed:
    typeof snapshot?.videoCameraFixed === "boolean"
      ? snapshot.videoCameraFixed
      : defaults.videoCameraFixed,
  videoAutoFix:
    typeof snapshot?.videoAutoFix === "boolean" ? snapshot.videoAutoFix : defaults.videoAutoFix,
  klingNegativePrompt:
    typeof snapshot?.klingNegativePrompt === "string"
      ? snapshot.klingNegativePrompt
      : defaults.klingNegativePrompt,
  klingCfgScale:
    typeof snapshot?.klingCfgScale === "number" && Number.isFinite(snapshot.klingCfgScale)
      ? snapshot.klingCfgScale
      : defaults.klingCfgScale,
  klingWorkflowMode:
    snapshot?.klingWorkflowMode === "single" ||
    snapshot?.klingWorkflowMode === "multi" ||
    snapshot?.klingWorkflowMode === "custom"
      ? snapshot.klingWorkflowMode
      : Array.isArray(snapshot?.klingMultiPrompts) && snapshot.klingMultiPrompts.length > 0
        ? "custom"
        : defaults.klingWorkflowMode,
  seedance2InputMode:
    snapshot?.seedance2InputMode === "text" ||
    snapshot?.seedance2InputMode === "first-frame" ||
    snapshot?.seedance2InputMode === "first-last" ||
    snapshot?.seedance2InputMode === "multimodal"
      ? snapshot.seedance2InputMode
      : defaults.seedance2InputMode,
  seedance2ReferenceImageUrls: Array.isArray(snapshot?.seedance2ReferenceImageUrls)
    ? snapshot.seedance2ReferenceImageUrls.filter(
        (value): value is string => typeof value === "string"
      )
    : [],
  seedance2ReferenceVideoUrls: Array.isArray(snapshot?.seedance2ReferenceVideoUrls)
    ? snapshot.seedance2ReferenceVideoUrls.filter(
        (value): value is string => typeof value === "string"
      )
    : [],
  seedance2ReferenceAudioUrls: Array.isArray(snapshot?.seedance2ReferenceAudioUrls)
    ? snapshot.seedance2ReferenceAudioUrls.filter(
        (value): value is string => typeof value === "string"
      )
    : [],
  seedance2ReturnLastFrame:
    typeof snapshot?.seedance2ReturnLastFrame === "boolean"
      ? snapshot.seedance2ReturnLastFrame
      : defaults.seedance2ReturnLastFrame,
  seedance2WebSearch:
    typeof snapshot?.seedance2WebSearch === "boolean"
      ? snapshot.seedance2WebSearch
      : defaults.seedance2WebSearch,
  klingShotType:
    snapshot?.klingShotType === "intelligent" || snapshot?.klingShotType === "customize"
      ? snapshot.klingShotType
      : defaults.klingShotType,
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
  klingElements: [],
});

type UseAiStudioWorkflowSettingsParams = {
  projectId?: string | null;
  projectRouteRequested?: boolean;
  sessionId?: string | null;
  selectedTool: ToolId | null;
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
  klingWorkflowMode: KlingWorkflowMode;
  seedance2InputMode: Seedance2InputMode;
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  klingShotType: KlingShotType;
  klingVoiceIds: [string, string];
  klingMultiPrompts: KlingPromptShot[];
  klingElements: KlingElement[];
  setMode: Dispatch<SetStateAction<StudioMode>>;
  setModelState: Dispatch<SetStateAction<string | null>>;
  setAspect: Dispatch<SetStateAction<string>>;
  setImageResolution: Dispatch<SetStateAction<string>>;
  setVideoReferenceMode: Dispatch<SetStateAction<VideoReferenceMode>>;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  setKlingWorkflowMode: Dispatch<SetStateAction<KlingWorkflowMode>>;
  setSeedance2InputMode: Dispatch<SetStateAction<Seedance2InputMode>>;
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  setKlingShotType: Dispatch<SetStateAction<KlingShotType>>;
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  setKlingMultiPrompts: Dispatch<SetStateAction<KlingPromptShot[]>>;
  setKlingElements: Dispatch<SetStateAction<KlingElement[]>>;
};

/**
 * Restores and persists per-tool workflow settings and returns restoration guard state.
 */
export const useAiStudioWorkflowSettings = ({
  projectId = null,
  projectRouteRequested = false,
  sessionId = null,
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
  klingWorkflowMode,
  seedance2InputMode,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
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
  setKlingWorkflowMode,
  setSeedance2InputMode,
  setSeedance2ReferenceImageUrls,
  setSeedance2ReferenceVideoUrls,
  setSeedance2ReferenceAudioUrls,
  setSeedance2ReturnLastFrame,
  setSeedance2WebSearch,
  setKlingShotType,
  setKlingVoiceIds,
  setKlingMultiPrompts,
  setKlingElements,
}: UseAiStudioWorkflowSettingsParams) => {
  const workflowSettingsPersistenceEnabled =
    WORKFLOW_SETTINGS_PERSIST_ENABLED && !projectRouteRequested && !projectId;
  const [workflowSettingsHydrated, setWorkflowSettingsHydrated] = useState(
    !workflowSettingsPersistenceEnabled
  );
  const workflowSettingsRef = useRef<
    Partial<Record<WorkflowSettingsKey, WorkflowSettingsSnapshot>>
  >({});
  const inMemoryKlingElementsRef = useRef<Partial<Record<WorkflowSettingsKey, KlingElement[]>>>({});
  const previousWorkflowSettingsKeyRef = useRef<WorkflowSettingsKey | null>(null);
  const initialSelectedToolRef = useRef(selectedTool);
  const sharedAspectRef = useRef(DEFAULT_SHARED_ASPECT);
  const persistedWorkflowSessionIdRef = useRef<string | null>(null);
  const activeWorkflowSettingsKey = useMemo(
    () => resolveWorkflowSettingsKey(selectedTool),
    [selectedTool]
  );
  const currentWorkflowSnapshot = useMemo<WorkflowSettingsSnapshot>(
    () => ({
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
      klingWorkflowMode,
      seedance2InputMode,
      seedance2ReferenceImageUrls: [...seedance2ReferenceImageUrls],
      seedance2ReferenceVideoUrls: [...seedance2ReferenceVideoUrls],
      seedance2ReferenceAudioUrls: [...seedance2ReferenceAudioUrls],
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingShotType,
      klingVoiceIds: [...klingVoiceIds] as [string, string],
      klingMultiPrompts: klingMultiPrompts.map((shot) => ({ ...shot })),
      klingElements: klingElements.map((element) => ({ ...element })),
    }),
    [
      aspect,
      imageResolution,
      klingCfgScale,
      seedance2InputMode,
      seedance2ReferenceAudioUrls,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingElements,
      klingMultiPrompts,
      klingNegativePrompt,
      klingWorkflowMode,
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
    ]
  );
  const hasPendingWorkflowRestore =
    workflowSettingsPersistenceEnabled &&
    workflowSettingsHydrated &&
    Boolean(activeWorkflowSettingsKey) &&
    previousWorkflowSettingsKeyRef.current !== activeWorkflowSettingsKey;

  useEffect(() => {
    if (!workflowSettingsPersistenceEnabled) {
      setWorkflowSettingsHydrated(true);
    }
  }, [workflowSettingsPersistenceEnabled]);

  const saveOutgoingWorkflowSnapshot = useCallback(
    (key: WorkflowSettingsKey, preserveExistingMode: boolean) => {
      const defaults = resolveDefaultWorkflowSettingsForKey();
      const existingSnapshot =
        workflowSettingsRef.current[key] ?? cloneWorkflowSettingsSnapshot(defaults, defaults);
      const currentKlingElements = currentWorkflowSnapshot.klingElements.map((element) => ({
        ...element,
      }));
      inMemoryKlingElementsRef.current[key] = currentKlingElements;
      workflowSettingsRef.current[key] = {
        ...currentWorkflowSnapshot,
        mode: preserveExistingMode ? existingSnapshot.mode : currentWorkflowSnapshot.mode,
        klingElements: currentKlingElements,
      };
    },
    [currentWorkflowSnapshot]
  );

  useEffect(() => {
    if (!workflowSettingsPersistenceEnabled) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY);
      const storedWorkflowSessionId =
        window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_ID_KEY)?.trim() || null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        Record<WorkflowSettingsKey, Partial<WorkflowSettingsSnapshot>>
      >;
      const next: Partial<Record<WorkflowSettingsKey, WorkflowSettingsSnapshot>> = {};
      (["create", "edit", "video", "kling"] as const).forEach((key) => {
        const snapshot = cloneWorkflowSettingsSnapshot(
          parsed?.[key],
          resolveDefaultWorkflowSettingsForKey()
        );
        next[key] = { ...snapshot, klingElements: [] };
        inMemoryKlingElementsRef.current[key] = [];
      });
      workflowSettingsRef.current = next;
      persistedWorkflowSessionIdRef.current = storedWorkflowSessionId;
      const storedSharedAspect = window.sessionStorage.getItem(SHARED_ASPECT_SESSION_KEY)?.trim();
      const initialWorkflowKey = resolveWorkflowSettingsKey(initialSelectedToolRef.current);
      const initialSnapshotAspect = initialWorkflowKey ? next[initialWorkflowKey]?.aspect : null;
      sharedAspectRef.current =
        storedSharedAspect ||
        initialSnapshotAspect ||
        next.create?.aspect ||
        next.edit?.aspect ||
        next.video?.aspect ||
        next.kling?.aspect ||
        DEFAULT_SHARED_ASPECT;
    } catch {
      workflowSettingsRef.current = {};
      sharedAspectRef.current = DEFAULT_SHARED_ASPECT;
      persistedWorkflowSessionIdRef.current = sessionId;
    } finally {
      setWorkflowSettingsHydrated(true);
    }
  }, [sessionId, workflowSettingsPersistenceEnabled]);

  useEffect(() => {
    if (!workflowSettingsPersistenceEnabled) return;
    if (!workflowSettingsHydrated) return;
    if (!activeWorkflowSettingsKey) {
      const previous = previousWorkflowSettingsKeyRef.current;
      if (previous) {
        saveOutgoingWorkflowSnapshot(previous, false);
      }
      previousWorkflowSettingsKeyRef.current = null;
      return;
    }

    const previous = previousWorkflowSettingsKeyRef.current;
    if (previous && previous !== activeWorkflowSettingsKey) {
      const preserveExistingMode =
        activeWorkflowSettingsKey === "create" || activeWorkflowSettingsKey === "edit";
      saveOutgoingWorkflowSnapshot(previous, preserveExistingMode);
    }
    previousWorkflowSettingsKeyRef.current = activeWorkflowSettingsKey;
    if (previous === activeWorkflowSettingsKey) return;

    let snapshot = workflowSettingsRef.current[activeWorkflowSettingsKey];
    if (!snapshot) {
      const defaults = resolveDefaultWorkflowSettingsForKey();
      snapshot = cloneWorkflowSettingsSnapshot(defaults, defaults);
      workflowSettingsRef.current[activeWorkflowSettingsKey] = snapshot;
    }
    const inMemoryKlingElements = (
      inMemoryKlingElementsRef.current[activeWorkflowSettingsKey] ?? []
    ).map((element) => ({ ...element }));

    if (activeWorkflowSettingsKey === "create") {
      const resolvedCreateModel = resolveCreateWorkflowStartupModel({
        mode: snapshot.mode,
        savedModelId: snapshot.model,
        getModelConfig,
      });
      if (resolvedCreateModel !== snapshot.model) {
        snapshot = {
          ...snapshot,
          model: resolvedCreateModel,
        };
        workflowSettingsRef.current[activeWorkflowSettingsKey] = snapshot;
      }
      setMode(snapshot.mode);
    }
    if (activeWorkflowSettingsKey === "edit") {
      const resolvedEditModel = resolveEditWorkflowStartupModel({
        savedModelId: snapshot.model,
        getModelConfig,
      });
      if (resolvedEditModel !== snapshot.model) {
        snapshot = {
          ...snapshot,
          model: resolvedEditModel,
        };
        workflowSettingsRef.current[activeWorkflowSettingsKey] = snapshot;
      }
    }
    const sharedAspectToApply =
      previous == null ? sharedAspectRef.current : currentWorkflowSnapshot.aspect;
    sharedAspectRef.current = sharedAspectToApply;
    setModelState(snapshot.model);
    setAspect(sharedAspectToApply);
    setImageResolution(snapshot.imageResolution);
    setVideoReferenceMode(snapshot.videoReferenceMode);
    setVideoDurationSeconds(snapshot.videoDurationSeconds);
    setVideoResolution(snapshot.videoResolution);
    setVideoGenerateAudio(snapshot.videoGenerateAudio);
    setVideoCameraFixed(snapshot.videoCameraFixed);
    setVideoAutoFix(snapshot.videoAutoFix);
    setKlingNegativePrompt(snapshot.klingNegativePrompt);
    setKlingCfgScale(snapshot.klingCfgScale);
    setKlingWorkflowMode(snapshot.klingWorkflowMode);
    setSeedance2InputMode(snapshot.seedance2InputMode);
    setSeedance2ReferenceImageUrls([...snapshot.seedance2ReferenceImageUrls]);
    setSeedance2ReferenceVideoUrls([...snapshot.seedance2ReferenceVideoUrls]);
    setSeedance2ReferenceAudioUrls([...snapshot.seedance2ReferenceAudioUrls]);
    setSeedance2ReturnLastFrame(snapshot.seedance2ReturnLastFrame);
    setSeedance2WebSearch(snapshot.seedance2WebSearch);
    setKlingShotType(snapshot.klingShotType);
    setKlingVoiceIds([...snapshot.klingVoiceIds] as [string, string]);
    setKlingMultiPrompts(snapshot.klingMultiPrompts.map((shot) => ({ ...shot })));
    setKlingElements(
      (snapshot.klingElements.length ? snapshot.klingElements : inMemoryKlingElements).map(
        (element) => ({ ...element })
      )
    );
  }, [
    activeWorkflowSettingsKey,
    currentWorkflowSnapshot,
    saveOutgoingWorkflowSnapshot,
    setAspect,
    setImageResolution,
    setKlingCfgScale,
    setKlingElements,
    setKlingMultiPrompts,
    setKlingNegativePrompt,
    setKlingWorkflowMode,
    setSeedance2InputMode,
    setSeedance2ReferenceAudioUrls,
    setSeedance2ReferenceImageUrls,
    setSeedance2ReferenceVideoUrls,
    setSeedance2ReturnLastFrame,
    setSeedance2WebSearch,
    setKlingShotType,
    setKlingVoiceIds,
    setMode,
    setModelState,
    setVideoAutoFix,
    setVideoCameraFixed,
    setVideoDurationSeconds,
    setVideoGenerateAudio,
    setVideoReferenceMode,
    setVideoResolution,
    workflowSettingsPersistenceEnabled,
    workflowSettingsHydrated,
  ]);

  useEffect(() => {
    if (!workflowSettingsPersistenceEnabled) return;
    if (!workflowSettingsHydrated) return;
    if (!activeWorkflowSettingsKey) return;
    if (hasPendingWorkflowRestore) return;
    inMemoryKlingElementsRef.current[activeWorkflowSettingsKey] =
      currentWorkflowSnapshot.klingElements.map((element) => ({ ...element }));
    workflowSettingsRef.current[activeWorkflowSettingsKey] = currentWorkflowSnapshot;
    sharedAspectRef.current = aspect;
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SHARED_ASPECT_SESSION_KEY, aspect);
    if (sessionId) {
      window.sessionStorage.setItem(WORKFLOW_SETTINGS_SESSION_ID_KEY, sessionId);
      persistedWorkflowSessionIdRef.current = sessionId;
    }
    const sanitizedSnapshots = Object.fromEntries(
      (["create", "edit", "video", "kling"] as const)
        .filter((key) => workflowSettingsRef.current[key])
        .map((key) => [key, { ...workflowSettingsRef.current[key], klingElements: [] }])
    );
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify(sanitizedSnapshots)
    );
  }, [
    activeWorkflowSettingsKey,
    aspect,
    currentWorkflowSnapshot,
    hasPendingWorkflowRestore,
    sessionId,
    workflowSettingsPersistenceEnabled,
    workflowSettingsHydrated,
  ]);

  useEffect(() => {
    if (!workflowSettingsHydrated) return;
    if (activeWorkflowSettingsKey !== "video") return;
    if (
      model === KIE_KLING_30_MODEL_ID ||
      model === KIE_SEEDANCE_2_MODEL_ID ||
      model === KIE_SEEDANCE_2_FAST_MODEL_ID
    ) {
      return;
    }
    if (klingWorkflowMode === "single" && klingMultiPrompts.length === 0) return;

    setKlingWorkflowMode("single");
    setKlingMultiPrompts([]);
  }, [
    activeWorkflowSettingsKey,
    klingMultiPrompts,
    klingWorkflowMode,
    model,
    setKlingMultiPrompts,
    setKlingWorkflowMode,
    workflowSettingsHydrated,
  ]);

  return { hasPendingWorkflowRestore };
};
