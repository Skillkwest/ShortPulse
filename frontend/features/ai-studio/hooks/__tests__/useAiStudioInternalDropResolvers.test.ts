/**
 * Hook tests for AI Studio internal-drop resolver wiring.
 * Verifies page-level drop resolution stays stable while orchestration moves into a dedicated hook.
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import {
  resolveSavedMediaIdFromOutput,
  useAiStudioInternalDropResolvers,
} from "../useAiStudioInternalDropResolvers";

const { resolveMediaLibraryInternalDropResolverMock, resolveInternalReferenceSourceMock } =
  vi.hoisted(() => ({
    resolveMediaLibraryInternalDropResolverMock: vi.fn(),
    resolveInternalReferenceSourceMock: vi.fn(),
  }));

vi.mock("../../logic/mediaLibraryInternalDropResolver", () => ({
  resolveMediaLibraryInternalDropResolver: resolveMediaLibraryInternalDropResolverMock,
}));

vi.mock("../../logic/referenceSource/internalReferenceSource", () => ({
  resolveInternalReferenceSource: resolveInternalReferenceSourceMock,
}));

const makePayload = (
  overrides: Partial<InternalReferenceDragPayload> = {}
): InternalReferenceDragPayload => ({
  version: 1,
  origin: "ai-studio-reference-grid",
  referenceId: null,
  outputId: "out-1",
  imageIndex: 0,
  mediaId: null,
  referenceUrl: null,
  sourceSurface: "all-refs",
  ...overrides,
});

const makeOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id: "out-1",
    prompt: "User visible prompt",
    mode: "image",
    aspect: "1:1",
    model: "model",
    status: "ready",
    timestamp: "2026-01-01T00:00:00.000Z",
    previewUrl: "https://cdn.example.com/preview.png",
    resultUrls: ["https://cdn.example.com/result-0.png", "https://cdn.example.com/result-1.png"],
    savedMediaIds: ["media-0", "media-1"],
    ...overrides,
  }) as StudioOutput;

describe("useAiStudioInternalDropResolvers", () => {
  beforeEach(() => {
    resolveMediaLibraryInternalDropResolverMock.mockReset();
    resolveInternalReferenceSourceMock.mockReset();
  });

  it("resolves saved media ids by requested index with first-id fallback", () => {
    expect(resolveSavedMediaIdFromOutput(makeOutput(), 1)).toBe("media-1");
    expect(resolveSavedMediaIdFromOutput(makeOutput({ savedMediaIds: [" media-0 ", ""] }), 9)).toBe(
      "media-0"
    );
    expect(resolveSavedMediaIdFromOutput(makeOutput({ savedMediaIds: [] }), 0)).toBeNull();
  });

  it("resolves character drops from payload media ids or output saved media ids", async () => {
    const output = makeOutput();
    resolveInternalReferenceSourceMock
      .mockResolvedValueOnce({
        kind: "internal",
        sourceKind: "generated_output",
        sourceId: "payload-media",
        outputId: "out-1",
        mediaId: "payload-media",
        preview: {
          url: "https://cdn.example.com/payload-preview.png",
        },
        previewStoragePath: "user-1/generations/images/payload-preview.png",
        fullStoragePath: "user-1/generations/images/payload-full.png",
        promptText: "User visible prompt",
        provenance: {
          origin: "ai-studio-reference-grid",
          outputId: "out-1",
          mediaId: "payload-media",
          imageIndex: 0,
          sourceSurface: "all-refs",
          resolutionReason: "saved_media_lookup",
        },
        preparedImageUrl: "https://signed.example.com/payload-full.png",
        loadBlob: vi.fn(),
      })
      .mockResolvedValueOnce({
        kind: "internal",
        sourceKind: "generated_output",
        sourceId: "media-1",
        outputId: "out-1",
        mediaId: "media-1",
        preview: {
          url: "https://cdn.example.com/preview.png",
        },
        previewStoragePath: "user-1/generations/images/result-1-preview.png",
        fullStoragePath: "user-1/generations/images/result-1.png",
        promptText: "User visible prompt",
        provenance: {
          origin: "ai-studio-reference-grid",
          outputId: "out-1",
          mediaId: "media-1",
          imageIndex: 1,
          sourceSurface: "all-refs",
          resolutionReason: "output_storage_path",
        },
        preparedImageUrl: "https://signed.example.com/result-1.png",
        loadBlob: vi.fn(),
      })
      .mockResolvedValueOnce({
        kind: "internal",
        sourceKind: "generated_output",
        sourceId: "media-1",
        outputId: "out-1",
        mediaId: "media-1",
        preview: {
          url: "https://cdn.example.com/preview.png",
        },
        previewStoragePath: "user-1/generations/images/result-1-preview.png",
        fullStoragePath: "user-1/generations/images/result-1.png",
        promptText: "User visible prompt",
        provenance: {
          origin: "ai-studio-reference-grid",
          outputId: "out-1",
          mediaId: "media-1",
          imageIndex: 1,
          sourceSurface: "all-refs",
          resolutionReason: "output_storage_path",
        },
        preparedImageUrl: "https://signed.example.com/result-1.png",
        loadBlob: vi.fn(),
      });
    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: () => output,
        getOutputSnapshot: () => ({
          outputOrder: ["out-1"],
          archivedOutputOrder: [],
          outputById: { "out-1": output },
          archivedOutputById: {},
        }),
        ensureOutputPersisted: vi.fn(async () => ({
          ok: true,
          mediaFileIds: ["media-0", "media-1"],
          delivery: null,
          error: null,
        })),
        saveReferenceToLibrary: vi.fn(),
      })
    );

    await expect(
      result.current.resolveCharacterDropReference(
        makePayload({
          mediaId: "payload-media",
          referenceUrl: "https://payload.example.com/ref.png",
        })
      )
    ).resolves.toEqual(
      expect.objectContaining({
        mediaId: "payload-media",
        outputId: "out-1",
        imageIndex: 0,
        previewUrl: "https://signed.example.com/payload-full.png",
        storagePath: "user-1/generations/images/payload-full.png",
      })
    );

    await expect(
      result.current.resolveCharacterDropReference(makePayload({ imageIndex: 1 }))
    ).resolves.toEqual(
      expect.objectContaining({
        mediaId: "media-1",
        previewUrl: "https://signed.example.com/result-1.png",
        storagePath: "user-1/generations/images/result-1.png",
        sourceSurface: "all-refs",
      })
    );

    await expect(
      result.current.resolveElementProfileImageDropSource(makePayload({ imageIndex: 1 }))
    ).resolves.toEqual(
      expect.objectContaining({
        kind: "internal",
        mediaId: "media-1",
        fullStoragePath: "user-1/generations/images/result-1.png",
      })
    );
  });

  it("resolves canvas drops for text and image outputs", () => {
    const imageOutput = makeOutput();
    const textOutput = makeOutput({
      mode: "text",
      prompt: "  Prompt from output  ",
      previewText: "Fallback preview text",
      savedMediaIds: [],
    });
    const outputById: Record<string, StudioOutput> = {
      "out-image": imageOutput,
      "out-text": textOutput,
    };
    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: (outputId) => outputById[outputId] ?? null,
        getOutputSnapshot: () => ({
          outputOrder: Object.keys(outputById),
          archivedOutputOrder: [],
          outputById,
          archivedOutputById: {},
        }),
        ensureOutputPersisted: vi.fn(async () => ({
          ok: true,
          mediaFileIds: ["media-0", "media-1"],
          delivery: null,
          error: null,
        })),
        saveReferenceToLibrary: vi.fn(),
      })
    );

    expect(
      result.current.resolveCanvasDropReference(
        makePayload({ outputId: "out-text", imageIndex: 0, sourceSurface: "curated" })
      )
    ).toEqual({
      kind: "text",
      outputId: "out-text",
      text: "Prompt from output",
      sourceSurface: "curated",
    });

    expect(
      result.current.resolveCanvasDropReference(
        makePayload({ outputId: "out-image", imageIndex: 1, width: 640, height: 480 })
      )
    ).toEqual({
      kind: "image",
      outputId: "out-image",
      mediaId: "media-1",
      src: "https://cdn.example.com/result-1.png",
      alt: "User visible prompt",
      width: 640,
      height: 480,
      sourceSurface: "all-refs",
    });
  });

  it("delegates media-library and style internal-drop resolution with shared timeout policy", async () => {
    const output = makeOutput();
    resolveMediaLibraryInternalDropResolverMock.mockResolvedValue({ kind: "media", id: "media-1" });
    resolveInternalReferenceSourceMock.mockResolvedValue({
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-0",
      outputId: "out-1",
      mediaId: "media-0",
      preview: {
        url: "https://cdn.example.com/preview.png",
      },
      previewStoragePath: "user-1/generations/images/result-0.png",
      fullStoragePath: "user-1/generations/images/result-0.png",
      promptText: "User visible prompt",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-0",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path",
      },
      loadBlob: vi.fn(),
    });
    const ensureOutputPersisted = vi.fn(async () => ({
      ok: true,
      mediaFileIds: ["media-0", "media-1"],
      delivery: null,
      error: null,
    }));
    const saveReferenceToLibrary = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: () => output,
        getOutputSnapshot: () => ({
          outputOrder: ["out-1"],
          archivedOutputOrder: [],
          outputById: { "out-1": output },
          archivedOutputById: {},
        }),
        ensureOutputPersisted,
        saveReferenceToLibrary,
      })
    );

    await expect(
      result.current.resolveMediaLibraryInternalDropItem(makePayload())
    ).resolves.toEqual({
      kind: "media",
      id: "media-1",
    });
    await expect(result.current.resolveStyleLibraryInternalDrop(makePayload())).resolves.toEqual(
      expect.objectContaining({
        kind: "internal",
        sourceId: "media-0",
        previewStoragePath: "user-1/generations/images/result-0.png",
        promptText: "User visible prompt",
      })
    );

    expect(resolveMediaLibraryInternalDropResolverMock).toHaveBeenCalledWith(
      expect.objectContaining({
        getOutputById: expect.any(Function),
        getOutputSnapshot: expect.any(Function),
        saveReferenceToLibrary,
        persistTimeoutMs: 3500,
        pollIntervalMs: 120,
      })
    );
    expect(resolveInternalReferenceSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        getOutputById: expect.any(Function),
        getOutputSnapshot: expect.any(Function),
        ensureOutputPersisted,
      })
    );

    const mediaArgs = resolveMediaLibraryInternalDropResolverMock.mock.calls[0]?.[0];
    const styleArgs = resolveInternalReferenceSourceMock.mock.calls[0]?.[0];
    expect(mediaArgs.resolveSavedMediaIdFromOutput(output, 1)).toBe("media-1");
    expect(styleArgs.resolveSavedMediaIdFromOutput(output, 1)).toBe("media-1");
  });

  it("falls back to page output preview authority for element profile drops when shared resolution fails closed", async () => {
    const output = makeOutput({
      savedMediaIds: [],
      previewUrl: "https://cdn.example.com/preview-only.png",
      resultUrls: [],
      mediaSource: "generated",
    });
    resolveInternalReferenceSourceMock.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () => new Blob(["image"], { type: "image/png" }),
      }))
    );

    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: () => output,
        getOutputSnapshot: () => ({
          outputOrder: ["out-1"],
          archivedOutputOrder: [],
          outputById: { "out-1": output },
          archivedOutputById: {},
        }),
        ensureOutputPersisted: vi.fn(async () => ({
          ok: false,
          mediaFileIds: [],
          delivery: null,
          error: "missing",
        })),
        saveReferenceToLibrary: vi.fn(),
      })
    );

    const resolved = await result.current.resolveElementProfileImageDropSource(makePayload());
    expect(resolved).toEqual(
      expect.objectContaining({
        kind: "internal",
        outputId: "out-1",
        preview: { url: "https://cdn.example.com/preview-only.png" },
      })
    );
    await expect(resolved?.loadBlob()).resolves.toBeInstanceOf(Blob);
    vi.unstubAllGlobals();
  });

  it("does not promote unresolved generated character drops from payload URLs alone", async () => {
    const output = makeOutput();
    resolveInternalReferenceSourceMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: () => output,
        getOutputSnapshot: () => ({
          outputOrder: ["out-1"],
          archivedOutputOrder: [],
          outputById: { "out-1": output },
          archivedOutputById: {},
        }),
        ensureOutputPersisted: vi.fn(async () => ({
          ok: true,
          mediaFileIds: ["media-0", "media-1"],
          delivery: null,
          error: null,
        })),
        saveReferenceToLibrary: vi.fn(),
      })
    );

    await expect(
      result.current.resolveCharacterDropReference(
        makePayload({
          mediaId: null,
          referenceUrl: "https://payload.example.com/generated-only.png",
        })
      )
    ).resolves.toEqual(
      expect.objectContaining({
        mediaId: "",
        outputId: "out-1",
        imageIndex: 0,
        previewUrl: null,
      })
    );
  });

  it("drops invalid source-surface strings from resolved provenance", async () => {
    const output = makeOutput();
    resolveInternalReferenceSourceMock.mockResolvedValueOnce({
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-1",
      outputId: "out-1",
      mediaId: "media-1",
      preview: {
        url: "https://cdn.example.com/preview.png",
      },
      previewStoragePath: "user-1/generations/images/result-1-preview.png",
      fullStoragePath: "user-1/generations/images/result-1.png",
      promptText: "User visible prompt",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-1",
        imageIndex: 1,
        sourceSurface: "stale-surface",
        resolutionReason: "output_storage_path",
      },
      preparedImageUrl: "https://signed.example.com/result-1.png",
      loadBlob: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: () => output,
        getOutputSnapshot: () => ({
          outputOrder: ["out-1"],
          archivedOutputOrder: [],
          outputById: { "out-1": output },
          archivedOutputById: {},
        }),
        ensureOutputPersisted: vi.fn(async () => ({
          ok: true,
          mediaFileIds: ["media-0", "media-1"],
          delivery: null,
          error: null,
        })),
        saveReferenceToLibrary: vi.fn(),
      })
    );

    await expect(
      result.current.resolveCharacterDropReference(makePayload({ imageIndex: 1 }))
    ).resolves.toEqual(
      expect.objectContaining({
        mediaId: "media-1",
        sourceSurface: null,
      })
    );
  });
});
