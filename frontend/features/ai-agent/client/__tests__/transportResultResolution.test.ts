import { describe, expect, it } from "vitest";
import { resolveStudioAgentTransportFailure } from "../transportResultResolution";

describe("resolveStudioAgentTransportFailure", () => {
  it("preserves fallback reason metadata for infra fallback responses", () => {
    const result = resolveStudioAgentTransportFailure({
      ok: false,
      status: 502,
      detail: "Fast-path output parse/repair failed",
      rawBody: "",
      parsedError: {
        decision: "allow",
        outcome_class: "fallback_infra",
        message: "I can't process that request right now. Please try again.",
        reason_code: "INFRA_FALLBACK_OUTPUT_CONTRACT",
        fallback_reason: "parse_repair_failed",
      },
    });

    expect(result.assistantMessage).toBe(
      "I can't process that request right now. Please try again."
    );
    expect(result.response).toEqual(
      expect.objectContaining({
        decision: "allow",
        outcome_class: "fallback_infra",
        reason_code: "INFRA_FALLBACK_OUTPUT_CONTRACT",
        fallback_reason: "parse_repair_failed",
      })
    );
    expect(result.errorText).toBeNull();
  });
});
