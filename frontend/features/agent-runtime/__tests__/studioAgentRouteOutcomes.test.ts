import { describe, expect, it, vi } from "vitest";
import {
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentTurnTelemetry,
  isStudioAgentSafetyRefusalUpstreamError,
  resolvePolicyVersionFromProfileId,
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
      outcomeClass: "success_prompt",
      retryUsed: false,
      totalLatencyMs: 120,
      stageLatencyMs: { fast_path_turn: 45 },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[1] ?? "{}")) as Record<
      string,
      unknown
    >;
    expect(payload).toEqual(
      expect.objectContaining({
        outcome_class: "success_prompt",
        policy_version: null,
        profile_id: null,
        modality: null,
        category: null,
        decision_action: null,
        provider_blocked: false,
        hard_floor_violation: false,
        rollback_triggered: false,
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[studio-agent][telemetry]",
      expect.stringContaining('"outcome_class":"success_prompt"')
    );
    infoSpy.mockRestore();
  });

  it("resolves policy versions from profile ids", () => {
    expect(resolvePolicyVersionFromProfileId("prod_safe_v1")).toBe(1);
    expect(resolvePolicyVersionFromProfileId("staging_lenient")).toBeNull();
    expect(resolvePolicyVersionFromProfileId("")).toBeNull();
    expect(resolvePolicyVersionFromProfileId(null)).toBeNull();
  });

  it("builds upstream error payloads with optional stage", () => {
    expect(
      buildStudioAgentUpstreamErrorPayload({
        traceId: "trace-1",
        detail: "upstream detail",
      })
    ).toEqual({
      decision: "error",
      outcome_class: "upstream_error",
      reason_code: "UPSTREAM_ERROR",
      retryable: true,
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
      decision: "error",
      outcome_class: "upstream_error",
      reason_code: "UPSTREAM_ERROR",
      retryable: true,
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
      decision: "error",
      outcome_class: "route_error",
      reason_code: "ROUTE_ERROR",
      retryable: true,
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
        status: 422,
        detail: '{"error":{"message":"moderation flagged: sexual content"}}',
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
        status: 401,
        detail: "invalid api key",
      })
    ).toBe(false);
    expect(
      isStudioAgentSafetyRefusalUpstreamError({
        status: 403,
        detail: "request blocked by organization policy",
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
      decision: "refuse",
      outcome_class: "refusal_safety",
      reason_code: "SAFETY_OUTPUT_REFUSAL",
      retryable: false,
      message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      actions: undefined,
      canonicalPrompt: "existing canonical",
      traceId: "trace-refuse",
    });
  });
});
