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

const { resolveMediaLibraryInternalDropResolverMock, resolveStyleInternalDropCandidatesMock } =
  vi.hoisted(() => ({
    resolveMediaLibraryInternalDropResolverMock: vi.fn(),
    resolveStyleInternalDropCandidatesMock: vi.fn(),
  }));

vi.mock("../../logic/mediaLibraryInternalDropResolver", () => ({
  resolveMediaLibraryInternalDropResolver: resolveMediaLibraryInternalDropResolverMock,
}));

vi.mock("../../components/style-creator/internalDropResolver", () => ({
  resolveStyleInternalDropCandidates: resolveStyleInternalDropCandidatesMock,
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
    resolveStyleInternalDropCandidatesMock.mockReset();
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
    const { result } = renderHook(() =>
      useAiStudioInternalDropResolvers({
        getOutputById: () => output,
        getOutputSnapshot: () => ({
          outputOrder: ["out-1"],
          archivedOutputOrder: [],
          outputById: { "out-1": output },
          archivedOutputById: {},
        }),
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
      })
    );

    await expect(
      result.current.resolveCharacterDropReference(makePayload({ imageIndex: 1 }))
    ).resolves.toEqual(
      expect.objectContaining({
        mediaId: "media-1",
        previewUrl: "https://cdn.example.com/preview.png",
        sourceSurface: "all-refs",
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
    resolveStyleInternalDropCandidatesMock.mockResolvedValue({
      imageUrlCandidates: ["https://cdn.example.com/result-0.png"],
      promptText: "User visible prompt",
    });
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
        saveReferenceToLibrary,
      })
    );

    await expect(
      result.current.resolveMediaLibraryInternalDropItem(makePayload())
    ).resolves.toEqual({
      kind: "media",
      id: "media-1",
    });
    await expect(result.current.resolveStyleLibraryInternalDrop(makePayload())).resolves.toEqual({
      imageUrlCandidates: ["https://cdn.example.com/result-0.png"],
      promptText: "User visible prompt",
    });

    expect(resolveMediaLibraryInternalDropResolverMock).toHaveBeenCalledWith(
      expect.objectContaining({
        getOutputById: expect.any(Function),
        getOutputSnapshot: expect.any(Function),
        saveReferenceToLibrary,
        persistTimeoutMs: 3500,
        pollIntervalMs: 120,
      })
    );
    expect(resolveStyleInternalDropCandidatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        getOutputById: expect.any(Function),
        getOutputSnapshot: expect.any(Function),
        saveReferenceToLibrary,
        persistTimeoutMs: 3500,
        pollIntervalMs: 120,
      })
    );

    const mediaArgs = resolveMediaLibraryInternalDropResolverMock.mock.calls[0]?.[0];
    const styleArgs = resolveStyleInternalDropCandidatesMock.mock.calls[0]?.[0];
    expect(mediaArgs.resolveSavedMediaIdFromOutput(output, 1)).toBe("media-1");
    expect(styleArgs.resolveSavedMediaIdFromOutput(output, 1)).toBe("media-1");
  });
});
