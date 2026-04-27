import { describe, expect, it } from "vitest";
import { getAdminModelWorkflowType } from "../modelWorkflowType";

describe("getAdminModelWorkflowType", () => {
  it("maps image edit models to image-to-image", () => {
    expect(
      getAdminModelWorkflowType({
        id: "fal-ai/bria/background/remove",
        mediaType: "image",
        supportsImageToImage: true,
      })
    ).toBe("Image to image");

    expect(
      getAdminModelWorkflowType({
        id: "fal-ai/flux-kontext-lora/inpaint",
        mediaType: "image",
        supportsImageToImage: true,
      })
    ).toBe("Image to image");
  });

  it("maps dual-capability image models to the combined admin label", () => {
    expect(
      getAdminModelWorkflowType({
        id: "gpt-image-2",
        mediaType: "image",
        supportsTextToImage: true,
        supportsImageToImage: true,
      })
    ).toBe("Text + image edit");
  });

  it("maps prompt-first Kie video lanes to text-to-video", () => {
    expect(
      getAdminModelWorkflowType({
        id: "kie-ai/veo-3.1-fast-i2v",
        mediaType: "image-to-video",
      })
    ).toBe("Text to video");

    expect(
      getAdminModelWorkflowType({
        id: "kie-ai/seedance-2",
        mediaType: "image-to-video",
      })
    ).toBe("Text to video");
  });

  it("keeps Kie Kling as image-to-video", () => {
    expect(
      getAdminModelWorkflowType({
        id: "kie-ai/kling-3.0",
        mediaType: "image-to-video",
      })
    ).toBe("Image to video");
  });

  it("maps text/image primitives to the canonical admin labels", () => {
    expect(
      getAdminModelWorkflowType({
        id: "fal-ai/flux-2/klein/9b",
        mediaType: "image",
        supportsTextToImage: true,
      })
    ).toBe("Text to image");

    expect(
      getAdminModelWorkflowType({
        id: "gpt-5-nano",
        mediaType: "text",
      })
    ).toBe("Text");
  });
});
