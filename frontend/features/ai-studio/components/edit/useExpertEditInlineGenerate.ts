import React from "react";
import type { ExpertEditStageFlattenLayer } from "../../logic/expertEditStageFlatten";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  isMarkupModelLockEnabled,
  type InpaintSubmissionOverride,
} from "../../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
import { exportExpertEditStageArtifacts } from "./expertEditStageExport";
import {
  prepareExpertEditSubmission,
  validateExpertEditSubmissionPrompt,
} from "./expertEditSubmissionPreparation";
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
  reusablePrimarySourceUrl?: string | null;
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
  reusablePrimarySourceUrl = "",
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
      const promptValidation = validateExpertEditSubmissionPrompt({
        promptText,
        extraImageUrls,
      });
      if (promptValidation.status === "invalid_tokens") {
        onInvalidPromptReferenceToken?.(promptValidation.message);
        return;
      }

      let flattenedUrl: string | null = null;
      let flattenedMarkupReferenceUrl: string | null = null;
      let inpaintMaskUrl: string | null = null;
      try {
        const isInpaintSubmitSelected = editSubmitIntent === "inpaint";
        const isMarkupSubmitSelected = editSubmitIntent === "markup";
        const exportArtifacts = await exportExpertEditStageArtifacts({
          layers,
          reusablePrimarySourceUrl,
          markupStrokes,
          editSubmitIntent,
          hasSelectedLayerMask,
          exportSelectedLayerMaskBlob,
          resolveBlobDimensions,
          resolveStageFlattenSnapshot,
        });
        const flattenedBlob = exportArtifacts.flattenedBlob;
        flattenedUrl = flattenedBlob ? URL.createObjectURL(flattenedBlob) : null;
        const primaryReferenceUrl = exportArtifacts.reusablePrimarySourceUrl || flattenedUrl;
        if (exportArtifacts.flattenedMarkupReferenceBlob) {
          flattenedMarkupReferenceUrl = URL.createObjectURL(
            exportArtifacts.flattenedMarkupReferenceBlob
          );
        }
        const preparedSubmission = prepareExpertEditSubmission({
          promptText,
          extraImageUrls,
          flattenedPrimaryUrl: primaryReferenceUrl,
          flattenedMarkupReferenceUrl,
        });
        if (preparedSubmission.status === "invalid_tokens") {
          onInvalidPromptReferenceToken?.(preparedSubmission.message);
          return;
        }
        const { promptOverrideOptions, referenceInputs } = preparedSubmission;

        if (isInpaintSubmitSelected) {
          if (!onRegenerateWithReferenceInputs) {
            showStatusToast("Inpaint generate is unavailable in this session.");
            return;
          }
          if (!hasSelectedLayerMask) {
            showStatusToast("Mask selection is required for inpaint.");
            return;
          }
          if (!flattenedBlob || !flattenedUrl) {
            showStatusToast("Unable to flatten layers.");
            return;
          }
          const inpaintMaskBlob = exportArtifacts.inpaintMaskBlob;
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
    reusablePrimarySourceUrl,
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
