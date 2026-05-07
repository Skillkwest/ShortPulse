/**
 * Generation submission hook for AI Studio.
 * Orchestrates submission lifecycle while delegating provider-specific calls to handlers.
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { reportAppError } from "../../../lib/appErrorReporter";
import { isAuthSessionTimeoutError } from "../../../lib/authenticatedFetch";
import { buildGenerationSubmissionTraceId, randomId } from "../logic/ids";
import { getModelConfig } from "../logic/pricing";
import {
  clampImageResolutionForModel,
  isModelDefaultImageResolution,
} from "../logic/imageResolution";
import type { InpaintSubmissionOverride } from "../logic/inpaintSubmission";
import {
  BRIA_BACKGROUND_REMOVE_MODEL_ID,
  shouldRequirePromptForEditModel,
} from "../logic/editPromptPolicy";
import { resolveEffectiveAspectForModel } from "../logic/modelApiContracts";
import {
  resolveAutoVideoModelForLane,
  resolveVideoGenerationLaneFromInputs,
} from "../logic/referenceInputs";
import { DeadlineExceededError } from "../logic/withDeadline";
import { Provider, resolveModelLabel } from "../logic/stateParsers";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { dispatchSubmissionByRoute } from "./taskSubmission/routeDispatch";
import { applySubmissionFailureToOutputs } from "./taskSubmission/outputLifecyclePatches";
import {
  attachGenerationReplayToOutput,
  buildPendingSubmissionOutput,
  buildSubmissionReplaySnapshot,
  reconcilePendingSubmissionOutput,
} from "./taskSubmission/outputBootstrap";
import {
  CREATE_TEXT_MODE_SUBMIT_BLOCK_ERROR,
  normalizeSubmissionTool,
  resolveSubmissionStartUiError,
  shouldSkipTextCreateSubmission,
} from "./taskSubmission/submitInvariants";
import { prepareSubmissionReferenceInputs } from "./taskSubmission/preflightPreparation";
import { createSubmissionLifecycleCallbacks } from "./taskSubmission/submissionLifecycle";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type { AiStudioSubmitPanelKey } from "./useAiStudioCreationState";
import type { AiStudioTaskSubmitOptions } from "./contracts/taskSubmissionContracts";

type GenerationMetadata = Record<string, unknown>;
type SubmissionInvariantError = Error & {
  code?: "SUBMIT_NOT_STARTED";
  detail?: string;
};

const PREPARE_REFERENCE_TIMEOUT_ERROR =
  "Preparation timed out before generation started. Please retry.";
const SUBMIT_NOT_STARTED_USER_ERROR = "Generation failed to start. Please retry.";
const AUTH_SESSION_TIMEOUT_DETAIL = "Session check timed out before provider submit.";
const submitNotStartedError = (detail: string): SubmissionInvariantError => {
  const error = new Error("Provider task did not start.") as SubmissionInvariantError;
  error.code = "SUBMIT_NOT_STARTED";
  error.detail = detail;
  return error;
};

type AiStudioTaskSubmissionOptions = AiStudioTaskSubmitOptions & {
  submissionOwner?: AiStudioSubmitPanelKey;
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
  projectId?: string | null;
  model: string | null;
  prompt: string;
  selectedTool: ToolId | null;
  imageResolution: string;
  videoDurationSeconds: number;
  videoResolution: string;
  videoGenerateAudio: boolean;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean;
  seedance2WebSearch?: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode?: "single" | "multi" | "custom";
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
  setPanelGenerating: (panel: AiStudioSubmitPanelKey, value: boolean) => void;
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
    provider?: Provider,
    startedAt?: number,
    noMediaAttempt?: number,
    pollSessionId?: number,
    options?: { initialDelayMs?: number }
  ) => void;
  ensureGenerationRecord: (input: EnsureGenerationRecordInput) => Promise<string | null>;
  isOutputAbandoned?: (outputId: string) => boolean;
  markOutputSubmissionActive?: (outputId: string) => void;
};

/**
 * Returns a memoized submission handler that starts generation tasks and polling.
 */
export const useAiStudioTaskSubmission = ({
  aspect,
  mode,
  projectId = null,
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
  seedance2InputMode = "text",
  seedance2ReferenceImageUrls = [],
  seedance2ReferenceVideoUrls = [],
  seedance2ReferenceAudioUrls = [],
  seedance2ReturnLastFrame = false,
  seedance2WebSearch = false,
  klingNegativePrompt,
  klingCfgScale,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  setPanelGenerating,
  setUiError,
  setUiNotice,
  setOutputs,
  setSaved,
  getDefaultDurationSeconds,
  notifyGenerationFailure,
  updateOutputById,
  startPollingTask,
  ensureGenerationRecord,
  isOutputAbandoned,
  markOutputSubmissionActive,
}: UseAiStudioTaskSubmissionParams) => {
  return useCallback(
    async (
      promptArg: string | null | undefined,
      imageInputs: string[],
      options?: AiStudioTaskSubmissionOptions
    ) => {
      setUiError(null);
      setUiNotice(null);
      const optimisticOutputId = options?.outputIdOverride;
      const applySubmissionFailure = (
        outputId: string,
        patch: Parameters<typeof applySubmissionFailureToOutputs>[2]
      ) => {
        updateOutputById(outputId, (item) => {
          const nextRows = applySubmissionFailureToOutputs([item], outputId, patch);
          return nextRows[0] ?? item;
        });
      };
      const removeOptimisticPlaceholder = () => {
        if (!optimisticOutputId) return;
        setOutputs((prev) => prev.filter((item) => item.id !== optimisticOutputId));
      };
      const effectiveMode = options?.modeOverride ?? mode;
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const normalizedTool = normalizeSubmissionTool(effectiveTool);
      const cleanedSubmissionPrompt = (promptArg ?? prompt).trim();
      const cleanedDisplayPrompt = (options?.displayPromptOverride ?? promptArg ?? prompt).trim();

      if (shouldSkipTextCreateSubmission(effectiveTool, effectiveMode)) {
        removeOptimisticPlaceholder();
        setUiError(CREATE_TEXT_MODE_SUBMIT_BLOCK_ERROR);
        return;
      }
      const resolvedVideoLane = resolveVideoGenerationLaneFromInputs({
        imageInputs,
        referenceMode: videoReferenceMode,
      });
      const requestedModel = options?.modelIdOverride ?? model;
      const finalModel =
        normalizedTool === "video" || normalizedTool === "kling"
          ? resolveAutoVideoModelForLane({
              currentModel: requestedModel,
              lane: resolvedVideoLane,
            })
          : requestedModel;
      const hasReferenceImages = imageInputs && imageInputs.length > 0;
      const isEditWorkflow = normalizedTool === "image";
      const finalModelConfig = finalModel ? getModelConfig(finalModel) : null;
      const requiresImageToImageReferences = isEditWorkflow
        ? Boolean(finalModelConfig?.supportsImageToImage)
        : Boolean(finalModelConfig?.supportsImageToImage && !finalModelConfig?.supportsTextToImage);
      const requiresPrompt = isEditWorkflow ? shouldRequirePromptForEditModel(finalModel) : true;
      const submissionStartUiError = resolveSubmissionStartUiError({
        cleanedSubmissionPrompt,
        requiresPrompt,
        isEditWorkflow,
        hasReferenceImages,
        finalModel,
        requiresImageToImageReferences,
      });
      if (submissionStartUiError) {
        removeOptimisticPlaceholder();
        setUiError(submissionStartUiError);
        return;
      }
      if (!finalModel) {
        removeOptimisticPlaceholder();
        setUiError("Pick a model to generate.");
        return;
      }

      const submissionOwner: AiStudioSubmitPanelKey =
        options?.submissionOwner ??
        (effectiveTool === "video" || effectiveTool === "kling"
          ? "video"
          : effectiveTool === "image" || effectiveTool === "edit"
            ? "edit"
            : "create");
      setPanelGenerating(submissionOwner, true);
      try {
        const id = optimisticOutputId ?? `out-${randomId()}`;
        const submissionTraceId = buildGenerationSubmissionTraceId(id);
        const sourceRef = submissionTraceId;
        markOutputSubmissionActive?.(id);
        const modelLabel = resolveModelLabel(finalModel);

        const isVeoFirstLastFrameModel = finalModel === KIE_VEO_31_FAST_I2V_MODEL_ID;
        const isVeoImageToVideoModel = finalModel === KIE_VEO_31_FAST_I2V_MODEL_ID;
        const modelConfig = finalModelConfig;
        const isImageToVideoModel = modelConfig?.mediaType === "image-to-video";
        const requiresMotionReferenceImage =
          finalModel === KIE_KLING_30_MODEL_ID && videoReferenceMode === "motion";
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

        const nextOutput = buildPendingSubmissionOutput({
          id,
          outputMode,
          prompt: cleanedDisplayPrompt,
          aspect: effectiveAspect,
          modelLabel,
          modelId: finalModel,
          characterContext: options?.characterContextOverride,
          styleContext: options?.styleContextOverride,
          submissionTraceId,
          sourceRef,
          hiddenInReferenceGrid:
            finalModel === BRIA_BACKGROUND_REMOVE_MODEL_ID || options?.hideOutputFromReferenceGrid,
        });

        // Render or reconcile the spinner placeholder before URL prep/submission work begins.
        setOutputs((prev) => reconcilePendingSubmissionOutput(prev, nextOutput));
        setSaved(false);

        let preparedImageInputs: string[] = [];
        let preparedInpaintOverride: InpaintSubmissionOverride | null = null;
        try {
          const prepared = await prepareSubmissionReferenceInputs({
            outputId: id,
            modelId: finalModel,
            tool: effectiveTool,
            imageInputs,
            inpaintOverride: options?.inpaintOverride,
            timeoutMessage: PREPARE_REFERENCE_TIMEOUT_ERROR,
          });
          preparedImageInputs = prepared.preparedImageInputs;
          preparedInpaintOverride = prepared.preparedInpaintOverride;
        } catch (error) {
          const isPreflightTimeout = error instanceof DeadlineExceededError;
          const detail = isPreflightTimeout
            ? PREPARE_REFERENCE_TIMEOUT_ERROR
            : error instanceof Error
              ? error.message
              : "Unable to prepare reference media.";
          applySubmissionFailure(id, {
            timestamp: "Failed",
            errorMessage: detail,
            errorMessageShort: isPreflightTimeout
              ? "Preparation timed out."
              : "Reference upload failed.",
            errorDetail: detail,
          });
          setUiError(isPreflightTimeout ? detail : `Reference upload failed: ${detail}`);
          return;
        }
        if (
          !options?.inpaintOverride &&
          (isEditWorkflow || requiresImageToImageReferences) &&
          preparedImageInputs.length === 0
        ) {
          applySubmissionFailure(id, {
            timestamp: "Missing image",
            errorMessage: "Edit workflow requires at least one reference image.",
            errorMessageShort: "Reference image required.",
            errorDetail: "Edit workflow requires at least one reference image.",
          });
          return;
        }
        if (options?.inpaintOverride) {
          const hasPreparedInpaintInputs = Boolean(
            preparedInpaintOverride?.baseImageInput && preparedInpaintOverride?.maskInput
          );
          if (!hasPreparedInpaintInputs) {
            applySubmissionFailure(id, {
              timestamp: "Missing mask",
              errorMessage: "Inpaint generation requires a base image and mask.",
              errorMessageShort: "Mask required.",
              errorDetail: "Inpaint generation requires a base image and mask.",
            });
            return;
          }
          const requiresPreparedReferenceImage = Boolean(
            options.inpaintOverride.referenceImageInput
          );
          if (requiresPreparedReferenceImage && !preparedInpaintOverride?.referenceImageInput) {
            applySubmissionFailure(id, {
              timestamp: "Missing reference",
              errorMessage: "Reference inpaint generation requires a secondary reference image.",
              errorMessageShort: "Reference image required.",
              errorDetail: "Reference inpaint generation requires a secondary reference image.",
            });
            return;
          }
        }
        const generationReplay = options?.inpaintOverride
          ? null
          : buildSubmissionReplaySnapshot({
              mode: outputMode,
              submitTool: effectiveTool,
              modelId: finalModel,
              displayPrompt: cleanedDisplayPrompt,
              submissionPrompt: cleanedSubmissionPrompt,
              aspect: effectiveAspect,
              imageResolution: isImageGeneration ? (requestedResolution ?? null) : null,
              referenceInputs: preparedImageInputs.slice(0, 8),
              characterContext: options?.characterContextOverride,
              styleContext: options?.styleContextOverride,
            });
        if (generationReplay) {
          attachGenerationReplayToOutput({
            id,
            generationReplay,
            updateOutputById,
          });
        }
        const shortpulseContext = {
          selected_tool: effectiveTool,
          mode: outputMode,
          source_ref: sourceRef,
          project_id: projectId ?? null,
          project_id_present: Boolean(projectId),
          is_character_mode: Boolean(options?.characterContextOverride?.applied),
          selected_character_id: options?.characterContextOverride?.characterId ?? null,
          has_style: Boolean(options?.styleContextOverride?.applied),
          style_id: options?.styleContextOverride?.styleId ?? null,
          reference_count: preparedImageInputs.length,
        };
        const pulseReferenceImageUrl =
          preparedImageInputs.length > 0 ? preparedImageInputs[0] : undefined;
        const falReferencePayload = pulseReferenceImageUrl
          ? { image_url: pulseReferenceImageUrl, image_urls: preparedImageInputs.slice(0, 4) }
          : ({} as Record<string, never>);

        const requiresStandardVideoReference =
          normalizedTool === "video" && resolvedVideoLane === "single-image" && isImageToVideoModel;
        if (requiresStandardVideoReference && preparedImageInputs.length < 1) {
          applySubmissionFailure(id, {
            timestamp: "Missing image",
            errorMessage: "Standard video generation requires a reference image.",
            errorMessageShort: "Reference image required.",
            errorDetail: "Standard video generation requires a reference image.",
          });
          return;
        }

        const requiresImageReference =
          (isImageToVideoModel &&
            (resolvedVideoLane === "single-image" || resolvedVideoLane === "first-last")) ||
          requiresMotionReferenceImage;
        const isKeyframeFirstLastRun =
          resolvedVideoLane === "first-last" && isVeoFirstLastFrameModel;
        if (requiresImageReference && !isKeyframeFirstLastRun && preparedImageInputs.length === 0) {
          applySubmissionFailure(id, {
            timestamp: "Missing image",
            errorMessage: "Video generation requires an image URL.",
            errorMessageShort: "Image URL required.",
            errorDetail: "Video generation requires an image URL.",
          });
          return;
        }

        if (isKeyframeFirstLastRun && preparedImageInputs.length < 2) {
          applySubmissionFailure(id, {
            timestamp: "Missing frames",
            errorMessage: "First/Last Frame generation requires both a first and last frame image.",
            errorMessageShort: "First/Last needs two images.",
            errorDetail: "First/Last Frame generation requires both a first and last frame image.",
          });
          return;
        }

        if (
          isVeoImageToVideoModel &&
          resolvedVideoLane !== "text" &&
          preparedImageInputs.length < 1
        ) {
          applySubmissionFailure(id, {
            timestamp: "Missing image",
            errorMessage: "Veo image-to-video requires a reference image.",
            errorMessageShort: "Reference image required.",
            errorDetail: "Veo image-to-video requires a reference image.",
          });
          return;
        }

        try {
          let taskStarted = false;
          let startedTaskId: string | null = null;
          let startedProvider: Provider | null = null;
          let submissionFailureSignaled = false;
          const notifyGenerationFailureForSubmit = (
            outputId: string,
            message: string,
            detail?: string
          ) => {
            submissionFailureSignaled = true;
            notifyGenerationFailure(outputId, message, detail);
          };
          const { startPollingWithGeneration, completeGenerationImmediately } =
            createSubmissionLifecycleCallbacks({
              outputId: id,
              modelId: finalModel,
              tool: effectiveTool,
              requestedDurationSeconds,
              requestedResolution,
              requestedAudio,
              sourceRef,
              requestedAspect,
              effectiveAspect,
              submissionTraceId,
              isOutputAbandoned,
              updateOutputById,
              startPollingTask,
              ensureGenerationRecord,
              markStarted: (taskId, provider) => {
                const normalizedTaskId = taskId.trim();
                if (!normalizedTaskId) {
                  throw new Error("Provider returned an empty request id.");
                }
                taskStarted = true;
                startedTaskId = normalizedTaskId;
                startedProvider = provider;
              },
            });

          await dispatchSubmissionByRoute({
            id,
            projectId,
            finalModel,
            cleanedPrompt: cleanedSubmissionPrompt,
            effectiveTool,
            outputMode,
            effectiveAspect,
            requestedDurationSeconds,
            requestedResolution,
            requestedAudio,
            preparedImageInputs,
            modelConfig,
            generationReplay,
            characterContext: options?.characterContextOverride,
            styleContext: options?.styleContextOverride,
            shortpulseContext,
            falReferencePayload,
            inpaintOverride: preparedInpaintOverride,
            videoReferenceMode,
            videoReferenceImageUrl,
            motionReferenceVideoUrl,
            videoAutoFix,
            videoCameraFixed,
            seedance2InputMode,
            seedance2ReferenceImageUrls,
            seedance2ReferenceVideoUrls,
            seedance2ReferenceAudioUrls,
            seedance2ReturnLastFrame,
            seedance2WebSearch,
            klingNegativePrompt,
            klingCfgScale,
            klingShotType,
            klingVoiceIds,
            klingMultiPrompts,
            klingElements,
            notifyGenerationFailure: notifyGenerationFailureForSubmit,
            updateOutputById,
            startPollingWithGeneration,
            completeGenerationImmediately,
            createSubmitNotStartedError: submitNotStartedError,
          });
          if (submissionFailureSignaled) {
            return;
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
        setPanelGenerating(submissionOwner, false);
      }
    },
    [
      aspect,
      setPanelGenerating,
      setOutputs,
      setSaved,
      setUiError,
      setUiNotice,
      getDefaultDurationSeconds,
      model,
      mode,
      projectId,
      notifyGenerationFailure,
      prompt,
      seedance2InputMode,
      seedance2ReferenceAudioUrls,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      selectedTool,
      startPollingTask,
      ensureGenerationRecord,
      isOutputAbandoned,
      markOutputSubmissionActive,
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
