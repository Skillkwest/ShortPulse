/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { falImageSizeMap, keiAllowedAspects, modelOptions, gptImageAllowedAspects } from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";
import {
  createKeiTask,
  fetchKeiTaskStatus,
  KeiTaskStatus,
  createKeiGpt4oTask,
} from "../../../lib/keiClient";
import { fetchFalStatus, submitFalFlux } from "../../../lib/falClient";
import { falSizeForAspect } from "../logic/pricing";
import { postGeneratePrompt } from "../logic/promptGeneration";

type ModelModalPosition = { top: number; left: number };

const computeModalPosition = (target: HTMLElement): ModelModalPosition => {
  const rect = target.getBoundingClientRect();
  const scrollY = window.scrollY || 0;
  const scrollX = window.scrollX || 0;
  const offsetX = 16;
  const top = rect.top + scrollY + rect.height / 2;
  const left = rect.right + scrollX + offsetX;
  return { top, left };
};

const resolveModelLabel = (value: string) =>
  modelOptions.find((opt) => opt.value === value)?.label ?? `Custom (${value})`;

const normalizeAspectForKei = (value: string) => (keiAllowedAspects.has(value) ? value : "auto");
const normalizeAspectForGptImage = (value: string) => (gptImageAllowedAspects.has(value) ? value : "1:1");
const mapAspectToFalSize = (value: string) => falImageSizeMap[value] ?? "landscape_4_3";

const extractFalUrls = (status: any): string[] => {
  const direct = status?.images;
  if (Array.isArray(direct) && direct[0]?.url) return direct.map((img) => img?.url).filter(Boolean) as string[];
  const nested = status?.data?.images;
  if (Array.isArray(nested) && nested[0]?.url) return nested.map((img) => img?.url).filter(Boolean) as string[];
  const output = status?.output?.images;
  if (Array.isArray(output) && output[0]?.url) return output.map((img) => img?.url).filter(Boolean) as string[];
  return [];
};

const extractResultUrls = (resultJson: KeiTaskStatus["resultJson"], fallback?: unknown): string[] => {
  if (!resultJson && fallback && typeof fallback === "object") {
    const urls = (fallback as any)?.resultUrls || (fallback as any)?.info?.result_urls;
    if (Array.isArray(urls)) return urls as string[];
  }
  if (!resultJson) return [];
  if (typeof resultJson === "string") {
    try {
      const parsed = JSON.parse(resultJson);
      return Array.isArray((parsed as any)?.resultUrls) ? (parsed as any).resultUrls : [];
    } catch (error) {
      return [];
    }
  }
  if (typeof resultJson === "object" && "resultUrls" in resultJson) {
    const urls = (resultJson as { resultUrls?: unknown }).resultUrls;
    return Array.isArray(urls) ? (urls as string[]) : [];
  }
  return [];
};

/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
export const useAiStudioState = () => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("image");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModel] = useState<string>(modelOptions[0]?.value ?? "nano-banana-pro");
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
  const pollTimersRef = useRef<Record<string, number>>({});

  const activeOutput = useMemo(
    () => outputs.find((item) => item.id === activeOutputId) ?? outputs[0] ?? null,
    [activeOutputId, outputs],
  );
  const detailOutput = useMemo(
    () => outputs.find((item) => item.id === detailOutputId) ?? null,
    [detailOutputId, outputs],
  );
  const currentModelLabel = useMemo(() => resolveModelLabel(model), [model]);

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
    (taskId: string, outputId: string, attempt = 0, provider: "kei" | "fal" = "kei") => {
      const delay = Math.min(6000, 1200 + attempt * 400);
      const timeoutId = window.setTimeout(async () => {
        try {
          const status = provider === "fal" ? await fetchFalStatus(taskId) : await fetchKeiTaskStatus(taskId);
          const stateRaw =
            (status as any)?.status?.toString().toLowerCase() ??
            (status as any)?.state?.toString().toLowerCase() ??
            "pending";
          const state = stateRaw === "succeeded" ? "success" : stateRaw;

          if (state === "success" || state === "completed") {
            const falImages = (status as any)?.data?.images;
            const falUrl = Array.isArray(falImages) ? falImages[0]?.url : undefined;
            const falUrls = falUrl ? [falUrl] : extractFalUrls(status);
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
      const cleanedPrompt = promptText.trim();
      if (!cleanedPrompt) return;
      // Text mode uses AI prompt refinement and saves to the grid without image/video generation.
      if (mode === "enhance") {
        setSaved(false);
        setIsPromptGenerating(true);
        let finalPrompt = cleanedPrompt;
        try {
          const refinedPrompt = await postGeneratePrompt(cleanedPrompt);
          if (refinedPrompt) {
            setPrompt(refinedPrompt);
            finalPrompt = refinedPrompt;
          }
        } catch {
          // no-op; fall back to user-provided prompt
        } finally {
          setIsPromptGenerating(false);
        }
        const promptId = `prompt-${randomId()}`;
        const promptReference: StudioOutput = {
          id: promptId,
          prompt: finalPrompt,
          mode,
          aspect,
          model: resolveModelLabel(model),
          modelId: model,
          status: "saved",
          timestamp: "Saved prompt",
          previewText: finalPrompt,
        };
        setOutputs((prev) => [promptReference, ...prev]);
        setActiveOutputId(promptId);
        setSaved(true);
        return;
      }

      const id = `out-${randomId()}`;
      const modelLabel = resolveModelLabel(model);
      const isGptImageModel = model === "gpt-image-1";
      const isSeedreamModel = model === "seedream/4.5-text-to-image";
      const isFalModel = model === "fal/flux-dev";

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
      };

      setOutputs((prev) => [nextOutput, ...prev]);
      setActiveOutputId(id);
      setSaved(false);

      try {
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
              filesUrl: imageInputs.slice(0, 5),
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
                image_input: imageInputs,
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
    const imageInputs = [referenceImageUrl, ...extraImageUrls]
      .filter((url): url is string => Boolean(url) && url.startsWith("http"))
      .slice(0, 8);
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
    const imageInputs = referencePool.filter((url): url is string => Boolean(url) && url.startsWith("http")).slice(0, 8);
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
    const promptReference: StudioOutput = {
      id,
      prompt: cleanedPrompt,
      mode,
      aspect,
      model: resolveModelLabel(model),
      modelId: model,
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
  };
};
