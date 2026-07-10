import { describe, expect, it } from "vitest";
import { finalizeStudioAgentResponseSafety } from "../studioAgentSafetyResponseFinalizer";
import { resolveSafetyPolicyDocument } from "../safetyPolicy/policyDocument";
import {
  SAFE_COMPLETION_CORPUS,
  assertSafeCompletionExcludes,
} from "../../../tests/support/safeCompletionCases";

const policyDocument = resolveSafetyPolicyDocument({ profileId: "prod_safe_v1" });

describe("studioAgentSafetyResponseFinalizer", () => {
  it("rewrites both reusable artifacts and visible messages through the shared finalizer", async () => {
    const result = await finalizeStudioAgentResponseSafety({
      response: {
        message: "A sexy topless editorial portrait.",
        actions: { applyPrompt: "A sexy topless editorial portrait in lingerie." },
      },
      refusal: false,
      canonicalPrompt: null,
      fallbackCanonicalPrompt: null,
      route: "studio-agent",
      flow: "TEXT_ONLY",
      mode: "enforce",
      debug: false,
      profileId: "prod_safe_v1",
      environment: "production",
      devAbsoluteZeroEnabled: false,
      modality: "text",
      policyDocument,
    });

    expect(result.outcome).toBe("rewritten");
    expect(result.refusal).toBe(false);
    expect(result.response.message.toLowerCase()).not.toMatch(/sexy|topless|lingerie/);
    expect(result.response.actions?.applyPrompt?.toLowerCase()).not.toMatch(
      /sexy|topless|lingerie/
    );
  });

  it("turns an unsafe recovered artifact into the actionless safety refusal", async () => {
    const result = await finalizeStudioAgentResponseSafety({
      response: {
        message: "Graphic sexual intercourse with visible genitals.",
        actions: { applyPrompt: "Graphic sexual intercourse with visible genitals." },
      },
      refusal: false,
      canonicalPrompt: "prior safe prompt",
      fallbackCanonicalPrompt: "prior safe prompt",
      route: "studio-agent-pulse",
      flow: "TEXT_ONLY",
      mode: "enforce",
      debug: false,
      profileId: "prod_safe_v1",
      environment: "production",
      devAbsoluteZeroEnabled: false,
      modality: "text",
      policyDocument,
    });

    expect(result.refusal).toBe(true);
    expect(result.forcedRefusal).toBe(true);
    expect(result.response).toEqual({ message: "I cannot describe this.", actions: undefined });
    expect(result.canonicalPrompt).toBe("prior safe prompt");
  });

  it("removes every prohibited contact pattern from the screenshot-derived unsafe repair", async () => {
    const testCase = SAFE_COMPLETION_CORPUS.cases.find(
      (entry) => entry.id === "mixed_basketball_safe_completion"
    );
    const unsafeRepair = testCase?.unsafeRepairFixture ?? "";
    const result = await finalizeStudioAgentResponseSafety({
      response: { message: unsafeRepair, actions: { applyPrompt: unsafeRepair } },
      refusal: false,
      canonicalPrompt: null,
      fallbackCanonicalPrompt: null,
      route: "studio-agent",
      flow: "TEXT_ONLY",
      mode: "enforce",
      debug: false,
      profileId: "prod_safe_v1",
      environment: "production",
      devAbsoluteZeroEnabled: false,
      modality: "text",
      policyDocument,
    });

    expect(result.outcome).toBe("rewritten");
    expect(result.refusal).toBe(false);
    assertSafeCompletionExcludes(
      `${result.response.message}\n${result.response.actions?.applyPrompt ?? ""}`,
      testCase?.expected.mustExclude ?? []
    );
  });
});
