import React from "react";
import type {
  ExpertEditStageFlattenLayer,
  StageFlattenCameraTransformInput,
} from "../../logic/expertEditStageFlatten";
import { resolveInpaintPromptReferencePolicy } from "../../logic/inpaintSubmission";
import { normalizeEditSubmitIntent, type EditSubmitIntent } from "../../logic/editSubmitIntent";
import { exportExpertEditStageArtifacts } from "./expertEditStageExport";
import type {
  ExpertEditRegenerateWithReferenceInputsHandler,
  ExpertEditVariantCostResolver,
} from "./expertEditSubmissionContract";
import { resolveExpertEditSubmissionDispatch } from "./expertEditSubmissionDispatch";
import {
  cleanupExpertEditSubmissionObjectUrls,
  createExpertEditSubmissionObjectUrls,
  revokeExpertEditSubmissionObjectUrls,
} from "./expertEditSubmissionObjectUrls";
import {
  prepareExpertEditSubmission,
  validateExpertEditSubmissionPrompt,
} from "./expertEditSubmissionPreparation";
import type { MarkupStroke } from "./markupStrokeController";

type ExportSelectedLayerMaskBlob = (params: {
  targetWidth: number;
  targetHeight: number;
  mimeType?: "image/png" | "image/jpeg";
  camera?: StageFlattenCameraTransformInput | null;
}) => Promise<Blob | null>;

type StageFlattenSnapshot = {
  outputAspectRatio?: number;
  camera?: StageFlattenCameraTransformInput | null;
  canReusePrimarySourceUrl?: boolean;
};

type UseExpertEditInlineGenerateParams = {
  layers: ExpertEditStageFlattenLayer[];
  promptText: string;
  extraImageUrls: readonly (string | null)[];
  reusablePrimarySourceUrl?: string | null;
  flattenTargetLongestEdgePx?: number | null;
  markupStrokes: MarkupStroke[];
  populatedLayerCount: number;
  editSubmitIntent: EditSubmitIntent;
  hasSelectedLayerMask: boolean;
  exportSelectedLayerMaskBlob: ExportSelectedLayerMaskBlob;
  onRegenerate: () => void;
  onRegenerateWithReferenceInputs?: ExpertEditRegenerateWithReferenceInputsHandler;
  resolveVariantCostCredits?: ExpertEditVariantCostResolver;
  scheduleTransientObjectUrlRevoke: (url: string) => void;
  revokeObjectUrlSafe: (url: string) => void;
  resolveBlobDimensions: (blob: Blob) => Promise<{ width: number; height: number }>;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
  onInvalidPromptReferenceToken?: (message: string) => void;
  resolveStageFlattenSnapshot?: () => StageFlattenSnapshot;
  insertOptimisticGenerationPlaceholder?: (prompt: string) => string | null;
  removeOptimisticGenerationPlaceholder?: (outputId: string) => void;
  notifyGenerationFailure?: (outputId: string, message: string, detail?: string) => void;
};

const LAYER_IMAGE_LOAD_FAILURE_PREFIX = "Failed to load layer image:";
const EXPIRED_REFERENCE_FRAGMENT = "Reference URL expired";

const resolveFlattenFailureToastMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return "Unable to flatten layers.";
  const errorMessage = error.message ?? "";
  if (errorMessage.includes(EXPIRED_REFERENCE_FRAGMENT)) {
    return "One or more layer images expired. Re-add the image and try again.";
  }
  if (errorMessage.includes(LAYER_IMAGE_LOAD_FAILURE_PREFIX)) {
    return "One or more layer images are unavailable. Re-add the image and try again.";
  }
  return "Unable to flatten layers.";
};

const resolveSubmissionFailureToastMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return "Unable to submit edit generation.";
  const errorMessage = error.message?.trim() ?? "";
  return errorMessage.length > 0 ? errorMessage : "Unable to submit edit generation.";
};

export const useExpertEditInlineGenerate = ({
  layers,
  promptText,
  extraImageUrls,
  reusablePrimarySourceUrl = "",
  flattenTargetLongestEdgePx = null,
  markupStrokes,
  populatedLayerCount,
  editSubmitIntent,
  hasSelectedLayerMask,
  exportSelectedLayerMaskBlob,
  onRegenerate,
  onRegenerateWithReferenceInputs,
  resolveVariantCostCredits,
  scheduleTransientObjectUrlRevoke,
  revokeObjectUrlSafe,
  resolveBlobDimensions,
  showStatusToast,
  onInvalidPromptReferenceToken,
  resolveStageFlattenSnapshot,
  insertOptimisticGenerationPlaceholder,
  removeOptimisticGenerationPlaceholder,
  notifyGenerationFailure,
}: UseExpertEditInlineGenerateParams) => {
  const [inlineGeneratePendingCount, setInlineGeneratePendingCount] = React.useState(0);
  const inlineGenerateInFlightRef = React.useRef(false);
  const scheduledRunTimeoutIdsRef = React.useRef<number[]>([]);
  const normalizedEditSubmitIntent = React.useMemo(
    () => normalizeEditSubmitIntent(editSubmitIntent),
    [editSubmitIntent]
  );
  const inpaintPromptReferencePolicy = React.useMemo(
    () =>
      normalizedEditSubmitIntent === "inpaint"
        ? resolveInpaintPromptReferencePolicy({
            promptText,
            extraImageUrls,
          })
        : null,
    [extraImageUrls, normalizedEditSubmitIntent, promptText]
  );
  React.useEffect(
    () => () => {
      scheduledRunTimeoutIdsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      scheduledRunTimeoutIdsRef.current = [];
    },
    []
  );
  const handleInlineGenerate = React.useCallback(() => {
    if (inlineGenerateInFlightRef.current) {
      return;
    }
    const allowSecondaryReferenceTokens =
      normalizedEditSubmitIntent === "inpaint"
        ? (inpaintPromptReferencePolicy?.allowSecondaryReferenceTokens ?? false)
        : true;
    const maxSecondaryReferenceTokens =
      normalizedEditSubmitIntent === "inpaint"
        ? inpaintPromptReferencePolicy?.maxSecondaryReferenceTokens
        : undefined;
    if (populatedLayerCount <= 0) {
      showStatusToast("Add at least one layer image before generating.");
      return;
    }
    const promptValidation = validateExpertEditSubmissionPrompt({
      promptText,
      extraImageUrls,
      allowSecondaryReferenceTokens,
      maxSecondaryReferenceTokens,
    });
    if (promptValidation.status === "invalid_tokens") {
      onInvalidPromptReferenceToken?.(promptValidation.message);
      return;
    }

    inlineGenerateInFlightRef.current = true;
    setInlineGeneratePendingCount((currentCount) => currentCount + 1);
    let optimisticOutputId = insertOptimisticGenerationPlaceholder?.(promptText) ?? null;
    const markOptimisticGenerationFailure = (message: string, detail: string = message) => {
      if (!optimisticOutputId) return;
      if (notifyGenerationFailure) {
        notifyGenerationFailure(optimisticOutputId, message, detail);
      } else {
        removeOptimisticGenerationPlaceholder?.(optimisticOutputId);
      }
      optimisticOutputId = null;
    };
    const objectUrls = {
      flattenedUrl: null,
      flattenedMarkupReferenceUrl: null,
      inpaintMaskUrl: null,
    };

    const run = async () => {
      try {
        let submitDispatch: ReturnType<typeof resolveExpertEditSubmissionDispatch> | null = null;
        let exportArtifacts: Awaited<ReturnType<typeof exportExpertEditStageArtifacts>> | null =
          null;
        try {
          exportArtifacts = await exportExpertEditStageArtifacts({
            layers,
            reusablePrimarySourceUrl,
            flattenTargetLongestEdgePx,
            markupStrokes,
            editSubmitIntent: normalizedEditSubmitIntent,
            hasSelectedLayerMask,
            exportSelectedLayerMaskBlob,
            resolveBlobDimensions,
            resolveStageFlattenSnapshot,
          });
          const flattenedBlob = exportArtifacts.flattenedBlob;
          Object.assign(
            objectUrls,
            createExpertEditSubmissionObjectUrls({
              flattenedBlob,
              flattenedMarkupReferenceBlob: exportArtifacts.flattenedMarkupReferenceBlob,
              inpaintMaskBlob: exportArtifacts.inpaintMaskBlob,
            })
          );
          const primaryReferenceUrl =
            exportArtifacts.reusablePrimarySourceUrl || objectUrls.flattenedUrl;
          const preparedSubmission = prepareExpertEditSubmission({
            promptText,
            extraImageUrls,
            flattenedPrimaryUrl: primaryReferenceUrl,
            flattenedMarkupReferenceUrl: objectUrls.flattenedMarkupReferenceUrl,
            editSubmitIntent: normalizedEditSubmitIntent,
            allowSecondaryReferenceTokens,
            maxSecondaryReferenceTokens,
          });
          if (preparedSubmission.status === "invalid_tokens") {
            markOptimisticGenerationFailure(preparedSubmission.message);
            onInvalidPromptReferenceToken?.(preparedSubmission.message);
            return;
          }
          const {
            linkedSecondaryReferenceInputs,
            promptOverrideOptions,
            referenceInputs,
            workflowReloadExpertEditReferences,
          } = preparedSubmission;
          submitDispatch = resolveExpertEditSubmissionDispatch({
            editSubmitIntent: normalizedEditSubmitIntent,
            hasSubmissionHandler: Boolean(onRegenerateWithReferenceInputs),
            hasSelectedLayerMask,
            flattenedUrl: objectUrls.flattenedUrl,
            inpaintMaskUrl: objectUrls.inpaintMaskUrl,
            flattenedDimensions: exportArtifacts.flattenedDimensions,
            inpaintModelId: inpaintPromptReferencePolicy?.modelId,
            inpaintReferenceImageInput: linkedSecondaryReferenceInputs[0] ?? null,
            referenceInputs,
            promptOverrideOptions,
            expertEditReferences: workflowReloadExpertEditReferences,
          });
        } catch (error) {
          const failureMessage = resolveFlattenFailureToastMessage(error);
          markOptimisticGenerationFailure(failureMessage);
          revokeExpertEditSubmissionObjectUrls({
            objectUrls,
            revokeObjectUrlSafe,
          });
          showStatusToast(failureMessage);
          return;
        }
        if (!submitDispatch) {
          return;
        }
        if (submitDispatch.status === "error") {
          markOptimisticGenerationFailure(submitDispatch.message);
          showStatusToast(submitDispatch.message);
          return;
        }
        if (submitDispatch.status === "fallback_regenerate") {
          if (optimisticOutputId) {
            removeOptimisticGenerationPlaceholder?.(optimisticOutputId);
            optimisticOutputId = null;
          }
          onRegenerate();
          return;
        }
        try {
          const inpaintModelId = submitDispatch.options.inpaintOverride?.modelId?.trim() ?? "";
          const variantCostOverrideCredits =
            inpaintModelId &&
            submitDispatch.options.inpaintOverride &&
            exportArtifacts?.flattenedDimensions &&
            resolveVariantCostCredits
              ? resolveVariantCostCredits({
                  modelId: inpaintModelId,
                  imageWidth: exportArtifacts.flattenedDimensions.width,
                  imageHeight: exportArtifacts.flattenedDimensions.height,
                })
              : null;
          await onRegenerateWithReferenceInputs?.(submitDispatch.referenceInputs, {
            ...submitDispatch.options,
            ...(variantCostOverrideCredits != null
              ? { costOverrideCredits: variantCostOverrideCredits }
              : {}),
            ...(optimisticOutputId ? { outputIdOverride: optimisticOutputId } : {}),
          });
          optimisticOutputId = null;
        } catch (error) {
          const failureMessage = resolveSubmissionFailureToastMessage(error);
          markOptimisticGenerationFailure(failureMessage, failureMessage);
          revokeExpertEditSubmissionObjectUrls({
            objectUrls,
            revokeObjectUrlSafe,
          });
          showStatusToast(failureMessage);
        }
      } finally {
        inlineGenerateInFlightRef.current = false;
        setInlineGeneratePendingCount((currentCount) => Math.max(0, currentCount - 1));
        cleanupExpertEditSubmissionObjectUrls({
          objectUrls,
          hasSubmissionHandler: Boolean(onRegenerateWithReferenceInputs),
          revokeObjectUrlSafe,
          scheduleTransientObjectUrlRevoke,
        });
      }
    };

    // Yield one task before the expensive stage export so the click can paint
    // optimistic UI first without allowing overlapping inline submissions.
    const kickoffTimeoutId = window.setTimeout(() => {
      scheduledRunTimeoutIdsRef.current = scheduledRunTimeoutIdsRef.current.filter(
        (timeoutId) => timeoutId !== kickoffTimeoutId
      );
      void run();
    }, 0);
    scheduledRunTimeoutIdsRef.current.push(kickoffTimeoutId);
  }, [
    extraImageUrls,
    exportSelectedLayerMaskBlob,
    hasSelectedLayerMask,
    inpaintPromptReferencePolicy,
    layers,
    markupStrokes,
    onRegenerate,
    onRegenerateWithReferenceInputs,
    promptText,
    populatedLayerCount,
    reusablePrimarySourceUrl,
    flattenTargetLongestEdgePx,
    revokeObjectUrlSafe,
    scheduleTransientObjectUrlRevoke,
    resolveBlobDimensions,
    resolveVariantCostCredits,
    showStatusToast,
    onInvalidPromptReferenceToken,
    resolveStageFlattenSnapshot,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    notifyGenerationFailure,
    normalizedEditSubmitIntent,
  ]);

  return {
    handleInlineGenerate,
    isInlineGeneratePending: inlineGeneratePendingCount > 0,
  };
};
