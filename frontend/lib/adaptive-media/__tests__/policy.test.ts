import { afterEach, describe, expect, it, vi } from "vitest";

const importPolicy = async () => {
  vi.resetModules();
  return import("../policy");
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("adaptive-media policy", () => {
  it("keeps parity quality targets when tuned policy is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "false");
    const { resolveAdaptivePolicyDecision } = await importPolicy();

    const decision = resolveAdaptivePolicyDecision({
      surface: "reference-grid",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 0,
      cardLongEdgePx: 420,
      devicePixelRatio: 2,
      adaptivePreviewQuality: true,
    });

    expect(decision.qualityBand).toBe("high");
    expect(decision.qualityParam).toBe(40);
    expect(decision.targetLongEdgePx).toBe(640);
    expect(decision.localTranscodeQuality).toBeCloseTo(0.42, 4);
  });

  it("uses DPR-aware card sizing in tuned policy mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "true");
    const { resolveAdaptivePolicyDecision } = await importPolicy();

    const decision = resolveAdaptivePolicyDecision({
      surface: "media-library-grid",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 1,
      cardLongEdgePx: 300,
      devicePixelRatio: 2,
      adaptivePreviewQuality: true,
    });

    expect(decision.qualityBand).toBe("balanced");
    expect(decision.qualityParam).toBe(60);
    expect(decision.targetLongEdgePx).toBe(600);
    expect(decision.localTranscodeQuality).toBeCloseTo(0.72, 4);
  });

  it("disables adaptation for detail surfaces", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "true");
    const { resolveAdaptivePolicyDecision } = await importPolicy();

    const decision = resolveAdaptivePolicyDecision({
      surface: "detail-modal",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 0,
      adaptivePreviewQuality: true,
    });

    expect(decision.adaptationEnabled).toBe(false);
    expect(decision.allowTranscodeLocal).toBe(false);
  });
});
