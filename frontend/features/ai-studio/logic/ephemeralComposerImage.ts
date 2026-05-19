/**
 * Ephemeral Create composer image helpers.
 * Converts local dropped images into temporary data URLs for chip preview and GPT vision input.
 */
import type { AgentAttachment } from "../../../prefabs/agent";
import {
  AGENT_EPHEMERAL_IMAGE_MAX_BYTES,
  isAgentImageDataUrl,
  isSafeAgentImageMediaUrl,
  measureAgentMediaStringBytes,
} from "../../../prefabs/agent/mediaUrlPolicy";

const EPHEMERAL_PREVIEW_MAX_WIDTH_PX = 184;
const EPHEMERAL_PREVIEW_MAX_HEIGHT_PX = 230;
const EPHEMERAL_MODEL_MAX_DIMENSION_PX = 768;
const EPHEMERAL_PREVIEW_QUALITY = 0.72;
const EPHEMERAL_MODEL_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52] as const;
const EPHEMERAL_MODEL_DIMENSION_STEPS = [768, 640, 512] as const;

export const EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE =
  "That image is too large to attach here. Try a smaller image or screenshot.";
export const EPHEMERAL_IMAGE_UNREADABLE_MESSAGE =
  "Could not read that image. Try dragging it again or use a different image.";

type ResizeOptions = {
  maxWidth: number;
  maxHeight: number;
  quality: number;
};

type EphemeralImageData = {
  previewDataUrl: string;
  modelDataUrl: string;
  width: number;
  height: number;
};

const canUseCanvasImagePipeline = (): boolean =>
  typeof document !== "undefined" &&
  typeof Image !== "undefined" &&
  typeof FileReader !== "undefined";

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(EPHEMERAL_IMAGE_UNREADABLE_MESSAGE));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error(EPHEMERAL_IMAGE_UNREADABLE_MESSAGE));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(EPHEMERAL_IMAGE_UNREADABLE_MESSAGE));
    image.src = src;
  });

const resizeImageDataUrl = async (
  sourceDataUrl: string,
  options: ResizeOptions
): Promise<{ dataUrl: string; width: number; height: number }> => {
  const image = await loadImageElement(sourceDataUrl);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || options.maxWidth);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || options.maxHeight);
  const scale = Math.min(1, options.maxWidth / sourceWidth, options.maxHeight / sourceHeight);
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(EPHEMERAL_IMAGE_UNREADABLE_MESSAGE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", options.quality),
    width: targetWidth,
    height: targetHeight,
  };
};

const createModelDataUrl = async (
  sourceDataUrl: string
): Promise<{ dataUrl: string; width: number; height: number }> => {
  for (const maxDimension of EPHEMERAL_MODEL_DIMENSION_STEPS) {
    for (const quality of EPHEMERAL_MODEL_QUALITY_STEPS) {
      const resized = await resizeImageDataUrl(sourceDataUrl, {
        maxWidth: Math.min(maxDimension, EPHEMERAL_MODEL_MAX_DIMENSION_PX),
        maxHeight: Math.min(maxDimension, EPHEMERAL_MODEL_MAX_DIMENSION_PX),
        quality,
      });
      if (
        isAgentImageDataUrl(resized.dataUrl) &&
        measureAgentMediaStringBytes(resized.dataUrl) <= AGENT_EPHEMERAL_IMAGE_MAX_BYTES
      ) {
        return resized;
      }
    }
  }
  throw new Error(EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE);
};

export const createEphemeralComposerImageData = async (blob: Blob): Promise<EphemeralImageData> => {
  if (!(blob instanceof Blob) || blob.size <= 0 || !blob.type.startsWith("image/")) {
    throw new Error(EPHEMERAL_IMAGE_UNREADABLE_MESSAGE);
  }
  const sourceDataUrl = await readBlobAsDataUrl(blob);
  if (!canUseCanvasImagePipeline()) {
    if (!isAgentImageDataUrl(sourceDataUrl)) {
      throw new Error(EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE);
    }
    return {
      previewDataUrl: sourceDataUrl,
      modelDataUrl: sourceDataUrl,
      width: 1,
      height: 1,
    };
  }
  const [preview, model] = await Promise.all([
    resizeImageDataUrl(sourceDataUrl, {
      maxWidth: EPHEMERAL_PREVIEW_MAX_WIDTH_PX,
      maxHeight: EPHEMERAL_PREVIEW_MAX_HEIGHT_PX,
      quality: EPHEMERAL_PREVIEW_QUALITY,
    }),
    createModelDataUrl(sourceDataUrl),
  ]);
  return {
    previewDataUrl: preview.dataUrl,
    modelDataUrl: model.dataUrl,
    width: model.width,
    height: model.height,
  };
};

export const isEphemeralLocalImageAttachment = (
  attachment: Pick<AgentAttachment, "kind" | "source">
): attachment is AgentAttachment & { kind: "image"; source: "ephemeral_local" } =>
  attachment.kind === "image" && attachment.source === "ephemeral_local";

export const stripEphemeralLocalImagePayload = (attachment: AgentAttachment): AgentAttachment => {
  if (!isEphemeralLocalImageAttachment(attachment)) return attachment;
  return {
    id: attachment.id,
    kind: "image",
    source: "ephemeral_local",
    text: attachment.text ?? null,
    aspect: attachment.aspect ?? null,
  };
};

export const stripEphemeralLocalImageModelPayload = (
  attachment: AgentAttachment
): AgentAttachment => {
  if (!isEphemeralLocalImageAttachment(attachment)) return attachment;
  return {
    ...attachment,
    modelDataUrl: null,
    submissionImageUrl: null,
    imageFallbackUrls: [],
  };
};

export const resolveEphemeralLocalImageModelUrl = (attachment: AgentAttachment): string | null => {
  if (!isEphemeralLocalImageAttachment(attachment)) return null;
  return isSafeAgentImageMediaUrl(attachment.modelDataUrl) ? attachment.modelDataUrl : null;
};
