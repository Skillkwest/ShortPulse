/**
 * Unit coverage for autoplay selection controller.
 * Verifies modal-open suspension and resume behavior for autoplay-id recompute.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReferenceGridAutoplaySelectionController } from "../useReferenceGridAutoplaySelectionController";

describe("useReferenceGridAutoplaySelectionController", () => {
  it("clears stale autoplay ids while suspended and resumes on unsuspend", () => {
    let autoplayEnabledIdsState: string[] = ["stale-video"];
    const setAutoplayEnabledIds = vi.fn((updater: string[] | ((prev: string[]) => string[])) => {
      autoplayEnabledIdsState =
        typeof updater === "function" ? updater(autoplayEnabledIdsState) : updater;
    });
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());

    const videoVisibleKeySetRef = { current: new Set(["visible-video-key"]) };
    const videoOutputIdByKeyRef = {
      current: new Map<string, string>([["visible-video-key", "video-1"]]),
    };
    const recomputeAutoplayBudgetRef = { current: () => {} };
    const desiredVideoAttachBudgetRef = { current: 1 };
    const autoplayEnabledIdsStateRef = { current: autoplayEnabledIdsState };

    const { result, rerender } = renderHook(
      ({ suspendAutoplaySelection }: { suspendAutoplaySelection: boolean }) =>
        useReferenceGridAutoplaySelectionController({
          activeOutputId: null,
          suspendAutoplaySelection,
          videoAttachBudget: 1,
          perfDegradeLevel: 0,
          runNonUrgentUpdate,
          setAutoplayEnabledIds,
          videoVisibleKeySetRef,
          videoOutputIdByKeyRef,
          recomputeAutoplayBudgetRef,
          desiredVideoAttachBudgetRef,
          desiredVideoAttachBudget: 1,
          autoplayEnabledIdsStateRef,
          autoplayEnabledIds: autoplayEnabledIdsState,
        }),
      {
        initialProps: {
          suspendAutoplaySelection: true,
        },
      }
    );

    result.current.recomputeAutoplayBudget();
    expect(setAutoplayEnabledIds).toHaveBeenCalledTimes(1);
    expect(autoplayEnabledIdsState).toEqual([]);

    rerender({ suspendAutoplaySelection: false });
    result.current.recomputeAutoplayBudget();

    expect(setAutoplayEnabledIds).toHaveBeenCalledTimes(2);
    expect(autoplayEnabledIdsState).toEqual(["video-1"]);
  });
});
