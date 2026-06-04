/**
 * Media Library adaptive pressure runtime hook.
 * Samples client runtime pressure and exposes a preview-quality pressure level with
 * fast escalation + delayed recovery to avoid preview URL churn.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateAdaptivePressureCandidateLevel,
  logAdaptiveRecoveryLevelChanged,
  resolveAdaptiveHeapUsageRatio,
  resolveAdaptivePercentile,
  resolveAdaptivePressureDelayedRecoveryTransition,
  resolveAdaptivePressureTransition,
  type AdaptivePressureLevel,
  type AdaptivePressureRecoveryCandidate,
} from "../../../lib/adaptive-media";

type MediaAdaptiveSurface =
  | "media-library-modal"
  | "media-library-panel"
  | "elements-media-panel"
  | "character-media-panel"
  | "character-grid";

type MediaPreviewPressureLevel = 0 | 1;

type RecoveryCandidate = AdaptivePressureRecoveryCandidate<MediaPreviewPressureLevel>;

export type MediaAdaptivePressureState = {
  rawPressureLevel: AdaptivePressureLevel;
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
}): AdaptivePressureLevel =>
  evaluateAdaptivePressureCandidateLevel({
    longTaskP95Ms,
    maxInputStallMs,
    heapUsageRatio,
    memoryGuardEnabled,
  });

const toMediaPreviewPressureLevel = (level: AdaptivePressureLevel): MediaPreviewPressureLevel =>
  level >= 1 ? 1 : 0;

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
  nextRawLevel: AdaptivePressureLevel;
  recoveryCandidate: RecoveryCandidate | null;
  nowMs: number;
  lastChangeAtMs: number;
  recoveryStableMs: number;
  minChangeIntervalMs: number;
}) =>
  resolveAdaptivePressureDelayedRecoveryTransition<MediaPreviewPressureLevel>({
    currentLevel,
    nextLevelCandidate: toMediaPreviewPressureLevel(nextRawLevel),
    recoveryCandidate,
    nowMs,
    lastChangeAtMs,
    recoveryStableMs,
    minChangeIntervalMs,
  });

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

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

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
  const rawPressureLevelRef = useRef<AdaptivePressureLevel>(0);
  const previewPressureLevelRef = useRef<MediaPreviewPressureLevel>(0);
  const promoteStreakRef = useRef(0);
  const recoverStreakRef = useRef(0);
  const previewRecoveryCandidateRef = useRef<RecoveryCandidate | null>(null);
  const previewLastChangeAtMsRef = useRef(0);
  const [documentVisible, setDocumentVisible] = useState(isDocumentVisible);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const updateDocumentVisible = () => {
      setDocumentVisible(isDocumentVisible());
    };
    updateDocumentVisible();
    document.addEventListener("visibilitychange", updateDocumentVisible);
    return () => {
      document.removeEventListener("visibilitychange", updateDocumentVisible);
    };
  }, [enabled]);

  const samplingEnabled = enabled && documentVisible;

  useEffect(() => {
    if (!samplingEnabled || typeof window === "undefined") return;
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
        const longTaskP95Ms = resolveAdaptivePercentile(longTaskDurationsRef.current, 0.95);
        const maxInputStallMs = Math.round(maxInputStallMsRef.current * 100) / 100;
        const heapUsageRatio = resolveAdaptiveHeapUsageRatio();
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
    evaluationWindowMs,
    memoryGuardEnabled,
    minChangeIntervalMs,
    recoveryStableMs,
    samplingEnabled,
    surface,
  ]);

  return useMemo(() => {
    if (!samplingEnabled) return initialState();
    return state;
  }, [samplingEnabled, state]);
};
