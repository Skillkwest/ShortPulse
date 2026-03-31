/**
 * Dev-only counters for AI Studio freeze investigations.
 * Exposes a lightweight global snapshot so hot-path render/update churn can be
 * inspected from the browser without affecting product behavior.
 */

export type FreezeInvestigationSnapshot = {
  counters: Record<string, number>;
  gauges: Record<string, number | string | boolean | null>;
  updatedAtMs: number;
};

declare global {
  interface Window {
    __shortpulseFreezeInvestigation?: {
      getSnapshot: () => FreezeInvestigationSnapshot;
      reset: () => FreezeInvestigationSnapshot;
      increment: (name: string, delta?: number) => FreezeInvestigationSnapshot;
      setGauge: (
        name: string,
        value: number | string | boolean | null
      ) => FreezeInvestigationSnapshot;
    };
  }
}

const isEnabled = () =>
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production" &&
  typeof window.document !== "undefined";

const createSnapshot = (): FreezeInvestigationSnapshot => ({
  counters: {},
  gauges: {},
  updatedAtMs: Date.now(),
});

let snapshot: FreezeInvestigationSnapshot = createSnapshot();

const cloneSnapshot = (): FreezeInvestigationSnapshot => ({
  counters: { ...snapshot.counters },
  gauges: { ...snapshot.gauges },
  updatedAtMs: snapshot.updatedAtMs,
});

const ensureApi = () => {
  if (!isEnabled()) return;
  if (window.__shortpulseFreezeInvestigation) return;
  window.__shortpulseFreezeInvestigation = {
    getSnapshot: () => cloneSnapshot(),
    reset: () => {
      snapshot = createSnapshot();
      return cloneSnapshot();
    },
    increment: (name: string, delta = 1) => {
      snapshot = {
        ...snapshot,
        counters: {
          ...snapshot.counters,
          [name]: (snapshot.counters[name] ?? 0) + delta,
        },
        updatedAtMs: Date.now(),
      };
      return cloneSnapshot();
    },
    setGauge: (name, value) => {
      snapshot = {
        ...snapshot,
        gauges: {
          ...snapshot.gauges,
          [name]: value,
        },
        updatedAtMs: Date.now(),
      };
      return cloneSnapshot();
    },
  };
};

export const incrementFreezeInvestigationCounter = (name: string, delta = 1) => {
  if (!isEnabled()) return;
  ensureApi();
  window.__shortpulseFreezeInvestigation?.increment(name, delta);
};

export const setFreezeInvestigationGauge = (
  name: string,
  value: number | string | boolean | null
) => {
  if (!isEnabled()) return;
  ensureApi();
  window.__shortpulseFreezeInvestigation?.setGauge(name, value);
};

export const resetFreezeInvestigationSnapshot = (): FreezeInvestigationSnapshot => {
  if (!isEnabled()) return cloneSnapshot();
  ensureApi();
  return window.__shortpulseFreezeInvestigation?.reset() ?? cloneSnapshot();
};
