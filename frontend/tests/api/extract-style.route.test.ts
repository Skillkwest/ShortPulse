/**
 * Route tests for POST /api/ai/extract-style.
 * Validates extraction success normalization and refusal/error behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import extractStyleHandler from "../../pages/api/ai/extract-style";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const dnsLookupMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => dnsLookupMock(...args),
  default: {
    lookup: (...args: unknown[]) => dnsLookupMock(...args),
  },
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("POST /api/ai/extract-style", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.OPENAI_DESCRIBE_ALLOWED_HOSTS = "example.com";
    delete process.env.OPENAI_VISION_MODEL;
    delete process.env.OPENAI_VISION_FALLBACK_MODEL;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 400 when imageUrl is missing", async () => {
    const req = {
      method: "POST",
      body: {},
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "imageUrl is required",
      })
    );
  });

  it("extracts and normalizes style prompt text", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "STYLE ADD-ON\n\n- cinematic editorial photography style\n- dramatic moody lighting\n- shallow depth of field",
              },
            },
          ],
          usage: { prompt_tokens: 11, completion_tokens: 14 },
        }),
      });

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/image.png" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stylePrompt:
          "cinematic editorial photography style, dramatic moody lighting, shallow depth of field",
        usage: {
          inputTokens: 11,
          outputTokens: 14,
        },
      })
    );
  });

  it("treats refusal text as extraction failure", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "I cannot describe this." } }],
          usage: { prompt_tokens: 5, completion_tokens: 2 },
        }),
      });

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/image.png" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "No style prompt returned",
      })
    );
  });
});
