/**
 * Unit coverage for hydration queue scheduling controller.
 * Verifies modal-open suspension and resume behavior.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridHydrationQueueController } from "../useReferenceGridHydrationQueueController";
import type { ReferenceGridResolvedCardMedia } from "../useReferenceGridResolvedMediaController";
import {
  projectReferenceGridMediaOutput,
  type ReferenceGridMediaOutput,
} from "../../logic/referenceGridMediaOutput";

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
    item: projectReferenceGridMediaOutput(item),
    surface,
    mediaSurface: surface === "curated" ? "quick-slot" : "reference-grid",
    authorityTier: "reusable" as const,
    cardPreviewUrl: "https://cdn.example.com/preview.jpg",
    fallbackUrl: "https://cdn.example.com/full.jpg",
    isImagePreview: true,
    isVideoPreview: false,
    isPriorityHydration: false,
    targetLongEdgePx: 512,
    previewQualityBand: "high",
  }) as const;

const createResolvedCardMedia = (
  item: Pick<ReferenceGridMediaOutput, "id">,
  previewUrl: string
): ReferenceGridResolvedCardMedia => ({
  previewUrl,
  fullUrl: previewUrl,
  fallbackUrl: "https://cdn.example.com/full.jpg",
  authorityTier: "reusable",
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
          activeOutput: null,
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
        activeOutput: null,
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
        activeOutput: projectReferenceGridMediaOutput(output),
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

  it("skips hydration work for placeholder-only loading outputs", () => {
    const enqueueImageHydration = vi.fn();
    const pruneHydrationQueueToCandidateIds = vi.fn();
    const resolveCardMedia = vi.fn(({ item }: { item: ReferenceGridMediaOutput }) =>
      createResolvedCardMedia(item, "https://cdn.example.com/preview.jpg")
    );
    const output = {
      ...imageOutput("out-pending"),
      taskState: "pending" as const,
      mediaSource: "generated" as const,
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: undefined,
      resultUrls: [],
      localObjectUrl: null,
    } as StudioOutput;

    renderHook(() =>
      useReferenceGridHydrationQueueController({
        decodeBudgetEnabled: true,
        suspendHydrationQueue: false,
        activeOutput: projectReferenceGridMediaOutput(output),
        visibleCardItems: [],
        curatedVisibleCardItems: [],
        hydrationQuickSlotPreferredIdSet: new Set<string>(),
        nearViewportOutputs: [projectReferenceGridMediaOutput(output)],
        nearViewportCuratedOutputs: [projectReferenceGridMediaOutput(output)],
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: true,
        resolveCardMedia,
        enqueueImageHydration,
        pruneHydrationQueueToCandidateIds,
      })
    );

    expect(resolveCardMedia).not.toHaveBeenCalled();
    expect(enqueueImageHydration).not.toHaveBeenCalled();
    expect(pruneHydrationQueueToCandidateIds).toHaveBeenCalledTimes(1);
    const candidateIdSet = pruneHydrationQueueToCandidateIds.mock.calls[0]?.[0] as Set<string>;
    expect(candidateIdSet.size).toBe(0);
  });
});
