import React from "react";
import {
  composePrimaryLayersToBlob,
  type ExpertEditCompositingLayer,
} from "../../logic/expertEditLayerCompose";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  type InpaintSubmissionOverride,
} from "../../logic/inpaintSubmission";

type RegenerateWithReferenceInputsHandler = (
  referenceInputs: string[],
  options?: {
    inpaintOverride?: InpaintSubmissionOverride | null;
  }
) => void | Promise<void>;

type ExportSelectedLayerMaskBlob = (params: {
  targetWidth: number;
  targetHeight: number;
  mimeType?: "image/png" | "image/jpeg";
}) => Promise<Blob | null>;

type UseExpertEditInlineGenerateParams = {
  layers: ExpertEditCompositingLayer[];
  extraImageUrls: [string | null, string | null, string | null];
  populatedLayerCount: number;
  isInpaintToolSelected: boolean;
  hasSelectedLayerMask: boolean;
  exportSelectedLayerMaskBlob: ExportSelectedLayerMaskBlob;
  onRegenerate: () => void;
  onRegenerateWithReferenceInputs?: RegenerateWithReferenceInputsHandler;
  scheduleTransientObjectUrlRevoke: (url: string) => void;
  revokeObjectUrlSafe: (url: string) => void;
  resolveBlobDimensions: (blob: Blob) => Promise<{ width: number; height: number }>;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
};

const MAX_REFERENCE_INPUTS = 8;

export const useExpertEditInlineGenerate = ({
  layers,
  extraImageUrls,
  populatedLayerCount,
  isInpaintToolSelected,
  hasSelectedLayerMask,
  exportSelectedLayerMaskBlob,
  onRegenerate,
  onRegenerateWithReferenceInputs,
  scheduleTransientObjectUrlRevoke,
  revokeObjectUrlSafe,
  resolveBlobDimensions,
  showStatusToast,
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

      let flattenedUrl: string | null = null;
      let inpaintMaskUrl: string | null = null;
      try {
        const flattenedBlob = await composePrimaryLayersToBlob(layers, { mimeType: "image/png" });
        flattenedUrl = URL.createObjectURL(flattenedBlob);
        const referenceInputs = buildFlattenReferenceInputs(flattenedUrl);

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
          });
          return;
        }

        if (!onRegenerateWithReferenceInputs) {
          onRegenerate();
          return;
        }
        await onRegenerateWithReferenceInputs(referenceInputs);
      } catch {
        if (flattenedUrl) {
          revokeObjectUrlSafe(flattenedUrl);
          flattenedUrl = null;
        }
        if (inpaintMaskUrl) {
          revokeObjectUrlSafe(inpaintMaskUrl);
          inpaintMaskUrl = null;
        }
        showStatusToast("Unable to flatten layers.");
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
    exportSelectedLayerMaskBlob,
    hasSelectedLayerMask,
    isInpaintToolSelected,
    layers,
    onRegenerate,
    onRegenerateWithReferenceInputs,
    populatedLayerCount,
    revokeObjectUrlSafe,
    scheduleTransientObjectUrlRevoke,
    resolveBlobDimensions,
    showStatusToast,
  ]);

  return {
    handleInlineGenerate,
  };
};
