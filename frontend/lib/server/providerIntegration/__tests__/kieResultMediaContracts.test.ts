/**
 * Unit coverage for Kie model-aware result media extraction contracts.
 */

import { describe, expect, it } from "vitest";
import {
  extractKieResultMediaUrls,
  isSupportedKieResultMediaModel,
} from "../kieResultMediaContracts";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "../kieModelIds";

describe("kieResultMediaContracts", () => {
  it("tracks supported Kie media models", () => {
    expect(isSupportedKieResultMediaModel(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(true);
    expect(isSupportedKieResultMediaModel(KIE_KLING_30_MODEL_ID)).toBe(true);
    expect(isSupportedKieResultMediaModel("kie-ai/unknown")).toBe(false);
  });

  it("extracts model-aware media URLs for Kie VEO i2v payloads", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      payload: {
        result: {
          videos: [{ url: "https://cdn.shortpulse.test/veo.mp4" }],
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/veo.mp4"]);
  });

  it("extracts model-aware media URLs for Kie Kling payloads", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: {
        output: {
          outputs: [{ download_url: "https://cdn.shortpulse.test/kling.mp4" }],
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/kling.mp4"]);
  });

  it("fails closed to empty list for unsupported models", () => {
    const urls = extractKieResultMediaUrls({
      modelId: "kie-ai/unknown",
      payload: {
        videos: [{ url: "https://cdn.shortpulse.test/unknown.mp4" }],
      },
    });
    expect(urls).toEqual([]);
  });
});
