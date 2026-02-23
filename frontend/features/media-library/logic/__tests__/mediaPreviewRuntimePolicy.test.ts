import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canAttemptMediaPreviewSignBatch,
  canRetryMediaPreviewSignedUrl,
  resolveMediaPreviewSignBudget,
  type MediaSignBudgetProfile,
} from "../../../../lib/mediaPreviewRuntimePolicy";

const profile: MediaSignBudgetProfile = {
  desktop: { initialSignLimit: 12, prefetchWindow: 24, signBatchSize: 10 },
  smallScreen: { initialSignLimit: 8, prefetchWindow: 16, signBatchSize: 6 },
  constrained: { initialSignLimit: 5, prefetchWindow: 10, signBatchSize: 4 },
  smallScreenQuery: "(max-width: 900px)",
};

describe("mediaPreviewRuntimePolicy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses desktop sign budget when browser globals are unavailable", () => {
    expect(resolveMediaPreviewSignBudget(profile)).toEqual(profile.desktop);
  });

  it("uses constrained budget on data saver connections", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: false })),
    });
    vi.stubGlobal("navigator", {
      connection: { saveData: true, effectiveType: "4g" },
      deviceMemory: 8,
    });

    expect(resolveMediaPreviewSignBudget(profile)).toEqual(profile.constrained);
  });

  it("uses small-screen budget when no constrained flags are present", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: true })),
    });
    vi.stubGlobal("navigator", {
      connection: { saveData: false, effectiveType: "4g" },
      deviceMemory: 8,
    });

    expect(resolveMediaPreviewSignBudget(profile)).toEqual(profile.smallScreen);
  });

  it("enforces shared retry caps", () => {
    expect(canRetryMediaPreviewSignedUrl(0)).toBe(true);
    expect(canRetryMediaPreviewSignedUrl(2)).toBe(true);
    expect(canRetryMediaPreviewSignedUrl(3)).toBe(false);

    expect(canAttemptMediaPreviewSignBatch(0)).toBe(true);
    expect(canAttemptMediaPreviewSignBatch(2)).toBe(true);
    expect(canAttemptMediaPreviewSignBatch(3)).toBe(false);
  });
});
