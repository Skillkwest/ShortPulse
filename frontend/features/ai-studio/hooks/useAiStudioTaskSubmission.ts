/**
 * Generation submission hook for AI Studio.
 * Orchestrates submission lifecycle while delegating provider-specific calls to handlers.
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { randomId } from "../logic/ids";
import { getModelConfig } from "../logic/pricing";
import {
  clampImageResolutionForModel,
  isModelDefaultImageResolution,
} from "../logic/imageResolution";
import { prepareImageUrlForSubmission } from "../utils/imageUpload";
import { Provider, resolveModelLabel } from "../logic/stateParsers";
import {
  handleDefaultModelSubmission,
  handleImageModelSubmission,
  handleVideoModelSubmission,
  resolveSubmissionHandlerRoute,
} from "./taskSubmissionHandlers";
import type { StudioMode, StudioOutput, ToolId } from "../types";

type GenerationMetadata = Record<string, unknown>;
const CHARACTER_MODE_ERROR_LOG_MODEL_LABEL = "Pulse Character Model";

type EnsureGenerationRecordInput = {
  outputId: string;
  provider: Provider;
  taskId?: string;
  durationSeconds?: number;
  resolution?: string | null;
  metadata?: GenerationMetadata;
};

type UseAiStudioTaskSubmissionParams = {
  aspect: string;
  mode: StudioMode;
  model: string | null;
  prompt: string;
  isCharacterModeEnabled?: boolean;
  selectedTool: ToolId | null;
  imageResolution: string;
  videoDurationSeconds: number;
  videoResolution: string;
  videoGenerateAudio: boolean;
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: {
    id: string;
    frontalImageUrl: string;
    referenceImageUrls: string;
    videoUrl: string;
  }[];
  setIsPromptGenerating: Dispatch<SetStateAction<boolean>>;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  getDefaultDurationSeconds: (modelId: string | null) => number;
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  startPollingTask: (
    taskId: string,
    outputId: string,
    attempt?: number,
    provider?: Provider
  ) => void;
  ensureGenerationRecord: (input: EnsureGenerationRecordInput) => Promise<string | null>;
};

/**
 * Returns a memoized submission handler that starts generation tasks and polling.
 */
export const useAiStudioTaskSubmission = ({
  aspect,
  mode,
  model,
  prompt,
  isCharacterModeEnabled = false,
  selectedTool,
  imageResolution,
  videoDurationSeconds,
  videoResolution,
  videoGenerateAudio,
  videoReferenceMode,
  videoReferenceImageUrl,
  motionReferenceVideoUrl,
  videoCameraFixed,
  videoAutoFix,
  klingNegativePrompt,
  klingCfgScale,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  setIsPromptGenerating,
  setUiError,
  setUiNotice,
  setOutputs,
  setSaved,
  getDefaultDurationSeconds,
  notifyGenerationFailure,
  updateOutputById,
  startPollingTask,
  ensureGenerationRecord,
}: UseAiStudioTaskSubmissionParams) => {
  return useCallback(
    async (
      promptArg: string | null | undefined,
      imageInputs: string[],
      options?: {
        modeOverride?: StudioMode;
        selectedToolOverride?: ToolId | null;
        displayPromptOverride?: string | null;
        characterContextOverride?: StudioOutput["characterContext"];
        outputIdOverride?: string;
      }
    ) => {
      setUiError(null);
      setUiNotice(null);
      const optimisticOutputId = options?.outputIdOverride;
      const removeOptimisticPlaceholder = () => {
        if (!optimisticOutputId) return;
        setOutputs((prev) => prev.filter((item) => item.id !== optimisticOutputId));
      };
      const effectiveMode = options?.modeOverride ?? mode;
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const normalizedTool =
        effectiveTool === "kling" ? "video" : effectiveTool === "edit" ? "image" : effectiveTool;
      const cleanedSubmissionPrompt = (promptArg ?? prompt).trim();
      const cleanedDisplayPrompt = (options?.displayPromptOverride ?? promptArg ?? prompt).trim();

      if ((effectiveTool === "create" || effectiveTool === "text") && effectiveMode === "text") {
        removeOptimisticPlaceholder();
        setIsPromptGenerating(false);
        return;
      }
      if (!cleanedSubmissionPrompt) {
        removeOptimisticPlaceholder();
        setUiError("Add a prompt to start a generation.");
        return;
      }

      const hasReferenceImages = imageInputs && imageInputs.length > 0;
      const isEditWorkflow = normalizedTool === "image";
      const finalTool: ToolId | "text" | null = effectiveTool === "edit" ? "image" : effectiveTool;
      const finalModel = model;
      if (isEditWorkflow && !hasReferenceImages) {
        removeOptimisticPlaceholder();
        setUiError("Add a reference image before generating.");
        return;
      }

      if (!finalModel) {
        removeOptimisticPlaceholder();
        setUiError("Pick a model to generate.");
        return;
      }

      setIsPromptGenerating(true);
      try {
        const id = optimisticOutputId ?? `out-${randomId()}`;
        const isCharacterModeCreateRun =
          isCharacterModeEnabled && (effectiveTool === "create" || effectiveTool === "text");
        const modelLabel = isCharacterModeCreateRun
          ? CHARACTER_MODE_ERROR_LOG_MODEL_LABEL
          : resolveModelLabel(finalModel);

        const isKling3ImageModel = finalModel === "fal-ai/kling-video/v3/pro/image-to-video";
        const isVeoFirstLastFrameModel = finalModel === "fal-ai/veo3.1/first-last-frame-to-video";
        const isVeoImageToVideoModel = finalModel === "fal-ai/veo3.1/image-to-video";
        const modelConfig = getModelConfig(finalModel);
        const isVideoGeneration =
          effectiveMode === "video" || effectiveTool === "video" || effectiveTool === "kling";
        const isImageGeneration =
          effectiveMode === "image" || effectiveTool === "image" || effectiveTool === "edit";
        const requestedDurationSeconds = isVideoGeneration
          ? videoDurationSeconds
          : getDefaultDurationSeconds(finalModel);
        const requestedImageResolution = isImageGeneration
          ? clampImageResolutionForModel(finalModel, imageResolution)
          : modelConfig?.defaultResolution;
        const requestedResolution = isVideoGeneration
          ? videoResolution
          : isModelDefaultImageResolution(requestedImageResolution)
            ? undefined
            : requestedImageResolution;
        const requestedAudio = isVideoGeneration
          ? videoGenerateAudio
          : (modelConfig?.defaultAudio ?? true);

        const outputMode: StudioMode =
          effectiveTool === "video" || effectiveTool === "kling"
            ? "video"
            : effectiveTool === "image" || effectiveTool === "edit"
              ? "image"
              : effectiveMode;

        const nextOutput: StudioOutput = {
          id,
          prompt: cleanedDisplayPrompt,
          mode: outputMode,
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
          characterContext: options?.characterContextOverride,
        };

        // Render or reconcile the spinner placeholder before URL prep/submission work begins.
        setOutputs((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === id);
          if (existingIndex === -1) return [nextOutput, ...prev];
          return prev.map((item) => (item.id === id ? { ...item, ...nextOutput } : item));
        });
        setSaved(false);

        let preparedImageInputs: string[] = [];
        try {
          preparedImageInputs = (
            await Promise.all(
              imageInputs.map(async (url) => {
                const normalized = await prepareImageUrlForSubmission(url);
                return normalized ?? null;
              })
            )
          ).filter((url): url is string => Boolean(url));
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : "Unable to prepare reference media.";
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    taskState: "fail",
                    status: "ready",
                    timestamp: "Failed",
                    errorMessage: detail,
                    errorMessageShort: "Reference upload failed.",
                    errorDetail: detail,
                  }
                : item
            )
          );
          setUiError(`Reference upload failed: ${detail}`);
          return;
        }
        if (isEditWorkflow && preparedImageInputs.length === 0) {
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    taskState: "fail",
                    status: "ready",
                    timestamp: "Missing image",
                    errorMessage: "Edit workflow requires at least one reference image.",
                    errorMessageShort: "Reference image required.",
                    errorDetail: "Edit workflow requires at least one reference image.",
                  }
                : item
            )
          );
          return;
        }
        const pulseReferenceImageUrl =
          finalTool === "image" && preparedImageInputs.length > 0
            ? preparedImageInputs[0]
            : undefined;
        const falReferencePayload = pulseReferenceImageUrl
          ? { image_url: pulseReferenceImageUrl, image_urls: preparedImageInputs.slice(0, 4) }
          : ({} as Record<string, never>);

        const isStandardVideoRun = normalizedTool === "video" && videoReferenceMode === "standard";
        if (isStandardVideoRun && preparedImageInputs.length < 1) {
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    taskState: "fail",
                    status: "ready",
                    timestamp: "Missing image",
                    errorMessage: "Standard video generation requires a reference image.",
                    errorMessageShort: "Reference image required.",
                    errorDetail: "Standard video generation requires a reference image.",
                  }
                : item
            )
          );
          return;
        }

        const requiresImageReference = isKling3ImageModel || isVeoImageToVideoModel;
        if (requiresImageReference && preparedImageInputs.length === 0) {
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    taskState: "fail",
                    status: "ready",
                    timestamp: "Missing image",
                    errorMessage: "Video generation requires an image URL.",
                    errorMessageShort: "Image URL required.",
                    errorDetail: "Video generation requires an image URL.",
                  }
                : item
            )
          );
          return;
        }

        if (isVeoFirstLastFrameModel && preparedImageInputs.length < 2) {
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    taskState: "fail",
                    status: "ready",
                    timestamp: "Missing frames",
                    errorMessage:
                      "First/Last Frame generation requires both a first and last frame image.",
                    errorMessageShort: "First/Last needs two images.",
                    errorDetail:
                      "First/Last Frame generation requires both a first and last frame image.",
                  }
                : item
            )
          );
          return;
        }

        if (isVeoImageToVideoModel && preparedImageInputs.length < 1) {
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    taskState: "fail",
                    status: "ready",
                    timestamp: "Missing image",
                    errorMessage: "Veo image-to-video requires a reference image.",
                    errorMessageShort: "Reference image required.",
                    errorDetail: "Veo image-to-video requires a reference image.",
                  }
                : item
            )
          );
          return;
        }

        try {
          const startPollingWithGeneration = (
            taskId: string,
            provider: Provider,
            patch: Partial<StudioOutput> = {}
          ) => {
            updateOutputById(id, (item) => ({
              ...item,
              ...patch,
              taskId,
              taskState: "running",
              timestamp: "Submitted",
              provider: item.provider ?? provider,
            }));
            startPollingTask(taskId, id, 0, provider);
            void ensureGenerationRecord({
              outputId: id,
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

          const route = resolveSubmissionHandlerRoute(finalModel);
          if (route === "video") {
            await handleVideoModelSubmission({
              id,
              finalModel,
              cleanedPrompt: cleanedSubmissionPrompt,
              aspect,
              requestedDurationSeconds,
              requestedResolution,
              requestedAudio,
              preparedImageInputs,
              modelConfig,
              notifyGenerationFailure,
              updateOutputById,
              startPollingWithGeneration,
              videoReferenceMode,
              videoReferenceImageUrl,
              motionReferenceVideoUrl,
              videoAutoFix,
              videoCameraFixed,
              klingNegativePrompt,
              klingCfgScale,
              klingShotType,
              klingVoiceIds,
              klingMultiPrompts,
              klingElements,
            });
            return;
          }

          if (route === "image") {
            await handleImageModelSubmission({
              id,
              finalModel,
              cleanedPrompt: cleanedSubmissionPrompt,
              aspect,
              requestedDurationSeconds,
              requestedResolution,
              requestedAudio,
              preparedImageInputs,
              modelConfig,
              notifyGenerationFailure,
              updateOutputById,
              startPollingWithGeneration,
              falReferencePayload,
            });
            return;
          }

          await handleDefaultModelSubmission({
            id,
            finalModel,
            cleanedPrompt: cleanedSubmissionPrompt,
            aspect,
            requestedDurationSeconds,
            requestedResolution,
            requestedAudio,
            preparedImageInputs,
            modelConfig,
            notifyGenerationFailure,
            updateOutputById,
            startPollingWithGeneration,
            falReferencePayload,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to start generation";
          notifyGenerationFailure(id, message);
        }
      } finally {
        setIsPromptGenerating(false);
      }
    },
    [
      aspect,
      setIsPromptGenerating,
      setOutputs,
      setSaved,
      setUiError,
      setUiNotice,
      getDefaultDurationSeconds,
      model,
      mode,
      isCharacterModeEnabled,
      notifyGenerationFailure,
      prompt,
      selectedTool,
      startPollingTask,
      ensureGenerationRecord,
      updateOutputById,
      videoDurationSeconds,
      videoResolution,
      imageResolution,
      videoGenerateAudio,
      videoReferenceMode,
      motionReferenceVideoUrl,
      videoReferenceImageUrl,
      videoCameraFixed,
      videoAutoFix,
      klingNegativePrompt,
      klingCfgScale,
      klingShotType,
      klingVoiceIds,
      klingMultiPrompts,
      klingElements,
    ]
  );
};
