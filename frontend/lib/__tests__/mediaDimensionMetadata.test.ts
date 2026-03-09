import { describe, expect, it } from "vitest";
import {
  resolveImageDimensionsFromMetadata,
  withCanonicalImageDimensions,
} from "../mediaDimensionMetadata";

describe("mediaDimensionMetadata", () => {
  it("resolves dimensions from canonical keys", () => {
    expect(
      resolveImageDimensionsFromMetadata({
        width: 1920,
        height: 1080,
      })
    ).toEqual({ width: 1920, height: 1080 });
  });

  it("resolves dimensions from legacy and nested keys", () => {
    expect(
      resolveImageDimensionsFromMetadata({
        image_width: "1200",
        dimensions: { height: "800" },
      })
    ).toEqual({ width: 1200, height: 800 });
  });

  it("writes canonical keys and aspect ratio", () => {
    expect(
      withCanonicalImageDimensions(
        {
          custom_flag: true,
        },
        { width: 1000, height: 625 }
      )
    ).toEqual({
      custom_flag: true,
      width: 1000,
      height: 625,
      aspect_ratio: 1.6,
    });
  });
});
