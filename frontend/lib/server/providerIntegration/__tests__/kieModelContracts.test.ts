/**
 * Unit coverage for Kie model-contract payload validation/normalization.
 */

import { describe, expect, it } from "vitest";
import {
  assertSupportedKieModelId,
  isSupportedKieModelId,
  normalizeKieSubmitPayloadForModel,
} from "../kieModelContracts";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "../kieModelIds";

describe("kieModelContracts", () => {
  it("tracks supported Kie model ids", () => {
    expect(isSupportedKieModelId(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(true);
    expect(isSupportedKieModelId(KIE_KLING_30_MODEL_ID)).toBe(true);
    expect(isSupportedKieModelId("kie-ai/unknown")).toBe(false);
  });

  it("fails closed for unsupported Kie model ids", () => {
    expect(() => assertSupportedKieModelId("kie-ai/unknown")).toThrow(
      "Unsupported Kie model contract: kie-ai/unknown"
    );
  });

  it("normalizes VEO i2v payload and enforces required contract fields", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "make a short clip",
          image_urls: ["https://example.com/ref.png"],
          aspect: "16:9",
          duration: "5",
        },
      })
    ).toEqual(
      expect.objectContaining({
        prompt: "make a short clip",
        image_url: "https://example.com/ref.png",
        aspect_ratio: "16:9",
        duration: 5,
        duration_seconds: 5,
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: { image_url: "https://example.com/ref.png" },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit requires a prompt.");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: { prompt: "missing image" },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit requires an image URL.");
  });

  it("normalizes VEO i2v optional fields to valid contract values", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
        },
      })
    ).toEqual(
      expect.objectContaining({
        aspect_ratio: "16:9",
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          aspect_ratio: "1:1",
        },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit uses unsupported aspect ratio");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          duration: 10,
        },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit uses unsupported duration");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          resolution: "4k",
        },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit uses unsupported resolution");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          generate_audio: "yes",
        } as unknown as Record<string, unknown>,
      })
    ).toThrow('Kie VEO 3.1 Fast I2V submit field "generate_audio" must be boolean');
  });

  it("normalizes Kling payload and requires prompt", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
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
        duration: 10,
        duration_seconds: 10,
        resolution: "1080p",
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: { duration: 10 },
      })
    ).toThrow("Kie Kling 3.0 submit requires a prompt.");
  });

  it("enforces Kling optional field contracts", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          duration: "10",
          cfg_scale: "0.6",
        },
      })
    ).toEqual(
      expect.objectContaining({
        aspect_ratio: "16:9",
        duration: 10,
        duration_seconds: 10,
        cfg_scale: 0.6,
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          aspect_ratio: "4:3",
        },
      })
    ).toThrow("Kie Kling 3.0 submit uses unsupported aspect ratio");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          duration: 8,
        },
      })
    ).toThrow("Kie Kling 3.0 submit uses unsupported duration");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          cfg_scale: "high",
        },
      })
    ).toThrow('Kie Kling 3.0 submit field "cfg_scale" must be numeric');

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          generate_audio: "yes",
        } as unknown as Record<string, unknown>,
      })
    ).toThrow('Kie Kling 3.0 submit field "generate_audio" must be boolean');
  });
});
