/**
 * Builds AI Studio reference drag ghost previews and reads drag preview metadata.
 * This module owns drag-image DOM construction, not drag payload authority.
 */
import {
  buildCanvasPromptDragGhost,
  CANVAS_PROMPT_DRAG_HOTSPOT_X,
  CANVAS_PROMPT_DRAG_HOTSPOT_Y,
} from "../logic/canvasPromptDragGhost";
import type { StudioOutput } from "../types";
import {
  isLikelyImageTransferUrl,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
  resolveReferenceTransferUrl,
} from "./dragDropMediaResolution";

const DRAG_GHOST_SCALE = 0.68;
const DRAG_GHOST_MIN_SIZE_PX = 108;
export const DRAG_GHOST_MAX_SIZE_PX = 244;
const DRAG_GHOST_ASPECT_RATIO = 4 / 5;
const DRAG_GHOST_SNAPSHOT_WIDTH = 768;
const DRAG_GHOST_SNAPSHOT_HEIGHT = 960;
const DRAG_GHOST_SNAPSHOT_QUALITY = 0.82;
const DRAG_GHOST_SOURCE_PIXEL_LIMIT = 4_000_000;

export type ReferenceDragPreviewKind = "image" | "video" | "audio" | "text";

export type ReferenceDragPreviewDataset = {
  previewUrl: string | null;
  playableUrl: string | null;
  imageSrc: string | null;
  snapshotSrc: string | null;
  previewKind: ReferenceDragPreviewKind | null;
};

const clampDragGhostSize = (value: number): number =>
  Math.max(DRAG_GHOST_MIN_SIZE_PX, Math.min(DRAG_GHOST_MAX_SIZE_PX, value));

const trimDragGhostText = (value: string | null, maxLength = 160): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed;
};

export const safeSetDragImage = (
  transfer: DataTransfer,
  element: HTMLElement,
  x: number,
  y: number
): void => {
  try {
    transfer.setDragImage(element, x, y);
  } catch {
    // Some browsers ignore custom drag images for specific node types; preserve drag payload semantics.
  }
};

export const resolveOutputPreviewKind = (output: StudioOutput): ReferenceDragPreviewKind => {
  if (output.mode === "image") return "image";
  if (output.mode === "video") return "video";
  if (output.mode === "audio") return "audio";
  return "text";
};

const resolveDragGhostDimensions = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): { ghostWidth: number; ghostHeight: number } => {
  const scaledHeight =
    height > 0
      ? height * DRAG_GHOST_SCALE
      : width > 0
        ? (width / DRAG_GHOST_ASPECT_RATIO) * DRAG_GHOST_SCALE
        : DRAG_GHOST_MAX_SIZE_PX;
  const ghostHeight = clampDragGhostSize(scaledHeight);
  const ghostWidth = Math.round(ghostHeight * DRAG_GHOST_ASPECT_RATIO);
  return { ghostWidth, ghostHeight };
};

const createDragGhostSnapshotSrc = (imageNode: HTMLImageElement | null): string | null => {
  if (!imageNode) return null;
  if (!imageNode.complete || imageNode.naturalWidth <= 0 || imageNode.naturalHeight <= 0) {
    return null;
  }
  if (imageNode.naturalWidth * imageNode.naturalHeight > DRAG_GHOST_SOURCE_PIXEL_LIMIT) {
    return null;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = DRAG_GHOST_SNAPSHOT_WIDTH;
    canvas.height = DRAG_GHOST_SNAPSHOT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const sourceWidth = imageNode.naturalWidth;
    const sourceHeight = imageNode.naturalHeight;
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = DRAG_GHOST_SNAPSHOT_WIDTH / DRAG_GHOST_SNAPSHOT_HEIGHT;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceAspect > targetAspect) {
      sw = Math.max(1, Math.round(sourceHeight * targetAspect));
      sx = Math.round((sourceWidth - sw) / 2);
    } else if (sourceAspect < targetAspect) {
      sh = Math.max(1, Math.round(sourceWidth / targetAspect));
      sy = Math.round((sourceHeight - sh) / 2);
    }

    context.drawImage(
      imageNode,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      DRAG_GHOST_SNAPSHOT_WIDTH,
      DRAG_GHOST_SNAPSHOT_HEIGHT
    );
    return canvas.toDataURL("image/jpeg", DRAG_GHOST_SNAPSHOT_QUALITY);
  } catch {
    return null;
  }
};

export const readReferenceDragPreviewDataset = (
  node?: HTMLElement | null
): ReferenceDragPreviewDataset => {
  const previewKindRaw = node?.dataset.dragPreviewKind?.trim().toLowerCase() ?? "";
  const previewKind: ReferenceDragPreviewKind | null =
    previewKindRaw === "image" ||
    previewKindRaw === "video" ||
    previewKindRaw === "audio" ||
    previewKindRaw === "text"
      ? previewKindRaw
      : null;
  const renderedImageNode = node?.querySelector("img.reference-card-image");
  const renderedImageElement =
    renderedImageNode instanceof HTMLImageElement ? renderedImageNode : null;
  const renderedImageSrc = renderedImageElement
    ? renderedImageElement.currentSrc ||
      renderedImageElement.getAttribute("src") ||
      renderedImageElement.dataset.src ||
      null
    : null;
  return {
    previewUrl: normalizeReferenceTransferUrlCandidate(node?.dataset.dragPreviewUrl ?? null),
    playableUrl: normalizeReferenceTransferUrlCandidate(node?.dataset.dragPlayableUrl ?? null, {
      unwrapNextImage: false,
    }),
    imageSrc: normalizeReferenceTransferUrlCandidate(
      renderedImageSrc ?? node?.dataset.dragImageSrc ?? null,
      { unwrapNextImage: false }
    ),
    snapshotSrc: createDragGhostSnapshotSrc(renderedImageElement),
    previewKind,
  };
};

const resolveGhostImageUrl = ({
  output,
  previewDataset,
}: {
  output: StudioOutput;
  previewDataset: ReferenceDragPreviewDataset;
}): string | null => {
  const candidates = [
    previewDataset.snapshotSrc,
    previewDataset.imageSrc,
    previewDataset.previewUrl,
    output.mode === "audio" ? (output.companionArtUrl ?? null) : null,
    resolveReferenceTransferUrl(output, "image"),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeReferenceTransferUrlCandidate(candidate, {
      unwrapNextImage: false,
    });
    if (!normalized) continue;
    if (isLikelyImageTransferUrl(normalized)) return normalized;
  }
  return null;
};

export const buildReferenceDragGhost = ({
  output,
  previewDataset,
  width,
  height,
  promptText,
}: {
  output: StudioOutput;
  previewDataset: ReferenceDragPreviewDataset;
  width: number;
  height: number;
  promptText: string | null;
}): HTMLElement => {
  const { ghostWidth, ghostHeight } = resolveDragGhostDimensions({ width, height });
  const ghost = document.createElement("div");
  ghost.className = "reference-drag-ghost";
  ghost.style.width = `${ghostWidth}px`;
  ghost.style.height = `${ghostHeight}px`;
  ghost.style.aspectRatio = "4 / 5";
  ghost.style.boxSizing = "border-box";
  ghost.style.position = "absolute";
  ghost.style.top = "-9999px";
  ghost.style.left = "-9999px";
  ghost.style.overflow = "hidden";
  ghost.style.borderRadius = "6px";
  ghost.style.border = "none";
  ghost.style.background = "rgba(13, 18, 28, 0.92)";
  ghost.style.pointerEvents = "none";
  ghost.style.display = "flex";
  ghost.style.flexDirection = "column";
  ghost.style.justifyContent = "space-between";
  ghost.style.boxShadow = "0 12px 30px rgba(0,0,0,0.45)";

  const imageUrl = resolveGhostImageUrl({
    output,
    previewDataset,
  });
  const datasetPlayableUrl = normalizeReferenceTransferUrlCandidate(previewDataset.playableUrl, {
    unwrapNextImage: false,
  });
  const videoUrl =
    datasetPlayableUrl && looksLikeVideoUrl(datasetPlayableUrl)
      ? datasetPlayableUrl
      : resolveReferenceTransferUrl(output, "video");
  const previewKind = previewDataset.previewKind ?? resolveOutputPreviewKind(output);
  const trimmedPromptText = trimDragGhostText(promptText);
  const isMediaGhost = Boolean(imageUrl || videoUrl);

  if (previewKind === "text" && !isMediaGhost && trimmedPromptText) {
    return buildCanvasPromptDragGhost({
      detail: trimmedPromptText,
      className: "reference-drag-ghost",
    });
  }

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.display = "block";
    ghost.appendChild(image);
  } else if (videoUrl || previewKind === "video") {
    const videoPlaceholder = document.createElement("div");
    videoPlaceholder.style.flex = "1";
    videoPlaceholder.style.width = "100%";
    videoPlaceholder.style.height = "100%";
    videoPlaceholder.style.background =
      "linear-gradient(160deg, rgba(24,31,45,0.95), rgba(10,14,22,0.85))";
    ghost.appendChild(videoPlaceholder);
  } else if (previewKind === "audio") {
    const textBody = document.createElement("div");
    textBody.style.flex = "1";
    textBody.style.padding = "10px";
    textBody.style.fontSize = "11px";
    textBody.style.lineHeight = "1.3";
    textBody.style.color = "rgba(229, 238, 255, 0.92)";
    textBody.style.overflow = "hidden";
    textBody.style.display = "-webkit-box";
    textBody.style.setProperty("-webkit-line-clamp", "5");
    textBody.style.setProperty("-webkit-box-orient", "vertical");
    textBody.textContent = trimmedPromptText || "Audio";
    ghost.appendChild(textBody);
  } else if (trimmedPromptText) {
    const textBody = document.createElement("div");
    textBody.style.flex = "1";
    textBody.style.padding = "10px";
    textBody.style.fontSize = "11px";
    textBody.style.lineHeight = "1.3";
    textBody.style.color = "rgba(229, 238, 255, 0.92)";
    textBody.style.overflow = "hidden";
    textBody.style.display = "-webkit-box";
    textBody.style.setProperty("-webkit-line-clamp", "5");
    textBody.style.setProperty("-webkit-box-orient", "vertical");
    textBody.textContent = trimmedPromptText;
    ghost.appendChild(textBody);
  }
  return ghost;
};

export { CANVAS_PROMPT_DRAG_HOTSPOT_X, CANVAS_PROMPT_DRAG_HOTSPOT_Y };
