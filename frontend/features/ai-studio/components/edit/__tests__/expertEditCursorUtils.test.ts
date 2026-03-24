/**
 * Unit tests for Expert Edit cursor builders used by inpaint/markup tools.
 */
import { describe, expect, it } from "vitest";
import {
  buildInpaintBrushReticleCursor,
  buildMarkupBrushReticleCursor,
} from "../expertEditCursorUtils";

const decodeCursorSvg = (cursor: string) => {
  const match = cursor.match(/data:image\/svg\+xml,([^"]+)/);
  const encoded = match?.[1] ?? "";
  return decodeURIComponent(encoded);
};

const readSvgWidth = (svg: string) => Number(svg.match(/width="([0-9.]+)"/)?.[1] ?? "0");

describe("expertEditCursorUtils", () => {
  it("scales inpaint brush reticle with scene zoom", () => {
    const cursorAt100 = buildInpaintBrushReticleCursor(60, 1);
    const cursorAt200 = buildInpaintBrushReticleCursor(60, 2);
    const cursorAt50 = buildInpaintBrushReticleCursor(60, 0.5);
    const widthAt100 = readSvgWidth(decodeCursorSvg(cursorAt100));
    const widthAt200 = readSvgWidth(decodeCursorSvg(cursorAt200));
    const widthAt50 = readSvgWidth(decodeCursorSvg(cursorAt50));
    expect(widthAt200).toBeGreaterThan(widthAt100);
    expect(widthAt50).toBeLessThan(widthAt100);
  });

  it("falls back to default zoom scale for invalid values", () => {
    const baseline = buildInpaintBrushReticleCursor(60, 1);
    const invalid = buildInpaintBrushReticleCursor(60, Number.NaN);
    expect(readSvgWidth(decodeCursorSvg(invalid))).toBeCloseTo(
      readSvgWidth(decodeCursorSvg(baseline)),
      4
    );
  });

  it("scales markup brush reticle with render zoom", () => {
    const cursorAt100 = buildMarkupBrushReticleCursor(24, 96, 1);
    const cursorAt200 = buildMarkupBrushReticleCursor(24, 96, 2);
    const cursorAt50 = buildMarkupBrushReticleCursor(24, 96, 0.5);
    const widthAt100 = readSvgWidth(decodeCursorSvg(cursorAt100));
    const widthAt200 = readSvgWidth(decodeCursorSvg(cursorAt200));
    const widthAt50 = readSvgWidth(decodeCursorSvg(cursorAt50));
    expect(widthAt200).toBeGreaterThan(widthAt100);
    expect(widthAt50).toBeLessThan(widthAt100);
  });

  it("allows markup reticle diameter to grow beyond base stroke max under zoom", () => {
    const cursorAt100 = buildMarkupBrushReticleCursor(30, 30, 1);
    const cursorAt200 = buildMarkupBrushReticleCursor(30, 30, 2);
    const widthAt100 = readSvgWidth(decodeCursorSvg(cursorAt100));
    const widthAt200 = readSvgWidth(decodeCursorSvg(cursorAt200));

    expect(widthAt200).toBeGreaterThan(widthAt100);
    expect(widthAt200 - widthAt100).toBeGreaterThan(20);
  });
});
