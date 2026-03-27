import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridCardItemsController } from "../useReferenceGridCardItemsController";
import type { ReferenceGridResolvedCardMedia } from "../useReferenceGridResolvedMediaController";

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
  it("carries authority tier into visible card projections", () => {
    const item = output({
      mediaSource: "generated",
      previewUrl: "https://provider.example.com/generated-preview.png",
    });

    const { result } = renderHook(() =>
      useReferenceGridCardItemsController({
        activeOutputId: null,
        decodeBudgetEnabled: true,
        visibleOutputs: [item],
        visibleCuratedOutputs: [],
        visibleQuickSlotIdSet: new Set<string>(),
        hydrationPriorityCount: 0,
        curatedHydrationPriorityCount: 0,
        virtualRowHeight: 280,
        curatedVirtualRowHeight: 240,
        quickSlotAdaptiveSurfaceEnabled: false,
        resolveCardMedia: () => resolvedMedia(),
        hydratedById: {},
      })
    );

    expect(result.current.visibleCardItems[0]?.authorityTier).toBe("preview-only");
    expect(result.current.visibleCardItems[0]?.imageSrc).toBe(
      "https://provider.example.com/generated-preview.png"
    );
  });
});
