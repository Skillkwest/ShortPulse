/**
 * Encapsulates lifecycle and synchronization effects for AI Studio state.
 */
import { useCallback, useEffect, type MutableRefObject } from "react";
import { aspectOptions } from "../constants";
import { getModelConfig } from "../logic/pricing";
import { clampImageResolutionForModel } from "../logic/imageResolution";
import { CREATE_DEFAULT_MODEL_ID, EDIT_DEFAULT_MODEL_ID } from "../logic/modelSelectionPolicy";
import { mapCreateModelOnCharacterModeToggle } from "../logic/createCharacterModeModelMapping";
import {
  resolveAutoVideoModelForLane,
  resolveVideoGenerationLaneFromFrameInputs,
} from "../logic/referenceInputs";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import {
  isCreateWorkflow,
  isEditWorkflow,
  isVideoWorkflow,
  resolveWorkflowId,
} from "../logic/workflowIdentity";
import type { StudioMode, ToolId } from "../types";
import { useAiStudioAllowedModelOptions } from "./useAiStudioAllowedModelOptions";

const KEYFRAME_COMPATIBLE_MODELS = new Set([
  "fal-ai/veo3.1/first-last-frame-to-video",
  KIE_VEO_31_FAST_I2V_MODEL_ID,
]);
const FAL_VEO_FIRST_LAST_MODEL_ID = "fal-ai/veo3.1/first-last-frame-to-video";
const allowedUiAspects = new Set(aspectOptions.map((option) => option.value));

type VideoReferenceMode = "standard" | "modify" | "keyframes" | "kling3" | "motion";

type UseAiStudioStateEffectsArgs = {
  promptRef: MutableRefObject<HTMLTextAreaElement | null>;
  aspect: string;
  setAspect: (value: string) => void;
  activeOutputPreviewUrl?: string | null;
  setUseReferenceImageIndicator: (value: boolean) => void;
  model: string | null;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  selectedTool: ToolId | null;
  videoReferenceMode: VideoReferenceMode;
  setVideoReferenceMode: (value: VideoReferenceMode) => void;
  setModel: (value: string | null) => void;
  allowedModelValues?: string[];
  lastVideoReferenceModeRef: MutableRefObject<VideoReferenceMode>;
  lastNonKling3VideoModelRef: MutableRefObject<string | null>;
  lastNonKeyframesVideoModelRef: MutableRefObject<string | null>;
  lastNonMotionVideoModelRef: MutableRefObject<string | null>;
  showCreateTools: boolean;
  setShowCreateTools: (value: boolean) => void;
  videoDurationStorageKey: string;
  videoResolutionStorageKey: string;
  imageResolutionStorageKey: string;
  videoDurationSeconds: number;
  setVideoDurationSeconds: (value: number) => void;
  videoResolution: string;
  setVideoResolution: (value: string) => void;
  imageResolution: string;
  setImageResolution: (value: string) => void;
  hasUserVideoPrefs: boolean;
  setHasUserVideoPrefs: (value: boolean) => void;
  setVideoGenerateAudio: (value: boolean) => void;
  isCharacterModeEnabled: boolean;
  mode: StudioMode;
  setDetailOutputId: (value: string | null) => void;
  setIsModelModalOpen: (value: boolean) => void;
  setModelModalAnchor: (value: string | null) => void;
  hasPendingWorkflowRestore: boolean;
};

/**
 * Runs all side-effects related to model/tool synchronization and window lifecycle listeners.
 */
export const useAiStudioStateEffects = ({
  promptRef,
  aspect,
  setAspect,
  activeOutputPreviewUrl,
  setUseReferenceImageIndicator,
  model,
  referenceImageUrl,
  extraImageUrls,
  selectedTool,
  videoReferenceMode,
  setVideoReferenceMode,
  setModel,
  allowedModelValues: allowedModelValuesProp,
  lastVideoReferenceModeRef,
  lastNonKling3VideoModelRef,
  lastNonKeyframesVideoModelRef,
  lastNonMotionVideoModelRef,
  showCreateTools,
  setShowCreateTools,
  videoDurationStorageKey,
  videoResolutionStorageKey,
  imageResolutionStorageKey,
  videoDurationSeconds,
  setVideoDurationSeconds,
  videoResolution,
  setVideoResolution,
  imageResolution,
  setImageResolution,
  hasUserVideoPrefs,
  setHasUserVideoPrefs,
  setVideoGenerateAudio,
  isCharacterModeEnabled,
  mode,
  setDetailOutputId,
  setIsModelModalOpen,
  setModelModalAnchor,
  hasPendingWorkflowRestore,
}: UseAiStudioStateEffectsArgs) => {
  const computedAllowedModelValues = useAiStudioAllowedModelOptions({
    selectedTool,
    videoReferenceMode,
    mode,
    referenceImageUrl,
    extraImageUrls,
    isCharacterModeEnabled,
  }).map((option) => option.value);
  const allowedModelValues = allowedModelValuesProp ?? computedAllowedModelValues;

  const setModelIfChanged = useCallback(
    (nextModel: string | null) => {
      if (model === nextModel) return;
      setModel(nextModel);
    },
    [model, setModel]
  );

  const setVideoReferenceModeIfChanged = useCallback(
    (nextMode: VideoReferenceMode) => {
      if (videoReferenceMode === nextMode) return;
      setVideoReferenceMode(nextMode);
    },
    [setVideoReferenceMode, videoReferenceMode]
  );

  useEffect(() => {
    promptRef.current?.focus();
  }, [promptRef]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (allowedUiAspects.has(aspect)) return;
    if (aspect === "9:21") {
      setAspect("9:16");
      return;
    }
    setAspect("9:16");
  }, [aspect, hasPendingWorkflowRestore, setAspect]);

  useEffect(() => {
    if (!activeOutputPreviewUrl) {
      setUseReferenceImageIndicator(false);
    }
  }, [activeOutputPreviewUrl, setUseReferenceImageIndicator]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!model) return;
    const config = getModelConfig(model);
    if (!config?.allowedAspects?.length) return;
    if (config.allowedAspects.includes(aspect)) return;
    const fallbackAspect = config.allowedAspects.includes(config.defaultAspect)
      ? config.defaultAspect
      : config.allowedAspects[0];
    if (fallbackAspect) {
      setAspect(fallbackAspect);
    }
  }, [aspect, hasPendingWorkflowRestore, model, setAspect]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(videoDurationStorageKey, String(videoDurationSeconds));
    setHasUserVideoPrefs(true);
  }, [setHasUserVideoPrefs, videoDurationSeconds, videoDurationStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(videoResolutionStorageKey, videoResolution);
    setHasUserVideoPrefs(true);
  }, [setHasUserVideoPrefs, videoResolution, videoResolutionStorageKey]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!isVideoWorkflow(selectedTool)) return;
    if (videoReferenceMode === "motion" || videoReferenceMode === "kling3") return;

    const resolvedVideoLane = resolveVideoGenerationLaneFromFrameInputs({
      primary: referenceImageUrl,
      extras: extraImageUrls,
      referenceMode: videoReferenceMode,
    });

    if (resolvedVideoLane === "first-last") {
      setVideoReferenceModeIfChanged("keyframes");
    } else if (videoReferenceMode === "keyframes") {
      setVideoReferenceModeIfChanged("standard");
    }

    const nextModel = resolveAutoVideoModelForLane({
      currentModel: model,
      lane: resolvedVideoLane,
    });
    if (!nextModel || nextModel === model) return;
    if (allowedModelValues.length > 0 && !allowedModelValues.includes(nextModel)) return;
    setModelIfChanged(nextModel);
  }, [
    allowedModelValues,
    extraImageUrls,
    hasPendingWorkflowRestore,
    model,
    referenceImageUrl,
    selectedTool,
    setModelIfChanged,
    setVideoReferenceModeIfChanged,
    videoReferenceMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(imageResolutionStorageKey, imageResolution);
  }, [imageResolution, imageResolutionStorageKey]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!model) return;
    const config = getModelConfig(model);
    if (!config || config.mediaType !== "image") return;
    const clamped = clampImageResolutionForModel(model, imageResolution);
    if (clamped !== imageResolution) {
      setImageResolution(clamped);
    }
  }, [hasPendingWorkflowRestore, imageResolution, model, setImageResolution]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!model) return;
    const config = getModelConfig(model);
    if (!config) return;
    const isVideoModel =
      config.mediaType === "video" ||
      config.mediaType === "image-to-video" ||
      config.mediaType === "multi";
    if (!isVideoModel) return;

    const applyDefaults = !hasUserVideoPrefs;
    if (typeof config.defaultDurationSeconds === "number") {
      const isUnset = !hasUserVideoPrefs;
      if (isUnset) {
        setVideoDurationSeconds(config.defaultDurationSeconds);
      }
    }
    if (config.defaultResolution) {
      const isUnset = !hasUserVideoPrefs;
      if (isUnset) {
        setVideoResolution(config.defaultResolution);
      }
    }
    if (config.defaultAudio !== undefined && applyDefaults) {
      setVideoGenerateAudio(config.defaultAudio);
    }
  }, [
    hasUserVideoPrefs,
    model,
    setVideoDurationSeconds,
    setVideoGenerateAudio,
    setVideoResolution,
    hasPendingWorkflowRestore,
  ]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!isVideoWorkflow(selectedTool)) return;
    const previousMode = lastVideoReferenceModeRef.current;
    if (videoReferenceMode !== previousMode) {
      lastVideoReferenceModeRef.current = videoReferenceMode;
    }

    if (videoReferenceMode === "kling3") {
      if (model !== "fal-ai/kling-video/v3/pro/image-to-video") {
        lastNonKling3VideoModelRef.current = model;
        setModelIfChanged("fal-ai/kling-video/v3/pro/image-to-video");
      }
      return;
    }

    if (previousMode === "kling3" && model === "fal-ai/kling-video/v3/pro/image-to-video") {
      const fallback = lastNonKling3VideoModelRef.current;
      if (fallback && fallback !== "fal-ai/kling-video/v3/pro/image-to-video") {
        setModelIfChanged(fallback);
        return;
      }
      setModelIfChanged(null);
      return;
    }

    if (model === FAL_VEO_FIRST_LAST_MODEL_ID && videoReferenceMode !== "keyframes") {
      setVideoReferenceModeIfChanged("keyframes");
      return;
    }

    if (videoReferenceMode === "keyframes") {
      if (model && !KEYFRAME_COMPATIBLE_MODELS.has(model)) {
        lastNonKeyframesVideoModelRef.current = model;
        setModelIfChanged(FAL_VEO_FIRST_LAST_MODEL_ID);
      } else if (!model) {
        setModelIfChanged(FAL_VEO_FIRST_LAST_MODEL_ID);
      }
      return;
    }

    if (videoReferenceMode === "motion") {
      if (model !== KIE_KLING_30_MODEL_ID) {
        lastNonMotionVideoModelRef.current = model;
        setModelIfChanged(KIE_KLING_30_MODEL_ID);
      } else if (!model) {
        setModelIfChanged(KIE_KLING_30_MODEL_ID);
      }
      return;
    }

    if (model === "fal-ai/kling-video/v3/pro/image-to-video" && videoReferenceMode === "standard") {
      const fallback = lastNonMotionVideoModelRef.current ?? "fal-ai/veo3.1/image-to-video";
      setModelIfChanged(fallback);
      return;
    }

    if (model === FAL_VEO_FIRST_LAST_MODEL_ID && videoReferenceMode === "standard") {
      const fallback = lastNonKeyframesVideoModelRef.current ?? "fal-ai/veo3.1/image-to-video";
      setModelIfChanged(fallback);
      return;
    }
  }, [
    lastNonKeyframesVideoModelRef,
    lastNonKling3VideoModelRef,
    lastNonMotionVideoModelRef,
    lastVideoReferenceModeRef,
    model,
    selectedTool,
    setModelIfChanged,
    videoReferenceMode,
    hasPendingWorkflowRestore,
  ]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (resolveWorkflowId(selectedTool) !== "video" || selectedTool === "kling") return;
    if (videoReferenceMode === "keyframes" || videoReferenceMode === "motion") return;
    if (videoReferenceMode === "kling3") {
      setVideoReferenceModeIfChanged("standard");
    }
    if (model === "fal-ai/kling-video/v3/pro/image-to-video") {
      const fallback = lastNonKling3VideoModelRef.current;
      if (fallback && fallback !== "fal-ai/kling-video/v3/pro/image-to-video") {
        setModelIfChanged(fallback);
      } else {
        setModelIfChanged(null);
      }
    }
  }, [
    lastNonKling3VideoModelRef,
    model,
    selectedTool,
    setModelIfChanged,
    setVideoReferenceModeIfChanged,
    videoReferenceMode,
    hasPendingWorkflowRestore,
  ]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (selectedTool !== "kling") return;
    if (videoReferenceMode !== "kling3") {
      setVideoReferenceModeIfChanged("kling3");
    }
    if (model !== "fal-ai/kling-video/v3/pro/image-to-video") {
      setModelIfChanged("fal-ai/kling-video/v3/pro/image-to-video");
    }
    if (!showCreateTools) {
      setShowCreateTools(true);
    }
  }, [
    model,
    selectedTool,
    setModelIfChanged,
    setShowCreateTools,
    setVideoReferenceModeIfChanged,
    showCreateTools,
    videoReferenceMode,
    hasPendingWorkflowRestore,
  ]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    const allowedValues = new Set(allowedModelValues);
    const isCreateImageLikeMode = mode === "image" || mode === "text";
    if (!model) {
      if (isCreateWorkflow(selectedTool) && isCreateImageLikeMode) {
        if (isCharacterModeEnabled && allowedValues.has(EDIT_DEFAULT_MODEL_ID)) {
          setModelIfChanged(EDIT_DEFAULT_MODEL_ID);
          return;
        }
        if (!isCharacterModeEnabled && allowedValues.has(CREATE_DEFAULT_MODEL_ID)) {
          setModelIfChanged(CREATE_DEFAULT_MODEL_ID);
          return;
        }
      }
      if (isEditWorkflow(selectedTool) && allowedValues.has(EDIT_DEFAULT_MODEL_ID)) {
        setModelIfChanged(EDIT_DEFAULT_MODEL_ID);
      }
      return;
    }
    if (!allowedValues.has(model)) {
      if (isCreateWorkflow(selectedTool) && isCreateImageLikeMode) {
        const mappedCreateModel = mapCreateModelOnCharacterModeToggle({
          currentModelId: model,
          isCharacterModeEnabled,
        });
        if (allowedValues.has(mappedCreateModel)) {
          setModelIfChanged(mappedCreateModel);
          return;
        }
        if (!isCharacterModeEnabled && allowedValues.has(CREATE_DEFAULT_MODEL_ID)) {
          setModelIfChanged(CREATE_DEFAULT_MODEL_ID);
          return;
        }
      }
      if (isEditWorkflow(selectedTool) && allowedValues.has(EDIT_DEFAULT_MODEL_ID)) {
        setModelIfChanged(EDIT_DEFAULT_MODEL_ID);
        return;
      }
      setModelIfChanged(null);
    }
  }, [
    allowedModelValues,
    hasPendingWorkflowRestore,
    isCharacterModeEnabled,
    mode,
    model,
    selectedTool,
    setModelIfChanged,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOutputId(null);
        setIsModelModalOpen(false);
        setModelModalAnchor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setDetailOutputId, setIsModelModalOpen, setModelModalAnchor]);
};
