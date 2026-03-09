/**
 * Reference-grid performance watchdog.
 * Samples long tasks/input-stall/heap pressure and emits a hysteresis-based degrade level.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateAdaptivePressureCandidateLevel,
  logAdaptiveRecoveryLevelChanged,
  resolveAdaptiveHeapUsageRatio,
  resolveAdaptivePercentile,
  resolveAdaptivePressureDelayedRecoveryTransition,
  resolveAdaptivePressureTransition,
} from "../../../lib/adaptive-media";

type UseReferenceGridPerfWatchdogParams = {
  enabled?: boolean;
  memoryGuardEnabled?: boolean;
  evaluationWindowMs?: number;
  previewRecoveryStableMs?: number;
  previewMinChangeIntervalMs?: number;
};

export type ReferenceGridPerfWatchdogState = {
  degradeLevel: 0 | 1 | 2;
  previewQualityPressureLevel: 0 | 1 | 2;
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
  sampleCount: number;
};

/**
 * Returns adaptive degrade level and sampled metrics for runtime grid performance pressure.
 */
export const useReferenceGridPerfWatchdog = ({
  enabled = false,
  memoryGuardEnabled = false,
  evaluationWindowMs = 2500,
  previewRecoveryStableMs = 15_000,
  previewMinChangeIntervalMs = 4_000,
}: UseReferenceGridPerfWatchdogParams): ReferenceGridPerfWatchdogState => {
  const initialState: ReferenceGridPerfWatchdogState = {
    degradeLevel: 0,
    previewQualityPressureLevel: 0,
    longTaskP95Ms: null,
    maxInputStallMs: 0,
    heapUsageRatio: null,
    sampleCount: 0,
  };
  const [state, setState] = useState<ReferenceGridPerfWatchdogState>(initialState);
  const stateRef = useRef<ReferenceGridPerfWatchdogState>(initialState);
  const longTaskDurationsRef = useRef<number[]>([]);
  const maxInputStallMsRef = useRef(0);
  const stallTickAtRef = useRef<number | null>(null);
  const degradeLevelRef = useRef<0 | 1 | 2>(0);
  const previewQualityPressureLevelRef = useRef<0 | 1 | 2>(0);
  const previewRecoveryCandidateRef = useRef<{ level: 0 | 1 | 2; sinceMs: number } | null>(null);
  const previewLastChangeAtMsRef = useRef(0);
  const promoteStreakRef = useRef(0);
  const recoverStreakRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let longTaskObserver: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== "undefined") {
      longTaskObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
          longTaskDurationsRef.current.push(entry.duration);
        });
      });
      try {
        longTaskObserver.observe({ type: "longtask", buffered: true });
      } catch {
        longTaskObserver.disconnect();
        longTaskObserver = null;
      }
    }

    const STALL_SAMPLE_INTERVAL_MS = 120;
    const stallIntervalId = window.setInterval(() => {
      const expected = STALL_SAMPLE_INTERVAL_MS;
      const now = performance.now();
      const previous = stallTickAtRef.current;
      stallTickAtRef.current = now;
      if (previous == null) return;
      const stallMs = Math.max(0, now - previous - expected);
      if (stallMs > maxInputStallMsRef.current) {
        maxInputStallMsRef.current = stallMs;
      }
    }, STALL_SAMPLE_INTERVAL_MS);

    const evaluationIntervalId = window.setInterval(
      () => {
        const longTaskP95Ms = resolveAdaptivePercentile(longTaskDurationsRef.current, 0.95);
        const maxInputStallMs = Math.round(maxInputStallMsRef.current * 100) / 100;
        const heapUsageRatio = resolveAdaptiveHeapUsageRatio(performance);

        const candidateLevel = evaluateAdaptivePressureCandidateLevel({
          longTaskP95Ms,
          maxInputStallMs,
          heapUsageRatio,
          memoryGuardEnabled,
        });
        const currentLevel = degradeLevelRef.current;
        let nextLevel: 0 | 1 | 2 = currentLevel;

        const transition = resolveAdaptivePressureTransition({
          currentLevel,
          candidateLevel,
          promoteStreak: promoteStreakRef.current,
          recoverStreak: recoverStreakRef.current,
        });
        nextLevel = transition.nextLevel;
        promoteStreakRef.current = transition.nextPromoteStreak;
        recoverStreakRef.current = transition.nextRecoverStreak;

        const now =
          typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now();
        const currentPreviewLevel = previewQualityPressureLevelRef.current;
        const previewTransition = resolveAdaptivePressureDelayedRecoveryTransition({
          currentLevel: currentPreviewLevel,
          nextLevelCandidate: nextLevel,
          recoveryCandidate: previewRecoveryCandidateRef.current,
          nowMs: now,
          lastChangeAtMs: previewLastChangeAtMsRef.current,
          recoveryStableMs: previewRecoveryStableMs,
          minChangeIntervalMs: previewMinChangeIntervalMs,
        });
        previewRecoveryCandidateRef.current = previewTransition.nextRecoveryCandidate;
        previewLastChangeAtMsRef.current = previewTransition.nextLastChangeAtMs;
        if (previewTransition.changed && previewTransition.nextLevel !== currentPreviewLevel) {
          previewQualityPressureLevelRef.current = previewTransition.nextLevel;
          logAdaptiveRecoveryLevelChanged({
            surface: "reference-grid",
            prevLevel: currentPreviewLevel,
            nextLevel: previewTransition.nextLevel,
          });
        }

        degradeLevelRef.current = nextLevel;
        const previous = stateRef.current;
        const hasChanged =
          previous.degradeLevel !== nextLevel ||
          previous.previewQualityPressureLevel !== previewQualityPressureLevelRef.current ||
          previous.longTaskP95Ms !== longTaskP95Ms ||
          previous.maxInputStallMs !== maxInputStallMs ||
          previous.heapUsageRatio !== heapUsageRatio;
        if (hasChanged) {
          const nextState: ReferenceGridPerfWatchdogState = {
            degradeLevel: nextLevel,
            previewQualityPressureLevel: previewQualityPressureLevelRef.current,
            longTaskP95Ms,
            maxInputStallMs,
            heapUsageRatio,
            sampleCount: previous.sampleCount + 1,
          };
          stateRef.current = nextState;
          setState(nextState);
        }

        longTaskDurationsRef.current = [];
        maxInputStallMsRef.current = 0;
        stallTickAtRef.current = null;
      },
      Math.max(1000, evaluationWindowMs)
    );

    return () => {
      longTaskObserver?.disconnect();
      window.clearInterval(stallIntervalId);
      window.clearInterval(evaluationIntervalId);
    };
  }, [
    enabled,
    evaluationWindowMs,
    memoryGuardEnabled,
    previewMinChangeIntervalMs,
    previewRecoveryStableMs,
  ]);

  return useMemo(() => {
    if (!enabled) {
      return {
        degradeLevel: 0,
        previewQualityPressureLevel: 0,
        longTaskP95Ms: null,
        maxInputStallMs: 0,
        heapUsageRatio: null,
        sampleCount: 0,
      } satisfies ReferenceGridPerfWatchdogState;
    }
    return state;
  }, [enabled, state]);
};
