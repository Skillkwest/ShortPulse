import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchQueuedGenerationStatusByModelId,
  submitQueuedGenerationByModelId,
} from "../falClient";
import { fetchWithAuth } from "../authenticatedFetch";

vi.mock("../authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("falClient status timeout budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses 75s timeout budget for standard Fal status endpoints", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(createJsonResponse({ status: "pending" }));

    await fetchQueuedGenerationStatusByModelId(
      "fal-ai/bytedance/seedream/v4.5/text-to-image",
      "req-standard-timeout"
    );

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchWithAuthMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/fal/seedream-status");
    expect((init as { timeoutMs?: number } | undefined)?.timeoutMs).toBe(75_000);
    expect(
      (init as { shortpulseAuthTimeoutMs?: number } | undefined)?.shortpulseAuthTimeoutMs
    ).toBe(undefined);
    expect((init as RequestInit | undefined)?.method).toBe("POST");
  });

  it("derives generic queued status URLs from model catalog route metadata", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(createJsonResponse({ status: "pending" }));

    await fetchQueuedGenerationStatusByModelId("kie-ai/seedance-2-fast", "req-kie-seedance-fast");

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchWithAuthMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/fal/kie-seedance-2-fast-status");
    expect((init as RequestInit | undefined)?.body).toBe(
      JSON.stringify({ requestId: "req-kie-seedance-fast" })
    );
  });

  it("does not retry status requests through alternate GET paths", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse({ error: "Method not allowed" }, 405)
    );

    await expect(
      fetchQueuedGenerationStatusByModelId(
        "fal-ai/bytedance/seedream/v4.5/text-to-image",
        "req-status-405"
      )
    ).rejects.toThrow("Method not allowed");

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    const [, firstInit] = fetchWithAuthMock.mock.calls[0] ?? [];
    expect((firstInit as { timeoutMs?: number } | undefined)?.timeoutMs).toBe(75_000);
    expect((firstInit as RequestInit | undefined)?.method).toBe("POST");
  });

  it("normalizes abort-like transport failures into endpoint-specific timeout errors", async () => {
    const abortError = new Error("signal is aborted without reason") as Error & { name?: string };
    abortError.name = "AbortError";
    fetchWithAuthMock.mockRejectedValueOnce(abortError);

    await expect(
      fetchQueuedGenerationStatusByModelId(
        "fal-ai/bytedance/seedream/v4.5/text-to-image",
        "req-timeout-error"
      )
    ).rejects.toThrow(
      "[fal-status:fal-ai/bytedance/seedream/v4.5/text-to-image] timed out after 75000ms"
    );
  });

  it("adds a 4s auth-session timeout budget for Fal submit endpoints", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(createJsonResponse({ request_id: "req-submit-1" }));

    await submitQueuedGenerationByModelId("fal-ai/nano-banana-pro/edit", {
      prompt: "Character pose",
      image_urls: ["https://cdn.test/ref.png"],
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchWithAuthMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/fal/nano-banana-pro-edit-submit");
    expect(
      (init as { shortpulseAuthTimeoutMs?: number } | undefined)?.shortpulseAuthTimeoutMs
    ).toBe(4_000);
    expect((init as RequestInit | undefined)?.method).toBe("POST");
  });

  it("preserves optional generationId from immediate submit responses", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse({ request_id: "req-submit-2", generationId: "gen-submit-2" })
    );

    await expect(
      submitQueuedGenerationByModelId("fal-ai/nano-banana-pro/edit", {
        prompt: "Character pose",
        image_urls: ["https://cdn.test/ref.png"],
      })
    ).resolves.toEqual({
      request_id: "req-submit-2",
      generationId: "gen-submit-2",
    });
  });
});
