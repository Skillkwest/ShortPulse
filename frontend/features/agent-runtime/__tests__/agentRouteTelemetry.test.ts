/**
 * Unit tests for non-studio-agent route telemetry envelope emission.
 */
import { describe, expect, it, vi } from "vitest";
import { emitAgentRouteOutcomeTelemetry } from "../agentRouteTelemetry";

describe("emitAgentRouteOutcomeTelemetry", () => {
  it("emits normalized fallback_reason when provided", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    emitAgentRouteOutcomeTelemetry({
      telemetryTag: "generate-prompt",
      routeLabel: "ai/generate-prompt",
      statusCode: 503,
      machineOutcome: {
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
      },
      policyVersion: 1,
      policySchemaVersion: 2,
      promptTemplateVersion: "ptv_abc123",
      runtimeScopeKey: "route:generate-prompt|prompt:ptv_abc123|schema:2|policy:1",
      profileId: "prod_safe_v1",
      modality: "text",
      fallbackReason: "responses_unavailable",
    });

    const telemetryPayload = JSON.parse(String(infoSpy.mock.calls[0]?.[1] ?? "{}")) as Record<
      string,
      unknown
    >;
    expect(telemetryPayload).toEqual(
      expect.objectContaining({
        route: "ai/generate-prompt",
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
        fallback_reason: "responses_unavailable",
        contract_violation: null,
      })
    );
    infoSpy.mockRestore();
  });

  it("emits contract_violation when parse/repair fallback is not output-contract coded", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    emitAgentRouteOutcomeTelemetry({
      telemetryTag: "describe-image",
      routeLabel: "ai/describe-image",
      statusCode: 200,
      machineOutcome: {
        decision: "allow",
        outcome_class: "fallback_infra",
        reason_code: "INFRA_FALLBACK_TRANSIENT",
        retryable: true,
      },
      policyVersion: 1,
      policySchemaVersion: 2,
      promptTemplateVersion: "ptv_abc123",
      runtimeScopeKey: "route:describe-image|prompt:ptv_abc123|schema:2|policy:1",
      profileId: "prod_safe_v1",
      modality: "image",
      fallbackReason: "parse_repair_failed",
    });

    const telemetryPayload = JSON.parse(String(infoSpy.mock.calls[0]?.[1] ?? "{}")) as Record<
      string,
      unknown
    >;
    expect(telemetryPayload).toEqual(
      expect.objectContaining({
        reason_code: "INFRA_FALLBACK_TRANSIENT",
        retryable: true,
        fallback_reason: "parse_repair_failed",
        contract_violation: "parse_repair_reason_code_mismatch",
      })
    );
    infoSpy.mockRestore();
  });
});
