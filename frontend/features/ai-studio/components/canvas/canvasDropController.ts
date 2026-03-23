/**
 * Canvas drop payload helpers.
 * Parses accepted transfer payloads and resolves safe viewport drop coordinates.
 */
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
} from "../../utils/dragDrop";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";

const DRAG_TEXT_HINT_PATTERN =
  /^text\/(?:plain|prompt|x-moz-url|html|uri-list)|application\/json$/i;

/**
 * Returns whether a transfer payload can be handled by the canvas drop controller.
 */
export const canAcceptCanvasDropTransfer = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  if (hasInternalReferenceDragTypeHints(transfer)) return true;
  if (extractInternalReferenceDragPayload(transfer)) return true;
  if (readMediaLibraryDragPayload(transfer)) return true;
  return Array.from(transfer.types || []).some((type) => DRAG_TEXT_HINT_PATTERN.test(type));
};

/**
 * Extracts plain/prompt text from a transfer payload for canvas text drops.
 */
export const extractCanvasDroppedText = (transfer: DataTransfer): string | null => {
  const text = (
    transfer.getData("text/prompt") ||
    transfer.getData("text/plain") ||
    transfer.getData("text")
  ).trim();
  return text.length ? text : null;
};

/**
 * Resolves finite client coordinates for drop conversion by falling back to viewport center.
 */
export const resolveCanvasDropClientPoint = ({
  clientX,
  clientY,
  rect,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
}): { clientX: number; clientY: number } => ({
  clientX: Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2,
  clientY: Number.isFinite(clientY) ? clientY : rect.top + rect.height / 2,
});
