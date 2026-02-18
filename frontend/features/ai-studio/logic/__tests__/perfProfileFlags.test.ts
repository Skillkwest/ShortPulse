import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const restoreEnv = () => {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, ORIGINAL_ENV);
};

describe("perfProfileFlags", () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it("defaults to stable profile when profile env is missing", async () => {
    delete process.env.NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE;
    delete process.env.NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP;
    delete process.env.NEXT_PUBLIC_REFERENCE_GRID_UPDATE_BACKPRESSURE;
    delete process.env.NEXT_PUBLIC_REFERENCE_GRID_CURATED_SPLIT;

    const mod = await import("../perfProfileFlags");

    expect(mod.AI_STUDIO_PERF_PROFILE).toBe("stable");
    expect(mod.PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP).toBe(true);
    expect(mod.PERF_FLAG_REFERENCE_GRID_UPDATE_BACKPRESSURE).toBe(true);
    expect(mod.PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT).toBe(true);
  });

  it("supports legacy fallback profile defaults", async () => {
    process.env.NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE = "legacy";
    delete process.env.NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP;
    delete process.env.NEXT_PUBLIC_REFERENCE_GRID_UPDATE_BACKPRESSURE;
    delete process.env.NEXT_PUBLIC_REFERENCE_GRID_CURATED_SPLIT;

    const mod = await import("../perfProfileFlags");

    expect(mod.AI_STUDIO_PERF_PROFILE).toBe("legacy");
    expect(mod.PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP).toBe(false);
    expect(mod.PERF_FLAG_REFERENCE_GRID_UPDATE_BACKPRESSURE).toBe(false);
    expect(mod.PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT).toBe(true);
  });

  it("lets explicit env flags override profile defaults", async () => {
    process.env.NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE = "stable";
    process.env.NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP = "false";
    process.env.NEXT_PUBLIC_REFERENCE_GRID_CURATED_SPLIT = "false";

    const mod = await import("../perfProfileFlags");

    expect(mod.AI_STUDIO_PERF_PROFILE).toBe("stable");
    expect(mod.PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP).toBe(false);
    expect(mod.PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT).toBe(false);
  });

  it("falls back to stable when profile value is invalid", async () => {
    process.env.NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE = "unknown-profile";
    delete process.env.NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP;

    const mod = await import("../perfProfileFlags");

    expect(mod.AI_STUDIO_PERF_PROFILE).toBe("stable");
    expect(mod.PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP).toBe(true);
  });
});
