import type React from "react";

const dragGhostMap = new WeakMap<HTMLElement, HTMLElement>();
const GHOST_MAX_TEXT_LENGTH = 180;

const trimGhostText = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";
  if (normalized.length <= GHOST_MAX_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, GHOST_MAX_TEXT_LENGTH - 3)}...`;
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

const buildGhostNode = ({
  label,
  detail,
  previewUrl,
  previewKind,
}: {
  label: string;
  detail?: string | null;
  previewUrl?: string | null;
  previewKind?: "image" | "video" | "text";
}): HTMLDivElement => {
  const ghost = document.createElement("div");
  ghost.className = "media-library-drag-ghost";
  ghost.style.position = "fixed";
  ghost.style.top = "-9999px";
  ghost.style.left = "-9999px";
  ghost.style.width = "220px";
  ghost.style.maxWidth = "220px";
  ghost.style.padding = "10px";
  ghost.style.borderRadius = "12px";
  ghost.style.border = "1px solid rgba(122, 137, 168, 0.4)";
  ghost.style.background = "rgba(8, 12, 22, 0.94)";
  ghost.style.boxShadow = "0 14px 28px rgba(0, 0, 0, 0.45)";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "2147483647";
  ghost.style.color = "rgba(236, 245, 255, 0.95)";
  ghost.style.font = "500 12px/1.4 Inter, system-ui, -apple-system, Segoe UI, sans-serif";

  const safePreviewUrl = (previewUrl ?? "").trim();
  if (safePreviewUrl) {
    const previewWrap = document.createElement("div");
    previewWrap.style.width = "100%";
    previewWrap.style.height = "126px";
    previewWrap.style.marginBottom = "8px";
    previewWrap.style.borderRadius = "8px";
    previewWrap.style.overflow = "hidden";
    previewWrap.style.background = "rgba(20, 28, 44, 0.8)";
    if (previewKind === "video") {
      const icon = document.createElement("div");
      icon.textContent = "VIDEO";
      icon.style.width = "100%";
      icon.style.height = "100%";
      icon.style.display = "grid";
      icon.style.placeItems = "center";
      icon.style.letterSpacing = "0.08em";
      icon.style.fontSize = "10px";
      icon.style.fontWeight = "700";
      icon.style.color = "rgba(206, 226, 255, 0.9)";
      previewWrap.appendChild(icon);
    } else {
      const image = document.createElement("img");
      image.src = safePreviewUrl;
      image.alt = "";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "cover";
      previewWrap.appendChild(image);
    }
    ghost.appendChild(previewWrap);
  }

  const labelNode = document.createElement("div");
  labelNode.textContent = trimGhostText(label) || "Media";
  labelNode.style.fontWeight = "600";
  ghost.appendChild(labelNode);

  const safeDetail = trimGhostText(detail);
  if (safeDetail) {
    const detailNode = document.createElement("div");
    detailNode.textContent = safeDetail;
    detailNode.style.marginTop = "4px";
    detailNode.style.color = "rgba(177, 195, 220, 0.9)";
    detailNode.style.fontSize = "11px";
    ghost.appendChild(detailNode);
  }
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
    const ghost = buildGhostNode(options);
    document.body.appendChild(ghost);
    dragGhostMap.set(node, ghost);
    event.dataTransfer.setDragImage(ghost, 110, 68);
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
