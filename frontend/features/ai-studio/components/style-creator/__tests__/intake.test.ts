/**
 * Unit tests for the rebuilt Styles source-prep boundary.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearComposerImageDropSession,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  registerComposerImageDropSession,
} from "../../../../../lib/internalReferenceDragSession";
import {
  captureStyleDropSnapshot,
  canAcceptStyleLibraryImageDropHint,
  clampStylePromptCharacters,
  normalizeStylePromptFallbackText,
  preprocessStyleImageDataUrl,
  resolveDroppedStylePreview,
  resolveStyleSource,
  resizeImageDataUrlForExtraction,
} from "../intake";
import type { ResolveInternalStyleDrop, ResolvedInternalStyleSource } from "../styleSourceResolver";

const originalImage = globalThis.Image;
const originalFileReader = globalThis.FileReader;
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

describe("style-creator derivation helpers", () => {
  it("caps extraction resize longest dimension at 1024 while preserving aspect ratio", async () => {
    const { drawImage } = installImageAndCanvasMocks({
      width: 2400,
      height: 1200,
      toDataUrl: () => "data:image/jpeg;base64,resized",
    });
    const resized = await resizeImageDataUrlForExtraction("data:image/png;base64,source");

    expect(resized).toBe("data:image/jpeg;base64,resized");
    const drawArgs = drawImage.mock.calls[0] ?? [];
    expect(drawArgs[7]).toBe(1024);
    expect(drawArgs[8]).toBe(512);
  });

  it("preprocesses preview as 512 square and extraction as aspect-preserving bounded output", async () => {
    installImageAndCanvasMocks({
      width: 1600,
      height: 1200,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const processed = await preprocessStyleImageDataUrl("data:image/png;base64,source");

    expect(processed.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
    expect(processed.extractionSourceImageUrl).toBe("data:image/jpeg;base64,1024x768");
  });
});

describe("style-creator source normalization", () => {
  it("resolves local file intake through the unified source boundary", async () => {
    installFileReaderMock("data:image/png;base64,from-file");

    const file = new File(["mock-image-bytes"], "style.png", { type: "image/png" });
    const resolved = await resolveStyleSource({ file });

    expect(resolved).toEqual({
      kind: "file",
      sourceImageDataUrl: "data:image/png;base64,from-file",
      promptText: "",
      internalPayloadPresent: false,
      resolutionReason: null,
      resolutionStage: "primary",
      candidateCount: 0,
    });
  });

  it("resolves dropped data-url transfers without network fetch", async () => {
    const transfer = {
      files: [],
      types: ["text/reference-url", "text/plain"],
      getData: (type: string) => {
        if (type === "text/reference-url") return "data:image/png;base64,from-transfer";
        if (type === "text/plain") return "cinematic dog portrait";
        return "";
      },
    } as unknown as DataTransfer;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const resolved = await resolveStyleSource({ transfer });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolved).toEqual({
      kind: "external",
      sourceImageDataUrl: "data:image/png;base64,from-transfer",
      promptText: "cinematic dog portrait",
      internalPayloadPresent: false,
      resolutionReason: null,
      resolutionStage: "primary",
      candidateCount: 1,
    });
  });

  it("resolves internal drops via one authoritative source descriptor", async () => {
    installFileReaderMock("data:image/png;base64,from-internal");
    const transfer = {
      files: [],
      types: ["text/reference-output-id", "text/reference-origin"],
      getData: (type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-output-id") return "out-1";
        return "";
      },
    } as unknown as DataTransfer;
    const resolvedInternal: ResolvedInternalStyleSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "saved_media_lookup",
      },
      outputId: "out-1",
      mediaId: "media-1",
      mediaSource: "generated",
      preview: {
        url: "https://cdn.example.com/stale-reference.png",
        width: 1024,
        height: 768,
      },
      previewStoragePath: "user-1/generations/images/out-1.png",
      fullStoragePath: "user-1/generations/images/out-1.png",
      promptText: "golden hour portrait",
      loadBlob: async () => new Blob(["internal-bytes"], { type: "image/png" }),
    };
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => resolvedInternal);

    const resolved = await resolveStyleSource({
      transfer,
      resolveInternalStyleDrop: resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual({
      kind: "internal",
      sourceImageDataUrl: "data:image/png;base64,from-internal",
      promptText: "golden hour portrait",
      internalPayloadPresent: true,
      resolutionReason: "saved_media_lookup",
      resolutionStage: "primary",
      candidateCount: 1,
    });
  });

  it("preserves legacy internal reference ids through captured style-drop snapshots", async () => {
    installFileReaderMock("data:image/png;base64,from-legacy-internal");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const transfer = {
      files: [],
      types: [
        "text/reference-id",
        "text/reference-source-surface",
        "text/reference-url",
        "text/plain",
      ],
      getData: (type: string) => {
        if (type === "text/reference-id") return "legacy-out-1";
        if (type === "text/reference-source-surface") return "all-refs";
        if (type === "text/reference-url") return "https://cdn.example.com/stale-reference.png";
        if (type === "text/plain") return "legacy prompt";
        return "";
      },
    } as unknown as DataTransfer;
    const resolvedInternal: ResolvedInternalStyleSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "legacy-out-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "legacy-out-1",
        mediaId: null,
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "payload_reference_url",
      },
      outputId: "legacy-out-1",
      mediaId: null,
      mediaSource: "generated",
      preview: {
        url: "https://cdn.example.com/stale-reference.png",
        width: 1024,
        height: 768,
      },
      previewStoragePath: null,
      fullStoragePath: null,
      promptText: "legacy internal prompt",
      loadBlob: async () => new Blob(["legacy-internal-bytes"], { type: "image/png" }),
    };
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => resolvedInternal);

    const resolved = await resolveStyleSource({
      dropSnapshot: captureStyleDropSnapshot(transfer),
      resolveInternalStyleDrop: resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: "legacy-out-1",
        outputId: "legacy-out-1",
        sourceSurface: "all-refs",
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolved).toEqual({
      kind: "internal",
      sourceImageDataUrl: "data:image/png;base64,from-legacy-internal",
      promptText: "legacy prompt",
      internalPayloadPresent: true,
      resolutionReason: "payload_reference_url",
      resolutionStage: "primary",
      candidateCount: 1,
    });
  });

  it("preserves storage-path hints through captured style-drop snapshots", async () => {
    installFileReaderMock("data:image/png;base64,from-storage-path-internal");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const transfer = {
      files: [],
      types: [
        "text/reference-output-id",
        "text/reference-media-id",
        "text/reference-preview-storage-path",
        "text/reference-full-storage-path",
      ],
      getData: (type: string) => {
        if (type === "text/reference-output-id") return "out-storage-1";
        if (type === "text/reference-media-id") return "media-storage-1";
        if (type === "text/reference-preview-storage-path") return "user-1/generated/preview.png";
        if (type === "text/reference-full-storage-path") return "user-1/generated/full.png";
        return "";
      },
    } as unknown as DataTransfer;
    const resolvedInternal: ResolvedInternalStyleSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-storage-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-storage-1",
        mediaId: "media-storage-1",
        imageIndex: 0,
        sourceSurface: null,
        resolutionReason: "output_storage_path",
      },
      outputId: "out-storage-1",
      mediaId: "media-storage-1",
      mediaSource: "generated",
      preview: {
        url: "https://cdn.example.com/out-storage-preview.png",
      },
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      promptText: "storage path prompt",
      loadBlob: async () => new Blob(["storage-path-bytes"], { type: "image/png" }),
    };
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => resolvedInternal);

    const resolved = await resolveStyleSource({
      dropSnapshot: captureStyleDropSnapshot(transfer),
      resolveInternalStyleDrop: resolver,
    });

    expect(resolver).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "out-storage-1",
        mediaId: "media-storage-1",
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolved.kind).toBe("internal");
  });

  it("recovers composer-image payload authority through captured style-drop snapshots", async () => {
    installFileReaderMock("data:image/png;base64,from-composer-payload");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const token = registerComposerImageDropSession({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "composer-ref-1",
      outputId: "composer-out-1",
      mediaId: "composer-media-1",
      displayArtifactUrl: "data:image/png;base64,composer-artifact",
      displayArtifactKind: "data",
      previewStoragePath: "user-1/generated/composer-preview.png",
      fullStoragePath: "user-1/generated/composer-full.png",
      referenceUrl: "https://cdn.example.com/composer-reference.png",
      promptText: "composer prompt",
      sourceSurface: "all-refs",
      width: 1024,
      height: 768,
      mimeType: "image/png",
    });
    const transfer = {
      files: [],
      types: [COMPOSER_IMAGE_DROP_SESSION_TYPE],
      getData: (type: string) => (type === COMPOSER_IMAGE_DROP_SESSION_TYPE ? token : ""),
    } as unknown as DataTransfer;
    const resolvedInternal: ResolvedInternalStyleSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "composer-media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "composer-out-1",
        mediaId: "composer-media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path",
      },
      outputId: "composer-out-1",
      mediaId: "composer-media-1",
      mediaSource: "generated",
      preview: {
        url: "data:image/png;base64,composer-artifact",
        width: 1024,
        height: 768,
      },
      previewStoragePath: "user-1/generated/composer-preview.png",
      fullStoragePath: "user-1/generated/composer-full.png",
      promptText: "internal composer prompt",
      loadBlob: async () => new Blob(["composer-bytes"], { type: "image/png" }),
    };
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => resolvedInternal);

    try {
      const resolved = await resolveStyleSource({
        dropSnapshot: captureStyleDropSnapshot(transfer),
        resolveInternalStyleDrop: resolver,
      });

      expect(resolver).toHaveBeenCalledWith(
        expect.objectContaining({
          outputId: "composer-out-1",
          mediaId: "composer-media-1",
          previewStoragePath: "user-1/generated/composer-preview.png",
          fullStoragePath: "user-1/generated/composer-full.png",
          referenceRenderUrl: "data:image/png;base64,composer-artifact",
          referenceUrl: "https://cdn.example.com/composer-reference.png",
        })
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(resolved).toEqual(
        expect.objectContaining({
          kind: "internal",
          promptText: "composer prompt",
          internalPayloadPresent: true,
        })
      );
    } finally {
      clearComposerImageDropSession(token);
    }
  });

  it("resolves dropped preview artifacts from internal sources", async () => {
    installFileReaderMock("data:image/png;base64,from-internal");
    installImageAndCanvasMocks({
      width: 1600,
      height: 1200,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const transfer = {
      files: [],
      types: ["text/reference-output-id", "text/reference-origin"],
      getData: (type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-output-id") return "out-1";
        return "";
      },
    } as unknown as DataTransfer;
    const resolvedInternal: ResolvedInternalStyleSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path",
      },
      outputId: "out-1",
      mediaId: "media-1",
      mediaSource: "generated",
      preview: {
        url: "https://cdn.example.com/stale-reference.png",
        width: 1600,
        height: 1200,
      },
      previewStoragePath: "user-1/generations/images/out-1.png",
      fullStoragePath: "user-1/generations/images/out-1.png",
      promptText: "golden hour portrait",
      loadBlob: async () => new Blob(["internal-bytes"], { type: "image/png" }),
    };
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => resolvedInternal);

    const resolved = await resolveDroppedStylePreview(transfer, {
      resolveInternalStyleDrop: resolver,
    });

    expect(resolved.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
    expect(resolved.extractionSourceImageUrl).toBe("data:image/jpeg;base64,1024x768");
    expect(resolved.promptText).toBe("golden hour portrait");
  });

  it("falls back to dropped snapshot URLs when an internal drag is present but the shared resolver cannot resolve authority", async () => {
    installFileReaderMock("data:image/png;base64,from-fallback-url");
    installImageAndCanvasMocks({
      width: 1600,
      height: 1200,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["fallback-url-bytes"], { type: "image/png" }),
    } as Response);
    const transfer = {
      files: [],
      types: ["text/reference-output-id", "text/reference-origin", "text/reference-url"],
      getData: (type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-output-id") return "out-missing";
        if (type === "text/reference-url") return "https://cdn.example.com/stale-reference.png";
        return "";
      },
    } as unknown as DataTransfer;
    const resolver: ResolveInternalStyleDrop = vi.fn(async () => null);

    const resolved = await resolveDroppedStylePreview(transfer, {
      resolveInternalStyleDrop: resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual({
      previewImageUrl: "data:image/jpeg;base64,512x512",
      extractionSourceImageUrl: "data:image/jpeg;base64,1024x768",
      promptText: "",
    });
  });

  it("falls back to dropped snapshot URLs when an internal drag is present but no shared resolver was provided", async () => {
    installFileReaderMock("data:image/png;base64,from-fallback-url");
    installImageAndCanvasMocks({
      width: 1600,
      height: 1200,
      toDataUrl: (canvas) => `data:image/jpeg;base64,${canvas.width}x${canvas.height}`,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["fallback-url-bytes"], { type: "image/png" }),
    } as Response);
    const transfer = {
      files: [],
      types: ["text/reference-output-id", "text/reference-origin", "text/reference-url"],
      getData: (type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-output-id") return "out-missing";
        if (type === "text/reference-url") return "https://cdn.example.com/stale-reference.png";
        return "";
      },
    } as unknown as DataTransfer;

    const resolved = await resolveDroppedStylePreview(transfer);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual({
      previewImageUrl: "data:image/jpeg;base64,512x512",
      extractionSourceImageUrl: "data:image/jpeg;base64,1024x768",
      promptText: "",
    });
  });

  it("fails deterministically for unsupported sources", async () => {
    const transfer = {
      files: [],
      types: ["text/plain"],
      getData: (type: string) => (type === "text/plain" ? "just text" : ""),
    } as unknown as DataTransfer;

    await expect(resolveDroppedStylePreview(transfer)).rejects.toThrow(
      "missing-dropped-style-image"
    );
  });
});

describe("style-creator prompt sanitization and drop acceptance", () => {
  it("accepts internal reference transfer hints", () => {
    const transfer = {
      types: ["text/reference-output-id", "text/reference-origin"],
    } as unknown as DataTransfer;
    expect(canAcceptStyleLibraryImageDropHint(transfer)).toBe(true);
  });

  it("accepts normalized custom session token types for internal drops", () => {
    const transfer = {
      types: ["APPLICATION/X-SHORTPULSE-COMPOSER-IMAGE-DROP-TOKEN"],
    } as unknown as DataTransfer;
    expect(canAcceptStyleLibraryImageDropHint(transfer)).toBe(true);
  });

  it("accepts uppercase file transfer hints after normalization", () => {
    const transfer = {
      types: ["FILES"],
    } as unknown as DataTransfer;
    expect(canAcceptStyleLibraryImageDropHint(transfer)).toBe(true);
  });

  it("rejects style-library reorder transfers", () => {
    const transfer = {
      types: ["text/style-library-id"],
    } as unknown as DataTransfer;
    expect(canAcceptStyleLibraryImageDropHint(transfer)).toBe(false);
  });

  it("drops filename-like and file-url payloads", () => {
    expect(normalizeStylePromptFallbackText("IMG_0012.JPG")).toBe("");
    expect(normalizeStylePromptFallbackText("file:///Users/me/image.png")).toBe("");
  });

  it("keeps descriptive prompt text and clamps to budget", () => {
    expect(normalizeStylePromptFallbackText("cinematic dog portrait")).toBe(
      "cinematic dog portrait"
    );
    expect(normalizeStylePromptFallbackText("a".repeat(1100)).length).toBe(1000);
    expect(clampStylePromptCharacters("b".repeat(1100)).length).toBe(1000);
  });
});
