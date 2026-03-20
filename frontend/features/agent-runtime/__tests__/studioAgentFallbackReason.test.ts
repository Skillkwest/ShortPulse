import { describe, expect, it } from "vitest";
import { resolveStudioAgentFallbackReasonLabel } from "../studioAgentFallbackReason";

describe("resolveStudioAgentFallbackReasonLabel", () => {
  it("prioritizes normalized stage labels when stage is present", () => {
    expect(resolveStudioAgentFallbackReasonLabel({ stage: "fast_path_repair_turn" })).toBe(
      "stage_fast_path_repair_turn"
    );
    expect(resolveStudioAgentFallbackReasonLabel({ stage: "v2 thinker/fallback" })).toBe(
      "stage_v2_thinker_fallback"
    );
  });

  it("classifies known detail patterns before generic status buckets", () => {
    expect(
      resolveStudioAgentFallbackReasonLabel({
        status: 503,
        detail: "responses unavailable",
      })
    ).toBe("responses_unavailable");
    expect(
      resolveStudioAgentFallbackReasonLabel({
        status: 502,
        detail: "Fast-path output parse/repair failed",
      })
    ).toBe("parse_repair_failed");
    expect(
      resolveStudioAgentFallbackReasonLabel({
        status: 502,
        detail: "Expected property name in JSON at position 1",
      })
    ).toBe("json_parse_failure");
  });

  it("falls back to status buckets and runtime default", () => {
    expect(resolveStudioAgentFallbackReasonLabel({ status: 429 })).toBe("rate_limit");
    expect(resolveStudioAgentFallbackReasonLabel({ status: 504 })).toBe("timeout");
    expect(resolveStudioAgentFallbackReasonLabel({ status: 503 })).toBe("upstream_unavailable");
    expect(resolveStudioAgentFallbackReasonLabel({ status: 400 })).toBe("upstream_error");
    expect(resolveStudioAgentFallbackReasonLabel({ detail: "socket hang up" })).toBe(
      "runtime_failure"
    );
  });
});
