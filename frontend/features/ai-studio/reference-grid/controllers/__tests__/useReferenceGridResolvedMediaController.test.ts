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
});
