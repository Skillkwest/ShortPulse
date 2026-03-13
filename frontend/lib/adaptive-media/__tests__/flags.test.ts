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
  it("includes media-library panel surfaces in default fallback allowlist", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED", "true");
    const { isAdaptiveSurfaceEnabled } = await importFlags();

    expect(isAdaptiveSurfaceEnabled("reference-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-modal-grid")).toBe(true);
  });

  it("treats empty surface csv as default fallback surfaces", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES", "   ");
    const { isAdaptiveSurfaceEnabled } = await importFlags();

    expect(isAdaptiveSurfaceEnabled("media-library-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-modal-grid")).toBe(true);
  });

  it("respects explicit surface allowlist overrides", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES", "reference-grid");
    const { isAdaptiveSurfaceEnabled } = await importFlags();

    expect(isAdaptiveSurfaceEnabled("reference-grid")).toBe(true);
    expect(isAdaptiveSurfaceEnabled("media-library-grid")).toBe(false);
    expect(isAdaptiveSurfaceEnabled("media-library-modal-grid")).toBe(false);
  });
});
