import { describe, expect, it } from "vitest";
import { resolveDurationMetadataPatch } from "../mediaLibraryDurationMetadata";

describe("mediaLibraryDurationMetadata", () => {
  it("normalizes numeric string duration metadata for Media Library persistence", () => {
    expect(resolveDurationMetadataPatch({ duration_seconds: "12.5" })).toEqual({
      duration_ms: 12_500,
      duration_seconds: 12.5,
    });
  });

  it("ignores invalid string duration metadata", () => {
    expect(resolveDurationMetadataPatch({ duration_seconds: "unknown" })).toBeNull();
  });
});
