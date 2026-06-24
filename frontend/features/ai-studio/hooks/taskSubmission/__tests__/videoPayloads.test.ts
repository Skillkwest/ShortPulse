/**
 * Unit tests for video submission payload normalization helpers.
 */
import { describe, expect, it } from "vitest";
import {
  buildKieKlingElementsPayload,
  buildKlingElementsPayload,
  buildKlingMultiPromptPayload,
  resolveKieKlingAspect,
  resolveKlingShotType,
  resolveSeedanceI2VAspect,
  resolveSeedanceTextAspect,
  resolveVeoDuration,
  resolveVeoResolution,
} from "../videoPayloads";
import { createSeedanceImageReferenceSlot } from "../../../logic/klingElements";
import type { SubmissionModelConfig } from "../types";

const makeModelConfig = (
  overrides: Partial<NonNullable<SubmissionModelConfig>>
): NonNullable<SubmissionModelConfig> => ({
  id: "test-model",
  label: "Test Model",
  provider: "fal",
  mediaType: "video",
  surfaces: ["runtime"],
  billable: true,
  defaultAspect: "16:9",
  allowedAspects: ["16:9", "9:16"],
  pricingStrategy: "veo-3-per-second",
  ...overrides,
});

describe("resolveVeoResolution", () => {
  it("defaults to 720p for image-to-video style flows", () => {
    expect(resolveVeoResolution(undefined)).toBe("720p");
  });

  it("supports a custom fallback for text-to-video flow", () => {
    expect(resolveVeoResolution(undefined, "1080p")).toBe("1080p");
  });
});

describe("resolveVeoDuration", () => {
  it("keeps supported Veo durations unchanged", () => {
    expect(resolveVeoDuration(4)).toBe("4s");
    expect(resolveVeoDuration(6)).toBe("6s");
    expect(resolveVeoDuration(8)).toBe("8s");
  });

  it("promotes stale Veo 5-second requests to 6 seconds", () => {
    expect(resolveVeoDuration(5)).toBe("6s");
  });
});

describe("resolveSeedanceI2VAspect", () => {
  it("falls back to 16:9 when selected aspect is not supported", () => {
    expect(
      resolveSeedanceI2VAspect(
        "auto",
        makeModelConfig({
          allowedAspects: ["16:9", "9:16"],
        })
      )
    ).toBe("16:9");
  });

  it("keeps a supported aspect unchanged", () => {
    expect(
      resolveSeedanceI2VAspect(
        "9:16",
        makeModelConfig({
          allowedAspects: ["16:9", "9:16"],
        })
      )
    ).toBe("9:16");
  });
});

describe("resolveKieKlingAspect", () => {
  it("keeps supported Kling aspects unchanged", () => {
    expect(
      resolveKieKlingAspect(
        "1:1",
        makeModelConfig({
          id: "kie-ai/kling-3.0",
          allowedAspects: ["16:9", "9:16", "1:1"],
          defaultAspect: "16:9",
        })
      )
    ).toBe("1:1");
  });

  it("falls back to the Kling default when the selected aspect is unsupported", () => {
    expect(
      resolveKieKlingAspect(
        "21:9",
        makeModelConfig({
          id: "kie-ai/kling-3.0",
          allowedAspects: ["16:9", "9:16", "1:1"],
          defaultAspect: "16:9",
        })
      )
    ).toBe("16:9");
  });
});

describe("resolveSeedanceTextAspect", () => {
  it("keeps supported non-default text aspects unchanged", () => {
    expect(
      resolveSeedanceTextAspect(
        "4:3",
        makeModelConfig({
          allowedAspects: ["16:9", "4:3", "1:1"],
          defaultAspect: "16:9",
        })
      )
    ).toBe("4:3");
  });

  it("falls back to model default when selected aspect is unsupported", () => {
    expect(
      resolveSeedanceTextAspect(
        "auto",
        makeModelConfig({
          allowedAspects: ["16:9", "9:16", "1:1"],
          defaultAspect: "16:9",
        })
      )
    ).toBe("16:9");
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

describe("resolveKlingShotType", () => {
  it("passes through supported Kling shot types", () => {
    expect(resolveKlingShotType("customize")).toBe("customize");
    expect(resolveKlingShotType("intelligent")).toBe("intelligent");
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

describe("buildKieKlingElementsPayload", () => {
  it("uses stable slot-based element names", () => {
    const payload = buildKieKlingElementsPayload([
      {
        id: "slot-3",
        slotIndex: 2,
        name: "Beach",
        alias: "beach",
        frontalImageUrl: "https://example.com/beach-front.png",
        referenceImageUrls: "https://example.com/beach-side.png",
        videoUrl: "",
      },
      {
        id: "slot-1",
        slotIndex: 0,
        name: "Taylor",
        alias: "taylor",
        frontalImageUrl: "",
        referenceImageUrls: "",
        videoUrl: "https://example.com/taylor-motion.mp4",
      },
    ]);

    expect(payload).toEqual([
      {
        name: "element1",
        description: "Reference video for Taylor",
        element_input_video_urls: ["https://example.com/taylor-motion.mp4"],
      },
      {
        name: "element3",
        description: "Reference images for Beach",
        element_input_urls: [
          "https://example.com/beach-front.png",
          "https://example.com/beach-side.png",
        ],
      },
    ]);
  });

  it("fails closed for one-image Kling elements", () => {
    expect(() =>
      buildKieKlingElementsPayload([
        {
          id: "slot-1",
          slotIndex: 0,
          name: "Beach",
          alias: "beach",
          frontalImageUrl: "https://example.com/beach-front.png",
          referenceImageUrls: "",
          videoUrl: "",
        },
      ])
    ).toThrow("needs at least 2 image references");
  });

  it("ignores Seedance-only direct image refs and slots outside Kling's first three", () => {
    const payload = buildKieKlingElementsPayload([
      createSeedanceImageReferenceSlot({
        slotIndex: 0,
        imageUrl: "https://example.com/direct.png",
      }),
      {
        id: "direct-video",
        slotIndex: 2,
        sourceKind: "reference-video",
        sourceElementId: null,
        sourceCharacterId: null,
        name: "Direct video",
        alias: "",
        description: "",
        profileImageUrl: null,
        profileImageTransform: null,
        frontalImageUrl: "",
        referenceImageUrls: "",
        videoUrl: "https://example.com/direct.mp4",
      },
      {
        id: "slot-2",
        slotIndex: 1,
        name: "Taylor",
        alias: "taylor",
        frontalImageUrl: "https://example.com/taylor-front.png",
        referenceImageUrls: "https://example.com/taylor-side.png",
        videoUrl: "",
      },
      {
        id: "slot-4",
        slotIndex: 3,
        name: "Seedance Only",
        alias: "seedanceonly",
        frontalImageUrl: "https://example.com/seedance-front.png",
        referenceImageUrls: "https://example.com/seedance-side.png",
        videoUrl: "",
      },
    ]);

    expect(payload).toEqual([
      {
        name: "element2",
        description: "Reference images for Taylor",
        element_input_urls: [
          "https://example.com/taylor-front.png",
          "https://example.com/taylor-side.png",
        ],
      },
    ]);
  });
});
