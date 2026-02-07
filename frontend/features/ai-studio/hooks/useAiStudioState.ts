/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  falNanoBananaAllowedAspects,
  falNanoBananaProAllowedAspects,
  modelOptions,
} from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";
import type { ModelModalContext } from "../components/ModelModal";
import {
  createKeiTask,
  fetchKeiTaskStatus,
  KeiTaskStatus,
} from "../../../lib/keiClient";
import {
  submitFalFlux2,
  submitFalFlux2Klein,
  submitFalFlux2Edit,
  submitFalFlux2ProEdit,
  submitFalFlux2Pro,
  submitFalKlingV26Text,
  submitFalKlingV25,
  submitFalKlingV25Text,
  submitFalKlingV3ImageToVideo,
  submitFalKlingV3Text,
  submitFalKlingMotionControl,
  submitFalSeedance,
  submitFalSeedream,
  submitFalVeo,
  submitFalVeoFirstLast,
  submitFalNanoBanana,
  submitFalNanoBananaEdit,
  submitFalNanoBananaPro,
  submitFalNanoBananaProEdit,
  submitFalSoraPro,
} from "../../../lib/falClient";
import { DEFAULT_KLING_DURATION_SECONDS, computeCostForModel, falSizeForAspect, getModelConfig } from "../logic/pricing";
import { postGeneratePrompt, TEXT_PROMPT_MODEL_ID } from "../logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../logic/imageDescription";
import { estimateDescribeTokens, estimatePromptTokens } from "../logic/tokenEstimates";
import type { AgentContext, AgentMediaPreview, AgentReferenceSummary } from "../../ai-agent/types";
import type { FalKlingTextSubmitRequest } from "../../../lib/falClient";
import {
  Provider,
  computeModalPosition,
  extractFalMediaUrls,
  extractResultUrls,
  isVideoUrl,
  normalizeAspectForFalNanoBanana,
  normalizeAspectForFalNanoBananaPro,
  normalizeAspectForKei,
  resolvePreviewUrlById,
  resolveKlingAspectRatio,
  resolveKlingDuration,
  resolveKlingV3Duration,
  resolveModelLabel,
  resolveSeedreamImageSize,
  resolveSoraDuration,
  mapUploadsFromFiles,
} from "../logic/stateParsers";
import { useAiStudioTasks } from "./useAiStudioTasks";

const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS; // current general fallback (10s)
const KLING_MOTION_CONTROL_MODEL = "fal-ai/kling-video/v2.6/pro/motion-control";
type KlingAspect = FalKlingTextSubmitRequest["aspect_ratio"];

type ModelModalPosition = { top: number; left: number };

/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
type AiStudioStateOptions = {
  onDebitCredits?: (credits: number, reason: string, refId?: string) => Promise<void> | void;
};

export const useAiStudioState = ({ onDebitCredits }: AiStudioStateOptions = {}) => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");

  // Output management
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // UI selections and references (tracked per workflow)
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [showCreateTools, setShowCreateTools] = useState<boolean>(false);
  const [imageReferenceImageUrl, setImageReferenceImageUrl] = useState<string | null>(null);
  const [imageExtraImageUrls, setImageExtraImageUrls] = useState<[string | null, string | null, string | null]>([
    null,
    null,
    null,
  ]);
  const [videoReferenceImageUrl, setVideoReferenceImageUrl] = useState<string | null>(null);
  const [videoExtraImageUrls, setVideoExtraImageUrls] = useState<[string | null, string | null, string | null]>([
    null,
    null,
    null,
  ]);
  const [videoReferenceMode, setVideoReferenceMode] = useState<"standard" | "keyframes" | "motion">("standard");
  const [motionCharacterUrl, setMotionCharacterUrl] = useState<string | null>(null);
  const [motionReferenceVideoUrl, setMotionReferenceVideoUrl] = useState<string | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(6);
  const [videoResolution, setVideoResolution] = useState<string>("1080p");
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<boolean>(false);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [modelModalAnchor, setModelModalAnchor] = useState<string | null>(null);
  const [modelModalContext, setModelModalContext] = useState<ModelModalContext | null>(null);
  const [modelModalPosition, setModelModalPosition] = useState<ModelModalPosition | null>(null);
  const [isPromptGenerating, setIsPromptGenerating] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const pollTimersRef = useRef<Record<string, number>>({});
  const lastVideoReferenceModeRef = useRef(videoReferenceMode);
  const lastNonMotionVideoModelRef = useRef<string | null>(null);

  const activeOutput = useMemo(
    () => outputs.find((item) => item.id === activeOutputId) ?? null,
    [activeOutputId, outputs],
  );
  const detailOutput = useMemo(
    () => outputs.find((item) => item.id === detailOutputId) ?? null,
    [detailOutputId, outputs],
  );
  const currentModelLabel = useMemo(() => resolveModelLabel(model ?? undefined), [model]);
  const setSharedPrompt = useCallback((value: string) => {
    setPrompt((prev) => (prev === value ? prev : value));
  }, []);

  const referenceText = prompt;
  const setReferenceText = setSharedPrompt;
  const isVideoReferenceTool = selectedTool === "video";
  const referenceImageUrl = isVideoReferenceTool ? videoReferenceImageUrl : imageReferenceImageUrl;
  const extraImageUrls = isVideoReferenceTool ? videoExtraImageUrls : imageExtraImageUrls;

  const allowedModelOptions = useMemo(() => {
    if (selectedTool === "video") {
      return modelOptions.filter(
        (opt) =>
          !opt.mediaType ||
          opt.mediaType === "image-to-video" ||
          opt.mediaType === "video" ||
          opt.mediaType === "multi",
      );
    }
    if ((selectedTool === "create" || selectedTool === "text") && mode === "video") {
      return modelOptions.filter((opt) => !opt.mediaType || opt.mediaType === "video" || opt.mediaType === "multi");
    }
    if ((selectedTool === "create" || selectedTool === "text") && mode === "image") {
      return modelOptions.filter((opt) => {
        const matchesMedia = !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsTextToImage);
      });
    }
    if (selectedTool === "image") {
      return modelOptions.filter((opt) => {
        const matchesMedia = !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsImageToImage);
      });
    }
    return modelOptions;
  }, [mode, selectedTool]);

  const setModel = useCallback((value: string | null) => {
    setModelState(value);
  }, []);

  const getDefaultDurationSeconds = useCallback((modelId: string | null) => {
    if (!modelId) return VIDEO_DEFAULT_DURATION_SECONDS;
    const config = getModelConfig(modelId);
    if (config?.defaultDurationSeconds) return config.defaultDurationSeconds;
    return VIDEO_DEFAULT_DURATION_SECONDS;
  }, []);

  // --- Lifecycle ----------------------------------------------------------
  useEffect(() => {
    document.body.classList.add("ai-studio-body");
    document.documentElement.classList.add("ai-studio-body");
    promptRef.current?.focus();
    return () => {
      document.body.classList.remove("ai-studio-body");
      document.documentElement.classList.remove("ai-studio-body");
    };
  }, []);

  useEffect(() => {
    if (!activeOutput?.previewUrl) {
      setUseReferenceImageIndicator(false);
    }
  }, [activeOutput?.previewUrl]);

  // Clamp aspect ratios when switching to a model with stricter constraints.
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
  }, [aspect, model]);

  useEffect(() => {
    if (!model) return;
    const config = getModelConfig(model);
    if (!config) return;
    const isVideoModel =
      config.mediaType === "video" || config.mediaType === "image-to-video" || config.mediaType === "multi";
    if (!isVideoModel) return;
    if (typeof config.defaultDurationSeconds === "number") {
      setVideoDurationSeconds(config.defaultDurationSeconds);
    }
    if (config.defaultResolution) {
      setVideoResolution(config.defaultResolution);
    }
    if (config.defaultAudio !== undefined) {
      setVideoGenerateAudio(config.defaultAudio);
    }
  }, [model]);

  // Keep motion control mode and model in sync without locking other tabs.
  useEffect(() => {
    const previousMode = lastVideoReferenceModeRef.current;
    if (videoReferenceMode !== previousMode) {
      lastVideoReferenceModeRef.current = videoReferenceMode;
    }

    if (videoReferenceMode === "motion") {
      if (model !== KLING_MOTION_CONTROL_MODEL) {
        lastNonMotionVideoModelRef.current = model;
        setModel(KLING_MOTION_CONTROL_MODEL);
      }
      return;
    }

    if (previousMode === "motion" && model === KLING_MOTION_CONTROL_MODEL) {
      const fallback = lastNonMotionVideoModelRef.current;
      if (fallback && fallback !== KLING_MOTION_CONTROL_MODEL) {
        setModel(fallback);
        return;
      }
      setModel(null);
      return;
    }

    if (model === "fal-ai/veo3.1/first-last-frame-to-video" && videoReferenceMode !== "keyframes") {
      setVideoReferenceMode("keyframes");
      return;
    }

    if (model === KLING_MOTION_CONTROL_MODEL && videoReferenceMode !== "motion") {
      setVideoReferenceMode("motion");
    }
  }, [model, setModel, setVideoReferenceMode, videoReferenceMode]);

  // Clear model selections that are not valid for the current tool.
  useEffect(() => {
    if (!model) return;
    const allowedValues = new Set(allowedModelOptions.map((opt) => opt.value));

    if (!allowedValues.has(model)) {
      setModel(null);
    }
  }, [
    allowedModelOptions,
    model,
    setModel,
  ]);

  // Escape closes modals; model modal repositions on viewport changes.
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
      const anchorEl = document.querySelector<HTMLElement>(`[data-model-anchor='${modelModalAnchor}']`);
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
  }, [isModelModalOpen, modelModalAnchor]);

  useEffect(
    () => () => {
      Object.values(pollTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    },
    [],
  );

  // --- Output + prompt actions -------------------------------------------
  const updateOutputById = useCallback((id: string, updater: (item: StudioOutput) => StudioOutput) => {
    setOutputs((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  }, []);


  const deleteOutput = useCallback((id: string) => {
    setOutputs((prev) => prev.filter((item) => item.id !== id));
    if (activeOutputId === id) {
      setActiveOutputId(null);
    }
  }, [activeOutputId]);

  const notifyGenerationFailure = useCallback(
    (outputId: string, message: string) => {
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
            errorMessage: message,
          };
        }),
      );
      const label = contextLabel ?? "Generation";
      setUiError(message ? `${label} failed: ${message}` : `${label} failed to complete.`);
    },
    [setOutputs, setUiError],
  );

  const { startPollingTask, clearPollTimer } = useAiStudioTasks({
    updateOutputById,
    notifyGenerationFailure,
    setUiError,
  });

  const updateOutputPrompt = useCallback((id: string, promptText: string) => {
    const nextPrompt = promptText.trim();
    if (!nextPrompt) return;
    updateOutputById(id, (item) => ({
      ...item,
      prompt: nextPrompt,
      previewText: item.previewText ? nextPrompt : item.previewText,
      timestamp: "Edited",
    }));
  }, [updateOutputById]);


  const submitTask = useCallback(
    async (
      promptArg: string | null | undefined,
      imageInputs: string[],
      options?: { modeOverride?: StudioMode; selectedToolOverride?: ToolId | null },
    ) => {
      setUiError(null);
      const effectiveMode = options?.modeOverride ?? mode;
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const cleanedPrompt = (promptArg ?? prompt).trim();

      if ((effectiveTool === "create" || effectiveTool === "text") && effectiveMode === "text") {
        // Text prompts are handled exclusively by the chat agent upstream.
        // Avoid invoking legacy refine/describe pipelines from here.
        setIsPromptGenerating(false);
        return;
      }
      if (!cleanedPrompt) {
        setUiError("Add a prompt to start a generation.");
        return;
      }

      // Intelligent API fallback: if no reference images provided, automatically use text-based APIs
      const hasReferenceImages = imageInputs && imageInputs.length > 0;
      const hasMotionReferences = Boolean(motionCharacterUrl && motionReferenceVideoUrl);
      let finalTool = effectiveTool;
      let finalModel = model;

      if (!hasReferenceImages && !hasMotionReferences) {
        // Fallback to text-based generation when no references exist
        if (effectiveTool === "image") {
          finalTool = "text"; // Fallback to text-to-image
          // Map image-to-image models to their text-to-image equivalents
          const imageToTextModelMap: Record<string, string> = {
            "fal/flux-2-pro/edit": "fal/flux-2-pro",
            "fal/flux-2/edit": "fal/flux-2",
            "fal-ai/nano-banana/edit": "fal-ai/nano-banana",
            "fal-ai/nano-banana-pro/edit": "fal-ai/nano-banana-pro",
          };
          if (model && imageToTextModelMap[model]) {
            finalModel = imageToTextModelMap[model];
          }
        } else if (effectiveTool === "video") {
          finalTool = "text"; // Fallback to text-to-video (will use video mode)
          // Map image-to-video models to their text-to-video equivalents
          const imageToVideoTextMap: Record<string, string> = {
            "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
            "fal-ai/kling-video/v3/pro/image-to-video": "fal-ai/kling-video/v3/pro/text-to-video",
            "fal-ai/veo3.1/first-last-frame-to-video": "fal-ai/veo3.1",
          };
          if (model && imageToVideoTextMap[model]) {
            finalModel = imageToVideoTextMap[model];
          }
        }
      }

      if (!finalModel) {
        setUiError("Pick a model to generate.");
        return;
      }
      const id = `out-${randomId()}`;
      const modelLabel = resolveModelLabel(finalModel);
      const isSeedreamModel = finalModel === "fal-ai/bytedance/seedream/v4.5/text-to-image";
      const isFalFlux2Model = finalModel === "fal/flux-2";
      const isFalFlux2KleinModel = finalModel === "fal-ai/flux-2/klein/9b";
      const isFalFlux2EditModel = finalModel === "fal/flux-2/edit";
      const isFalFlux2ProModel = finalModel === "fal/flux-2-pro";
      const isFalFlux2ProEditModel = finalModel === "fal/flux-2-pro/edit";
      const isFalNanoBananaModel = finalModel === "fal-ai/nano-banana";
      const isFalNanoBananaEditModel = finalModel === "fal-ai/nano-banana/edit";
      const isFalNanoBananaProModel = finalModel === "fal-ai/nano-banana-pro";
      const isFalNanoBananaProEditModel = finalModel === "fal-ai/nano-banana-pro/edit";
      const isSeedanceModel = finalModel === "fal-ai/bytedance/seedance/v1.5/pro/text-to-video";
      const isKling3TextModel = finalModel === "fal-ai/kling-video/v3/pro/text-to-video";
      const isKling3ImageModel = finalModel === "fal-ai/kling-video/v3/pro/image-to-video";
      const isKling25ImageModel = finalModel === "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
      const isKling25TextModel = finalModel === "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";
      const isKlingMotionControlModel = finalModel === "fal-ai/kling-video/v2.6/pro/motion-control";
      const isVeoFirstLastFrameModel = finalModel === "fal-ai/veo3.1/first-last-frame-to-video";
      const isVeoModel = finalModel === "fal-ai/veo3.1";
      const isKling26Model = finalModel === "fal-ai/kling-video/v2.6/pro/text-to-video";
      const isSoraModel = finalModel === "fal-ai/sora-2/text-to-video/pro";
      const modelConfig = finalModel ? getModelConfig(finalModel) : null;
      const useVideoSettings = selectedTool === "video";
      const requestedDurationSeconds = useVideoSettings
        ? videoDurationSeconds
        : getDefaultDurationSeconds(finalModel);
      const requestedResolution = useVideoSettings ? videoResolution : modelConfig?.defaultResolution;
      const requestedAudio = useVideoSettings ? videoGenerateAudio : modelConfig?.defaultAudio ?? true;

      // Normalize image inputs (supports blob/data URLs from drops).
      const preparedImageInputs = (
        await Promise.all(
          imageInputs.map(async (url) => {
            const normalized = await prepareImageUrl(url);
            return normalized ?? null;
          }),
        )
      ).filter((url): url is string => Boolean(url));
      const pulseReferenceImageUrl =
        finalTool === "image" && preparedImageInputs.length > 0
          ? preparedImageInputs[0]
          : undefined;
      const falReferencePayload = pulseReferenceImageUrl ? { image_url: pulseReferenceImageUrl, image_urls: preparedImageInputs.slice(0, 4) } : {};

      const nextOutput: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: effectiveMode,
        aspect,
        model: modelLabel,
        modelId: finalModel,
        status: "ready",
        taskState: "pending",
        timestamp: "Submitting...",
        errorMessage: null,
        previewUrl:
          isKlingMotionControlModel
            ? motionCharacterUrl ?? undefined
            : isVeoFirstLastFrameModel || isKling25ImageModel || isKling3ImageModel
              ? preparedImageInputs[0] ?? undefined
              : undefined,
      };

      const requiresImageReference = isKling25ImageModel || isKling3ImageModel;
      if (requiresImageReference && preparedImageInputs.length === 0) {
        setOutputs((prev) => [
          {
            ...nextOutput,
            taskState: "fail",
            status: "ready",
            timestamp: "Missing image",
            errorMessage: "Video generation requires an image URL.",
          },
          ...prev,
        ]);
        setSaved(false);
        return;
      }

      if (isKlingMotionControlModel && (!motionCharacterUrl || !motionReferenceVideoUrl)) {
        setOutputs((prev) => [
          {
            ...nextOutput,
            taskState: "fail",
            status: "ready",
            timestamp: "Missing motion references",
            errorMessage: "Motion control requires a character image and a motion reference video.",
          },
          ...prev,
        ]);
        setSaved(false);
        return;
      }

      if (isVeoFirstLastFrameModel && preparedImageInputs.length < 2) {
        setOutputs((prev) => [
          {
            ...nextOutput,
            taskState: "fail",
            status: "ready",
            timestamp: "Missing frames",
            errorMessage: "First/Last Frame generation requires both a first and last frame image.",
          },
          ...prev,
        ]);
        setSaved(false);
        return;
      }

      setOutputs((prev) => [nextOutput, ...prev]);
      setSaved(false);

      try {
        if (isKling3ImageModel) {
          const klingDuration = resolveKlingV3Duration(requestedDurationSeconds);
          const endImageUrl =
            videoReferenceMode === "keyframes" && preparedImageInputs.length > 1
              ? preparedImageInputs[1]
              : undefined;
          const { request_id } = await submitFalKlingV3ImageToVideo({
            prompt: cleanedPrompt,
            start_image_url: preparedImageInputs[0],
            end_image_url: endImageUrl,
            duration: klingDuration,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
            generate_audio: requestedAudio,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-kling-3");
          return;
        }

        if (isKling25ImageModel) {
          const klingDuration = resolveKlingDuration(requestedDurationSeconds);
          const { request_id } = await submitFalKlingV25({
            prompt: cleanedPrompt,
            image_url: preparedImageInputs[0],
            duration: klingDuration,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-kling-25");
          return;
        }

        if (isKlingMotionControlModel) {
          const characterUrl = motionCharacterUrl ? await prepareImageUrl(motionCharacterUrl) : null;
          if (!characterUrl) {
            notifyGenerationFailure(id, "Motion control requires a valid character image URL.");
            return;
          }
          if (motionReferenceVideoUrl?.startsWith("blob:")) {
            notifyGenerationFailure(id, "Motion control requires a hosted video URL (no local blobs).");
            return;
          }
          const { request_id } = await submitFalKlingMotionControl({
            prompt: cleanedPrompt,
            image_url: characterUrl,
            video_url: motionReferenceVideoUrl as string,
            keep_original_sound: true,
            character_orientation: "video",
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-kling");
          return;
        }

        if (isFalNanoBananaEditModel) {
          if (!preparedImageInputs.length) {
            notifyGenerationFailure(id, "Nano Banana Edit requires at least one reference image.");
            return;
          }
          const response = await submitFalNanoBananaEdit({
            prompt: cleanedPrompt,
            num_images: 1,
            aspect_ratio: falNanoBananaAllowedAspects.has(aspect) ? aspect : "auto",
            output_format: "png",
            image_urls: preparedImageInputs.slice(0, 8),
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: response.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(response.request_id, id, 0, "fal-nano-banana-edit");
          return;
        }

        if (isFalNanoBananaProEditModel) {
          if (!preparedImageInputs.length) {
            notifyGenerationFailure(id, "Nano Banana Pro Edit requires at least one reference image.");
            return;
          }
          const response = await submitFalNanoBananaProEdit({
            prompt: cleanedPrompt,
            num_images: 1,
            aspect_ratio: falNanoBananaProAllowedAspects.has(aspect) ? aspect : "auto",
            output_format: "png",
            resolution: (modelConfig?.defaultResolution as any) ?? "1K",
            image_urls: preparedImageInputs.slice(0, 8),
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: response.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(response.request_id, id, 0, "fal-nano-banana-pro-edit");
          return;
        }

        if (isKling25TextModel) {
          const klingDuration = resolveKlingDuration(requestedDurationSeconds);
          const { request_id } = await submitFalKlingV25Text({
            prompt: cleanedPrompt,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            duration: klingDuration,
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
            generate_audio: requestedAudio,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-kling");
          return;
        }

        if (isKling3TextModel) {
          const klingDuration = resolveKlingV3Duration(requestedDurationSeconds);
          const { request_id } = await submitFalKlingV3Text({
            prompt: cleanedPrompt,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            duration: klingDuration,
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
            generate_audio: requestedAudio,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-kling");
          return;
        }

        if (isSeedanceModel) {
          const normalizedAspect =
            modelConfig?.allowedAspects?.includes(aspect) && (aspect === "16:9" || aspect === "9:16" || aspect === "1:1")
              ? aspect
            : modelConfig?.defaultAspect ?? "16:9";
          const { request_id } = await submitFalSeedance({
            prompt: cleanedPrompt,
            duration: requestedDurationSeconds.toString(),
            aspect_ratio: normalizedAspect as "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9",
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
            generate_audio: requestedAudio,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-seedance");
          return;
        }

        if (isKling26Model) {
          const klingDuration = resolveKlingDuration(requestedDurationSeconds);
          const { request_id } = await submitFalKlingV26Text({
            prompt: cleanedPrompt,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            duration: klingDuration,
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
            generate_audio: requestedAudio,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-kling");
          return;
        }

        if (isVeoFirstLastFrameModel) {
          const normalizedAspect = aspect === "16:9" || aspect === "9:16" ? aspect : "auto";
          const durationSeconds = requestedDurationSeconds;
          const duration = durationSeconds <= 4 ? "4s" : durationSeconds <= 6 ? "6s" : "8s";
          const resolution = requestedResolution?.toLowerCase().includes("4k")
            ? "4k"
            : requestedResolution?.toLowerCase().includes("1080")
              ? "1080p"
              : "720p";
          const { request_id } = await submitFalVeoFirstLast({
            prompt: cleanedPrompt,
            first_frame_url: preparedImageInputs[0],
            last_frame_url: preparedImageInputs[1],
            aspect_ratio: normalizedAspect as "auto" | "16:9" | "9:16",
            duration,
            resolution,
            generate_audio: requestedAudio,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-veo");
          return;
        }

        if (isSoraModel) {
          const soraDuration = resolveSoraDuration(requestedDurationSeconds);
          const normalizedAspect =
            modelConfig?.allowedAspects?.includes(aspect) && (aspect === "16:9" || aspect === "9:16")
              ? aspect
            : (modelConfig?.defaultAspect as "16:9" | "9:16" | undefined) ?? "16:9";
          const resolution = requestedResolution?.toLowerCase().includes("720") ? "720p" : "1080p";
          const { request_id } = await submitFalSoraPro({
            prompt: cleanedPrompt,
            aspect_ratio: normalizedAspect as "16:9" | "9:16",
            duration: soraDuration,
            resolution: resolution as "720p" | "1080p",
            delete_video: true,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-sora");
          return;
        }

        if (isVeoModel) {
          const normalizedAspect = modelConfig?.allowedAspects?.includes(aspect) && (aspect === "16:9" || aspect === "9:16")
            ? aspect
            : (modelConfig?.defaultAspect as "16:9" | "9:16" | undefined) ?? "16:9";
          const resolution = requestedResolution?.toLowerCase().includes("4k")
            ? "4k"
            : requestedResolution?.toLowerCase().includes("720")
              ? "720p"
              : "1080p";
          const { request_id } = await submitFalVeo({
            prompt: cleanedPrompt,
            aspect_ratio: normalizedAspect as "16:9" | "9:16",
            duration: `${Math.max(4, Math.min(8, requestedDurationSeconds))}s`,
            resolution: resolution as "720p" | "1080p" | "4k",
            generate_audio: requestedAudio,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(request_id, id, 0, "fal-veo");
          return;
        }

        if (isFalFlux2Model) {
          const size = falSizeForAspect(aspect);
          const falResp = await submitFalFlux2({
            prompt: cleanedPrompt,
            image_size: { width: size.width, height: size.height },
            num_images: 1,
            output_format: "png",
            guidance_scale: 15,
            num_inference_steps: 41,
            enable_safety_checker: true,
            ...falReferencePayload,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: falResp.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(falResp.request_id, id, 0, "fal-flux2");
          return;
        }

        if (isFalFlux2KleinModel) {
          const size = falSizeForAspect(aspect);
          const falResp = await submitFalFlux2Klein({
            prompt: cleanedPrompt,
            image_size: { width: size.width, height: size.height },
            num_images: 1,
            output_format: "jpeg",
            num_inference_steps: 4,
            enable_safety_checker: true,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: falResp.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(falResp.request_id, id, 0, "fal-flux2-klein");
          return;
        }

        if (isFalFlux2EditModel) {
          if (!preparedImageInputs.length) {
            notifyGenerationFailure(id, "FLUX.2 Edit requires at least one reference image.");
            return;
          }
          const size = falSizeForAspect(aspect);
          const falResp = await submitFalFlux2Edit({
            prompt: cleanedPrompt,
            image_size: { width: size.width, height: size.height },
            num_images: 1,
            output_format: "png",
            guidance_scale: 2.5,
            num_inference_steps: 28,
            enable_safety_checker: false,
            image_urls: preparedImageInputs.slice(0, 4),
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: falResp.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(falResp.request_id, id, 0, "fal-flux2-edit");
          return;
        }

        if (isFalFlux2ProEditModel) {
          if (!preparedImageInputs.length) {
            notifyGenerationFailure(id, "FLUX.2 Pro Edit requires at least one reference image.");
            return;
          }
          const size = falSizeForAspect(aspect);
          const falResp = await submitFalFlux2ProEdit({
            prompt: cleanedPrompt,
            image_size: { width: size.width, height: size.height },
            num_images: 1,
            output_format: "png",
            guidance_scale: 2.5,
            num_inference_steps: 28,
            safety_tolerance: "5",
            enable_safety_checker: false,
            image_urls: preparedImageInputs.slice(0, 4),
          } as any);
          updateOutputById(id, (item) => ({
            ...item,
            taskId: falResp.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(falResp.request_id, id, 0, "fal-flux2-pro-edit");
          return;
        }

        if (isFalFlux2ProModel) {
          const size = falSizeForAspect(aspect);
          const falResp = await submitFalFlux2Pro({
            prompt: cleanedPrompt,
            image_size: { width: size.width, height: size.height },
            num_images: 1,
            output_format: "png",
            safety_tolerance: "5",
            enable_safety_checker: false,
            ...falReferencePayload,
          } as any);
          updateOutputById(id, (item) => ({
            ...item,
            taskId: falResp.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(falResp.request_id, id, 0, "fal-flux2-pro");
          return;
        }

        let taskId: string;
        let pollingProvider: Provider = "kei";

        if (isSeedreamModel) {
          const image_size = resolveSeedreamImageSize(aspect);
          const response = await submitFalSeedream({
            prompt: cleanedPrompt,
            image_size,
            num_images: 1,
            enable_safety_checker: true,
            output_format: "png",
            ...falReferencePayload,
          });
          taskId = response.request_id;
          pollingProvider = "fal-seedream";
        } else if (isFalNanoBananaModel) {
          const response = await submitFalNanoBanana({
            prompt: cleanedPrompt,
            num_images: 1,
            aspect_ratio: normalizeAspectForFalNanoBanana(aspect),
            output_format: "png",
            ...falReferencePayload,
          });
          taskId = response.request_id;
          pollingProvider = "fal-nano-banana";
        } else if (isFalNanoBananaProModel) {
          const response = await submitFalNanoBananaPro({
            prompt: cleanedPrompt,
            num_images: 1,
            aspect_ratio: normalizeAspectForFalNanoBananaPro(aspect),
            output_format: "png",
            resolution: (modelConfig?.defaultResolution as any) ?? "1K",
            ...falReferencePayload,
          });
          taskId = response.request_id;
          pollingProvider = "fal-nano-banana-pro";
        } else {
          const result = await createKeiTask({
            model: finalModel,
            input: {
              prompt: cleanedPrompt,
              image_input: preparedImageInputs,
              aspect_ratio: normalizeAspectForKei(aspect),
              resolution: "1K",
              output_format: "png",
            },
          });
          taskId = result.taskId;
        }

        updateOutputById(id, (item) => ({
          ...item,
          taskId,
          taskState: "running",
          timestamp: "Submitted",
        }));

        startPollingTask(taskId, id, 0, pollingProvider);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start generation";
        notifyGenerationFailure(id, message);
      }
    },
    [
      activeOutput,
      aspect,
      getDefaultDurationSeconds,
      model,
      mode,
      notifyGenerationFailure,
      onDebitCredits,
      outputs,
      prompt,
      motionCharacterUrl,
      motionReferenceVideoUrl,
      referenceImageUrl,
      selectedTool,
      startPollingTask,
      updateOutputById,
      useReferenceImageIndicator,
      videoReferenceMode,
    ],
  );

  const resolveReferenceInputsForTool = useCallback(
    (tool: ToolId | null) => {
      if (tool === "video") {
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
    [imageExtraImageUrls, imageReferenceImageUrl, videoExtraImageUrls, videoReferenceImageUrl],
  );

  const generateOutput = useCallback(
    (
      promptOverride?: string | null,
      options?: { modeOverride?: StudioMode; selectedToolOverride?: ToolId | null },
    ) => {
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } = resolveReferenceInputsForTool(effectiveTool);
      const imageInputs = [referenceUrl, ...extraUrls].filter((url): url is string => Boolean(url)).slice(0, 8);
      submitTask(promptOverride ?? prompt, imageInputs, options);
    },
    [prompt, resolveReferenceInputsForTool, selectedTool, submitTask],
  );

  const regenerateOutput = useCallback(() => {
    const promptToUse = prompt.trim();
    if (!promptToUse) return;
    const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } = resolveReferenceInputsForTool(selectedTool);
    const referencePool = [
      ...(useReferenceImageIndicator && activeOutput?.previewUrl ? [activeOutput.previewUrl] : []),
      referenceUrl,
      ...extraUrls,
    ];
    const imageInputs = referencePool.filter((url): url is string => Boolean(url)).slice(0, 8);
    submitTask(promptToUse, imageInputs);
  }, [activeOutput?.previewUrl, prompt, resolveReferenceInputsForTool, selectedTool, submitTask, useReferenceImageIndicator]);

  const saveActiveOutput = useCallback(
    (outputId?: string | null) => {
      const targetId = outputId ?? activeOutput?.id ?? null;
      if (!targetId) return;
      setOutputs((prev) =>
        prev.map((item) =>
          item.id === targetId ? { ...item, status: "saved", timestamp: "Saved" } : item,
        ),
      );
      if (!outputId) {
        setSaved(true);
      }
    },
    [activeOutput?.id],
  );

  const savePromptReference = useCallback((customPrompt?: string) => {
    const cleanedPrompt = (typeof customPrompt === "string" ? customPrompt : prompt).trim();
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
      status: "saved",
      timestamp: "Saved prompt",
      previewText: cleanedPrompt,
    };
    setOutputs((prev) => [promptReference, ...prev]);
  }, [prompt, mode, aspect, model]);

  const addAgentPromptReference = useCallback(
    (promptText: string, title?: string | null) => {
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
        status: "saved",
        timestamp: "Agent",
        // Always show the actual prompt text on the reference card.
        previewText: cleanedPrompt,
      };
      setOutputs((prev) => [promptReference, ...prev]);
      setSharedPrompt(cleanedPrompt);
    },
    [prompt, mode, aspect, model, setSharedPrompt],
  );

  const addOutputsFromFiles = useCallback(
    (files: FileList) => {
      const newEntries = mapUploadsFromFiles(files, mode, aspect, model, resolveModelLabel, randomId);
      if (!newEntries.length) return;
      setOutputs((prev) => [...newEntries, ...prev]);
    },
    [aspect, model, mode],
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
    setMotionCharacterUrl(null);
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
    [isVideoReferenceTool],
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
    [isVideoReferenceTool],
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
    [activeOutput, model, mode],
  );

  const openModelModal = useCallback(
    (anchorId: string, target: HTMLElement, context: ModelModalContext | null = null) => {
      setModelModalAnchor(anchorId);
      setModelModalContext(context);
      setModelModalPosition(computeModalPosition(target));
      setIsModelModalOpen(true);
    },
    [],
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
    motionCharacterUrl,
    setMotionCharacterUrl,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    videoGenerateAudio,
    setVideoGenerateAudio,
    referenceText,
    setReferenceText,
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
    savePromptReference,
    addAgentPromptReference,
    addOutputsFromFiles,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
    uiError,
    setUiError,
    getDefaultDurationSeconds,
    getAgentContext,
  };
};
