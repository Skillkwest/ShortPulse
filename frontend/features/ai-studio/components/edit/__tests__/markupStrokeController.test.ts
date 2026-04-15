/**
 * Unit tests for markup stroke geometry helpers used by pen, lasso, and eraser interactions.
 */
import { describe, expect, it } from "vitest";

import {
  isMarkupStrokeClosedShape,
  resolveMarkupStrokeHit,
  resolveMarkupStrokeKind,
  type MarkupStroke,
} from "../markupStrokeController";

const createStroke = (overrides: Partial<MarkupStroke> = {}): MarkupStroke => ({
  id: "markup-stroke-1",
  color: "#f43f5e",
  sizeRatio: 0.04,
  points: [
    { sceneX: 0.2, sceneY: 0.2 },
    { sceneX: 0.8, sceneY: 0.2 },
    { sceneX: 0.5, sceneY: 0.8 },
  ],
  ...overrides,
});

describe("markupStrokeController", () => {
  it("defaults legacy strokes to pen kind", () => {
    const stroke = createStroke();

    expect(resolveMarkupStrokeKind(stroke)).toBe("pen");
    expect(isMarkupStrokeClosedShape(stroke)).toBe(false);
  });

  it("treats lasso strokes as closed shapes when they have enough points", () => {
    const stroke = createStroke({ kind: "lasso" });

    expect(resolveMarkupStrokeKind(stroke)).toBe("lasso");
    expect(isMarkupStrokeClosedShape(stroke)).toBe(true);
  });

  it("allows the eraser to hit inside a lasso-filled region", () => {
    const stroke = createStroke({ kind: "lasso" });

    const hit = resolveMarkupStrokeHit({
      stroke,
      point: { sceneX: 0.5, sceneY: 0.4 },
      eraserRadiusPx: 2,
      stageWidth: 200,
      stageHeight: 200,
    });

    expect(hit).toBe(true);
  });
});
