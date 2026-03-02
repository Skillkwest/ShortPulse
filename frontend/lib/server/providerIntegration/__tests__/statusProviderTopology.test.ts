/**
 * Unit coverage for provider-aware status topology resolution.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  resolveProviderConfiguredStatusBaseUrls,
  resolveProviderModelStatusBaseUrls,
  resolveProviderModelStatusTimeoutMs,
  resolveProviderResponseProbeUrls,
} from "../statusProviderTopology";

const ORIGINAL_ENV = { ...process.env };

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

  it("fails closed for kie while dark path is disabled", () => {
    expect(() =>
      resolveProviderConfiguredStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie provider is disabled by runtime flag.");

    expect(() =>
      resolveProviderModelStatusBaseUrls({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie provider is disabled by runtime flag.");

    expect(() =>
      resolveProviderModelStatusTimeoutMs({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie provider is disabled by runtime flag.");

    expect(() =>
      resolveProviderResponseProbeUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/1"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie provider is disabled by runtime flag.");
  });

  it("resolves kie topology when dark path is enabled", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_STATUS_BASE_URLS = "https://queue.kie.ai/v1/requests";
    process.env.SHORTPULSE_KIE_STATUS_TIMEOUT_MS = "45000";

    expect(
      resolveProviderConfiguredStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://queue.kie.ai/v1/requests"]);

    expect(
      resolveProviderModelStatusBaseUrls({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://queue.kie.ai/v1/requests"]);

    expect(
      resolveProviderModelStatusTimeoutMs({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toBe(45000);

    expect(
      resolveProviderResponseProbeUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/1"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://queue.kie.ai/v1/requests/1"]);
  });

  it("falls back to model-catalog kie topology when env urls are not configured", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v,kie-ai/kling-3.0";
    delete process.env.SHORTPULSE_KIE_STATUS_BASE_URLS;
    delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;
    delete process.env.SHORTPULSE_KIE_STATUS_TIMEOUT_MS;

    expect(
      resolveProviderModelStatusBaseUrls({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}"]);
    expect(
      resolveProviderModelStatusBaseUrls({
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
      })
    ).toEqual(["https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}"]);
    expect(
      resolveProviderModelStatusTimeoutMs({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toBe(60000);
  });

  it("resolves kie status base templates with {requestId} tokens", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_STATUS_BASE_URLS =
      "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}";

    expect(
      resolveProviderConfiguredStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}"]);

    expect(
      resolveProviderModelStatusBaseUrls({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}"]);
  });

  it("fails closed for kie status topology when model id is missing", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";

    expect(() =>
      resolveProviderConfiguredStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
      })
    ).toThrow("Kie status base resolution requires modelId.");

    expect(() =>
      resolveProviderResponseProbeUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/1"],
      })
    ).toThrow("Kie response probe URL resolution requires modelId.");
  });

  it("fails closed for kie status topology when model is not allowlisted", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";

    expect(() =>
      resolveProviderConfiguredStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
        modelId: "kie-ai/kling-3.0",
      })
    ).toThrow("Kie model is not allowlisted");

    expect(() =>
      resolveProviderResponseProbeUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/1"],
        modelId: "kie-ai/kling-3.0",
      })
    ).toThrow("Kie model is not allowlisted");
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      resolveProviderConfiguredStatusBaseUrls({
        provider: "openai",
        configuredBaseUrls: ["https://api.openai.com/v1/responses"],
      })
    ).toThrow("Unsupported provider for status base resolution");
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
});
