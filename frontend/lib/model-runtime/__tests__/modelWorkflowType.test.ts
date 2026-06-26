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
        id: "example/dual-image-model",
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
        generationLanes: ["text-to-video", "image-to-video"],
      })
    ).toBe("Text to video");

    expect(
      getAdminModelWorkflowType({
        id: "kie-ai/seedance-2",
        mediaType: "image-to-video",
        generationLanes: ["text-to-video", "image-to-video"],
      })
    ).toBe("Text to video");
  });

  it("keeps Kie Kling as image-to-video", () => {
    expect(
      getAdminModelWorkflowType({
        id: "kie-ai/kling-3.0",
        mediaType: "image-to-video",
        generationLanes: ["image-to-video"],
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
        id: "gpt-5.4-nano",
        mediaType: "text",
      })
    ).toBe("Text to text");
  });

  it("maps audio workflow lanes to explicit admin labels", () => {
    expect(
      getAdminModelWorkflowType({
        id: "music_v1",
        mediaType: "audio",
        generationLanes: ["music"],
      })
    ).toBe("Music");

    expect(
      getAdminModelWorkflowType({
        id: "eleven_sound_effects_v2",
        mediaType: "audio",
        generationLanes: ["sfx"],
      })
    ).toBe("Sound effect");

    expect(
      getAdminModelWorkflowType({
        id: "eleven_v3",
        mediaType: "audio",
        generationLanes: ["text-to-speech"],
      })
    ).toBe("Voiceover");

    expect(
      getAdminModelWorkflowType({
        id: "eleven_english_sts_v2",
        mediaType: "audio",
        generationLanes: ["speech-to-speech"],
      })
    ).toBe("Voice changer");

    expect(
      getAdminModelWorkflowType({
        id: "elevenlabs-voice-design",
        mediaType: "audio",
        generationLanes: ["voice-design"],
      })
    ).toBe("Voice design");
  });
});
