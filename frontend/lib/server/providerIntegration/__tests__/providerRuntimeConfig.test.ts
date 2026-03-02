/**
 * Unit coverage for provider runtime config guards.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  assertKieRuntimeEnabledForModel,
  filterTrustedKieProviderUrls,
  readKieRuntimeFlags,
  readProviderApiKey,
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
    ).toThrow("Kie model is not allowlisted");
  });

  it("normalizes and filters invalid kie allowlist entries", () => {
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST =
      " KIE-AI/VEO-3.1-FAST-I2V , fal-ai/veo3.1, *, bad-prefix/*, kie-ai/* ";
    const flags = readKieRuntimeFlags();
    expect([...flags.modelAllowlist]).toEqual(["kie-ai/veo-3.1-fast-i2v", "*"]);
  });

  it("fails closed when kie enable flag is on without an explicit model allowlist", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;

    expect(() =>
      assertKieRuntimeEnabledForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie model is not allowlisted");
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
