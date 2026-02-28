/**
 * Unit coverage for provider-aware polling session policy.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { startProviderPollingSession } from "../statusProviderPolling";

describe("statusProviderPolling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses model-profile timeout when not overridden", () => {
    const session = startProviderPollingSession({
      provider: "fal",
      modelId: "fal-ai/veo3.1/image-to-video",
    });

    expect(session.timeoutMs).toBe(90000);
    session.dispose();
  });

  it("uses explicit timeout override when provided", () => {
    const session = startProviderPollingSession({
      provider: "fal",
      modelId: "fal-ai/veo3.1/image-to-video",
      timeoutMs: 1234,
    });

    expect(session.timeoutMs).toBe(1234);
    session.dispose();
  });

  it("aborts polling signal when timeout elapses", () => {
    vi.useFakeTimers();

    const session = startProviderPollingSession({
      provider: "fal",
      modelId: "fal-ai/nano-banana-pro",
      timeoutMs: 10,
    });

    expect(session.signal.aborted).toBe(false);
    vi.advanceTimersByTime(11);
    expect(session.signal.aborted).toBe(true);
    session.dispose();
  });

  it("supports manual abort before timeout", () => {
    const session = startProviderPollingSession({
      provider: "fal",
      modelId: "fal-ai/nano-banana-pro",
      timeoutMs: 5000,
    });

    expect(session.signal.aborted).toBe(false);
    session.abort();
    expect(session.signal.aborted).toBe(true);
    session.dispose();
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      startProviderPollingSession({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Unsupported provider for model status timeout resolution");
  });
});
