import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE,
  fitEphemeralImageUrlsToSendBudget,
} from "../ephemeralComposerImage";

describe("fitEphemeralImageUrlsToSendBudget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
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

  it("fails explicitly when an oversized inline image cannot be compacted", async () => {
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 2048;
        naturalHeight = 2048;
        width = 2048;
        height = 2048;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      `data:image/jpeg;base64,${"B".repeat(100 * 1024)}`
    );
    const input = new Map(
      Array.from({ length: 10 }, (_, index) => [
        `image-${index + 1}`,
        `data:image/png;base64,${"A".repeat(100 * 1024)}`,
      ])
    );

    await expect(fitEphemeralImageUrlsToSendBudget(input)).rejects.toThrow(
      EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE
    );
  });
});
