import { describe, expect, it } from "vitest";
import {
  deriveElementStatusFromDraft,
  hasRequiredElementMediaReferences,
  normalizeElementImageReferenceUrls,
} from "../elementReadiness";

describe("elementReadiness", () => {
  it("normalizes image references to trimmed distinct values", () => {
    expect(
      normalizeElementImageReferenceUrls([
        " https://example.com/front.png ",
        "https://example.com/front.png",
        "",
        "https://example.com/side.png",
      ])
    ).toEqual(["https://example.com/front.png", "https://example.com/side.png"]);
  });

  it("applies the slot limit after removing duplicate references", () => {
    expect(
      normalizeElementImageReferenceUrls(
        [
          "https://example.com/front.png",
          "https://example.com/front.png",
          "https://example.com/side-a.png",
          "https://example.com/side-b.png",
        ],
        3
      )
    ).toEqual([
      "https://example.com/front.png",
      "https://example.com/side-a.png",
      "https://example.com/side-b.png",
    ]);
  });

  it("requires two distinct image references for image elements", () => {
    expect(
      hasRequiredElementMediaReferences({
        assetType: "image",
        imageReferenceUrls: ["https://example.com/front.png", "https://example.com/front.png"],
        videoReferenceUrl: null,
      })
    ).toBe(false);
    expect(
      hasRequiredElementMediaReferences({
        assetType: "image",
        imageReferenceUrls: ["https://example.com/front.png", "https://example.com/side.png"],
        videoReferenceUrl: null,
      })
    ).toBe(true);
  });

  it("derives draft status when duplicate refs would not make a reusable element", () => {
    expect(
      deriveElementStatusFromDraft({
        name: "Lantern",
        assetType: "image",
        imageReferenceUrls: ["https://example.com/front.png", "https://example.com/front.png"],
        videoReferenceUrl: null,
      })
    ).toBe("draft");
  });

  it("derives ready status for video elements with a motion reference", () => {
    expect(
      deriveElementStatusFromDraft({
        name: "Lantern Motion",
        assetType: "video",
        imageReferenceUrls: [],
        videoReferenceUrl: " https://example.com/motion.mp4 ",
      })
    ).toBe("ready");
  });
});
