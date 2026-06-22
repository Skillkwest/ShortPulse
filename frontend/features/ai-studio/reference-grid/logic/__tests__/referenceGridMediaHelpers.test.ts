/**
 * Regression tests for Reference Grid media-kind detection helpers.
 */
import { describe, expect, it } from "vitest";
import { isOutputAudioPreview, isOutputVideoPreview } from "../referenceGridMediaHelpers";

describe("referenceGridMediaHelpers", () => {
  it("does not force video preview for stale image-mode restored output", () => {
    const url = "https://tempfile.aiquickdraw.com/videos/generated-output.png";

    expect(isOutputVideoPreview({ mode: "image" }, url)).toBe(false);
    expect(isOutputAudioPreview({ mode: "image" }, url)).toBe(false);
  });

  it("treats audio URLs as audio previews even when restored output mode is stale", () => {
    const url = "https://cdn.example.com/generated-output.mp3";

    expect(isOutputAudioPreview({ mode: "image" }, url)).toBe(true);
    expect(isOutputVideoPreview({ mode: "image" }, url)).toBe(false);
  });

  it("keeps explicit audio outputs from rendering as video previews", () => {
    expect(isOutputVideoPreview({ mode: "audio" }, "https://cdn.example.com/output.mp4")).toBe(
      false
    );
  });

  it("keeps explicit video outputs from rendering as audio previews", () => {
    expect(isOutputAudioPreview({ mode: "video" }, "https://cdn.example.com/output.mp3")).toBe(
      false
    );
  });

  it("uses explicit audio output mode for local object URLs without marker fragments", () => {
    expect(
      isOutputAudioPreview({ mode: "audio" }, "blob:https://shortpulse.test/local-audio")
    ).toBe(true);
    expect(
      isOutputVideoPreview({ mode: "audio" }, "blob:https://shortpulse.test/local-audio")
    ).toBe(false);
  });
});
