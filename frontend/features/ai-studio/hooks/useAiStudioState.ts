/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  falNanoBananaAllowedAspects,
  falNanoBananaProAllowedAspects,
  keiAllowedAspects,
  klingAllowedAspects,
  modelOptions,
} from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";
import {
  createKeiTask,
  fetchKeiTaskStatus,
  KeiTaskStatus,
} from "../../../lib/keiClient";
import {
  fetchFalFlux2MaxStatus,
  fetchFalFlux2ProStatus,
  fetchFalFlux2Status,
  fetchFalKlingStatus,
  fetchFalKlingV25Status,
  fetchFalNanoBananaStatus,
  fetchFalNanoBananaProStatus,
  fetchFalStatus,
  fetchImagen4FastStatus,
  fetchFalSoraStatus,
  fetchFalSeedanceStatus,
  fetchFalSeedreamStatus,
  fetchFalVeoStatus,
  submitFalFlux2,
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
  submitFalNanoBananaPro,
  submitFalSoraPro,
} from "../../../lib/falClient";
import type { FalKlingTextSubmitRequest } from "../../../lib/falClient";
import { DEFAULT_KLING_DURATION_SECONDS, computeCostForModel, falSizeForAspect, getModelConfig } from "../logic/pricing";
import { postGeneratePrompt, TEXT_PROMPT_MODEL_ID } from "../logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../logic/imageDescription";
import { estimateDescribeTokens, estimatePromptTokens } from "../logic/tokenEstimates";

const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS; // current general fallback (10s)
type KlingAspect = FalKlingTextSubmitRequest["aspect_ratio"];

type ModelModalPosition = { top: number; left: number };
type Provider =
  | "kei"
  | "fal"
  | "fal-flux2"
  | "fal-flux2-pro"
  | "fal-flux2-max"
  | "fal-imagen4-fast"
  | "fal-kling"
  | "fal-kling-25"
  | "fal-nano-banana"
  | "fal-nano-banana-pro"
  | "fal-sora"
  | "fal-seedance"
  | "fal-seedream"
  | "fal-veo";

const computeModalPosition = (target: HTMLElement): ModelModalPosition => {
  const rect = target.getBoundingClientRect();
  const scrollY = window.scrollY || 0;
  const scrollX = window.scrollX || 0;
  const offsetX = 16;
  const top = rect.top + scrollY + rect.height / 2;
  const left = rect.right + scrollX + offsetX;
  return { top, left };
};

const resolveModelLabel = (value?: string) =>
  value ? modelOptions.find((opt) => opt.value === value)?.label ?? `Custom (${value})` : "Select model here";

const normalizeAspectForKei = (value: string) => (keiAllowedAspects.has(value) ? value : "auto");
const normalizeAspectForFalNanoBanana = (value: string) =>
  falNanoBananaAllowedAspects.has(value) ? value : "1:1";
const normalizeAspectForFalNanoBananaPro = (value: string) =>
  falNanoBananaProAllowedAspects.has(value) ? value : "4:5";
const resolveKlingAspectRatio = (value: string): KlingAspect =>
  (klingAllowedAspects.has(value) ? (value as KlingAspect) : "16:9");
const resolveKlingDuration = (seconds: number): FalKlingTextSubmitRequest["duration"] => (seconds <= 5 ? 5 : 10);
const resolveSoraDuration = (seconds: number): 4 | 8 | 12 => {
  if (seconds <= 4) return 4;
  if (seconds <= 8) return 8;
  return 12;
};
const resolveSeedreamImageSize = (aspect: string): string => {
  const normalized = aspect.trim();
  if (normalized === "1:1") return "square";
  if (normalized === "3:4" || normalized === "4:5" || normalized === "5:4") return "portrait_4_3";
  if (normalized === "4:3" || normalized === "3:2" || normalized === "21:9" || normalized === "16:9") return "landscape_16_9";
  if (normalized === "9:16" || normalized === "2:3") return "portrait_16_9";
  return "landscape_16_9";
};
const extractFalUrls = (status: any): string[] => {
  const direct = status?.images;
  if (Array.isArray(direct) && direct[0]?.url) return direct.map((img) => img?.url).filter(Boolean) as string[];
  const nested = status?.data?.images;
  if (Array.isArray(nested) && nested[0]?.url) return nested.map((img) => img?.url).filter(Boolean) as string[];
  const output = status?.output?.images;
  if (Array.isArray(output) && output[0]?.url) return output.map((img) => img?.url).filter(Boolean) as string[];
  return [];
};

const extractFalMediaUrls = (status: any): string[] => {
  const imageUrls = extractFalUrls(status);
  if (imageUrls.length) return imageUrls;
  const videos = status?.videos || status?.data?.videos || status?.output?.videos || status?.result?.videos;
  if (Array.isArray(videos) && videos[0]?.url) {
    return videos.map((vid) => vid?.url).filter(Boolean) as string[];
  }
  const videoUrl =
    status?.video?.url ||
    status?.data?.video?.url ||
    status?.output?.video?.url ||
    status?.result?.video?.url ||
    status?.data?.result?.video?.url ||
    status?.video_url ||
    status?.data?.video_url ||
    status?.output?.video_url ||
    status?.result?.video_url ||
    status?.data?.result?.video_url;
  return videoUrl ? [videoUrl] : [];
};

const extractResultUrls = (resultJson: KeiTaskStatus["resultJson"], fallback?: unknown): string[] => {
  if (!resultJson && fallback && typeof fallback === "object") {
    const urls = (fallback as any)?.resultUrls || (fallback as any)?.info?.result_urls;
    if (Array.isArray(urls)) return urls as string[];
    const videos = (fallback as any)?.videos || (fallback as any)?.data?.videos || (fallback as any)?.output?.videos;
    if (Array.isArray(videos) && videos[0]?.url) {
      return videos.map((vid: any) => vid?.url).filter(Boolean) as string[];
    }
    const videoUrl =
      (fallback as any)?.video?.url ||
      (fallback as any)?.data?.video?.url ||
      (fallback as any)?.output?.video?.url ||
      (fallback as any)?.video_url ||
      (fallback as any)?.data?.video_url ||
      (fallback as any)?.output?.video_url;
    if (videoUrl) return [videoUrl];
  }
  if (!resultJson) return [];
  if (typeof resultJson === "string") {
    try {
      const parsed = JSON.parse(resultJson);
      return extractResultUrls(parsed as any);
    } catch (error) {
      return [];
    }
  }
  if (typeof resultJson === "object" && resultJson) {
    const urls = (resultJson as any)?.resultUrls || (resultJson as any)?.info?.result_urls;
    if (Array.isArray(urls)) return urls as string[];
    const videos = (resultJson as any)?.videos || (resultJson as any)?.data?.videos || (resultJson as any)?.output?.videos;
    if (Array.isArray(videos) && videos[0]?.url) {
      return videos.map((vid: any) => vid?.url).filter(Boolean) as string[];
    }
    const videoUrl =
      (resultJson as any)?.video?.url ||
      (resultJson as any)?.data?.video?.url ||
      (resultJson as any)?.output?.video?.url ||
      (resultJson as any)?.video_url ||
      (resultJson as any)?.data?.video_url ||
      (resultJson as any)?.output?.video_url;
    if (videoUrl) return [videoUrl];
  }
  return [];
};

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
  const [mode, setMode] = useState<StudioMode>("image");
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
      return modelOptions.filter((opt) => !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi");
    }
    if (selectedTool === "image-to-image") {
      return modelOptions.filter((opt) => !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi");
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
  const clearPollTimer = useCallback((outputId: string) => {
    const timeoutId = pollTimersRef.current[outputId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete pollTimersRef.current[outputId];
    }
  }, []);

  const updateOutputById = useCallback((id: string, updater: (item: StudioOutput) => StudioOutput) => {
    setOutputs((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

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
      clearPollTimer(outputId);
      const label = contextLabel ?? "Generation";
      setUiError(message ? `${label} failed: ${message}` : `${label} failed to complete.`);
    },
    [clearPollTimer, setOutputs, setUiError],
  );

  const startPollingTask = useCallback(
    (taskId: string, outputId: string, attempt = 0, provider: Provider = "kei") => {
      const delay = Math.min(6000, 1200 + attempt * 400);
      const timeoutId = window.setTimeout(async () => {
        try {
          const status =
            provider === "fal"
              ? await fetchFalStatus(taskId)
              : provider === "fal-flux2"
                ? await fetchFalFlux2Status(taskId)
                : provider === "fal-flux2-pro"
                  ? await fetchFalFlux2ProStatus(taskId)
                  : provider === "fal-flux2-max"
                    ? await fetchFalFlux2MaxStatus(taskId)
                    : provider === "fal-imagen4-fast"
                      ? await fetchImagen4FastStatus(taskId)
            : provider === "fal-kling"
              ? await fetchFalKlingStatus(taskId)
              : provider === "fal-kling-25"
                ? await fetchFalKlingV25Status(taskId)
                : provider === "fal-seedance"
                  ? await fetchFalSeedanceStatus(taskId)
                  : provider === "fal-sora"
                    ? await fetchFalSoraStatus(taskId)
                    : provider === "fal-seedream"
                      ? await fetchFalSeedreamStatus(taskId)
                    : provider === "fal-veo"
                      ? await fetchFalVeoStatus(taskId)
                      : provider === "fal-nano-banana"
                        ? await fetchFalNanoBananaStatus(taskId)
                        : provider === "fal-nano-banana-pro"
                        ? await fetchFalNanoBananaProStatus(taskId)
                        : await fetchKeiTaskStatus(taskId);
          const stateRaw =
            (status as any)?.status?.toString().toLowerCase() ??
            (status as any)?.state?.toString().toLowerCase() ??
            "pending";
          const state = stateRaw === "succeeded" ? "success" : stateRaw;

          if (state === "success" || state === "completed") {
            const falImages = (status as any)?.data?.images;
            const falUrl = Array.isArray(falImages) ? falImages[0]?.url : undefined;
            const falUrls = falUrl ? [falUrl] : extractFalMediaUrls(status);
            const resultUrls = (status as any)?.resultUrls?.length
              ? (status as any)?.resultUrls
              : extractResultUrls((status as any)?.resultJson, (status as any)?.raw);

            // If Fal reports success but no media URLs are present yet, keep polling a few extra times.
            const allUrls = falUrls.length ? falUrls : resultUrls;
            const hasMedia = allUrls.length > 0;
            const shouldRetryForMedia = !hasMedia && attempt < 3;
            if (shouldRetryForMedia) {
              updateOutputById(outputId, (item) => ({
                ...item,
                taskState: "running",
                status: "processing",
                timestamp: "Waiting for media...",
              }));
              pollTimersRef.current[outputId] = window.setTimeout(
                () => startPollingTask(taskId, outputId, attempt + 1, provider),
                delay,
              );
              return;
            }

            updateOutputById(outputId, (item) => ({
              ...item,
              taskState: "success",
              status: "ready",
              timestamp: "Just now",
              resultUrls: allUrls,
              previewUrl: allUrls[0] ?? item.previewUrl,
              errorMessage: null,
            }));
            clearPollTimer(outputId);
            return;
          }

          if (state === "fail" || state === "error") {
            const failureMessage =
              (status as any)?.failMsg ||
              (status as any)?.failCode ||
              (status as any)?.error ||
              "Generation failed";
            notifyGenerationFailure(outputId, failureMessage);
            return;
          }

          updateOutputById(outputId, (item) => ({
            ...item,
            taskState: (state as StudioOutput["taskState"]) ?? "running",
            timestamp: "Processing...",
          }));
          pollTimersRef.current[outputId] = window.setTimeout(
            () => startPollingTask(taskId, outputId, attempt + 1, provider),
            delay,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to check status";
          if (attempt >= 4 || message.includes("404")) {
            notifyGenerationFailure(outputId, message);
            return;
          }
          pollTimersRef.current[outputId] = window.setTimeout(
            () => startPollingTask(taskId, outputId, attempt + 1, provider),
            delay,
          );
        }
      }, delay);
      pollTimersRef.current[outputId] = timeoutId;
    },
    [clearPollTimer, notifyGenerationFailure, updateOutputById],
  );

  const submitTask = useCallback(
    async (promptText: string, imageInputs: string[]) => {
      setUiError(null);
      const cleanedPrompt = promptText.trim();
      const allowEmptyPrompt = mode === "enhance" && useReferenceImageIndicator;
      if (!cleanedPrompt && !allowEmptyPrompt) {
        setUiError("Add a prompt to start a generation.");
        return;
      }
      // Text mode uses AI prompt refinement and saves to the grid without image/video generation.
      if (mode === "enhance") {
        // Image-to-text describe flow (Agent 2) when reference toggle is on.
        if (useReferenceImageIndicator) {
          // Force describe-image workflow and ignore user-typed prompt input when toggle is active.
          const fallbackPreview = outputs.find((item) => item.previewUrl)?.previewUrl;
          const rawImageUrl = activeOutput?.previewUrl || referenceImageUrl || imageInputs[0] || fallbackPreview;
          const imageUrl = await prepareImageUrl(rawImageUrl ?? "");
          if (!imageUrl) {
            setUiError("Image describe requires an uploaded or generated image. Add a reference from the grid first.");
            setIsPromptGenerating(false);
            return;
          }
          setSaved(false);
          setIsPromptGenerating(true);
          try {
            const result = await postDescribeImage(imageUrl);
            const description = result?.description;
            if (description) {
              setPrompt(description);
              const promptId = `prompt-${randomId()}`;
              const promptReference: StudioOutput = {
                id: promptId,
                prompt: description,
                mode,
                aspect,
                model: "Image Describer (Agent 2)",
                modelId: "OPENAI_PROMPT_IMAGE_DESCRIBE",
                status: "saved",
                timestamp: "Saved prompt",
                previewText: description,
              };
              setOutputs((prev) => [promptReference, ...prev]);
              setActiveOutputId(promptId);
              setSaved(true);
              if (onDebitCredits) {
                const tokenEstimate =
                  result?.usage?.inputTokens || result?.usage?.outputTokens
                    ? {
                        inputTokens: result?.usage?.inputTokens ?? 0,
                        outputTokens: result?.usage?.outputTokens ?? 0,
                      }
                    : estimateDescribeTokens(description);
                const cost = computeCostForModel(TEXT_PROMPT_MODEL_ID, tokenEstimate);
                if (cost?.credits) {
                  const reason = "Image describer (Agent 2)";
                  Promise.resolve(onDebitCredits(cost.credits, reason, promptId)).catch(() => {});
                }
              }
            } else {
              setUiError("Image description failed. Check the image and try again.");
            }
          } finally {
            setIsPromptGenerating(false);
          }
          return;
        }

        setSaved(false);
        setIsPromptGenerating(true);
        let finalPrompt = cleanedPrompt;
        let observedTokens = estimatePromptTokens(cleanedPrompt);
        try {
          const result = await postGeneratePrompt(cleanedPrompt);
          if (result?.prompt) {
            setPrompt(result.prompt);
            finalPrompt = result.prompt;
            observedTokens = {
              inputTokens: result?.usage?.inputTokens ?? observedTokens.inputTokens,
              outputTokens: result?.usage?.outputTokens ?? observedTokens.outputTokens,
            };
          } else {
            setUiError("Prompt generation failed. Verify API key/model and try again.");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Prompt generation failed.";
          setUiError(message);
          // fall back to user-provided prompt
        } finally {
          setIsPromptGenerating(false);
        }
        const promptId = `prompt-${randomId()}`;

        if (onDebitCredits) {
          const cost = computeCostForModel(TEXT_PROMPT_MODEL_ID, observedTokens);
          if (cost?.credits) {
            const reason = `${TEXT_PROMPT_MODEL_ID} prompt refinement`;
            Promise.resolve(onDebitCredits(cost.credits, reason, promptId)).catch(() => {});
          }
        }
        const promptReference: StudioOutput = {
          id: promptId,
          prompt: finalPrompt,
          mode,
          aspect,
          model: resolveModelLabel(TEXT_PROMPT_MODEL_ID),
          modelId: TEXT_PROMPT_MODEL_ID,
          status: "saved",
          timestamp: "Saved prompt",
          previewText: finalPrompt,
        };
        setOutputs((prev) => [promptReference, ...prev]);
        setActiveOutputId(promptId);
        setSaved(true);
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
      const isFalFlux2ProModel = model === "fal/flux-2-pro";
      const isFalFlux2MaxModel = model === "fal/flux-2-max";
      const isFalNanoBananaModel = model === "fal-ai/nano-banana";
      const isFalNanoBananaProModel = model === "fal-ai/nano-banana-pro";
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

        if (isImagen4FastModel) {
          const normalizedAspect = modelConfig?.allowedAspects?.includes(aspect)
            ? aspect
            : modelConfig?.defaultAspect ?? "1:1";
          const falResp = await submitImagen4Fast({
            prompt: cleanedPrompt,
            aspect_ratio: normalizedAspect as "1:1",
            num_images: 1,
            output_format: "png",
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
          });
          taskId = response.request_id;
          pollingProvider = "fal-seedream";
        } else if (isFalNanoBananaModel) {
          const response = await submitFalNanoBanana({
            prompt: cleanedPrompt,
            num_images: 1,
            aspect_ratio: normalizeAspectForFalNanoBanana(aspect),
            output_format: "png",
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
    [aspect, getDefaultDurationSeconds, model, mode, notifyGenerationFailure, setOutputs, startPollingTask, updateOutputById],
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

  const addOutputsFromFiles = useCallback(
    (files: FileList) => {
      const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (!imageFiles.length) return;
      setOutputs((prev) => {
        const newEntries: StudioOutput[] = imageFiles.map((file) => {
          const url = URL.createObjectURL(file);
          return {
            id: `upload-${randomId()}`,
            prompt: file.name,
            mode,
            aspect,
            model: resolveModelLabel(model),
            modelId: model,
            status: "ready",
            timestamp: "Dropped",
            previewUrl: url,
          };
        });
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

  const resolvePreviewUrlById = useCallback(
    (id: string | null | undefined) => outputs.find((item) => item.id === id)?.previewUrl ?? null,
    [outputs],
  );

  const setExtraImageUrl = useCallback((index: number, url: string | null) => {
    setExtraImageUrls((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = url;
      return next;
    });
  }, []);

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
    addOutputsFromFiles,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    uiError,
    setUiError,
    getDefaultDurationSeconds,
  };
};
