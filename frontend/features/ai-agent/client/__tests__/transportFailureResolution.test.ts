import { describe, expect, it } from "vitest";
import { resolveStudioAgentTransportFailure } from "../transportFailureResolution";

describe("resolveStudioAgentTransportFailure", () => {
  it("appends the upstream trace id to non-refusal errors", () => {
    expect(
      resolveStudioAgentTransportFailure({
        ok: false,
        status: 502,
        detail: "Agent request timed out",
        rawBody: JSON.stringify({
          detail: "Agent request timed out",
          traceId: "agent-trace-123",
        }),
        parsedError: {
          detail: "Agent request timed out",
          traceId: "agent-trace-123",
        },
      })
    ).toEqual({
      assistantMessage: null,
      response: null,
      errorText: "Agent request timed out (Trace ID: agent-trace-123)",
    });
  });

  it("normalizes raw provider credential errors", () => {
    expect(
      resolveStudioAgentTransportFailure({
        ok: false,
        status: 401,
        detail: "invalid api key",
        rawBody: JSON.stringify({
          detail:
            "Incorrect API key provided: sk-proj-********************************. You can find your API key at https://platform.openai.com/account/api-keys.",
          traceId: "agent-trace-789",
        }),
        parsedError: {
          detail:
            "Incorrect API key provided: sk-proj-********************************. You can find your API key at https://platform.openai.com/account/api-keys.",
          traceId: "agent-trace-789",
        },
      })
    ).toEqual({
      assistantMessage: null,
      response: null,
      errorText: "Missing API key. (Trace ID: agent-trace-789)",
    });
  });

  it("keeps refusal payloads as assistant messages without adding trace text", () => {
    expect(
      resolveStudioAgentTransportFailure({
        ok: false,
        status: 200,
        detail: "I cannot describe this.",
        rawBody: JSON.stringify({
          message: "I cannot describe this.",
          decision: "refuse",
          traceId: "agent-trace-456",
        }),
        parsedError: {
          message: "I cannot describe this.",
          decision: "refuse",
          traceId: "agent-trace-456",
        },
      })
    ).toEqual({
      assistantMessage: "I cannot describe this.",
      response: {
        message: "I cannot describe this.",
        actions: undefined,
        decision: "refuse",
        outcome_class: "refusal_safety",
        reason_code: undefined,
        retryable: undefined,
        fallback_reason: undefined,
      },
      errorText: null,
    });
  });
});
