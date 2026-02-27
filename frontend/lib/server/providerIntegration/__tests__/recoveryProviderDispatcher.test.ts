/**
 * Unit coverage for provider-aware recovery probe dispatch.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { probeGenerationProviderResult } from "../recoveryProviderDispatcher";

const probeProviderResultMock = vi.fn();

vi.mock("../../falIntegration/recoveryProviderProbe", () => ({
  probeProviderResult: (...args: unknown[]) => probeProviderResultMock(...args),
}));

describe("recoveryProviderDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    probeProviderResultMock.mockResolvedValue({
      state: "running",
      payload: null,
      mediaUrls: [],
    });
  });

  it("dispatches fal providers to the fal recovery probe implementation", async () => {
    const result = await probeGenerationProviderResult({
      provider: "fal",
      requestId: "req-1",
      modelId: "fal-ai/nano-banana-pro",
      apiKey: "test-key",
    });

    expect(probeProviderResultMock).toHaveBeenCalledWith({
      requestId: "req-1",
      modelId: "fal-ai/nano-banana-pro",
      apiKey: "test-key",
    });
    expect(result).toEqual({
      state: "running",
      payload: null,
      mediaUrls: [],
    });
  });

  it("accepts fal-prefixed provider aliases", async () => {
    await probeGenerationProviderResult({
      provider: "fal_legacy_alias",
      requestId: "req-2",
      modelId: "fal-ai/veo3.1/image-to-video",
      apiKey: "test-key",
    });

    expect(probeProviderResultMock).toHaveBeenCalledTimes(1);
  });

  it("throws for unsupported providers", async () => {
    await expect(
      probeGenerationProviderResult({
        provider: "kie",
        requestId: "req-kie",
        modelId: "kie/video-1",
        apiKey: "test-key",
      })
    ).rejects.toThrow("Unsupported recovery provider");
    expect(probeProviderResultMock).not.toHaveBeenCalled();
  });
});
