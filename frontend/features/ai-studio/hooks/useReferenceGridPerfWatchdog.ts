/**
 * Reference-grid performance watchdog.
 * Subscribes to the shared adaptive-media browser-pressure sampler and applies
 * Reference Grid preview-quality recovery semantics.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  logAdaptiveRecoveryLevelChanged,
  resolveAdaptivePressureDelayedRecoveryTransition,
  subscribeSharedAdaptivePressure,
  type AdaptivePressureRecoveryCandidate,
  type SharedAdaptivePressureState,
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

type PreviewRecoveryCandidate = AdaptivePressureRecoveryCandidate<0 | 1 | 2>;

const initialState = (): ReferenceGridPerfWatchdogState => ({
  degradeLevel: 0,
  previewQualityPressureLevel: 0,
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
 * Returns adaptive degrade level and sampled metrics for runtime grid performance pressure.
 */
export const useReferenceGridPerfWatchdog = ({
  enabled = false,
  memoryGuardEnabled = false,
  evaluationWindowMs = 2500,
  previewRecoveryStableMs = 15_000,
  previewMinChangeIntervalMs = 4_000,
}: UseReferenceGridPerfWatchdogParams): ReferenceGridPerfWatchdogState => {
  const [state, setState] = useState<ReferenceGridPerfWatchdogState>(initialState);
  const previewQualityPressureLevelRef = useRef<0 | 1 | 2>(0);
  const previewRecoveryCandidateRef = useRef<PreviewRecoveryCandidate | null>(null);
  const previewLastChangeAtMsRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      previewQualityPressureLevelRef.current = 0;
      previewRecoveryCandidateRef.current = null;
      previewLastChangeAtMsRef.current = 0;
      return;
    }

    const handleSharedPressureState = (sharedState: SharedAdaptivePressureState) => {
      const currentPreviewLevel = previewQualityPressureLevelRef.current;
      const previewTransition = resolveAdaptivePressureDelayedRecoveryTransition({
        currentLevel: currentPreviewLevel,
        nextLevelCandidate: sharedState.rawPressureLevel,
        recoveryCandidate: previewRecoveryCandidateRef.current,
        nowMs: nowMs(),
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

      setState({
        degradeLevel: sharedState.rawPressureLevel,
        previewQualityPressureLevel: previewQualityPressureLevelRef.current,
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
    previewMinChangeIntervalMs,
    previewRecoveryStableMs,
  ]);

  return useMemo(() => {
    if (!enabled) return initialState();
    return state;
  }, [enabled, state]);
};
