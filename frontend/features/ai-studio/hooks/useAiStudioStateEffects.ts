/**
 * Encapsulates lifecycle and synchronization effects for AI Studio state.
 */
import { useEffect, type MutableRefObject } from "react";
import { aspectOptions } from "../constants";
import { getModelConfig } from "../logic/pricing";
import { clampImageResolutionForModel } from "../logic/imageResolution";
import { computeModalPosition } from "../logic/stateParsers";
import type { ToolId } from "../types";

const KEYFRAME_COMPATIBLE_MODELS = new Set(["fal-ai/veo3.1/first-last-frame-to-video"]);
const allowedUiAspects = new Set(aspectOptions.map((option) => option.value));

type VideoReferenceMode = "standard" | "keyframes" | "kling3" | "motion";
type ModelModalPosition = { top: number; left: number };

type UseAiStudioStateEffectsArgs = {
  promptRef: MutableRefObject<HTMLTextAreaElement | null>;
  aspect: string;
  setAspect: (value: string) => void;
  activeOutputPreviewUrl?: string | null;
  setUseReferenceImageIndicator: (value: boolean) => void;
  model: string | null;
  selectedTool: ToolId | null;
  videoReferenceMode: VideoReferenceMode;
  setVideoReferenceMode: (value: VideoReferenceMode) => void;
  setModel: (value: string | null) => void;
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
  allowedModelValues: string[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  setDetailOutputId: (value: string | null) => void;
  setIsModelModalOpen: (value: boolean) => void;
  setModelModalAnchor: (value: string | null) => void;
  setModelModalPosition: (value: ModelModalPosition | null) => void;
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
  allowedModelValues,
  isModelModalOpen,
  modelModalAnchor,
  setDetailOutputId,
  setIsModelModalOpen,
  setModelModalAnchor,
  setModelModalPosition,
}: UseAiStudioStateEffectsArgs) => {
  useEffect(() => {
    document.body.classList.add("ai-studio-body");
    document.documentElement.classList.add("ai-studio-body");
    promptRef.current?.focus();
    return () => {
      document.body.classList.remove("ai-studio-body");
      document.documentElement.classList.remove("ai-studio-body");
    };
  }, [promptRef]);

  useEffect(() => {
    if (allowedUiAspects.has(aspect)) return;
    if (aspect === "21:9") {
      setAspect("16:9");
      return;
    }
    if (aspect === "9:21") {
      setAspect("9:16");
      return;
    }
    setAspect("9:16");
  }, [aspect, setAspect]);

  useEffect(() => {
    if (!activeOutputPreviewUrl) {
      setUseReferenceImageIndicator(false);
    }
  }, [activeOutputPreviewUrl, setUseReferenceImageIndicator]);

  useEffect(() => {
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
  }, [aspect, model, setAspect]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(videoDurationStorageKey, String(videoDurationSeconds));
    setHasUserVideoPrefs(true);
  }, [setHasUserVideoPrefs, videoDurationSeconds, videoDurationStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(videoResolutionStorageKey, videoResolution);
    setHasUserVideoPrefs(true);
  }, [setHasUserVideoPrefs, videoResolution, videoResolutionStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(imageResolutionStorageKey, imageResolution);
  }, [imageResolution, imageResolutionStorageKey]);

  useEffect(() => {
    if (!model) return;
    const config = getModelConfig(model);
    if (!config || config.mediaType !== "image") return;
    const clamped = clampImageResolutionForModel(model, imageResolution);
    if (clamped !== imageResolution) {
      setImageResolution(clamped);
    }
  }, [imageResolution, model, setImageResolution]);

  useEffect(() => {
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
  ]);

  useEffect(() => {
    if (selectedTool !== "video" && selectedTool !== "kling") return;
    const previousMode = lastVideoReferenceModeRef.current;
    if (videoReferenceMode !== previousMode) {
      lastVideoReferenceModeRef.current = videoReferenceMode;
    }

    if (videoReferenceMode === "kling3") {
      if (model !== "fal-ai/kling-video/v3/pro/image-to-video") {
        lastNonKling3VideoModelRef.current = model;
        setModel("fal-ai/kling-video/v3/pro/image-to-video");
      }
      return;
    }

    if (previousMode === "kling3" && model === "fal-ai/kling-video/v3/pro/image-to-video") {
      const fallback = lastNonKling3VideoModelRef.current;
      if (fallback && fallback !== "fal-ai/kling-video/v3/pro/image-to-video") {
        setModel(fallback);
        return;
      }
      setModel(null);
      return;
    }

    if (videoReferenceMode === "keyframes") {
      if (model && !KEYFRAME_COMPATIBLE_MODELS.has(model)) {
        lastNonKeyframesVideoModelRef.current = model;
        setModel("fal-ai/veo3.1/first-last-frame-to-video");
      } else if (!model) {
        setModel("fal-ai/veo3.1/first-last-frame-to-video");
      }
      return;
    }

    if (videoReferenceMode === "motion") {
      if (model !== "fal-ai/kling-video/v3/pro/image-to-video") {
        lastNonMotionVideoModelRef.current = model;
        setModel("fal-ai/kling-video/v3/pro/image-to-video");
      } else if (!model) {
        setModel("fal-ai/kling-video/v3/pro/image-to-video");
      }
      return;
    }

    if (model === "fal-ai/kling-video/v3/pro/image-to-video" && videoReferenceMode === "standard") {
      const fallback = lastNonMotionVideoModelRef.current ?? "fal-ai/veo3.1/image-to-video";
      setModel(fallback);
      return;
    }

    if (model === "fal-ai/veo3.1/first-last-frame-to-video" && videoReferenceMode === "standard") {
      const fallback = lastNonKeyframesVideoModelRef.current ?? "fal-ai/veo3.1/image-to-video";
      setModel(fallback);
      return;
    }
  }, [
    lastNonKeyframesVideoModelRef,
    lastNonKling3VideoModelRef,
    lastNonMotionVideoModelRef,
    lastVideoReferenceModeRef,
    model,
    selectedTool,
    setModel,
    setVideoReferenceMode,
    videoReferenceMode,
  ]);

  useEffect(() => {
    if (selectedTool !== "video") return;
    if (videoReferenceMode === "keyframes" || videoReferenceMode === "motion") return;
    if (videoReferenceMode === "kling3") {
      setVideoReferenceMode("standard");
    }
    if (model === "fal-ai/kling-video/v3/pro/image-to-video") {
      const fallback = lastNonKling3VideoModelRef.current;
      if (fallback && fallback !== "fal-ai/kling-video/v3/pro/image-to-video") {
        setModel(fallback);
      } else {
        setModel(null);
      }
    }
  }, [
    lastNonKling3VideoModelRef,
    model,
    selectedTool,
    setModel,
    setVideoReferenceMode,
    videoReferenceMode,
  ]);

  useEffect(() => {
    if (selectedTool !== "kling") return;
    if (videoReferenceMode !== "kling3") {
      setVideoReferenceMode("kling3");
    }
    if (model !== "fal-ai/kling-video/v3/pro/image-to-video") {
      setModel("fal-ai/kling-video/v3/pro/image-to-video");
    }
    if (!showCreateTools) {
      setShowCreateTools(true);
    }
  }, [
    model,
    selectedTool,
    setModel,
    setShowCreateTools,
    setVideoReferenceMode,
    showCreateTools,
    videoReferenceMode,
  ]);

  useEffect(() => {
    if (!model) return;
    const allowedValues = new Set(allowedModelValues);
    if (!allowedValues.has(model)) {
      setModel(null);
    }
  }, [allowedModelValues, model, setModel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOutputId(null);
        setIsModelModalOpen(false);
        setModelModalAnchor(null);
      }
    };

    const handleReposition = () => {
      if (!isModelModalOpen || !modelModalAnchor) return;
      const anchorEl = document.querySelector<HTMLElement>(
        `[data-model-anchor='${modelModalAnchor}']`
      );
      if (anchorEl) {
        setModelModalPosition(computeModalPosition(anchorEl));
      } else {
        setIsModelModalOpen(false);
        setModelModalAnchor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [
    isModelModalOpen,
    modelModalAnchor,
    setDetailOutputId,
    setIsModelModalOpen,
    setModelModalAnchor,
    setModelModalPosition,
  ]);
};
