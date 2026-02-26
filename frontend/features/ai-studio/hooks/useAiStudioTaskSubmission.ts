/**
 * Generation submission hook for AI Studio.
 * Orchestrates submission lifecycle while delegating provider-specific calls to handlers.
 */
import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { reportAppError } from "../../../lib/appErrorReporter";
import { isAuthSessionTimeoutError } from "../../../lib/authenticatedFetch";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { fetchFalQueueStatus, type FalSubmitResponse } from "../../../lib/falClient";
import { buildGenerationSubmissionTraceId, randomId } from "../logic/ids";
import { getModelConfig } from "../logic/pricing";
import {
  clampImageResolutionForModel,
  isModelDefaultImageResolution,
} from "../logic/imageResolution";
import { buildGenerationReplayConfigV1 } from "../logic/generationReplay";
import { resolveEffectiveAspectForModel } from "../logic/modelApiContracts";
import { DeadlineExceededError, withDeadline } from "../logic/withDeadline";
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
type SubmissionInvariantError = Error & {
  code?: "SUBMIT_NOT_STARTED";
  detail?: string;
};

const PREPARE_REFERENCE_TIMEOUT_MS = 10_000;
const PREPARE_REFERENCE_TIMEOUT_ERROR =
  "Preparation timed out before generation started. Please retry.";
const SUBMIT_NOT_STARTED_USER_ERROR = "Generation failed to start. Please retry.";
const AUTH_SESSION_TIMEOUT_DETAIL = "Session check timed out before provider submit.";
const QUEUE_STATUS_MAX_POLL_ATTEMPTS = 180;
const clampQueuePollMs = (value: number) => Math.max(500, Math.min(10000, Math.trunc(value)));
const submitNotStartedError = (detail: string): SubmissionInvariantError => {
  const error = new Error("Provider task did not start.") as SubmissionInvariantError;
  error.code = "SUBMIT_NOT_STARTED";
  error.detail = detail;
  return error;
};

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
  const queueStatusTimersRef = useRef<Record<string, number>>({});
  const queueStatusSessionRef = useRef<Record<string, number>>({});

  const clearQueueStatusPolling = useCallback((outputId: string) => {
    queueStatusSessionRef.current[outputId] = (queueStatusSessionRef.current[outputId] ?? 0) + 1;
    const timeoutId = queueStatusTimersRef.current[outputId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete queueStatusTimersRef.current[outputId];
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of Object.values(queueStatusTimersRef.current)) {
        window.clearTimeout(timeoutId);
      }
      queueStatusTimersRef.current = {};
      queueStatusSessionRef.current = {};
    };
  }, []);

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
        modelIdOverride?: string | null;
        aspectOverride?: string;
        imageResolutionOverride?: string;
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
      const finalModel = options?.modelIdOverride ?? model;
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
      const finalModelConfig = getModelConfig(finalModel);
      const requiresImageToImageReferences = Boolean(finalModelConfig?.supportsImageToImage);
      if (requiresImageToImageReferences && !hasReferenceImages) {
        removeOptimisticPlaceholder();
        setUiError("Add a reference image before generating.");
        return;
      }

      setIsPromptGenerating(true);
      try {
        const id = optimisticOutputId ?? `out-${randomId()}`;
        clearQueueStatusPolling(id);
        const submissionTraceId = buildGenerationSubmissionTraceId(id);
        const modelLabel = resolveModelLabel(finalModel);

        const isKling3ImageModel = finalModel === "fal-ai/kling-video/v3/pro/image-to-video";
        const isVeoFirstLastFrameModel = finalModel === "fal-ai/veo3.1/first-last-frame-to-video";
        const isVeoImageToVideoModel = finalModel === "fal-ai/veo3.1/image-to-video";
        const modelConfig = finalModelConfig;
        const requestedAspect = options?.aspectOverride ?? aspect;
        const effectiveAspect = resolveEffectiveAspectForModel(
          finalModel,
          requestedAspect,
          modelConfig?.defaultAspect ?? "16:9"
        );
        const isVideoGeneration =
          effectiveMode === "video" || effectiveTool === "video" || effectiveTool === "kling";
        const isImageGeneration =
          effectiveMode === "image" || effectiveTool === "image" || effectiveTool === "edit";
        const requestedDurationSeconds = isVideoGeneration
          ? videoDurationSeconds
          : getDefaultDurationSeconds(finalModel);
        const requestedImageResolution = isImageGeneration
          ? clampImageResolutionForModel(
              finalModel,
              options?.imageResolutionOverride ?? imageResolution
            )
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

        const buildReplaySnapshot = (referenceInputs: string[]) =>
          buildGenerationReplayConfigV1({
            mode: outputMode,
            submitTool: effectiveTool,
            modelId: finalModel,
            displayPrompt: cleanedDisplayPrompt,
            submissionPrompt: cleanedSubmissionPrompt,
            aspect: effectiveAspect,
            imageResolution: isImageGeneration ? (requestedResolution ?? null) : null,
            referenceInputs,
            characterContext: options?.characterContextOverride,
          });
        const nextOutput: StudioOutput = {
          mode: outputMode,
          id,
          prompt: cleanedDisplayPrompt,
          aspect: effectiveAspect,
          model: modelLabel,
          modelId: finalModel,
          status: "ready",
          taskState: "pending",
          timestamp: "Submitting...",
          errorMessage: null,
          errorMessageShort: null,
          errorDetail: null,
          mediaSource: "generated",
          previewTier: outputMode === "video" ? "preview_loop" : "full",
          archivedAt: null,
          archiveReason: null,
          saveState: "idle",
          saveError: null,
          characterContext: options?.characterContextOverride,
          submissionTraceId,
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
          addBreadcrumb({
            type: "ui",
            level: "info",
            message: "generation_preflight_started",
            data: {
              output_id: id,
              model_id: finalModel,
              tool: effectiveTool,
            },
          });
          preparedImageInputs = (
            await withDeadline({
              timeoutMs: PREPARE_REFERENCE_TIMEOUT_MS,
              timeoutMessage: PREPARE_REFERENCE_TIMEOUT_ERROR,
              run: async () =>
                Promise.all(
                  imageInputs.map(async (url) => {
                    const normalized = await prepareImageUrlForSubmission(url);
                    return normalized ?? null;
                  })
                ),
            })
          ).filter((url): url is string => Boolean(url));
        } catch (error) {
          const isPreflightTimeout = error instanceof DeadlineExceededError;
          const detail = isPreflightTimeout
            ? PREPARE_REFERENCE_TIMEOUT_ERROR
            : error instanceof Error
              ? error.message
              : "Unable to prepare reference media.";
          if (isPreflightTimeout) {
            void reportAppError({
              source: "generation_preflight_timeout",
              scope: "generation",
              severity: "medium",
              message: "Generation preflight timed out before submission.",
              metadata: {
                output_id: id,
                model_id: finalModel,
                tool: effectiveTool,
                duration_ms: error.timeoutMs,
                reason_code: "PREFLIGHT_TIMEOUT",
              },
            });
          }
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    taskState: "fail",
                    status: "ready",
                    timestamp: "Failed",
                    errorMessage: detail,
                    errorMessageShort: isPreflightTimeout
                      ? "Preparation timed out."
                      : "Reference upload failed.",
                    errorDetail: detail,
                  }
                : item
            )
          );
          setUiError(isPreflightTimeout ? detail : `Reference upload failed: ${detail}`);
          return;
        }
        if (
          (isEditWorkflow || requiresImageToImageReferences) &&
          preparedImageInputs.length === 0
        ) {
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
        const generationReplay = buildReplaySnapshot(preparedImageInputs.slice(0, 8));
        if (generationReplay) {
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    generationReplay,
                  }
                : item
            )
          );
        }
        const pulseReferenceImageUrl =
          preparedImageInputs.length > 0 ? preparedImageInputs[0] : undefined;
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
          let taskStarted = false;
          let startedTaskId: string | null = null;
          let startedProvider: Provider | null = null;
          const startPollingWithGeneration = (
            taskId: string | undefined,
            provider: Provider,
            patch: Partial<StudioOutput> = {},
            submitResponse?: FalSubmitResponse
          ) => {
            const queuedResponse =
              submitResponse && "status" in submitResponse && submitResponse.status === "queued"
                ? submitResponse
                : null;
            if (queuedResponse) {
              taskStarted = true;
              startedTaskId = queuedResponse.generationId;
              startedProvider = provider;
              clearQueueStatusPolling(id);
              const pollSession = (queueStatusSessionRef.current[id] ?? 0) + 1;
              queueStatusSessionRef.current[id] = pollSession;
              const initialDelayMs = clampQueuePollMs(queuedResponse.pollAfterMs);

              updateOutputById(id, (item) => ({
                ...item,
                ...patch,
                generationId: patch.generationId ?? queuedResponse.generationId,
                taskState: "pending",
                timestamp: "Submitting...",
                provider: item.provider ?? provider,
              }));
              addBreadcrumb({
                type: "ui",
                level: "info",
                message: "fal_submit_queued",
                data: {
                  output_id: id,
                  model_id: finalModel,
                  provider,
                  source_ref: queuedResponse.sourceRef,
                  generation_id: queuedResponse.generationId,
                  tool: effectiveTool,
                },
              });

              const pollQueuedStatus = async (attempt: number): Promise<void> => {
                if ((queueStatusSessionRef.current[id] ?? 0) !== pollSession) {
                  return;
                }

                try {
                  const queueStatus = await fetchFalQueueStatus({
                    sourceRef: queuedResponse.sourceRef,
                    generationId: queuedResponse.generationId,
                  });
                  if (queueStatus.status === "dispatched") {
                    clearQueueStatusPolling(id);
                    startPollingWithGeneration(
                      queueStatus.requestId,
                      provider,
                      {
                        ...patch,
                        generationId: queueStatus.generationId || queuedResponse.generationId,
                      },
                      undefined
                    );
                    return;
                  }

                  if (queueStatus.status === "failed") {
                    clearQueueStatusPolling(id);
                    notifyGenerationFailure(id, queueStatus.message, queueStatus.message);
                    return;
                  }

                  if (attempt >= QUEUE_STATUS_MAX_POLL_ATTEMPTS) {
                    clearQueueStatusPolling(id);
                    notifyGenerationFailure(
                      id,
                      "Generation queue timed out. Please retry.",
                      "Generation queue timed out while waiting for dispatch."
                    );
                    return;
                  }

                  const retryAfterMs =
                    queueStatus.status === "queued"
                      ? clampQueuePollMs(queueStatus.retryAfterMs)
                      : initialDelayMs;
                  queueStatusTimersRef.current[id] = window.setTimeout(() => {
                    void pollQueuedStatus(attempt + 1);
                  }, retryAfterMs);
                } catch (error) {
                  if (attempt >= QUEUE_STATUS_MAX_POLL_ATTEMPTS) {
                    clearQueueStatusPolling(id);
                    const message =
                      error instanceof Error
                        ? error.message
                        : "Unable to read queued generation status.";
                    notifyGenerationFailure(id, message, message);
                    return;
                  }

                  const retryAfterMs = clampQueuePollMs(initialDelayMs * Math.min(4, attempt + 1));
                  queueStatusTimersRef.current[id] = window.setTimeout(() => {
                    void pollQueuedStatus(attempt + 1);
                  }, retryAfterMs);
                }
              };

              queueStatusTimersRef.current[id] = window.setTimeout(() => {
                void pollQueuedStatus(0);
              }, initialDelayMs);
              return;
            }

            const normalizedTaskId = taskId?.trim();
            if (!normalizedTaskId) throw new Error("Provider returned an empty request id.");
            taskStarted = true;
            startedTaskId = normalizedTaskId;
            startedProvider = provider;
            clearQueueStatusPolling(id);
            updateOutputById(id, (item) => ({
              ...item,
              ...patch,
              taskId: normalizedTaskId,
              generationTraceId: normalizedTaskId,
              taskState: "running",
              timestamp: "Submitted",
              provider: item.provider ?? provider,
            }));
            startPollingTask(normalizedTaskId, id, 0, provider);
            void ensureGenerationRecord({
              outputId: id,
              provider,
              taskId: normalizedTaskId,
              durationSeconds: requestedDurationSeconds,
              resolution: requestedResolution ?? null,
              metadata: {
                tool: effectiveTool,
                audio: requestedAudio,
                requested_aspect: requestedAspect,
                effective_aspect: effectiveAspect,
                resolution: requestedResolution ?? null,
                duration_seconds: requestedDurationSeconds,
                submission_trace_id: submissionTraceId,
                generation_trace_id: normalizedTaskId,
              },
            });
            addBreadcrumb({
              type: "ui",
              level: "info",
              message: "fal_submit_dispatched",
              data: {
                output_id: id,
                model_id: finalModel,
                provider,
                task_id: normalizedTaskId,
                tool: effectiveTool,
              },
            });
          };

          const route = resolveSubmissionHandlerRoute(finalModel);
          if (route === "video") {
            await handleVideoModelSubmission({
              id,
              finalModel,
              cleanedPrompt: cleanedSubmissionPrompt,
              aspect: effectiveAspect,
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
          } else if (route === "image") {
            const handled = await handleImageModelSubmission({
              id,
              finalModel,
              cleanedPrompt: cleanedSubmissionPrompt,
              aspect: effectiveAspect,
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
            if (!handled) {
              throw submitNotStartedError(
                `Image submission route did not handle model '${finalModel}'.`
              );
            }
          } else {
            await handleDefaultModelSubmission({
              id,
              finalModel,
              cleanedPrompt: cleanedSubmissionPrompt,
              aspect: effectiveAspect,
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
          }
          if (!taskStarted || !startedTaskId || !startedProvider) {
            throw submitNotStartedError(
              "Submit route completed without starting provider polling."
            );
          }
        } catch (error) {
          const submissionError = error as SubmissionInvariantError;
          if (isAuthSessionTimeoutError(error)) {
            notifyGenerationFailure(id, SUBMIT_NOT_STARTED_USER_ERROR, AUTH_SESSION_TIMEOUT_DETAIL);
            void reportAppError({
              source: "fal_auth_session_timeout",
              scope: "generation",
              severity: "high",
              message: "Fal generation submit blocked by session timeout.",
              metadata: {
                output_id: id,
                model_id: finalModel,
                tool: effectiveTool,
                reason_code: "AUTH_SESSION_TIMEOUT",
                timeout_ms: error.timeoutMs,
              },
            });
            return;
          }
          if (submissionError?.code === "SUBMIT_NOT_STARTED") {
            notifyGenerationFailure(
              id,
              SUBMIT_NOT_STARTED_USER_ERROR,
              submissionError.detail ?? SUBMIT_NOT_STARTED_USER_ERROR
            );
            void reportAppError({
              source: "fal_submit_not_started",
              scope: "generation",
              severity: "high",
              message: "Fal generation did not start.",
              metadata: {
                output_id: id,
                model_id: finalModel,
                tool: effectiveTool,
                reason_code: "SUBMIT_NOT_STARTED",
                detail: submissionError.detail ?? null,
              },
            });
            return;
          }
          const message = error instanceof Error ? error.message : "Failed to start generation";
          notifyGenerationFailure(id, message, message);
        }
      } finally {
        setIsPromptGenerating(false);
      }
    },
    [
      aspect,
      clearQueueStatusPolling,
      setIsPromptGenerating,
      setOutputs,
      setSaved,
      setUiError,
      setUiNotice,
      getDefaultDurationSeconds,
      model,
      mode,
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
