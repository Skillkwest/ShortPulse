import { describe, expect, it, vi } from "vitest";
import {
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentTurnTelemetry,
  isStudioAgentSafetyRefusalUpstreamError,
  STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
} from "../studioAgentRouteOutcomes";

describe("studioAgentRouteOutcomes", () => {
  it("emits telemetry with normalized field names", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    emitStudioAgentTurnTelemetry({
      flow: "TEXT_ONLY",
      path: "text_fast_path",
      status: "success",
      model: "gpt-default",
      retryUsed: false,
      totalLatencyMs: 120,
      stageLatencyMs: { fast_path_turn: 45 },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      "[studio-agent][telemetry]",
      expect.stringContaining('"retry_used":false')
    );
    infoSpy.mockRestore();
  });

  it("builds upstream error payloads with optional stage", () => {
    expect(
      buildStudioAgentUpstreamErrorPayload({
        traceId: "trace-1",
        detail: "upstream detail",
      })
    ).toEqual({
      error: "Upstream error",
      detail: "upstream detail",
      traceId: "trace-1",
    });

    expect(
      buildStudioAgentUpstreamErrorPayload({
        traceId: "trace-2",
        detail: "upstream detail",
        stage: "thinker",
      })
    ).toEqual({
      error: "Upstream error (thinker)",
      detail: "upstream detail",
      traceId: "trace-2",
    });
  });

  it("builds route failure payload", () => {
    expect(
      buildStudioAgentRouteFailurePayload({
        traceId: "trace-3",
        detail: "transport timed out",
      })
    ).toEqual({
      error: "Agent call failed",
      detail: "transport timed out",
      traceId: "trace-3",
    });
  });

  it("classifies safety-policy upstream errors for refusal mapping", () => {
    expect(
      isStudioAgentSafetyRefusalUpstreamError({
        status: 400,
        detail: "content policy violation: unsafe request",
      })
    ).toBe(true);
    expect(
      isStudioAgentSafetyRefusalUpstreamError({
        status: 403,
        detail: '{"error":{"message":"blocked by safety policy"}}',
      })
    ).toBe(true);
    expect(
      isStudioAgentSafetyRefusalUpstreamError({
        status: 503,
        detail: "service unavailable",
      })
    ).toBe(false);
    expect(
      isStudioAgentSafetyRefusalUpstreamError({
        status: 400,
        detail: "invalid request format",
      })
    ).toBe(false);
  });

  it("builds safety refusal payload with canonical continuity", () => {
    expect(
      buildStudioAgentSafetyRefusalPayload({
        traceId: "trace-refuse",
        canonicalPrompt: "existing canonical",
      })
    ).toEqual({
      message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      actions: undefined,
      canonicalPrompt: "existing canonical",
      traceId: "trace-refuse",
    });
  });
});
