import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridCardItemsController } from "../useReferenceGridCardItemsController";
import type { ReferenceGridResolvedCardMedia } from "../useReferenceGridResolvedMediaController";
import { projectReferenceGridMediaOutput } from "../../logic/referenceGridMediaOutput";

const output = (overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id: "out-1",
    prompt: "Prompt",
    mode: "image",
    aspect: "1:1",
    model: "Model",
    status: "ready",
    timestamp: "Now",
    ...overrides,
  }) as StudioOutput;

const resolvedMedia = (
  overrides: Partial<ReferenceGridResolvedCardMedia> = {}
): ReferenceGridResolvedCardMedia => ({
  previewUrl: "https://provider.example.com/generated-preview.png",
  fullUrl: null,
  posterPreviewUrl: null,
  companionArtUrl: null,
  playableMediaUrl: null,
  fallbackUrl: "https://provider.example.com/generated-preview.png",
  authorityTier: "preview-only",
  previewQualityBand: "high",
  targetLongEdgePx: 512,
  isVideoPreview: false,
  isImagePreview: true,
  normalizedPreviewUrl: "https://provider.example.com/generated-preview.png",
  normalizedFallbackUrl: "https://provider.example.com/generated-preview.png",
  previewOptimizerSourceUrl: null,
  ...overrides,
});

describe("useReferenceGridCardItemsController", () => {
  it("withholds visible non-priority image src values while decode-budget hydration catches up", () => {
    const item = output({
      mediaSource: "generated",
      taskState: "success",
      previewUrl: "https://provider.example.com/generated-preview.png",
    });

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 0,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia: () => resolvedMedia(),
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(result.current.visibleCardItems[0]?.authorityTier).toBe("preview-only");
    expect(result.current.visibleCardItems[0]?.imageSrc).toBeUndefined();
    expect(result.current.hydrationLoadingCardIdSet.has("out-1")).toBe(false);
  });

  it("paints priority previews before full fallback while image hydration is pending", () => {
    const item = output({
      mediaSource: "generated",
      previewUrl: "https://storage.example.com/generated-thumb.jpg",
      resultUrls: ["https://storage.example.com/generated-full.png"],
    });

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 1,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia: () =>
          resolvedMedia({
            previewUrl: "https://storage.example.com/generated-thumb.jpg",
            fullUrl: "https://storage.example.com/generated-full.png",
            fallbackUrl: "https://storage.example.com/generated-full.png",
            authorityTier: "tracked",
            normalizedPreviewUrl: "https://storage.example.com/generated-thumb.jpg",
            normalizedFallbackUrl: "https://storage.example.com/generated-full.png",
          }),
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(result.current.visibleCardItems[0]?.imageSrc).toBe(
      "https://storage.example.com/generated-thumb.jpg"
    );
    expect(result.current.visibleCardItems[0]?.fallbackUrl).toBe(
      "https://storage.example.com/generated-full.png"
    );
    expect(result.current.visibleCardItems[0]?.dragDisplayArtifactUrl).toBe(
      "https://storage.example.com/generated-full.png"
    );
  });

  it("paints the active image card promptly even when it is outside the visible priority count", () => {
    const item = output({
      mediaSource: "generated",
      taskState: "success",
      previewUrl: "https://provider.example.com/active-preview.png",
    });

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: item.id,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 0,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia: () =>
          resolvedMedia({
            previewUrl: "https://provider.example.com/active-preview.png",
            fallbackUrl: "https://provider.example.com/active-preview.png",
            normalizedPreviewUrl: "https://provider.example.com/active-preview.png",
            normalizedFallbackUrl: "https://provider.example.com/active-preview.png",
          }),
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(result.current.visibleCardItems[0]).toMatchObject({
      isPriorityHydration: true,
      imageSrc: "https://provider.example.com/active-preview.png",
    });
  });

  it("paints priority quick-slot image cards under the decode budget", () => {
    const item = output({
      id: "curated-1",
      mediaSource: "library",
      taskState: "success",
      previewUrl: "https://provider.example.com/curated-preview.png",
    });

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [],
        visibleCuratedOutputs: [projectReferenceGridMediaOutput(item)],
        visibleQuickSlotIdSet: new Set<string>([item.id]),
        hydrationPriorityCount: 0,
        curatedHydrationPriorityCount: 1,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: true,
        resolveCardMedia: ({ mediaSurface }) =>
          resolvedMedia({
            previewUrl: "https://provider.example.com/curated-preview.png",
            fallbackUrl: "https://provider.example.com/curated-preview.png",
            normalizedPreviewUrl: "https://provider.example.com/curated-preview.png",
            normalizedFallbackUrl: "https://provider.example.com/curated-preview.png",
            targetLongEdgePx: mediaSurface === "quick-slot" ? 237 : 512,
          }),
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(result.current.curatedVisibleCardItems[0]).toMatchObject({
      mediaSurface: "quick-slot",
      isPriorityHydration: true,
      imageSrc: "https://provider.example.com/curated-preview.png",
    });
  });

  it("skips resolved media work for placeholder-only loading outputs", () => {
    const item = output({
      taskState: "pending",
      mediaSource: "generated",
      previewUrl: undefined,
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      localObjectUrl: null,
    });
    const resolveCardMedia = vi.fn(() => resolvedMedia());

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 1,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia,
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(resolveCardMedia).not.toHaveBeenCalled();
    expect(result.current.visibleCardItems[0]).toMatchObject({
      cardPreviewUrl: null,
      isImagePreview: false,
      isVideoPreview: false,
      isPriorityHydration: false,
      isPlaceholderOnly: true,
    });
  });

  it("skips resolved media work for blank success outputs with no renderable media", () => {
    const item = output({
      taskState: "success",
      mediaSource: "generated",
      previewText: "",
      previewUrl: undefined,
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      localObjectUrl: null,
    });
    const resolveCardMedia = vi.fn(() => resolvedMedia());

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 1,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia,
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(resolveCardMedia).not.toHaveBeenCalled();
    expect(result.current.visibleCardItems[0]).toMatchObject({
      cardPreviewUrl: null,
      isImagePreview: false,
      isVideoPreview: false,
      isPriorityHydration: false,
      isPlaceholderOnly: true,
    });
  });

  it("does not treat saved-media-only outputs as placeholder-only", () => {
    const item = output({
      taskState: "success",
      mediaSource: "library",
      previewUrl: undefined,
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      localObjectUrl: null,
      savedMediaIds: ["saved-media-1"],
    });
    const resolveCardMedia = vi.fn(() =>
      resolvedMedia({
        previewUrl: null,
        fullUrl: null,
        fallbackUrl: null,
        authorityTier: "reusable",
        normalizedPreviewUrl: null,
        normalizedFallbackUrl: null,
        isImagePreview: false,
      })
    );

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 1,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia,
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(resolveCardMedia).toHaveBeenCalledTimes(1);
    expect(result.current.visibleCardItems[0]).toMatchObject({
      cardPreviewUrl: null,
      isPlaceholderOnly: false,
      authorityTier: "reusable",
    });
  });

  it("separates generated waiting state from imported hydration state", () => {
    const pendingItem = output({
      id: "pending-1",
      taskState: "pending",
      mediaSource: "generated",
    });
    const hydratedItem = output({
      id: "hydrating-1",
      taskState: "success",
      mediaSource: "library",
      previewUrl: "https://provider.example.com/hydrating-preview.png",
    });

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [
          projectReferenceGridMediaOutput(pendingItem),
          projectReferenceGridMediaOutput(hydratedItem),
        ],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 2,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia: ({ item }) =>
          resolvedMedia({
            authorityTier: item.id === hydratedItem.id ? "tracked" : "preview-only",
            previewUrl: item.previewUrl ?? null,
            fallbackUrl: item.previewUrl ?? null,
            normalizedPreviewUrl: item.previewUrl ?? null,
            normalizedFallbackUrl: item.previewUrl ?? null,
          }),
        visibleOutputById: {
          [pendingItem.id]: pendingItem,
          [hydratedItem.id]: hydratedItem,
        },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(result.current.loadingCardIdSet.has("pending-1")).toBe(true);
    expect(result.current.generationLoadingCardIdSet.has("pending-1")).toBe(true);
    expect(result.current.hydrationLoadingCardIdSet.has("hydrating-1")).toBe(true);
    expect(result.current.loadingIdsLength).toBe(2);
    expect(result.current.generationLoadingIdsLength).toBe(1);
    expect(result.current.hydrationLoadingIdsLength).toBe(1);
  });

  it("uses the hydrated source url rather than the hydrated render blob for drag artifacts", () => {
    const item = output({
      id: "hydrated-1",
      mediaSource: "generated",
      previewUrl: "https://provider.example.com/generated-preview.png",
    });

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 0,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia: () =>
          resolvedMedia({
            previewUrl: "https://provider.example.com/generated-preview.png",
            fallbackUrl: "https://provider.example.com/generated-preview.png",
            normalizedPreviewUrl: "https://provider.example.com/generated-preview.png",
            normalizedFallbackUrl: "https://provider.example.com/generated-preview.png",
          }),
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {
          [item.id]: {
            sourceUrl: "https://provider.example.com/generated-preview.png",
            renderUrl: "blob:grid-hydrated-preview",
          },
        },
      })
    );

    expect(result.current.visibleCardItems[0]?.imageSrc).toBe("blob:grid-hydrated-preview");
    expect(result.current.visibleCardItems[0]?.dragDisplayArtifactUrl).toBe(
      "https://provider.example.com/generated-preview.png"
    );
    expect(result.current.visibleCardItems[0]?.dragDisplayArtifactKind).toBe("url");
  });

  it("reuses quick-slot media resolution for duplicated all-refs card items", () => {
    const item = output({
      id: "quick-slot-1",
      mediaSource: "library",
      previewUrl: "https://provider.example.com/reference-preview.png",
    });
    const resolveCardMedia = vi.fn(({ mediaSurface }) =>
      resolvedMedia({
        previewUrl:
          mediaSurface === "quick-slot"
            ? "https://provider.example.com/quick-slot-preview.png"
            : "https://provider.example.com/all-refs-preview.png",
        fallbackUrl:
          mediaSurface === "quick-slot"
            ? "https://provider.example.com/quick-slot-full.png"
            : "https://provider.example.com/all-refs-full.png",
        normalizedPreviewUrl:
          mediaSurface === "quick-slot"
            ? "https://provider.example.com/quick-slot-preview.png"
            : "https://provider.example.com/all-refs-preview.png",
        normalizedFallbackUrl:
          mediaSurface === "quick-slot"
            ? "https://provider.example.com/quick-slot-full.png"
            : "https://provider.example.com/all-refs-full.png",
      })
    );

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [projectReferenceGridMediaOutput(item)],
        visibleCuratedOutputs: [projectReferenceGridMediaOutput(item)],
        visibleQuickSlotIdSet: new Set<string>([item.id]),
        hydrationPriorityCount: 1,
        curatedHydrationPriorityCount: 1,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: true,
        resolveCardMedia,
        visibleOutputById: { [item.id]: item },
        loadedMap: {},
        hydratedById: {},
      })
    );

    expect(resolveCardMedia).toHaveBeenCalledTimes(1);
    expect(resolveCardMedia).toHaveBeenCalledWith({
      item: projectReferenceGridMediaOutput(item),
      mediaSurface: "quick-slot",
      cardLongEdgePx: 237,
    });
    expect(result.current.curatedVisibleCardItems).toHaveLength(1);
    expect(result.current.visibleCardItems).toHaveLength(1);
    expect(result.current.visibleCardItems[0]).toMatchObject({
      item: projectReferenceGridMediaOutput(item),
      surface: "all-refs",
      mediaSurface: "reference-grid",
      cardPreviewUrl: "https://provider.example.com/quick-slot-preview.png",
      fallbackUrl: "https://provider.example.com/quick-slot-full.png",
      imageSrc: undefined,
      isPriorityHydration: false,
    });
  });
});
