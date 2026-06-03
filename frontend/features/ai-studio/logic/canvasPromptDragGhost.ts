/**
 * Shared canvas-targeted prompt drag ghost helper.
 * Keeps prompt drags visually aligned with the canvas text-card contract.
 */
import {
  CANVAS_TEXT_ITEM_MIN_HEIGHT,
  CANVAS_TEXT_ITEM_WIDTH,
} from "../components/canvas/canvasGeometry";

const CANVAS_PROMPT_DRAG_GHOST_SCALE = 0.6;
const CANVAS_PROMPT_DRAG_GHOST_MAX_TEXT_LENGTH = 180;

export const CANVAS_PROMPT_DRAG_GHOST_WIDTH_PX = Math.round(
  CANVAS_TEXT_ITEM_WIDTH * CANVAS_PROMPT_DRAG_GHOST_SCALE
);
export const CANVAS_PROMPT_DRAG_GHOST_HEIGHT_PX = Math.round(
  CANVAS_TEXT_ITEM_MIN_HEIGHT * CANVAS_PROMPT_DRAG_GHOST_SCALE
);
export const CANVAS_PROMPT_DRAG_HOTSPOT_X = Math.round(CANVAS_PROMPT_DRAG_GHOST_WIDTH_PX / 2);
export const CANVAS_PROMPT_DRAG_HOTSPOT_Y = Math.round(CANVAS_PROMPT_DRAG_GHOST_HEIGHT_PX / 2);

const trimCanvasPromptGhostText = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";
  if (normalized.length <= CANVAS_PROMPT_DRAG_GHOST_MAX_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, CANVAS_PROMPT_DRAG_GHOST_MAX_TEXT_LENGTH - 3)}...`;
};

/**
 * Builds a mini canvas text-card drag preview with the same aspect contract as dropped text.
 */
export const buildCanvasPromptDragGhost = ({
  label,
  detail,
  className,
}: {
  label?: string | null;
  detail?: string | null;
  className?: string | null;
}): HTMLDivElement => {
  const ghost = document.createElement("div");
  ghost.className = ["canvas-prompt-drag-ghost", className ?? ""].filter(Boolean).join(" ");
  ghost.style.width = `${CANVAS_PROMPT_DRAG_GHOST_WIDTH_PX}px`;
  ghost.style.height = `${CANVAS_PROMPT_DRAG_GHOST_HEIGHT_PX}px`;
  ghost.style.boxSizing = "border-box";
  ghost.style.position = "absolute";
  ghost.style.top = "-9999px";
  ghost.style.left = "-9999px";
  ghost.style.overflow = "hidden";
  ghost.style.borderRadius = "10px";
  ghost.style.border = "1px solid rgba(224, 231, 255, 0.18)";
  ghost.style.background = "rgba(25, 29, 38, 0.96)";
  ghost.style.pointerEvents = "none";
  ghost.style.display = "flex";
  ghost.style.flexDirection = "column";
  ghost.style.justifyContent = "flex-start";
  ghost.style.boxShadow = "0 12px 30px rgba(0,0,0,0.45)";

  const textBody = document.createElement("div");
  textBody.style.padding = "10px 12px";
  textBody.style.fontSize = "11px";
  textBody.style.lineHeight = "1.3";
  textBody.style.color = "rgba(229, 238, 255, 0.92)";
  textBody.style.overflow = "hidden";
  textBody.style.display = "-webkit-box";
  textBody.style.setProperty("-webkit-line-clamp", "4");
  textBody.style.setProperty("-webkit-box-orient", "vertical");
  textBody.textContent = trimCanvasPromptGhostText(detail) || trimCanvasPromptGhostText(label);
  ghost.appendChild(textBody);

  return ghost;
};
