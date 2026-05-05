/**
 * Unit tests for non-studio-agent route telemetry envelope emission.
 */
import { describe, expect, it, vi } from "vitest";
import { emitAgentRouteOutcomeTelemetry } from "../agentRouteTelemetry";

describe("emitAgentRouteOutcomeTelemetry", () => {
  it("emits normalized fallback_reason when provided", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    emitAgentRouteOutcomeTelemetry({
      telemetryTag: "extract-style",
      routeLabel: "ai/extract-style",
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
      runtimeScopeKey: "route:extract-style|prompt:ptv_abc123|schema:2|policy:1",
      profileId: "prod_safe_v1",
      modality: "image",
      fallbackReason: "responses_unavailable",
    });

    const telemetryPayload = JSON.parse(String(infoSpy.mock.calls[0]?.[1] ?? "{}")) as Record<
      string,
      unknown
    >;
    expect(telemetryPayload).toEqual(
      expect.objectContaining({
        route: "ai/extract-style",
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

  it("emits contract_violation when parse/repair errors are not output-contract coded", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    emitAgentRouteOutcomeTelemetry({
      telemetryTag: "extract-style",
      routeLabel: "ai/extract-style",
      statusCode: 200,
      machineOutcome: {
        decision: "error",
        outcome_class: "upstream_error",
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
      },
      policyVersion: 1,
      policySchemaVersion: 2,
      promptTemplateVersion: "ptv_abc123",
      runtimeScopeKey: "route:extract-style|prompt:ptv_abc123|schema:2|policy:1",
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
        reason_code: "UPSTREAM_ERROR",
        retryable: true,
        fallback_reason: "parse_repair_failed",
        contract_violation: "parse_repair_reason_code_mismatch",
      })
    );
    infoSpy.mockRestore();
  });
});
