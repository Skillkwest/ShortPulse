import { afterEach, describe, expect, it, vi } from "vitest";

const importFlags = async () => {
  vi.resetModules();
  return import("../flags");
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("adaptive-media flags", () => {
  it("includes the canonical adaptive surfaces by default", async () => {
    const { isAdaptiveSurfaceEnabled } = await importFlags();

    expect(isAdaptiveSurfaceEnabled("reference-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("quick-slot")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-modal-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-panel-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("character-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("detail-modal")).toBe(true);
  });

  it("treats empty surface csv as the canonical adaptive surface set", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES", "   ");
    const { isAdaptiveSurfaceEnabled } = await importFlags();

    expect(isAdaptiveSurfaceEnabled("reference-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("quick-slot")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-modal-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-panel-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("character-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("detail-modal")).toBe(true);
  });

  it("respects explicit surface allowlist overrides", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES", "reference-grid");
    const { isAdaptiveSurfaceEnabled } = await importFlags();

    expect(isAdaptiveSurfaceEnabled("reference-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("quick-slot")).toBe(false);
    expect(isAdaptiveSurfaceEnabled("media-library-grid")).toBe(false);
    expect(isAdaptiveSurfaceEnabled("media-library-modal-grid")).toBe(false);
    expect(isAdaptiveSurfaceEnabled("media-library-panel-grid")).toBe(false);
  });
});
