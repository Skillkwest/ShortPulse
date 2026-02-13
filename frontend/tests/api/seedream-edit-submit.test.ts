import { describe, expect, it } from "vitest";
import { validateSeedreamEditPayload } from "../../pages/api/fal/seedream-edit-submit";

describe("validateSeedreamEditPayload", () => {
  it("accepts a valid payload with up to 10 image URLs", () => {
    expect(
      validateSeedreamEditPayload({
        prompt: "Apply the same character identity in a cinematic frame.",
        image_urls: [
          "https://example.com/front.png",
          "https://example.com/side.png",
          "https://example.com/back.png",
        ],
      })
    ).toBeNull();
  });

  it("requires prompt and at least one image URL", () => {
    expect(validateSeedreamEditPayload({})).toMatchObject({
      detail: { field: "prompt" },
    });
    expect(validateSeedreamEditPayload({ prompt: "x", image_urls: [] })).toMatchObject({
      detail: { field: "image_urls" },
    });
  });

  it("rejects payloads with more than 10 image URLs", () => {
    const imageUrls = new Array(11).fill("https://example.com/ref.png");
    expect(
      validateSeedreamEditPayload({
        prompt: "x",
        image_urls: imageUrls,
      })
    ).toMatchObject({
      detail: { field: "image_urls", max: 10 },
    });
  });

  it("rejects obvious video sources in image_urls", () => {
    expect(
      validateSeedreamEditPayload({
        prompt: "x",
        image_urls: ["https://example.com/reference.mp4"],
      })
    ).toMatchObject({
      detail: { field: "image_urls" },
    });

    expect(
      validateSeedreamEditPayload({
        prompt: "x",
        image_urls: ["data:video/mp4;base64,AAAA"],
      })
    ).toMatchObject({
      detail: { field: "image_urls" },
    });
  });
});
