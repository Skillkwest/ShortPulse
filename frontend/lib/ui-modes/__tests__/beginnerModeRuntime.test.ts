import { describe, expect, it } from "vitest";

describe("beginnerModeRuntime", () => {
  it("keeps beginner mode retired from the live runtime", async () => {
    const mod = await import("../beginnerModeRuntime");

    expect(mod.BEGINNER_MODE_FORCE_OFF).toBe(true);
    expect(mod.BEGINNER_MODE_TOGGLE_VISIBLE).toBe(false);
    expect(mod.resolveEffectiveBeginnerMode(true)).toBe(false);
    expect(mod.resolveEffectiveBeginnerMode(false)).toBe(false);
    expect(mod.isBeginnerModeToggleVisible()).toBe(false);
  });
});
