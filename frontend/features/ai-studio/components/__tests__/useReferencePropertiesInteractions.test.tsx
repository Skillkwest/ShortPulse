import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import {
  forgetObjectUrlBlob,
  readRememberedObjectUrlBlob,
} from "../../utils/objectUrlBlobRegistry";
import type { ResolvedInternalReferenceSource } from "../../logic/referenceSource/internalReferenceSource";
import { INTERNAL_REFERENCE_DRAG_ORIGIN } from "../../utils/dragDrop";

const getSignedMediaUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: getSignedMediaUrlMock,
}));

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

const createMotionDropEvent = (overrides?: {
  mediaKind?: "image" | "video" | "audio" | "text";
  referenceId?: string;
  referenceUrl?: string;
  outputId?: string;
  origin?: string;
  previewStoragePath?: string;
  fullStoragePath?: string;
  files?: File[];
}) =>
  ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      files: (overrides?.files ?? []) satisfies File[] as unknown as FileList,
      types: [
        ...(overrides?.referenceId ? ["text/reference-id"] : []),
        ...(overrides?.outputId ? ["text/reference-output-id"] : []),
        ...(overrides?.origin ? ["text/reference-origin"] : []),
        ...(overrides?.referenceUrl ? ["text/reference-url"] : []),
        ...(overrides?.mediaKind ? ["text/reference-media-kind"] : []),
        ...(overrides?.previewStoragePath ? ["text/reference-preview-storage-path"] : []),
        ...(overrides?.fullStoragePath ? ["text/reference-full-storage-path"] : []),
      ],
      getData: vi.fn((type: string) => {
        if (type === "text/reference-id") return overrides?.referenceId ?? "";
        if (type === "text/reference-output-id") return overrides?.outputId ?? "";
        if (type === "text/reference-origin") return overrides?.origin ?? "";
        if (type === "text/reference-url") return overrides?.referenceUrl ?? "";
        if (type === "text/reference-media-kind") return overrides?.mediaKind ?? "";
        if (type === "text/reference-preview-storage-path")
          return overrides?.previewStoragePath ?? "";
        if (type === "text/reference-full-storage-path") return overrides?.fullStoragePath ?? "";
        return "";
      }),
    },
  }) as unknown as Parameters<
    ReturnType<typeof useReferencePropertiesInteractions>["handleMotionVideoDrop"]
  >[0];

const makeCanvasTearOutImagePayload = () => ({
  kind: "image" as const,
  internalPayload: {
    version: 1,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: "out-1",
    outputId: "out-1",
    imageIndex: 0,
    mediaId: "media-1",
    mediaKind: "image" as const,
    referenceUrl: "blob:weak-reference-render",
    referenceRenderUrl: "https://cdn.shortpulse.test/secondary-reference.png",
    sourceSurface: "all-refs" as const,
    width: 640,
    height: 480,
    sessionBacked: true,
  },
  composerImagePayload: {
    version: 1,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: "out-1",
    outputId: "out-1",
    mediaId: "media-1",
    displayArtifactUrl: "https://cdn.shortpulse.test/secondary-reference.png",
    displayArtifactKind: "url" as const,
    sourceSurface: "all-refs" as const,
    width: 640,
    height: 480,
  },
});

const makeCanvasTearOutVideoPayload = () => ({
  kind: "video" as const,
  videoUrl: "https://cdn.shortpulse.test/canvas-motion.mp4",
  internalPayload: {
    version: 1,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: "out-video-1",
    outputId: "out-video-1",
    imageIndex: 0,
    mediaId: "media-video-1",
    mediaKind: "video" as const,
    referenceUrl: "https://cdn.shortpulse.test/canvas-motion.mp4",
    referenceRenderUrl: "https://cdn.shortpulse.test/canvas-motion-poster.jpg",
    sourceSurface: "all-refs" as const,
    sessionBacked: true,
  },
  outputId: "out-video-1",
  mediaId: "media-video-1",
  durationMs: 5400,
});

describe("useReferencePropertiesInteractions", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    getSignedMediaUrlMock.mockReset();
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

  it("accepts canvas tear-out video payloads for the Motion Control clip slot", () => {
    const onMotionVideoChange = vi.fn();

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    act(() => {
      result.current.acceptMotionVideoCanvasTearOutPayload(makeCanvasTearOutVideoPayload());
    });

    expect(onMotionVideoChange).toHaveBeenCalledWith(
      "https://cdn.shortpulse.test/canvas-motion.mp4"
    );
    expect(result.current.motionVideoDragActive).toBe(false);
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

  it("marks a frame slot as loading while an internal image drop is resolving", async () => {
    const onExtraImageChange = vi.fn();
    let resolveDrop: ((value: ResolvedInternalReferenceSource | null) => void) | null = null;
    const resolveInternalReferenceImageDropSource = vi.fn(
      () =>
        new Promise<ResolvedInternalReferenceSource | null>((resolve) => {
          resolveDrop = resolve;
        })
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolveInternalReferenceImageDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "image",
      referenceUrl: "https://example.com/reference-image.png",
      imageUrl: "https://example.com/reference-image.png",
    });

    expect(result.current.extraImageLoading[0]).toBe(false);

    let dropPromise!: Promise<void>;
    await act(async () => {
      dropPromise = result.current.handleExtraDrop(0)(dropEvent);
      await Promise.resolve();
    });

    expect(result.current.extraImageLoading[0]).toBe(true);

    await act(async () => {
      resolveDrop?.({
        kind: "internal" as const,
        sourceKind: "generated_output" as const,
        sourceId: "image-loading-1",
        provenance: {
          origin: "ai-studio-reference-grid",
          outputId: "out-1",
          mediaId: "media-image-loading-1",
          imageIndex: 0,
          sourceSurface: "all-refs",
          resolutionReason: "output_storage_path" as const,
        },
        outputId: "out-1",
        mediaId: "media-image-loading-1",
        mediaSource: "generated" as const,
        preview: { url: "https://example.com/reference-image.png" },
        previewStoragePath: "user/images/loading-image.png",
        fullStoragePath: "user/images/loading-image.png",
        promptText: null,
        preparedImageUrl: "https://example.com/reference-image.png",
        loadBlob: async () => new Blob(["image"], { type: "image/png" }),
      });
      await dropPromise;
    });

    expect(result.current.extraImageLoading[0]).toBe(false);
    expect(onExtraImageChange).toHaveBeenCalledWith(0, "https://example.com/reference-image.png");
  });

  it("accepts canvas tear-out image payloads for secondary references", async () => {
    const onExtraImageChange = vi.fn();
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: "media-1",
      mediaSource: "generated" as const,
      preview: { url: "https://cdn.shortpulse.test/secondary-reference.png" },
      previewStoragePath: "user/images/secondary-reference-preview.png",
      fullStoragePath: "user/images/secondary-reference-full.png",
      promptText: null,
      preparedImageUrl: "https://cdn.shortpulse.test/secondary-reference-durable.png",
      loadBlob: async () => new Blob(["image"], { type: "image/png" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolvePreviewUrlById: vi.fn(() => "https://example.com/weak-preview.png"),
        resolveInternalReferenceImageDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      result.current.acceptExtraCanvasTearOutPayload(1, makeCanvasTearOutImagePayload());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(onExtraImageChange).toHaveBeenCalledWith(
      1,
      "https://cdn.shortpulse.test/secondary-reference-durable.png"
    );
    expect(result.current.extraImageLoading[1]).toBe(false);
  });

  it("accepts canvas tear-out image payloads for the primary reference", async () => {
    const onPrimaryImageChange = vi.fn();
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: "media-1",
      mediaSource: "generated" as const,
      preview: { url: "https://cdn.shortpulse.test/primary-reference.png" },
      previewStoragePath: "user/images/primary-reference-preview.png",
      fullStoragePath: "user/images/primary-reference-full.png",
      promptText: null,
      preparedImageUrl: "https://cdn.shortpulse.test/primary-reference-durable.png",
      loadBlob: async () => new Blob(["image"], { type: "image/png" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange,
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        resolvePreviewUrlById: vi.fn(() => "https://example.com/weak-preview.png"),
        resolveInternalReferenceImageDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      result.current.acceptPrimaryCanvasTearOutPayload(makeCanvasTearOutImagePayload());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(onPrimaryImageChange).toHaveBeenCalledWith(
      "https://cdn.shortpulse.test/primary-reference-durable.png"
    );
    expect(result.current.primaryImageLoading).toBe(false);
  });

  it("clears frame-slot loading when an internal image drop resolves without a usable url", async () => {
    const onExtraImageChange = vi.fn();
    let resolveDrop: ((value: ResolvedInternalReferenceSource | null) => void) | null = null;
    const resolveInternalReferenceImageDropSource = vi.fn(
      () =>
        new Promise<ResolvedInternalReferenceSource | null>((resolve) => {
          resolveDrop = resolve;
        })
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange,
        onPromptTextChange: vi.fn(),
        resolveInternalReferenceImageDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "image",
    });

    let dropPromise!: Promise<void>;
    await act(async () => {
      dropPromise = result.current.handleExtraDrop(0)(dropEvent);
      await Promise.resolve();
    });

    expect(result.current.extraImageLoading[0]).toBe(true);

    await act(async () => {
      resolveDrop?.({
        kind: "internal" as const,
        sourceKind: "generated_output" as const,
        sourceId: "image-loading-missing-url",
        provenance: {
          origin: "ai-studio-reference-grid",
          outputId: "out-1",
          mediaId: "media-image-loading-missing-url",
          imageIndex: 0,
          sourceSurface: "all-refs",
          resolutionReason: "output_storage_path" as const,
        },
        outputId: "out-1",
        mediaId: "media-image-loading-missing-url",
        mediaSource: "generated" as const,
        preview: { url: "" },
        previewStoragePath: "user/images/loading-image-preview.png",
        fullStoragePath: "user/images/loading-image-full.png",
        promptText: null,
        preparedImageUrl: null,
        loadBlob: async () => new Blob(["image"], { type: "image/png" }),
      });
      await dropPromise;
    });

    expect(result.current.extraImageLoading[0]).toBe(false);
    expect(onExtraImageChange).not.toHaveBeenCalled();
  });

  it("ignores internal image references for motion video drop targets", async () => {
    const onMotionVideoChange = vi.fn();
    const resolvePreviewUrlById = vi.fn((id: string | null) =>
      id === "out-1" ? "https://example.com/reference-image.png" : null
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

    const event = createMotionDropEvent({
      mediaKind: "image",
      referenceId: "out-1",
      referenceUrl: "https://example.com/reference-image.png",
    });

    await act(async () => {
      await result.current.handleMotionVideoDrop(event);
    });

    expect(onMotionVideoChange).not.toHaveBeenCalled();
  });

  it("prefers the authoritative video resolver for motion drops when preview urls are poster images", async () => {
    const onMotionVideoChange = vi.fn();
    const resolvePreviewUrlById = vi.fn(() => "https://example.com/reference-video-poster.jpg");
    const resolveMotionVideoUrlById = vi.fn(() => "https://example.com/reference-video.mp4");

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        resolvePreviewUrlById,
        resolveMotionVideoUrlById,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const event = createMotionDropEvent({
      referenceId: "out-1",
    });

    await act(async () => {
      await result.current.handleMotionVideoDrop(event);
    });

    expect(resolveMotionVideoUrlById).toHaveBeenCalledWith("out-1");
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
    expect(onMotionVideoChange).toHaveBeenCalledWith("https://example.com/reference-video.mp4");
  });

  it("signs storage-backed internal video drags for motion drops when no playable URL is exposed", async () => {
    const onMotionVideoChange = vi.fn();
    getSignedMediaUrlMock.mockResolvedValue(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user-1/generations/videos/reference-video.mp4?token=fresh"
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const event = createMotionDropEvent({
      mediaKind: "video",
      referenceId: "out-video-storage",
      outputId: "out-video-storage",
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      previewStoragePath: "user-1/generations/video-posters/reference-video.jpg",
      fullStoragePath: "user-1/generations/videos/reference-video.mp4",
    });

    await act(async () => {
      await result.current.handleMotionVideoDrop(event);
    });

    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/generations/videos/reference-video.mp4",
      previewProfile: "none",
    });
    expect(onMotionVideoChange).toHaveBeenCalledWith(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user-1/generations/videos/reference-video.mp4?token=fresh"
    );
  });

  it("remembers file-selected image blobs for later submission reuse", async () => {
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

    await act(async () => {
      result.current.handleFileSelection((url) => onExtraImageChange(0, url))(event as never);
      await Promise.resolve();
    });

    expect(onExtraImageChange).toHaveBeenCalledWith(0, "blob:selected-file");
    expect(readRememberedObjectUrlBlob("blob:selected-file")).toBe(file);
  });

  it("stages file-selected motion videos before committing them", async () => {
    const onMotionVideoChange = vi.fn();
    const onStageMotionVideoSelection = vi.fn().mockResolvedValue(undefined);
    const file = new File(["motion"], "motion.webm", { type: "video/webm" });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        onStageMotionVideoSelection,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      await result.current.handleMotionVideoSelection({
        target: {
          files: [file],
          value: "motion.webm",
        },
      } as never);
    });

    expect(onStageMotionVideoSelection).toHaveBeenCalledWith({ videoFile: file });
    expect(onMotionVideoChange).not.toHaveBeenCalled();
  });

  it("stages dropped local motion videos before committing them", async () => {
    const onMotionVideoChange = vi.fn();
    const onStageMotionVideoSelection = vi.fn().mockResolvedValue(undefined);
    const file = new File(["motion"], "motion.mp4", { type: "video/mp4" });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        onStageMotionVideoSelection,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      await result.current.handleMotionVideoDrop(
        createMotionDropEvent({
          files: [file],
        })
      );
    });

    expect(onStageMotionVideoSelection).toHaveBeenCalledWith({ videoFile: file });
    expect(onMotionVideoChange).not.toHaveBeenCalled();
  });

  it("fails closed on blob-backed internal image drops without authoritative resolution", async () => {
    const onExtraImageChange = vi.fn();

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

    expect(onExtraImageChange).not.toHaveBeenCalled();
    expect(readRememberedObjectUrlBlob("blob:drag-source")).toBeNull();
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

  it("fails closed instead of reviving weak preview fallback urls after unusable internal resolution", async () => {
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
      preview: { url: "" },
      previewStoragePath: "user/images/ref-preview.png",
      fullStoragePath: "user/images/ref-full.png",
      promptText: null,
      preparedImageUrl: null,
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
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
    expect(onExtraImageChange).not.toHaveBeenCalled();
    expect(result.current.extraImageLoading[0]).toBe(false);
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

    expect(onExtraImageChange).not.toHaveBeenCalled();
    expect(readRememberedObjectUrlBlob("blob:stale-drag-source")).toBeNull();
  });
});
