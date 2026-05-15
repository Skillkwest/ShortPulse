import { describe, expect, it } from "vitest";
import { classifyDisposition } from "../audit_orphaned_media_videos.mjs";

describe("audit_orphaned_media_videos", () => {
  it("classifies preview-backed videos as durable and playable", () => {
    expect(
      classifyDisposition({
        sourceStatus: "missing",
        previewStatus: "available",
        posterStatus: "available",
      })
    ).toBe("durable_preview_available");
  });

  it("classifies source-backed videos as recoverable even without preview variants", () => {
    expect(
      classifyDisposition({
        sourceStatus: "available",
        previewStatus: "missing",
        posterStatus: "available",
      })
    ).toBe("source_recoverable");
  });

  it("classifies poster-only rows separately from fully orphaned rows", () => {
    expect(
      classifyDisposition({
        sourceStatus: "missing",
        previewStatus: "missing",
        posterStatus: "available",
      })
    ).toBe("poster_only_orphan");

    expect(
      classifyDisposition({
        sourceStatus: "missing",
        previewStatus: "none",
        posterStatus: "missing",
      })
    ).toBe("fully_orphaned");
  });
});
