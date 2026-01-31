/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { modelOptions } from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";
import {
  createKeiTask,
  fetchKeiTaskStatus,
  KeiTaskStatus,
} from "../../../lib/keiClient";
import {
  submitFalFlux2,
  submitFalFlux2Edit,
  submitFalFlux2ProEdit,
  submitFalFlux2Max,
  submitFalFlux2Pro,
  submitFalKlingV26Text,
  submitFalKlingV25,
  submitFalKlingV25Text,
  submitFalSeedance,
  submitFalSeedream,
  submitFalVeo,
  submitImagen4Fast,
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
import type { AgentContext } from "../../ai-agent/types";
import type { FalKlingTextSubmitRequest } from "../../../lib/falClient";
import {
  Provider,
  computeModalPosition,
  extractFalMediaUrls,
  extractResultUrls,
  isVideoUrl,
  mapAgentMedia,
  mapAgentReferences,
  normalizeAspectForFalNanoBanana,
  normalizeAspectForFalNanoBananaPro,
  normalizeAspectForKei,
  resolvePreviewUrlById,
  resolveKlingAspectRatio,
  resolveKlingDuration,
  resolveModelLabel,
  resolveSeedreamImageSize,
  resolveSoraDuration,
  mapUploadsFromFiles,
} from "../logic/stateParsers";
import { useAiStudioTasks } from "./useAiStudioTasks";

const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS; // current general fallback (10s)
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
  const defaultImageModel = useMemo(() => modelOptions.find((opt) => opt.mediaType === "image")?.value ?? null, []);
  const defaultVideoModel = useMemo(() => modelOptions.find((opt) => opt.mediaType === "video")?.value ?? null, []);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("enhance");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [lastImageModel, setLastImageModel] = useState<string | null>(null);
  const [lastVideoModel, setLastVideoModel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");

  // Output management
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // UI selections and references (shared across tools)
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [showEditTools, setShowEditTools] = useState<boolean>(false);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [extraImageUrls, setExtraImageUrls] = useState<[string | null, string | null, string | null]>([
    null,
    null,
    null,
  ]);
  const [referenceText, setReferenceText] = useState<string | null>(null);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [modelModalAnchor, setModelModalAnchor] = useState<string | null>(null);
  const [modelModalPosition, setModelModalPosition] = useState<ModelModalPosition | null>(null);
  const [isPromptGenerating, setIsPromptGenerating] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const pollTimersRef = useRef<Record<string, number>>({});

  const activeOutput = useMemo(
    () => outputs.find((item) => item.id === activeOutputId) ?? outputs[0] ?? null,
    [activeOutputId, outputs],
  );
  const detailOutput = useMemo(
    () => outputs.find((item) => item.id === detailOutputId) ?? null,
    [detailOutputId, outputs],
  );
  const currentModelLabel = useMemo(() => resolveModelLabel(model ?? undefined), [model]);

  const modelMediaFilter = useMemo(() => {
    if (selectedTool === "create") {
      if (mode === "image") return "image";
      if (mode === "video") return "video";
    }
    if (selectedTool === "image-to-video") return "image-to-video";
    if (selectedTool === "image-to-image") return "image";
    return null;
  }, [mode, selectedTool]);

  const allowedModelOptions = useMemo(() => {
    if (selectedTool === "image-to-video") {
      return modelOptions.filter(
        (opt) =>
          !opt.mediaType ||
          opt.mediaType === "image-to-video" ||
          opt.mediaType === "video" ||
          opt.mediaType === "multi",
      );
    }
    if (selectedTool === "create" && mode === "video") {
      return modelOptions.filter((opt) => !opt.mediaType || opt.mediaType === "video" || opt.mediaType === "multi");
    }
    if (selectedTool === "create" && mode === "image") {
      return modelOptions.filter((opt) => {
        const matchesMedia = !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsTextToImage);
      });
    }
    if (selectedTool === "image-to-image") {
      return modelOptions.filter((opt) => {
        const matchesMedia = !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsImageToImage);
      });
    }
    return modelOptions;
  }, [mode, selectedTool]);

  const getMediaTypeForModel = useCallback((value: string | null) => {
    if (!value) return null;
    return modelOptions.find((opt) => opt.value === value)?.mediaType ?? null;
  }, []);

  const rememberModel = useCallback(
    (value: string | null) => {
      const mediaType = getMediaTypeForModel(value);
      if (mediaType === "image") {
        setLastImageModel(value);
      } else if (mediaType === "video") {
        setLastVideoModel(value);
      }
    },
    [getMediaTypeForModel],
  );

  const setModel = useCallback(
    (value: string | null) => {
      setModelState(value);
      rememberModel(value);
    },
    [rememberModel],
  );

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
    if (!activeOutputId && outputs.length > 0) {
      setActiveOutputId(outputs[0].id);
    }
  }, [activeOutputId, outputs]);

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

  // Keep model selection aligned with the current mode/tool filter and remember last picks per media type.
  useEffect(() => {
    if (!modelMediaFilter) return;
    const allowedValues = new Set(allowedModelOptions.map((opt) => opt.value));

    if (model && allowedValues.has(model)) {
      rememberModel(model);
      return;
    }

    let preferred: string | null = null;
    if (modelMediaFilter === "video") {
      preferred = lastVideoModel ?? defaultVideoModel;
    } else if (modelMediaFilter === "image") {
      preferred = lastImageModel ?? defaultImageModel;
    }

    const fallback = preferred && allowedValues.has(preferred) ? preferred : allowedModelOptions[0]?.value ?? null;
    setModel(fallback ?? null);
  }, [
    allowedModelOptions,
    defaultImageModel,
    defaultVideoModel,
    lastImageModel,
    lastVideoModel,
    model,
    modelMediaFilter,
    rememberModel,
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
    async (promptText: string, imageInputs: string[]) => {
      setUiError(null);
      const cleanedPrompt = promptText.trim();
      if (mode === "enhance") {
        // Enhance (text prompt) is handled exclusively by the chat agent upstream.
        // Avoid invoking legacy refine/describe pipelines from here.
        setIsPromptGenerating(false);
        return;
      }
      if (!cleanedPrompt) {
        setUiError("Add a prompt to start a generation.");
        return;
      }


      if (!model) {
        setUiError("Pick a model to generate.");
        return;
      }
      const id = `out-${randomId()}`;
      const modelLabel = resolveModelLabel(model);
      const isSeedreamModel = model === "fal-ai/bytedance/seedream/v4.5/text-to-image";
      const isFalFlux2Model = model === "fal/flux-2";
      const isFalFlux2EditModel = model === "fal/flux-2/edit";
      const isFalFlux2ProModel = model === "fal/flux-2-pro";
      const isFalFlux2ProEditModel = model === "fal/flux-2-pro/edit";
      const isFalFlux2MaxModel = model === "fal/flux-2-max";
      const isFalNanoBananaModel = model === "fal-ai/nano-banana";
      const isFalNanoBananaEditModel = model === "fal-ai/nano-banana/edit";
      const isFalNanoBananaProModel = model === "fal-ai/nano-banana-pro";
      const isFalNanoBananaProEditModel = model === "fal-ai/nano-banana-pro/edit";
      const isImagen4FastModel = model === "fal/imagen4/preview/fast";
      const isSeedanceModel = model === "fal-ai/bytedance/seedance/v1.5/pro/text-to-video";
      const isKling25ImageModel = model === "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
      const isKling25TextModel = model === "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";
      const isVeoModel = model === "fal-ai/veo3.1";
      const isKling26Model = model === "fal-ai/kling-video/v2.6/pro/text-to-video";
      const isSoraModel = model === "fal-ai/sora-2/text-to-video/pro";
      const modelConfig = model ? getModelConfig(model) : null;

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
        selectedTool === "image-to-image" && preparedImageInputs.length > 0
          ? preparedImageInputs[0]
          : undefined;
      const falReferencePayload = pulseReferenceImageUrl ? { image_url: pulseReferenceImageUrl, image_urls: preparedImageInputs.slice(0, 4) } : {};

      const nextOutput: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode,
        aspect,
        model: modelLabel,
        modelId: model,
        status: "ready",
        taskState: "pending",
        timestamp: "Submitting...",
        errorMessage: null,
        previewUrl: isKling25ImageModel ? preparedImageInputs[0] ?? undefined : undefined,
      };

      if (isKling25ImageModel && preparedImageInputs.length === 0) {
        setOutputs((prev) => [
          {
            ...nextOutput,
            taskState: "fail",
            status: "ready",
            timestamp: "Missing image",
            errorMessage: "Image-to-video requires an image URL.",
          },
          ...prev,
        ]);
        setActiveOutputId(id);
        setSaved(false);
        return;
      }

      setOutputs((prev) => [nextOutput, ...prev]);
      setActiveOutputId(id);
      setSaved(false);

      try {
        if (isKling25ImageModel) {
          const klingDuration = resolveKlingDuration(getDefaultDurationSeconds(model));
          const { request_id } = await submitFalKlingV25({
            prompt: cleanedPrompt,
            image_url: preparedImageInputs[0],
            duration: klingDuration.toString(),
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
            resolution: modelConfig?.defaultResolution ?? "1K",
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
          const klingDuration = resolveKlingDuration(getDefaultDurationSeconds(model));
          const { request_id } = await submitFalKlingV25Text({
            prompt: cleanedPrompt,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            duration: klingDuration,
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
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
            duration: getDefaultDurationSeconds(model).toString(),
            aspect_ratio: normalizedAspect as "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9",
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
            generate_audio: true,
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
          const klingDuration = resolveKlingDuration(getDefaultDurationSeconds(model));
          const { request_id } = await submitFalKlingV26Text({
            prompt: cleanedPrompt,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            duration: klingDuration,
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.5,
            generate_audio: true,
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

        if (isSoraModel) {
          const soraDuration = resolveSoraDuration(getDefaultDurationSeconds(model));
          const normalizedAspect =
            modelConfig?.allowedAspects?.includes(aspect) && (aspect === "16:9" || aspect === "9:16")
              ? aspect
              : (modelConfig?.defaultAspect as "16:9" | "9:16" | undefined) ?? "16:9";
          const resolution = modelConfig?.defaultResolution?.toLowerCase().includes("720") ? "720p" : "1080p";
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
          const resolution = modelConfig?.defaultResolution?.toLowerCase().includes("4k")
            ? "4k"
            : modelConfig?.defaultResolution?.toLowerCase().includes("720")
              ? "720p"
              : "1080p";
          const { request_id } = await submitFalVeo({
            prompt: cleanedPrompt,
            aspect_ratio: normalizedAspect as "16:9" | "9:16",
            duration: `${Math.max(4, Math.min(8, getDefaultDurationSeconds(model)))}s`,
            resolution: resolution as "720p" | "1080p" | "4k",
            generate_audio: true,
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

        if (isImagen4FastModel) {
          const normalizedAspect = modelConfig?.allowedAspects?.includes(aspect)
            ? aspect
            : modelConfig?.defaultAspect ?? "1:1";
          const falResp = await submitImagen4Fast({
            prompt: cleanedPrompt,
            aspect_ratio: normalizedAspect as "1:1",
            num_images: 1,
            output_format: "png",
            ...falReferencePayload,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: falResp.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(falResp.request_id, id, 0, "fal-imagen4-fast");
          return;
        }

        if (isFalFlux2MaxModel) {
          const size = falSizeForAspect(aspect);
          const falResp = await submitFalFlux2Max({
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
          startPollingTask(falResp.request_id, id, 0, "fal-flux2-max");
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
            resolution: modelConfig?.defaultResolution ?? "1K",
            ...falReferencePayload,
          });
          taskId = response.request_id;
          pollingProvider = "fal-nano-banana-pro";
        } else {
          const result = await createKeiTask({
            model,
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
      referenceImageUrl,
      selectedTool,
      startPollingTask,
      updateOutputById,
      useReferenceImageIndicator,
    ],
  );

  const generateOutput = useCallback(() => {
    const imageInputs = [referenceImageUrl, ...extraImageUrls].filter((url): url is string => Boolean(url)).slice(0, 8);
    submitTask(prompt, imageInputs);
  }, [extraImageUrls, prompt, referenceImageUrl, submitTask]);

  const regenerateOutput = useCallback(() => {
    const promptToUse = referenceText?.trim();
    if (!promptToUse) return;
    const referencePool = [
      ...(useReferenceImageIndicator && activeOutput?.previewUrl ? [activeOutput.previewUrl] : []),
      referenceImageUrl,
      ...extraImageUrls,
    ];
    const imageInputs = referencePool.filter((url): url is string => Boolean(url)).slice(0, 8);
    submitTask(promptToUse, imageInputs);
  }, [activeOutput?.previewUrl, extraImageUrls, referenceImageUrl, referenceText, submitTask, useReferenceImageIndicator]);

  const saveActiveOutput = useCallback(() => {
    if (!activeOutput) return;
    setOutputs((prev) =>
      prev.map((item) =>
        item.id === activeOutput.id ? { ...item, status: "saved", timestamp: "Saved" } : item,
      ),
    );
    setSaved(true);
  }, [activeOutput]);

  const savePromptReference = useCallback(() => {
    const cleanedPrompt = prompt.trim();
    if (!cleanedPrompt) return;
    const id = `prompt-${randomId()}`;
    const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
    const promptReference: StudioOutput = {
      id,
      prompt: cleanedPrompt,
      mode,
      aspect,
      model: placeholderModelLabel,
      modelId: model ?? undefined,
      status: "saved",
      timestamp: "Saved prompt",
      previewText: cleanedPrompt,
    };
    setOutputs((prev) => [promptReference, ...prev]);
    setActiveOutputId(id);
  }, [prompt, mode, aspect, model]);

  const addAgentPromptReference = useCallback(
    (promptText: string, title?: string | null) => {
      const cleanedPrompt = promptText?.trim();
      if (!cleanedPrompt) return;
      const id = `prompt-${randomId()}`;
      const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
      const previewLabel = title?.trim() || cleanedPrompt;
      const promptReference: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode,
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "saved",
        timestamp: "Agent",
        previewText: previewLabel,
      };
      setOutputs((prev) => [promptReference, ...prev]);
      setActiveOutputId(id);
      setPrompt(cleanedPrompt);
    },
    [prompt, mode, aspect, model],
  );

  const addOutputsFromFiles = useCallback(
    (files: FileList) => {
      const newEntries = mapUploadsFromFiles(files, mode, aspect, model, resolveModelLabel, randomId);
      if (!newEntries.length) return;
      setOutputs((prev) => {
        setActiveOutputId(newEntries[0].id);
        return [...newEntries, ...prev];
      });
    },
    [aspect, model, mode],
  );

  const toggleReferenceIndicator = useCallback(() => {
    if (!activeOutput?.previewUrl) return;
    setUseReferenceImageIndicator((prev) => !prev);
  }, [activeOutput?.previewUrl]);

  const clearReferenceImages = useCallback(() => {
    setReferenceImageUrl(null);
    setExtraImageUrls([null, null, null]);
  }, []);

  const setExtraImageUrl = useCallback((index: number, url: string | null) => {
    setExtraImageUrls((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = url;
      return next;
    });
  }, []);

  const agentReferences = useMemo(
    () => mapAgentReferences(outputs, activeOutputId),
    [outputs, activeOutputId],
  );

  const agentMedia = useMemo(() => mapAgentMedia(outputs), [outputs]);

  const getAgentContext = useCallback((): AgentContext => {
    return {
      activePrompt: prompt || null,
      modelId: model,
      mode,
      references: agentReferences,
      media: agentMedia,
      selectedReferenceIds: activeOutputId ? [activeOutputId] : [],
    };
  }, [activeOutputId, agentMedia, agentReferences, model, mode, prompt]);

  const openModelModal = useCallback((anchorId: string, target: HTMLElement) => {
    setModelModalAnchor(anchorId);
    setModelModalPosition(computeModalPosition(target));
    setIsModelModalOpen(true);
  }, []);

  const closeModelModal = useCallback(() => {
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
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
    showEditTools,
    setShowEditTools,
    referenceImageUrl,
    setReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    referenceText,
    setReferenceText,
    resolvePreviewUrlById,
    useReferenceImageIndicator,
    detailOutput,
    detailOutputId,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
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
    uiError,
    setUiError,
    getDefaultDurationSeconds,
    getAgentContext,
  };
};
