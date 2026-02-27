/**
 * Unit coverage for provider-aware status topology resolution.
 */

import { describe, expect, it } from "vitest";
import {
  resolveProviderConfiguredStatusBaseUrls,
  resolveProviderModelStatusBaseUrls,
  resolveProviderModelStatusTimeoutMs,
  resolveProviderResponseProbeUrls,
} from "../statusProviderTopology";

describe("statusProviderTopology", () => {
  it("filters configured Fal base URLs by trust policy", () => {
    const bases = resolveProviderConfiguredStatusBaseUrls({
      provider: "fal",
      configuredBaseUrls: [
        "https://queue.fal.run/fal-ai/model/requests",
        "https://malicious.example.com/fal/requests",
      ],
    });

    expect(bases).toEqual(["https://queue.fal.run/fal-ai/model/requests"]);
  });

  it("resolves Fal model profile status bases", () => {
    const bases = resolveProviderModelStatusBaseUrls({
      provider: "fal",
      modelId: "fal-ai/nano-banana-pro",
    });

    expect(bases).toEqual(["https://queue.fal.run/fal-ai/nano-banana-pro/requests"]);
  });

  it("filters Fal response probe URLs with trust policy", () => {
    const urls = resolveProviderResponseProbeUrls({
      provider: "fal",
      responseUrls: [
        "https://queue.fal.run/fal-ai/model/requests/req-1",
        "https://malicious.example.com/req-1",
      ],
    });
    expect(urls).toEqual(["https://queue.fal.run/fal-ai/model/requests/req-1"]);
  });

  it("falls back to canonical Fal queue base when model profile is absent", () => {
    const modelId = "fal-ai/custom-unknown-model";
    const bases = resolveProviderModelStatusBaseUrls({
      provider: "fal",
      modelId,
    });

    expect(bases).toEqual([`https://queue.fal.run/${modelId}/requests`]);
  });

  it("resolves Fal model timeout from profile and fallback default", () => {
    expect(
      resolveProviderModelStatusTimeoutMs({
        provider: "fal",
        modelId: "fal-ai/veo3.1/image-to-video",
      })
    ).toBe(90000);

    expect(
      resolveProviderModelStatusTimeoutMs({
        provider: "fal",
        modelId: "fal-ai/custom-unknown-model",
        defaultTimeoutMs: 12345,
      })
    ).toBe(12345);
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      resolveProviderConfiguredStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
      })
    ).toThrow("Unsupported provider for status base resolution");

    expect(() =>
      resolveProviderModelStatusBaseUrls({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Unsupported provider for model status base resolution");

    expect(() =>
      resolveProviderModelStatusTimeoutMs({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Unsupported provider for model status timeout resolution");

    expect(() =>
      resolveProviderResponseProbeUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/1"],
      })
    ).toThrow("Unsupported provider for response probe URL resolution");
  });
});
