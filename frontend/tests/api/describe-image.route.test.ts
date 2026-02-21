import { beforeEach, describe, expect, it, vi } from "vitest";
import describeImageHandler from "../../pages/api/ai/describe-image";

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

describe("POST /api/ai/describe-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_PROMPT_IMAGE_DESCRIBE = "Describe this image accurately.";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    delete process.env.OPENAI_VISION_MODEL;
    delete process.env.OPENAI_VISION_FALLBACK_MODEL;
    delete process.env.OPENAI_DESCRIBE_ALLOWED_HOSTS;
    delete process.env.OPENAI_DESCRIBE_REQUIRE_ALLOWED_HOSTS;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 422 when image URL is not reachable", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "text/html" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "text/html" }),
      });

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/private.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");
    expect(res.setHeader).toHaveBeenCalledWith("Sunset", "Sun, 26 Apr 2026 00:00:00 GMT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Image URL is not publicly reachable.",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.image_describe.validation_failed",
      })
    );
  });

  it("retries with fallback vision model when primary model rejects image inputs", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    process.env.OPENAI_VISION_MODEL = "gpt-5-nano";
    process.env.OPENAI_VISION_FALLBACK_MODEL = "gpt-5-mini";

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ error: { message: "Model does not support image input" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "A person standing in a neon-lit alley." } }],
          usage: { prompt_tokens: 10, completion_tokens: 12 },
        }),
      });

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/public.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstOpenAiBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? "{}"));
    const secondOpenAiBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body ?? "{}"));
    expect(firstOpenAiBody.model).toBe("gpt-5-nano");
    expect(secondOpenAiBody.model).toBe("gpt-5-mini");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "A person standing in a neon-lit alley.",
      })
    );
  });

  it("retries transient upstream failures before returning error", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Service unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "A detailed portrait photo." } }],
          usage: { prompt_tokens: 9, completion_tokens: 7 },
        }),
      });

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/transient.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "A detailed portrait photo.",
      })
    );
  });

  it("rejects blocked private hosts before probing network", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const req = {
      method: "POST",
      body: { imageUrl: "https://127.0.0.1/private.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Image URL host is not allowed.",
      })
    );
  });

  it("rejects hosts that resolve to private network IPs", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    dnsLookupMock.mockResolvedValueOnce([{ address: "10.0.0.42", family: 4 }]);

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/private-via-dns.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Image URL host resolved to a private network address.",
      })
    );
  });

  it("enforces trusted host allowlist when configured", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    process.env.OPENAI_DESCRIBE_ALLOWED_HOSTS = "cdn.shortpulse.app";

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/disallowed.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Image URL host is not in the trusted allowlist.",
      })
    );
  });

  it("rejects redirect chains that land on blocked hosts", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: new Headers({ location: "https://127.0.0.1/blocked.png" }),
    });

    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/redirect.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Image URL host is not allowed.",
      })
    );
  });
});
