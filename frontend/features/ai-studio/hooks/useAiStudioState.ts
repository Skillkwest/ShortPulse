/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gptImageAllowedAspects, keiAllowedAspects, klingAllowedAspects, modelOptions } from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";
import {
  createKeiTask,
  fetchKeiTaskStatus,
  KeiTaskStatus,
  createKeiGpt4oTask,
} from "../../../lib/keiClient";
import { fetchFalKlingStatus, fetchFalStatus, submitFalFlux, submitFalKling, submitFalKlingText } from "../../../lib/falClient";
import { DEFAULT_KLING_DURATION_SECONDS, computeCostForModel, falSizeForAspect } from "../logic/pricing";
import { postGeneratePrompt, TEXT_PROMPT_MODEL_ID } from "../logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../logic/imageDescription";
import { estimateDescribeTokens, estimatePromptTokens } from "../logic/tokenEstimates";

type ModelModalPosition = { top: number; left: number };
type Provider = "kei" | "fal" | "fal-kling";

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
const normalizeAspectForGptImage = (value: string) => (gptImageAllowedAspects.has(value) ? value : "1:1");
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

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("image");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModel] = useState<string | null>(null);
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
    if (model === "gpt-image-1" && !gptImageAllowedAspects.has(aspect)) {
      setAspect("1:1");
    } else if (model === "seedream/4.5-text-to-image" && !keiAllowedAspects.has(aspect)) {
      setAspect("1:1");
    } else if ((model === "fal/kling-video-v1.6" || model === "fal/kling-video-v1.6-text") && !klingAllowedAspects.has(aspect)) {
      setAspect("16:9");
    }
  }, [aspect, model]);

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

  const startPollingTask = useCallback(
    (taskId: string, outputId: string, attempt = 0, provider: Provider = "kei") => {
      const delay = Math.min(6000, 1200 + attempt * 400);
      const timeoutId = window.setTimeout(async () => {
        try {
          const status =
            provider === "fal"
              ? await fetchFalStatus(taskId)
              : provider === "fal-kling"
                ? await fetchFalKlingStatus(taskId)
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
            updateOutputById(outputId, (item) => ({
              ...item,
              taskState: "success",
              status: "ready",
              timestamp: "Just now",
              resultUrls: falUrls.length ? falUrls : resultUrls,
              previewUrl: falUrls[0] ?? resultUrls[0] ?? item.previewUrl,
              errorMessage: null,
            }));
            clearPollTimer(outputId);
            return;
          }

          if (state === "fail" || state === "error") {
            updateOutputById(outputId, (item) => ({
              ...item,
              taskState: "fail",
              status: "ready",
              timestamp: "Failed",
              errorMessage:
                (status as any)?.failMsg ||
                (status as any)?.failCode ||
                (status as any)?.error ||
                "Generation failed",
            }));
            clearPollTimer(outputId);
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
            updateOutputById(outputId, (item) => ({
              ...item,
              taskState: "fail",
              status: "ready",
              timestamp: "Failed",
              errorMessage: message,
            }));
            clearPollTimer(outputId);
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
    [clearPollTimer, updateOutputById],
  );

  const submitTask = useCallback(
    async (promptText: string, imageInputs: string[]) => {
      setUiError(null);
      const cleanedPrompt = promptText.trim();
      const allowEmptyPrompt = mode === "enhance" && useReferenceImageIndicator;
      if (!cleanedPrompt && !allowEmptyPrompt) return;
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

      if (!model) return;
      const id = `out-${randomId()}`;
      const modelLabel = resolveModelLabel(model);
      const isGptImageModel = model === "gpt-image-1";
      const isSeedreamModel = model === "seedream/4.5-text-to-image";
      const isFalModel = model === "fal/flux-dev";
      const isKlingModel = model === "fal/kling-video-v1.6";
      const isKlingTextModel = model === "fal/kling-video-v1.6-text";
      const isKling25Model = model === "kling-2.5-turbo";
      const isVeoModel = model === "veo-3";

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
        previewUrl: isKlingModel || isKling25Model ? preparedImageInputs[0] ?? undefined : undefined,
      };

      if ((isKlingModel || isKling25Model) && preparedImageInputs.length === 0) {
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
        if (isKlingTextModel || isVeoModel) {
          const { request_id } = await submitFalKlingText({
            prompt: cleanedPrompt,
            aspect_ratio: klingAllowedAspects.has(aspect) ? aspect : "16:9",
            duration: DEFAULT_KLING_DURATION_SECONDS.toString(),
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

        if (isKlingModel || isKling25Model) {
          const { request_id } = await submitFalKling({
            prompt: cleanedPrompt,
            image_url: preparedImageInputs[0],
            duration: DEFAULT_KLING_DURATION_SECONDS.toString(),
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

        if (isFalModel) {
          const size = falSizeForAspect(aspect);
          const falResp = await submitFalFlux({
            prompt: cleanedPrompt,
            image_size: { width: size.width, height: size.height },
            num_images: 1,
            output_format: "jpeg",
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: falResp.request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingTask(falResp.request_id, id, 0, "fal");
          return;
        }

        const { taskId } = isGptImageModel
          ? await createKeiGpt4oTask({
              prompt: cleanedPrompt,
              filesUrl: preparedImageInputs.slice(0, 5),
              size: normalizeAspectForGptImage(aspect),
              isEnhance: false,
              enableFallback: false,
              uploadCn: false,
            })
          : isSeedreamModel
            ? await createKeiTask({
                model,
                input: {
                  prompt: cleanedPrompt,
                  aspect_ratio: keiAllowedAspects.has(aspect) ? aspect : "1:1",
                  quality: "basic",
                },
              })
          : await createKeiTask({
              model,
              input: {
                prompt: cleanedPrompt,
                image_input: preparedImageInputs,
                aspect_ratio: normalizeAspectForKei(aspect),
                resolution: "1K",
                output_format: "png",
              },
            });

        updateOutputById(id, (item) => ({
          ...item,
          taskId,
          taskState: "running",
          timestamp: "Submitted",
        }));

        startPollingTask(taskId, id);
      } catch (error) {
        updateOutputById(id, (item) => ({
          ...item,
          taskState: "fail",
          status: "ready",
          timestamp: "Failed",
          errorMessage: error instanceof Error ? error.message : "Failed to start generation",
        }));
      }
    },
    [aspect, model, mode, setOutputs, startPollingTask, updateOutputById],
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
  };
};
