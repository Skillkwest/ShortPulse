/**
 * Cross-route machine-outcome parity checks for OpenAI remediation lanes.
 * Ensures upstream-error payloads expose normalized fallback diagnostics.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import generatePromptHandler from "../../pages/api/ai/generate-prompt";
import describeImageHandler from "../../pages/api/ai/describe-image";
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

describe("OpenAI route outcome parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_PROMPT_SYSTEM = "You are a prompt refiner.";
    process.env.OPENAI_PROMPT_IMAGE_DESCRIBE = "Describe this image accurately.";
    process.env.OPENAI_PROMPT_STYLE_EXTRACT = "Extract reusable style descriptors.";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.OPENAI_DESCRIBE_ALLOWED_HOSTS = "example.com";
    delete process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED;
    delete process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED;
  });

  it("generate-prompt emits upstream_error with normalized fallback_reason", async () => {
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "false";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("responses unavailable", { status: 503 })
    );

    const req = { method: "POST", body: { prompt: "forest temple" } };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Agent-Contract-Version", "1");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
        fallback_reason: "responses_unavailable",
      })
    );
  });

  it("describe-image emits upstream_error with normalized fallback_reason", async () => {
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "false";
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
      })
      .mockResolvedValueOnce(new Response("responses rejected image payload", { status: 400 }));

    const req = { method: "POST", body: { imageUrl: "https://example.com/public.png" } };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Agent-Contract-Version", "1");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
        fallback_reason: "upstream_error",
      })
    );
  });

  it("extract-style emits upstream_error with normalized fallback_reason", async () => {
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
        ok: false,
        status: 503,
        text: async () => "Service unavailable",
      });

    const req = { method: "POST", body: { imageUrl: "https://example.com/public.png" } };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Agent-Contract-Version", "1");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
        fallback_reason: "upstream_unavailable",
      })
    );
  });

  it("generate-prompt marks deterministic output-contract failures as non-retryable", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Summary: transformed the prompt with richer composition.",
            },
          },
        ],
      }),
    });

    const req = { method: "POST", body: { prompt: "forest temple" } };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_OUTPUT_CONTRACT",
        retryable: false,
        fallback_reason: "stage_prompt_missing",
      })
    );
  });

  it("extract-style marks deterministic output-contract failures as non-retryable", async () => {
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

    const req = { method: "POST", body: { imageUrl: "https://example.com/public.png" } };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_OUTPUT_CONTRACT",
        retryable: false,
        fallback_reason: "stage_style_prompt_missing",
      })
    );
  });
});
