import { describe, expect, it } from "vitest";
import { buildAgentMachineOutcome, resolveInfraFallbackReasonCode } from "../agentMachineOutcome";

describe("agentMachineOutcome", () => {
  it("builds success prompt contract fields", () => {
    expect(buildAgentMachineOutcome({ outcomeClass: "success_prompt" })).toEqual({
      decision: "allow",
      outcome_class: "success_prompt",
      reason_code: "SUCCESS_PROMPT",
      retryable: false,
    });
  });

  it("marks request-invalid route errors as non-retryable", () => {
    expect(
      buildAgentMachineOutcome({
        outcomeClass: "route_error",
        reasonCode: "REQUEST_INVALID",
      })
    ).toEqual({
      decision: "error",
      outcome_class: "route_error",
      reason_code: "REQUEST_INVALID",
      retryable: false,
    });
  });

  it("derives infra fallback reason codes from status and error detail", () => {
    expect(resolveInfraFallbackReasonCode({ status: 429, detail: "rate limited" })).toBe(
      "INFRA_FALLBACK_RATE_LIMIT"
    );
    expect(resolveInfraFallbackReasonCode({ status: 504, detail: "gateway timeout" })).toBe(
      "INFRA_FALLBACK_TIMEOUT"
    );
    expect(
      resolveInfraFallbackReasonCode({
        status: 500,
        detail: "Fast-path output parse/repair failed",
      })
    ).toBe("INFRA_FALLBACK_OUTPUT_CONTRACT");
    expect(resolveInfraFallbackReasonCode({ detail: "socket hang up" })).toBe(
      "INFRA_FALLBACK_TRANSIENT"
    );
  });

  it("marks output-contract fallback reason codes as non-retryable", () => {
    expect(
      buildAgentMachineOutcome({
        outcomeClass: "fallback_infra",
        reasonCode: "INFRA_FALLBACK_OUTPUT_CONTRACT",
      })
    ).toEqual({
      decision: "allow",
      outcome_class: "fallback_infra",
      reason_code: "INFRA_FALLBACK_OUTPUT_CONTRACT",
      retryable: false,
    });
  });

  it("falls back to outcome defaults when reason code is invalid for class", () => {
    expect(
      buildAgentMachineOutcome({
        outcomeClass: "upstream_error",
        reasonCode: "REQUEST_INVALID",
      })
    ).toEqual({
      decision: "error",
      outcome_class: "upstream_error",
      reason_code: "UPSTREAM_ERROR",
      retryable: true,
    });
  });
});
