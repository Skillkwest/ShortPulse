export type InpaintLayerSource = {
  id: string;
  imageUrl: string | null;
};

export type InpaintMaskLayerSnapshot = {
  layerId: string;
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
};

export type InpaintMaskSnapshot = {
  layers: InpaintMaskLayerSnapshot[];
};

export type ExportMaskBlobParams = {
  targetWidth: number;
  targetHeight: number;
  mimeType?: "image/png" | "image/jpeg";
  camera?: import("../../logic/expertEditStageFlatten").StageFlattenCameraTransformInput | null;
};
