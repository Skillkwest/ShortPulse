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
import type { StudioMode, ToolId } from "../types";
import { resolveWorkflowId } from "../logic/workflowIdentity";
import { getModelConfig } from "../logic/pricing";
import {
  resolveCreateWorkflowStartupModel,
  resolveEditWorkflowStartupModel,
} from "../logic/modelSelectionPolicy";

export const WORKFLOW_SETTINGS_SESSION_KEY = "aiStudioWorkflowSettingsByTool.v1";
const SHARED_ASPECT_SESSION_KEY = "aiStudioSharedAspect.v1";
const WORKFLOW_SETTINGS_PERSIST_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_WORKFLOW_SETTINGS_PERSIST_ENABLED !== "false";
const DEFAULT_SHARED_ASPECT = "9:16";

type WorkflowSettingsKey = "create" | "edit" | "video" | "kling";

type VideoReferenceMode = "standard" | "modify" | "keyframes" | "kling3" | "motion";
type KlingShotType = "customize" | "intelligent";
type KlingPromptShot = { id: string; prompt: string; duration: number };
type KlingElement = {
  id: string;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
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
  klingShotType: "customize",
  klingVoiceIds: ["", ""],
  klingMultiPrompts: [],
  klingElements: [{ id: randomId(), frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" }],
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
      ? snapshot.model
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
    : defaults.klingElements.map((element) => ({ ...element })),
});

type UseAiStudioWorkflowSettingsParams = {
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
  setKlingShotType: Dispatch<SetStateAction<KlingShotType>>;
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  setKlingMultiPrompts: Dispatch<SetStateAction<KlingPromptShot[]>>;
  setKlingElements: Dispatch<SetStateAction<KlingElement[]>>;
};

/**
 * Restores and persists per-tool workflow settings and returns restoration guard state.
 */
export const useAiStudioWorkflowSettings = ({
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
}: UseAiStudioWorkflowSettingsParams) => {
  const [workflowSettingsHydrated, setWorkflowSettingsHydrated] = useState(
    !WORKFLOW_SETTINGS_PERSIST_ENABLED
  );
  const workflowSettingsRef = useRef<
    Partial<Record<WorkflowSettingsKey, WorkflowSettingsSnapshot>>
  >({});
  const previousWorkflowSettingsKeyRef = useRef<WorkflowSettingsKey | null>(null);
  const initialSelectedToolRef = useRef(selectedTool);
  const sharedAspectRef = useRef(DEFAULT_SHARED_ASPECT);
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
      klingShotType,
      klingVoiceIds: [...klingVoiceIds] as [string, string],
      klingMultiPrompts: klingMultiPrompts.map((shot) => ({ ...shot })),
      klingElements: klingElements.map((element) => ({ ...element })),
    }),
    [
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
    ]
  );
  const hasPendingWorkflowRestore =
    WORKFLOW_SETTINGS_PERSIST_ENABLED &&
    workflowSettingsHydrated &&
    Boolean(activeWorkflowSettingsKey) &&
    previousWorkflowSettingsKeyRef.current !== activeWorkflowSettingsKey;

  const saveOutgoingWorkflowSnapshot = useCallback(
    (key: WorkflowSettingsKey, preserveExistingMode: boolean) => {
      const defaults = resolveDefaultWorkflowSettingsForKey();
      const existingSnapshot =
        workflowSettingsRef.current[key] ?? cloneWorkflowSettingsSnapshot(defaults, defaults);
      workflowSettingsRef.current[key] = {
        ...currentWorkflowSnapshot,
        mode: preserveExistingMode ? existingSnapshot.mode : currentWorkflowSnapshot.mode,
      };
    },
    [currentWorkflowSnapshot]
  );

  useEffect(() => {
    if (!WORKFLOW_SETTINGS_PERSIST_ENABLED) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        Record<WorkflowSettingsKey, Partial<WorkflowSettingsSnapshot>>
      >;
      const next: Partial<Record<WorkflowSettingsKey, WorkflowSettingsSnapshot>> = {};
      (["create", "edit", "video", "kling"] as const).forEach((key) => {
        next[key] = cloneWorkflowSettingsSnapshot(
          parsed?.[key],
          resolveDefaultWorkflowSettingsForKey()
        );
      });
      workflowSettingsRef.current = next;
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
    } finally {
      setWorkflowSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!WORKFLOW_SETTINGS_PERSIST_ENABLED) return;
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
    setKlingShotType(snapshot.klingShotType);
    setKlingVoiceIds([...snapshot.klingVoiceIds] as [string, string]);
    setKlingMultiPrompts(snapshot.klingMultiPrompts.map((shot) => ({ ...shot })));
    setKlingElements(snapshot.klingElements.map((element) => ({ ...element })));
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
    workflowSettingsHydrated,
  ]);

  useEffect(() => {
    if (!WORKFLOW_SETTINGS_PERSIST_ENABLED) return;
    if (!workflowSettingsHydrated) return;
    if (!activeWorkflowSettingsKey) return;
    if (hasPendingWorkflowRestore) return;
    workflowSettingsRef.current[activeWorkflowSettingsKey] = currentWorkflowSnapshot;
    sharedAspectRef.current = aspect;
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SHARED_ASPECT_SESSION_KEY, aspect);
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify(workflowSettingsRef.current)
    );
  }, [
    activeWorkflowSettingsKey,
    aspect,
    currentWorkflowSnapshot,
    hasPendingWorkflowRestore,
    workflowSettingsHydrated,
  ]);

  return { hasPendingWorkflowRestore };
};
