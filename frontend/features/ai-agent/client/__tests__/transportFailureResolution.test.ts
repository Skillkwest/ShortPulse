import { describe, expect, it } from "vitest";
import { resolveStudioAgentTransportFailure } from "../transportFailureResolution";

describe("resolveStudioAgentTransportFailure", () => {
  it("appends the upstream trace id to non-refusal errors", () => {
    expect(
      resolveStudioAgentTransportFailure({
        ok: false,
        status: 502,
        detail: "OpenAI request timed out",
        rawBody: JSON.stringify({
          detail: "OpenAI request timed out",
          traceId: "agent-trace-123",
        }),
        parsedError: {
          detail: "OpenAI request timed out",
          traceId: "agent-trace-123",
        },
      })
    ).toEqual({
      assistantMessage: null,
      response: null,
      errorText: "OpenAI request timed out (Trace ID: agent-trace-123)",
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
