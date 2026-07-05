import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEphemeralComposerImageData,
  EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE,
} from "../ephemeralComposerImage";

const originalCreateObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
const originalImageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Image");
const originalFileReaderDescriptor = Object.getOwnPropertyDescriptor(globalThis, "FileReader");
const originalCanvasGetContextDescriptor = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  "getContext"
);
const originalCanvasToDataURLDescriptor = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  "toDataURL"
);

const restoreDescriptor = (
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined
) => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
    return;
  }
  Reflect.deleteProperty(target, property);
};

describe("ephemeralComposerImage", () => {
  let readAsDataURL: (blob: Blob) => void;

  beforeEach(() => {
    readAsDataURL = vi.fn<(blob: Blob) => void>();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:ephemeral-composer-image"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: class MockFileReader {
        result: string | null = "data:image/png;base64,aaaa";
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        readAsDataURL(blob: Blob) {
          readAsDataURL(blob);
          this.onload?.();
        }
      },
    });
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: class MockImage {
        naturalWidth = 1600;
        naturalHeight = 1200;
        width = 1600;
        height = 1200;
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
      })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: vi.fn(() => `data:image/jpeg;base64,${"a".repeat(128)}`),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreDescriptor(URL, "createObjectURL", originalCreateObjectURLDescriptor);
    restoreDescriptor(URL, "revokeObjectURL", originalRevokeObjectURLDescriptor);
    restoreDescriptor(globalThis, "Image", originalImageDescriptor);
    restoreDescriptor(globalThis, "FileReader", originalFileReaderDescriptor);
    restoreDescriptor(
      HTMLCanvasElement.prototype,
      "getContext",
      originalCanvasGetContextDescriptor
    );
    restoreDescriptor(HTMLCanvasElement.prototype, "toDataURL", originalCanvasToDataURLDescriptor);
  });

  it("resizes local images from an object URL without base64-reading the source blob", async () => {
    const data = await createEphemeralComposerImageData(
      new Blob(["x".repeat(5 * 1024 * 1024)], { type: "image/png" })
    );

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(readAsDataURL).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:ephemeral-composer-image");
    expect(data.previewDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(data.modelDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(data.width).toBe(768);
    expect(data.height).toBe(576);
  });

  it("rejects oversized no-canvas fallback images before FileReader reads them", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: undefined,
    });

    await expect(
      createEphemeralComposerImageData(
        new Blob(["x".repeat(5 * 1024 * 1024)], { type: "image/png" })
      )
    ).rejects.toThrow(EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE);
    expect(readAsDataURL).not.toHaveBeenCalled();
  });
});
