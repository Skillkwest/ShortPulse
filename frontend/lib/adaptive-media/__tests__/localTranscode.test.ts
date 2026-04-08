/**
 * Tests for local image upload preprocessing transcodes.
 * Verifies the browser resize/compress helper keeps small blobs intact and downscales large ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maybeTranscodeLocalImageBlobForUpload } from "../localTranscode";

const originalCreateImageBitmap = globalThis.createImageBitmap;
const originalCreateElement = document.createElement.bind(document);

describe("localTranscode upload preprocessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (typeof originalCreateImageBitmap === "function") {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      Reflect.deleteProperty(
        globalThis as typeof globalThis & {
          createImageBitmap?: typeof createImageBitmap;
        },
        "createImageBitmap"
      );
    }
  });

  it("returns the original blob when preprocessing is unnecessary", async () => {
    const close = vi.fn();
    const bitmap = {
      width: 1200,
      height: 800,
      close,
    } as unknown as ImageBitmap;
    globalThis.createImageBitmap = vi.fn(async () => bitmap) as typeof createImageBitmap;
    const createElementSpy = vi.spyOn(document, "createElement");
    const sourceBlob = new Blob(["tiny"], { type: "image/png" });

    const result = await maybeTranscodeLocalImageBlobForUpload(sourceBlob);

    expect(result).toBe(sourceBlob);
    expect(close).toHaveBeenCalledTimes(1);
    expect(createElementSpy).not.toHaveBeenCalledWith("canvas");
  });

  it("downscales and re-encodes oversized blobs", async () => {
    const close = vi.fn();
    const bitmap = {
      width: 4096,
      height: 3072,
      close,
    } as unknown as ImageBitmap;
    globalThis.createImageBitmap = vi.fn(async () => bitmap) as typeof createImageBitmap;

    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      callback(new Blob(["encoded"], { type: type ?? "image/webp" }));
    });
    const fakeContext = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage,
    } as unknown as CanvasRenderingContext2D;
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => fakeContext),
      toBlob,
    } as unknown as HTMLCanvasElement;

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) =>
      tagName === "canvas"
        ? fakeCanvas
        : originalCreateElement(tagName)) as typeof document.createElement);

    const sourceBlob = new Blob(["oversized"], { type: "image/png" });
    const result = await maybeTranscodeLocalImageBlobForUpload(sourceBlob);

    expect(result).not.toBe(sourceBlob);
    expect(result.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.88);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
