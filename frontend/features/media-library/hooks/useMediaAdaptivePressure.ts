/**
 * Media Library adaptive pressure runtime hook.
 * Samples client runtime pressure and exposes a preview-quality pressure level with
 * fast escalation + delayed recovery to avoid preview URL churn.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  logAdaptiveRecoveryLevelChanged,
  resolveAdaptivePressureTransition,
} from "../../../lib/adaptive-media";

type MediaAdaptiveSurface = "media-library-route" | "media-library-modal";

type MediaAdaptivePressureLevel = 0 | 1 | 2;
type MediaPreviewPressureLevel = 0 | 1;

type RecoveryCandidate = {
  level: MediaPreviewPressureLevel;
  sinceMs: number;
};

export type MediaAdaptivePressureState = {
  rawPressureLevel: MediaAdaptivePressureLevel;
  previewPressureLevel: MediaPreviewPressureLevel;
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
  sampleCount: number;
};

type UseMediaAdaptivePressureArgs = {
  surface: MediaAdaptiveSurface;
  enabled: boolean;
  memoryGuardEnabled?: boolean;
  evaluationWindowMs?: number;
  recoveryStableMs?: number;
  minChangeIntervalMs?: number;
};

const STALL_SAMPLE_INTERVAL_MS = 120;

const percentile = (values: number[], ratio: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return Math.round((sorted[index] ?? 0) * 100) / 100;
};

const resolveHeapUsageRatio = (): number | null => {
  if (typeof performance === "undefined") return null;
  const runtimePerformance = performance as Performance & {
    memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
  };
  const used = runtimePerformance.memory?.usedJSHeapSize;
  const total = runtimePerformance.memory?.totalJSHeapSize;
  if (typeof used !== "number" || typeof total !== "number" || total <= 0) return null;
  return Math.round((used / total) * 1000) / 1000;
};

/**
 * Resolves a pressure candidate level from runtime signals.
 */
export const evaluateMediaAdaptiveCandidateLevel = ({
  longTaskP95Ms,
  maxInputStallMs,
  heapUsageRatio,
  memoryGuardEnabled,
}: {
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
  memoryGuardEnabled: boolean;
}): MediaAdaptivePressureLevel => {
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

const toMediaPreviewPressureLevel = (
  level: MediaAdaptivePressureLevel
): MediaPreviewPressureLevel => (level >= 1 ? 1 : 0);

/**
 * Resolves preview-pressure transition with delayed recovery guardrails.
 */
export const resolveMediaPreviewPressureTransition = ({
  currentLevel,
  nextRawLevel,
  recoveryCandidate,
  nowMs,
  lastChangeAtMs,
  recoveryStableMs,
  minChangeIntervalMs,
}: {
  currentLevel: MediaPreviewPressureLevel;
  nextRawLevel: MediaAdaptivePressureLevel;
  recoveryCandidate: RecoveryCandidate | null;
  nowMs: number;
  lastChangeAtMs: number;
  recoveryStableMs: number;
  minChangeIntervalMs: number;
}): {
  nextLevel: MediaPreviewPressureLevel;
  nextRecoveryCandidate: RecoveryCandidate | null;
  nextLastChangeAtMs: number;
  changed: boolean;
} => {
  const nextLevelCandidate = toMediaPreviewPressureLevel(nextRawLevel);
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

  const candidate = recoveryCandidate;
  if (!candidate || candidate.level !== nextLevelCandidate) {
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

  const recoveryStableDurationMs = nowMs - candidate.sinceMs;
  const sinceLastChangeMs = nowMs - lastChangeAtMs;
  if (recoveryStableDurationMs < recoveryStableMs || sinceLastChangeMs < minChangeIntervalMs) {
    return {
      nextLevel: currentLevel,
      nextRecoveryCandidate: candidate,
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

const initialState = (): MediaAdaptivePressureState => ({
  rawPressureLevel: 0,
  previewPressureLevel: 0,
  longTaskP95Ms: null,
  maxInputStallMs: 0,
  heapUsageRatio: null,
  sampleCount: 0,
});

const nowMs = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Returns media-library pressure state for adaptive preview routing.
 */
export const useMediaAdaptivePressure = ({
  surface,
  enabled,
  memoryGuardEnabled = true,
  evaluationWindowMs = 2500,
  recoveryStableMs = 15_000,
  minChangeIntervalMs = 4_000,
}: UseMediaAdaptivePressureArgs): MediaAdaptivePressureState => {
  const [state, setState] = useState<MediaAdaptivePressureState>(initialState);
  const longTaskDurationsRef = useRef<number[]>([]);
  const maxInputStallMsRef = useRef(0);
  const stallTickAtRef = useRef<number | null>(null);
  const rawPressureLevelRef = useRef<MediaAdaptivePressureLevel>(0);
  const previewPressureLevelRef = useRef<MediaPreviewPressureLevel>(0);
  const promoteStreakRef = useRef(0);
  const recoverStreakRef = useRef(0);
  const previewRecoveryCandidateRef = useRef<RecoveryCandidate | null>(null);
  const previewLastChangeAtMsRef = useRef(0);

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

    const stallIntervalId = window.setInterval(() => {
      const now = nowMs();
      const previous = stallTickAtRef.current;
      stallTickAtRef.current = now;
      if (previous == null) return;
      const stallMs = Math.max(0, now - previous - STALL_SAMPLE_INTERVAL_MS);
      if (stallMs > maxInputStallMsRef.current) {
        maxInputStallMsRef.current = stallMs;
      }
    }, STALL_SAMPLE_INTERVAL_MS);

    const evaluationIntervalId = window.setInterval(
      () => {
        const longTaskP95Ms = percentile(longTaskDurationsRef.current, 0.95);
        const maxInputStallMs = Math.round(maxInputStallMsRef.current * 100) / 100;
        const heapUsageRatio = resolveHeapUsageRatio();
        const candidateLevel = evaluateMediaAdaptiveCandidateLevel({
          longTaskP95Ms,
          maxInputStallMs,
          heapUsageRatio,
          memoryGuardEnabled,
        });

        const transition = resolveAdaptivePressureTransition({
          currentLevel: rawPressureLevelRef.current,
          candidateLevel,
          promoteStreak: promoteStreakRef.current,
          recoverStreak: recoverStreakRef.current,
        });
        rawPressureLevelRef.current = transition.nextLevel;
        promoteStreakRef.current = transition.nextPromoteStreak;
        recoverStreakRef.current = transition.nextRecoverStreak;

        const currentPreviewLevel = previewPressureLevelRef.current;
        const currentNow = nowMs();
        const previewTransition = resolveMediaPreviewPressureTransition({
          currentLevel: currentPreviewLevel,
          nextRawLevel: rawPressureLevelRef.current,
          recoveryCandidate: previewRecoveryCandidateRef.current,
          nowMs: currentNow,
          lastChangeAtMs: previewLastChangeAtMsRef.current,
          recoveryStableMs,
          minChangeIntervalMs,
        });
        previewRecoveryCandidateRef.current = previewTransition.nextRecoveryCandidate;
        previewLastChangeAtMsRef.current = previewTransition.nextLastChangeAtMs;
        if (previewTransition.changed && previewTransition.nextLevel !== currentPreviewLevel) {
          previewPressureLevelRef.current = previewTransition.nextLevel;
          logAdaptiveRecoveryLevelChanged({
            surface,
            prevLevel: currentPreviewLevel,
            nextLevel: previewTransition.nextLevel,
          });
        }

        setState((previous) => ({
          rawPressureLevel: rawPressureLevelRef.current,
          previewPressureLevel: previewPressureLevelRef.current,
          longTaskP95Ms,
          maxInputStallMs,
          heapUsageRatio,
          sampleCount: previous.sampleCount + 1,
        }));

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
    minChangeIntervalMs,
    recoveryStableMs,
    surface,
  ]);

  return useMemo(() => {
    if (!enabled) return initialState();
    return state;
  }, [enabled, state]);
};
