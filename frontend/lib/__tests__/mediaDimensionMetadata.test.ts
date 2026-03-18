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
      dimension_status: "known",
      dimension_source: "extracted",
    });
  });

  it("marks missing dimensions explicitly when no extracted or metadata dimensions exist", () => {
    expect(
      withCanonicalImageDimensions(
        {
          custom_flag: true,
        },
        null
      )
    ).toEqual({
      custom_flag: true,
      width: null,
      height: null,
      aspect_ratio: null,
      dimension_status: "missing",
      dimension_source: "missing",
    });
  });

  it("uses existing metadata dimensions when extracted dimensions are absent", () => {
    expect(
      withCanonicalImageDimensions(
        {
          image_width: "1200",
          image_height: 800,
        },
        null
      )
    ).toEqual({
      image_width: "1200",
      image_height: 800,
      width: 1200,
      height: 800,
      aspect_ratio: 1.5,
      dimension_status: "known",
      dimension_source: "metadata",
    });
  });
});
