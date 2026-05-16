import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DragEvent } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioAgentComposer } from "../useAiStudioAgentComposer";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import {
  extractComposerImageDropPayload,
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
} from "../../utils/dragDrop";
import type { ResolvedInternalReferenceSource } from "../../logic/referenceSource/internalReferenceSource";

vi.mock("../../utils/dragDrop", async () => {
  const actual =
    await vi.importActual<typeof import("../../utils/dragDrop")>("../../utils/dragDrop");
  return {
    ...actual,
    extractComposerImageDropPayload: vi.fn(),
    extractDragDropPayload: vi.fn(),
    extractInternalReferenceDragPayload: vi.fn(),
  };
});

vi.mock("../../logic/mediaLibraryDragPayload", () => ({
  readMediaLibraryDragPayload: vi.fn(),
}));

const extractDragDropPayloadMock = vi.mocked(extractDragDropPayload);
const extractInternalReferenceDragPayloadMock = vi.mocked(extractInternalReferenceDragPayload);
const extractComposerImageDropPayloadMock = vi.mocked(extractComposerImageDropPayload);
const readMediaLibraryDragPayloadMock = vi.mocked(readMediaLibraryDragPayload);

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/flux/dev",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

const createFindOutputById = (outputs: StudioOutput[]) => {
  const byId = new Map(outputs.map((output) => [output.id, output]));
  return (id: string) => byId.get(id) ?? null;
};

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalFetch = global.fetch;

const makeDragEvent = (data: Record<string, string> = {}, files: File[] = []) =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      types: [],
      files,
      dropEffect: "copy",
      getData: (key: string) => data[key] ?? "",
    },
  }) as unknown as DragEvent<HTMLDivElement>;

describe("useAiStudioAgentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: null,
      referenceId: null,
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue(null);
    extractComposerImageDropPayloadMock.mockReturnValue(null);
    readMediaLibraryDragPayloadMock.mockReturnValue(null);
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    global.fetch = originalFetch;
  });

  it("clears attachment error when input changes", () => {
    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.setAgentAttachmentError("attachment failed");
    });
    act(() => {
      result.current.handleAgentInputChange("new prompt");
    });

    expect(result.current.agentInput).toBe("new prompt");
    expect(result.current.agentAttachmentError).toBeNull();
  });

  it("adds an image attachment on drop and enables session when disabled", () => {
    const ensureAgentSession = vi.fn();
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://example.com/image.png",
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(ensureAgentSession).toHaveBeenCalledTimes(1);
    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: "https://example.com/image.png",
      referenceUrl: null,
      referenceRenderUrl: null,
      text: "Reference note",
    });
  });

  it("stages composer image payload previews directly without generic drag reconstruction", async () => {
    const ensureAgentSession = vi.fn();
    extractComposerImageDropPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      mediaId: "media-1",
      displayArtifactUrl: "blob:resolved-artifact",
      displayArtifactKind: "blob",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      promptText: "Dragged prompt",
      sourceSurface: "all-refs",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://weak.example.com/preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    await waitFor(() => {
      expect(ensureAgentSession).toHaveBeenCalledTimes(1);
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        referenceId: "out-1",
        mediaId: "media-1",
        imageUrl: "blob:resolved-artifact",
        imageFallbackUrls: [],
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
        referenceUrl: "https://signed.example.com/generated.png",
        referenceRenderUrl: null,
        text: "Dragged prompt",
      });
    });
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(extractInternalReferenceDragPayloadMock).toHaveBeenCalledTimes(1);
  });

  it("materializes a local blob preview from durable identity when the drag payload preview is remote", async () => {
    const ensureAgentSession = vi.fn();
    const createObjectUrlMock = vi.fn(() => "blob:materialized-composer-preview");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    })) as typeof fetch;
    extractComposerImageDropPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      mediaId: "media-1",
      displayArtifactUrl: "https://fragile.example.com/preview.png",
      displayArtifactKind: "url",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      promptText: "Dragged prompt",
      sourceSurface: "all-refs",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://weak.example.com/preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        referenceId: "out-1",
        mediaId: "media-1",
        imageUrl: "blob:materialized-composer-preview",
        imageFallbackUrls: [],
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
        referenceUrl: "https://signed.example.com/generated.png",
        referenceRenderUrl: null,
        text: "Dragged prompt",
      });
    });

    expect(global.fetch).toHaveBeenCalledWith("https://signed.example.com/generated.png");
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
  });

  it("prefers internal image resolution over the direct composer payload when both are present", async () => {
    const ensureAgentSession = vi.fn();
    extractComposerImageDropPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      mediaId: "media-1",
      displayArtifactUrl: "https://fragile.example.com/preview.png",
      displayArtifactKind: "url",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      promptText: "Dragged prompt",
      sourceSurface: "all-refs",
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "image",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      referenceRenderUrl: "https://fragile.example.com/preview.png",
      sourceSurface: "all-refs",
    });
    const resolveInternalImageDropSource = vi.fn(
      async () =>
        ({
          kind: "internal",
          sourceKind: "generated_output",
          sourceId: "out-1:0",
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
            url: "blob:composer-owned-preview",
          },
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
          promptText: "Resolved prompt",
          preparedImageUrl: "blob:composer-owned-preview",
          loadBlob: vi.fn(async () => new Blob(["image-bytes"], { type: "image/png" })),
        }) satisfies ResolvedInternalReferenceSource
    );

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://weak.example.com/preview.png",
        resolveInternalImageDropSource,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(resolveInternalImageDropSource).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        referenceId: "out-1",
        mediaId: "media-1",
        imageUrl: "blob:composer-owned-preview",
        imageFallbackUrls: [],
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
        referenceUrl: null,
        referenceRenderUrl: null,
        text: "Dragged prompt",
      });
    });
  });

  it("dedupes repeated dropped attachments by signature", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://example.com/image.png",
      promptText: null,
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(1);
  });

  it("refreshes an existing image attachment when the same reference is dragged again", () => {
    extractDragDropPayloadMock
      .mockReturnValueOnce({
        imageUrl: "https://example.com/image-stale.png",
        promptText: null,
        referenceId: "out-1",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/image-fresh.png",
        promptText: null,
        referenceId: "out-1",
        fromFile: false,
      });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({
          "text/reference-render-url": "https://example.com/image-fresh-preview.png",
        })
      );
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: "https://example.com/image-fresh-preview.png",
      imageFallbackUrls: ["https://example.com/image-fresh.png"],
    });
  });

  it("caps image attachments to the most recent three entries", () => {
    extractDragDropPayloadMock
      .mockReturnValueOnce({
        imageUrl: "https://example.com/1.png",
        promptText: null,
        referenceId: "out-1",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/2.png",
        promptText: null,
        referenceId: "out-2",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/3.png",
        promptText: null,
        referenceId: "out-3",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/4.png",
        promptText: null,
        referenceId: "out-4",
        fromFile: false,
      });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1"),
          makeOutput("out-2"),
          makeOutput("out-3"),
          makeOutput("out-4"),
        ]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(3);
    expect(result.current.agentAttachments.map((attachment) => attachment.referenceId)).toEqual([
      "out-2",
      "out-3",
      "out-4",
    ]);
  });

  it("defaults desktop image-file drops to a single attachment", () => {
    const createObjectURLMock = vi.fn((file: File) => `blob:${file.name}`);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    const files = [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ];

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent({}, files));
    });

    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "image",
        imageUrl: "blob:one.png",
      }),
    ]);
  });

  it("stages up to the configured image-file drop limit", () => {
    const ensureAgentSession = vi.fn();
    const createObjectURLMock = vi.fn((file: File) => `blob:${file.name}`);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    const files = [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
      new File(["three"], "three.png", { type: "image/png" }),
      new File(["four"], "four.png", { type: "image/png" }),
    ];

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
        maxImageAttachmentsPerDrop: 3,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent({}, files));
    });

    expect(ensureAgentSession).toHaveBeenCalledTimes(1);
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(result.current.agentAttachments.map((attachment) => attachment.imageUrl)).toEqual([
      "blob:one.png",
      "blob:two.png",
      "blob:three.png",
    ]);
  });

  it("revokes owned blob urls when an attachment is removed", () => {
    const createObjectUrlMock = vi.fn(() => "blob:owned-preview");
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    const files = [new File(["image-bytes"], "preview.png", { type: "image/png" })];

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent({}, files));
    });

    act(() => {
      result.current.handleRemoveAgentAttachment(result.current.agentAttachments[0]?.id ?? "");
    });

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:owned-preview");
  });

  it("rejects dropped video files before they reach the composer", () => {
    const ensureAgentSession = vi.fn();
    const files = [new File(["video"], "clip.mp4", { type: "video/mp4" })];

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent({}, files));
    });

    expect(ensureAgentSession).not.toHaveBeenCalled();
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBe(
      "This is a video. Try adding an image instead."
    );
  });

  it("rejects internal video references instead of staging them as prompt attachments", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "Video note",
      referenceId: "out-1",
      fromFile: false,
      mediaKind: "video",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            mode: "video",
            previewText: "Video note",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "https://example.com/reference-video.mp4",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBe(
      "This is a video. Try adding an image instead."
    );
  });

  it("rejects media-library video drags before prompt fallback can attach them", () => {
    readMediaLibraryDragPayloadMock.mockReturnValue({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://example.com/reference-video.mp4",
        fileType: "video",
        originFolderId: null,
        filename: "reference-video.mp4",
        promptText: "Video note",
        source: "upload",
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        previewPosterUrl: "https://example.com/reference-video-poster.jpg",
        previewPosterStoragePath: null,
        fullUrl: "https://example.com/reference-video.mp4",
        width: 1280,
        height: 720,
      },
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBe(
      "This is a video. Try adding an image instead."
    );
  });

  it("falls back to output storage URLs when drop payload omits imageUrl", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            previewUrl: undefined,
            fullStoragePath: "https://example.com/fallback-image.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: "https://example.com/fallback-image.png",
      fullStoragePath: "https://example.com/fallback-image.png",
      text: "Reference note",
    });
  });

  it("prefers resolved internal image-drop authority over fragile drag and page preview urls", async () => {
    const fragileDragUrl =
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    const resolvedSource: ResolvedInternalReferenceSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "out-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "curated",
        resolutionReason: "saved_media_lookup",
      },
      outputId: "out-1",
      mediaId: "media-1",
      mediaSource: "generated",
      preview: {
        url: "https://signed.example.com/stable-preview.png",
      },
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      promptText: "Resolved prompt",
      preparedImageUrl: "https://signed.example.com/stable-preview.png",
      loadBlob: async () => new Blob(["image"]),
    };
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: fragileDragUrl,
      promptText: null,
      referenceId: "out-1",
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "image",
      previewStoragePath: null,
      fullStoragePath: null,
      referenceUrl: null,
      referenceRenderUrl: null,
      sourceSurface: "curated",
    });
    const resolveInternalImageDropSource = vi.fn(async () => resolvedSource);

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://cdn.example.com/weak-panel-preview.png",
        resolveInternalImageDropSource,
      })
    );

    await act(async () => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      await Promise.resolve();
    });

    expect(resolveInternalImageDropSource).toHaveBeenCalledTimes(1);
    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      mediaId: "media-1",
      imageUrl: "https://signed.example.com/stable-preview.png",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: null,
      referenceRenderUrl: null,
      text: "Resolved prompt",
    });
    expect(result.current.agentAttachments[0]?.imageFallbackUrls ?? []).not.toContain(
      "https://cdn.example.com/weak-panel-preview.png"
    );
  });

  it("shows an explicit error when internal image resolution fails closed", async () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl:
        "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75",
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "image",
      referenceUrl: null,
      referenceRenderUrl: null,
      sourceSurface: "curated",
    });
    const resolveOutputPreviewUrlById = vi.fn(
      () => "https://cdn.example.com/weak-panel-preview.png"
    );
    const resolveInternalImageDropSource = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById,
        resolveInternalImageDropSource,
      })
    );

    await act(async () => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      await Promise.resolve();
    });

    expect(resolveOutputPreviewUrlById).not.toHaveBeenCalled();
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "Reference note",
      }),
    ]);
    expect(result.current.agentAttachmentError).toBe(
      "Could not attach that image. Try dragging it again or add it from Media Library."
    );
  });

  it("fails closed instead of staging fragile generated transport previews when internal resolution cannot recover identity", async () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl:
        "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75",
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: null,
      mediaKind: "image",
      referenceUrl: null,
      referenceRenderUrl: null,
      sourceSurface: "curated",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            mediaSource: "generated",
            previewUrl: "https://cdn.example.com/weak-panel-preview.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "https://cdn.example.com/weak-panel-preview.png",
        resolveInternalImageDropSource: vi.fn(async () => null),
      })
    );

    await act(async () => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      await Promise.resolve();
    });

    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "Reference note",
      }),
    ]);
    expect(result.current.agentAttachmentError).toBe(
      "Could not attach that image. Try dragging it again or add it from Media Library."
    );
  });

  it("ignores raw storage keys and uses the draggable image URL for composer previews", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://signed.example.com/reference-image.png",
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            previewUrl: "user-1/media-library/reference-image.png",
            fullStoragePath: "user-1/media-library/reference-image-full.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "user-1/media-library/reference-image-preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: "https://signed.example.com/reference-image.png",
      text: "Reference note",
    });
  });

  it("keeps render-safe drag previews ahead of direct reference URLs", () => {
    const optimizerUrl =
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    const durableReferenceUrl =
      "http://localhost:3000/storage/v1/object/sign/media_library/user-1/image.png";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: durableReferenceUrl,
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({
          "text/reference-render-url": optimizerUrl,
        })
      );
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: optimizerUrl,
      imageFallbackUrls: [durableReferenceUrl],
      referenceUrl: null,
      referenceRenderUrl: optimizerUrl,
      text: "Reference note",
    });
  });

  it("keeps drag-provided render snapshots ahead of weaker durable fallbacks for composer previews", () => {
    const dataRenderUrl = "data:image/jpeg;base64,generated-render";
    const signedReferenceUrl = "https://signed.example.com/reference-image.png";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: dataRenderUrl,
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({
          "text/reference-render-url": dataRenderUrl,
          "text/reference-url": signedReferenceUrl,
        })
      );
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: dataRenderUrl,
      imageFallbackUrls: [signedReferenceUrl],
      referenceUrl: signedReferenceUrl,
      referenceRenderUrl: dataRenderUrl,
      text: "Reference note",
    });
  });

  it("keeps drag-provided snapshots ahead of output preview fallbacks", () => {
    const dataRenderUrl = "data:image/jpeg;base64,generated-render";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: dataRenderUrl,
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            previewUrl: "https://cdn.example.com/stale-preview.png",
            fullStoragePath: "https://cdn.example.com/stale-full.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "https://cdn.example.com/panel-preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({
          "text/reference-render-url": dataRenderUrl,
        })
      );
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: dataRenderUrl,
      imageFallbackUrls: [
        "https://cdn.example.com/panel-preview.png",
        "https://cdn.example.com/stale-full.png",
      ],
      fullStoragePath: "https://cdn.example.com/stale-full.png",
      referenceRenderUrl: dataRenderUrl,
      text: "Reference note",
    });
  });

  it("keeps extracted drag image URLs ahead of weaker page-resolved output preview fallbacks", () => {
    const durableReferenceUrl = "https://signed.example.com/reference-image.png";
    const resolvedPanelPreviewUrl = "https://cdn.example.com/panel-preview.png";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: durableReferenceUrl,
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => resolvedPanelPreviewUrl,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: durableReferenceUrl,
      imageFallbackUrls: [resolvedPanelPreviewUrl],
      text: "Reference note",
    });
  });

  it("prefers extracted drag image URLs before output preview fallbacks", () => {
    const renderedDragUrl =
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: renderedDragUrl,
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            previewUrl: "user-1/media-library/raw-preview.png",
            fullStoragePath: "user-1/media-library/raw-full.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "user-1/media-library/raw-panel-preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "image",
        referenceId: "out-1",
        imageUrl: renderedDragUrl,
        fullStoragePath: "user-1/media-library/raw-full.png",
      }),
    ]);
  });

  it("stages dropped prompt text as a prompt attachment", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "A cinematic portrait at golden hour",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentInput).toBe("");
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "A cinematic portrait at golden hour",
        deliveryStatus: "ready",
        deliveryError: null,
      }),
    ]);
    expect(result.current.linkedPromptReferenceIds).toEqual(["out-1"]);
  });

  it("preserves existing composer text when a prompt card is dropped", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "Dropped prompt should replace existing text",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentInputChange("Existing draft text");
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentInput).toBe("Existing draft text");
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "Dropped prompt should replace existing text",
      }),
    ]);
  });

  it("preserves input text when composer reset requests preserveInput", () => {
    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentInputChange("Keep this draft message");
    });
    act(() => {
      result.current.resetAgentComposer({ preserveInput: true });
    });

    expect(result.current.agentInput).toBe("Keep this draft message");
    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBeNull();
  });

  it("preserves attachments when composer reset requests preserveAttachments", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://example.com/image.png",
      promptText: null,
      referenceId: "out-1",
      fromFile: false,
    });
    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });
    act(() => {
      result.current.resetAgentComposer({ preserveInput: true, preserveAttachments: true });
    });

    expect(result.current.agentAttachments).toHaveLength(1);
  });
});
