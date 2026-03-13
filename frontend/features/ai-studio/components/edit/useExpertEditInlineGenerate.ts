import React from "react";
import {
  composePrimaryStageLayersToBlob,
  type ExpertEditStageFlattenLayer,
  type StageFlattenCameraTransformInput,
} from "../../logic/expertEditStageFlatten";
import {
  analyzeExpertEditPromptTokens,
  compileExpertEditSubmissionPrompt,
} from "../../logic/expertEditPromptReferences";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  type InpaintSubmissionOverride,
} from "../../logic/inpaintSubmission";

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
  camera?: StageFlattenCameraTransformInput | null;
}) => Promise<Blob | null>;

type StageFlattenSnapshot = {
  outputAspectRatio?: number;
  camera?: StageFlattenCameraTransformInput | null;
};

type UseExpertEditInlineGenerateParams = {
  layers: ExpertEditStageFlattenLayer[];
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
  populatedLayerCount: number;
  isInpaintToolSelected: boolean;
  isMarkupToolSelected: boolean;
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

const MAX_REFERENCE_INPUTS = 8;
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
  populatedLayerCount,
  isInpaintToolSelected,
  isMarkupToolSelected,
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
  const buildFlattenReferenceInputs = React.useCallback(
    (flattenedPrimaryUrl: string) => {
      const candidates = [
        flattenedPrimaryUrl,
        ...extraImageUrls.map((value) => value?.trim() ?? "").filter((value) => value.length > 0),
      ];
      const deduped = Array.from(new Set(candidates));
      return deduped.slice(0, MAX_REFERENCE_INPUTS);
    },
    [extraImageUrls]
  );

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
      let inpaintMaskUrl: string | null = null;
      try {
        const flattenSnapshot = resolveStageFlattenSnapshot?.();
        const flattenedBlob = await composePrimaryStageLayersToBlob(layers, {
          mimeType: "image/png",
          outputAspectRatio: flattenSnapshot?.outputAspectRatio,
          camera: flattenSnapshot?.camera,
        });
        flattenedUrl = URL.createObjectURL(flattenedBlob);
        const referenceInputs = buildFlattenReferenceInputs(flattenedUrl);
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

        if (isInpaintToolSelected) {
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
            camera: flattenSnapshot?.camera,
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
          modelIdOverride: isMarkupToolSelected ? MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID : undefined,
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
      }
    };
    void run();
  }, [
    buildFlattenReferenceInputs,
    extraImageUrls,
    exportSelectedLayerMaskBlob,
    hasSelectedLayerMask,
    isInpaintToolSelected,
    isMarkupToolSelected,
    layers,
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
