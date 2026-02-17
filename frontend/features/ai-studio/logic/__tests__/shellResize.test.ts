/**
 * Unit tests for AI Studio shell-resize helpers.
 * Verifies bounds, clamp behavior, defaults, and stored-value parsing.
 */
import { describe, expect, it } from "vitest";
import {
  AI_SHELL_DIVIDER_TRACK_PX,
  AI_SHELL_LEFT_CHARACTER_MIN_PX,
  AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX,
  AI_SHELL_LEFT_MIN_FALLBACK_PX,
  AI_SHELL_LEFT_MIN_PX,
  AI_SHELL_RIGHT_MIN_PX,
  clampAiShellLeftWidth,
  getAiShellLeftWidthBounds,
  getDefaultAiShellLeftWidth,
  isAiShellResizeViewport,
  parseStoredAiShellLeftWidth,
  shouldCollapseAiShellOnToolSelect,
} from "../shellResize";

describe("getAiShellLeftWidthBounds", () => {
  it("returns bounded min/max for wide containers", () => {
    const bounds = getAiShellLeftWidthBounds(1600);
    expect(bounds.min).toBe(AI_SHELL_LEFT_MIN_PX);
    expect(bounds.max).toBe(1600 - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX);
  });

  it("uses fallback-safe minimum when container is tightly constrained", () => {
    const bounds = getAiShellLeftWidthBounds(720);
    expect(bounds.min).toBe(AI_SHELL_LEFT_MIN_FALLBACK_PX);
    expect(bounds.max).toBe(AI_SHELL_LEFT_MIN_FALLBACK_PX);
  });

  it("supports a larger caller-provided minimum width", () => {
    const bounds = getAiShellLeftWidthBounds(1700, {
      minLeftWidthPx: AI_SHELL_LEFT_CHARACTER_MIN_PX,
    });
    expect(bounds.min).toBe(AI_SHELL_LEFT_CHARACTER_MIN_PX);
    expect(bounds.max).toBe(1700 - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX);
  });

  it("supports a caller-provided maximum width cap", () => {
    const bounds = getAiShellLeftWidthBounds(1700, {
      maxLeftWidthPx: AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX,
    });
    expect(bounds.max).toBe(AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX);
  });
});

describe("clampAiShellLeftWidth", () => {
  it("clamps values within container bounds", () => {
    expect(clampAiShellLeftWidth(100, 1500)).toBe(AI_SHELL_LEFT_MIN_PX);
    expect(clampAiShellLeftWidth(1400, 1500)).toBe(
      1500 - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX
    );
  });

  it("respects caller-provided minimum width", () => {
    expect(
      clampAiShellLeftWidth(540, 1600, { minLeftWidthPx: AI_SHELL_LEFT_CHARACTER_MIN_PX })
    ).toBe(AI_SHELL_LEFT_CHARACTER_MIN_PX);
  });

  it("respects caller-provided maximum width", () => {
    expect(
      clampAiShellLeftWidth(1400, 1600, {
        maxLeftWidthPx: AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX,
      })
    ).toBe(AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX);
  });
});

describe("getDefaultAiShellLeftWidth", () => {
  it("computes a clamped ratio-based default", () => {
    expect(getDefaultAiShellLeftWidth(1500)).toBe(600);
    expect(getDefaultAiShellLeftWidth(900)).toBe(clampAiShellLeftWidth(900 * 0.4, 900));
  });

  it("clamps defaults to a larger caller-provided minimum when needed", () => {
    expect(
      getDefaultAiShellLeftWidth(1500, { minLeftWidthPx: AI_SHELL_LEFT_CHARACTER_MIN_PX })
    ).toBe(AI_SHELL_LEFT_CHARACTER_MIN_PX);
  });

  it("clamps defaults to a caller-provided maximum width", () => {
    expect(
      getDefaultAiShellLeftWidth(3000, { maxLeftWidthPx: AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX })
    ).toBe(AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX);
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

describe("shouldCollapseAiShellOnToolSelect", () => {
  it("collapses when switching to edit or video", () => {
    expect(shouldCollapseAiShellOnToolSelect(null, "edit")).toBe(true);
    expect(shouldCollapseAiShellOnToolSelect("text", "video")).toBe(true);
  });

  it("does not collapse when re-selecting the same tool or choosing other tools", () => {
    expect(shouldCollapseAiShellOnToolSelect("edit", "edit")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("video", "video")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("text", "create")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("edit", null)).toBe(false);
  });
});
