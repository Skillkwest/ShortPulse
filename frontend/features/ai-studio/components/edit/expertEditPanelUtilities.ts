/**
 * Utilities for Expert Edit panel drag payloads, blob lifecycle helpers, and canvas-space math.
 * Keeps side-effectful DOM helpers and pure math helpers outside the panel orchestration component.
 */
import {
  EXPERT_EDIT_PRESET_DRAG_MIME,
  parseExpertEditPresetDragPayload,
  serializeExpertEditPresetDragPayload,
  type ExpertEditPresetDragPayload,
} from "./expertEditPresets";

export const writePresetDragTransfer = (
  transfer: DataTransfer,
  payload: ExpertEditPresetDragPayload,
  label: string
) => {
  const serializedPayload = serializeExpertEditPresetDragPayload(payload);
  transfer.setData(EXPERT_EDIT_PRESET_DRAG_MIME, serializedPayload);
  transfer.setData("text/plain", label);
};

export const resolvePresetDragPayload = (
  transfer: DataTransfer | null | undefined,
  activeDragPayload: ExpertEditPresetDragPayload | null
) => parseExpertEditPresetDragPayload(transfer) ?? activeDragPayload;

export const setOpaquePresetDragImage = (
  transfer: DataTransfer,
  sourceElement: HTMLElement
): (() => void) | null => {
  if (typeof document === "undefined" || typeof transfer.setDragImage !== "function") {
    return null;
  }
  const rect = sourceElement.getBoundingClientRect();
  const dragPreview = sourceElement.cloneNode(true) as HTMLElement;
  dragPreview.style.position = "fixed";
  dragPreview.style.top = "-9999px";
  dragPreview.style.left = "-9999px";
  dragPreview.style.pointerEvents = "none";
  dragPreview.style.opacity = "1";
  dragPreview.style.transform = "none";
  dragPreview.style.margin = "0";
  dragPreview.style.width = `${Math.max(1, Math.round(rect.width))}px`;
  dragPreview.style.height = `${Math.max(1, Math.round(rect.height))}px`;
  dragPreview.style.boxSizing = "border-box";
  dragPreview.style.background = "#1a1f27";
  dragPreview.style.border = "1px solid rgba(201, 205, 214, 0.36)";
  dragPreview.style.color = "rgba(238, 242, 248, 0.94)";
  dragPreview.style.boxShadow = "0 8px 22px rgba(0, 0, 0, 0.45)";
  document.body.appendChild(dragPreview);
  transfer.setDragImage(dragPreview, Math.round(rect.width / 2), Math.round(rect.height / 2));
  return () => {
    if (dragPreview.parentNode) {
      dragPreview.parentNode.removeChild(dragPreview);
    }
  };
};

export const revokeObjectUrlSafe = (url: string) => {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Preserve UI flow even when revocation fails.
  }
};

export const cloneBlobObjectUrl = async (sourceUrl: string): Promise<string | null> => {
  if (!sourceUrl.startsWith("blob:")) return null;
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

export const resolveBlobDimensions = async (
  blob: Blob
): Promise<{ width: number; height: number }> => {
  if (typeof window !== "undefined" && typeof window.createImageBitmap === "function") {
    const bitmap = await window.createImageBitmap(blob);
    const dimensions = {
      width: Math.max(1, bitmap.width),
      height: Math.max(1, bitmap.height),
    };
    bitmap.close();
    return dimensions;
  }
  const tempUrl = URL.createObjectURL(blob);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () =>
        resolve({
          width: Math.max(1, image.naturalWidth || 1),
          height: Math.max(1, image.naturalHeight || 1),
        });
      image.onerror = () => reject(new Error("Unable to read image dimensions."));
      image.src = tempUrl;
    });
    return dimensions;
  } finally {
    revokeObjectUrlSafe(tempUrl);
  }
};

export const resolveCanvasSpacePoint = ({
  clientX,
  clientY,
  rect,
  sceneScale,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  sceneScale: number;
}) => {
  const rawX = clientX - rect.left;
  const rawY = clientY - rect.top;
  if (!Number.isFinite(sceneScale) || sceneScale <= 0 || sceneScale === 1) {
    return { x: rawX, y: rawY };
  }
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  return {
    x: centerX + (rawX - centerX) / sceneScale,
    y: centerY + (rawY - centerY) / sceneScale,
  };
};
