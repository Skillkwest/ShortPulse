/**
 * Unit tests for AI Studio shell-resize helpers.
 * Verifies bounds, clamp behavior, defaults, and stored-value parsing.
 */
import { describe, expect, it } from "vitest";
import {
  AI_SHELL_DIVIDER_TRACK_PX,
  AI_SHELL_LEFT_MIN_FALLBACK_PX,
  AI_SHELL_LEFT_MIN_PX,
  AI_SHELL_RIGHT_MIN_PX,
  clampAiShellLeftWidth,
  getAiShellLeftWidthBounds,
  getDefaultAiShellLeftWidth,
  isAiShellResizeViewport,
  parseStoredAiShellLeftWidth,
} from "../shellResize";

describe("getAiShellLeftWidthBounds", () => {
  it("returns bounded min/max for wide containers", () => {
    const bounds = getAiShellLeftWidthBounds(1600);
    expect(bounds.min).toBe(AI_SHELL_LEFT_MIN_PX);
    expect(bounds.max).toBe(1600 - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX);
  });

  it("uses fallback-safe minimum when container is constrained", () => {
    const bounds = getAiShellLeftWidthBounds(820);
    expect(bounds.min).toBe(AI_SHELL_LEFT_MIN_FALLBACK_PX);
    expect(bounds.max).toBe(AI_SHELL_LEFT_MIN_FALLBACK_PX);
  });
});

describe("clampAiShellLeftWidth", () => {
  it("clamps values within container bounds", () => {
    expect(clampAiShellLeftWidth(100, 1500)).toBe(AI_SHELL_LEFT_MIN_PX);
    expect(clampAiShellLeftWidth(1400, 1500)).toBe(
      1500 - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX
    );
  });
});

describe("getDefaultAiShellLeftWidth", () => {
  it("computes a clamped ratio-based default", () => {
    expect(getDefaultAiShellLeftWidth(1500)).toBe(600);
    expect(getDefaultAiShellLeftWidth(900)).toBe(clampAiShellLeftWidth(900 * 0.4, 900));
  });
});

describe("parseStoredAiShellLeftWidth", () => {
  it("parses valid numeric strings and rejects invalid values", () => {
    expect(parseStoredAiShellLeftWidth("512")).toBe(512);
    expect(parseStoredAiShellLeftWidth("0")).toBeNull();
    expect(parseStoredAiShellLeftWidth("abc")).toBeNull();
    expect(parseStoredAiShellLeftWidth(null)).toBeNull();
  });
});

describe("isAiShellResizeViewport", () => {
  it("enables resize only above the breakpoint", () => {
    expect(isAiShellResizeViewport(1200)).toBe(true);
    expect(isAiShellResizeViewport(960)).toBe(false);
  });
});
