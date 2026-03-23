/**
 * Unit coverage for hydration queue scheduling controller.
 * Verifies modal-open suspension and resume behavior.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridHydrationQueueController } from "../useReferenceGridHydrationQueueController";

const imageOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "image",
    previewStoragePath: "https://cdn.example.com/preview.jpg",
    fullStoragePath: "https://cdn.example.com/full.jpg",
    previewUrl: null,
    resultUrls: null,
  }) as unknown as StudioOutput;

const visibleImageCard = (item: StudioOutput) =>
  ({
    item,
    cardPreviewUrl: "https://cdn.example.com/preview.jpg",
    isImagePreview: true,
    isVideoPreview: false,
    isPriorityHydration: false,
    targetLongEdgePx: 512,
    previewQualityBand: "high",
  }) as const;

describe("useReferenceGridHydrationQueueController", () => {
  it("stops queue scheduling while suspended and resumes on unsuspend", () => {
    const enqueueImageHydration = vi.fn();
    const pruneHydrationQueueToCandidateIds = vi.fn();
    const output = imageOutput("out-1");

    const { rerender } = renderHook(
      ({ suspendHydrationQueue }: { suspendHydrationQueue: boolean }) =>
        useReferenceGridHydrationQueueController({
          decodeBudgetEnabled: true,
          suspendHydrationQueue,
          activeOutputId: null,
          outputs: [output],
          visibleCardItems: [visibleImageCard(output)],
          curatedVisibleCardItems: [],
          nearViewportOutputs: [],
          nearViewportCuratedOutputs: [],
          previewQualityPressureLevel: 0,
          strictPreviewLadder: true,
          adaptivePreviewRoutingEnabled: true,
          virtualRowHeight: 280,
          curatedVirtualRowHeight: 240,
          quickSlotAdaptiveSurfaceEnabled: false,
          enqueueImageHydration,
          pruneHydrationQueueToCandidateIds,
        }),
      {
        initialProps: {
          suspendHydrationQueue: true,
        },
      }
    );

    expect(enqueueImageHydration).not.toHaveBeenCalled();
    expect(pruneHydrationQueueToCandidateIds).not.toHaveBeenCalled();

    rerender({ suspendHydrationQueue: false });

    expect(enqueueImageHydration).toHaveBeenCalled();
    expect(pruneHydrationQueueToCandidateIds).toHaveBeenCalledTimes(1);
    const candidateIdSet = pruneHydrationQueueToCandidateIds.mock.calls[0]?.[0] as Set<string>;
    expect(candidateIdSet.has("out-1")).toBe(true);
  });

  it("prefers quick-slot image hydration candidates over duplicated all-refs cards", () => {
    const enqueueImageHydration = vi.fn();
    const pruneHydrationQueueToCandidateIds = vi.fn();
    const output = imageOutput("out-1");
    const allRefsCard = visibleImageCard(output);
    const quickSlotCard = {
      ...visibleImageCard(output),
      cardPreviewUrl: "https://cdn.example.com/quick-slot-preview.jpg",
      isPriorityHydration: true,
      targetLongEdgePx: 384,
      previewQualityBand: "balanced" as const,
    };

    renderHook(() =>
      useReferenceGridHydrationQueueController({
        decodeBudgetEnabled: true,
        suspendHydrationQueue: false,
        activeOutputId: null,
        outputs: [output],
        visibleCardItems: [allRefsCard],
        curatedVisibleCardItems: [quickSlotCard],
        nearViewportOutputs: [],
        nearViewportCuratedOutputs: [],
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: true,
        enqueueImageHydration,
        pruneHydrationQueueToCandidateIds,
      })
    );

    expect(enqueueImageHydration).toHaveBeenCalledTimes(1);
    expect(enqueueImageHydration).toHaveBeenCalledWith("out-1", quickSlotCard.cardPreviewUrl, {
      priority: "high",
      targetLongEdgePx: 384,
      previewQualityBand: "balanced",
      fallbackUrl: "https://cdn.example.com/full.jpg",
    });
  });
});
