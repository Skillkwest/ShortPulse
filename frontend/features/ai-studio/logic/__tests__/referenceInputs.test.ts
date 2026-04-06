import { describe, expect, it } from "vitest";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import {
  buildImageReferenceInputs,
  buildRegenerateReferencePool,
  buildVideoReferenceInputs,
  resolveAutoVideoModelForLane,
  resolveVideoGenerationLaneFromFrameInputs,
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
  it("returns no references when no frame images are present", () => {
    expect(buildVideoReferenceInputs(null, [null, null], "standard")).toEqual([]);
  });

  it("uses a single filled frame slot in standard mode", () => {
    expect(
      buildVideoReferenceInputs(
        "https://example.com/primary.png",
        ["https://example.com/extra-a.png"],
        "standard"
      )
    ).toEqual(["https://example.com/primary.png", "https://example.com/extra-a.png"].slice(0, 2));
  });

  it("uses the last-frame slot as single-image input when first frame is empty", () => {
    expect(
      buildVideoReferenceInputs(null, ["https://example.com/last.png", null], "standard")
    ).toEqual(["https://example.com/last.png"]);
  });

  it("uses the first two distinct frames when both frame slots are populated", () => {
    expect(
      buildVideoReferenceInputs(
        "https://example.com/first.png",
        ["https://example.com/last.png", null],
        "standard"
      )
    ).toEqual(["https://example.com/first.png", "https://example.com/last.png"]);
  });
});

describe("resolveVideoGenerationLaneFromFrameInputs", () => {
  it("detects text lane when no frame images are present", () => {
    expect(
      resolveVideoGenerationLaneFromFrameInputs({
        primary: null,
        extras: [null, null, null],
        referenceMode: "standard",
      })
    ).toBe("text");
  });

  it("detects single-image lane when exactly one frame image is present", () => {
    expect(
      resolveVideoGenerationLaneFromFrameInputs({
        primary: null,
        extras: ["https://example.com/last.png", null, null],
        referenceMode: "standard",
      })
    ).toBe("single-image");
  });

  it("detects first-last lane when two frame images are present", () => {
    expect(
      resolveVideoGenerationLaneFromFrameInputs({
        primary: "https://example.com/first.png",
        extras: ["https://example.com/last.png", null, null],
        referenceMode: "standard",
      })
    ).toBe("first-last");
  });
});

describe("resolveAutoVideoModelForLane", () => {
  it("keeps Kie Veo selected across text, single-image, and first-last lanes", () => {
    expect(
      resolveAutoVideoModelForLane({
        currentModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        lane: "text",
      })
    ).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(
      resolveAutoVideoModelForLane({
        currentModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        lane: "single-image",
      })
    ).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(
      resolveAutoVideoModelForLane({
        currentModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        lane: "first-last",
      })
    ).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
  });

  it("maps incompatible Google-family lanes onto the Kie Veo default", () => {
    expect(
      resolveAutoVideoModelForLane({
        currentModel: "fal-ai/veo3.1/image-to-video",
        lane: "text",
      })
    ).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(
      resolveAutoVideoModelForLane({
        currentModel: "fal-ai/veo3.1",
        lane: "single-image",
      })
    ).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(
      resolveAutoVideoModelForLane({
        currentModel: "fal-ai/veo3.1",
        lane: "first-last",
      })
    ).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
  });

  it("migrates legacy Fal Kling selections onto Kie-only compatible lanes", () => {
    expect(
      resolveAutoVideoModelForLane({
        currentModel: "fal-ai/kling-video/v3/pro/text-to-video",
        lane: "text",
      })
    ).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(
      resolveAutoVideoModelForLane({
        currentModel: "fal-ai/kling-video/v3/pro/image-to-video",
        lane: "single-image",
      })
    ).toBe(KIE_KLING_30_MODEL_ID);
    expect(
      resolveAutoVideoModelForLane({
        currentModel: "fal-ai/kling-video/v3/pro/image-to-video",
        lane: "first-last",
      })
    ).toBe(KIE_KLING_30_MODEL_ID);
    expect(
      resolveAutoVideoModelForLane({
        currentModel: "fal-ai/kling-video/v3/pro/image-to-video",
        lane: "motion",
      })
    ).toBe(KIE_KLING_30_MODEL_ID);
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
        videoModelId: "fal-ai/veo3.1/first-last-frame-to-video",
      })
    ).toEqual(["https://example.com/first.png", "https://example.com/last.png"]);
  });

  it("keeps Kie Veo dual-mode references during regenerate in standard mode", () => {
    expect(
      buildRegenerateReferencePool({
        selectedTool: "video",
        useReferenceImageIndicator: false,
        activeOutputPreviewUrl: "https://example.com/generated.mp4",
        referenceUrl: "https://example.com/first.png",
        extraUrls: ["https://example.com/last.png", null, null],
        videoReferenceMode: "standard",
        videoModelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
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
