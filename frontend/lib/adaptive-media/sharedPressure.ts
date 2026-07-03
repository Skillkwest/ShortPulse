/**
 * Shared browser-pressure sampler for adaptive media surfaces.
 * Owns long-task/input-stall/heap sampling once per visible tab and lets
 * surface hooks apply their own preview-quality recovery semantics.
 */
import {
  evaluateAdaptivePressureCandidateLevel,
  type AdaptivePressurePhase,
  resolveAdaptivePressurePhase,
  resolveAdaptiveHeapUsageRatio,
  resolveAdaptivePercentile,
  resolveAdaptivePressureTransition,
} from "./pressure";
import type { AdaptivePressureLevel } from "./types";

export type SharedAdaptivePressureState = {
  rawPressureLevel: AdaptivePressureLevel;
  pressurePhase: AdaptivePressurePhase;
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
  sampleCount: number;
};

export type SharedAdaptivePressureConfig = {
  memoryGuardEnabled: boolean;
  evaluationWindowMs: number;
};

type SharedAdaptivePressureSubscriber = {
  config: SharedAdaptivePressureConfig;
  notify: (state: SharedAdaptivePressureState) => void;
};

export type SharedAdaptiveLongTaskSample = {
  durationMs: number;
  name: string;
};

type SharedAdaptiveLongTaskSampleSubscriber = (sample: SharedAdaptiveLongTaskSample) => void;

const STALL_SAMPLE_INTERVAL_MS = 120;

export const createInitialSharedAdaptivePressureState = (): SharedAdaptivePressureState => ({
  rawPressureLevel: 0,
  pressurePhase: "normal",
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

const sharedAdaptivePressure = {
  subscribers: new Map<symbol, SharedAdaptivePressureSubscriber>(),
  longTaskSampleSubscribers: new Map<symbol, SharedAdaptiveLongTaskSampleSubscriber>(),
  state: createInitialSharedAdaptivePressureState(),
  longTaskDurations: [] as number[],
  maxInputStallMs: 0,
  stallTickAtMs: null as number | null,
  rawPressureLevel: 0 as AdaptivePressureLevel,
  promoteStreak: 0,
  recoverStreak: 0,
  documentVisible: isDocumentVisible(),
  visibilityListenerAttached: false,
  longTaskObserver: null as PerformanceObserver | null,
  stallIntervalId: null as number | null,
  evaluationIntervalId: null as number | null,
  activeConfigKey: "",
};

const emitSharedAdaptivePressureState = (state: SharedAdaptivePressureState) => {
  sharedAdaptivePressure.state = state;
  sharedAdaptivePressure.subscribers.forEach((subscriber) => {
    subscriber.notify(state);
  });
};

const emitSharedAdaptiveLongTaskSample = (entry: PerformanceEntry) => {
  if (sharedAdaptivePressure.longTaskSampleSubscribers.size === 0) return;
  const sample: SharedAdaptiveLongTaskSample = {
    durationMs: entry.duration,
    name: entry.name,
  };
  sharedAdaptivePressure.longTaskSampleSubscribers.forEach((subscriber) => {
    subscriber(sample);
  });
};

const resetSharedAdaptivePressureRuntime = () => {
  sharedAdaptivePressure.longTaskDurations = [];
  sharedAdaptivePressure.maxInputStallMs = 0;
  sharedAdaptivePressure.stallTickAtMs = null;
  sharedAdaptivePressure.rawPressureLevel = 0;
  sharedAdaptivePressure.promoteStreak = 0;
  sharedAdaptivePressure.recoverStreak = 0;
  emitSharedAdaptivePressureState(createInitialSharedAdaptivePressureState());
};

const resolveSharedAdaptivePressureConfig = (): SharedAdaptivePressureConfig | null => {
  const configs = Array.from(sharedAdaptivePressure.subscribers.values()).map(
    (subscriber) => subscriber.config
  );
  if (!configs.length) return null;
  return {
    memoryGuardEnabled: configs.some((config) => config.memoryGuardEnabled),
    evaluationWindowMs: Math.min(...configs.map((config) => config.evaluationWindowMs)),
  };
};

const buildSharedAdaptivePressureConfigKey = (
  config: SharedAdaptivePressureConfig | null
): string =>
  config
    ? [config.memoryGuardEnabled ? "memory" : "no-memory", config.evaluationWindowMs].join("|")
    : "";

const stopSharedAdaptiveLongTaskObserver = () => {
  sharedAdaptivePressure.longTaskObserver?.disconnect();
  sharedAdaptivePressure.longTaskObserver = null;
};

const stopSharedAdaptivePressureEvaluation = () => {
  if (sharedAdaptivePressure.stallIntervalId !== null && typeof window !== "undefined") {
    window.clearInterval(sharedAdaptivePressure.stallIntervalId);
  }
  if (sharedAdaptivePressure.evaluationIntervalId !== null && typeof window !== "undefined") {
    window.clearInterval(sharedAdaptivePressure.evaluationIntervalId);
  }
  sharedAdaptivePressure.stallIntervalId = null;
  sharedAdaptivePressure.evaluationIntervalId = null;
  sharedAdaptivePressure.activeConfigKey = "";
};

const stopSharedAdaptivePressureSampling = () => {
  stopSharedAdaptiveLongTaskObserver();
  stopSharedAdaptivePressureEvaluation();
};

const startSharedAdaptiveLongTaskObserver = () => {
  if (typeof window === "undefined") return;
  if (sharedAdaptivePressure.longTaskObserver) return;

  if (typeof PerformanceObserver !== "undefined") {
    sharedAdaptivePressure.longTaskObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        if (sharedAdaptivePressure.subscribers.size > 0) {
          sharedAdaptivePressure.longTaskDurations.push(entry.duration);
        }
        emitSharedAdaptiveLongTaskSample(entry);
      });
    });
    try {
      sharedAdaptivePressure.longTaskObserver.observe({
        type: "longtask",
      });
    } catch {
      sharedAdaptivePressure.longTaskObserver.disconnect();
      sharedAdaptivePressure.longTaskObserver = null;
    }
  }
};

const startSharedAdaptivePressureEvaluation = (config: SharedAdaptivePressureConfig) => {
  if (typeof window === "undefined") return;
  stopSharedAdaptivePressureEvaluation();

  sharedAdaptivePressure.stallIntervalId = window.setInterval(() => {
    const now = nowMs();
    const previous = sharedAdaptivePressure.stallTickAtMs;
    sharedAdaptivePressure.stallTickAtMs = now;
    if (previous == null) return;
    const stallMs = Math.max(0, now - previous - STALL_SAMPLE_INTERVAL_MS);
    if (stallMs > sharedAdaptivePressure.maxInputStallMs) {
      sharedAdaptivePressure.maxInputStallMs = stallMs;
    }
  }, STALL_SAMPLE_INTERVAL_MS);

  sharedAdaptivePressure.evaluationIntervalId = window.setInterval(
    () => {
      const longTaskP95Ms = resolveAdaptivePercentile(
        sharedAdaptivePressure.longTaskDurations,
        0.95
      );
      const maxInputStallMs = Math.round(sharedAdaptivePressure.maxInputStallMs * 100) / 100;
      const heapUsageRatio = resolveAdaptiveHeapUsageRatio();
      const candidateLevel = evaluateAdaptivePressureCandidateLevel({
        longTaskP95Ms,
        maxInputStallMs,
        heapUsageRatio,
        memoryGuardEnabled: config.memoryGuardEnabled,
      });

      const transition = resolveAdaptivePressureTransition({
        currentLevel: sharedAdaptivePressure.rawPressureLevel,
        candidateLevel,
        promoteStreak: sharedAdaptivePressure.promoteStreak,
        recoverStreak: sharedAdaptivePressure.recoverStreak,
      });
      sharedAdaptivePressure.rawPressureLevel = transition.nextLevel;
      sharedAdaptivePressure.promoteStreak = transition.nextPromoteStreak;
      sharedAdaptivePressure.recoverStreak = transition.nextRecoverStreak;

      emitSharedAdaptivePressureState({
        rawPressureLevel: sharedAdaptivePressure.rawPressureLevel,
        pressurePhase: resolveAdaptivePressurePhase(sharedAdaptivePressure.rawPressureLevel),
        longTaskP95Ms,
        maxInputStallMs,
        heapUsageRatio,
        sampleCount: sharedAdaptivePressure.state.sampleCount + 1,
      });

      sharedAdaptivePressure.longTaskDurations = [];
      sharedAdaptivePressure.maxInputStallMs = 0;
      sharedAdaptivePressure.stallTickAtMs = null;
    },
    Math.max(1000, config.evaluationWindowMs)
  );
  sharedAdaptivePressure.activeConfigKey = buildSharedAdaptivePressureConfigKey(config);
};

const syncSharedAdaptivePressureSampling = () => {
  const hasPressureSubscribers = sharedAdaptivePressure.subscribers.size > 0;
  const hasLongTaskSampleSubscribers = sharedAdaptivePressure.longTaskSampleSubscribers.size > 0;
  if (!hasPressureSubscribers && !hasLongTaskSampleSubscribers) {
    stopSharedAdaptivePressureSampling();
    resetSharedAdaptivePressureRuntime();
    if (sharedAdaptivePressure.visibilityListenerAttached && typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        handleSharedAdaptivePressureVisibilityChange
      );
      sharedAdaptivePressure.visibilityListenerAttached = false;
    }
    return;
  }

  if (!sharedAdaptivePressure.visibilityListenerAttached && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleSharedAdaptivePressureVisibilityChange);
    sharedAdaptivePressure.visibilityListenerAttached = true;
  }

  sharedAdaptivePressure.documentVisible = isDocumentVisible();
  if (!sharedAdaptivePressure.documentVisible) {
    stopSharedAdaptivePressureSampling();
    resetSharedAdaptivePressureRuntime();
    return;
  }

  startSharedAdaptiveLongTaskObserver();

  const config = resolveSharedAdaptivePressureConfig();
  const configKey = buildSharedAdaptivePressureConfigKey(config);
  if (!config) {
    stopSharedAdaptivePressureEvaluation();
    resetSharedAdaptivePressureRuntime();
    return;
  }
  if (sharedAdaptivePressure.activeConfigKey === configKey) return;
  startSharedAdaptivePressureEvaluation(config);
};

function handleSharedAdaptivePressureVisibilityChange() {
  syncSharedAdaptivePressureSampling();
}

export const subscribeSharedAdaptivePressure = (
  subscriber: SharedAdaptivePressureSubscriber
): (() => void) => {
  const subscriberId = Symbol("adaptive-pressure-subscriber");
  const documentVisible = isDocumentVisible();
  sharedAdaptivePressure.documentVisible = documentVisible;
  sharedAdaptivePressure.subscribers.set(subscriberId, subscriber);
  subscriber.notify(
    documentVisible ? sharedAdaptivePressure.state : createInitialSharedAdaptivePressureState()
  );
  syncSharedAdaptivePressureSampling();
  return () => {
    sharedAdaptivePressure.subscribers.delete(subscriberId);
    syncSharedAdaptivePressureSampling();
  };
};

export const subscribeSharedAdaptiveLongTaskSamples = (
  subscriber: SharedAdaptiveLongTaskSampleSubscriber
): (() => void) => {
  const subscriberId = Symbol("adaptive-longtask-subscriber");
  sharedAdaptivePressure.longTaskSampleSubscribers.set(subscriberId, subscriber);
  syncSharedAdaptivePressureSampling();
  return () => {
    sharedAdaptivePressure.longTaskSampleSubscribers.delete(subscriberId);
    syncSharedAdaptivePressureSampling();
  };
};

export const resetSharedAdaptivePressureForTests = (): void => {
  stopSharedAdaptivePressureSampling();
  sharedAdaptivePressure.subscribers.clear();
  sharedAdaptivePressure.longTaskSampleSubscribers.clear();
  resetSharedAdaptivePressureRuntime();
  if (sharedAdaptivePressure.visibilityListenerAttached && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleSharedAdaptivePressureVisibilityChange);
    sharedAdaptivePressure.visibilityListenerAttached = false;
  }
};
