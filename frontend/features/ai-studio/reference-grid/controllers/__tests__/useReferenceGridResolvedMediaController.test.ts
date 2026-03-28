import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";

vi.mock("../../../logic/referenceGridMedia", async () => {
  const actual = await vi.importActual<typeof import("../../../logic/referenceGridMedia")>(
    "../../../logic/referenceGridMedia"
  );
  return {
    ...actual,
    resolveReferenceCardUrls: vi.fn(actual.resolveReferenceCardUrls),
  };
});

import { resolveReferenceCardUrls } from "../../../logic/referenceGridMedia";
import { useReferenceGridResolvedMediaController } from "../useReferenceGridResolvedMediaController";

const createImageOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "image",
    previewStoragePath: "https://cdn.example.com/preview.jpg",
    fullStoragePath: "https://cdn.example.com/full.jpg",
    previewUrl: null,
    resultUrls: null,
  }) as unknown as StudioOutput;

describe("useReferenceGridResolvedMediaController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses cached media resolution for repeated output and surface requests", () => {
    const output = createImageOutput("out-1");
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    const first = result.current.resolveCardMedia({
      item: output,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });
    const second = result.current.resolveCardMedia({
      item: output,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("keeps cache entries separated by surface and target edge", () => {
    const output = createImageOutput("out-1");
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    result.current.resolveCardMedia({
      item: output,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });
    result.current.resolveCardMedia({
      item: output,
      mediaSurface: "quick-slot",
      cardLongEdgePx: 512,
    });
    result.current.resolveCardMedia({
      item: output,
      mediaSurface: "quick-slot",
      cardLongEdgePx: 384,
    });

    expect(resolveReferenceCardUrls).toHaveBeenCalledTimes(3);
  });

  it("keeps weak generated outputs previewable without upgrading fallback authority", () => {
    const output = {
      ...createImageOutput("out-generated-weak"),
      mediaSource: "generated",
      generationId: undefined,
      savedMediaIds: [],
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: "https://provider.example.com/generated-preview.png",
      resultUrls: ["https://provider.example.com/generated-full.png"],
    } as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: output,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.authorityTier).toBe("preview-only");
    expect(resolved.previewUrl).toBe("https://provider.example.com/generated-preview.png");
    expect(resolved.fullUrl).toBeNull();
    expect(resolved.fallbackUrl).toBe("https://provider.example.com/generated-preview.png");
  });

  it("trusts canonical resolved card urls before raw generated fallback fields", () => {
    vi.mocked(resolveReferenceCardUrls).mockReturnValueOnce({
      previewUrl: "https://storage.example.com/generated-preview.png",
      fullUrl: "https://storage.example.com/generated-full.png",
      authorityTier: "tracked",
      previewQualityBand: "high",
      targetLongEdgePx: 960,
    });

    const output = {
      ...createImageOutput("out-generated-tracked"),
      mediaSource: "generated",
      generationId: "gen-1",
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: "https://provider.example.com/generated-preview.png",
      resultUrls: ["https://provider.example.com/generated-full.png"],
    } as StudioOutput;
    const { result } = renderHook(() =>
      useReferenceGridResolvedMediaController({
        previewQualityPressureLevel: 0,
        strictPreviewLadder: true,
        adaptivePreviewRoutingEnabled: true,
      })
    );

    const resolved = result.current.resolveCardMedia({
      item: output,
      mediaSurface: "reference-grid",
      cardLongEdgePx: 512,
    });

    expect(resolved.previewUrl).toBe("https://storage.example.com/generated-preview.png");
    expect(resolved.fullUrl).toBe("https://storage.example.com/generated-full.png");
    expect(resolved.fallbackUrl).toBe("https://storage.example.com/generated-full.png");
  });
});
