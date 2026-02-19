import { describe, expect, it } from "vitest";
import { resolveAdaptivePressureTransition } from "../pressure";

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
});
