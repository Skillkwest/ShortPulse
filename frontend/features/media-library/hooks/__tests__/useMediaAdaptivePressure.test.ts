import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateMediaAdaptiveCandidateLevel,
  resolveMediaPreviewPressureTransition,
  useMediaAdaptivePressure,
} from "../useMediaAdaptivePressure";

const mockDocumentVisibility = (visibilityState: DocumentVisibilityState) =>
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibilityState);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useMediaAdaptivePressure helpers", () => {
  it("promotes pressure to level 2 under severe runtime load", () => {
    expect(
      evaluateMediaAdaptiveCandidateLevel({
        longTaskP95Ms: 120,
        maxInputStallMs: 120,
        heapUsageRatio: 0.4,
        memoryGuardEnabled: true,
      })
    ).toBe(2);

    expect(
      evaluateMediaAdaptiveCandidateLevel({
        longTaskP95Ms: 20,
        maxInputStallMs: 900,
        heapUsageRatio: 0.4,
        memoryGuardEnabled: true,
      })
    ).toBe(2);
  });

  it("promotes pressure to level 1 under moderate runtime load", () => {
    expect(
      evaluateMediaAdaptiveCandidateLevel({
        longTaskP95Ms: 70,
        maxInputStallMs: 120,
        heapUsageRatio: 0.4,
        memoryGuardEnabled: true,
      })
    ).toBe(1);

    expect(
      evaluateMediaAdaptiveCandidateLevel({
        longTaskP95Ms: 20,
        maxInputStallMs: 500,
        heapUsageRatio: 0.4,
        memoryGuardEnabled: true,
      })
    ).toBe(1);
  });

  it("caps preview pressure to balanced floor on severe raw pressure", () => {
    const transition = resolveMediaPreviewPressureTransition({
      currentLevel: 0,
      nextRawLevel: 2,
      recoveryCandidate: null,
      nowMs: 1000,
      lastChangeAtMs: 0,
      recoveryStableMs: 15_000,
      minChangeIntervalMs: 4_000,
    });

    expect(transition.nextLevel).toBe(1);
    expect(transition.changed).toBe(true);
    expect(transition.nextRecoveryCandidate).toBeNull();
  });

  it("delays recovery until stable and minimum interval windows are met", () => {
    const pendingRecovery = resolveMediaPreviewPressureTransition({
      currentLevel: 1,
      nextRawLevel: 0,
      recoveryCandidate: null,
      nowMs: 20_000,
      lastChangeAtMs: 18_000,
      recoveryStableMs: 15_000,
      minChangeIntervalMs: 4_000,
    });

    expect(pendingRecovery.nextLevel).toBe(1);
    expect(pendingRecovery.changed).toBe(false);
    expect(pendingRecovery.nextRecoveryCandidate).toEqual({
      level: 0,
      sinceMs: 20_000,
    });

    const stillPending = resolveMediaPreviewPressureTransition({
      currentLevel: 1,
      nextRawLevel: 0,
      recoveryCandidate: pendingRecovery.nextRecoveryCandidate,
      nowMs: 30_000,
      lastChangeAtMs: 18_000,
      recoveryStableMs: 15_000,
      minChangeIntervalMs: 4_000,
    });

    expect(stillPending.nextLevel).toBe(1);
    expect(stillPending.changed).toBe(false);
  });

  it("recovers preview pressure only after both recovery gates pass", () => {
    const recovered = resolveMediaPreviewPressureTransition({
      currentLevel: 1,
      nextRawLevel: 0,
      recoveryCandidate: {
        level: 0,
        sinceMs: 10_000,
      },
      nowMs: 26_000,
      lastChangeAtMs: 20_000,
      recoveryStableMs: 15_000,
      minChangeIntervalMs: 4_000,
    });

    expect(recovered.nextLevel).toBe(0);
    expect(recovered.changed).toBe(true);
    expect(recovered.nextRecoveryCandidate).toBeNull();
  });
});

describe("useMediaAdaptivePressure", () => {
  it("does not start pressure sampling while the document is hidden", () => {
    vi.useFakeTimers();
    const visibilitySpy = mockDocumentVisibility("hidden");
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    renderHook(() =>
      useMediaAdaptivePressure({
        surface: "media-library-panel",
        enabled: true,
      })
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();

    visibilitySpy.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(setIntervalSpy).toHaveBeenCalled();
  });

  it("shares one pressure sampler across multiple enabled media surfaces", () => {
    vi.useFakeTimers();
    mockDocumentVisibility("visible");
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const first = renderHook(() =>
      useMediaAdaptivePressure({
        surface: "media-library-panel",
        enabled: true,
      })
    );
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    const second = renderHook(() =>
      useMediaAdaptivePressure({
        surface: "elements-media-panel",
        enabled: true,
      })
    );
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    first.unmount();
    second.unmount();
  });
});
