/**
 * Shared adaptive pressure utilities.
 * Centralizes pressure scoring, hysteresis transitions, and delayed recovery helpers.
 */
import type { AdaptivePressureLevel } from "./types";

export type AdaptivePressurePhase = "normal" | "constrained" | "critical";

export type AdaptivePressureTransition = {
  nextLevel: AdaptivePressureLevel;
  nextPromoteStreak: number;
  nextRecoverStreak: number;
  changed: boolean;
};

export type AdaptivePressureSignals = {
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
  memoryGuardEnabled: boolean;
};

export type AdaptivePressureRecoveryCandidate<TLevel extends number = AdaptivePressureLevel> = {
  level: TLevel;
  sinceMs: number;
};

export type AdaptivePressureDelayedRecoveryTransition<TLevel extends number> = {
  nextLevel: TLevel;
  nextRecoveryCandidate: AdaptivePressureRecoveryCandidate<TLevel> | null;
  nextLastChangeAtMs: number;
  changed: boolean;
};

const PRESSURE_LONG_TASK_LEVEL_1_MS = 60;
const PRESSURE_LONG_TASK_LEVEL_2_MS = 100;
const PRESSURE_INPUT_STALL_LEVEL_1_MS = 450;
const PRESSURE_INPUT_STALL_LEVEL_2_MS = 800;
const PRESSURE_HEAP_LEVEL_1_RATIO = 0.75;
const PRESSURE_HEAP_LEVEL_2_RATIO = 0.86;

/**
 * Computes a percentile from a value list.
 */
export const resolveAdaptivePercentile = (values: number[], ratio: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return Math.round((sorted[index] ?? 0) * 100) / 100;
};

/**
 * Reads JS heap usage ratio when available.
 */
export const resolveAdaptiveHeapUsageRatio = (runtimePerformance?: Performance): number | null => {
  const performanceRef =
    runtimePerformance ??
    (typeof performance !== "undefined" ? (performance as Performance) : undefined);
  if (!performanceRef) return null;
  const runtimeWithMemory = performanceRef as Performance & {
    memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
  };
  const used = runtimeWithMemory.memory?.usedJSHeapSize;
  const total = runtimeWithMemory.memory?.totalJSHeapSize;
  if (typeof used !== "number" || typeof total !== "number" || total <= 0) return null;
  return Math.round((used / total) * 1000) / 1000;
};

/**
 * Scores a pressure candidate level from long-task/input-stall/heap signals.
 */
export const evaluateAdaptivePressureCandidateLevel = ({
  longTaskP95Ms,
  maxInputStallMs,
  heapUsageRatio,
  memoryGuardEnabled,
}: AdaptivePressureSignals): AdaptivePressureLevel => {
  const heapLevel2 =
    memoryGuardEnabled &&
    typeof heapUsageRatio === "number" &&
    heapUsageRatio >= PRESSURE_HEAP_LEVEL_2_RATIO;
  const heapLevel1 =
    memoryGuardEnabled &&
    typeof heapUsageRatio === "number" &&
    heapUsageRatio >= PRESSURE_HEAP_LEVEL_1_RATIO;
  const longTaskLevel2 =
    typeof longTaskP95Ms === "number" && longTaskP95Ms >= PRESSURE_LONG_TASK_LEVEL_2_MS;
  const longTaskLevel1 =
    typeof longTaskP95Ms === "number" && longTaskP95Ms >= PRESSURE_LONG_TASK_LEVEL_1_MS;
  const stallLevel2 = maxInputStallMs >= PRESSURE_INPUT_STALL_LEVEL_2_MS;
  const stallLevel1 = maxInputStallMs >= PRESSURE_INPUT_STALL_LEVEL_1_MS;

  if (heapLevel2 || longTaskLevel2 || stallLevel2) return 2;
  if (heapLevel1 || longTaskLevel1 || stallLevel1) return 1;
  return 0;
};

/**
 * Resolves the named browser-pressure phase for surfaces that need
 * low-cardinality policy decisions while preserving numeric budget levels.
 */
export const resolveAdaptivePressurePhase = (
  level: AdaptivePressureLevel
): AdaptivePressurePhase => {
  if (level >= 2) return "critical";
  if (level >= 1) return "constrained";
  return "normal";
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

/**
 * Applies delayed-recovery hysteresis to avoid quick quality churn after pressure drops.
 */
export const resolveAdaptivePressureDelayedRecoveryTransition = <TLevel extends number>({
  currentLevel,
  nextLevelCandidate,
  recoveryCandidate,
  nowMs,
  lastChangeAtMs,
  recoveryStableMs,
  minChangeIntervalMs,
}: {
  currentLevel: TLevel;
  nextLevelCandidate: TLevel;
  recoveryCandidate: AdaptivePressureRecoveryCandidate<TLevel> | null;
  nowMs: number;
  lastChangeAtMs: number;
  recoveryStableMs: number;
  minChangeIntervalMs: number;
}): AdaptivePressureDelayedRecoveryTransition<TLevel> => {
  if (nextLevelCandidate === currentLevel) {
    return {
      nextLevel: currentLevel,
      nextRecoveryCandidate: null,
      nextLastChangeAtMs: lastChangeAtMs,
      changed: false,
    };
  }

  if (nextLevelCandidate > currentLevel) {
    return {
      nextLevel: nextLevelCandidate,
      nextRecoveryCandidate: null,
      nextLastChangeAtMs: nowMs,
      changed: true,
    };
  }

  if (!recoveryCandidate || recoveryCandidate.level !== nextLevelCandidate) {
    return {
      nextLevel: currentLevel,
      nextRecoveryCandidate: {
        level: nextLevelCandidate,
        sinceMs: nowMs,
      },
      nextLastChangeAtMs: lastChangeAtMs,
      changed: false,
    };
  }

  const recoveryStableDurationMs = nowMs - recoveryCandidate.sinceMs;
  const sinceLastChangeMs = nowMs - lastChangeAtMs;
  if (recoveryStableDurationMs < recoveryStableMs || sinceLastChangeMs < minChangeIntervalMs) {
    return {
      nextLevel: currentLevel,
      nextRecoveryCandidate: recoveryCandidate,
      nextLastChangeAtMs: lastChangeAtMs,
      changed: false,
    };
  }

  return {
    nextLevel: nextLevelCandidate,
    nextRecoveryCandidate: null,
    nextLastChangeAtMs: nowMs,
    changed: true,
  };
};
