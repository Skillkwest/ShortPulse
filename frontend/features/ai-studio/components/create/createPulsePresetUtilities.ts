/**
 * Utilities for Create Pulse preset drag payloads and drag-preview lifecycle.
 * Keeps DOM drag helpers out of the Create pulse runtime hooks.
 */
import {
  CREATE_PULSE_PRESET_DRAG_MIME,
  parseCreatePulsePresetDragPayload,
  serializeCreatePulsePresetDragPayload,
  type CreatePulsePresetDragPayload,
} from "./createPulsePresets";

/**
 * Writes the Pulse preset drag payload into the transfer object.
 */
export const writeCreatePulsePresetDragTransfer = (
  transfer: DataTransfer,
  payload: CreatePulsePresetDragPayload,
  label: string
) => {
  transfer.setData(CREATE_PULSE_PRESET_DRAG_MIME, serializeCreatePulsePresetDragPayload(payload));
  transfer.setData("text/plain", label);
};

/**
 * Resolves the active drag payload from the transfer object or active in-memory session.
 */
export const resolveCreatePulsePresetDragPayload = (
  transfer: DataTransfer | null | undefined,
  activeDragPayload: CreatePulsePresetDragPayload | null
) => parseCreatePulsePresetDragPayload(transfer) ?? activeDragPayload;

/**
 * Sets an opaque drag image so preset drags remain visible across browsers.
 */
export const setOpaqueCreatePulsePresetDragImage = (
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
