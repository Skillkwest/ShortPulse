import { describe, expect, it } from "vitest";
import { fitEphemeralImageUrlsToSendBudget } from "../ephemeralComposerImage";

describe("fitEphemeralImageUrlsToSendBudget", () => {
  it("preserves ten already-bounded inline images in order", async () => {
    const input = new Map(
      Array.from({ length: 10 }, (_, index) => [
        `image-${index + 1}`,
        `data:image/jpeg;base64,${Buffer.from(`image-${index + 1}`).toString("base64")}`,
      ])
    );
    const result = await fitEphemeralImageUrlsToSendBudget(input);
    expect(Array.from(result.entries())).toEqual(Array.from(input.entries()));
  });

  it("leaves existing HTTPS image media untouched", async () => {
    const input = new Map([["image-1", "https://example.test/image.png"]]);
    await expect(fitEphemeralImageUrlsToSendBudget(input)).resolves.toEqual(input);
  });
});
