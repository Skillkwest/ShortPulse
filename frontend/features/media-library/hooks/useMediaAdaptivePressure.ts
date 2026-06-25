/**
 * Media Library adaptive pressure runtime hook.
 * Samples client runtime pressure and exposes a preview-quality pressure level with
 * fast escalation + delayed recovery to avoid preview URL churn.
 */
import { useEffect, useMemo, useState } from "react";
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

type SharedMediaAdaptivePressureConfig = Required<
  Pick<
    UseMediaAdaptivePressureArgs,
    "memoryGuardEnabled" | "evaluationWindowMs" | "recoveryStableMs" | "minChangeIntervalMs"
  >
>;

type SharedMediaAdaptivePressureSubscriber = {
  surface: MediaAdaptiveSurface;
  config: SharedMediaAdaptivePressureConfig;
  notify: (state: MediaAdaptivePressureState) => void;
};

const sharedMediaAdaptivePressure = {
  subscribers: new Map<symbol, SharedMediaAdaptivePressureSubscriber>(),
  state: initialState(),
  longTaskDurations: [] as number[],
  maxInputStallMs: 0,
  stallTickAtMs: null as number | null,
  rawPressureLevel: 0 as AdaptivePressureLevel,
  previewPressureLevel: 0 as MediaPreviewPressureLevel,
  promoteStreak: 0,
  recoverStreak: 0,
  previewRecoveryCandidate: null as RecoveryCandidate | null,
  previewLastChangeAtMs: 0,
  documentVisible: isDocumentVisible(),
  visibilityListenerAttached: false,
  longTaskObserver: null as PerformanceObserver | null,
  stallIntervalId: null as number | null,
  evaluationIntervalId: null as number | null,
  activeConfigKey: "",
};

const emitSharedMediaAdaptivePressureState = (state: MediaAdaptivePressureState) => {
  sharedMediaAdaptivePressure.state = state;
  sharedMediaAdaptivePressure.subscribers.forEach((subscriber) => {
    subscriber.notify(state);
  });
};

const resetSharedMediaAdaptivePressureRuntime = () => {
  sharedMediaAdaptivePressure.longTaskDurations = [];
  sharedMediaAdaptivePressure.maxInputStallMs = 0;
  sharedMediaAdaptivePressure.stallTickAtMs = null;
  sharedMediaAdaptivePressure.rawPressureLevel = 0;
  sharedMediaAdaptivePressure.previewPressureLevel = 0;
  sharedMediaAdaptivePressure.promoteStreak = 0;
  sharedMediaAdaptivePressure.recoverStreak = 0;
  sharedMediaAdaptivePressure.previewRecoveryCandidate = null;
  sharedMediaAdaptivePressure.previewLastChangeAtMs = 0;
  emitSharedMediaAdaptivePressureState(initialState());
};

const resolveSharedMediaAdaptivePressureConfig = (): SharedMediaAdaptivePressureConfig | null => {
  const configs = Array.from(sharedMediaAdaptivePressure.subscribers.values()).map(
    (subscriber) => subscriber.config
  );
  if (!configs.length) return null;
  return {
    memoryGuardEnabled: configs.some((config) => config.memoryGuardEnabled),
    evaluationWindowMs: Math.min(...configs.map((config) => config.evaluationWindowMs)),
    recoveryStableMs: Math.max(...configs.map((config) => config.recoveryStableMs)),
    minChangeIntervalMs: Math.max(...configs.map((config) => config.minChangeIntervalMs)),
  };
};

const buildSharedMediaAdaptivePressureConfigKey = (
  config: SharedMediaAdaptivePressureConfig | null
): string =>
  config
    ? [
        config.memoryGuardEnabled ? "memory" : "no-memory",
        config.evaluationWindowMs,
        config.recoveryStableMs,
        config.minChangeIntervalMs,
      ].join("|")
    : "";

const stopSharedMediaAdaptivePressureSampling = () => {
  sharedMediaAdaptivePressure.longTaskObserver?.disconnect();
  sharedMediaAdaptivePressure.longTaskObserver = null;
  if (sharedMediaAdaptivePressure.stallIntervalId !== null && typeof window !== "undefined") {
    window.clearInterval(sharedMediaAdaptivePressure.stallIntervalId);
  }
  if (sharedMediaAdaptivePressure.evaluationIntervalId !== null && typeof window !== "undefined") {
    window.clearInterval(sharedMediaAdaptivePressure.evaluationIntervalId);
  }
  sharedMediaAdaptivePressure.stallIntervalId = null;
  sharedMediaAdaptivePressure.evaluationIntervalId = null;
  sharedMediaAdaptivePressure.activeConfigKey = "";
};

const startSharedMediaAdaptivePressureSampling = (config: SharedMediaAdaptivePressureConfig) => {
  if (typeof window === "undefined") return;
  stopSharedMediaAdaptivePressureSampling();

  if (typeof PerformanceObserver !== "undefined") {
    sharedMediaAdaptivePressure.longTaskObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        sharedMediaAdaptivePressure.longTaskDurations.push(entry.duration);
      });
    });
    try {
      sharedMediaAdaptivePressure.longTaskObserver.observe({
        type: "longtask",
        buffered: true,
      });
    } catch {
      sharedMediaAdaptivePressure.longTaskObserver.disconnect();
      sharedMediaAdaptivePressure.longTaskObserver = null;
    }
  }

  sharedMediaAdaptivePressure.stallIntervalId = window.setInterval(() => {
    const now = nowMs();
    const previous = sharedMediaAdaptivePressure.stallTickAtMs;
    sharedMediaAdaptivePressure.stallTickAtMs = now;
    if (previous == null) return;
    const stallMs = Math.max(0, now - previous - STALL_SAMPLE_INTERVAL_MS);
    if (stallMs > sharedMediaAdaptivePressure.maxInputStallMs) {
      sharedMediaAdaptivePressure.maxInputStallMs = stallMs;
    }
  }, STALL_SAMPLE_INTERVAL_MS);

  sharedMediaAdaptivePressure.evaluationIntervalId = window.setInterval(
    () => {
      const longTaskP95Ms = resolveAdaptivePercentile(
        sharedMediaAdaptivePressure.longTaskDurations,
        0.95
      );
      const maxInputStallMs = Math.round(sharedMediaAdaptivePressure.maxInputStallMs * 100) / 100;
      const heapUsageRatio = resolveAdaptiveHeapUsageRatio();
      const candidateLevel = evaluateMediaAdaptiveCandidateLevel({
        longTaskP95Ms,
        maxInputStallMs,
        heapUsageRatio,
        memoryGuardEnabled: config.memoryGuardEnabled,
      });

      const transition = resolveAdaptivePressureTransition({
        currentLevel: sharedMediaAdaptivePressure.rawPressureLevel,
        candidateLevel,
        promoteStreak: sharedMediaAdaptivePressure.promoteStreak,
        recoverStreak: sharedMediaAdaptivePressure.recoverStreak,
      });
      sharedMediaAdaptivePressure.rawPressureLevel = transition.nextLevel;
      sharedMediaAdaptivePressure.promoteStreak = transition.nextPromoteStreak;
      sharedMediaAdaptivePressure.recoverStreak = transition.nextRecoverStreak;

      const currentPreviewLevel = sharedMediaAdaptivePressure.previewPressureLevel;
      const previewTransition = resolveMediaPreviewPressureTransition({
        currentLevel: currentPreviewLevel,
        nextRawLevel: sharedMediaAdaptivePressure.rawPressureLevel,
        recoveryCandidate: sharedMediaAdaptivePressure.previewRecoveryCandidate,
        nowMs: nowMs(),
        lastChangeAtMs: sharedMediaAdaptivePressure.previewLastChangeAtMs,
        recoveryStableMs: config.recoveryStableMs,
        minChangeIntervalMs: config.minChangeIntervalMs,
      });
      sharedMediaAdaptivePressure.previewRecoveryCandidate =
        previewTransition.nextRecoveryCandidate;
      sharedMediaAdaptivePressure.previewLastChangeAtMs = previewTransition.nextLastChangeAtMs;
      if (previewTransition.changed && previewTransition.nextLevel !== currentPreviewLevel) {
        sharedMediaAdaptivePressure.previewPressureLevel = previewTransition.nextLevel;
        const activeSurfaces = new Set(
          Array.from(sharedMediaAdaptivePressure.subscribers.values()).map(
            (subscriber) => subscriber.surface
          )
        );
        activeSurfaces.forEach((surface) => {
          logAdaptiveRecoveryLevelChanged({
            surface,
            prevLevel: currentPreviewLevel,
            nextLevel: previewTransition.nextLevel,
          });
        });
      }

      emitSharedMediaAdaptivePressureState({
        rawPressureLevel: sharedMediaAdaptivePressure.rawPressureLevel,
        previewPressureLevel: sharedMediaAdaptivePressure.previewPressureLevel,
        longTaskP95Ms,
        maxInputStallMs,
        heapUsageRatio,
        sampleCount: sharedMediaAdaptivePressure.state.sampleCount + 1,
      });

      sharedMediaAdaptivePressure.longTaskDurations = [];
      sharedMediaAdaptivePressure.maxInputStallMs = 0;
      sharedMediaAdaptivePressure.stallTickAtMs = null;
    },
    Math.max(1000, config.evaluationWindowMs)
  );
  sharedMediaAdaptivePressure.activeConfigKey = buildSharedMediaAdaptivePressureConfigKey(config);
};

const syncSharedMediaAdaptivePressureSampling = () => {
  if (sharedMediaAdaptivePressure.subscribers.size === 0) {
    stopSharedMediaAdaptivePressureSampling();
    resetSharedMediaAdaptivePressureRuntime();
    if (sharedMediaAdaptivePressure.visibilityListenerAttached && typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        handleSharedMediaAdaptivePressureVisibilityChange
      );
      sharedMediaAdaptivePressure.visibilityListenerAttached = false;
    }
    return;
  }

  if (!sharedMediaAdaptivePressure.visibilityListenerAttached && typeof document !== "undefined") {
    document.addEventListener(
      "visibilitychange",
      handleSharedMediaAdaptivePressureVisibilityChange
    );
    sharedMediaAdaptivePressure.visibilityListenerAttached = true;
  }

  sharedMediaAdaptivePressure.documentVisible = isDocumentVisible();
  if (!sharedMediaAdaptivePressure.documentVisible) {
    stopSharedMediaAdaptivePressureSampling();
    resetSharedMediaAdaptivePressureRuntime();
    return;
  }

  const config = resolveSharedMediaAdaptivePressureConfig();
  const configKey = buildSharedMediaAdaptivePressureConfigKey(config);
  if (!config || sharedMediaAdaptivePressure.activeConfigKey === configKey) return;
  startSharedMediaAdaptivePressureSampling(config);
};

function handleSharedMediaAdaptivePressureVisibilityChange() {
  syncSharedMediaAdaptivePressureSampling();
}

const subscribeSharedMediaAdaptivePressure = (
  subscriber: SharedMediaAdaptivePressureSubscriber
): (() => void) => {
  const subscriberId = Symbol("media-adaptive-pressure-subscriber");
  sharedMediaAdaptivePressure.subscribers.set(subscriberId, subscriber);
  subscriber.notify(
    sharedMediaAdaptivePressure.documentVisible ? sharedMediaAdaptivePressure.state : initialState()
  );
  syncSharedMediaAdaptivePressureSampling();
  return () => {
    sharedMediaAdaptivePressure.subscribers.delete(subscriberId);
    syncSharedMediaAdaptivePressureSampling();
  };
};

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

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return subscribeSharedMediaAdaptivePressure({
      surface,
      config: {
        memoryGuardEnabled,
        evaluationWindowMs,
        recoveryStableMs,
        minChangeIntervalMs,
      },
      notify: setState,
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
