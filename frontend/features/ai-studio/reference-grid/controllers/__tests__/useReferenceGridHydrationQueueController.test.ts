/**
 * Unit coverage for hydration queue scheduling controller.
 * Verifies modal-open suspension and resume behavior.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridHydrationQueueController } from "../useReferenceGridHydrationQueueController";
import type { ReferenceGridResolvedCardMedia } from "../useReferenceGridResolvedMediaController";

const imageOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "image",
    previewStoragePath: "https://cdn.example.com/preview.jpg",
    fullStoragePath: "https://cdn.example.com/full.jpg",
    previewUrl: null,
    resultUrls: null,
  }) as unknown as StudioOutput;

const adaptivePreviewOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "image",
    previewStoragePath: null,
    fullStoragePath: null,
    previewUrl: "https://example.supabase.co/storage/v1/render/image/public/media/shared.jpg",
    resultUrls: null,
  }) as unknown as StudioOutput;

const visibleImageCard = (item: StudioOutput, surface: "all-refs" | "curated" = "all-refs") =>
  ({
    item,
    surface,
    mediaSurface: surface === "curated" ? "quick-slot" : "reference-grid",
    cardPreviewUrl: "https://cdn.example.com/preview.jpg",
    fallbackUrl: "https://cdn.example.com/full.jpg",
    isImagePreview: true,
    isVideoPreview: false,
    isPriorityHydration: false,
    targetLongEdgePx: 512,
    previewQualityBand: "high",
  }) as const;

const createResolvedCardMedia = (
  item: StudioOutput,
  previewUrl: string
): ReferenceGridResolvedCardMedia => ({
  previewUrl,
  fullUrl: previewUrl,
  fallbackUrl: "https://cdn.example.com/full.jpg",
  previewQualityBand: "high",
  targetLongEdgePx: 512,
  isVideoPreview: false,
  isImagePreview: true,
  normalizedPreviewUrl: previewUrl,
  normalizedFallbackUrl: "https://cdn.example.com/full.jpg",
  previewOptimizerSourceUrl: null,
});

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
          hydrationQuickSlotPreferredIdSet: new Set<string>(),
          nearViewportOutputs: [],
          nearViewportCuratedOutputs: [],
          virtualRowHeight: 280,
          curatedVirtualRowHeight: 240,
          quickSlotAdaptiveSurfaceEnabled: false,
          resolveCardMedia: ({ item }) =>
            createResolvedCardMedia(item, "https://cdn.example.com/preview.jpg"),
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
      ...visibleImageCard(output, "curated"),
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
        hydrationQuickSlotPreferredIdSet: new Set([output.id]),
        nearViewportOutputs: [],
        nearViewportCuratedOutputs: [],
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: true,
        resolveCardMedia: ({ item }) =>
          createResolvedCardMedia(item, "https://cdn.example.com/preview.jpg"),
        enqueueImageHydration,
        pruneHydrationQueueToCandidateIds,
      })
    );

    expect(enqueueImageHydration).toHaveBeenCalledTimes(1);
    expect(enqueueImageHydration).toHaveBeenCalledWith("out-1", quickSlotCard.cardPreviewUrl, {
      priority: "high",
      mediaSurface: "quick-slot",
      targetLongEdgePx: 384,
      previewQualityBand: "balanced",
      fallbackUrl: "https://cdn.example.com/full.jpg",
    });
  });

  it("does not double-enqueue duplicated active outputs when quick-slot is present", () => {
    const enqueuePreferred = vi.fn();
    const prunePreferred = vi.fn();
    const output = adaptivePreviewOutput("out-1");

    renderHook(() =>
      useReferenceGridHydrationQueueController({
        decodeBudgetEnabled: true,
        suspendHydrationQueue: false,
        activeOutputId: output.id,
        outputs: [output],
        visibleCardItems: [visibleImageCard(output)],
        curatedVisibleCardItems: [visibleImageCard(output, "curated")],
        hydrationQuickSlotPreferredIdSet: new Set([output.id]),
        nearViewportOutputs: [],
        nearViewportCuratedOutputs: [],
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: true,
        resolveCardMedia: ({ item }) =>
          createResolvedCardMedia(
            item,
            "https://example.supabase.co/storage/v1/render/image/public/media/shared.jpg"
          ),
        enqueueImageHydration: enqueuePreferred,
        pruneHydrationQueueToCandidateIds: prunePreferred,
      })
    );

    expect(enqueuePreferred).toHaveBeenCalledTimes(1);
    const [id] = enqueuePreferred.mock.calls[0] as [string, string, { targetLongEdgePx?: number }];
    expect(id).toBe("out-1");
  });
});
