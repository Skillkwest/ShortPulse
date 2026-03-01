import { afterEach, describe, expect, it } from "vitest";
import { probeProviderResult } from "../recoveryProviderProbe";

describe("recoveryProviderProbe trusted base policy", () => {
  afterEach(() => {
    delete process.env.SHORTPULSE_FAL_TRUSTED_HOSTS;
  });

  it("fails closed when model status bases are outside trusted host policy", async () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "partner.fal.ai";

    await expect(
      probeProviderResult({
        requestId: "req-1",
        modelId: "fal-ai/nano-banana-pro",
        apiKey: "test-key",
      })
    ).rejects.toThrow("No trusted fal status base URL configured");
  });
});
