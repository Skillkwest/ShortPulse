import { describe, expect, it } from "vitest";
import { VIDEO_PREVIEW_SCALE_FILTER } from "../videoPosterVariant";

describe("videoPosterVariant", () => {
  it("uses an even-dimension scale filter for preview-loop extraction", () => {
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("scale=360:-2");
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("ceil(iw/2)*2");
    expect(VIDEO_PREVIEW_SCALE_FILTER).toContain("ceil(ih/2)*2");
  });
});
