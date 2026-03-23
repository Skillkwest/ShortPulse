import { beforeEach, describe, expect, it, vi } from "vitest";
import generatePromptHandler from "../../pages/api/ai/generate-prompt";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

describe("POST /api/ai/generate-prompt sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_PROMPT_SYSTEM = "You are a prompt refiner.";
    delete process.env.OPENAI_DIRECT_PROMPT_MODEL;
    delete process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED;
    delete process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED;
    delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES;
    delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATE_PROMPT;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("uses the dedicated direct prompt model default when no override is configured", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "A crisp studio portrait." } }],
        usage: { prompt_tokens: 10, completion_tokens: 7 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "studio portrait" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const payload = requestInit?.body ? (JSON.parse(requestInit.body) as { model?: string }) : null;

    expect(payload?.model).toBe("gpt-5.4");
  });

  it("strips recap/meta tails from generated prompt output", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "An ancient Mayan temple rises from dense jungle. The prompt now includes a woman in traditional attire.",
            },
          },
        ],
        usage: { prompt_tokens: 22, completion_tokens: 15 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "ancient mayan temple in jungle" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");
    expect(res.setHeader).toHaveBeenCalledWith("Sunset", "Sun, 26 Apr 2026 00:00:00 GMT");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Link",
      '<https://docs.shortpulse.app/agent-route-migration>; rel="deprecation"'
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "An ancient Mayan temple rises from dense jungle.",
      })
    );
    expect(res.json.mock.calls[0]?.[0]).toMatchInlineSnapshot(`
      {
        "decision": "allow",
        "outcome_class": "success_prompt",
        "prompt": "An ancient Mayan temple rises from dense jungle.",
        "reason_code": "SUCCESS_PROMPT",
        "retryable": false,
        "usage": {
          "inputTokens": 22,
          "outputTokens": 15,
        },
      }
    `);
    const telemetryCall = infoSpy.mock.calls.find(
      (call: unknown[]) => call[0] === "[generate-prompt][telemetry]"
    );
    const telemetryPayload = telemetryCall
      ? (JSON.parse(String(telemetryCall[1])) as Record<string, unknown>)
      : null;
    expect(telemetryPayload).toEqual(
      expect.objectContaining({
        decision: "allow",
        outcome_class: "success_prompt",
        reason_code: "SUCCESS_PROMPT",
        retryable: false,
        policy_version: 1,
        policy_schema_version: 2,
        prompt_template_version: expect.stringMatching(/^ptv_[a-f0-9]{16}$/),
        runtime_scope_key: expect.stringMatching(
          /^route:generate-prompt\|prompt:ptv_[a-f0-9]{16}\|schema:2\|policy:1$/
        ),
      })
    );
    infoSpy.mockRestore();
  });

  it("treats summary-only outputs as invalid", async () => {
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

    const req = {
      method: "POST",
      body: { prompt: "ancient mayan temple in jungle" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "No prompt returned",
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_OUTPUT_CONTRACT",
        retryable: false,
        fallback_reason: "stage_prompt_missing",
      })
    );
  });

  it("uses responses endpoint when responses mode is enabled", async () => {
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "A cinematic portrait at golden hour." }],
          },
        ],
        usage: { input_tokens: 18, output_tokens: 11 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "portrait at golden hour" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/responses"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A cinematic portrait at golden hour.",
        usage: { inputTokens: 18, outputTokens: 11 },
      })
    );
    expect(res.json.mock.calls[0]?.[0]).toMatchInlineSnapshot(`
      {
        "decision": "allow",
        "outcome_class": "success_prompt",
        "prompt": "A cinematic portrait at golden hour.",
        "reason_code": "SUCCESS_PROMPT",
        "retryable": false,
        "usage": {
          "inputTokens": 18,
          "outputTokens": 11,
        },
      }
    `);
  });

  it("falls back to chat completions when responses fails and fallback is enabled", async () => {
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response("responses unavailable", { status: 503 }))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "A high-detail city skyline at dusk." } }],
          usage: { prompt_tokens: 20, completion_tokens: 13 },
        }),
      });

    const req = {
      method: "POST",
      body: { prompt: "city skyline at dusk" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/responses"
    );
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A high-detail city skyline at dusk.",
      })
    );
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
  });

  it("returns responses upstream error when chat fallback is disabled", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED = "true";
    process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED = "false";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("responses unavailable", { status: 503 })
    );

    const req = {
      method: "POST",
      body: { prompt: "forest temple" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? "")).toBe(
      "https://api.openai.com/v1/responses"
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      decision: "error",
      error: "Upstream error",
      detail: "responses unavailable",
      fallback_reason: "responses_unavailable",
      outcome_class: "upstream_error",
      reason_code: "UPSTREAM_ERROR",
      retryable: true,
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.prompt_generation.upstream_unavailable",
        statusCode: 503,
        metadata: expect.objectContaining({
          detail: "responses unavailable",
        }),
      })
    );
    const telemetryCall = infoSpy.mock.calls.find(
      (call: unknown[]) => call[0] === "[generate-prompt][telemetry]"
    );
    const telemetryPayload = telemetryCall
      ? (JSON.parse(String(telemetryCall[1])) as Record<string, unknown>)
      : null;
    expect(telemetryPayload).toEqual(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        fallback_reason: "responses_unavailable",
      })
    );
    expect(res.json.mock.calls[0]?.[0]).toMatchInlineSnapshot(`
      {
        "decision": "error",
        "detail": "responses unavailable",
        "error": "Upstream error",
        "fallback_reason": "responses_unavailable",
        "outcome_class": "upstream_error",
        "reason_code": "UPSTREAM_ERROR",
        "retryable": true,
      }
    `);
    infoSpy.mockRestore();
  });

  it("classifies upstream 429 failures as rate-limited", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("rate limited", { status: 429 })
    );

    const req = {
      method: "POST",
      body: { prompt: "storm over city skyline" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      decision: "error",
      error: "Upstream error",
      detail: "rate limited",
      fallback_reason: "rate_limit",
      outcome_class: "upstream_error",
      reason_code: "UPSTREAM_ERROR",
      retryable: true,
    });
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.prompt_generation.rate_limited",
        statusCode: 429,
        metadata: expect.objectContaining({
          detail: "rate limited",
        }),
      })
    );
  });

  it("classifies thrown transport failures with normalized fallback_reason labels", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("upstream timeout"));

    const req = {
      method: "POST",
      body: { prompt: "portrait with cinematic lighting" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
        fallback_reason: "timeout",
      })
    );
  });

  it("short-circuits explicit prompts before OpenAI call and returns refusal text payload", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const req = {
      method: "POST",
      body: { prompt: "graphic sexual intercourse with explicit anatomy" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      decision: "refuse",
      outcome_class: "refusal_safety",
      prompt: "I cannot describe this.",
      reason_code: "SAFETY_INPUT_REFUSAL",
      retryable: false,
      usage: {},
    });
    const precheckCall = infoSpy.mock.calls.find(
      (call: unknown[]) => call[0] === "[generate-prompt][safety-input-precheck]"
    );
    const precheckPayload = precheckCall
      ? (JSON.parse(String(precheckCall[1])) as Record<string, unknown>)
      : null;
    expect(precheckPayload).toEqual(
      expect.objectContaining({
        policy_version: 1,
        policy_schema_version: 2,
        prompt_template_version: expect.stringMatching(/^ptv_[a-f0-9]{16}$/),
        runtime_scope_key: expect.stringMatching(
          /^route:generate-prompt\|prompt:ptv_[a-f0-9]{16}\|schema:2\|policy:1$/
        ),
      })
    );
    const telemetryCall = infoSpy.mock.calls.find(
      (call: unknown[]) => call[0] === "[generate-prompt][telemetry]"
    );
    const telemetryPayload = telemetryCall
      ? (JSON.parse(String(telemetryCall[1])) as Record<string, unknown>)
      : null;
    expect(telemetryPayload).toEqual(
      expect.objectContaining({
        decision: "refuse",
        outcome_class: "refusal_safety",
        reason_code: "SAFETY_INPUT_REFUSAL",
        retryable: false,
        provider_blocked: true,
      })
    );
    infoSpy.mockRestore();
  });

  it("honors route-scoped field-mode override and bypasses explicit latest-turn refusal", async () => {
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATE_PROMPT =
      '{"latest_user_turn":"off"}';
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "A dramatic portrait with neon rim lighting.",
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "graphic sexual intercourse with explicit anatomy" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "allow",
        outcome_class: "success_prompt",
        prompt: "A dramatic portrait with neon rim lighting.",
      })
    );
  });

  it("allows rewrite-lane prompts that stay suggestive after deterministic rewrite", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "A cinematic detective in a rainy alley at night.",
            },
          },
        ],
        usage: { prompt_tokens: 18, completion_tokens: 10 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "an armed detective in a rainy alley" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    const precheckCall = infoSpy.mock.calls.find(
      (call: unknown[]) => call[0] === "[generate-prompt][safety-input-precheck]"
    );
    const precheckPayload = precheckCall
      ? (JSON.parse(String(precheckCall[1])) as Record<string, unknown>)
      : null;
    expect(precheckPayload).toEqual(
      expect.objectContaining({
        safety_stage: "input_precheck",
        safety_outcome: "rewritten",
        provider_call_skipped: false,
        category: "violence_suggestive",
        decision_action: "rewrite",
        decision_source: "profile",
        policy_schema_version: 2,
        prompt_template_version: expect.stringMatching(/^ptv_[a-f0-9]{16}$/),
        runtime_scope_key: expect.stringMatching(
          /^route:generate-prompt\|prompt:ptv_[a-f0-9]{16}\|schema:2\|policy:1$/
        ),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A cinematic detective in a rainy alley at night.",
      })
    );
    infoSpy.mockRestore();
  });
});
