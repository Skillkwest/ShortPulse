/**
 * Unit coverage for autoplay selection controller.
 * Verifies modal-open suspension and resume behavior for autoplay-id recompute.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridAutoplaySelectionController } from "../useReferenceGridAutoplaySelectionController";

const videoOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "video",
    previewStoragePath: "https://cdn.example.com/video.mp4",
    fullStoragePath: "https://cdn.example.com/video.mp4",
    previewUrl: "https://cdn.example.com/video.mp4",
    resultUrls: ["https://cdn.example.com/video.mp4"],
  }) as unknown as StudioOutput;

describe("useReferenceGridAutoplaySelectionController", () => {
  it("stops autoplay-id recompute while suspended and resumes on unsuspend", () => {
    let autoplayEnabledIdsState: string[] = [];
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
    const autoplayEnabledIdsStateRef = { current: [] as string[] };

    const outputs = [videoOutput("video-1")];

    const { result, rerender } = renderHook(
      ({ suspendAutoplaySelection }: { suspendAutoplaySelection: boolean }) =>
        useReferenceGridAutoplaySelectionController({
          activeOutputId: null,
          suspendAutoplaySelection,
          outputs,
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
    expect(setAutoplayEnabledIds).not.toHaveBeenCalled();
    expect(autoplayEnabledIdsState).toEqual([]);

    rerender({ suspendAutoplaySelection: false });
    result.current.recomputeAutoplayBudget();

    expect(setAutoplayEnabledIds).toHaveBeenCalledTimes(1);
    expect(autoplayEnabledIdsState).toEqual(["video-1"]);
  });
});
