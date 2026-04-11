import { afterEach, describe, expect, it } from "vitest";
import { filterTrustedFalProviderUrls, isTrustedFalProviderUrl } from "../providerTrustPolicy";

describe("providerTrustPolicy", () => {
  afterEach(() => {
    delete process.env.SHORTPULSE_FAL_TRUSTED_HOSTS;
  });

  it("allows trusted Fal hosts and blocks malformed suffix lookalikes", () => {
    expect(isTrustedFalProviderUrl("https://queue.fal.run/fal-ai/model")).toBe(true);
    expect(isTrustedFalProviderUrl("https://rest.alpha.fal.ai/v1/queue")).toBe(true);
    expect(isTrustedFalProviderUrl("https://fal.media/files/result.png")).toBe(true);
    expect(isTrustedFalProviderUrl("https://evilfal.run/fal-ai/model")).toBe(false);
    expect(isTrustedFalProviderUrl("https://fal.run.evil.example/fal-ai/model")).toBe(false);
  });

  it("rejects non-https and private/local hosts", () => {
    expect(isTrustedFalProviderUrl("http://queue.fal.run/fal-ai/model")).toBe(false);
    expect(isTrustedFalProviderUrl("https://localhost/fal-ai/model")).toBe(false);
    expect(isTrustedFalProviderUrl("https://127.0.0.1/fal-ai/model")).toBe(false);
    expect(isTrustedFalProviderUrl("https://10.1.1.1/fal-ai/model")).toBe(false);
  });

  it("supports explicit trusted-host override env", () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "fal.run,partner.fal.ai";
    expect(isTrustedFalProviderUrl("https://partner.fal.ai/queue")).toBe(true);
    expect(isTrustedFalProviderUrl("https://queue.fal.run/queue")).toBe(true);
    expect(isTrustedFalProviderUrl("https://queue.fal.ai/queue")).toBe(false);
  });

  it("filters trusted provider URLs and dedupes by default", () => {
    const filtered = filterTrustedFalProviderUrls([
      "https://queue.fal.run/a",
      "https://queue.fal.run/a",
      "https://example.com/b",
    ]);
    expect(filtered).toEqual(["https://queue.fal.run/a"]);
  });
});
