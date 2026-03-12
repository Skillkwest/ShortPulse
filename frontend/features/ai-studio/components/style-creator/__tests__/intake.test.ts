/**
 * Unit tests for styles-library intake preprocessing and fallback prompt sanitization.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../../lib/authenticatedFetch";
import {
  canAcceptStyleLibraryImageDropHint,
  clampStylePromptCharacters,
  normalizeStylePromptFallbackText,
  preprocessStyleImageDataUrl,
  resolveDroppedStylePreview,
  resizeImageDataUrlForExtraction,
} from "../intake";

vi.mock("../../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

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

  it("retries same-origin URL drops with authenticated fetch when the first fetch is denied", async () => {
    installImageAndCanvasMocks({
      width: 1600,
      height: 1200,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const droppedUrl = new URL(
      "/api/private/reference-image.jpg",
      window.location.origin
    ).toString();
    const transfer = {
      files: [],
      types: ["text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-url") return droppedUrl;
        if (type === "text/plain") return droppedUrl;
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      blob: async () => new Blob([]),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["mock-image-bytes"], { type: "image/png" }),
    } as unknown as Response);

    try {
      const resolved = await resolveDroppedStylePreview(transfer);
      expect(resolved.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
      expect(resolved.extractionSourceImageUrl).toBe("data:image/jpeg;base64,1024x768");
      expect(fetchMock).toHaveBeenCalledWith(droppedUrl, { credentials: "include" });
      expect(fetchWithAuth).toHaveBeenCalledWith(
        droppedUrl,
        expect.objectContaining({
          method: "GET",
          shortpulseLogScope: "generation",
          shortpulseSkipErrorLogging: true,
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses rendered transfer URL as fallback when primary drag payload URL is not image content", async () => {
    installImageAndCanvasMocks({
      width: 1600,
      height: 1200,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const transfer = {
      files: [],
      types: ["text/reference-render-url", "text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-render-url") {
          return "https://cdn.example.com/rendered-image.png";
        }
        if (type === "text/reference-url") {
          return "https://cdn.example.com/non-image-endpoint";
        }
        if (type === "text/plain") return "cinematic prompt";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://cdn.example.com/rendered-image.png") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "image/png" },
          blob: async () => new Blob(["mock-image-bytes"], { type: "image/png" }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        blob: async () => new Blob(["<html>nope</html>"], { type: "text/html" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const resolved = await resolveDroppedStylePreview(transfer);
      expect(resolved.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
      expect(resolved.extractionSourceImageUrl).toBe("data:image/jpeg;base64,1024x768");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(1, "https://cdn.example.com/non-image-endpoint");
      expect(fetchMock).toHaveBeenNthCalledWith(2, "https://cdn.example.com/rendered-image.png");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses rendered data-url transfer candidates without network fetch", async () => {
    installImageAndCanvasMocks({
      width: 1200,
      height: 900,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const transfer = {
      files: [],
      types: ["text/reference-render-url", "text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-render-url") {
          return "data:image/jpeg;base64,drag-snapshot";
        }
        if (type === "text/reference-url") {
          return "https://cdn.example.com/would-fail-later.png";
        }
        if (type === "text/plain") return "cinematic prompt";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const resolved = await resolveDroppedStylePreview(transfer);
      expect(resolved.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
      expect(resolved.extractionSourceImageUrl).toBe("data:image/jpeg;base64,1024x768");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.com/would-fail-later.png");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("prefers resolved internal-drop candidates ahead of stale transfer URLs", async () => {
    installImageAndCanvasMocks({
      width: 1200,
      height: 900,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const transfer = {
      files: [],
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-url",
        "text/plain",
      ],
      getData: (type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-output-id") return "out-123";
        if (type === "text/reference-url") return "https://cdn.example.com/stale-reference.png";
        if (type === "text/plain") return "portrait prompt";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const resolved = await resolveDroppedStylePreview(transfer, {
        resolveInternalStyleDrop: async () => ({
          imageUrlCandidates: ["data:image/jpeg;base64,internal-drop-snapshot"],
          promptText: "internal prompt",
        }),
      });
      expect(resolved.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
      expect(resolved.extractionSourceImageUrl).toBe("data:image/jpeg;base64,1024x768");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps stale dropped reference URLs to the expired-source error code", async () => {
    const transfer = {
      files: [],
      types: ["text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-url") {
          return "https://cdn.example.com/expired-reference.png";
        }
        if (type === "text/plain") return "expired reference";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      blob: async () => new Blob([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(resolveDroppedStylePreview(transfer)).rejects.toThrow(
        "expired-style-image-source"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps 400 dropped-image download failures to the expired-source error code", async () => {
    const transfer = {
      files: [],
      types: ["text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-url") {
          return "https://cdn.example.com/next-image-wrapper.png";
        }
        if (type === "text/plain") return "next image wrapper";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      blob: async () => new Blob([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(resolveDroppedStylePreview(transfer)).rejects.toThrow(
        "expired-style-image-source"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps 5xx dropped-image download failures to blocked-source error code", async () => {
    const transfer = {
      files: [],
      types: ["text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-url") {
          return "https://cdn.example.com/provider-transient.png";
        }
        if (type === "text/plain") return "provider transient";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      blob: async () => new Blob([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(resolveDroppedStylePreview(transfer)).rejects.toThrow(
        "blocked-style-image-source"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps unreadable dropped-image blobs to blocked-source error code", async () => {
    const transfer = {
      files: [],
      types: ["text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-url") {
          return "https://cdn.example.com/unreadable-image.png";
        }
        if (type === "text/plain") return "unreadable image";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "image/png" },
      blob: async () => new Blob([], { type: "image/png" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(resolveDroppedStylePreview(transfer)).rejects.toThrow(
        "blocked-style-image-source"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("style-creator drop hint acceptance", () => {
  it("accepts internal reference output-id and media-id transfer hints", () => {
    const transfer = {
      types: ["text/reference-output-id", "text/reference-media-id"],
      getData: () => "",
    } as unknown as DataTransfer;
    expect(canAcceptStyleLibraryImageDropHint(transfer)).toBe(true);
  });

  it("rejects style-library reorder transfers", () => {
    const transfer = {
      types: ["text/style-library-id", "text/reference-output-id"],
      getData: () => "",
    } as unknown as DataTransfer;
    expect(canAcceptStyleLibraryImageDropHint(transfer)).toBe(false);
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
