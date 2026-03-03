/**
 * Workflow settings persistence hook for AI Studio state.
 * Hydrates/restores per-tool workflow preferences and persists updates to session storage.
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { randomId } from "../logic/ids";
import type { StudioMode, ToolId } from "../types";
import { resolveWorkflowId } from "../logic/workflowIdentity";
import { getModelConfig } from "../logic/pricing";
import {
  resolveCreateWorkflowStartupModel,
  resolveEditWorkflowStartupModel,
} from "../logic/modelSelectionPolicy";

export const WORKFLOW_SETTINGS_SESSION_KEY = "aiStudioWorkflowSettingsByTool.v1";

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
  const workflowId = resolveWorkflowId(tool);
  if (workflowId === "create") return "create";
  if (workflowId === "edit") return "edit";
  if (workflowId === "video" && tool === "video") return "video";
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
  const [workflowSettingsHydrated, setWorkflowSettingsHydrated] = useState(false);
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
  }, [
    activeWorkflowSettingsKey,
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
    hasPendingWorkflowRestore,
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
  ]);

  return { hasPendingWorkflowRestore };
};
