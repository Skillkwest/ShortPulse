/**
 * Style-source image derivation helpers.
 * Converts a normalized source image into preview and extraction artifacts.
 */
import { STYLE_EXTRACTION_MAX_DIMENSION_PX, STYLE_PREVIEW_OUTPUT_SIZE_PX } from "./constants";

const STYLE_IMAGE_OUTPUT_QUALITY = 0.9;

/**
 * Reads a blob as a data URL.
 */
export const readFileAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Unable to read image file."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });
};

const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = src;
  });
};

const createStyleImageCanvasContext = (
  width: number,
  height: number
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
};

const resolveImageNaturalDimensions = (
  image: HTMLImageElement
): { width: number; height: number } => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    throw new Error("Invalid image dimensions.");
  }
  return { width, height };
};

/**
 * Center-crops and scales an image data URL into a square card preview.
 */
export const cropImageDataUrlToSquareDataUrl = async (sourceDataUrl: string): Promise<string> => {
  const image = await loadImageElement(sourceDataUrl);
  const { width: sourceWidth, height: sourceHeight } = resolveImageNaturalDimensions(image);
  const cropSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, Math.floor((sourceWidth - cropSize) / 2));
  const sourceY = Math.max(0, Math.floor((sourceHeight - cropSize) / 2));
  const { canvas, context } = createStyleImageCanvasContext(
    STYLE_PREVIEW_OUTPUT_SIZE_PX,
    STYLE_PREVIEW_OUTPUT_SIZE_PX
  );
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    STYLE_PREVIEW_OUTPUT_SIZE_PX,
    STYLE_PREVIEW_OUTPUT_SIZE_PX
  );
  return canvas.toDataURL("image/jpeg", STYLE_IMAGE_OUTPUT_QUALITY);
};

/**
 * Resizes an image data URL for extraction analysis without cropping.
 * Caps the longest side and never upscales source dimensions.
 */
export const resizeImageDataUrlForExtraction = async (sourceDataUrl: string): Promise<string> => {
  const image = await loadImageElement(sourceDataUrl);
  const { width: sourceWidth, height: sourceHeight } = resolveImageNaturalDimensions(image);
  const sourceMaxDimension = Math.max(sourceWidth, sourceHeight);
  const scale =
    sourceMaxDimension > STYLE_EXTRACTION_MAX_DIMENSION_PX
      ? STYLE_EXTRACTION_MAX_DIMENSION_PX / sourceMaxDimension
      : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const { canvas, context } = createStyleImageCanvasContext(targetWidth, targetHeight);
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", STYLE_IMAGE_OUTPUT_QUALITY);
};

/**
 * Produces style-intake preview and extraction images from a source data URL.
 */
export const preprocessStyleImageDataUrl = async (sourceDataUrl: string) => {
  const [previewImageUrl, extractionSourceImageUrl] = await Promise.all([
    cropImageDataUrlToSquareDataUrl(sourceDataUrl),
    resizeImageDataUrlForExtraction(sourceDataUrl),
  ]);
  return {
    previewImageUrl,
    extractionSourceImageUrl,
  };
};
