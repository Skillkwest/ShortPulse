/**
 * Unit coverage for provider runtime config guards.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  assertKieRuntimeEnabledForModel,
  filterTrustedKieProviderUrls,
  readKieRuntimeFlags,
  readProviderApiKey,
  resolveKieStatusBaseUrlsForModel,
  resolveKieStatusTimeoutMsForModel,
  resolveKieSubmitTargetsForModel,
  resolveProviderFromGenerationContext,
  resolveProviderFromModelId,
} from "../providerRuntimeConfig";

const ORIGINAL_ENV = { ...process.env };

describe("providerRuntimeConfig", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults kie runtime to disabled", () => {
    delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
    const flags = readKieRuntimeFlags();
    expect(flags.enabled).toBe(false);
    expect(flags.trustedHosts).toEqual(["kie.ai"]);
  });

  it("enforces kie dark-path enablement and allowlist checks", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).not.toThrow();

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/kling-3.0",
      })
    ).not.toThrow();

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/seedance-1.5-pro",
      })
    ).not.toThrow();
    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/seedance-2",
      })
    ).not.toThrow();
    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/seedance-2-fast",
      })
    ).not.toThrow();
  });

  it("normalizes and filters invalid kie allowlist entries", () => {
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST =
      " KIE-AI/VEO-3.1-FAST-I2V , fal-ai/veo3.1, *, bad-prefix/*, kie-ai/*, kie-ai/not-real*, kie-ai/veo* ";
    const flags = readKieRuntimeFlags();
    expect([...flags.modelAllowlist]).toEqual(["kie-ai/veo-3.1-fast-i2v", "*", "kie-ai/veo*"]);
  });

  it("fails closed when kie enable flag is on without an explicit model allowlist", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie model is not allowlisted");

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/kling-3.0",
      })
    ).not.toThrow();

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/seedance-1.5-pro",
      })
    ).not.toThrow();
    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/seedance-2",
      })
    ).not.toThrow();
    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/seedance-2-fast",
      })
    ).not.toThrow();
  });

  it("fails closed when kie allowlist contains only invalid entries", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "fal-ai/veo3.1, other/*";

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie model is not allowlisted");
  });

  it("filters untrusted kie hosts", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";

    expect(
      filterTrustedKieProviderUrls([
        "https://queue.kie.ai/v1/requests",
        "https://evil.example.com/v1/requests",
      ])
    ).toEqual(["https://queue.kie.ai/v1/requests"]);
  });

  it("accepts trusted kie status url templates with {requestId}", () => {
    process.env.SHORTPULSE_KIE_STATUS_BASE_URLS =
      "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    const flags = readKieRuntimeFlags();

    expect(flags.statusBaseUrls).toEqual([
      "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
    ]);
    expect(filterTrustedKieProviderUrls(flags.statusBaseUrls, flags)).toEqual([
      "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
    ]);
  });

  it("rejects kie status url templates when {requestId} appears in hostname", () => {
    process.env.SHORTPULSE_KIE_STATUS_BASE_URLS =
      "https://{requestId}.kie.ai/api/v1/jobs/recordInfo";
    const flags = readKieRuntimeFlags();
    expect(flags.statusBaseUrls).toEqual([]);
  });

  it("keeps {requestId} templates out of submit target resolution", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_SUBMIT_URLS =
      "https://api.kie.ai/api/v1/veo/generate?taskId={requestId},https://api.kie.ai/api/v1/veo/generate";

    const targets = resolveKieSubmitTargetsForModel("kie-ai/veo-3.1-fast-i2v");
    expect(targets).toEqual([{ submitUrl: "https://api.kie.ai/api/v1/veo/generate" }]);
  });

  it("falls back to model-catalog submit/status topology when env urls are unset", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v,kie-ai/kling-3.0";
    delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;
    delete process.env.SHORTPULSE_KIE_STATUS_BASE_URLS;

    expect(resolveKieSubmitTargetsForModel("kie-ai/veo-3.1-fast-i2v")).toEqual([
      { submitUrl: "https://api.kie.ai/api/v1/veo/generate" },
    ]);
    expect(resolveKieStatusBaseUrlsForModel("kie-ai/veo-3.1-fast-i2v")).toEqual([
      "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
    ]);
    expect(resolveKieSubmitTargetsForModel("kie-ai/kling-3.0")).toEqual([
      { submitUrl: "https://api.kie.ai/api/v1/jobs/createTask" },
    ]);
    expect(resolveKieStatusBaseUrlsForModel("kie-ai/kling-3.0")).toEqual([
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}",
    ]);
  });

  it("uses model-catalog timeout when status timeout env override is unset", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    delete process.env.SHORTPULSE_KIE_STATUS_TIMEOUT_MS;

    expect(resolveKieStatusTimeoutMsForModel("kie-ai/veo-3.1-fast-i2v")).toBe(60000);
  });

  it("resolves provider keys from model and generation context", () => {
    expect(resolveProviderFromModelId({ modelId: "fal-ai/nano-banana-pro" })).toBe("fal");
    expect(
      resolveProviderFromGenerationContext({
        provider: "KIE",
        modelId: "fal-ai/nano-banana-pro",
      })
    ).toBe("kie");
  });

  it("reads provider API keys by provider family", () => {
    process.env.FAL_KEY = "fal-test-key";
    process.env.KIE_API_KEY = "kie-test-key";
    expect(readProviderApiKey("fal")).toBe("fal-test-key");
    expect(readProviderApiKey("kie")).toBe("kie-test-key");
  });
});
