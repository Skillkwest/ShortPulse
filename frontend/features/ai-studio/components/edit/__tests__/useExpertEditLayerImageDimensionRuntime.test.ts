import { describe, expect, it } from "vitest";

import {
  shouldApplySeededLayerImageDimensions,
  shouldProbeLayerImageDimensions,
  type LayerImageDimensionCacheEntry,
} from "../useExpertEditLayerImageDimensionRuntime";

const seededCacheEntry: LayerImageDimensionCacheEntry = {
  url: "https://cdn.shortpulse.test/source.png",
  width: 1600,
  height: 900,
  isRenderable: true,
  source: "seed",
};

const probedCacheEntry: LayerImageDimensionCacheEntry = {
  url: "https://cdn.shortpulse.test/source.png",
  width: 400,
  height: 800,
  isRenderable: true,
  source: "probe",
};

describe("Expert Edit layer image dimension cache decisions", () => {
  it("keeps seeded drag dimensions provisional so actual image dimensions can replace them", () => {
    expect(
      shouldProbeLayerImageDimensions({
        imageUrl: seededCacheEntry.url,
        cached: seededCacheEntry,
      })
    ).toBe(true);

    expect(
      shouldProbeLayerImageDimensions({
        imageUrl: probedCacheEntry.url,
        cached: probedCacheEntry,
      })
    ).toBe(false);
  });

  it("does not let later drag metadata overwrite already probed dimensions", () => {
    expect(
      shouldApplySeededLayerImageDimensions({
        current: probedCacheEntry,
        url: probedCacheEntry.url,
        dimensions: {
          width: 1600,
          height: 900,
        },
      })
    ).toBe(false);
  });
});
