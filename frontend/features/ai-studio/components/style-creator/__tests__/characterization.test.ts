/**
 * Characterization tests for the real user-reported Reference Grid -> Styles flows.
 * Locks the passing local upload lane and the failing internal-media lanes before further cleanup.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeStyleDropPreviewError, resolveDroppedStylePreview } from "../intake";
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

  it("fails deterministically for generated output -> Reference Grid -> Styles when internal authority is unresolved", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => null);

    await expect(
      resolveDroppedStylePreview(failingGeneratedInternalStyleDropTransfer(), {
        resolveInternalStyleDrop: resolver,
      })
    ).rejects.toThrow("blocked-style-image-source");

    try {
      await resolveDroppedStylePreview(failingGeneratedInternalStyleDropTransfer(), {
        resolveInternalStyleDrop: resolver,
      });
    } catch (error) {
      expect(normalizeStyleDropPreviewError(error)).toEqual({
        code: "blocked-style-image-source",
        classifierReason: "internal_source_unresolved",
      });
    }
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails deterministically for Media Library -> Reference Grid -> Styles when internal authority is unresolved", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => null);

    await expect(
      resolveDroppedStylePreview(failingMediaLibraryInternalStyleDropTransfer(), {
        resolveInternalStyleDrop: resolver,
      })
    ).rejects.toThrow("blocked-style-image-source");

    try {
      await resolveDroppedStylePreview(failingMediaLibraryInternalStyleDropTransfer(), {
        resolveInternalStyleDrop: resolver,
      });
    } catch (error) {
      expect(normalizeStyleDropPreviewError(error)).toEqual({
        code: "blocked-style-image-source",
        classifierReason: "internal_source_unresolved",
      });
    }
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
