/**
 * Runtime-policy tests for beginner-mode force-off/toggle visibility precedence.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const restoreEnv = () => {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, ORIGINAL_ENV);
};

describe("beginnerModeRuntime", () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it("defaults to force-off=true and toggle-visible=false when flags are unset", async () => {
    delete process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF;
    delete process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE;

    const mod = await import("../beginnerModeRuntime");

    expect(mod.BEGINNER_MODE_FORCE_OFF).toBe(true);
    expect(mod.BEGINNER_MODE_TOGGLE_VISIBLE).toBe(false);
    expect(mod.resolveEffectiveBeginnerMode(true)).toBe(false);
    expect(mod.isBeginnerModeToggleVisible()).toBe(false);
  });

  it("allows explicit toggle visibility only when force-off is disabled", async () => {
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF = "false";
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE = "true";

    const mod = await import("../beginnerModeRuntime");

    expect(mod.BEGINNER_MODE_FORCE_OFF).toBe(false);
    expect(mod.BEGINNER_MODE_TOGGLE_VISIBLE).toBe(true);
    expect(mod.resolveEffectiveBeginnerMode(true)).toBe(true);
    expect(mod.isBeginnerModeToggleVisible()).toBe(true);
  });

  it("enforces force-off precedence over toggle visibility", async () => {
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF = "true";
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE = "true";

    const mod = await import("../beginnerModeRuntime");

    expect(mod.BEGINNER_MODE_FORCE_OFF).toBe(true);
    expect(mod.BEGINNER_MODE_TOGGLE_VISIBLE).toBe(true);
    expect(mod.resolveEffectiveBeginnerMode(true)).toBe(false);
    expect(mod.isBeginnerModeToggleVisible()).toBe(false);
  });

  it("falls back to defaults for invalid flag values", async () => {
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF = "invalid";
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE = "invalid";

    const mod = await import("../beginnerModeRuntime");

    expect(mod.BEGINNER_MODE_FORCE_OFF).toBe(true);
    expect(mod.BEGINNER_MODE_TOGGLE_VISIBLE).toBe(false);
    expect(mod.isBeginnerModeToggleVisible()).toBe(false);
  });
});
