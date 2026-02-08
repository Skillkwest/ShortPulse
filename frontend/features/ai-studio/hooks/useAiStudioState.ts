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
  submitFalKlingV3ImageToVideo,
  submitFalKlingV3Text,
  submitFalKlingMotionControl,
  submitFalSeedance,
  submitFalSeedream,
  submitFalVeo,
  submitFalVeoFirstLast,
  submitFalVeoImageToVideo,
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
import {
  createGenerationRecord,
  logMediaEvent,
  saveMediaUrlToLibrary,
  savePromptRecord,
  updateGenerationRecord,
} from "../logic/mediaLibraryPersistence";
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

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");

  // Output management
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const outputsRef = useRef<StudioOutput[]>([]);

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

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
  const VIDEO_DURATION_STORAGE_KEY = "aiStudioVideoDuration";
  const VIDEO_RESOLUTION_STORAGE_KEY = "aiStudioVideoResolution";

  const [videoReferenceMode, setVideoReferenceMode] = useState<"standard" | "keyframes" | "kling3">(
    "standard",
  );
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 6;
    const stored = window.localStorage.getItem(VIDEO_DURATION_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : 6;
  });
  const [videoResolution, setVideoResolution] = useState<string>(() => {
    if (typeof window === "undefined") return "1080p";
    const stored = window.localStorage.getItem(VIDEO_RESOLUTION_STORAGE_KEY);
    return stored || "1080p";
  });
  const [hasUserVideoPrefs, setHasUserVideoPrefs] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(VIDEO_DURATION_STORAGE_KEY) || window.localStorage.getItem(VIDEO_RESOLUTION_STORAGE_KEY));
  });
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<boolean>(false);
  const [klingNegativePrompt, setKlingNegativePrompt] = useState<string>("blur, distort, and low quality");
  const [klingCfgScale, setKlingCfgScale] = useState<number>(0.5);
  const [klingShotType, setKlingShotType] = useState<"customize" | "intelligent">("customize");
  const [klingVoiceIds, setKlingVoiceIds] = useState<[string, string]>(["", ""]);
  const [klingMultiPrompts, setKlingMultiPrompts] = useState<{ id: string; prompt: string; duration: number }[]>([]);
  const [klingElements, setKlingElements] = useState<
    { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
  >([{ id: randomId(), frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" }]);
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
  const lastNonKling3VideoModelRef = useRef<string | null>(null);
  const lastNonKeyframesVideoModelRef = useRef<string | null>(null);

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
  const isVideoReferenceTool = selectedTool === "video" || selectedTool === "kling";
  const referenceImageUrl = isVideoReferenceTool ? videoReferenceImageUrl : imageReferenceImageUrl;
  const extraImageUrls = isVideoReferenceTool ? videoExtraImageUrls : imageExtraImageUrls;

  const allowedModelOptions = useMemo(() => {
    if (selectedTool === "video" || selectedTool === "kling") {
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

  // Persist user-selected video duration/resolution for the session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIDEO_DURATION_STORAGE_KEY, String(videoDurationSeconds));
    setHasUserVideoPrefs(true);
  }, [videoDurationSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIDEO_RESOLUTION_STORAGE_KEY, videoResolution);
    setHasUserVideoPrefs(true);
  }, [videoResolution]);

  useEffect(() => {
    if (!model) return;
    const config = getModelConfig(model);
    if (!config) return;
    const isVideoModel =
      config.mediaType === "video" || config.mediaType === "image-to-video" || config.mediaType === "multi";
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
  }, [model, hasUserVideoPrefs]);

  // Keep reference mode and model in sync without locking other tabs.
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
      if (model !== "fal-ai/veo3.1/first-last-frame-to-video") {
        lastNonKeyframesVideoModelRef.current = model;
        setModel("fal-ai/veo3.1/first-last-frame-to-video");
      }
      return;
    }

    if (model === "fal-ai/veo3.1/first-last-frame-to-video" && videoReferenceMode === "standard") {
      const fallback = lastNonKeyframesVideoModelRef.current ?? "fal-ai/veo3.1/image-to-video";
      setModel(fallback);
      return;
    }

    if (model === "fal-ai/kling-video/v3/pro/image-to-video" && videoReferenceMode !== "kling3") {
      setVideoReferenceMode("kling3");
    }
  }, [model, selectedTool, setModel, setVideoReferenceMode, videoReferenceMode]);

  // If user leaves Kling tool back to Video, reset mode/model away from Kling.
  useEffect(() => {
    if (selectedTool !== "video") return;
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
  }, [model, selectedTool, setModel, setVideoReferenceMode, videoReferenceMode]);

  // When Kling tool is selected, force Kling defaults and collapse create list.
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
  }, [model, selectedTool, setModel, setVideoReferenceMode, showCreateTools]);

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

  const findOutputById = useCallback((id: string) => outputsRef.current.find((item) => item.id === id) ?? null, []);

  const markOutputSaved = useCallback(
    (
      outputId: string,
      mediaFileIds?: string[],
      options?: { showPill?: boolean; timestamp?: string; status?: "ready" | "saved" },
    ) => {
      const showPill = options?.showPill ?? true;
      updateOutputById(outputId, (item) => ({
        ...item,
        status: options?.status ?? "saved",
        timestamp: options?.timestamp ?? "Saved",
        saveState: showPill ? "saved" : item.saveState,
        saveError: showPill ? null : item.saveError,
        savedMediaIds: mediaFileIds?.length ? mediaFileIds : item.savedMediaIds,
      }));
    },
    [updateOutputById],
  );

  const markOutputSaveFailed = useCallback(
    (outputId: string, message: string, options?: { showPill?: boolean }) => {
      const showPill = options?.showPill ?? true;
      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: showPill ? "failed" : item.saveState,
        saveError: showPill ? message : item.saveError,
      }));
    },
    [updateOutputById],
  );

  const ensureGenerationRecord = useCallback(
    async ({
      outputId,
      provider,
      taskId,
      durationSeconds,
      resolution,
      metadata,
    }: {
      outputId: string;
      provider: Provider;
      taskId?: string;
      durationSeconds?: number;
      resolution?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      const output = findOutputById(outputId);
      if (!output) return null;
      if (output.generationId) {
        try {
          await updateGenerationRecord(output.generationId, {
            provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            durationSeconds,
            resolution: resolution ?? null,
            requestId: taskId ?? output.taskId ?? null,
            status: "running",
            metadata,
          });
        } catch (_error) {
          return output.generationId;
        }
        return output.generationId;
      }

      try {
        const generationId = await createGenerationRecord({
          mode: output.mode,
          provider,
          modelId: output.modelId ?? output.model,
          promptText: output.prompt,
          aspect: output.aspect,
          durationSeconds,
          resolution: resolution ?? null,
          requestId: taskId ?? output.taskId ?? null,
          status: "running",
          metadata,
        });
        if (generationId) {
          updateOutputById(outputId, (item) => ({ ...item, generationId }));
        }
        return generationId;
      } catch (_error) {
        return null;
      }
    },
    [createGenerationRecord, findOutputById, updateGenerationRecord, updateOutputById],
  );

  const persistPromptSave = useCallback(
    async ({ promptText, modelId }: { promptText: string; modelId?: string | null }) => {
      try {
        const promptId = await savePromptRecord({
          promptText,
          mode: "text",
          modelId: modelId ?? null,
          source: "manual",
        });
        if (promptId) {
          try {
            await logMediaEvent({
              eventType: "prompt_saved",
              entityType: "media_prompt",
              entityId: promptId,
            });
          } catch (_error) {
            // best-effort logging only
          }
        }
        return promptId;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save prompt.";
        setUiError(message);
        return null;
      }
    },
    [logMediaEvent, savePromptRecord, setUiError],
  );

  const persistMediaUrls = useCallback(
    async ({
      outputId,
      urls,
      provider,
      source,
      generationId,
    }: {
      outputId: string;
      urls: string[];
      provider: Provider;
      source: "upload" | "ai_studio";
      generationId?: string | null;
    }) => {
      const output = findOutputById(outputId);
      if (!output) return { mediaFileIds: [], errors: ["Output not found"] };
      const mediaFileIds: string[] = [];
      const errors: string[] = [];

      for (let index = 0; index < urls.length; index += 1) {
        try {
          const result = await saveMediaUrlToLibrary({
            url: urls[index],
            promptText: output.prompt,
            mode: output.mode,
            source,
            fileTypeHint: isVideoUrl(urls[index]) ? "video" : "image",
            provider,
            modelId: output.modelId ?? null,
            generationId: generationId ?? null,
            promptId: output.promptId ?? null,
            index,
            metadata: {
              task_id: output.taskId ?? null,
            },
          });
          if (result?.mediaFileId) {
            mediaFileIds.push(result.mediaFileId);
            try {
              const eventType = source === "ai_studio" ? "generation_saved" : "upload";
              await logMediaEvent({
                eventType,
                entityType: "media_file",
                entityId: result.mediaFileId,
                metadata: {
                  output_id: output.id,
                  provider,
                  storage_path: result.storagePath,
                },
              });
            } catch (_error) {
              // best-effort logging only
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to save media.";
          errors.push(message);
        }
      }

      if (errors.length && generationId && source === "ai_studio") {
        try {
          await logMediaEvent({
            eventType: "generation_failed",
            entityType: "ai_generation",
            entityId: generationId,
            metadata: {
              stage: "storage_upload",
              errors,
            },
          });
        } catch (_error) {
          // best-effort logging only
        }
      }

      return { mediaFileIds, errors };
    },
    [findOutputById, logMediaEvent, saveMediaUrlToLibrary],
  );


  const deleteOutput = useCallback((id: string) => {
    setOutputs((prev) => prev.filter((item) => item.id !== id));
    if (activeOutputId === id) {
      setActiveOutputId(null);
    }
  }, [activeOutputId]);

  const notifyGenerationFailure = useCallback(
    (outputId: string, message: string, detail?: string) => {
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
            errorMessageShort: message,
            errorDetail: detail ?? message,
          };
        }),
      );
      const label = contextLabel ?? "Generation";
      const detailMessage = detail ?? message;
      setUiError(detailMessage ? `${label} failed: ${detailMessage}` : `${label} failed to complete.`);
    },
    [setOutputs, setUiError],
  );

  const handleGenerationSuccess = useCallback(
    async ({ outputId, taskId, provider, resultUrls }: { outputId: string; taskId: string; provider: Provider; resultUrls: string[] }) => {
      const output = findOutputById(outputId);
      if (!output) return;
      if (output.savedMediaIds?.length) return;
      const generationId =
        output.generationId ??
        (await ensureGenerationRecord({
          outputId,
          provider,
          taskId,
        }));
      const urls = resultUrls.filter(Boolean);
      if (!urls.length) return;
      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: "saving",
        saveError: null,
      }));
      const { mediaFileIds, errors } = await persistMediaUrls({
        outputId,
        urls,
        provider,
        source: "ai_studio",
        generationId: generationId ?? null,
      });
      if (mediaFileIds.length) {
        markOutputSaved(outputId, mediaFileIds, { showPill: true });
      } else if (errors.length) {
        const message = errors[0] ?? "Unable to save media.";
        markOutputSaveFailed(outputId, message, { showPill: true });
      }
      if (generationId) {
        try {
          await updateGenerationRecord(generationId, {
            provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            requestId: taskId,
            status: "success",
            metadata: {
              result_urls: urls,
              media_file_ids: mediaFileIds,
            },
          });
        } catch (_error) {
          // best-effort update
        }
      }
    },
    [ensureGenerationRecord, findOutputById, markOutputSaveFailed, markOutputSaved, persistMediaUrls, updateGenerationRecord, updateOutputById],
  );

  const handleGenerationFailure = useCallback(
    async ({ outputId, taskId, provider, message }: { outputId: string; taskId?: string; provider: Provider; message: string }) => {
      const output = findOutputById(outputId);
      if (!output) return;
      const generationId =
        output.generationId ??
        (await ensureGenerationRecord({
          outputId,
          provider,
          taskId,
        }));
      if (generationId) {
        try {
          await updateGenerationRecord(generationId, {
            provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            requestId: taskId ?? output.taskId,
            status: "fail",
            metadata: {
              error: message,
            },
          });
          await logMediaEvent({
            eventType: "generation_failed",
            entityType: "ai_generation",
            entityId: generationId,
            metadata: {
              error: message,
              provider,
            },
          });
        } catch (_error) {
          // best-effort updates
        }
      }
    },
    [ensureGenerationRecord, findOutputById, logMediaEvent, updateGenerationRecord],
  );

  const { startPollingTask, clearPollTimer } = useAiStudioTasks({
    updateOutputById,
    notifyGenerationFailure,
    setUiError,
    onGenerationSuccess: handleGenerationSuccess,
    onGenerationFailure: handleGenerationFailure,
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
      const normalizedTool = effectiveTool === "kling" ? "video" : effectiveTool;
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
      let finalTool = effectiveTool;
      let finalModel = model;
      if (!hasReferenceImages) {
        // Fallback to text-based generation when no references exist
        if (normalizedTool === "image") {
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
        } else if (normalizedTool === "video") {
          finalTool = "text"; // Fallback to text-to-video (will use video mode)
          // Map image-to-video models to their text-to-video equivalents
          const imageToVideoTextMap: Record<string, string> = {
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
      const isVeoFirstLastFrameModel = finalModel === "fal-ai/veo3.1/first-last-frame-to-video";
      const isVeoImageToVideoModel = finalModel === "fal-ai/veo3.1/image-to-video";
      const isVeoModel = finalModel === "fal-ai/veo3.1";
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
        errorMessageShort: null,
        errorDetail: null,
        saveState: "idle",
        saveError: null,
        previewUrl: isVeoFirstLastFrameModel || isKling3ImageModel ? preparedImageInputs[0] ?? undefined : undefined,
      };

      const requiresImageReference = isKling3ImageModel || isVeoImageToVideoModel;
      if (requiresImageReference && preparedImageInputs.length === 0) {
        setOutputs((prev) => [
          {
            ...nextOutput,
            taskState: "fail",
            status: "ready",
            timestamp: "Missing image",
            errorMessage: "Video generation requires an image URL.",
            errorMessageShort: "Image URL required.",
            errorDetail: "Video generation requires an image URL.",
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
            errorMessageShort: "First/Last needs two images.",
            errorDetail: "First/Last Frame generation requires both a first and last frame image.",
          },
          ...prev,
        ]);
        setSaved(false);
        return;
      }

      if (isVeoImageToVideoModel && preparedImageInputs.length < 1) {
        setOutputs((prev) => [
          {
            ...nextOutput,
            taskState: "fail",
            status: "ready",
            timestamp: "Missing image",
            errorMessage: "Veo image-to-video requires a reference image.",
            errorMessageShort: "Reference image required.",
            errorDetail: "Veo image-to-video requires a reference image.",
          },
          ...prev,
        ]);
        setSaved(false);
        return;
      }

      setOutputs((prev) => [nextOutput, ...prev]);
      setSaved(false);

      try {
        const startPollingWithGeneration = (taskId: string, outputId: string, provider: Provider) => {
          updateOutputById(outputId, (item) => (item.provider ? item : { ...item, provider }));
          startPollingTask(taskId, outputId, 0, provider);
          void ensureGenerationRecord({
            outputId,
            provider,
            taskId,
            durationSeconds: requestedDurationSeconds,
            resolution: requestedResolution ?? null,
            metadata: {
              tool: effectiveTool,
              audio: requestedAudio,
              resolution: requestedResolution ?? null,
              duration_seconds: requestedDurationSeconds,
            },
          });
        };

        if (isKling3ImageModel) {
          const klingDuration = resolveKlingV3Duration(requestedDurationSeconds);
          const endImageUrl =
            (videoReferenceMode === "keyframes" || videoReferenceMode === "kling3") && preparedImageInputs.length > 1
              ? preparedImageInputs[1]
              : undefined;
          const voiceIds = klingVoiceIds.map((voice) => voice.trim()).filter(Boolean).slice(0, 2);
          const multiPromptPayload =
            klingMultiPrompts
              .map((shot) =>
                shot.prompt.trim()
                  ? { prompt: shot.prompt.trim(), duration: resolveKlingV3Duration(shot.duration) }
                  : null,
              )
              .filter(Boolean) || undefined;
          const elementsPayload =
            klingElements
              .map((element) => {
                const referenceList = element.referenceImageUrls
                  .split(/[,\\n]+/)
                  .map((item) => item.trim())
                  .filter(Boolean);
                if (element.videoUrl.trim()) {
                  return { video_url: element.videoUrl.trim() };
                }
                if (element.frontalImageUrl.trim() || referenceList.length) {
                  return {
                    frontal_image_url: element.frontalImageUrl.trim() || undefined,
                    reference_image_urls: referenceList.length ? referenceList : undefined,
                  };
                }
                return null;
              })
              .filter(Boolean) || undefined;
          const { request_id } = await submitFalKlingV3ImageToVideo({
            prompt: cleanedPrompt,
            start_image_url: preparedImageInputs[0],
            end_image_url: endImageUrl,
            duration: klingDuration,
            aspect_ratio: resolveKlingAspectRatio(aspect),
            negative_prompt: klingNegativePrompt,
            cfg_scale: klingCfgScale,
            generate_audio: requestedAudio,
            voice_ids: voiceIds.length ? voiceIds : undefined,
            multi_prompt: multiPromptPayload?.length ? (multiPromptPayload as any) : undefined,
            shot_type: klingShotType,
            elements: elementsPayload?.length ? (elementsPayload as any) : undefined,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingWithGeneration(request_id, id, "fal-kling-3");
          return;
        }

        if (isVeoImageToVideoModel) {
          const normalizedAspect = aspect === "16:9" || aspect === "9:16" ? aspect : "auto";
          const durationSeconds = requestedDurationSeconds;
          const duration = durationSeconds <= 4 ? "4s" : durationSeconds <= 6 ? "6s" : "8s";
          const resolution = requestedResolution?.toLowerCase().includes("4k")
            ? "4k"
            : requestedResolution?.toLowerCase().includes("1080")
              ? "1080p"
              : "720p";
          const { request_id } = await submitFalVeoImageToVideo({
            prompt: cleanedPrompt,
            image_url: preparedImageInputs[0],
            aspect_ratio: normalizedAspect as "16:9" | "9:16" | "auto",
            duration,
            resolution,
            generate_audio: requestedAudio,
            safety_tolerance: "5",
            enable_safety_checker: false,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingWithGeneration(request_id, id, "fal-veo-i2v");
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
          startPollingWithGeneration(response.request_id, id, "fal-nano-banana-edit");
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
          startPollingWithGeneration(response.request_id, id, "fal-nano-banana-pro-edit");
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
          startPollingWithGeneration(request_id, id, "fal-kling");
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
          startPollingWithGeneration(request_id, id, "fal-seedance");
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
            safety_tolerance: "5",
            enable_safety_checker: false,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingWithGeneration(request_id, id, "fal-veo");
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
          startPollingWithGeneration(request_id, id, "fal-sora");
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
            safety_tolerance: "5",
            enable_safety_checker: false,
          });
          updateOutputById(id, (item) => ({
            ...item,
            taskId: request_id,
            taskState: "running",
            timestamp: "Submitted",
          }));
          startPollingWithGeneration(request_id, id, "fal-veo");
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
          startPollingWithGeneration(falResp.request_id, id, "fal-flux2");
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
          startPollingWithGeneration(falResp.request_id, id, "fal-flux2-klein");
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
          startPollingWithGeneration(falResp.request_id, id, "fal-flux2-edit");
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
          startPollingWithGeneration(falResp.request_id, id, "fal-flux2-pro-edit");
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
          startPollingWithGeneration(falResp.request_id, id, "fal-flux2-pro");
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

        startPollingWithGeneration(taskId, id, pollingProvider);
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
      selectedTool,
      startPollingTask,
      ensureGenerationRecord,
      updateOutputById,
      useReferenceImageIndicator,
      videoDurationSeconds,
      videoResolution,
      videoGenerateAudio,
      videoReferenceMode,
    ],
  );

  const resolveReferenceInputsForTool = useCallback(
    (tool: ToolId | null) => {
      if (tool === "video" || tool === "kling") {
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

  const buildImageReferenceInputs = useCallback((primary: string | null, extras: (string | null)[]) => {
    const orderedExtras = extras.filter((url): url is string => Boolean(url && url !== primary));
    if (primary) {
      return [primary, ...orderedExtras];
    }
    return orderedExtras;
  }, []);

  const generateOutput = useCallback(
    (
      promptOverride?: string | null,
      options?: { modeOverride?: StudioMode; selectedToolOverride?: ToolId | null },
    ) => {
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } = resolveReferenceInputsForTool(effectiveTool);
      const baseInputs =
        effectiveTool === "image"
          ? buildImageReferenceInputs(referenceUrl, extraUrls)
          : [referenceUrl, ...extraUrls].filter((url): url is string => Boolean(url));
      const imageInputs = baseInputs.slice(0, 8);
      submitTask(promptOverride ?? prompt, imageInputs, options);
    },
    [buildImageReferenceInputs, prompt, resolveReferenceInputsForTool, selectedTool, submitTask],
  );

  const regenerateOutput = useCallback(() => {
    const promptToUse = prompt.trim();
    if (!promptToUse) return;
    const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } = resolveReferenceInputsForTool(selectedTool);
    const referencePool =
      selectedTool === "image"
        ? buildImageReferenceInputs(referenceUrl, extraUrls)
        : [
            ...(useReferenceImageIndicator && activeOutput?.previewUrl ? [activeOutput.previewUrl] : []),
            referenceUrl,
            ...extraUrls,
          ].filter((url): url is string => Boolean(url));
    const imageInputs = referencePool.slice(0, 8);
    submitTask(promptToUse, imageInputs);
  }, [
    activeOutput?.previewUrl,
    buildImageReferenceInputs,
    prompt,
    resolveReferenceInputsForTool,
    selectedTool,
    submitTask,
    useReferenceImageIndicator,
  ]);

  const persistOutputSave = useCallback(
    async (outputId: string) => {
      const output = findOutputById(outputId);
      if (!output) return;
      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: "saving",
        saveError: null,
      }));
      if (output.savedMediaIds?.length) {
        await new Promise((resolve) => window.setTimeout(resolve, 260));
        markOutputSaved(outputId, output.savedMediaIds);
        return;
      }

      const promptOnly = output.previewText && !output.previewUrl;
      if (promptOnly) {
        if (output.promptId) {
          await new Promise((resolve) => window.setTimeout(resolve, 220));
          markOutputSaved(outputId, undefined, { timestamp: "Saved prompt" });
          return;
        }
        const promptId = await persistPromptSave({ promptText: output.previewText, modelId: output.modelId ?? null });
        if (promptId) {
          updateOutputById(outputId, (item) => ({ ...item, promptId }));
          markOutputSaved(outputId, undefined, { timestamp: "Saved prompt" });
          return;
        }
        markOutputSaveFailed(outputId, "Unable to save prompt.");
        return;
      }

      const urls = output.resultUrls?.length ? output.resultUrls : output.previewUrl ? [output.previewUrl] : [];
      if (!urls.length) {
        markOutputSaveFailed(outputId, "No media available to save.");
        setUiError("No media available to save.");
        return;
      }
      const provider = (output.provider ?? "kei") as Provider;
      const source = output.generationId || output.taskId ? "ai_studio" : "upload";
      const generationId =
        source === "ai_studio"
          ? output.generationId ??
            (await ensureGenerationRecord({
              outputId,
              provider,
              taskId: output.taskId,
            }))
          : null;
      const { mediaFileIds, errors } = await persistMediaUrls({
        outputId,
        urls,
        provider,
        source,
        generationId: generationId ?? null,
      });
      if (mediaFileIds.length) {
        markOutputSaved(outputId, mediaFileIds);
        return;
      }
      if (errors.length) {
        markOutputSaveFailed(outputId, errors[0] ?? "Unable to save media to the library.");
      }
      setUiError("Unable to save media to the library.");
    },
    [ensureGenerationRecord, findOutputById, markOutputSaveFailed, markOutputSaved, persistMediaUrls, persistPromptSave, setUiError, updateOutputById],
  );

  const saveActiveOutput = useCallback(
    (outputId?: string | null) => {
      const targetId = outputId ?? activeOutput?.id ?? null;
      if (!targetId) return;
      void persistOutputSave(targetId);
      if (!outputId) {
        setSaved(true);
      }
    },
    [activeOutput?.id, persistOutputSave],
  );

  const saveReferenceToLibrary = useCallback(
    (outputId: string) => {
      void persistOutputSave(outputId);
    },
    [persistOutputSave],
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
      saveState: "saving",
      saveError: null,
    };
    setOutputs((prev) => [promptReference, ...prev]);
    void (async () => {
      const promptId = await persistPromptSave({ promptText: cleanedPrompt, modelId: model ?? null });
      if (!promptId) {
        markOutputSaveFailed(id, "Unable to save prompt.");
        return;
      }
      updateOutputById(id, (item) => ({ ...item, promptId }));
      markOutputSaved(id, undefined, { timestamp: "Saved prompt" });
    })();
  }, [aspect, markOutputSaveFailed, markOutputSaved, model, persistPromptSave, prompt, updateOutputById]);

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
        status: "ready",
        timestamp: "Agent",
        // Always show the actual prompt text on the reference card.
        previewText: cleanedPrompt,
        saveState: "idle",
        saveError: null,
      };
      setOutputs((prev) => [promptReference, ...prev]);
      setSharedPrompt(cleanedPrompt);
    },
    [prompt, mode, aspect, model, setSharedPrompt],
  );

  const addLibraryMediaReference = useCallback(
    (payload: { id: string; url: string; fileType: "image" | "video"; filename?: string | null; source?: string | null }) => {
      if (!payload.url) return;
      const id = `library-${randomId()}`;
      const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
      const nextOutput: StudioOutput = {
        id,
        prompt: payload.filename ?? "Media reference",
        mode: payload.fileType === "video" ? "video" : "image",
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "ready",
        timestamp: payload.source === "ai_studio" ? "Generation" : "Library",
        previewUrl: payload.url,
        saveState: "idle",
        saveError: null,
        savedMediaIds: payload.id ? [payload.id] : undefined,
      };
      setOutputs((prev) => [nextOutput, ...prev]);
    },
    [aspect, model],
  );

  const addLibraryPromptReference = useCallback(
    (payload: { id: string; promptText: string; title?: string | null }) => {
      const cleanedPrompt = payload.promptText?.trim();
      if (!cleanedPrompt) return;
      const id = `prompt-library-${randomId()}`;
      const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
      const promptReference: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: "text",
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "saved",
        timestamp: "Library",
        previewText: cleanedPrompt,
        saveState: "idle",
        saveError: null,
        promptId: payload.id,
      };
      setOutputs((prev) => [promptReference, ...prev]);
    },
    [aspect, model],
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
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    videoGenerateAudio,
    setVideoGenerateAudio,
    klingNegativePrompt,
    setKlingNegativePrompt,
    klingCfgScale,
    setKlingCfgScale,
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
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
    saveReferenceToLibrary,
    savePromptReference,
    addAgentPromptReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
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
