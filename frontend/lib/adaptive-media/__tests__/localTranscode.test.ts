/**
 * Tests for local image upload preprocessing transcodes.
 * Verifies the browser resize/compress helper keeps small blobs intact and downscales large ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  maybePreprocessLocalImageFileForUpload,
  maybeTranscodeLocalImageBlobForUpload,
} from "../localTranscode";

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
    const createElementSpy = vi.spyOn(document, "createElement");
    const sourceBlob = new Blob(["tiny"], { type: "image/png" });

    const result = await maybeTranscodeLocalImageBlobForUpload(sourceBlob);

    expect(result).toBe(sourceBlob);
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

    const sourceBlob = new Blob([new Uint8Array(9 * 1024 * 1024)], { type: "image/png" });
    const result = await maybeTranscodeLocalImageBlobForUpload(sourceBlob);

    expect(result).not.toBe(sourceBlob);
    expect(result.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.88);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps compressing when the first upload transcode remains over the upload target", async () => {
    const close = vi.fn();
    const bitmap = {
      width: 4096,
      height: 4096,
      close,
    } as unknown as ImageBitmap;
    globalThis.createImageBitmap = vi.fn(async () => bitmap) as typeof createImageBitmap;

    const encodedSizes = [24 * 1024 * 1024, 2 * 1024 * 1024];
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      const size = encodedSizes.shift() ?? 1024;
      callback(new Blob([new Uint8Array(size)], { type: type ?? "image/webp" }));
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

    const sourceBlob = new Blob([new Uint8Array(30 * 1024 * 1024)], { type: "image/png" });
    const result = await maybeTranscodeLocalImageBlobForUpload(sourceBlob);

    expect(result).not.toBe(sourceBlob);
    expect(result.size).toBe(2 * 1024 * 1024);
    expect(toBlob).toHaveBeenNthCalledWith(1, expect.any(Function), "image/webp", 0.88);
    expect(toBlob).toHaveBeenNthCalledWith(2, expect.any(Function), "image/webp", 0.76);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps downsizing with jpeg when webp encoding cannot produce an upload-safe blob", async () => {
    const close = vi.fn();
    const bitmap = {
      width: 4096,
      height: 4096,
      close,
    } as unknown as ImageBitmap;
    globalThis.createImageBitmap = vi.fn(async () => bitmap) as typeof createImageBitmap;

    const jpegSizes = [24 * 1024 * 1024, 2 * 1024 * 1024];
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      if (type === "image/webp") {
        callback(null);
        return;
      }
      const size = jpegSizes.shift() ?? 1024;
      callback(new Blob([new Uint8Array(size)], { type: type ?? "image/jpeg" }));
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

    const sourceBlob = new Blob([new Uint8Array(30 * 1024 * 1024)], { type: "image/png" });
    const result = await maybeTranscodeLocalImageBlobForUpload(sourceBlob);

    expect(result).not.toBe(sourceBlob);
    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBe(2 * 1024 * 1024);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.88);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.76);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("wraps transcoded blobs back into files with an aligned filename extension", async () => {
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

    const oversizedFile = new File([new Uint8Array(9 * 1024 * 1024)], "portrait.png", {
      type: "image/png",
      lastModified: 1234,
    });

    const result = await maybePreprocessLocalImageFileForUpload(oversizedFile);

    expect(result).toBeInstanceOf(File);
    expect(result).not.toBe(oversizedFile);
    expect(result.type).toBe("image/webp");
    expect(result.name).toBe("portrait.webp");
    expect(result.lastModified).toBe(1234);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
