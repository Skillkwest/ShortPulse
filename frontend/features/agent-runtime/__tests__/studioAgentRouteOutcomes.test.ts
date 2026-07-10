import { describe, expect, it, vi } from "vitest";
import {
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentInputPrecheckTelemetry,
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
      path: "pulse_agent",
      status: "success",
      traceId: "trace-telemetry-1",
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
        trace_id: "trace-telemetry-1",
        outcome_class: "success_prompt",
        repair_used: false,
        repair_count: 0,
        policy_version: null,
        policy_schema_version: null,
        prompt_template_version: null,
        runtime_scope_key: null,
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
      expect.stringContaining('"trace_id":"trace-telemetry-1"')
    );
    infoSpy.mockRestore();
  });

  it("emits bounded Safe Completion disposition without content payloads", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    emitStudioAgentTurnTelemetry({
      flow: "TEXT_ONLY",
      path: "standard_agent",
      status: "success",
      model: "gpt-default",
      outcomeClass: "success_prompt",
      retryUsed: false,
      totalLatencyMs: 42,
      stageLatencyMs: {},
      safetyTelemetry: {
        safeCompletionVersion: "2026-07-10.v1",
        safeCompletionEnabled: true,
        refusalSource: "typed_model",
        recoveryEligible: true,
        recoveryAttempted: true,
        recoveryOutcome: "recovered",
        recoveryLatencyMs: 12,
      },
    });
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[1] ?? "{}")) as Record<
      string,
      unknown
    >;
    expect(payload).toEqual(
      expect.objectContaining({
        safe_completion_contract_version: "2026-07-10.v1",
        safe_completion_enabled: true,
        refusal_source: "typed_model",
        recovery_eligible: true,
        recovery_attempted: true,
        recovery_outcome: "recovered",
        recovery_latency_ms: 12,
      })
    );
    expect(JSON.stringify(payload)).not.toContain("prompt_text");
    expect(JSON.stringify(payload)).not.toContain("user_email");
    infoSpy.mockRestore();
  });

  it("resolves policy versions from profile ids", () => {
    expect(resolvePolicyVersionFromProfileId("prod_safe_v1")).toBe(1);
    expect(resolvePolicyVersionFromProfileId("staging_lenient")).toBeNull();
    expect(resolvePolicyVersionFromProfileId("")).toBeNull();
    expect(resolvePolicyVersionFromProfileId(null)).toBeNull();
  });

  it("emits input precheck telemetry with scope metadata", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    emitStudioAgentInputPrecheckTelemetry({
      flow: "TEXT_ONLY",
      outcome: "rewritten",
      rewrittenFieldCount: 2,
      providerCallSkipped: false,
      policyVersion: 1,
      policySchemaVersion: 2,
      promptTemplateVersion: "ptv_example",
      runtimeScopeKey: "route:studio-agent|prompt:ptv_example|schema:2|policy:1",
      profileId: "prod_safe_v1",
      modality: "text",
      category: "sexual_suggestive",
      decisionAction: "rewrite",
      decisionSource: "profile",
      hardFloorViolation: false,
      refusalField: null,
      rewrittenFields: ["history_user_turn", "reference_caption"],
      nonBlockingSignalCount: 3,
    });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[1] ?? "{}")) as Record<
      string,
      unknown
    >;
    expect(payload).toEqual(
      expect.objectContaining({
        rewritten_field_count: 2,
        provider_call_skipped: false,
        policy_schema_version: 2,
        prompt_template_version: "ptv_example",
        runtime_scope_key: "route:studio-agent|prompt:ptv_example|schema:2|policy:1",
        refusal_field: null,
        rewritten_fields: ["history_user_turn", "reference_caption"],
        non_blocking_signal_count: 3,
      })
    );
    infoSpy.mockRestore();
  });

  it("builds upstream error payloads with optional stage and fallback reason", () => {
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
        fallbackReason: "stage_thinker",
      })
    ).toEqual({
      decision: "error",
      outcome_class: "upstream_error",
      reason_code: "UPSTREAM_ERROR",
      retryable: true,
      error: "Upstream error (thinker)",
      detail: "upstream detail",
      fallback_reason: "stage_thinker",
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
