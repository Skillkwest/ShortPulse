import { describe, expect, it } from "vitest";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
} from "../studioAgentRouteEnvelope";

describe("studioAgentRouteEnvelope", () => {
  it("prefers header trace id over request body trace id", () => {
    const traceId = resolveStudioAgentTraceId({
      headers: { "x-shortpulse-request-id": "header-123" },
      body: { traceId: "body-456" },
    } as never);

    expect(traceId).toBe("header-123");
  });

  it("defaults feature flag to enabled when server/public flags are unset", () => {
    expect(
      isStudioAgentFeatureEnabled({
        serverFlag: undefined,
        publicFlag: undefined,
      })
    ).toBe(true);
  });

  it("returns invalid session key when clientSessionKey is missing", () => {
    const result = parseStudioAgentRequestEnvelope({
      req: {
        body: {
          messages: [{ role: "user", content: "enhance this prompt" }],
        },
      } as never,
      userId: "user-missing-session",
      traceId: "trace-missing-session",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.payload.code).toBe("INVALID_SESSION_KEY");
    expect(result.payload.traceId).toBe("trace-missing-session");
  });
});
