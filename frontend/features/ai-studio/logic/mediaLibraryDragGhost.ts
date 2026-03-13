/**
 * Media Library drag-ghost presenter.
 * Mirrors Reference Grid drag-ghost visual contract while preserving media-library drag payload semantics.
 */
import type React from "react";

const dragGhostMap = new WeakMap<HTMLElement, HTMLElement>();
const GHOST_MAX_TEXT_LENGTH = 180;
const DRAG_GHOST_SCALE = 0.68;
const DRAG_GHOST_MIN_SIZE_PX = 108;
const DRAG_GHOST_MAX_SIZE_PX = 244;
const DRAG_GHOST_ASPECT_RATIO = 4 / 5;
const REFERENCE_GRID_CARD_SELECTOR = "[data-grid-surface='reference-grid'] .reference-card";
const GHOST_SNAPSHOT_WIDTH = 384;
const GHOST_SNAPSHOT_HEIGHT = 480;
const GHOST_SNAPSHOT_QUALITY = 0.28;

const trimGhostText = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";
  if (normalized.length <= GHOST_MAX_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, GHOST_MAX_TEXT_LENGTH - 3)}...`;
};

const clampDragGhostSize = (value: number): number =>
  Math.max(DRAG_GHOST_MIN_SIZE_PX, Math.min(DRAG_GHOST_MAX_SIZE_PX, value));

const resolveGhostDimensions = ({
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

const resolveReferenceGridGhostSourceDimensions = (): { width: number; height: number } | null => {
  if (typeof document === "undefined") return null;
  const referenceCard = document.querySelector(REFERENCE_GRID_CARD_SELECTOR);
  if (!(referenceCard instanceof HTMLElement)) return null;
  const rect = referenceCard.getBoundingClientRect();
  const width = rect.width || referenceCard.offsetWidth || 0;
  const height = rect.height || referenceCard.offsetHeight || 0;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

const createGhostSnapshotSrc = (imageNode: HTMLImageElement | null): string | null => {
  if (!imageNode) return null;
  if (!imageNode.complete || imageNode.naturalWidth <= 0 || imageNode.naturalHeight <= 0)
    return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = GHOST_SNAPSHOT_WIDTH;
    canvas.height = GHOST_SNAPSHOT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const sourceWidth = imageNode.naturalWidth;
    const sourceHeight = imageNode.naturalHeight;
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = GHOST_SNAPSHOT_WIDTH / GHOST_SNAPSHOT_HEIGHT;
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

    context.drawImage(imageNode, sx, sy, sw, sh, 0, 0, GHOST_SNAPSHOT_WIDTH, GHOST_SNAPSHOT_HEIGHT);
    return canvas.toDataURL("image/jpeg", GHOST_SNAPSHOT_QUALITY);
  } catch {
    return null;
  }
};

const resolveGhostPreviewUrl = (
  node: HTMLElement,
  previewKind: "image" | "video" | "text" | undefined,
  providedPreviewUrl: string | null | undefined
): string | null => {
  if (previewKind === "video" || previewKind === "text") {
    const normalized = (providedPreviewUrl ?? "").trim();
    return normalized || null;
  }
  const renderedImageNode = node.querySelector("img.media-thumb");
  if (renderedImageNode instanceof HTMLImageElement) {
    const snapshotSrc = createGhostSnapshotSrc(renderedImageNode);
    if (snapshotSrc) return snapshotSrc;
    const renderedSrc =
      renderedImageNode.currentSrc ||
      renderedImageNode.getAttribute("src") ||
      renderedImageNode.dataset.src ||
      "";
    const normalizedRenderedSrc = renderedSrc.trim();
    if (normalizedRenderedSrc) return normalizedRenderedSrc;
  }
  const normalized = (providedPreviewUrl ?? "").trim();
  return normalized || null;
};

const removeExistingGhost = (node: HTMLElement | null | undefined): void => {
  if (!node) return;
  const existingGhost = dragGhostMap.get(node);
  if (!existingGhost) return;
  if (existingGhost.parentNode) {
    existingGhost.parentNode.removeChild(existingGhost);
  }
  dragGhostMap.delete(node);
};

const safeSetDragImage = (
  transfer: DataTransfer,
  element: HTMLElement,
  x: number,
  y: number
): boolean => {
  try {
    transfer.setDragImage(element, x, y);
    return true;
  } catch {
    return false;
  }
};

const buildGhostNode = ({
  ghostWidth,
  ghostHeight,
  label,
  detail,
  previewUrl,
  previewKind,
}: {
  ghostWidth: number;
  ghostHeight: number;
  label: string;
  detail?: string | null;
  previewUrl?: string | null;
  previewKind?: "image" | "video" | "text";
}): HTMLDivElement => {
  const ghost = document.createElement("div");
  ghost.className = "media-library-drag-ghost reference-drag-ghost";
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

  const safePreviewUrl = (previewUrl ?? "").trim();
  if (safePreviewUrl && previewKind !== "video") {
    const image = document.createElement("img");
    image.src = safePreviewUrl;
    image.alt = "";
    image.draggable = false;
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.display = "block";
    ghost.appendChild(image);
    return ghost;
  }

  if (previewKind === "video") {
    const videoPlaceholder = document.createElement("div");
    videoPlaceholder.style.flex = "1";
    videoPlaceholder.style.width = "100%";
    videoPlaceholder.style.height = "100%";
    videoPlaceholder.style.background =
      "linear-gradient(160deg, rgba(24,31,45,0.95), rgba(10,14,22,0.85))";
    ghost.appendChild(videoPlaceholder);
    return ghost;
  }

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
  textBody.textContent = trimGhostText(detail) || trimGhostText(label) || "Media";
  ghost.appendChild(textBody);

  return ghost;
};

/**
 * Installs a dedicated drag ghost node for Media Library drags.
 */
export const attachMediaLibraryDragGhost = (
  event: React.DragEvent<HTMLElement>,
  options: {
    label: string;
    detail?: string | null;
    previewUrl?: string | null;
    previewKind?: "image" | "video" | "text";
  }
): void => {
  const node = event.currentTarget as HTMLElement;
  removeExistingGhost(node);
  try {
    const rect = node.getBoundingClientRect();
    const fallbackWidth = rect.width || node.offsetWidth || DRAG_GHOST_MAX_SIZE_PX;
    const fallbackHeight = rect.height || node.offsetHeight || DRAG_GHOST_MAX_SIZE_PX;
    const referenceGridDimensions = resolveReferenceGridGhostSourceDimensions();
    const ghostSourceWidth = referenceGridDimensions?.width ?? fallbackWidth;
    const ghostSourceHeight = referenceGridDimensions?.height ?? fallbackHeight;
    const { ghostWidth, ghostHeight } = resolveGhostDimensions({
      width: ghostSourceWidth,
      height: ghostSourceHeight,
    });
    const resolvedPreviewUrl = resolveGhostPreviewUrl(
      node,
      options.previewKind,
      options.previewUrl
    );
    const ghost = buildGhostNode({
      ...options,
      previewUrl: resolvedPreviewUrl,
      ghostWidth,
      ghostHeight,
    });
    document.body.appendChild(ghost);
    const dragImageOffsetX = Math.round(ghostWidth / 2);
    const dragImageOffsetY = Math.round(ghostHeight / 2);
    if (safeSetDragImage(event.dataTransfer, ghost, dragImageOffsetX, dragImageOffsetY)) {
      dragGhostMap.set(node, ghost);
      return;
    }
    if (ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }
    const fallbackGhost = buildGhostNode({
      ...options,
      previewUrl: null,
      ghostWidth,
      ghostHeight,
    });
    document.body.appendChild(fallbackGhost);
    if (safeSetDragImage(event.dataTransfer, fallbackGhost, dragImageOffsetX, dragImageOffsetY)) {
      dragGhostMap.set(node, fallbackGhost);
      return;
    }
    if (fallbackGhost.parentNode) {
      fallbackGhost.parentNode.removeChild(fallbackGhost);
    }
  } catch {
    // Keep drag payload semantics when ghost setup fails.
  }
};

/**
 * Removes the Media Library drag ghost for a source node.
 */
export const clearMediaLibraryDragGhost = (
  eventOrNode: React.DragEvent<HTMLElement> | HTMLElement | null | undefined
): void => {
  const node =
    eventOrNode && "currentTarget" in eventOrNode
      ? (eventOrNode.currentTarget as HTMLElement)
      : (eventOrNode as HTMLElement | null | undefined);
  removeExistingGhost(node);
};
