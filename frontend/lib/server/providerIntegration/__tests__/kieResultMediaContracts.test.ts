/**
 * Unit coverage for Kie model-aware result media extraction contracts.
 */

import { describe, expect, it } from "vitest";
import {
  extractKieResultMediaUrls,
  isSupportedKieResultMediaModel,
} from "../kieResultMediaContracts";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "../kieModelIds";
import { kieKlingCallbackSuccessFixture } from "./fixtures/kieContractFixtures";

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

  it("extracts media URLs from callback-style resultJson payloads", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: {
        data: {
          resultJson: JSON.stringify({
            resultUrls: ["https://cdn.shortpulse.test/kling-callback.mp4"],
          }),
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/kling-callback.mp4"]);
  });

  it("extracts media URLs from primary-source callback fixture resultJson", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: kieKlingCallbackSuccessFixture,
    });
    expect(urls).toEqual(["https://example.com/generated-video.mp4"]);
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
