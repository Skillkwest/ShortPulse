/**
 * Assistant inline-edit presentation helpers.
 * Captures rendered bubble text metrics/styles so edit mode can mirror display mode.
 */
import type { CSSProperties } from "react";

export type AssistantInlineEditPresentation = {
  widthPx: number;
  heightPx: number;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
};

const MIN_DIMENSION_PX = 1;

const normalizeDimension = (value: number): number => {
  if (!Number.isFinite(value)) return MIN_DIMENSION_PX;
  return Math.max(MIN_DIMENSION_PX, value);
};

const toPx = (value: number): string => `${value}px`;

/**
 * Captures the current presentation values from a rendered assistant text node.
 */
export const captureAssistantInlineEditPresentation = (
  sourceNode: HTMLElement | null
): AssistantInlineEditPresentation | null => {
  if (!sourceNode || typeof window === "undefined") return null;
  const rect = sourceNode.getBoundingClientRect();
  const computed = window.getComputedStyle(sourceNode);
  const widthPx = normalizeDimension(
    rect.width || sourceNode.offsetWidth || sourceNode.clientWidth
  );
  const heightPx = normalizeDimension(
    rect.height || sourceNode.offsetHeight || sourceNode.clientHeight
  );
  return {
    widthPx,
    heightPx,
    fontFamily: computed.fontFamily || "inherit",
    fontSize: computed.fontSize || "inherit",
    fontWeight: computed.fontWeight || "inherit",
    lineHeight: computed.lineHeight || "inherit",
    letterSpacing: computed.letterSpacing || "normal",
    color: computed.color || "inherit",
  };
};

/**
 * Resolves a deterministic textarea style payload from captured presentation values.
 */
export const resolveAssistantInlineEditStyle = (
  presentation: AssistantInlineEditPresentation | null
): CSSProperties | undefined => {
  if (!presentation) return undefined;
  const height = toPx(presentation.heightPx);
  return {
    width: toPx(presentation.widthPx),
    height,
    minHeight: height,
    maxHeight: height,
    fontFamily: presentation.fontFamily,
    fontSize: presentation.fontSize,
    fontWeight: presentation.fontWeight,
    lineHeight: presentation.lineHeight,
    letterSpacing: presentation.letterSpacing,
    color: presentation.color,
    resize: "none",
    overflow: "auto",
  };
};
