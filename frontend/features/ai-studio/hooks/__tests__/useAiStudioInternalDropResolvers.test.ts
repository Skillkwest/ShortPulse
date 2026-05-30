/**
 * Hook tests for AI Studio internal-drop resolver wiring.
 * Verifies page-level drop resolution stays stable while orchestration moves into a dedicated hook.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import {
  resolveSavedMediaIdFromOutput,
  useAiStudioInternalDropResolvers,
} from "../useAiStudioInternalDropResolvers";

const { resolveInternalReferenceSourceMock } = vi.hoisted(() => ({
  resolveInternalReferenceSourceMock: vi.fn(),
}));
const { resolveAgentAttachmentPreviewUrlMock } = vi.hoisted(() => ({
  resolveAgentAttachmentPreviewUrlMock: vi.fn(),
}));

vi.mock("../../logic/referenceSource/internalReferenceSource", () => ({
  resolveInternalReferenceSource: resolveInternalReferenceSourceMock,
}));
vi.mock("../../logic/agentAttachmentImage", () => ({
  resolveAgentAttachmentPreviewUrl: resolveAgentAttachmentPreviewUrlMock,
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
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    resolveInternalReferenceSourceMock.mockReset();
    resolveAgentAttachmentPreviewUrlMock.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => `blob:${blob.size}`),
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
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

  it("uses the shared awaited internal-drop resolution for media-library image drops", async () => {
    const output = makeOutput();
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
      preparedImageUrl: "https://signed.example.com/result-0.png",
      loadBlob: vi.fn(async () => new Blob(["img0"])),
    });
    resolveAgentAttachmentPreviewUrlMock.mockResolvedValue(
      "https://signed.example.com/result-0.png"
    );
    const ensureOutputPersisted = vi.fn(async () => ({
      ok: true,
      mediaFileIds: ["media-0", "media-1"],
      delivery: null,
      error: null,
    }));

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
      })
    );

    await expect(
      result.current.resolveMediaLibraryInternalDropItem(makePayload())
    ).resolves.toEqual({
      kind: "media",
      id: "media-0",
    });
    await expect(result.current.resolveStyleLibraryInternalDrop(makePayload())).resolves.toEqual(
      expect.objectContaining({
        kind: "internal",
        sourceId: "media-0",
        previewStoragePath: "user-1/generations/images/result-0.png",
        promptText: "User visible prompt",
      })
    );
    await expect(
      result.current.resolveComposerInternalImageDropSource(makePayload())
    ).resolves.toEqual(
      expect.objectContaining({
        kind: "internal",
        sourceId: "media-0",
        previewStoragePath: "user-1/generations/images/result-0.png",
        promptText: "User visible prompt",
        preparedImageUrl: "https://signed.example.com/result-0.png",
        preview: expect.objectContaining({
          url: "https://signed.example.com/result-0.png",
        }),
      })
    );

    expect(resolveInternalReferenceSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: makePayload(),
        getOutputById: expect.any(Function),
        getOutputSnapshot: expect.any(Function),
        ensureOutputPersisted,
      })
    );

    const mediaArgs = resolveInternalReferenceSourceMock.mock.calls[0]?.[0];
    const styleArgs = resolveInternalReferenceSourceMock.mock.calls[1]?.[0];
    expect(mediaArgs.resolveSavedMediaIdFromOutput(output, 1)).toBe("media-1");
    expect(styleArgs.resolveSavedMediaIdFromOutput(output, 1)).toBe("media-1");
  });

  it("fails closed for composer image drops when only weak preview authority survives", async () => {
    const output = makeOutput({
      mediaSource: "generated",
      previewUrl: "https://cdn.example.com/weak-preview.png",
      savedMediaIds: [],
    });
    resolveInternalReferenceSourceMock.mockResolvedValue({
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "out-1",
      outputId: "out-1",
      mediaId: null,
      preview: {
        url: "https://cdn.example.com/weak-preview.png",
      },
      previewStoragePath: null,
      fullStoragePath: null,
      promptText: "User visible prompt",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: null,
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "payload_render_url",
      },
      preparedImageUrl: null,
      loadBlob: vi.fn(async () => {
        throw new Error("download failed");
      }),
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
          mediaFileIds: [],
          delivery: null,
          error: null,
        })),
      })
    );

    await expect(
      result.current.resolveComposerInternalImageDropSource(makePayload())
    ).resolves.toBeNull();
  });

  it("fails closed for composer image drops when a video reference is dragged into an image-only slot", async () => {
    const output = makeOutput({
      mode: "video",
      previewUrl: "https://cdn.example.com/video-preview.mp4",
      previewPosterUrl: "https://cdn.example.com/video-poster.jpg",
      previewPosterStoragePath: "user-1/variants/videos/out-1/poster_720.jpg",
      previewStoragePath: "user-1/generations/videos/out-1.mp4",
      fullStoragePath: "user-1/generations/videos/out-1.mp4",
      resultUrls: ["https://cdn.example.com/video-full.mp4"],
      savedMediaIds: ["media-video-1"],
    });
    resolveInternalReferenceSourceMock.mockResolvedValue({
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-video-1",
      outputId: "out-1",
      mediaId: "media-video-1",
      mediaSource: "generated",
      preview: {
        url: "https://cdn.example.com/fallback-video-poster.jpg",
      },
      previewStoragePath: "user-1/generations/videos/out-1.mp4",
      fullStoragePath: "user-1/generations/videos/out-1.mp4",
      promptText: "User visible prompt",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-video-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path",
      },
      preparedImageUrl: "https://signed.example.com/video-full.mp4",
      loadBlob: vi.fn(async () => new Blob(["video"])),
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
          mediaFileIds: ["media-video-1"],
          delivery: null,
          error: null,
        })),
      })
    );

    await expect(
      result.current.resolveComposerInternalImageDropSource(makePayload({ mediaKind: "video" }))
    ).resolves.toBeNull();
  });

  it("awaits prompt persistence for media-library text drops before returning prompt ids", async () => {
    const outputsById = new Map<string, StudioOutput>([
      [
        "out-1",
        {
          ...makeOutput({
            mode: "text",
            previewUrl: undefined,
            resultUrls: [],
            savedMediaIds: [],
            previewText: "Prompt only",
            promptId: undefined,
          }),
        },
      ],
    ]);
    const ensureOutputPersisted = vi.fn(async () => {
      outputsById.set("out-1", {
        ...outputsById.get("out-1")!,
        promptId: "prompt-1",
      } as StudioOutput);
      return {
        ok: true,
        mediaFileIds: [],
        delivery: null,
        error: null,
      };
    });

    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: (outputId) => outputsById.get(outputId) ?? null,
        getOutputSnapshot: () => ({
          outputOrder: ["out-1"],
          archivedOutputOrder: [],
          outputById: { "out-1": outputsById.get("out-1") },
          archivedOutputById: {},
        }),
        ensureOutputPersisted,
      })
    );

    await expect(
      result.current.resolveMediaLibraryInternalDropItem(makePayload())
    ).resolves.toEqual({
      kind: "prompt",
      id: "prompt-1",
    });
    expect(ensureOutputPersisted).toHaveBeenCalledWith("out-1");
    expect(resolveInternalReferenceSourceMock).not.toHaveBeenCalled();
  });

  it("uses the persisted prompt id returned by save when output state has not re-rendered yet", async () => {
    const output = makeOutput({
      mode: "text",
      previewUrl: undefined,
      resultUrls: [],
      savedMediaIds: [],
      previewText: "Prompt only",
      promptId: undefined,
    });
    const ensureOutputPersisted = vi.fn(async () => ({
      ok: true,
      mediaFileIds: [],
      promptId: "prompt-77",
      delivery: null,
      error: null,
    }));

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
      })
    );

    await expect(
      result.current.resolveMediaLibraryInternalDropItem(makePayload())
    ).resolves.toEqual({
      kind: "prompt",
      id: "prompt-77",
    });
    expect(ensureOutputPersisted).toHaveBeenCalledWith("out-1");
    expect(resolveInternalReferenceSourceMock).not.toHaveBeenCalled();
  });

  it("falls back to page output preview authority only for non-generated element profile drops", async () => {
    const output = makeOutput({
      savedMediaIds: [],
      previewUrl: "https://cdn.example.com/preview-only.png",
      resultUrls: [],
      mediaSource: "library",
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

  it("fails closed for generated element profile drops when shared resolution cannot recover durable identity", async () => {
    const output = makeOutput({
      savedMediaIds: [],
      previewUrl: "https://cdn.example.com/generated-preview-only.png",
      resultUrls: [],
      mediaSource: "generated",
      localObjectUrl: undefined,
    });
    resolveInternalReferenceSourceMock.mockResolvedValue(null);

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
      })
    );

    await expect(
      result.current.resolveElementProfileImageDropSource(makePayload())
    ).resolves.toBeNull();
  });

  it("opts character resolution into trusted preview fallback without requiring persistence recovery", async () => {
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
    expect(resolveInternalReferenceSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowPersistenceRecovery: true,
        allowTrustedPreviewFallback: true,
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
