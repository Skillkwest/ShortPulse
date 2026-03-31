import React from "react";
import {
  composePrimaryStageLayersToBlob,
  type ExpertEditStageFlattenLayer,
} from "../../logic/expertEditStageFlatten";
import {
  analyzeExpertEditPromptTokens,
  buildExpertEditSubmissionReferenceInputs,
  compileExpertEditSubmissionPrompt,
} from "../../logic/expertEditPromptReferences";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  isMarkupModelLockEnabled,
  isMarkupStrokeSecondaryReferenceEnabled,
  type InpaintSubmissionOverride,
} from "../../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
import { composeFlattenedMarkupReferenceBlob } from "../../logic/expertEditMarkupReference";
import type { MarkupStroke } from "./markupStrokeController";

type RegenerateWithReferenceInputsHandler = (
  referenceInputs: string[],
  options?: {
    inpaintOverride?: InpaintSubmissionOverride | null;
    modelIdOverride?: string | null;
    displayPromptOverride?: string | null;
    submissionPromptOverride?: string | null;
    referenceInputsMode?: "merge" | "replace";
  }
) => void | Promise<void>;

type ExportSelectedLayerMaskBlob = (params: {
  targetWidth: number;
  targetHeight: number;
  mimeType?: "image/png" | "image/jpeg";
}) => Promise<Blob | null>;

type StageFlattenSnapshot = {
  outputAspectRatio?: number;
};

type UseExpertEditInlineGenerateParams = {
  layers: ExpertEditStageFlattenLayer[];
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
  markupStrokes: MarkupStroke[];
  populatedLayerCount: number;
  editSubmitIntent: EditSubmitIntent;
  hasSelectedLayerMask: boolean;
  exportSelectedLayerMaskBlob: ExportSelectedLayerMaskBlob;
  onRegenerate: () => void;
  onRegenerateWithReferenceInputs?: RegenerateWithReferenceInputsHandler;
  scheduleTransientObjectUrlRevoke: (url: string) => void;
  revokeObjectUrlSafe: (url: string) => void;
  resolveBlobDimensions: (blob: Blob) => Promise<{ width: number; height: number }>;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
  onInvalidPromptReferenceToken?: (message: string) => void;
  resolveStageFlattenSnapshot?: () => StageFlattenSnapshot;
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

export const useExpertEditInlineGenerate = ({
  layers,
  promptText,
  extraImageUrls,
  markupStrokes,
  populatedLayerCount,
  editSubmitIntent,
  hasSelectedLayerMask,
  exportSelectedLayerMaskBlob,
  onRegenerate,
  onRegenerateWithReferenceInputs,
  scheduleTransientObjectUrlRevoke,
  revokeObjectUrlSafe,
  resolveBlobDimensions,
  showStatusToast,
  onInvalidPromptReferenceToken,
  resolveStageFlattenSnapshot,
}: UseExpertEditInlineGenerateParams) => {
  const handleInlineGenerate = React.useCallback(() => {
    const run = async () => {
      if (populatedLayerCount <= 0) {
        showStatusToast("Add at least one layer image before generating.");
        return;
      }
      const tokenAnalysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls);
      if (tokenAnalysis.hasInvalidTokens) {
        const message =
          tokenAnalysis.inlineError ?? "Use @img1, @img2, or @img3 with populated references.";
        onInvalidPromptReferenceToken?.(message);
        return;
      }

      let flattenedUrl: string | null = null;
      let flattenedMarkupReferenceUrl: string | null = null;
      let inpaintMaskUrl: string | null = null;
      try {
        const isInpaintSubmitSelected = editSubmitIntent === "inpaint";
        const isMarkupSubmitSelected = editSubmitIntent === "markup";
        const flattenSnapshot = resolveStageFlattenSnapshot?.();
        const flattenedBlob = await composePrimaryStageLayersToBlob(layers, {
          mimeType: "image/png",
          outputAspectRatio: flattenSnapshot?.outputAspectRatio,
        });
        flattenedUrl = URL.createObjectURL(flattenedBlob);
        const shouldAttachMarkupReference =
          isMarkupSubmitSelected &&
          markupStrokes.length > 0 &&
          isMarkupStrokeSecondaryReferenceEnabled();
        if (shouldAttachMarkupReference) {
          const flattenedMarkupReferenceBlob = await composeFlattenedMarkupReferenceBlob({
            flattenedBlob,
            markupStrokes,
            resolveBlobDimensions,
          });
          if (flattenedMarkupReferenceBlob) {
            flattenedMarkupReferenceUrl = URL.createObjectURL(flattenedMarkupReferenceBlob);
          }
        }
        const referenceInputs = buildExpertEditSubmissionReferenceInputs({
          flattenedPrimaryUrl: flattenedUrl,
          flattenedMarkupReferenceUrl,
          secondarySlots: extraImageUrls,
          referencedSlotIndexes: tokenAnalysis.referencedSlotIndexes,
        });
        const compiledPrompt = compileExpertEditSubmissionPrompt({
          displayPrompt: promptText,
          secondarySlots: extraImageUrls,
          referenceInputs,
        });
        const promptOverrideOptions = compiledPrompt.hasTokenReferences
          ? {
              displayPromptOverride: promptText,
              submissionPromptOverride: compiledPrompt.submissionPrompt,
            }
          : undefined;

        if (isInpaintSubmitSelected) {
          if (!onRegenerateWithReferenceInputs) {
            showStatusToast("Inpaint generate is unavailable in this session.");
            return;
          }
          if (!hasSelectedLayerMask) {
            showStatusToast("Mask selection is required for inpaint.");
            return;
          }
          const flattenedDimensions = await resolveBlobDimensions(flattenedBlob);
          const inpaintMaskBlob = await exportSelectedLayerMaskBlob({
            targetWidth: flattenedDimensions.width,
            targetHeight: flattenedDimensions.height,
            mimeType: "image/png",
          });
          if (!inpaintMaskBlob) {
            showStatusToast("Mask selection is required for inpaint.");
            return;
          }
          inpaintMaskUrl = URL.createObjectURL(inpaintMaskBlob);
          await onRegenerateWithReferenceInputs(referenceInputs, {
            inpaintOverride: {
              modelId: INPAINT_FLUX_FILL_MODEL_ID,
              baseImageInput: flattenedUrl,
              maskInput: inpaintMaskUrl,
              outputFormat: "png",
            },
            referenceInputsMode: "replace",
            ...promptOverrideOptions,
          });
          return;
        }

        if (!onRegenerateWithReferenceInputs) {
          onRegenerate();
          return;
        }
        await onRegenerateWithReferenceInputs(referenceInputs, {
          ...promptOverrideOptions,
          modelIdOverride:
            isMarkupSubmitSelected && isMarkupModelLockEnabled()
              ? MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID
              : undefined,
          referenceInputsMode: "replace",
        });
      } catch (error) {
        if (flattenedUrl) {
          revokeObjectUrlSafe(flattenedUrl);
          flattenedUrl = null;
        }
        if (inpaintMaskUrl) {
          revokeObjectUrlSafe(inpaintMaskUrl);
          inpaintMaskUrl = null;
        }
        if (flattenedMarkupReferenceUrl) {
          revokeObjectUrlSafe(flattenedMarkupReferenceUrl);
          flattenedMarkupReferenceUrl = null;
        }
        showStatusToast(resolveFlattenFailureToastMessage(error));
      } finally {
        if (flattenedUrl) {
          if (onRegenerateWithReferenceInputs) {
            scheduleTransientObjectUrlRevoke(flattenedUrl);
          } else {
            revokeObjectUrlSafe(flattenedUrl);
          }
        }
        if (inpaintMaskUrl) {
          if (onRegenerateWithReferenceInputs) {
            scheduleTransientObjectUrlRevoke(inpaintMaskUrl);
          } else {
            revokeObjectUrlSafe(inpaintMaskUrl);
          }
        }
        if (flattenedMarkupReferenceUrl) {
          if (onRegenerateWithReferenceInputs) {
            scheduleTransientObjectUrlRevoke(flattenedMarkupReferenceUrl);
          } else {
            revokeObjectUrlSafe(flattenedMarkupReferenceUrl);
          }
        }
      }
    };
    void run();
  }, [
    extraImageUrls,
    exportSelectedLayerMaskBlob,
    hasSelectedLayerMask,
    editSubmitIntent,
    layers,
    markupStrokes,
    onRegenerate,
    onRegenerateWithReferenceInputs,
    promptText,
    populatedLayerCount,
    revokeObjectUrlSafe,
    scheduleTransientObjectUrlRevoke,
    resolveBlobDimensions,
    showStatusToast,
    onInvalidPromptReferenceToken,
    resolveStageFlattenSnapshot,
  ]);

  return {
    handleInlineGenerate,
  };
};
