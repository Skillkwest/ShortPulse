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

  it("allows media-library panel grids to request smaller tuned previews", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "true");
    const { resolveAdaptivePolicyDecision } = await importPolicy();

    const panelDecision = resolveAdaptivePolicyDecision({
      surface: "media-library-panel-grid",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 1,
      cardLongEdgePx: 188,
      devicePixelRatio: 1,
      adaptivePreviewQuality: true,
    });
    const modalDecision = resolveAdaptivePolicyDecision({
      surface: "media-library-modal-grid",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 1,
      cardLongEdgePx: 188,
      devicePixelRatio: 1,
      adaptivePreviewQuality: true,
    });

    expect(panelDecision.targetLongEdgePx).toBe(240);
    expect(modalDecision.targetLongEdgePx).toBe(320);
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

  it("applies heavy-load long-edge compaction only at pressure level 2 for reference surfaces", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "false");
    vi.stubEnv("NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION", "true");
    const { resolveAdaptivePolicyDecision } = await importPolicy();

    const level2ReferenceGrid = resolveAdaptivePolicyDecision({
      surface: "reference-grid",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 2,
      adaptivePreviewQuality: true,
    });
    const level2QuickSlot = resolveAdaptivePolicyDecision({
      surface: "quick-slot",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 2,
      adaptivePreviewQuality: true,
    });

    expect(level2ReferenceGrid.targetLongEdgePx).toBe(385);
    expect(level2QuickSlot.targetLongEdgePx).toBe(346);
    expect(level2ReferenceGrid.qualityParam).toBe(34);
    expect(level2QuickSlot.qualityParam).toBe(34);
  });

  it("does not apply heavy-load compaction below pressure level 2", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "false");
    vi.stubEnv("NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION", "true");
    const { resolveAdaptivePolicyDecision } = await importPolicy();

    const level1Decision = resolveAdaptivePolicyDecision({
      surface: "reference-grid",
      mediaKind: "image",
      source: "remote",
      urls: {},
      storage: {},
      pressureLevel: 1,
      adaptivePreviewQuality: true,
    });

    expect(level1Decision.targetLongEdgePx).toBe(512);
  });
});
