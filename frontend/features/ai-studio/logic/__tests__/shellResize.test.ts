/**
 * Unit tests for AI Studio shell-resize helpers.
 * Verifies bounds, clamp behavior, defaults, and stored-value parsing.
 */
import { describe, expect, it } from "vitest";
import {
  AI_SHELL_DIVIDER_TRACK_PX,
  AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO,
  AI_SHELL_LEFT_CHARACTER_MIN_PX,
  AI_SHELL_LEFT_COLLAPSED_MIN_PX,
  AI_SHELL_LEFT_CANVAS_DEFAULT_RATIO,
  AI_SHELL_LEFT_CREATE_MAX_PX,
  AI_SHELL_LEFT_CREATE_MIN_PX,
  AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
  AI_SHELL_LEFT_MIN_FALLBACK_PX,
  AI_SHELL_LEFT_MIN_PX,
  AI_SHELL_LEFT_SOUND_MIN_PX,
  AI_SHELL_LEFT_VIDEO_MIN_PX,
  AI_SHELL_RIGHT_CANVAS_MIN_PX,
  AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
  AI_SHELL_RIGHT_COMPACT_MIN_PX,
  AI_SHELL_RIGHT_MIN_PX,
  clampAiShellLeftWidth,
  getAiShellLeftWidthBounds,
  getDefaultAiShellLeftWidth,
  isAiShellResizeViewport,
  parseStoredAiShellLeftWidth,
  resolveAiShellLayoutMode,
  resolveCreateShellResizeAction,
  shouldCollapseAiShellOnExpertEditPanelSelect,
  shouldCollapseCreateOnSessionChange,
  shouldCollapseAiShellOnInitialSoundSelection,
  shouldCollapseAiShellOnToolSelect,
  shouldExpandAiShellOnToolSelect,
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
      maxLeftWidthPx: AI_SHELL_LEFT_CREATE_MAX_PX,
    });
    expect(bounds.max).toBe(AI_SHELL_LEFT_CREATE_MAX_PX);
  });

  it("supports a canvas right column minimum of zero", () => {
    const bounds = getAiShellLeftWidthBounds(1700, {
      minRightWidthPx: AI_SHELL_RIGHT_CANVAS_MIN_PX,
    });
    expect(bounds.max).toBe(1700 - AI_SHELL_DIVIDER_TRACK_PX);
  });

  it.each([
    { label: "Create", minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX },
    { label: "Expert Edit", minLeftWidthPx: AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX },
    { label: "Video", minLeftWidthPx: AI_SHELL_LEFT_VIDEO_MIN_PX },
    { label: "Sound", minLeftWidthPx: AI_SHELL_LEFT_SOUND_MIN_PX },
  ])(
    "supports collapsing the right column for $label when a caller allows a zero right minimum",
    ({ minLeftWidthPx }) => {
      const bounds = getAiShellLeftWidthBounds(1700, {
        minLeftWidthPx,
        minRightWidthPx: AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
      });

      expect(bounds.min).toBe(minLeftWidthPx);
      expect(bounds.max).toBe(1700 - AI_SHELL_DIVIDER_TRACK_PX);
    }
  );

  it("keeps the normal maximum while allowing the left column to collapse to zero", () => {
    const bounds = getAiShellLeftWidthBounds(1700, {
      minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX,
      minRightWidthPx: AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
      allowLeftCollapse: true,
    });

    expect(bounds.min).toBe(AI_SHELL_LEFT_COLLAPSED_MIN_PX);
    expect(bounds.max).toBe(1700 - AI_SHELL_DIVIDER_TRACK_PX);
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
        maxLeftWidthPx: AI_SHELL_LEFT_CREATE_MAX_PX,
      })
    ).toBe(AI_SHELL_LEFT_CREATE_MAX_PX);
  });

  it("allows the divider to cover the full right column for canvas mode", () => {
    expect(
      clampAiShellLeftWidth(2000, 1600, {
        minRightWidthPx: AI_SHELL_RIGHT_CANVAS_MIN_PX,
      })
    ).toBe(1600 - AI_SHELL_DIVIDER_TRACK_PX);
  });

  it.each([
    { label: "Create", minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX },
    { label: "Expert Edit", minLeftWidthPx: AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX },
    { label: "Video", minLeftWidthPx: AI_SHELL_LEFT_VIDEO_MIN_PX },
    { label: "Sound", minLeftWidthPx: AI_SHELL_LEFT_SOUND_MIN_PX },
  ])(
    "allows $label shells to clamp at the screen edge when the right rail is collapsible",
    ({ minLeftWidthPx }) => {
      expect(
        clampAiShellLeftWidth(2000, 1600, {
          minLeftWidthPx,
          minRightWidthPx: AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
        })
      ).toBe(1600 - AI_SHELL_DIVIDER_TRACK_PX);
    }
  );

  it("allows explicit zero-width primary-panel collapse when enabled", () => {
    expect(
      clampAiShellLeftWidth(100, 1600, {
        minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX,
        minRightWidthPx: AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
        allowLeftCollapse: true,
      })
    ).toBe(100);

    expect(
      clampAiShellLeftWidth(-100, 1600, {
        minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX,
        minRightWidthPx: AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
        allowLeftCollapse: true,
      })
    ).toBe(AI_SHELL_LEFT_COLLAPSED_MIN_PX);
  });
});

describe("getDefaultAiShellLeftWidth", () => {
  it("computes a clamped ratio-based default", () => {
    expect(getDefaultAiShellLeftWidth(1500)).toBe(AI_SHELL_LEFT_MIN_PX);
    expect(getDefaultAiShellLeftWidth(900)).toBe(clampAiShellLeftWidth(900 * 0.4, 900));
  });

  it("clamps defaults to a larger caller-provided minimum when needed", () => {
    expect(
      getDefaultAiShellLeftWidth(1500, { minLeftWidthPx: AI_SHELL_LEFT_CHARACTER_MIN_PX })
    ).toBe(AI_SHELL_LEFT_CHARACTER_MIN_PX);
  });

  it("clamps defaults to a caller-provided maximum width", () => {
    expect(getDefaultAiShellLeftWidth(3000, { maxLeftWidthPx: AI_SHELL_LEFT_CREATE_MAX_PX })).toBe(
      AI_SHELL_LEFT_CREATE_MAX_PX
    );
  });

  it("supports a caller-provided preferred ratio for tool-specific defaults", () => {
    expect(
      getDefaultAiShellLeftWidth(1600, { preferredRatio: AI_SHELL_LEFT_CANVAS_DEFAULT_RATIO })
    ).toBe(clampAiShellLeftWidth(1600 * AI_SHELL_LEFT_CANVAS_DEFAULT_RATIO, 1600));
  });

  it("supports a wider character default ratio for the character tool", () => {
    expect(
      getDefaultAiShellLeftWidth(1600, { preferredRatio: AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO })
    ).toBe(clampAiShellLeftWidth(1600 * AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO, 1600));
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

describe("resolveAiShellLayoutMode", () => {
  const zoomPressureWidthPx = 1320;
  const zoomPressureRightSafeLeftWidthPx =
    zoomPressureWidthPx - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX;
  const primaryWorkflowMinimums = [
    { label: "Create", minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX },
    { label: "Expert Edit", minLeftWidthPx: AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX },
    { label: "Video", minLeftWidthPx: AI_SHELL_LEFT_VIDEO_MIN_PX },
    { label: "Sound", minLeftWidthPx: AI_SHELL_LEFT_SOUND_MIN_PX },
    { label: "Character", minLeftWidthPx: AI_SHELL_LEFT_CHARACTER_MIN_PX },
  ] as const;

  it("uses full split mode when requested left and right rails both fit", () => {
    expect(
      resolveAiShellLayoutMode(1400, {
        enabled: true,
        isResizableViewport: true,
        minLeftWidthPx: 888,
        minRightWidthPx: AI_SHELL_RIGHT_MIN_PX,
      })
    ).toBe("split");
  });

  it("uses compact split mode when desktop minimums do not fit but both columns can remain usable", () => {
    expect(
      resolveAiShellLayoutMode(980, {
        enabled: true,
        isResizableViewport: true,
        minLeftWidthPx: 888,
        minRightWidthPx: AI_SHELL_RIGHT_MIN_PX,
      })
    ).toBe("compact-split");
  });

  it("moves wide left-rail panels into compact split at 125 percent style widths before the right rail clips", () => {
    expect(
      resolveAiShellLayoutMode(1320, {
        enabled: true,
        isResizableViewport: true,
        minLeftWidthPx: 920,
        minRightWidthPx: AI_SHELL_RIGHT_MIN_PX,
      })
    ).toBe("compact-split");
  });

  it("clamps left panel width down to preserve a zoom-safe right rail", () => {
    const bounds = getAiShellLeftWidthBounds(1320, {
      minLeftWidthPx: 920,
      minRightWidthPx: AI_SHELL_RIGHT_MIN_PX,
    });

    expect(bounds.min).toBe(1320 - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX);
  });

  it.each(primaryWorkflowMinimums)(
    "keeps $label from consuming the right rail at 125 percent style widths",
    ({ minLeftWidthPx }) => {
      const bounds = getAiShellLeftWidthBounds(zoomPressureWidthPx, {
        minLeftWidthPx,
        minRightWidthPx: AI_SHELL_RIGHT_MIN_PX,
      });

      expect(bounds.max).toBe(zoomPressureRightSafeLeftWidthPx);
      expect(bounds.min).toBe(Math.min(minLeftWidthPx, zoomPressureRightSafeLeftWidthPx));
      expect(bounds.max + AI_SHELL_RIGHT_MIN_PX + AI_SHELL_DIVIDER_TRACK_PX).toBe(
        zoomPressureWidthPx
      );
    }
  );

  it("stacks when even fallback left plus compact right rail cannot fit", () => {
    expect(
      resolveAiShellLayoutMode(AI_SHELL_LEFT_MIN_FALLBACK_PX + AI_SHELL_RIGHT_COMPACT_MIN_PX, {
        enabled: true,
        isResizableViewport: true,
        minLeftWidthPx: 888,
        minRightWidthPx: AI_SHELL_RIGHT_MIN_PX,
      })
    ).toBe("stacked");
  });

  it("uses stacked mode below the resize viewport and right-rail focus when no tool is selected", () => {
    expect(
      resolveAiShellLayoutMode(1400, {
        enabled: true,
        isResizableViewport: false,
      })
    ).toBe("stacked");
    expect(
      resolveAiShellLayoutMode(1400, {
        enabled: false,
        isResizableViewport: true,
      })
    ).toBe("right-rail-focus");
  });
});

describe("shouldCollapseAiShellOnToolSelect", () => {
  it("collapses when switching to video tool", () => {
    expect(shouldCollapseAiShellOnToolSelect(null, "edit")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("text", "video")).toBe(true);
    expect(shouldCollapseAiShellOnToolSelect("text", "character")).toBe(false);
  });

  it("does not collapse when re-selecting the same tool or choosing other tools", () => {
    expect(shouldCollapseAiShellOnToolSelect("edit", "edit")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("video", "video")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("text", "create")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("create", "create")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("character", "character")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("text", "create")).toBe(false);
    expect(shouldCollapseAiShellOnToolSelect("edit", null)).toBe(false);
  });
});

describe("shouldCollapseAiShellOnInitialSoundSelection", () => {
  it("collapses when entering the sound workspace from a non-sound tool", () => {
    expect(shouldCollapseAiShellOnInitialSoundSelection("create", "sound")).toBe(true);
    expect(shouldCollapseAiShellOnInitialSoundSelection("edit", "music")).toBe(true);
    expect(shouldCollapseAiShellOnInitialSoundSelection("video", "voice-changer")).toBe(true);
  });

  it("does not collapse when reselecting sound or switching inside the sound family", () => {
    expect(shouldCollapseAiShellOnInitialSoundSelection("sound", "sound")).toBe(false);
    expect(shouldCollapseAiShellOnInitialSoundSelection("sound", "music")).toBe(false);
    expect(shouldCollapseAiShellOnInitialSoundSelection("voices", "sound-effects")).toBe(false);
    expect(shouldCollapseAiShellOnInitialSoundSelection("sound", "edit")).toBe(false);
    expect(shouldCollapseAiShellOnInitialSoundSelection(null, null)).toBe(false);
  });
});

describe("shouldCollapseAiShellOnExpertEditPanelSelect", () => {
  it("collapses when entering the shared edit panel family from another panel", () => {
    expect(shouldCollapseAiShellOnExpertEditPanelSelect("create", "edit")).toBe(true);
    expect(shouldCollapseAiShellOnExpertEditPanelSelect("create", "image")).toBe(true);
    expect(shouldCollapseAiShellOnExpertEditPanelSelect(null, "image")).toBe(true);
  });

  it("does not collapse when reselecting or switching within the edit panel family", () => {
    expect(shouldCollapseAiShellOnExpertEditPanelSelect("edit", "edit")).toBe(false);
    expect(shouldCollapseAiShellOnExpertEditPanelSelect("edit", "image")).toBe(false);
    expect(shouldCollapseAiShellOnExpertEditPanelSelect("image", "edit")).toBe(false);
    expect(shouldCollapseAiShellOnExpertEditPanelSelect("image", "image")).toBe(false);
    expect(shouldCollapseAiShellOnExpertEditPanelSelect("video", "video")).toBe(false);
  });
});

describe("shouldExpandAiShellOnToolSelect", () => {
  it("expands when switching to create tool", () => {
    expect(shouldExpandAiShellOnToolSelect(null, "create")).toBe(true);
    expect(shouldExpandAiShellOnToolSelect("edit", "create")).toBe(true);
    expect(shouldExpandAiShellOnToolSelect("video", "create")).toBe(true);
  });

  it("does not expand when re-selecting create or choosing other tools", () => {
    expect(shouldExpandAiShellOnToolSelect("create", "create")).toBe(false);
    expect(shouldExpandAiShellOnToolSelect("edit", "edit")).toBe(false);
    expect(shouldExpandAiShellOnToolSelect("create", "video")).toBe(false);
    expect(shouldExpandAiShellOnToolSelect("create", null)).toBe(false);
  });
});

describe("resolveCreateShellResizeAction", () => {
  it("collapses when entering create in standard mode", () => {
    expect(
      resolveCreateShellResizeAction({
        previousTool: "edit",
        nextTool: "create",
        previousMode: "standard",
        nextMode: "standard",
        createModeEnabled: true,
      })
    ).toBe("collapse");
  });

  it("collapses when entering create in pulse mode", () => {
    expect(
      resolveCreateShellResizeAction({
        previousTool: "edit",
        nextTool: "create",
        previousMode: "standard",
        nextMode: "pulse",
        createModeEnabled: true,
      })
    ).toBe("collapse");
  });

  it("does not resize on pulse switch and collapses on standard switch while already in create", () => {
    expect(
      resolveCreateShellResizeAction({
        previousTool: "create",
        nextTool: "create",
        previousMode: "standard",
        nextMode: "pulse",
        createModeEnabled: true,
      })
    ).toBeNull();

    expect(
      resolveCreateShellResizeAction({
        previousTool: "create",
        nextTool: "create",
        previousMode: "pulse",
        nextMode: "standard",
        createModeEnabled: true,
      })
    ).toBe("collapse");
  });

  it("does nothing when create is inactive or nothing changed", () => {
    expect(
      resolveCreateShellResizeAction({
        previousTool: "create",
        nextTool: "create",
        previousMode: "standard",
        nextMode: "standard",
        createModeEnabled: true,
      })
    ).toBeNull();

    expect(
      resolveCreateShellResizeAction({
        previousTool: "edit",
        nextTool: "create",
        previousMode: "standard",
        nextMode: "pulse",
        createModeEnabled: false,
      })
    ).toBeNull();
  });
});

describe("shouldCollapseCreateOnSessionChange", () => {
  it("collapses when a new Create session starts", () => {
    expect(
      shouldCollapseCreateOnSessionChange({
        previousSessionId: "session-1",
        nextSessionId: "session-2",
        nextTool: "create",
        nextMode: "standard",
        createModeEnabled: true,
      })
    ).toBe(true);

    expect(
      shouldCollapseCreateOnSessionChange({
        previousSessionId: "session-1",
        nextSessionId: "session-2",
        nextTool: "create",
        nextMode: "pulse",
        createModeEnabled: true,
      })
    ).toBe(true);
  });

  it("does not collapse when the session is unchanged or create is inactive", () => {
    expect(
      shouldCollapseCreateOnSessionChange({
        previousSessionId: "session-1",
        nextSessionId: "session-1",
        nextTool: "create",
        nextMode: "standard",
        createModeEnabled: true,
      })
    ).toBe(false);

    expect(
      shouldCollapseCreateOnSessionChange({
        previousSessionId: "session-1",
        nextSessionId: "session-2",
        nextTool: "edit",
        nextMode: "standard",
        createModeEnabled: true,
      })
    ).toBe(false);

    expect(
      shouldCollapseCreateOnSessionChange({
        previousSessionId: "session-1",
        nextSessionId: "session-2",
        nextTool: "create",
        nextMode: "standard",
        createModeEnabled: false,
      })
    ).toBe(false);
  });
});
