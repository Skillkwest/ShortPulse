/**
 * Generation submission hook for AI Studio.
 * Orchestrates submission lifecycle while delegating provider-specific calls to handlers.
 */
import { useCallback } from "react";
import { reportAppError } from "../../../lib/appErrorReporter";
import { isAuthSessionTimeoutError } from "../../../lib/authenticatedFetch";
import { dedupeInternalMediaRefs } from "../../../lib/media/internalMediaRefs";
import { buildMotionReferenceAssetShortpulseContext } from "../../../lib/motionReferenceVideoStorage";
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
  INSUFFICIENT_CREDITS_CODE,
  INSUFFICIENT_CREDITS_MESSAGE,
  INSUFFICIENT_CREDITS_TITLE,
  isInsufficientCreditsLike,
} from "../logic/insufficientCredits";
import {
  resolveAutoVideoModelForLane,
  resolveVideoGenerationLaneFromInputs,
} from "../logic/referenceInputs";
import { resolveInternalMediaRefsForUrls } from "../logic/referenceInputInternalMediaRegistry";
import { DeadlineExceededError } from "../logic/withDeadline";
import { Provider, resolveModelLabel } from "../logic/stateParsers";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../lib/model-runtime/falModelIds";
import { dispatchSubmissionByRoute } from "./taskSubmission/routeDispatch";
import {
  MAX_IMAGE_REFERENCE_INPUT_LIMIT,
  buildTooManyReferenceImagesMessage,
  resolveImageReferenceInputLimitForModel,
} from "./taskSubmission/imageReferenceLimits";
import {
  applyDispatchedSubmissionPatch,
  applySubmissionFailureToOutputs,
} from "./taskSubmission/outputLifecyclePatches";
import {
  attachGenerationReplayToOutput,
  attachWorkflowReloadToOutput,
  buildPendingSubmissionOutput,
  buildSubmissionReplaySnapshot,
  buildSubmissionWorkflowReloadSnapshot,
  reconcilePendingSubmissionOutput,
  reconcileExpertEditWorkflowReloadReferences,
  resolveSubmissionModeForModelId,
} from "./taskSubmission/outputBootstrap";
import {
  CREATE_TEXT_MODE_SUBMIT_BLOCK_ERROR,
  normalizeSubmissionTool,
  resolveSubmissionStartUiError,
  shouldSkipTextCreateSubmission,
  submitLifecycleContractError,
  submitNotStartedError,
  type SubmissionInvariantError,
} from "./taskSubmission/submitInvariants";
import {
  hasUsableInternalMediaRefs,
  resolveRestoreOnlyImageInputs,
  resolveSubmissionOwner,
} from "./taskSubmission/submissionInputHelpers";
import {
  prepareSubmissionReferenceInputs,
  type PreparedSubmissionReferenceInput,
} from "./taskSubmission/preflightPreparation";
import { createSubmissionLifecycleCallbacks } from "./taskSubmission/submissionLifecycle";
import { DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS } from "./useAiStudioTasks";
import type { StudioMode, ToolId } from "../types";
import {
  createEmptyLipSyncAudioState,
  getDurableLipSyncAudioUrl,
  getLipSyncAudioStoragePath,
} from "../logic/lipSyncAudioState";
import {
  collectSeedanceElementVideoReferenceDurations,
  resolveSeedanceElementProviderEligibility,
} from "../logic/klingElements";
import {
  resolveSeedanceInputVideoDurationSeconds,
  resolveSeedanceVideoReferenceDurationLimitError,
  resolveSeedanceVideoReferenceDurations,
} from "../logic/seedanceVideoPricing";
import type { GenerationFailureContext } from "./generationFailureReporting";
import type {
  AiStudioTaskSubmissionOptions,
  UseAiStudioTaskSubmissionParams,
} from "./contracts/taskSubmissionHookContracts";
import {
  isPricingPolicyConflictCode,
  PRICING_POLICY_CONFLICT_EVENT,
  PRICING_POLICY_REFRESH_REQUESTED_EVENT,
  type PricingPolicyConflictPayload,
} from "../../../lib/model-runtime/pricingPolicyFreshness";

const PREPARE_REFERENCE_TIMEOUT_ERROR =
  "Preparation timed out before generation started. Please retry.";
const SUBMIT_NOT_STARTED_USER_ERROR = "Generation failed to start. Please retry.";
const AUTH_SESSION_TIMEOUT_DETAIL = "Session check timed out before provider submit.";

/**
 * Returns a memoized submission handler that starts generation tasks and polling.
 */
export const useAiStudioTaskSubmission = ({
  aspect,
  mode,
  projectId = null,
  workspaceRuntimeKey = null,
  model,
  prompt,
  currentCostCredits = null,
  promptReferenceGenerateCostCredits = null,
  selectedTool,
  imageResolution,
  videoDurationSeconds,
  videoResolution,
  videoGenerateAudio,
  videoReferenceMode,
  videoReferenceImageUrl,
  motionReferenceVideoUrl,
  lipSyncAudio = createEmptyLipSyncAudioState(),
  lipSyncTurboMode = false,
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
  klingWorkflowMode,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  beginPanelGeneration,
  endPanelGeneration,
  setUiError,
  setUiNotice,
  setOutputs,
  outputs = [],
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
      let submissionOutputId = optimisticOutputId;
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
        if (!submissionOutputId) return;
        setOutputs((prev) => prev.filter((item) => item.id !== submissionOutputId));
      };
      const effectiveMode = options?.modeOverride ?? mode;
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const normalizedTool = normalizeSubmissionTool(effectiveTool);
      const isVideoSubmission = effectiveMode === "video" || normalizedTool === "video";
      const submitTool: ToolId | null = isVideoSubmission ? "video" : effectiveTool;
      const cleanedSubmissionPrompt = (promptArg ?? prompt).trim();
      const cleanedDisplayPrompt = (options?.displayPromptOverride ?? promptArg ?? prompt).trim();
      const effectiveVideoReferenceMode = options?.videoReferenceModeOverride ?? videoReferenceMode;
      const effectiveVideoReferenceImageUrl =
        options?.videoReferenceImageUrlOverride ?? videoReferenceImageUrl;
      const effectiveMotionReferenceVideoUrl =
        options?.motionReferenceVideoUrlOverride ?? motionReferenceVideoUrl;
      const effectiveLipSyncAudio = options?.lipSyncAudioOverride ?? lipSyncAudio;
      const effectiveLipSyncTurboMode = options?.lipSyncTurboModeOverride ?? lipSyncTurboMode;
      const effectiveVideoCameraFixed = options?.videoCameraFixedOverride ?? videoCameraFixed;
      const effectiveVideoAutoFix = options?.videoAutoFixOverride ?? videoAutoFix;
      const effectiveSeedance2InputMode = options?.seedance2InputModeOverride ?? seedance2InputMode;
      const effectiveSeedance2ReferenceImageUrls =
        options?.seedance2ReferenceImageUrlsOverride ?? seedance2ReferenceImageUrls;
      const effectiveSeedance2ReferenceVideoUrls =
        options?.seedance2ReferenceVideoUrlsOverride ?? seedance2ReferenceVideoUrls;
      const effectiveSeedance2ReferenceVideoDurations =
        options?.seedance2ReferenceVideoDurationsOverride ?? [];
      const effectiveSeedance2ReferenceAudioUrls =
        options?.seedance2ReferenceAudioUrlsOverride ?? seedance2ReferenceAudioUrls;
      const effectiveSeedance2ReturnLastFrame =
        options?.seedance2ReturnLastFrameOverride ?? seedance2ReturnLastFrame;
      const effectiveSeedance2WebSearch = options?.seedance2WebSearchOverride ?? seedance2WebSearch;
      const effectiveKlingNegativePrompt =
        options?.klingNegativePromptOverride ?? klingNegativePrompt;
      const effectiveKlingCfgScale = options?.klingCfgScaleOverride ?? klingCfgScale;
      const effectiveKlingWorkflowMode = options?.klingWorkflowModeOverride ?? klingWorkflowMode;
      const effectiveKlingShotType = options?.klingShotTypeOverride ?? klingShotType;
      const effectiveKlingVoiceIds = options?.klingVoiceIdsOverride ?? klingVoiceIds;
      const effectiveKlingMultiPrompts = options?.klingMultiPromptsOverride ?? klingMultiPrompts;
      const effectiveKlingElements = options?.klingElementsOverride ?? klingElements;

      if (shouldSkipTextCreateSubmission(effectiveTool, effectiveMode)) {
        removeOptimisticPlaceholder();
        setUiError(CREATE_TEXT_MODE_SUBMIT_BLOCK_ERROR);
        return;
      }
      const resolvedVideoLane = resolveVideoGenerationLaneFromInputs({
        imageInputs,
        referenceMode: effectiveVideoReferenceMode,
      });
      const requestedModel = options?.modelIdOverride ?? model;
      const finalModel = isVideoSubmission
        ? resolveAutoVideoModelForLane({
            currentModel: requestedModel,
            lane: resolvedVideoLane,
          })
        : requestedModel;
      const isSeedance2Submission =
        finalModel === KIE_SEEDANCE_2_MODEL_ID || finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID;
      const seedance2SubmitReferenceVideoUrls =
        isSeedance2Submission && effectiveSeedance2InputMode === "multimodal"
          ? Array.from(
              new Set([
                ...effectiveSeedance2ReferenceVideoUrls
                  .map((value) => value.trim())
                  .filter(Boolean),
                ...effectiveKlingElements.flatMap(
                  (element) => resolveSeedanceElementProviderEligibility(element).videoUrls
                ),
              ])
            )
          : [];
      const seedance2ReferenceVideoDurations =
        effectiveSeedance2ReferenceVideoDurations.length > 0
          ? effectiveSeedance2ReferenceVideoDurations
          : resolveSeedanceVideoReferenceDurations({
              referenceVideoUrls: effectiveSeedance2ReferenceVideoUrls,
              outputs,
            });
      const seedance2InputVideoDurationSeconds = resolveSeedanceInputVideoDurationSeconds({
        referenceVideoUrls: seedance2SubmitReferenceVideoUrls,
        outputs,
        persistedVideoReferences: [
          ...collectSeedanceElementVideoReferenceDurations(effectiveKlingElements),
          ...seedance2ReferenceVideoDurations,
        ],
      });
      const seedance2ReferenceVideoDurationLimitError = isSeedance2Submission
        ? resolveSeedanceVideoReferenceDurationLimitError(seedance2InputVideoDurationSeconds)
        : null;
      const internalMediaRefs = dedupeInternalMediaRefs(
        [
          ...(options?.internalMediaRefsOverride ?? []),
          ...resolveInternalMediaRefsForUrls(imageInputs, MAX_IMAGE_REFERENCE_INPUT_LIMIT),
        ],
        MAX_IMAGE_REFERENCE_INPUT_LIMIT
      );
      const hasReferenceImages =
        (imageInputs && imageInputs.length > 0) || hasUsableInternalMediaRefs(internalMediaRefs);
      const isEditWorkflow = normalizedTool === "image";
      const finalModelConfig = finalModel ? getModelConfig(finalModel) : null;
      const requiresImageToImageReferences = isEditWorkflow
        ? Boolean(finalModelConfig?.supportsImageToImage)
        : Boolean(finalModelConfig?.supportsImageToImage && !finalModelConfig?.supportsTextToImage);
      const isLipSyncSubmission =
        isVideoSubmission &&
        effectiveVideoReferenceMode === "lip-sync" &&
        finalModel === FAL_OMNIHUMAN_V15_MODEL_ID;
      const isMotionControlSubmission =
        isVideoSubmission && effectiveVideoReferenceMode === "motion";
      const activeMotionReferenceVideoUrl = isMotionControlSubmission
        ? effectiveMotionReferenceVideoUrl
        : null;
      const activeLipSyncAudio = isLipSyncSubmission
        ? effectiveLipSyncAudio
        : createEmptyLipSyncAudioState();
      const requiresPrompt = isEditWorkflow
        ? shouldRequirePromptForEditModel(finalModel)
        : !(isLipSyncSubmission || isMotionControlSubmission);
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
      if (seedance2ReferenceVideoDurationLimitError) {
        removeOptimisticPlaceholder();
        setUiError(seedance2ReferenceVideoDurationLimitError);
        return;
      }
      if (!finalModel) {
        removeOptimisticPlaceholder();
        setUiError("Pick a model to generate.");
        return;
      }
      const imageReferenceInputLimit = resolveImageReferenceInputLimitForModel(finalModel);
      if (!options?.inpaintOverride && imageInputs.length > imageReferenceInputLimit) {
        removeOptimisticPlaceholder();
        setUiError(
          buildTooManyReferenceImagesMessage({
            modelLabel: resolveModelLabel(finalModel),
            limit: imageReferenceInputLimit,
          })
        );
        return;
      }

      const submissionOwner = resolveSubmissionOwner({
        override: options?.submissionOwner,
        isVideoSubmission,
        effectiveTool,
      });
      beginPanelGeneration(submissionOwner);
      try {
        const id = optimisticOutputId ?? `out-${randomId()}`;
        submissionOutputId = id;
        const submissionTraceId = buildGenerationSubmissionTraceId(id);
        const sourceRef = submissionTraceId;
        markOutputSubmissionActive?.(id);
        const modelLabel = resolveModelLabel(finalModel);

        const isVeoFirstLastFrameModel = finalModel === KIE_VEO_31_FAST_I2V_MODEL_ID;
        const isVeoImageToVideoModel = finalModel === KIE_VEO_31_FAST_I2V_MODEL_ID;
        const modelConfig = finalModelConfig;
        const isImageToVideoModel = modelConfig?.mediaType === "image-to-video";
        const requiresMotionReferenceImage =
          finalModel === KIE_KLING_30_MODEL_ID && effectiveVideoReferenceMode === "motion";
        const requestedAspect = options?.aspectOverride ?? aspect;
        const effectiveAspect = resolveEffectiveAspectForModel(
          finalModel,
          requestedAspect,
          modelConfig?.defaultAspect ?? "16:9"
        );
        const isVideoGeneration = isVideoSubmission;
        const isImageGeneration =
          effectiveMode === "image" || effectiveTool === "image" || effectiveTool === "edit";
        const requestedDurationSeconds = isVideoGeneration
          ? (options?.videoDurationSecondsOverride ?? videoDurationSeconds)
          : getDefaultDurationSeconds(finalModel);
        const requestedImageResolution = isImageGeneration
          ? clampImageResolutionForModel(
              finalModel,
              options?.imageResolutionOverride ?? imageResolution
            )
          : modelConfig?.defaultResolution;
        const requestedResolution = isVideoGeneration
          ? (options?.videoResolutionOverride ?? videoResolution)
          : isModelDefaultImageResolution(requestedImageResolution)
            ? undefined
            : requestedImageResolution;
        const requestedAudio = isVideoGeneration
          ? (options?.videoGenerateAudioOverride ?? videoGenerateAudio)
          : (modelConfig?.defaultAudio ?? true);

        const outputMode: StudioMode = isVideoSubmission
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
          durationSeconds: isVideoGeneration ? requestedDurationSeconds : null,
          characterContext: options?.characterContextOverride,
          styleContext: options?.styleContextOverride,
          submissionTraceId,
          sourceRef,
          submissionMode: resolveSubmissionModeForModelId(finalModel),
          hiddenInReferenceGrid:
            finalModel === BRIA_BACKGROUND_REMOVE_MODEL_ID || options?.hideOutputFromReferenceGrid,
        });
        // Render or reconcile the spinner placeholder before URL prep/submission work begins.
        setOutputs((prev) => reconcilePendingSubmissionOutput(prev, nextOutput));
        setSaved(false);

        let preparedImageInputs: string[] = [];
        let preparedImageInputRefs: PreparedSubmissionReferenceInput[] = [];
        let preparedRestoreOnlyImageInputs: PreparedSubmissionReferenceInput[] = [];
        let preparedInpaintOverride: InpaintSubmissionOverride | null = null;
        try {
          const restoreOnlyImageInputs = resolveRestoreOnlyImageInputs({
            providerImageInputs: imageInputs,
            restoreImageInputs: options?.expertEditRestoreImageInputs,
          });
          const prepared = await prepareSubmissionReferenceInputs({
            outputId: id,
            modelId: finalModel,
            tool: submitTool,
            imageInputs,
            restoreOnlyImageInputs,
            inpaintOverride: options?.inpaintOverride,
            timeoutMessage: PREPARE_REFERENCE_TIMEOUT_ERROR,
          });
          preparedImageInputs = prepared.preparedImageInputs;
          preparedImageInputRefs = prepared.preparedImageInputRefs;
          preparedRestoreOnlyImageInputs = prepared.preparedRestoreOnlyImageInputs;
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
          preparedImageInputs.length === 0 &&
          !hasUsableInternalMediaRefs(internalMediaRefs)
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
        const preparedInternalMediaRefs = preparedImageInputs.map(
          (_url, index) =>
            preparedImageInputRefs[index]?.internalMediaRef ?? internalMediaRefs[index] ?? null
        );
        const submissionInternalMediaRefs =
          preparedImageInputs.length > 0 ? preparedInternalMediaRefs : internalMediaRefs;
        const expertEditWorkflowReloadReferences = reconcileExpertEditWorkflowReloadReferences({
          expertEditReferences: options?.expertEditReferences,
          preparedReferenceInputs: preparedImageInputRefs,
          preparedRestoreOnlyReferenceInputs: preparedRestoreOnlyImageInputs,
        });
        const generationReplay = options?.inpaintOverride
          ? null
          : buildSubmissionReplaySnapshot({
              mode: outputMode,
              submitTool,
              modelId: finalModel,
              displayPrompt: cleanedDisplayPrompt,
              submissionPrompt: cleanedSubmissionPrompt,
              aspect: effectiveAspect,
              imageResolution: isImageGeneration ? (requestedResolution ?? null) : null,
              referenceInputs: preparedImageInputs.slice(0, imageReferenceInputLimit),
              internalMediaRefs: submissionInternalMediaRefs,
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
        const workflowReload = options?.inpaintOverride
          ? null
          : buildSubmissionWorkflowReloadSnapshot({
              outputMode,
              originTool: submitTool,
              panelKind: outputMode === "video" ? "video" : isEditWorkflow ? "edit" : "create",
              projectId,
              modelId: finalModel,
              displayPrompt: cleanedDisplayPrompt,
              submissionPrompt: cleanedSubmissionPrompt,
              aspect: effectiveAspect,
              imageResolution: isImageGeneration ? (requestedResolution ?? null) : null,
              referenceInputs: preparedImageInputs.slice(0, imageReferenceInputLimit),
              internalMediaRefs: submissionInternalMediaRefs,
              expertEditReferences: expertEditWorkflowReloadReferences,
              characterContext: options?.characterContextOverride,
              styleContext: options?.styleContextOverride,
              videoReferenceMode: effectiveVideoReferenceMode,
              durationSeconds: isVideoGeneration ? requestedDurationSeconds : null,
              resolution: isVideoGeneration ? (requestedResolution ?? null) : null,
              generateAudio: isVideoGeneration ? requestedAudio : null,
              cameraFixed: isVideoGeneration ? effectiveVideoCameraFixed : null,
              autoFix: isVideoGeneration ? effectiveVideoAutoFix : null,
              motionReferenceVideoUrl:
                isVideoGeneration && isMotionControlSubmission
                  ? effectiveMotionReferenceVideoUrl
                  : null,
              lipSyncAudioUrl:
                isVideoGeneration && effectiveVideoReferenceMode === "lip-sync"
                  ? getDurableLipSyncAudioUrl(effectiveLipSyncAudio)
                  : null,
              lipSyncAudioStoragePath:
                isVideoGeneration && effectiveVideoReferenceMode === "lip-sync"
                  ? getLipSyncAudioStoragePath(effectiveLipSyncAudio)
                  : null,
              lipSyncAudioDurationMs:
                isVideoGeneration &&
                effectiveVideoReferenceMode === "lip-sync" &&
                (getDurableLipSyncAudioUrl(effectiveLipSyncAudio) ||
                  getLipSyncAudioStoragePath(effectiveLipSyncAudio))
                  ? effectiveLipSyncAudio.durationMs
                  : null,
              lipSyncTurboMode:
                isVideoGeneration && effectiveVideoReferenceMode === "lip-sync"
                  ? effectiveLipSyncTurboMode
                  : null,
              seedance2InputMode: effectiveSeedance2InputMode,
              seedance2ReferenceImageUrls: effectiveSeedance2ReferenceImageUrls,
              seedance2ReferenceVideoUrls: effectiveSeedance2ReferenceVideoUrls,
              seedance2ReferenceVideoDurations,
              seedance2ReferenceAudioUrls: effectiveSeedance2ReferenceAudioUrls,
              seedance2ReturnLastFrame: effectiveSeedance2ReturnLastFrame,
              seedance2WebSearch: effectiveSeedance2WebSearch,
              klingNegativePrompt: effectiveKlingNegativePrompt,
              klingCfgScale: effectiveKlingCfgScale,
              klingWorkflowMode: effectiveKlingWorkflowMode,
              klingShotType: effectiveKlingShotType,
              klingVoiceIds: effectiveKlingVoiceIds,
              klingMultiPrompts: effectiveKlingMultiPrompts,
              klingElements: effectiveKlingElements,
            });
        if (workflowReload) {
          attachWorkflowReloadToOutput({
            id,
            workflowReload,
            updateOutputById,
          });
        }
        const displayedBilledCredits =
          options?.displayedBilledCredits ??
          promptReferenceGenerateCostCredits ??
          currentCostCredits ??
          null;
        const motionReferenceAssetContext = buildMotionReferenceAssetShortpulseContext({
          motionReferenceVideoUrl: activeMotionReferenceVideoUrl,
        });
        const lipSyncAudioDurationSeconds =
          typeof effectiveLipSyncAudio.durationMs === "number" &&
          Number.isFinite(effectiveLipSyncAudio.durationMs)
            ? Math.max(0, effectiveLipSyncAudio.durationMs / 1000)
            : null;
        const usesPricingGridDisplay =
          (outputMode === "image" && (effectiveTool === "create" || effectiveTool === "edit")) ||
          (outputMode === "video" && submitTool === "video");
        const shortpulseContext = {
          selected_tool: submitTool,
          mode: outputMode,
          source_ref: sourceRef,
          project_id: projectId ?? null,
          project_id_present: Boolean(projectId),
          workspace_runtime_key: projectId ? null : (workspaceRuntimeKey ?? null),
          workspace_runtime_key_present: Boolean(!projectId && workspaceRuntimeKey),
          is_character_mode: Boolean(options?.characterContextOverride?.applied),
          selected_character_id: options?.characterContextOverride?.characterId ?? null,
          has_style: Boolean(options?.styleContextOverride?.applied),
          style_id: options?.styleContextOverride?.styleId ?? null,
          reference_count: Math.max(
            preparedImageInputs.length,
            submissionInternalMediaRefs.filter((ref) => Boolean(ref)).length
          ),
          pricing_display_source: usesPricingGridDisplay ? "pricing_grid" : "shared_adapter",
          pricing_policy_ready: true,
          displayed_pricing_policy_version: options?.displayedPricingPolicyVersion ?? null,
          displayed_pricing_variant_id: options?.displayedPricingVariantId ?? null,
          displayed_billed_credits: displayedBilledCredits,
          ...(isLipSyncSubmission
            ? {
                lip_sync_audio_duration_ms: effectiveLipSyncAudio.durationMs ?? null,
                lip_sync_audio_duration_seconds: lipSyncAudioDurationSeconds,
                audio_duration_ms: effectiveLipSyncAudio.durationMs ?? null,
                audio_duration_seconds: lipSyncAudioDurationSeconds,
              }
            : {}),
          ...(seedance2SubmitReferenceVideoUrls.length > 0
            ? {
                input_video_count: seedance2SubmitReferenceVideoUrls.length,
                ...(seedance2InputVideoDurationSeconds != null
                  ? {
                      input_video_duration_seconds: seedance2InputVideoDurationSeconds,
                      seedance_input_video_duration_seconds: seedance2InputVideoDurationSeconds,
                    }
                  : {}),
              }
            : {}),
          ...(motionReferenceAssetContext
            ? { motion_reference_asset: motionReferenceAssetContext }
            : {}),
        };
        const pulseReferenceImageUrl =
          preparedImageInputs.length > 0 ? preparedImageInputs[0] : undefined;
        const falReferencePayload = pulseReferenceImageUrl
          ? {
              image_url: pulseReferenceImageUrl,
              image_urls: preparedImageInputs.slice(0, imageReferenceInputLimit),
            }
          : ({} as Record<string, never>);

        const requiresStandardVideoReference =
          isVideoSubmission && resolvedVideoLane === "single-image" && isImageToVideoModel;
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

        let taskStarted = false;
        let startedTaskId: string | null = null;
        let startedProvider: Provider | null = null;
        let startedLifecycleMode: "queued" | "direct" | null = null;
        let submissionFailureSignaled = false;
        try {
          const notifyGenerationFailureForSubmit = (
            outputId: string,
            message: string,
            detail?: string,
            context?: GenerationFailureContext
          ) => {
            submissionFailureSignaled = true;
            notifyGenerationFailure(outputId, message, detail, context);
          };
          const { startPollingWithGeneration, completeGenerationImmediately } =
            createSubmissionLifecycleCallbacks({
              outputId: id,
              modelId: finalModel,
              tool: submitTool,
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
              createLifecycleContractError: submitLifecycleContractError,
            });
          const startPollingWithGenerationGuarded = (
            ...args: Parameters<typeof startPollingWithGeneration>
          ) => {
            startedLifecycleMode = "queued";
            return startPollingWithGeneration(...args);
          };
          const completeGenerationImmediatelyGuarded = (
            ...args: Parameters<typeof completeGenerationImmediately>
          ) => {
            startedLifecycleMode = "direct";
            return completeGenerationImmediately(...args);
          };

          await dispatchSubmissionByRoute({
            id,
            projectId,
            finalModel,
            cleanedPrompt: cleanedSubmissionPrompt,
            outputMode,
            effectiveAspect,
            requestedDurationSeconds,
            requestedResolution,
            requestedAudio,
            preparedImageInputs,
            modelConfig,
            generationReplay,
            workflowReload,
            internalMediaRefs: submissionInternalMediaRefs,
            characterContext: options?.characterContextOverride,
            styleContext: options?.styleContextOverride,
            shortpulseContext,
            falReferencePayload,
            inpaintOverride: preparedInpaintOverride,
            videoReferenceMode: effectiveVideoReferenceMode,
            videoReferenceImageUrl: effectiveVideoReferenceImageUrl,
            motionReferenceVideoUrl: activeMotionReferenceVideoUrl,
            lipSyncAudio: activeLipSyncAudio,
            lipSyncTurboMode: isLipSyncSubmission ? effectiveLipSyncTurboMode : false,
            rawImageInputs: imageInputs,
            seedance2InputMode: effectiveSeedance2InputMode,
            seedance2ReferenceImageUrls: effectiveSeedance2ReferenceImageUrls,
            seedance2ReferenceVideoUrls: effectiveSeedance2ReferenceVideoUrls,
            seedance2ReferenceAudioUrls: effectiveSeedance2ReferenceAudioUrls,
            seedance2ReturnLastFrame: effectiveSeedance2ReturnLastFrame,
            seedance2WebSearch: effectiveSeedance2WebSearch,
            klingCfgScale: effectiveKlingCfgScale,
            klingWorkflowMode: effectiveKlingWorkflowMode,
            klingMultiPrompts: effectiveKlingMultiPrompts,
            klingElements: effectiveKlingElements,
            notifyGenerationFailure: notifyGenerationFailureForSubmit,
            updateOutputById,
            startPollingWithGeneration: startPollingWithGenerationGuarded,
            completeGenerationImmediately: completeGenerationImmediatelyGuarded,
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
          const pricingError = error as Error & {
            code?: string;
            pricingConflict?: Partial<PricingPolicyConflictPayload>;
          };
          if (isPricingPolicyConflictCode(pricingError.code)) {
            removeOptimisticPlaceholder();
            const conflict = pricingError.pricingConflict;
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event(PRICING_POLICY_REFRESH_REQUESTED_EVENT));
              window.dispatchEvent(
                new CustomEvent(PRICING_POLICY_CONFLICT_EVENT, {
                  detail: { outputId: submissionOutputId ?? null },
                })
              );
            }
            const previousCredits = conflict?.displayedBilledCredits;
            const activeCredits = conflict?.activeBilledCredits;
            const creditChange =
              typeof previousCredits === "number" && typeof activeCredits === "number"
                ? ` from ${previousCredits} to ${activeCredits} credits`
                : "";
            const refreshedVersion = conflict?.activePricingPolicyVersion;
            setUiNotice(
              `Pricing updated${creditChange}${typeof refreshedVersion === "number" ? ` (policy ${refreshedVersion})` : ""}. Review the new price, then click Generate again.`
            );
            return;
          }
          if (isAuthSessionTimeoutError(error)) {
            notifyGenerationFailure(
              id,
              SUBMIT_NOT_STARTED_USER_ERROR,
              AUTH_SESSION_TIMEOUT_DETAIL,
              {
                reasonCode: "AUTH_SESSION_TIMEOUT",
                telemetryMode: "state_only",
              }
            );
            void reportAppError({
              source: "fal_auth_session_timeout",
              scope: "generation",
              severity: "high",
              message: "Fal generation submit blocked by session timeout.",
              metadata: {
                output_id: id,
                model_id: finalModel,
                tool: submitTool,
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
              submissionError.detail ?? SUBMIT_NOT_STARTED_USER_ERROR,
              {
                reasonCode: "SUBMIT_NOT_STARTED",
                telemetryMode: "state_only",
              }
            );
            void reportAppError({
              source: "fal_submit_not_started",
              scope: "generation",
              severity: "high",
              message: "Fal generation did not start.",
              metadata: {
                output_id: id,
                model_id: finalModel,
                tool: submitTool,
                reason_code: "SUBMIT_NOT_STARTED",
                detail: submissionError.detail ?? null,
              },
            });
            return;
          }
          if (submissionError?.code === "SUBMIT_LIFECYCLE_CONTRACT") {
            void reportAppError({
              source: "generation_submit_lifecycle_contract",
              scope: "generation",
              severity: "high",
              message: "Generation submit handler violated the queued/direct lifecycle contract.",
              metadata: {
                output_id: id,
                model_id: finalModel,
                tool: submitTool,
                task_started: taskStarted,
                started_task_id: startedTaskId,
                started_provider: startedProvider,
                detail: submissionError.detail ?? null,
              },
            });
            if (taskStarted) {
              return;
            }
            notifyGenerationFailure(
              id,
              SUBMIT_NOT_STARTED_USER_ERROR,
              submissionError.detail ?? SUBMIT_NOT_STARTED_USER_ERROR,
              {
                reasonCode: "SUBMIT_LIFECYCLE_CONTRACT",
                telemetryMode: "state_only",
              }
            );
            return;
          }
          const message = error instanceof Error ? error.message : "Failed to start generation";
          if (isInsufficientCreditsLike(error)) {
            setUiError(INSUFFICIENT_CREDITS_TITLE);
            updateOutputById(id, (item) => ({
              ...item,
              taskState: "fail",
              errorMessage: INSUFFICIENT_CREDITS_MESSAGE,
              errorMessageShort: INSUFFICIENT_CREDITS_TITLE,
              errorDetail: INSUFFICIENT_CREDITS_MESSAGE,
              errorPayload: { code: INSUFFICIENT_CREDITS_CODE },
              timestamp: INSUFFICIENT_CREDITS_TITLE,
            }));
            return;
          }
          if (taskStarted && startedTaskId && startedProvider) {
            const recoveredTaskId = startedTaskId;
            const recoveredProvider = startedProvider;
            void reportAppError({
              source: "generation_submit_post_handoff_error",
              scope: "generation",
              severity: "high",
              message: "Generation submit failed after provider handoff.",
              metadata: {
                output_id: id,
                model_id: finalModel,
                tool: submitTool,
                started_task_id: recoveredTaskId,
                started_provider: recoveredProvider,
                lifecycle_mode: startedLifecycleMode,
                error_message: message,
              },
            });
            if (startedLifecycleMode === "queued") {
              try {
                updateOutputById(id, (item) =>
                  applyDispatchedSubmissionPatch({
                    item,
                    patch: {},
                    provider: recoveredProvider,
                    taskId: recoveredTaskId,
                  })
                );
                startPollingTask(
                  recoveredTaskId,
                  id,
                  0,
                  recoveredProvider,
                  Date.now(),
                  0,
                  undefined,
                  {
                    initialDelayMs: DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS,
                  }
                );
              } catch (recoveryError) {
                const recoveryMessage =
                  recoveryError instanceof Error
                    ? recoveryError.message
                    : "Unknown post-handoff recovery failure";
                void reportAppError({
                  source: "generation_submit_post_handoff_recovery_failed",
                  scope: "generation",
                  severity: "high",
                  message: "Generation submit recovery failed after provider handoff.",
                  metadata: {
                    output_id: id,
                    model_id: finalModel,
                    tool: submitTool,
                    started_task_id: startedTaskId,
                    started_provider: startedProvider,
                    recovery_error_message: recoveryMessage,
                  },
                });
              }
            }
            return;
          }
          notifyGenerationFailure(id, message, message);
        }
      } finally {
        endPanelGeneration(submissionOwner);
      }
    },
    [
      aspect,
      beginPanelGeneration,
      endPanelGeneration,
      setOutputs,
      setSaved,
      setUiError,
      setUiNotice,
      getDefaultDurationSeconds,
      model,
      mode,
      outputs,
      projectId,
      workspaceRuntimeKey,
      notifyGenerationFailure,
      prompt,
      currentCostCredits,
      promptReferenceGenerateCostCredits,
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
      lipSyncAudio,
      lipSyncTurboMode,
      videoCameraFixed,
      videoAutoFix,
      klingNegativePrompt,
      klingCfgScale,
      klingWorkflowMode,
      klingShotType,
      klingVoiceIds,
      klingMultiPrompts,
      klingElements,
    ]
  );
};
