/**
 * Stage-faithful flatten helpers for Expert Edit manual flatten action.
 * Produces a square PNG that matches primary-stage framing semantics.
 */
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
const STAGE_FLATTEN_MIN_SCALE = 0.2;
const STAGE_FLATTEN_MAX_SCALE = 2;

const isCrossOriginCandidate = (url: string) =>
  url.startsWith("http://") || url.startsWith("https://");

const clampOpacity = (value: number) => Math.min(1, Math.max(0, value));
const clampScale = (value: number) =>
  Math.min(STAGE_FLATTEN_MAX_SCALE, Math.max(STAGE_FLATTEN_MIN_SCALE, value));
const clampOutputSize = (value: number) =>
  Math.min(STAGE_FLATTEN_MAX_OUTPUT_SIZE_PX, Math.max(1, Math.round(value)));
const toRadians = (value: number) => (value * Math.PI) / 180;

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (isCrossOriginCandidate(url)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load layer image: ${url}`));
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
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
  });

/**
 * Resolves a square output size using the longest source edge across visible layers.
 */
export const resolveStageFlattenOutputSizePx = (images: StageFlattenImageDimensions[]): number => {
  const longestEdge = images.reduce((maxEdge, image) => {
    const nextLongest = Math.max(
      Number.isFinite(image.width) ? image.width : 0,
      Number.isFinite(image.height) ? image.height : 0
    );
    return Math.max(maxEdge, nextLongest);
  }, 0);
  return clampOutputSize(longestEdge);
};

/**
 * Resolves contain-fit draw size for a source image inside a square stage.
 */
export const resolveContainSizeForSquareStage = (
  sourceWidth: number,
  sourceHeight: number,
  stageSize: number
) => {
  const safeStageSize = clampOutputSize(stageSize);
  const safeWidth = Math.max(1, Math.round(sourceWidth));
  const safeHeight = Math.max(1, Math.round(sourceHeight));
  const containScale = Math.min(safeStageSize / safeWidth, safeStageSize / safeHeight);
  return {
    drawWidth: safeWidth * containScale,
    drawHeight: safeHeight * containScale,
  };
};

/**
 * Builds draw instructions for already-decoded draw-order layers.
 */
export const buildStageFlattenDrawPlan = ({
  decodedLayers,
  outputSizePx,
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
  outputSizePx: number;
}): StageFlattenDrawInstruction[] =>
  decodedLayers.map((layer) => {
    const containSize = resolveContainSizeForSquareStage(layer.width, layer.height, outputSizePx);
    return {
      drawWidth: containSize.drawWidth,
      drawHeight: containSize.drawHeight,
      translateX: layer.transform.translateXRatio * outputSizePx,
      translateY: layer.transform.translateYRatio * outputSizePx,
      opacity: clampOpacity(layer.opacity),
      scale: clampScale(layer.transform.scale),
      rotationDeg: Number.isFinite(layer.transform.rotationDeg) ? layer.transform.rotationDeg : 0,
    };
  });

/**
 * Flattens visible layers exactly in primary-stage 1:1 framing semantics.
 */
export const composePrimaryStageLayersToBlob = async (
  layers: ExpertEditStageFlattenLayer[],
  options?: { mimeType?: string }
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
      const image = await loadImage(layer.imageUrl);
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
          scale: clampScale(
            Number.isFinite(layer.transform?.scale) ? (layer.transform?.scale as number) : 1
          ),
          rotationDeg: Number.isFinite(layer.transform?.rotationDeg)
            ? (layer.transform?.rotationDeg as number)
            : 0,
        },
      };
    })
  );

  const outputSizePx = resolveStageFlattenOutputSizePx(
    decodedLayers.map(({ image }) => ({
      width: Math.max(1, image.naturalWidth || image.width || 1),
      height: Math.max(1, image.naturalHeight || image.height || 1),
    }))
  );

  const canvas = document.createElement("canvas");
  canvas.width = outputSizePx;
  canvas.height = outputSizePx;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable for stage flatten.");
  }

  context.clearRect(0, 0, outputSizePx, outputSizePx);

  const drawInstructions = buildStageFlattenDrawPlan({
    decodedLayers: decodedLayers.map(({ image, opacity, transform }) => ({
      width: Math.max(1, image.naturalWidth || image.width || 1),
      height: Math.max(1, image.naturalHeight || image.height || 1),
      opacity,
      transform,
    })),
    outputSizePx,
  });

  decodedLayers.forEach(({ image }, index) => {
    const instruction = drawInstructions[index];
    if (!instruction) return;
    context.save();
    context.globalAlpha = instruction.opacity;
    context.translate(
      outputSizePx / 2 + instruction.translateX,
      outputSizePx / 2 + instruction.translateY
    );
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
