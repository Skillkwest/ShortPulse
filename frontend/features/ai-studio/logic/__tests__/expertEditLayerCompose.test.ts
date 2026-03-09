/**
 * Unit tests for Expert Edit generate flatten composition.
 * Validates layer-image load recovery when Supabase signed URLs expire.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshSupabaseSignedUrlIfNeededMock } = vi.hoisted(() => ({
  refreshSupabaseSignedUrlIfNeededMock: vi.fn(async (url: string) => url),
}));

vi.mock("../../utils/imageUpload", () => ({
  refreshSupabaseSignedUrlIfNeeded: refreshSupabaseSignedUrlIfNeededMock,
}));

import { composePrimaryLayersToBlob } from "../expertEditLayerCompose";

const createMockCanvas = () => {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: BlobCallback, mimeType?: string) => {
      callback(new Blob(["flattened"], { type: mimeType ?? "image/png" }));
    }),
  } as unknown as HTMLCanvasElement;
  return { canvas };
};

describe("composePrimaryLayersToBlob", () => {
  const previousImage = globalThis.Image;
  const createElementSpy = vi.spyOn(document, "createElement");

  afterEach(() => {
    refreshSupabaseSignedUrlIfNeededMock.mockReset();
    createElementSpy.mockRestore();
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: previousImage,
    });
  });

  it("retries layer decode using refreshed signed URL when initial load fails", async () => {
    const expiredUrl =
      "https://project.supabase.co/storage/v1/object/sign/media/a.png?token=expired";
    const refreshedUrl =
      "https://project.supabase.co/storage/v1/object/sign/media/a.png?token=fresh";
    refreshSupabaseSignedUrlIfNeededMock.mockResolvedValueOnce(refreshedUrl);

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 640;
      naturalHeight = 640;

      set src(value: string) {
        if (value === expiredUrl) {
          this.onerror?.();
          return;
        }
        this.onload?.();
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    const { canvas } = createMockCanvas();
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "canvas") return canvas;
      return document.createElementNS("http://www.w3.org/1999/xhtml", tagName) as HTMLElement;
    });

    const blob = await composePrimaryLayersToBlob([{ imageUrl: expiredUrl }], {
      mimeType: "image/png",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(refreshSupabaseSignedUrlIfNeededMock).toHaveBeenCalledWith(expiredUrl);
  });
});
