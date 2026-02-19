import type { AdaptivePressureLevel } from "./types";

export type AdaptivePressureTransition = {
  nextLevel: AdaptivePressureLevel;
  nextPromoteStreak: number;
  nextRecoverStreak: number;
  changed: boolean;
};

export const resolveAdaptivePressureTransition = ({
  currentLevel,
  candidateLevel,
  promoteStreak,
  recoverStreak,
}: {
  currentLevel: AdaptivePressureLevel;
  candidateLevel: AdaptivePressureLevel;
  promoteStreak: number;
  recoverStreak: number;
}): AdaptivePressureTransition => {
  if (candidateLevel > currentLevel) {
    const nextPromoteStreak = promoteStreak + 1;
    const promoteThreshold = candidateLevel === 2 ? 2 : 2;
    if (nextPromoteStreak >= promoteThreshold) {
      return {
        nextLevel: candidateLevel,
        nextPromoteStreak: 0,
        nextRecoverStreak: 0,
        changed: true,
      };
    }
    return {
      nextLevel: currentLevel,
      nextPromoteStreak,
      nextRecoverStreak: 0,
      changed: false,
    };
  }

  if (candidateLevel < currentLevel) {
    const nextRecoverStreak = recoverStreak + 1;
    const recoverThreshold = currentLevel === 2 ? 4 : 3;
    if (nextRecoverStreak >= recoverThreshold) {
      return {
        nextLevel: candidateLevel,
        nextPromoteStreak: 0,
        nextRecoverStreak: 0,
        changed: true,
      };
    }

    return {
      nextLevel: currentLevel,
      nextPromoteStreak: 0,
      nextRecoverStreak,
      changed: false,
    };
  }

  return {
    nextLevel: currentLevel,
    nextPromoteStreak: 0,
    nextRecoverStreak: 0,
    changed: false,
  };
};
