/**
 * Characterization tests for the real user-reported Reference Grid -> Styles flows.
 * Locks the passing local upload lane and the failing internal-media lanes before further cleanup.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeStyleDropPreviewError,
  resolveDroppedStylePreview,
} from "../../../logic/styleCreatorIntake";
import type { ResolveInternalStyleDrop } from "../styleSourceResolver";
import {
  failingGeneratedInternalStyleDropTransfer,
  failingMediaLibraryInternalStyleDropTransfer,
  passingLocalUploadStyleDropTransfer,
} from "./styleDropCharacterization.fixtures";

const originalImage = globalThis.Image;
const originalFileReader = globalThis.FileReader;
const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;

const installImageAndCanvasMocks = ({ width, height }: { width: number; height: number }) => {
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
        drawImage: () => undefined,
      }) as unknown as CanvasRenderingContext2D,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    writable: true,
    value: function toDataUrlForCanvas() {
      return `data:image/jpeg;base64,${this.width}x${this.height}`;
    },
  });
};

const installFileReaderMock = (result: string) => {
  class MockFileReader {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    result: string | null = null;

    readAsDataURL() {
      this.result = result;
      this.onload?.();
    }
  }

  Object.defineProperty(globalThis, "FileReader", {
    configurable: true,
    writable: true,
    value: MockFileReader,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: originalImage,
  });
  Object.defineProperty(globalThis, "FileReader", {
    configurable: true,
    writable: true,
    value: originalFileReader,
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

describe("style drop characterization", () => {
  it("keeps local upload -> Reference Grid -> Styles as a passing byte-backed lane", async () => {
    installImageAndCanvasMocks({ width: 1600, height: 1200 });
    installFileReaderMock("data:image/png;base64,from-local-upload");

    const resolved = await resolveDroppedStylePreview(passingLocalUploadStyleDropTransfer());

    expect(resolved).toEqual({
      previewImageUrl: "data:image/jpeg;base64,512x512",
      extractionSourceImageUrl: "data:image/jpeg;base64,1024x768",
      promptText: "",
    });
  });

  it("falls back to snapshot URLs for generated output -> Reference Grid -> Styles when internal authority is unresolved", async () => {
    installImageAndCanvasMocks({ width: 1600, height: 1200 });
    installFileReaderMock("data:image/png;base64,from-generated-fallback");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["generated-fallback-bytes"], { type: "image/png" }),
    } as Response);
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => null);

    const resolved = await resolveDroppedStylePreview(failingGeneratedInternalStyleDropTransfer(), {
      resolveInternalStyleDrop: resolver,
    });

    expect(resolved).toEqual({
      previewImageUrl: "data:image/jpeg;base64,512x512",
      extractionSourceImageUrl: "data:image/jpeg;base64,1024x768",
      promptText: "generated prompt",
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to snapshot URLs for Media Library -> Reference Grid -> Styles when internal authority is unresolved", async () => {
    installImageAndCanvasMocks({ width: 1600, height: 1200 });
    installFileReaderMock("data:image/png;base64,from-library-fallback");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["library-fallback-bytes"], { type: "image/png" }),
    } as Response);
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => null);

    const resolved = await resolveDroppedStylePreview(
      failingMediaLibraryInternalStyleDropTransfer(),
      {
        resolveInternalStyleDrop: resolver,
      }
    );

    expect(resolved).toEqual({
      previewImageUrl: "data:image/jpeg;base64,512x512",
      extractionSourceImageUrl: "data:image/jpeg;base64,1024x768",
      promptText: "library prompt",
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("still reports blocked-source only after fallback URLs fail too", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 403 }));
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => null);

    await expect(
      resolveDroppedStylePreview(failingGeneratedInternalStyleDropTransfer(), {
        resolveInternalStyleDrop: resolver,
      })
    ).rejects.toThrow("expired-style-image-source");

    try {
      await resolveDroppedStylePreview(failingGeneratedInternalStyleDropTransfer(), {
        resolveInternalStyleDrop: resolver,
      });
    } catch (error) {
      expect(normalizeStyleDropPreviewError(error)).toEqual({
        code: "expired-style-image-source",
        classifierReason: "reference_url_expired",
      });
    }
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
