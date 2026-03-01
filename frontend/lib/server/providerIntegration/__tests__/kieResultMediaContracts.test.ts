/**
 * Unit coverage for Kie model-aware result media extraction contracts.
 */

import { describe, expect, it } from "vitest";
import {
  extractKieResultMediaUrls,
  isSupportedKieResultMediaModel,
} from "../kieResultMediaContracts";

describe("kieResultMediaContracts", () => {
  it("tracks supported Kie media models", () => {
    expect(isSupportedKieResultMediaModel("kie-ai/veo-3.1-fast-i2v")).toBe(true);
    expect(isSupportedKieResultMediaModel("kie-ai/kling-3.0")).toBe(true);
    expect(isSupportedKieResultMediaModel("kie-ai/unknown")).toBe(false);
  });

  it("extracts model-aware media URLs for Kie VEO i2v payloads", () => {
    const urls = extractKieResultMediaUrls({
      modelId: "kie-ai/veo-3.1-fast-i2v",
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
      modelId: "kie-ai/kling-3.0",
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
