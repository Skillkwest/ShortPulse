/**
 * Assistant inline-edit presentation helper tests.
 * Locks capture normalization and deterministic textarea style mapping.
 */
import { describe, expect, it, vi } from "vitest";
import {
  captureAssistantInlineEditPresentation,
  resolveAssistantInlineEditStyle,
} from "../assistantInlineEditPresentation";

describe("assistantInlineEditPresentation", () => {
  it("returns null when source text node is missing", () => {
    expect(captureAssistantInlineEditPresentation(null)).toBeNull();
    expect(resolveAssistantInlineEditStyle(null)).toBeUndefined();
  });

  it("captures metrics and typography values from a rendered source node", () => {
    const source = document.createElement("p");
    source.textContent = "Assistant output one.";
    document.body.appendChild(source);

    const getRect = vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 318,
      height: 146,
      top: 0,
      right: 318,
      bottom: 146,
      left: 0,
      toJSON: () => ({}),
    });
    const nativeGetComputedStyle = window.getComputedStyle;
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element: Element, pseudoElt?: string | null) => {
        if (element === source) {
          return {
            fontFamily: '"Sora", sans-serif',
            fontSize: "14px",
            fontWeight: "600",
            lineHeight: "1.6",
            letterSpacing: "0.02em",
            color: "rgb(37, 169, 191)",
          } as CSSStyleDeclaration;
        }
        return nativeGetComputedStyle(element, pseudoElt);
      });

    const captured = captureAssistantInlineEditPresentation(source);
    expect(captured).toEqual({
      widthPx: 318,
      heightPx: 146,
      fontFamily: '"Sora", sans-serif',
      fontSize: "14px",
      fontWeight: "600",
      lineHeight: "1.6",
      letterSpacing: "0.02em",
      color: "rgb(37, 169, 191)",
    });

    const style = resolveAssistantInlineEditStyle(captured);
    expect(style).toMatchObject({
      width: "318px",
      height: "146px",
      minHeight: "146px",
      maxHeight: "146px",
      fontFamily: '"Sora", sans-serif',
      fontSize: "14px",
      fontWeight: "600",
      lineHeight: "1.6",
      letterSpacing: "0.02em",
      color: "rgb(37, 169, 191)",
      resize: "none",
    });

    getRect.mockRestore();
    getComputedStyleSpy.mockRestore();
    source.remove();
  });

  it("clamps non-finite or zero dimensions to avoid collapsed edit boxes", () => {
    const source = document.createElement("p");
    source.textContent = "Assistant output one.";
    document.body.appendChild(source);

    const getRect = vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    });
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      fontFamily: "inherit",
      fontSize: "inherit",
      fontWeight: "inherit",
      lineHeight: "inherit",
      letterSpacing: "normal",
      color: "inherit",
    } as CSSStyleDeclaration);

    const captured = captureAssistantInlineEditPresentation(source);
    expect(captured?.widthPx).toBe(1);
    expect(captured?.heightPx).toBe(1);
    expect(resolveAssistantInlineEditStyle(captured)).toMatchObject({
      width: "1px",
      height: "1px",
      minHeight: "1px",
      maxHeight: "1px",
    });

    getRect.mockRestore();
    getComputedStyleSpy.mockRestore();
    source.remove();
  });
});
