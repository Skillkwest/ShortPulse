import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFalSeedreamStatus,
  fetchFalVeoImageToVideoStatus,
  fetchFalVeoStatus,
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

    await fetchFalSeedreamStatus("req-standard-timeout");

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchWithAuthMock.mock.calls[0] ?? [];
    expect((init as { timeoutMs?: number } | undefined)?.timeoutMs).toBe(75_000);
    expect((init as RequestInit | undefined)?.method).toBe("POST");
  });

  it("uses 105s timeout budget for Veo status endpoints", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(createJsonResponse({ status: "pending" }));

    await fetchFalVeoStatus("req-veo-timeout");

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchWithAuthMock.mock.calls[0] ?? [];
    expect((init as { timeoutMs?: number } | undefined)?.timeoutMs).toBe(105_000);
    expect((init as RequestInit | undefined)?.method).toBe("POST");
  });

  it("applies the same timeout budget to fallback GET on 405", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(createJsonResponse({ error: "Method not allowed" }, 405))
      .mockResolvedValueOnce(createJsonResponse({ status: "pending" }));

    await fetchFalVeoImageToVideoStatus("req-veo-fallback");

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);

    const [, firstInit] = fetchWithAuthMock.mock.calls[0] ?? [];
    expect((firstInit as { timeoutMs?: number } | undefined)?.timeoutMs).toBe(105_000);
    expect((firstInit as RequestInit | undefined)?.method).toBe("POST");

    const [, secondInit] = fetchWithAuthMock.mock.calls[1] ?? [];
    expect((secondInit as { timeoutMs?: number } | undefined)?.timeoutMs).toBe(105_000);
    expect((secondInit as RequestInit | undefined)?.method).toBe("GET");
  });

  it("normalizes abort-like transport failures into endpoint-specific timeout errors", async () => {
    const abortError = new Error("signal is aborted without reason") as Error & { name?: string };
    abortError.name = "AbortError";
    fetchWithAuthMock.mockRejectedValueOnce(abortError);

    await expect(fetchFalSeedreamStatus("req-timeout-error")).rejects.toThrow(
      "[fal-status:seedream] timed out after 75000ms"
    );
  });
});
