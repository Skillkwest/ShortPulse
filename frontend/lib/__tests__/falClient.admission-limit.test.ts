import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitFalNanoBanana } from "../falClient";
import { fetchWithAuth } from "../authenticatedFetch";

vi.mock("../authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const createJsonResponse = (payload: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });

describe("falClient generation admission error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces deterministic retry guidance for admission-limited 429 payloads", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          error: "Too many active generations. Please retry shortly.",
          code: "GENERATION_ADMISSION_LIMIT",
          retryAfterSeconds: 20,
          admissionScope: "per_user",
        },
        429
      )
    );

    await expect(submitFalNanoBanana({ prompt: "portrait" })).rejects.toThrow(
      "You already have too many active generations. Please retry in 20 seconds."
    );
  });

  it("surfaces shared-provider retry guidance for shared-capacity saturation", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          error: "Too many active generations. Please retry shortly.",
          code: "GENERATION_ADMISSION_LIMIT",
          retryAfterSeconds: 14,
          admissionScope: "shared_provider",
        },
        429
      )
    );

    await expect(submitFalNanoBanana({ prompt: "portrait" })).rejects.toThrow(
      "Shared generation capacity is busy right now. Please retry in 14 seconds."
    );
  });

  it("uses Retry-After header fallback when payload omits retryAfterSeconds", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          error: "Too many active generations. Please retry shortly.",
          code: "GENERATION_ADMISSION_LIMIT",
        },
        429,
        {
          "Retry-After": "9",
        }
      )
    );

    await expect(submitFalNanoBanana({ prompt: "portrait" })).rejects.toThrow(
      "Too many active generations. Please retry in 9 seconds."
    );
  });

  it("surfaces deterministic retry guidance for admission unavailable 503 payloads", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          error: "Generation admission is temporarily unavailable. Please retry shortly.",
          code: "GENERATION_ADMISSION_UNAVAILABLE",
        },
        503,
        {
          "Retry-After": "12",
        }
      )
    );

    await expect(submitFalNanoBanana({ prompt: "portrait" })).rejects.toThrow(
      "Generation admission is temporarily unavailable. Please retry in 12 seconds."
    );
  });

  it("returns queued submit payloads without throwing", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          status: "queued",
          code: "GENERATION_QUEUED",
          sourceRef: "src-1",
          generationId: "gen-1",
          pollAfterMs: 1200,
        },
        202
      )
    );

    await expect(submitFalNanoBanana({ prompt: "portrait" })).resolves.toEqual({
      status: "queued",
      code: "GENERATION_QUEUED",
      sourceRef: "src-1",
      generationId: "gen-1",
      pollAfterMs: 1200,
    });
  });

  it("surfaces provider msg fields for non-admission submit failures", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          code: 422,
          msg: "Input video URL is not publicly reachable.",
        },
        422
      )
    );

    await expect(submitFalNanoBanana({ prompt: "portrait" })).rejects.toThrow(
      "Input video URL is not publicly reachable."
    );
  });

  it("maps generic validation envelopes with unsafe-content detail to explicit-content copy", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          error: "Error validating the input",
          detail:
            "The model did not generate the expected output for this prompt. This may occur for several reasons, including unsafe content.",
        },
        422
      )
    );

    await expect(submitFalNanoBanana({ prompt: "portrait" })).rejects.toThrow(
      "This request was blocked for explicit or unsafe content. Try revising the prompt or references."
    );
  });
});
