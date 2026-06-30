/**
 * Media Library adaptive pressure runtime hook.
 * Samples client runtime pressure and exposes a preview-quality pressure level with
 * fast escalation + delayed recovery to avoid preview URL churn.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateAdaptivePressureCandidateLevel,
  logAdaptiveRecoveryLevelChanged,
  resolveAdaptivePressureDelayedRecoveryTransition,
  subscribeSharedAdaptivePressure,
  type AdaptivePressureLevel,
  type AdaptivePressurePhase,
  type AdaptivePressureRecoveryCandidate,
  type SharedAdaptivePressureState,
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
  pressurePhase: AdaptivePressurePhase;
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
  pressurePhase: "normal",
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
  const previewPressureLevelRef = useRef<MediaPreviewPressureLevel>(0);
  const recoveryCandidateRef = useRef<RecoveryCandidate | null>(null);
  const previewLastChangeAtMsRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      previewPressureLevelRef.current = 0;
      recoveryCandidateRef.current = null;
      previewLastChangeAtMsRef.current = 0;
      return;
    }
    const handleSharedPressureState = (sharedState: SharedAdaptivePressureState) => {
      const currentPreviewLevel = previewPressureLevelRef.current;
      const previewTransition = resolveMediaPreviewPressureTransition({
        currentLevel: currentPreviewLevel,
        nextRawLevel: sharedState.rawPressureLevel,
        recoveryCandidate: recoveryCandidateRef.current,
        nowMs: nowMs(),
        lastChangeAtMs: previewLastChangeAtMsRef.current,
        recoveryStableMs,
        minChangeIntervalMs,
      });
      recoveryCandidateRef.current = previewTransition.nextRecoveryCandidate;
      previewLastChangeAtMsRef.current = previewTransition.nextLastChangeAtMs;
      if (previewTransition.changed && previewTransition.nextLevel !== currentPreviewLevel) {
        previewPressureLevelRef.current = previewTransition.nextLevel;
        logAdaptiveRecoveryLevelChanged({
          surface,
          prevLevel: currentPreviewLevel,
          nextLevel: previewTransition.nextLevel,
        });
      }

      setState({
        rawPressureLevel: sharedState.rawPressureLevel,
        pressurePhase: sharedState.pressurePhase,
        previewPressureLevel: previewPressureLevelRef.current,
        longTaskP95Ms: sharedState.longTaskP95Ms,
        maxInputStallMs: sharedState.maxInputStallMs,
        heapUsageRatio: sharedState.heapUsageRatio,
        sampleCount: sharedState.sampleCount,
      });
    };
    return subscribeSharedAdaptivePressure({
      config: {
        memoryGuardEnabled,
        evaluationWindowMs,
      },
      notify: handleSharedPressureState,
    });
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
