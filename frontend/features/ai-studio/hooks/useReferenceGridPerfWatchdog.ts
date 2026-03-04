/**
 * Reference-grid performance watchdog.
 * Samples long tasks/input-stall/heap pressure and emits a hysteresis-based degrade level.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveAdaptivePressureTransition } from "../../../lib/adaptive-media";

type UseReferenceGridPerfWatchdogParams = {
  enabled?: boolean;
  memoryGuardEnabled?: boolean;
  evaluationWindowMs?: number;
};

export type ReferenceGridPerfWatchdogState = {
  degradeLevel: 0 | 1 | 2;
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
  sampleCount: number;
};

const percentile = (values: number[], ratio: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return Math.round((sorted[index] ?? 0) * 100) / 100;
};

const evaluateCandidateLevel = ({
  longTaskP95Ms,
  maxInputStallMs,
  heapUsageRatio,
  memoryGuardEnabled,
}: {
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
  memoryGuardEnabled: boolean;
}): 0 | 1 | 2 => {
  const heapLevel2 =
    memoryGuardEnabled && typeof heapUsageRatio === "number" && heapUsageRatio >= 0.86;
  const heapLevel1 =
    memoryGuardEnabled && typeof heapUsageRatio === "number" && heapUsageRatio >= 0.75;
  const longTaskLevel2 = typeof longTaskP95Ms === "number" && longTaskP95Ms >= 100;
  const longTaskLevel1 = typeof longTaskP95Ms === "number" && longTaskP95Ms >= 60;
  const stallLevel2 = maxInputStallMs >= 800;
  const stallLevel1 = maxInputStallMs >= 450;

  if (heapLevel2 || longTaskLevel2 || stallLevel2) return 2;
  if (heapLevel1 || longTaskLevel1 || stallLevel1) return 1;
  return 0;
};

/**
 * Returns adaptive degrade level and sampled metrics for runtime grid performance pressure.
 */
export const useReferenceGridPerfWatchdog = ({
  enabled = false,
  memoryGuardEnabled = false,
  evaluationWindowMs = 2500,
}: UseReferenceGridPerfWatchdogParams): ReferenceGridPerfWatchdogState => {
  const initialState: ReferenceGridPerfWatchdogState = {
    degradeLevel: 0,
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
        const longTaskP95Ms = percentile(longTaskDurationsRef.current, 0.95);
        const maxInputStallMs = Math.round(maxInputStallMsRef.current * 100) / 100;
        const heapUsageRatio = (() => {
          const runtimePerformance = performance as Performance & {
            memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
          };
          const used = runtimePerformance.memory?.usedJSHeapSize;
          const total = runtimePerformance.memory?.totalJSHeapSize;
          if (typeof used !== "number" || typeof total !== "number" || total <= 0) return null;
          return Math.round((used / total) * 1000) / 1000;
        })();

        const candidateLevel = evaluateCandidateLevel({
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

        degradeLevelRef.current = nextLevel;
        const previous = stateRef.current;
        const hasChanged =
          previous.degradeLevel !== nextLevel ||
          previous.longTaskP95Ms !== longTaskP95Ms ||
          previous.maxInputStallMs !== maxInputStallMs ||
          previous.heapUsageRatio !== heapUsageRatio;
        if (hasChanged) {
          const nextState: ReferenceGridPerfWatchdogState = {
            degradeLevel: nextLevel,
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
  }, [enabled, evaluationWindowMs, memoryGuardEnabled]);

  return useMemo(() => {
    if (!enabled) {
      return {
        degradeLevel: 0,
        longTaskP95Ms: null,
        maxInputStallMs: 0,
        heapUsageRatio: null,
        sampleCount: 0,
      } satisfies ReferenceGridPerfWatchdogState;
    }
    return state;
  }, [enabled, state]);
};
