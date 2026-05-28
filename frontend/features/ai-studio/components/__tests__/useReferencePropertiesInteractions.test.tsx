import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import {
  forgetObjectUrlBlob,
  readRememberedObjectUrlBlob,
} from "../../utils/objectUrlBlobRegistry";

const makeInternalReferenceDragEvent = (overrides?: {
  mediaKind?: "image" | "video" | "audio" | "text";
  referenceUrl?: string;
  imageUrl?: string;
  files?: File[];
}) =>
  ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      files: (overrides?.files ?? []) satisfies File[] as unknown as FileList,
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-id",
        ...(overrides?.mediaKind ? ["text/reference-media-kind"] : []),
        ...(overrides?.referenceUrl ? ["text/reference-url"] : []),
        ...(overrides?.imageUrl ? ["image/url"] : []),
      ],
      getData: vi.fn((type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-output-id") return "out-1";
        if (type === "text/reference-id") return "out-1";
        if (type === "text/reference-media-kind") return overrides?.mediaKind ?? "";
        if (type === "text/reference-url") return overrides?.referenceUrl ?? "";
        if (type === "image/url") return overrides?.imageUrl ?? "";
        return "";
      }),
    },
  }) as unknown as Parameters<
    ReturnType<typeof useReferencePropertiesInteractions>["handlePrimaryDragEnter"]
  >[0];

const createVideoReferenceDropEvent = (referenceId: string) =>
  ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      files: { length: 0, item: () => null } as unknown as FileList,
      types: ["text/reference-id", "text/reference-url"],
      getData: vi.fn((type: string) => {
        if (type === "text/reference-id") return referenceId;
        return "";
      }),
    },
  }) as unknown as Parameters<
    ReturnType<typeof useReferencePropertiesInteractions>["handleMotionVideoDrop"]
  >[0];

describe("useReferencePropertiesInteractions", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    forgetObjectUrlBlob("blob:selected-file");
    forgetObjectUrlBlob("blob:drag-source");
    forgetObjectUrlBlob("blob:drag-clone");
    forgetObjectUrlBlob("blob:stale-drag-source");
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    global.fetch = originalFetch;
  });

  it("resolves playable video URLs for motion drops from internal references", async () => {
    const onMotionVideoChange = vi.fn();
    const resolvePreviewUrlById = vi.fn((id: string | null) =>
      id === "out-1" ? "https://example.com/reference-video.mp4" : null
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        resolvePreviewUrlById,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const event = createVideoReferenceDropEvent("out-1");

    await act(async () => {
      await result.current.handleMotionVideoDrop(event);
    });

    expect(resolvePreviewUrlById).toHaveBeenCalledWith("out-1");
    expect(onMotionVideoChange).toHaveBeenCalledWith("https://example.com/reference-video.mp4");
  });

  it("accepts internal reference-grid drags for image drop targets", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const primaryEvent = makeInternalReferenceDragEvent();
    const secondaryEvent = makeInternalReferenceDragEvent();

    act(() => {
      result.current.handlePrimaryDragEnter(primaryEvent);
      result.current.handleExtraDragEnter(1)(secondaryEvent);
    });

    expect(primaryEvent.preventDefault).toHaveBeenCalled();
    expect(secondaryEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.primaryDragActive).toBe(true);
    expect(result.current.extraDragActive[1]).toBe(true);
  });

  it("rejects internal video references for image drop targets", () => {
    const onExtraImageChange = vi.fn();
    const resolvePreviewUrlById = vi.fn((id: string | null) =>
      id === "out-1" ? "https://example.com/reference-video.mp4" : null
    );
    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolvePreviewUrlById,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dragEvent = makeInternalReferenceDragEvent({
      mediaKind: "video",
      referenceUrl: "https://example.com/reference-video.mp4",
      imageUrl: "https://example.com/reference-video-poster.jpg",
    });
    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "video",
      referenceUrl: "https://example.com/reference-video.mp4",
      imageUrl: "https://example.com/reference-video-poster.jpg",
    });

    act(() => {
      result.current.handleExtraDragEnter(1)(dragEvent);
      result.current.handleExtraDrop(1)(dropEvent);
    });

    expect(dragEvent.preventDefault).not.toHaveBeenCalled();
    expect(result.current.extraDragActive[1]).toBe(false);
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
    expect(onExtraImageChange).not.toHaveBeenCalled();
  });

  it("accepts internal video references for frame-image drop targets when a video frame resolver is provided", async () => {
    const onExtraImageChange = vi.fn();
    const resolveInternalReferenceVideoFrameDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "poster-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-video-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: "media-video-1",
      mediaSource: "generated" as const,
      preview: { url: "https://example.com/reference-video-poster.jpg" },
      previewStoragePath: "user/posters/ref-video-poster.jpg",
      fullStoragePath: "user/posters/ref-video-poster.jpg",
      promptText: null,
      preparedImageUrl: "https://example.com/reference-video-poster.jpg",
      loadBlob: async () => new Blob(["poster"], { type: "image/jpeg" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolveInternalReferenceVideoFrameDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dragEvent = makeInternalReferenceDragEvent({
      mediaKind: "video",
      referenceUrl: "https://example.com/reference-video.mp4",
      imageUrl: "https://example.com/reference-video-poster.jpg",
    });
    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "video",
      referenceUrl: "https://example.com/reference-video.mp4",
      imageUrl: "https://example.com/reference-video-poster.jpg",
    });

    act(() => {
      result.current.handleExtraDragEnter(1)(dragEvent);
    });
    await act(async () => {
      await result.current.handleExtraDrop(1)(dropEvent);
    });

    expect(dragEvent.preventDefault).toHaveBeenCalled();
    expect(resolveInternalReferenceVideoFrameDropSource).toHaveBeenCalledTimes(1);
    expect(onExtraImageChange).toHaveBeenCalledWith(
      1,
      "https://example.com/reference-video-poster.jpg"
    );
  });

  it("prefers the video frame resolver over synthetic image files on internal video drags", async () => {
    const onExtraImageChange = vi.fn();
    const syntheticPosterFile = new File(["poster"], "poster.png", { type: "image/png" });
    const resolveInternalReferenceVideoFrameDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "poster-2",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-video-2",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: "media-video-2",
      mediaSource: "generated" as const,
      preview: { url: "https://example.com/durable-video-poster.jpg" },
      previewStoragePath: "user/posters/ref-video-poster-2.jpg",
      fullStoragePath: "user/posters/ref-video-poster-2.jpg",
      promptText: null,
      preparedImageUrl: "https://example.com/durable-video-poster.jpg",
      loadBlob: async () => new Blob(["poster"], { type: "image/jpeg" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolveInternalReferenceVideoFrameDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "video",
      referenceUrl: "https://example.com/reference-video.mp4",
      imageUrl: "https://example.com/reference-video-poster.jpg",
      files: [syntheticPosterFile],
    });

    await act(async () => {
      await result.current.handleExtraDrop(0)(dropEvent);
    });

    expect(resolveInternalReferenceVideoFrameDropSource).toHaveBeenCalledTimes(1);
    expect(onExtraImageChange).toHaveBeenCalledWith(
      0,
      "https://example.com/durable-video-poster.jpg"
    );
  });

  it("infers degraded internal video drags from video reference plus poster render hints", async () => {
    const onExtraImageChange = vi.fn();
    const syntheticPosterFile = new File(["poster"], "poster.png", { type: "image/png" });
    const resolveInternalReferenceVideoFrameDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "poster-3",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-video-3",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: "media-video-3",
      mediaSource: "generated" as const,
      preview: { url: "https://example.com/inferred-video-poster.jpg" },
      previewStoragePath: "user/posters/ref-video-poster-3.jpg",
      fullStoragePath: "user/posters/ref-video-poster-3.jpg",
      promptText: null,
      preparedImageUrl: "https://example.com/inferred-video-poster.jpg",
      loadBlob: async () => new Blob(["poster"], { type: "image/jpeg" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolveInternalReferenceVideoFrameDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      referenceUrl: "https://example.com/reference-video.mp4",
      imageUrl: "https://example.com/reference-video-poster.jpg",
      files: [syntheticPosterFile],
    });

    await act(async () => {
      await result.current.handleExtraDrop(2)(dropEvent);
    });

    expect(resolveInternalReferenceVideoFrameDropSource).toHaveBeenCalledTimes(1);
    expect(onExtraImageChange).toHaveBeenCalledWith(
      2,
      "https://example.com/inferred-video-poster.jpg"
    );
  });

  it("remembers file-selected image blobs for later submission reuse", () => {
    const onExtraImageChange = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:selected-file");

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const file = new File(["secondary-ref"], "secondary.png", { type: "image/png" });
    const event = {
      target: {
        files: [file],
        value: "secondary.png",
      },
    };

    act(() => {
      result.current.handleFileSelection((url) => onExtraImageChange(0, url))(event as never);
    });

    expect(onExtraImageChange).toHaveBeenCalledWith(0, "blob:selected-file");
    expect(readRememberedObjectUrlBlob("blob:selected-file")).toBe(file);
  });

  it("clones blob-backed internal image drops so slots own stable object urls", async () => {
    const onExtraImageChange = vi.fn();
    const droppedBlob = new Blob(["dragged"], { type: "image/png" });
    URL.createObjectURL = vi.fn(() => "blob:drag-clone");
    URL.revokeObjectURL = vi.fn();
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(droppedBlob, { headers: { "Content-Type": "image/png" } })
      ) as typeof fetch;

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      imageUrl: "blob:drag-source",
    });

    await act(async () => {
      await result.current.handleExtraDrop(0)(dropEvent);
    });

    expect(global.fetch).toHaveBeenCalledWith("blob:drag-source");
    expect(onExtraImageChange).toHaveBeenCalledWith(0, "blob:drag-clone");
    const rememberedBlob = readRememberedObjectUrlBlob("blob:drag-clone");
    expect(rememberedBlob).not.toBeNull();
    expect(rememberedBlob?.type).toBe("image/png");
  });

  it("prefers the internal reference resolver over weak preview fallback urls", async () => {
    const onExtraImageChange = vi.fn();
    const resolvePreviewUrlById = vi.fn(() => "https://example.com/weak-preview.png");
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "source-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: null,
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: null,
      mediaSource: "generated" as const,
      preview: { url: "https://example.com/durable-preview.png" },
      previewStoragePath: "user/images/ref.png",
      fullStoragePath: "user/images/ref.png",
      promptText: null,
      preparedImageUrl: "https://example.com/durable-signed.png",
      loadBlob: async () => new Blob(["durable"], { type: "image/png" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolvePreviewUrlById,
        resolveInternalReferenceImageDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      referenceUrl: "blob:temporary-render",
      imageUrl: "blob:temporary-render",
    });

    await act(async () => {
      await result.current.handleExtraDrop(0)(dropEvent);
    });

    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(onExtraImageChange).toHaveBeenCalledWith(0, "https://example.com/durable-signed.png");
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
  });

  it("does not persist stale blob-backed image drops when cloning fails", async () => {
    const onExtraImageChange = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error("stale blob")) as typeof fetch;

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      imageUrl: "blob:stale-drag-source",
    });

    await act(async () => {
      await result.current.handleExtraDrop(0)(dropEvent);
    });

    expect(global.fetch).toHaveBeenCalledWith("blob:stale-drag-source");
    expect(onExtraImageChange).not.toHaveBeenCalled();
    expect(readRememberedObjectUrlBlob("blob:stale-drag-source")).toBeNull();
  });
});
