/**
 * Regression tests for Reference Grid media-kind detection helpers.
 */
import { describe, expect, it } from "vitest";
import { isOutputAudioPreview, isOutputVideoPreview } from "../referenceGridMediaHelpers";

describe("referenceGridMediaHelpers", () => {
  it("treats video URLs as video previews even when restored output mode is stale", () => {
    const url = "https://tempfile.aiquickdraw.com/v/generated-output.mp4";

    expect(isOutputVideoPreview({ mode: "image" }, url)).toBe(true);
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
});
