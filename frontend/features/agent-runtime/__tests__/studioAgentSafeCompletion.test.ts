import { describe, expect, it } from "vitest";
import {
  SAFE_COMPLETION_CONTRACT_VERSION,
  SAFE_COMPLETION_SYSTEM_INSTRUCTION,
  hasAmbiguousAgeSexualSignal,
  resolveSafeCompletionRecoveryEligibility,
  withSafeCompletionRecoveryInstruction,
} from "../studioAgentSafeCompletion";
import {
  SAFE_COMPLETION_CORPUS,
  assertNoSafeCompletionDeadEndMeta,
  assertSafeCompletionExcludes,
  assertSafeCompletionPreserves,
} from "../../../tests/support/safeCompletionCases";

const allowDecision = {
  action: "allow" as const,
  source: "profile" as const,
  profileId: "prod_safe_v1" as const,
  category: "safe" as const,
  modality: "text" as const,
  hardFloorViolation: false,
};

describe("studioAgentSafeCompletion", () => {
  it("defines a versioned same-turn completion contract without resubmission language", () => {
    expect(SAFE_COMPLETION_CONTRACT_VERSION).toBeTruthy();
    expect(SAFE_COMPLETION_SYSTEM_INSTRUCTION).toContain("complete the requested work");
    expect(SAFE_COMPLETION_SYSTEM_INSTRUCTION).toContain("same response");
    expect(SAFE_COMPLETION_SYSTEM_INSTRUCTION).toContain("Do not give a policy lecture");
    expect(SAFE_COMPLETION_SYSTEM_INSTRUCTION).toContain("ask the user to resubmit");
  });

  it("permits one recovery only with affirmative server safety evidence", () => {
    expect(
      resolveSafeCompletionRecoveryEligibility({
        enabled: true,
        inputPrecheckEnabled: true,
        decision: allowDecision,
        latestUserText: "Write a cinematic basketball prompt.",
        refusalSource: "typed_model",
      })
    ).toEqual({ eligible: true });
    expect(
      resolveSafeCompletionRecoveryEligibility({
        enabled: true,
        inputPrecheckEnabled: true,
        decision: allowDecision,
        latestUserText: "Write a cinematic basketball prompt.",
        refusalSource: "typed_model",
        alreadyAttempted: true,
      })
    ).toEqual({ eligible: false, skipReason: "already_attempted" });
  });

  it("fails recovery closed for hard floors and ambiguous-age sexual signals", () => {
    expect(hasAmbiguousAgeSexualSignal("a sexualized young-looking teen in lingerie")).toBe(true);
    expect(
      resolveSafeCompletionRecoveryEligibility({
        enabled: true,
        inputPrecheckEnabled: true,
        decision: allowDecision,
        latestUserText: "a sexualized young-looking teen in lingerie",
        refusalSource: "semantic_model",
      })
    ).toEqual({ eligible: false, skipReason: "ambiguous_age_sexual_signal" });
    expect(
      resolveSafeCompletionRecoveryEligibility({
        enabled: true,
        inputPrecheckEnabled: true,
        decision: {
          ...allowDecision,
          action: "refuse",
          source: "hard_floor",
          hardFloorViolation: true,
        },
        latestUserText: "unsafe",
        refusalSource: "semantic_model",
      })
    ).toEqual({ eligible: false, skipReason: "hard_floor" });
  });

  it("does not resend provider-bound media without an authoritative image safety decision", () => {
    expect(
      resolveSafeCompletionRecoveryEligibility({
        enabled: true,
        inputPrecheckEnabled: true,
        decision: allowDecision,
        latestUserText: "Describe this attached image safely.",
        refusalSource: "typed_model",
        hasUnclassifiedMedia: true,
      })
    ).toEqual({ eligible: false, skipReason: "unclassified_media" });
  });

  it("inserts recovery after the complete system block and before user content", () => {
    const messages = withSafeCompletionRecoveryInstruction([
      { role: "system", content: "base" },
      { role: "system", content: "active profile" },
      { role: "user", content: "request" },
    ]);
    expect(messages.map((message) => message.role)).toEqual(["system", "system", "system", "user"]);
    expect(messages[2]?.content).toContain("SAFE COMPLETION RECOVERY");
  });

  it("keeps the screenshot-derived safe repair usable and free of dead-end language", () => {
    const testCase = SAFE_COMPLETION_CORPUS.cases.find(
      (entry) => entry.id === "mixed_basketball_safe_completion"
    );
    expect(testCase?.safeRepairFixture).toBeTruthy();
    const output = testCase?.safeRepairFixture ?? "";
    assertSafeCompletionPreserves(output, testCase?.expected.mustPreserve ?? []);
    assertSafeCompletionExcludes(output, testCase?.expected.mustExclude ?? []);
    assertNoSafeCompletionDeadEndMeta(output);
  });
});
