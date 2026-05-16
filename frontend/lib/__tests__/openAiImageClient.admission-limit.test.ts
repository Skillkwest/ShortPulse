import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitOpenAiGptImage2 } from "../openAiImageClient";
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

describe("openAiImageClient admission error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces retry guidance for admission-limited image submits", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          error: "Too many active generations. Please retry shortly.",
          code: "GENERATION_ADMISSION_LIMIT",
          retryAfterSeconds: 18,
          admissionScope: "per_user",
        },
        429
      )
    );

    await expect(
      submitOpenAiGptImage2({
        prompt: "portrait",
        size: "1024x1024",
        quality: "medium",
      })
    ).rejects.toThrow("You already have too many active generations. Please retry in 18 seconds.");
  });
});
