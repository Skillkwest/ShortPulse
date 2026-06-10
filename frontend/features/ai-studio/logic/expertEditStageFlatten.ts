/**
 * Stage-faithful flatten helpers for Expert Edit.
 * Produces camera-framed PNG blobs that match primary-stage semantics.
 */
import { refreshSupabaseSignedUrlIfNeeded } from "../utils/imageUpload";
import { clampExpertEditCameraScale } from "./expertEditCameraContract";
import { resolveClippedLayerTransform } from "../components/edit/expertEditLayerTransformUtils";
import { withDeadline } from "./withDeadline";

export type ExpertEditStageFlattenLayer = {
  imageUrl: string | null;
  opacity?: number;
  transform?: {
    translateXRatio?: number;
    translateYRatio?: number;
    scale?: number;
    rotationDeg?: number;
  };
};

type DecodedStageLayer = {
  image: HTMLImageElement;
  opacity: number;
  transform: {
    translateXRatio: number;
    translateYRatio: number;
    scale: number;
    rotationDeg: number;
  };
};

export type StageFlattenImageDimensions = {
  width: number;
  height: number;
};

export type StageFlattenOutputDimensions = {
  width: number;
  height: number;
};

export type StageFlattenCameraTransformInput = {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

export type StageFlattenResolvedCameraTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type StageFlattenDrawInstruction = {
  drawWidth: number;
  drawHeight: number;
  translateX: number;
  translateY: number;
  opacity: number;
  scale: number;
  rotationDeg: number;
};

const DEFAULT_STAGE_FLATTEN_MIME_TYPE = "image/png";
export const STAGE_FLATTEN_MAX_OUTPUT_SIZE_PX = 4096;
export const STAGE_FLATTEN_IMAGE_LOAD_TIMEOUT_MS = 15_000;
export const STAGE_FLATTEN_CANVAS_EXPORT_TIMEOUT_MS = 8_000;

const isCrossOriginCandidate = (url: string) =>
  url.startsWith("http://") || url.startsWith("https://");

const clampOpacity = (value: number) => Math.min(1, Math.max(0, value));
const clampCameraScale = (value: number) => clampExpertEditCameraScale(value);
const resolveMaxOutputSizePx = (value?: number | null) => {
  const normalizedValue = Number.isFinite(value)
    ? (value as number)
    : STAGE_FLATTEN_MAX_OUTPUT_SIZE_PX;
  return Math.min(STAGE_FLATTEN_MAX_OUTPUT_SIZE_PX, Math.max(1, Math.round(normalizedValue)));
};
const clampOutputSize = (value: number, maxOutputSizePx?: number | null) =>
  Math.min(resolveMaxOutputSizePx(maxOutputSizePx), Math.max(1, Math.round(value)));
const toRadians = (value: number) => (value * Math.PI) / 180;
const resolveAspectRatio = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;

const loadImage = (url: string): Promise<HTMLImageElement> => {
  let image: HTMLImageElement | null = null;
  return withDeadline({
    timeoutMs: STAGE_FLATTEN_IMAGE_LOAD_TIMEOUT_MS,
    timeoutMessage: "Timed out loading a layer image for stage flatten.",
    run: async () =>
      await new Promise<HTMLImageElement>((resolve, reject) => {
        image = new Image();
        if (isCrossOriginCandidate(url)) {
          image.crossOrigin = "anonymous";
        }
        image.onload = () => resolve(image as HTMLImageElement);
        image.onerror = () => reject(new Error(`Failed to load layer image: ${url}`));
        image.src = url;
      }),
  }).finally(() => {
    if (!image) return;
    image.onload = null;
    image.onerror = null;
  });
};

const loadImageWithSignedUrlRefresh = async (url: string): Promise<HTMLImageElement> => {
  try {
    return await loadImage(url);
  } catch (initialError) {
    if (!isCrossOriginCandidate(url)) {
      throw initialError;
    }
    const refreshedUrl = await refreshSupabaseSignedUrlIfNeeded(url).catch(() => null);
    if (!refreshedUrl || refreshedUrl === url) {
      throw initialError;
    }
    return loadImage(refreshedUrl);
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> =>
  withDeadline({
    timeoutMs: STAGE_FLATTEN_CANVAS_EXPORT_TIMEOUT_MS,
    timeoutMessage: "Timed out exporting the flattened stage image.",
    run: async () =>
      await new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Canvas export failed."));
              return;
            }
            resolve(blob);
          }, mimeType);
        } catch (error) {
          reject(
            error instanceof Error ? error : new Error("Canvas export failed during stage flatten.")
          );
        }
      }),
  });

/**
 * Resolves a longest-edge output size from visible source layers.
 */
export const resolveStageFlattenOutputSizePx = (
  images: StageFlattenImageDimensions[],
  maxOutputSizePx?: number | null
): number => {
  const longestEdge = images.reduce((maxEdge, image) => {
    const nextLongest = Math.max(
      Number.isFinite(image.width) ? image.width : 0,
      Number.isFinite(image.height) ? image.height : 0
    );
    return Math.max(maxEdge, nextLongest);
  }, 0);
  return clampOutputSize(longestEdge, maxOutputSizePx);
};

/**
 * Resolves output dimensions from source bounds and an optional aspect ratio.
 */
export const resolveStageFlattenOutputDimensions = ({
  images,
  outputAspectRatio,
  maxOutputSizePx,
}: {
  images: StageFlattenImageDimensions[];
  outputAspectRatio?: number;
  maxOutputSizePx?: number | null;
}): StageFlattenOutputDimensions => {
  const longestEdge = resolveStageFlattenOutputSizePx(images, maxOutputSizePx);
  const aspectRatio = resolveAspectRatio(outputAspectRatio);
  if (aspectRatio >= 1) {
    return {
      width: longestEdge,
      height: clampOutputSize(longestEdge / aspectRatio, maxOutputSizePx),
    };
  }
  return {
    width: clampOutputSize(longestEdge * aspectRatio, maxOutputSizePx),
    height: longestEdge,
  };
};

/**
 * Resolves contain-fit draw size for a source image inside a stage.
 */
export const resolveContainSizeForStage = (
  sourceWidth: number,
  sourceHeight: number,
  stageWidth: number,
  stageHeight: number
) => {
  const safeStageWidth = clampOutputSize(stageWidth);
  const safeStageHeight = clampOutputSize(stageHeight);
  const safeWidth = Math.max(1, Math.round(sourceWidth));
  const safeHeight = Math.max(1, Math.round(sourceHeight));
  const containScale = Math.min(safeStageWidth / safeWidth, safeStageHeight / safeHeight);
  return {
    drawWidth: safeWidth * containScale,
    drawHeight: safeHeight * containScale,
  };
};

/**
 * Backward-compatible square-stage contain helper.
 */
export const resolveContainSizeForSquareStage = (
  sourceWidth: number,
  sourceHeight: number,
  stageSize: number
) => resolveContainSizeForStage(sourceWidth, sourceHeight, stageSize, stageSize);

/**
 * Converts viewport camera values into output-canvas coordinates.
 */
export const resolveStageFlattenCameraTransform = ({
  camera,
  outputWidth,
  outputHeight,
}: {
  camera?: StageFlattenCameraTransformInput | null;
  outputWidth: number;
  outputHeight: number;
}): StageFlattenResolvedCameraTransform => {
  const outputWidthSafe = Math.max(1, outputWidth);
  const outputHeightSafe = Math.max(1, outputHeight);
  const viewportWidth =
    Number.isFinite(camera?.viewportWidth) && (camera?.viewportWidth as number) > 0
      ? (camera?.viewportWidth as number)
      : outputWidthSafe;
  const viewportHeight =
    Number.isFinite(camera?.viewportHeight) && (camera?.viewportHeight as number) > 0
      ? (camera?.viewportHeight as number)
      : outputHeightSafe;
  const normalizedOffsetX =
    Number.isFinite(camera?.offsetX) && viewportWidth > 0
      ? (camera?.offsetX as number) / viewportWidth
      : 0;
  const normalizedOffsetY =
    Number.isFinite(camera?.offsetY) && viewportHeight > 0
      ? (camera?.offsetY as number) / viewportHeight
      : 0;

  return {
    scale: clampCameraScale(Number.isFinite(camera?.scale) ? (camera?.scale as number) : 1),
    offsetX: normalizedOffsetX * outputWidthSafe,
    offsetY: normalizedOffsetY * outputHeightSafe,
  };
};

/**
 * Builds draw instructions for already-decoded draw-order layers.
 */
export const buildStageFlattenDrawPlan = ({
  decodedLayers,
  outputWidth,
  outputHeight,
}: {
  decodedLayers: Array<{
    width: number;
    height: number;
    opacity: number;
    transform: {
      translateXRatio: number;
      translateYRatio: number;
      scale: number;
      rotationDeg: number;
    };
  }>;
  outputWidth: number;
  outputHeight: number;
}): StageFlattenDrawInstruction[] =>
  decodedLayers.map((layer) => {
    const constrainedTransform = resolveClippedLayerTransform({
      transform: layer.transform,
    });
    const containSize = resolveContainSizeForStage(
      layer.width,
      layer.height,
      outputWidth,
      outputHeight
    );
    return {
      drawWidth: containSize.drawWidth,
      drawHeight: containSize.drawHeight,
      translateX: constrainedTransform.translateXRatio * outputWidth,
      translateY: constrainedTransform.translateYRatio * outputHeight,
      opacity: clampOpacity(layer.opacity),
      scale: constrainedTransform.scale,
      rotationDeg: constrainedTransform.rotationDeg,
    };
  });

/**
 * Flattens visible layers in primary-stage framing semantics.
 */
export const composePrimaryStageLayersToBlob = async (
  layers: ExpertEditStageFlattenLayer[],
  options?: {
    mimeType?: string;
    outputAspectRatio?: number;
    camera?: StageFlattenCameraTransformInput | null;
    maxOutputSizePx?: number | null;
  }
): Promise<Blob> => {
  const populatedLayers = layers.filter(
    (layer): layer is ExpertEditStageFlattenLayer & { imageUrl: string } =>
      typeof layer.imageUrl === "string" && layer.imageUrl.trim().length > 0
  );
  if (!populatedLayers.length) {
    throw new Error("No populated layers to flatten.");
  }

  // Draw bottom-most first and top-most last so stage z-order is preserved.
  const drawOrder = [...populatedLayers].reverse();
  const decodedLayers: DecodedStageLayer[] = await Promise.all(
    drawOrder.map(async (layer) => {
      const image = await loadImageWithSignedUrlRefresh(layer.imageUrl);
      return {
        image,
        opacity: clampOpacity(layer.opacity ?? 1),
        transform: {
          translateXRatio: Number.isFinite(layer.transform?.translateXRatio)
            ? (layer.transform?.translateXRatio as number)
            : 0,
          translateYRatio: Number.isFinite(layer.transform?.translateYRatio)
            ? (layer.transform?.translateYRatio as number)
            : 0,
          scale: Number.isFinite(layer.transform?.scale) ? (layer.transform?.scale as number) : 1,
          rotationDeg: Number.isFinite(layer.transform?.rotationDeg)
            ? (layer.transform?.rotationDeg as number)
            : 0,
        },
      };
    })
  );

  const outputDimensions = resolveStageFlattenOutputDimensions({
    images: decodedLayers.map(({ image }) => ({
      width: Math.max(1, image.naturalWidth || image.width || 1),
      height: Math.max(1, image.naturalHeight || image.height || 1),
    })),
    outputAspectRatio: options?.outputAspectRatio,
    maxOutputSizePx: options?.maxOutputSizePx,
  });
  const outputWidth = outputDimensions.width;
  const outputHeight = outputDimensions.height;
  const cameraTransform = resolveStageFlattenCameraTransform({
    camera: options?.camera,
    outputWidth,
    outputHeight,
  });

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable for stage flatten.");
  }

  context.clearRect(0, 0, outputWidth, outputHeight);

  const drawInstructions = buildStageFlattenDrawPlan({
    decodedLayers: decodedLayers.map(({ image, opacity, transform }) => ({
      width: Math.max(1, image.naturalWidth || image.width || 1),
      height: Math.max(1, image.naturalHeight || image.height || 1),
      opacity,
      transform,
    })),
    outputWidth,
    outputHeight,
  });

  decodedLayers.forEach(({ image }, index) => {
    const instruction = drawInstructions[index];
    if (!instruction) return;
    context.save();
    context.globalAlpha = instruction.opacity;
    context.translate(
      outputWidth / 2 + cameraTransform.offsetX,
      outputHeight / 2 + cameraTransform.offsetY
    );
    if (cameraTransform.scale !== 1) {
      context.scale(cameraTransform.scale, cameraTransform.scale);
    }
    context.translate(instruction.translateX, instruction.translateY);
    if (instruction.rotationDeg !== 0) {
      context.rotate(toRadians(instruction.rotationDeg));
    }
    if (instruction.scale !== 1) {
      context.scale(instruction.scale, instruction.scale);
    }
    context.drawImage(
      image,
      -instruction.drawWidth / 2,
      -instruction.drawHeight / 2,
      instruction.drawWidth,
      instruction.drawHeight
    );
    context.restore();
  });
  context.globalAlpha = 1;

  return canvasToBlob(canvas, options?.mimeType ?? DEFAULT_STAGE_FLATTEN_MIME_TYPE);
};
