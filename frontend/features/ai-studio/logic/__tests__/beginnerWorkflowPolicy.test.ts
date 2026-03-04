/**
 * Beginner workflow policy tests.
 * Ensures workflow-level beginner flags are explicit and deterministic.
 */
import { describe, expect, it } from "vitest";
import { createWorkflowBeginnerModePolicy } from "../beginnerWorkflowPolicy";

describe("createWorkflowBeginnerModePolicy", () => {
  it("enables beginner mode across workflows when preference is on", () => {
    const policy = createWorkflowBeginnerModePolicy(true, true, true);

    expect(policy.create.beginnerMode).toBe(true);
    expect(policy.create.expertCreateEligible).toBe(false);
    expect(policy.edit.beginnerMode).toBe(true);
    expect(policy.edit.expertEditEligible).toBe(false);
    expect(policy.video.beginnerMode).toBe(true);
    expect(policy.character.beginnerMode).toBe(true);
  });

  it("allows expert create only when beginner mode is off and env allows it", () => {
    expect(createWorkflowBeginnerModePolicy(false, true, true).create.expertCreateEligible).toBe(
      true
    );
    expect(createWorkflowBeginnerModePolicy(false, false, true).create.expertCreateEligible).toBe(
      false
    );
  });

  it("allows expert edit only when beginner mode is off and env allows it", () => {
    expect(createWorkflowBeginnerModePolicy(false, true, true).edit.expertEditEligible).toBe(true);
    expect(createWorkflowBeginnerModePolicy(false, true, false).edit.expertEditEligible).toBe(
      false
    );
  });
});
