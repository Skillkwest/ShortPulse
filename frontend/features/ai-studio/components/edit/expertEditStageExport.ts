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

const TRANSFORM_IDENTITY_EPSILON = 0.0001;

const isNearlyEqual = (left: number, right: number) =>
  Math.abs(left - right) <= TRANSFORM_IDENTITY_EPSILON;

const isIdentityStageFlattenLayer = (layer: ExpertEditStageFlattenLayer): boolean => {
  const transform = layer.transform;
  const opacity =
    typeof layer.opacity === "number" && Number.isFinite(layer.opacity) ? layer.opacity : 1;
  if (!isNearlyEqual(opacity, 1)) return false;
  if (!transform) return true;
  return (
    isNearlyEqual(transform.translateXRatio ?? 0, 0) &&
    isNearlyEqual(transform.translateYRatio ?? 0, 0) &&
    isNearlyEqual(transform.scale ?? 1, 1) &&
    isNearlyEqual(transform.rotationDeg ?? 0, 0) &&
    !transform.flipX &&
    !transform.flipY
  );
};

const canReusePrimarySourceForStageExport = (
  layers: ExpertEditStageFlattenLayer[],
  flattenSnapshot: StageFlattenSnapshot | undefined
): boolean => {
  if (!(flattenSnapshot?.canReusePrimarySourceUrl ?? true)) return false;
  const populatedLayers = layers.filter(
    (layer) => typeof layer.imageUrl === "string" && layer.imageUrl.trim().length > 0
  );
  const primaryLayer = populatedLayers[0];
  return (
    populatedLayers.length === 1 &&
    Boolean(primaryLayer && isIdentityStageFlattenLayer(primaryLayer))
  );
};

export type ExpertEditStageExportParams = {
  layers: ExpertEditStageFlattenLayer[];
  reusablePrimarySourceUrl?: string | null;
  flattenTargetLongestEdgePx?: number | null;
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
  flattenTargetLongestEdgePx = null,
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
    canReusePrimarySourceForStageExport(layers, flattenSnapshot);
  const flattenedBlob = shouldReusePrimarySourceUrl
    ? null
    : await composePrimaryStageLayersToBlob(layers, {
        mimeType: "image/png",
        outputAspectRatio: flattenSnapshot?.outputAspectRatio,
        camera: flattenSnapshot?.camera,
        maxOutputSizePx:
          !isInpaintSubmitSelected && !isMarkupSubmitSelected ? flattenTargetLongestEdgePx : null,
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
