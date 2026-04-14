import React from "react";
import type { ExpertEditStageFlattenLayer } from "../../logic/expertEditStageFlatten";
import { type InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
import { exportExpertEditStageArtifacts } from "./expertEditStageExport";
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
      const allowSecondaryReferenceTokens = editSubmitIntent !== "inpaint";
      if (populatedLayerCount <= 0) {
        showStatusToast("Add at least one layer image before generating.");
        return;
      }
      const promptValidation = validateExpertEditSubmissionPrompt({
        promptText,
        extraImageUrls,
        allowSecondaryReferenceTokens,
      });
      if (promptValidation.status === "invalid_tokens") {
        onInvalidPromptReferenceToken?.(promptValidation.message);
        return;
      }

      const objectUrls = {
        flattenedUrl: null,
        flattenedMarkupReferenceUrl: null,
        inpaintMaskUrl: null,
      };
      try {
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
          allowSecondaryReferenceTokens,
        });
        if (preparedSubmission.status === "invalid_tokens") {
          onInvalidPromptReferenceToken?.(preparedSubmission.message);
          return;
        }
        const { promptOverrideOptions, referenceInputs } = preparedSubmission;
        const submitDispatch = resolveExpertEditSubmissionDispatch({
          editSubmitIntent,
          hasSubmissionHandler: Boolean(onRegenerateWithReferenceInputs),
          hasSelectedLayerMask,
          flattenedUrl: objectUrls.flattenedUrl,
          inpaintMaskUrl: objectUrls.inpaintMaskUrl,
          referenceInputs,
          promptOverrideOptions,
        });
        if (submitDispatch.status === "error") {
          showStatusToast(submitDispatch.message);
          return;
        }
        if (submitDispatch.status === "fallback_regenerate") {
          onRegenerate();
          return;
        }
        await onRegenerateWithReferenceInputs?.(
          submitDispatch.referenceInputs,
          submitDispatch.options
        );
      } catch (error) {
        revokeExpertEditSubmissionObjectUrls({
          objectUrls,
          revokeObjectUrlSafe,
        });
        showStatusToast(resolveFlattenFailureToastMessage(error));
      } finally {
        cleanupExpertEditSubmissionObjectUrls({
          objectUrls,
          hasSubmissionHandler: Boolean(onRegenerateWithReferenceInputs),
          revokeObjectUrlSafe,
          scheduleTransientObjectUrlRevoke,
        });
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
