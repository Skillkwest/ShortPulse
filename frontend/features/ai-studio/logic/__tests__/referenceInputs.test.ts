import { describe, expect, it } from "vitest";
import {
  buildImageReferenceInputs,
  buildRegenerateReferencePool,
  buildVideoReferenceInputs,
} from "../referenceInputs";

describe("buildImageReferenceInputs", () => {
  it("keeps primary first and removes duplicate extras", () => {
    expect(
      buildImageReferenceInputs("https://example.com/primary.png", [
        "https://example.com/primary.png",
        "https://example.com/extra-a.png",
        null,
        "https://example.com/extra-b.png",
      ])
    ).toEqual([
      "https://example.com/primary.png",
      "https://example.com/extra-a.png",
      "https://example.com/extra-b.png",
    ]);
  });
});

describe("buildVideoReferenceInputs", () => {
  it("uses only primary in standard mode", () => {
    expect(
      buildVideoReferenceInputs(
        "https://example.com/primary.png",
        ["https://example.com/extra-a.png"],
        "standard"
      )
    ).toEqual(["https://example.com/primary.png"]);
  });

  it("includes primary + extras for keyframes mode", () => {
    expect(
      buildVideoReferenceInputs(
        "https://example.com/first.png",
        ["https://example.com/last.png", null],
        "keyframes"
      )
    ).toEqual(["https://example.com/first.png", "https://example.com/last.png"]);
  });
});

describe("buildRegenerateReferencePool", () => {
  it("never prepends active output for video tools", () => {
    expect(
      buildRegenerateReferencePool({
        selectedTool: "video",
        useReferenceImageIndicator: true,
        activeOutputPreviewUrl: "https://example.com/generated.mp4",
        referenceUrl: "https://example.com/first.png",
        extraUrls: ["https://example.com/last.png", null, null],
        videoReferenceMode: "keyframes",
      })
    ).toEqual(["https://example.com/first.png", "https://example.com/last.png"]);
  });

  it("prepends active output for non-video/non-image tools when indicator is enabled", () => {
    expect(
      buildRegenerateReferencePool({
        selectedTool: "create",
        useReferenceImageIndicator: true,
        activeOutputPreviewUrl: "https://example.com/active.png",
        referenceUrl: "https://example.com/reference.png",
        extraUrls: ["https://example.com/extra.png", null],
        videoReferenceMode: "standard",
      })
    ).toEqual([
      "https://example.com/active.png",
      "https://example.com/reference.png",
      "https://example.com/extra.png",
    ]);
  });
});
