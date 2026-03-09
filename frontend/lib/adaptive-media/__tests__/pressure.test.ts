import { describe, expect, it } from "vitest";
import {
  evaluateAdaptivePressureCandidateLevel,
  resolveAdaptivePressureDelayedRecoveryTransition,
  resolveAdaptivePressureTransition,
} from "../pressure";

describe("adaptive-media pressure transitions", () => {
  it("promotes pressure level after threshold streak", () => {
    const first = resolveAdaptivePressureTransition({
      currentLevel: 0,
      candidateLevel: 1,
      promoteStreak: 0,
      recoverStreak: 0,
    });
    expect(first.nextLevel).toBe(0);
    expect(first.nextPromoteStreak).toBe(1);

    const second = resolveAdaptivePressureTransition({
      currentLevel: 0,
      candidateLevel: 1,
      promoteStreak: first.nextPromoteStreak,
      recoverStreak: 0,
    });
    expect(second.nextLevel).toBe(1);
    expect(second.changed).toBe(true);
  });

  it("recovers pressure level after stable recovery streak", () => {
    let currentLevel: 0 | 1 | 2 = 2;
    let recoverStreak = 0;

    for (let idx = 0; idx < 3; idx += 1) {
      const step = resolveAdaptivePressureTransition({
        currentLevel,
        candidateLevel: 1,
        promoteStreak: 0,
        recoverStreak,
      });
      currentLevel = step.nextLevel;
      recoverStreak = step.nextRecoverStreak;
      expect(currentLevel).toBe(2);
    }

    const finalStep = resolveAdaptivePressureTransition({
      currentLevel,
      candidateLevel: 1,
      promoteStreak: 0,
      recoverStreak,
    });

    expect(finalStep.nextLevel).toBe(1);
    expect(finalStep.changed).toBe(true);
  });

  it("scores candidate levels from long-task and stall signals", () => {
    expect(
      evaluateAdaptivePressureCandidateLevel({
        longTaskP95Ms: 110,
        maxInputStallMs: 120,
        heapUsageRatio: 0.5,
        memoryGuardEnabled: true,
      })
    ).toBe(2);
    expect(
      evaluateAdaptivePressureCandidateLevel({
        longTaskP95Ms: 72,
        maxInputStallMs: 120,
        heapUsageRatio: 0.5,
        memoryGuardEnabled: true,
      })
    ).toBe(1);
  });

  it("delays recovery transitions until stable duration and min interval pass", () => {
    const first = resolveAdaptivePressureDelayedRecoveryTransition({
      currentLevel: 2 as const,
      nextLevelCandidate: 1 as const,
      recoveryCandidate: null,
      nowMs: 1_000,
      lastChangeAtMs: 800,
      recoveryStableMs: 1_500,
      minChangeIntervalMs: 500,
    });
    expect(first.nextLevel).toBe(2);
    expect(first.changed).toBe(false);

    const stillPending = resolveAdaptivePressureDelayedRecoveryTransition({
      currentLevel: 2 as const,
      nextLevelCandidate: 1 as const,
      recoveryCandidate: first.nextRecoveryCandidate,
      nowMs: 2_000,
      lastChangeAtMs: 800,
      recoveryStableMs: 1_500,
      minChangeIntervalMs: 500,
    });
    expect(stillPending.nextLevel).toBe(2);
    expect(stillPending.changed).toBe(false);

    const recovered = resolveAdaptivePressureDelayedRecoveryTransition({
      currentLevel: 2 as const,
      nextLevelCandidate: 1 as const,
      recoveryCandidate: first.nextRecoveryCandidate,
      nowMs: 2_700,
      lastChangeAtMs: 800,
      recoveryStableMs: 1_500,
      minChangeIntervalMs: 500,
    });
    expect(recovered.nextLevel).toBe(1);
    expect(recovered.changed).toBe(true);
  });
});
