/**
 * Unit coverage for Kie model-contract payload validation/normalization.
 */

import { describe, expect, it } from "vitest";
import {
  assertSupportedKieModelId,
  isSupportedKieModelId,
  normalizeKieSubmitPayloadForModel,
} from "../kieModelContracts";

describe("kieModelContracts", () => {
  it("tracks supported Kie model ids", () => {
    expect(isSupportedKieModelId("kie-ai/veo-3.1-fast-i2v")).toBe(true);
    expect(isSupportedKieModelId("kie-ai/kling-3.0")).toBe(true);
    expect(isSupportedKieModelId("kie-ai/unknown")).toBe(false);
  });

  it("fails closed for unsupported Kie model ids", () => {
    expect(() => assertSupportedKieModelId("kie-ai/unknown")).toThrow(
      "Unsupported Kie model contract: kie-ai/unknown"
    );
  });

  it("normalizes VEO i2v payload and requires image url", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: {
          prompt: "make a short clip",
          image_urls: ["https://example.com/ref.png"],
          aspect: "16:9",
          duration: "5",
        },
      })
    ).toEqual(
      expect.objectContaining({
        image_url: "https://example.com/ref.png",
        aspect_ratio: "16:9",
        duration_seconds: 5,
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { prompt: "missing image" },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit requires an image URL.");
  });

  it("normalizes Kling payload and requires prompt", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: "kie-ai/kling-3.0",
        payload: {
          prompt: "a cinematic pan shot",
          aspect: "9:16",
          duration: 10,
          resolution: "1080p",
        },
      })
    ).toEqual(
      expect.objectContaining({
        prompt: "a cinematic pan shot",
        aspect_ratio: "9:16",
        duration_seconds: 10,
        resolution: "1080p",
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: "kie-ai/kling-3.0",
        payload: { duration: 10 },
      })
    ).toThrow("Kie Kling 3.0 submit requires a prompt.");
  });
});
