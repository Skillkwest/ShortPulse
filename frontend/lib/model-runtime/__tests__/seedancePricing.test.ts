import { describe, expect, it } from "vitest";
import { computeCostForModel } from "../pricing";

describe("Seedance runtime pricing", () => {
  it("uses Kie's live Seedance 2 base per-second table", () => {
    const breakdown1080 = computeCostForModel("kie-ai/seedance-2", {
      durationSeconds: 5,
      resolution: "1080p",
      inputVideoCount: 0,
    });
    const breakdown720 = computeCostForModel("kie-ai/seedance-2", {
      durationSeconds: 5,
      resolution: "720p",
      inputVideoCount: 0,
    });
    const breakdown480 = computeCostForModel("kie-ai/seedance-2", {
      durationSeconds: 5,
      resolution: "480p",
      inputVideoCount: 0,
    });

    expect(breakdown1080?.usdRaw).toBeCloseTo(2.55, 6);
    expect(breakdown720?.usdRaw).toBeCloseTo(1.025, 6);
    expect(breakdown480?.usdRaw).toBeCloseTo(0.475, 6);
  });

  it("uses Kie's Seedance 2 input-plus-output formula when video input is present", () => {
    const breakdown1080 = computeCostForModel("kie-ai/seedance-2", {
      durationSeconds: 5,
      resolution: "1080p",
      inputVideoCount: 1,
      inputVideoDurationSeconds: 1,
    });
    const breakdown720 = computeCostForModel("kie-ai/seedance-2", {
      durationSeconds: 5,
      resolution: "720p",
      inputVideoCount: 1,
      inputVideoDurationSeconds: 4,
    });
    const breakdown480 = computeCostForModel("kie-ai/seedance-2", {
      durationSeconds: 5,
      resolution: "480p",
      inputVideoCount: 1,
      inputVideoDurationSeconds: 10,
    });

    expect(breakdown1080?.usdRaw).toBeCloseTo(1.86, 6);
    expect(breakdown720?.usdRaw).toBeCloseTo(1.125, 6);
    expect(breakdown480?.usdRaw).toBeCloseTo(0.8625, 6);
  });

  it("fails closed when Seedance video input has no input duration", () => {
    expect(
      computeCostForModel("kie-ai/seedance-2", {
        durationSeconds: 5,
        resolution: "1080p",
        inputVideoCount: 1,
      })
    ).toBeNull();
  });

  it("keeps intermediate Seedance durations linear instead of snapping them to 5/10/15", () => {
    const breakdown12 = computeCostForModel("kie-ai/seedance-2", {
      durationSeconds: 12,
      resolution: "1080p",
      inputVideoCount: 0,
    });

    expect(breakdown12?.usdRaw).toBeCloseTo(6.12, 6);
  });

  it("uses Kie's Seedance 2 Fast input-plus-output formula when video input is present", () => {
    const breakdown720NoInput = computeCostForModel("kie-ai/seedance-2-fast", {
      durationSeconds: 5,
      resolution: "720p",
      inputVideoCount: 0,
    });
    const breakdown720WithInput = computeCostForModel("kie-ai/seedance-2-fast", {
      durationSeconds: 5,
      resolution: "720p",
      inputVideoCount: 1,
      inputVideoDurationSeconds: 1,
    });
    const breakdown480NoInput = computeCostForModel("kie-ai/seedance-2-fast", {
      durationSeconds: 5,
      resolution: "480p",
      inputVideoCount: 0,
    });
    const breakdown480WithInput = computeCostForModel("kie-ai/seedance-2-fast", {
      durationSeconds: 5,
      resolution: "480p",
      inputVideoCount: 1,
      inputVideoDurationSeconds: 10,
    });

    expect(breakdown720NoInput?.usdRaw).toBeCloseTo(0.825, 6);
    expect(breakdown720WithInput?.usdRaw).toBeCloseTo(0.6, 6);
    expect(breakdown480NoInput?.usdRaw).toBeCloseTo(0.3875, 6);
    expect(breakdown480WithInput?.usdRaw).toBeCloseTo(0.675, 6);
  });
});
