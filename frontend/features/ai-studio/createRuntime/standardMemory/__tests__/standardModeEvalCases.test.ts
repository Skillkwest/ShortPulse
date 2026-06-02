/**
 * Standard memory eval cases.
 * Validates the compact Standard-memory regression catalog against the live memory contract.
 */
import { describe, expect, it } from "vitest";
import { buildStandardSessionMemory } from "../standardSessionMemory";
import { STANDARD_MEMORY_EVAL_CASES } from "../../../../../tests/support/standardModeEvalCases";

describe("Standard memory eval cases", () => {
  it("keeps the eval catalog unique and meaningfully populated", () => {
    expect(STANDARD_MEMORY_EVAL_CASES.length).toBeGreaterThanOrEqual(2);
    expect(new Set(STANDARD_MEMORY_EVAL_CASES.map((testCase) => testCase.id)).size).toBe(
      STANDARD_MEMORY_EVAL_CASES.length
    );
  });

  for (const testCase of STANDARD_MEMORY_EVAL_CASES) {
    it(`${testCase.id}: ${testCase.goal}`, () => {
      const memory = buildStandardSessionMemory(testCase.input);

      expect(memory.workingState.lastAcceptedPrompt).toBe(testCase.expect.lastAcceptedPrompt);
      expect(memory.workingState.nextBestAction).toBe(testCase.expect.nextBestAction);

      if (Object.prototype.hasOwnProperty.call(testCase.expect, "currentTask")) {
        expect(memory.workingState.currentTask).toBe(testCase.expect.currentTask ?? null);
      }

      for (const item of testCase.expect.historicalUserGoalsIncludes ?? []) {
        expect(memory.workingState.historicalUserGoals).toContain(item);
      }

      if (testCase.expect.openQuestions) {
        expect(memory.workingState.openQuestions).toEqual(testCase.expect.openQuestions);
      }

      for (const item of testCase.expect.constraintsIncludes ?? []) {
        expect(memory.workingState.constraints).toContain(item);
      }

      for (const item of testCase.expect.referencesInPlayIncludes ?? []) {
        expect(memory.workingState.referencesInPlay).toContain(item);
      }

      for (const item of testCase.expect.decisionsMadeIncludes ?? []) {
        expect(memory.workingState.decisionsMade).toContain(item);
      }

      expect(memory.summary.text).toContain("Standard session memory:");
    });
  }
});
