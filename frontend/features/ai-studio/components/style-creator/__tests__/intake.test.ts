/**
 * Unit tests for styles-library intake preprocessing and fallback prompt sanitization.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampStylePromptCharacters,
  normalizeStylePromptFallbackText,
  preprocessStyleImageDataUrl,
  resizeImageDataUrlForExtraction,
} from "../intake";

const originalImage = globalThis.Image;
const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;

const installImageAndCanvasMocks = ({
  width,
  height,
  toDataUrl,
}: {
  width: number;
  height: number;
  toDataUrl?: (canvas: HTMLCanvasElement) => string;
}) => {
  const drawImage = vi.fn();
  class MockImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    naturalWidth = width;
    naturalHeight = height;
    width = width;
    height = height;
    set src(_value: string) {
      this.onload?.();
    }
  }

  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: MockImage,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: () =>
      ({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
        drawImage,
      }) as unknown as CanvasRenderingContext2D,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    writable: true,
    value: function toDataUrlForCanvas() {
      if (toDataUrl) return toDataUrl(this as HTMLCanvasElement);
      return "data:image/jpeg;base64,mock";
    },
  });
  return { drawImage };
};

afterEach(() => {
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: originalImage,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: originalCanvasGetContext,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    writable: true,
    value: originalCanvasToDataUrl,
  });
});

describe("style-creator intake preprocessing", () => {
  it("caps extraction resize longest dimension at 1024 while preserving aspect ratio", async () => {
    const { drawImage } = installImageAndCanvasMocks({
      width: 2400,
      height: 1200,
      toDataUrl: () => "data:image/jpeg;base64,resized",
    });
    const resized = await resizeImageDataUrlForExtraction("data:image/png;base64,source");

    expect(resized).toBe("data:image/jpeg;base64,resized");
    expect(drawImage).toHaveBeenCalledTimes(1);
    const drawArgs = drawImage.mock.calls[0] ?? [];
    expect(drawArgs[3]).toBe(2400);
    expect(drawArgs[4]).toBe(1200);
    expect(drawArgs[7]).toBe(1024);
    expect(drawArgs[8]).toBe(512);
  });

  it("does not upscale extraction images that are already below the max bound", async () => {
    const { drawImage } = installImageAndCanvasMocks({
      width: 600,
      height: 400,
      toDataUrl: () => "data:image/jpeg;base64,no-upscale",
    });
    const resized = await resizeImageDataUrlForExtraction("data:image/png;base64,small");

    expect(resized).toBe("data:image/jpeg;base64,no-upscale");
    expect(drawImage).toHaveBeenCalledTimes(1);
    const drawArgs = drawImage.mock.calls[0] ?? [];
    expect(drawArgs[7]).toBe(600);
    expect(drawArgs[8]).toBe(400);
  });

  it("preprocesses preview as 512 square and extraction as aspect-preserving bounded output", async () => {
    const { drawImage } = installImageAndCanvasMocks({
      width: 1600,
      height: 1200,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const processed = await preprocessStyleImageDataUrl("data:image/png;base64,source");

    expect(processed.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
    expect(processed.extractionSourceImageUrl).toBe("data:image/jpeg;base64,1024x768");
    expect(drawImage).toHaveBeenCalledTimes(2);
    const resizedTargets = drawImage.mock.calls.map((args) => [args[7], args[8]]);
    expect(resizedTargets).toContainEqual([512, 512]);
    expect(resizedTargets).toContainEqual([1024, 768]);
  });
});

describe("style-creator intake fallback prompt sanitization", () => {
  it("drops filename-like payloads", () => {
    expect(normalizeStylePromptFallbackText("Screenshot 2026-03-10 at 11.49.19 AM.png")).toBe("");
    expect(normalizeStylePromptFallbackText("IMG_4095.JPG")).toBe("");
    expect(normalizeStylePromptFallbackText("C:\\Users\\name\\Desktop\\style.webp")).toBe("");
  });

  it("drops file-url payloads", () => {
    expect(
      normalizeStylePromptFallbackText("file:///Users/name/Desktop/Screenshot%202026-03-10.png")
    ).toBe("");
  });

  it("keeps descriptive prompt text", () => {
    expect(
      normalizeStylePromptFallbackText("Muted cinematic lighting, low-saturation teal/orange grade")
    ).toBe("Muted cinematic lighting, low-saturation teal/orange grade");
  });

  it("clamps style prompt fallback text to 1000 characters", () => {
    const overBudget = "a".repeat(1100);
    const normalized = normalizeStylePromptFallbackText(overBudget);
    expect(normalized.length).toBe(1000);
  });
});

describe("style-creator style prompt length clamp", () => {
  it("limits prompt strings to 1000 characters", () => {
    expect(clampStylePromptCharacters("a".repeat(1100)).length).toBe(1000);
    expect(clampStylePromptCharacters("a".repeat(120)).length).toBe(120);
  });
});
