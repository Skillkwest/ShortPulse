/**
 * Media Library drag-ghost presenter.
 * Mirrors Reference Grid drag-ghost visual contract while preserving media-library drag payload semantics.
 */
import type React from "react";
import {
  buildCanvasPromptDragGhost,
  CANVAS_PROMPT_DRAG_GHOST_HEIGHT_PX,
  CANVAS_PROMPT_DRAG_GHOST_WIDTH_PX,
  CANVAS_PROMPT_DRAG_HOTSPOT_X,
  CANVAS_PROMPT_DRAG_HOTSPOT_Y,
} from "./canvasPromptDragGhost";

const dragGhostMap = new WeakMap<HTMLElement, HTMLElement>();
const GHOST_MAX_TEXT_LENGTH = 180;
const DRAG_GHOST_ASPECT_RATIO = 4 / 5;
const DRAG_GHOST_HEIGHT_PX = 120;
const DRAG_GHOST_WIDTH_PX = Math.round(DRAG_GHOST_HEIGHT_PX * DRAG_GHOST_ASPECT_RATIO);
const FOLDER_GHOST_WIDTH_PX = 118;
const FOLDER_GHOST_HEIGHT_PX = 104;
const GHOST_SNAPSHOT_WIDTH = 384;
const GHOST_SNAPSHOT_HEIGHT = 480;
const GHOST_SNAPSHOT_QUALITY = 0.08;
type MediaLibraryDragGhostTemplate = "media" | "prompt" | "folder";
type MediaLibraryDragGhostPreviewKind = "image" | "video" | "audio";

const LIKELY_IMAGE_URL_PATTERN =
  /^(?:data:image\/|blob:|https?:\/\/.*\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:$|[?#]))/i;

const trimGhostText = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";
  if (normalized.length <= GHOST_MAX_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, GHOST_MAX_TEXT_LENGTH - 3)}...`;
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

const resolveGhostPreviewUrl = ({
  node,
  template,
  previewKind,
  providedPreviewUrl,
}: {
  node: HTMLElement;
  template: MediaLibraryDragGhostTemplate;
  previewKind?: MediaLibraryDragGhostPreviewKind;
  providedPreviewUrl?: string | null;
}): string | null => {
  if (template === "prompt") {
    return null;
  }
  if (template === "folder") {
    const folderImageNode =
      node.querySelector("img.media-library-panel-folder-chip-image") ??
      node
        .closest(".media-library-panel-folder-strip-item")
        ?.querySelector("img.media-library-panel-folder-chip-image");
    if (folderImageNode instanceof HTMLImageElement) {
      const renderedSrc =
        folderImageNode.currentSrc ||
        folderImageNode.getAttribute("src") ||
        folderImageNode.dataset.src ||
        "";
      const normalizedRenderedSrc = renderedSrc.trim();
      if (normalizedRenderedSrc) return normalizedRenderedSrc;
    }
    const normalized = (providedPreviewUrl ?? "").trim();
    return normalized || null;
  }
  if (previewKind === "video") {
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

const isLikelyImagePreviewUrl = (value: string | null | undefined): boolean =>
  Boolean(value && LIKELY_IMAGE_URL_PATTERN.test(value.trim()));

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
  template,
  previewKind,
}: {
  ghostWidth: number;
  ghostHeight: number;
  label: string;
  detail?: string | null;
  previewUrl?: string | null;
  template: MediaLibraryDragGhostTemplate;
  previewKind?: MediaLibraryDragGhostPreviewKind;
}): HTMLDivElement => {
  const ghost = document.createElement("div");
  ghost.className =
    template === "folder"
      ? "media-library-drag-ghost media-library-drag-ghost--folder"
      : "media-library-drag-ghost reference-drag-ghost";
  ghost.style.width = `${ghostWidth}px`;
  ghost.style.height = `${ghostHeight}px`;
  ghost.style.aspectRatio = template === "folder" ? "118 / 104" : "4 / 5";
  ghost.style.boxSizing = "border-box";
  ghost.style.position = "absolute";
  ghost.style.top = "-9999px";
  ghost.style.left = "-9999px";
  ghost.style.overflow = "hidden";
  ghost.style.borderRadius = template === "folder" ? "0" : "6px";
  ghost.style.border = "none";
  ghost.style.background = template === "folder" ? "transparent" : "rgba(37, 41, 47, 0.64)";
  ghost.style.pointerEvents = "none";
  ghost.style.display = "flex";
  ghost.style.flexDirection = "column";
  ghost.style.justifyContent = template === "folder" ? "flex-start" : "space-between";
  ghost.style.alignItems = template === "folder" ? "center" : "";
  ghost.style.gap = template === "folder" ? "6px" : "";
  ghost.style.boxShadow = template === "folder" ? "none" : "0 12px 30px rgba(0,0,0,0.45)";

  const safePreviewUrl = (previewUrl ?? "").trim();
  if (template === "folder") {
    if (safePreviewUrl) {
      const image = document.createElement("img");
      image.src = safePreviewUrl;
      image.alt = "";
      image.draggable = false;
      image.loading = "lazy";
      image.decoding = "async";
      image.style.width = "104px";
      image.style.height = "72px";
      image.style.objectFit = "contain";
      image.style.display = "block";
      ghost.appendChild(image);
    }

    const textLabel = document.createElement("div");
    textLabel.style.maxWidth = "118px";
    textLabel.style.textAlign = "center";
    textLabel.style.fontSize = "12px";
    textLabel.style.lineHeight = "1.15";
    textLabel.style.color = "#edf4ff";
    textLabel.style.display = "-webkit-box";
    textLabel.style.setProperty("-webkit-line-clamp", "2");
    textLabel.style.setProperty("-webkit-box-orient", "vertical");
    textLabel.style.overflow = "hidden";
    textLabel.style.setProperty("text-wrap", "pretty");
    textLabel.textContent = trimGhostText(label) || "Folder";
    ghost.appendChild(textLabel);
    return ghost;
  }

  if (safePreviewUrl && previewKind === "image") {
    const image = document.createElement("img");
    image.src = safePreviewUrl;
    image.alt = "";
    image.draggable = false;
    image.loading = "lazy";
    image.decoding = "async";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.display = "block";
    ghost.appendChild(image);
    return ghost;
  }

  if (safePreviewUrl && previewKind === "audio" && isLikelyImagePreviewUrl(safePreviewUrl)) {
    const image = document.createElement("img");
    image.src = safePreviewUrl;
    image.alt = "";
    image.draggable = false;
    image.loading = "lazy";
    image.decoding = "async";
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
    previewKind?: MediaLibraryDragGhostPreviewKind;
    template?: MediaLibraryDragGhostTemplate;
  }
): void => {
  const node = event.currentTarget as HTMLElement;
  removeExistingGhost(node);
  try {
    const template = options.template ?? "media";
    const ghostWidth =
      template === "folder"
        ? FOLDER_GHOST_WIDTH_PX
        : template === "prompt"
          ? CANVAS_PROMPT_DRAG_GHOST_WIDTH_PX
          : DRAG_GHOST_WIDTH_PX;
    const ghostHeight =
      template === "folder"
        ? FOLDER_GHOST_HEIGHT_PX
        : template === "prompt"
          ? CANVAS_PROMPT_DRAG_GHOST_HEIGHT_PX
          : DRAG_GHOST_HEIGHT_PX;
    const resolvedPreviewUrl = resolveGhostPreviewUrl({
      node,
      template,
      previewKind: options.previewKind,
      providedPreviewUrl: options.previewUrl,
    });
    const ghost =
      template === "prompt"
        ? buildCanvasPromptDragGhost({
            label: options.label,
            detail: options.detail,
            className: "media-library-drag-ghost",
          })
        : buildGhostNode({
            ...options,
            template,
            previewUrl: resolvedPreviewUrl,
            ghostWidth,
            ghostHeight,
          });
    document.body.appendChild(ghost);
    const dragImageOffsetX = template === "prompt" ? CANVAS_PROMPT_DRAG_HOTSPOT_X : 12;
    const dragImageOffsetY = template === "prompt" ? CANVAS_PROMPT_DRAG_HOTSPOT_Y : 12;
    if (safeSetDragImage(event.dataTransfer, ghost, dragImageOffsetX, dragImageOffsetY)) {
      dragGhostMap.set(node, ghost);
      return;
    }
    if (ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }
    const fallbackGhost =
      template === "prompt"
        ? buildCanvasPromptDragGhost({
            label: options.label,
            detail: options.detail,
            className: "media-library-drag-ghost",
          })
        : buildGhostNode({
            ...options,
            template,
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
