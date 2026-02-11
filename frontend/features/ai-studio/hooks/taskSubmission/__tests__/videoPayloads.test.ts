/**
 * Unit tests for video submission payload normalization helpers.
 */
import { describe, expect, it } from "vitest";
import {
  buildKlingElementsPayload,
  buildKlingMultiPromptPayload,
  resolveSeedanceI2VDuration,
  resolveVeoResolution,
} from "../videoPayloads";

describe("resolveVeoResolution", () => {
  it("defaults to 720p for image-to-video style flows", () => {
    expect(resolveVeoResolution(undefined)).toBe("720p");
  });

  it("supports a custom fallback for text-to-video flow", () => {
    expect(resolveVeoResolution(undefined, "1080p")).toBe("1080p");
  });
});

describe("resolveSeedanceI2VDuration", () => {
  it("clamps values to the API-supported range", () => {
    expect(resolveSeedanceI2VDuration(1)).toBe("2");
    expect(resolveSeedanceI2VDuration(8)).toBe("8");
    expect(resolveSeedanceI2VDuration(24)).toBe("12");
  });
});

describe("buildKlingMultiPromptPayload", () => {
  it("strips empty prompts and trims populated prompts", () => {
    const payload = buildKlingMultiPromptPayload([
      { id: "one", prompt: "  shot one  ", duration: 5 },
      { id: "two", prompt: "   ", duration: 7 },
    ]);

    expect(payload).toEqual([{ prompt: "shot one", duration: 5 }]);
  });
});

describe("buildKlingElementsPayload", () => {
  it("builds mixed video and image element entries", () => {
    const payload = buildKlingElementsPayload([
      {
        id: "video",
        frontalImageUrl: "",
        referenceImageUrls: "",
        videoUrl: "https://example.com/motion.mp4",
      },
      {
        id: "image",
        frontalImageUrl: " https://example.com/front.png ",
        referenceImageUrls: "https://example.com/ref-a.png, https://example.com/ref-b.png",
        videoUrl: "",
      },
    ]);

    expect(payload).toEqual([
      { video_url: "https://example.com/motion.mp4" },
      {
        frontal_image_url: "https://example.com/front.png",
        reference_image_urls: ["https://example.com/ref-a.png", "https://example.com/ref-b.png"],
      },
    ]);
  });
});
