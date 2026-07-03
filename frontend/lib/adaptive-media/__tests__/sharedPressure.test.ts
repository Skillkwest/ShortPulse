import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetSharedAdaptivePressureForTests,
  subscribeSharedAdaptiveLongTaskSamples,
  subscribeSharedAdaptivePressure,
} from "../sharedPressure";

type MockLongTaskEntry = Pick<PerformanceEntry, "duration" | "name">;

type MockPerformanceObserverInstance = {
  callback: PerformanceObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
};

const originalPerformanceObserver = globalThis.PerformanceObserver;

const installMockPerformanceObserver = () => {
  const instances: MockPerformanceObserverInstance[] = [];

  class MockPerformanceObserver {
    callback: PerformanceObserverCallback;
    disconnect = vi.fn();
    observe = vi.fn();

    constructor(callback: PerformanceObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }
  }

  vi.stubGlobal("PerformanceObserver", MockPerformanceObserver);

  return {
    instances,
    emitLongTask: (entry: MockLongTaskEntry) => {
      const observer = instances.at(-1);
      if (!observer) throw new Error("No PerformanceObserver instance installed");
      observer.callback(
        {
          getEntries: () => [entry as PerformanceEntry],
        } as PerformanceObserverEntryList,
        observer as unknown as PerformanceObserver
      );
    },
  };
};

describe("shared adaptive pressure sampling", () => {
  afterEach(() => {
    resetSharedAdaptivePressureForTests();
    vi.stubGlobal("PerformanceObserver", originalPerformanceObserver);
    vi.restoreAllMocks();
  });

  it("emits long-task samples from the shared observer without starting pressure intervals", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const { emitLongTask, instances } = installMockPerformanceObserver();
    const samples: Array<{ durationMs: number; name: string }> = [];

    const unsubscribe = subscribeSharedAdaptiveLongTaskSamples((sample) => {
      samples.push(sample);
    });

    expect(instances).toHaveLength(1);
    expect(instances[0]?.observe).toHaveBeenCalledWith({ type: "longtask" });
    expect(setIntervalSpy).not.toHaveBeenCalled();

    emitLongTask({ duration: 63.4, name: "self" });

    expect(samples).toEqual([{ durationMs: 63.4, name: "self" }]);

    unsubscribe();

    expect(instances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("shares one long-task observer across pressure and telemetry subscribers", () => {
    const { emitLongTask, instances } = installMockPerformanceObserver();
    const states: Array<{ longTaskP95Ms: number | null }> = [];
    const samples: Array<{ durationMs: number; name: string }> = [];

    const unsubscribePressure = subscribeSharedAdaptivePressure({
      config: {
        evaluationWindowMs: 1_000,
        memoryGuardEnabled: true,
      },
      notify: (state) => {
        states.push({ longTaskP95Ms: state.longTaskP95Ms });
      },
    });
    const unsubscribeTelemetry = subscribeSharedAdaptiveLongTaskSamples((sample) => {
      samples.push(sample);
    });

    expect(instances).toHaveLength(1);

    emitLongTask({ duration: 88.8, name: "self" });

    expect(samples).toEqual([{ durationMs: 88.8, name: "self" }]);

    unsubscribeTelemetry();
    expect(instances[0]?.disconnect).not.toHaveBeenCalled();

    unsubscribePressure();
    expect(instances[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(states[0]?.longTaskP95Ms).toBeNull();
  });
});
