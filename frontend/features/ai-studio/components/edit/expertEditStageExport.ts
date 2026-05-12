import {
  composePrimaryStageLayersToBlob,
  type ExpertEditStageFlattenLayer,
  type StageFlattenCameraTransformInput,
} from "../../logic/expertEditStageFlatten";
import { composeFlattenedMarkupReferenceBlob } from "../../logic/expertEditMarkupReference";
import { isMarkupStrokeSecondaryReferenceEnabled } from "../../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
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

export type ExpertEditStageExportParams = {
  layers: ExpertEditStageFlattenLayer[];
  reusablePrimarySourceUrl?: string | null;
  markupStrokes: MarkupStroke[];
  editSubmitIntent: EditSubmitIntent;
  hasSelectedLayerMask: boolean;
  exportSelectedLayerMaskBlob: ExportSelectedLayerMaskBlob;
  resolveBlobDimensions: (blob: Blob) => Promise<{ width: number; height: number }>;
  resolveStageFlattenSnapshot?: (() => StageFlattenSnapshot | undefined) | undefined;
};

export type ExpertEditStageExportArtifacts = {
  reusablePrimarySourceUrl: string | null;
  flattenedBlob: Blob | null;
  flattenedMarkupReferenceBlob: Blob | null;
  inpaintMaskBlob: Blob | null;
  flattenedDimensions: { width: number; height: number } | null;
};

export const exportExpertEditStageArtifacts = async ({
  layers,
  reusablePrimarySourceUrl = "",
  markupStrokes,
  editSubmitIntent,
  hasSelectedLayerMask,
  exportSelectedLayerMaskBlob,
  resolveBlobDimensions,
  resolveStageFlattenSnapshot,
}: ExpertEditStageExportParams): Promise<ExpertEditStageExportArtifacts> => {
  const isInpaintSubmitSelected = editSubmitIntent === "inpaint";
  const isMarkupSubmitSelected = editSubmitIntent === "markup";
  const reusablePrimarySourceUrlTrimmed = reusablePrimarySourceUrl?.trim() ?? "";
  const flattenSnapshot = resolveStageFlattenSnapshot?.();
  const shouldReusePrimarySourceUrl =
    !isInpaintSubmitSelected &&
    !isMarkupSubmitSelected &&
    reusablePrimarySourceUrlTrimmed.length > 0 &&
    (flattenSnapshot?.canReusePrimarySourceUrl ?? true);
  const flattenedBlob = shouldReusePrimarySourceUrl
    ? null
    : await composePrimaryStageLayersToBlob(layers, {
        mimeType: "image/png",
        outputAspectRatio: flattenSnapshot?.outputAspectRatio,
        camera: flattenSnapshot?.camera,
      });
  const flattenedDimensions = flattenedBlob ? await resolveBlobDimensions(flattenedBlob) : null;

  let flattenedMarkupReferenceBlob: Blob | null = null;
  if (
    isMarkupSubmitSelected &&
    markupStrokes.length > 0 &&
    isMarkupStrokeSecondaryReferenceEnabled() &&
    flattenedBlob
  ) {
    flattenedMarkupReferenceBlob = await composeFlattenedMarkupReferenceBlob({
      flattenedBlob,
      markupStrokes,
      resolveBlobDimensions,
    });
  }

  let inpaintMaskBlob: Blob | null = null;
  if (isInpaintSubmitSelected && hasSelectedLayerMask && flattenedDimensions) {
    inpaintMaskBlob = await exportSelectedLayerMaskBlob({
      targetWidth: flattenedDimensions.width,
      targetHeight: flattenedDimensions.height,
      mimeType: "image/png",
      camera: flattenSnapshot?.camera,
    });
  }

  return {
    reusablePrimarySourceUrl: shouldReusePrimarySourceUrl ? reusablePrimarySourceUrlTrimmed : null,
    flattenedBlob,
    flattenedMarkupReferenceBlob,
    inpaintMaskBlob,
    flattenedDimensions,
  };
};
