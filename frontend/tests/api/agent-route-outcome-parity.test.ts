/**
 * Cross-route machine-outcome parity checks for OpenAI remediation lanes.
 * Ensures upstream-error payloads expose normalized fallback diagnostics.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import extractStyleHandler from "../../pages/api/ai/extract-style";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
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

    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_PROMPT_SYSTEM = "You are a prompt refiner.";
    process.env.OPENAI_PROMPT_IMAGE_DESCRIBE = "Describe this image accurately.";
    process.env.OPENAI_PROMPT_STYLE_EXTRACT = "Extract reusable style descriptors.";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    delete process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED;
    delete process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED;
  });

  it("extract-style emits upstream_error with normalized fallback_reason", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }));

    const req = { method: "POST", body: { imageDataUrl: "data:image/jpeg;base64,abc123" } };
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

  it("extract-style marks deterministic output-contract failures as non-retryable", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ output_text: "{}" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = { method: "POST", body: { imageDataUrl: "data:image/jpeg;base64,abc123" } };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_OUTPUT_CONTRACT",
        retryable: false,
        fallback_reason: "output_contract",
      })
    );
  });
});
