import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import {
  forgetObjectUrlBlob,
  readRememberedObjectUrlBlob,
  rememberObjectUrlBlob,
} from "../../utils/objectUrlBlobRegistry";
import type { ResolvedInternalReferenceSource } from "../../logic/referenceSource/internalReferenceSource";
import { resolveInternalMediaRefForUrl } from "../../logic/referenceInputInternalMediaRegistry";
import { INTERNAL_REFERENCE_DRAG_ORIGIN, prepareReferenceDrag } from "../../utils/dragDrop";

const getSignedMediaUrlMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const uploadImageAssetToStorageMock = vi.hoisted(() => vi.fn());
const uploadImageBlobAssetToStorageMock = vi.hoisted(() => vi.fn());
const uploadReferenceVideoAssetToStorageMock = vi.hoisted(() => vi.fn());
const uploadReferenceVideoFileToStorageMock = vi.hoisted(() => vi.fn());
const uploadAudioBlobToStorageMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: getSignedMediaUrlMock,
}));
vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));
vi.mock("../../utils/imageUpload", () => ({
  uploadImageAssetToStorage: (...args: unknown[]) => uploadImageAssetToStorageMock(...args),
  uploadImageBlobAssetToStorage: (...args: unknown[]) => uploadImageBlobAssetToStorageMock(...args),
}));
vi.mock("../../utils/videoUpload", () => ({
  uploadReferenceVideoAssetToStorage: (...args: unknown[]) =>
    uploadReferenceVideoAssetToStorageMock(...args),
  uploadReferenceVideoFileToStorage: (...args: unknown[]) =>
    uploadReferenceVideoFileToStorageMock(...args),
}));
vi.mock("../../utils/audioUpload", () => ({
  uploadAudioBlobToStorage: (...args: unknown[]) => uploadAudioBlobToStorageMock(...args),
}));

const makeInternalReferenceDragEvent = (overrides?: {
  mediaKind?: "image" | "video" | "audio" | "text";
  referenceUrl?: string;
  imageUrl?: string;
  sourceSurface?: "all-refs" | "curated";
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
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-id",
        ...(overrides?.mediaKind ? ["text/reference-media-kind"] : []),
        ...(overrides?.referenceUrl ? ["text/reference-url"] : []),
        ...(overrides?.imageUrl ? ["image/url"] : []),
        ...(overrides?.sourceSurface ? ["text/reference-source-surface"] : []),
        ...(overrides?.previewStoragePath ? ["text/reference-preview-storage-path"] : []),
        ...(overrides?.fullStoragePath ? ["text/reference-full-storage-path"] : []),
      ],
      getData: vi.fn((type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-output-id") return "out-1";
        if (type === "text/reference-id") return "out-1";
        if (type === "text/reference-media-kind") return overrides?.mediaKind ?? "";
        if (type === "text/reference-url") return overrides?.referenceUrl ?? "";
        if (type === "image/url") return overrides?.imageUrl ?? "";
        if (type === "text/reference-source-surface") return overrides?.sourceSurface ?? "";
        if (type === "text/reference-preview-storage-path")
          return overrides?.previewStoragePath ?? "";
        if (type === "text/reference-full-storage-path") return overrides?.fullStoragePath ?? "";
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

const makeFlattenedComposerImageDropEvent = () => {
  const transferData = new Map<string, string>();
  const currentTarget = document.createElement("article");
  const image = document.createElement("img");
  image.className = "reference-card-image";
  image.setAttribute("src", "blob:secondary-flattened-source");
  currentTarget.appendChild(image);
  const dataTransfer = {
    files: [] as unknown as FileList,
    get types() {
      return Array.from(transferData.keys());
    },
    getData: (type: string) => transferData.get(type) ?? "",
    setData: (type: string, value: string) => {
      transferData.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;

  prepareReferenceDrag(
    {
      currentTarget,
      dataTransfer,
    } as unknown as Parameters<typeof prepareReferenceDrag>[0],
    {
      id: "secondary-flattened-output",
      prompt: "Secondary flattened image",
      previewText: "Secondary flattened image",
      mode: "image",
      aspect: "16:9",
      model: "Test model",
      status: "ready",
      timestamp: "now",
      taskState: "success",
      mediaSource: "generated",
      previewUrl: "blob:secondary-flattened-source",
      resultUrls: ["blob:secondary-flattened-source"],
      saveState: "failed",
    } as never,
    {
      dragImage: currentTarget,
      sourceSurface: "all-refs",
      composerImageArtifact: {
        displayArtifactUrl: "blob:secondary-flattened-source",
        displayArtifactKind: "blob",
        promptText: "Secondary flattened image",
        mimeType: "image/png",
      },
    }
  );

  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer,
  } as unknown as Parameters<
    ReturnType<typeof useReferencePropertiesInteractions>["handlePrimaryDrop"]
  >[0];
};

describe("useReferencePropertiesInteractions", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    getSignedMediaUrlMock.mockReset();
    fetchWithAuthMock.mockReset();
    uploadImageAssetToStorageMock.mockReset();
    uploadImageBlobAssetToStorageMock.mockReset();
    uploadReferenceVideoAssetToStorageMock.mockReset();
    uploadReferenceVideoFileToStorageMock.mockReset();
    uploadAudioBlobToStorageMock.mockReset();
  });

  afterEach(() => {
    forgetObjectUrlBlob("blob:selected-file");
    forgetObjectUrlBlob("blob:drag-source");
    forgetObjectUrlBlob("blob:drag-clone");
    forgetObjectUrlBlob("blob:stale-drag-source");
    forgetObjectUrlBlob("blob:dropped-primary");
    forgetObjectUrlBlob("blob:secondary-flattened-source");
    forgetObjectUrlBlob("blob:secondary-flattened-prepared");
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

  it("accepts canvas tear-out video payloads for the Motion Control clip slot", async () => {
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

    await act(async () => {
      await result.current.acceptMotionVideoCanvasTearOutPayload(makeCanvasTearOutVideoPayload());
    });

    expect(onMotionVideoChange).toHaveBeenCalledWith(
      "https://cdn.shortpulse.test/canvas-motion.mp4"
    );
    expect(result.current.motionVideoDragActive).toBe(false);
  });

  it("keeps image-only scope from activating video, Seedance, or Kling branches", async () => {
    const onMotionVideoChange = vi.fn();
    const onKlingMultiPromptsChange = vi.fn();
    const onKlingElementsChange = vi.fn();

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        interactionScope: "image",
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        onKlingMultiPromptsChange,
        onKlingElementsChange,
        klingMultiPrompts: [{ id: "shot-1", prompt: "Hold", duration: 5 }],
        klingElements: [],
        seedanceElementSlotCount: 2,
      })
    );

    expect(result.current.seedanceElementImageInputRefs).toHaveLength(0);

    await act(async () => {
      await result.current.handleMotionVideoDrop(createVideoReferenceDropEvent("out-1"));
      await result.current.acceptMotionVideoCanvasTearOutPayload(makeCanvasTearOutVideoPayload());
    });
    act(() => {
      result.current.addKlingShot();
      result.current.updateKlingMultiPrompt("shot-1", "prompt", "Move");
      result.current.addKlingElement();
      result.current.handleSeedanceElementMediaDragEnter(0)(makeInternalReferenceDragEvent());
    });

    expect(onMotionVideoChange).not.toHaveBeenCalled();
    expect(onKlingMultiPromptsChange).not.toHaveBeenCalled();
    expect(onKlingElementsChange).not.toHaveBeenCalled();
    expect(result.current.seedanceElementImageDragActive).toEqual([]);
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
    getSignedMediaUrlMock.mockRejectedValueOnce(new Error("sign failed"));
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

  it("does not coerce untyped image storage into motion video drops", async () => {
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

    const event = createMotionDropEvent({
      referenceId: "out-image-storage",
      outputId: "out-image-storage",
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceUrl: "https://example.com/reference-image.png",
      previewStoragePath: "user-1/generations/images/reference-image-preview.jpg",
      fullStoragePath: "user-1/generations/images/reference-image-full.png",
    });

    await act(async () => {
      await result.current.handleMotionVideoDrop(event);
    });

    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
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

  it("routes resolved motion video drops through staging when the app provides a staging owner", async () => {
    const onMotionVideoChange = vi.fn();
    const onStageMotionVideoSelection = vi.fn().mockResolvedValue(undefined);
    const resolveMotionVideoUrlById = vi.fn(() => "https://example.com/reference-video.mp4");

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        onStageMotionVideoSelection,
        resolveMotionVideoUrlById,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      await result.current.handleMotionVideoDrop(
        createMotionDropEvent({
          referenceId: "out-1",
        })
      );
    });

    expect(onStageMotionVideoSelection).toHaveBeenCalledWith({
      videoUrl: "https://example.com/reference-video.mp4",
    });
    expect(onMotionVideoChange).not.toHaveBeenCalled();
  });

  it("prefers the internal video resolver over poster fallback urls for motion drops", async () => {
    const onMotionVideoChange = vi.fn();
    const resolvePreviewUrlById = vi.fn(() => "https://example.com/reference-video-poster.jpg");
    const resolveInternalReferenceVideoDropSource = vi.fn(
      async (): Promise<ResolvedInternalReferenceSource> => ({
        kind: "internal",
        sourceKind: "generated_output",
        sourceId: "source-video-1",
        provenance: {
          origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
          outputId: "out-video-1",
          mediaId: "media-video-1",
          imageIndex: 0,
          sourceSurface: "all-refs",
          resolutionReason: "output_storage_path",
        },
        outputId: "out-video-1",
        mediaId: "media-video-1",
        mediaSource: "generated",
        preview: { url: "https://cdn.shortpulse.test/reference-video-poster.jpg" },
        previewStoragePath: null,
        fullStoragePath: null,
        promptText: null,
        preparedImageUrl: "https://signed.shortpulse.test/reference-video.mp4?token=fresh",
        loadBlob: async () => new Blob(["video"], { type: "video/mp4" }),
      })
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
        resolveInternalReferenceVideoDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      await result.current.handleMotionVideoDrop(
        createMotionDropEvent({
          mediaKind: "video",
          referenceId: "out-video-1",
          outputId: "out-video-1",
          origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
          referenceUrl: "https://cdn.shortpulse.test/reference-video-poster.jpg",
        })
      );
    });

    expect(resolveInternalReferenceVideoDropSource).toHaveBeenCalledTimes(1);
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
    expect(onMotionVideoChange).toHaveBeenCalledWith(
      "https://signed.shortpulse.test/reference-video.mp4?token=fresh"
    );
  });

  it("stages canvas tear-out videos from the internal durable resolver before stale payload urls", async () => {
    const onMotionVideoChange = vi.fn();
    const onStageMotionVideoSelection = vi.fn().mockResolvedValue(undefined);
    const resolveInternalReferenceVideoDropSource = vi.fn(
      async (): Promise<ResolvedInternalReferenceSource> => ({
        kind: "internal",
        sourceKind: "generated_output",
        sourceId: "source-video-1",
        provenance: {
          origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
          outputId: "out-video-1",
          mediaId: "media-video-1",
          imageIndex: 0,
          sourceSurface: "all-refs",
          resolutionReason: "output_storage_path",
        },
        outputId: "out-video-1",
        mediaId: "media-video-1",
        mediaSource: "generated",
        preview: { url: "https://cdn.shortpulse.test/stale-poster.jpg" },
        previewStoragePath: null,
        fullStoragePath: null,
        promptText: null,
        preparedImageUrl: "https://signed.shortpulse.test/durable-canvas-motion.mp4?token=fresh",
        loadBlob: async () => new Blob(["video"], { type: "video/mp4" }),
      })
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        onMotionVideoChange,
        onStageMotionVideoSelection,
        resolveInternalReferenceVideoDropSource,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      await result.current.acceptMotionVideoCanvasTearOutPayload(makeCanvasTearOutVideoPayload());
    });

    expect(resolveInternalReferenceVideoDropSource).toHaveBeenCalledTimes(1);
    expect(onStageMotionVideoSelection).toHaveBeenCalledWith({
      videoUrl: "https://signed.shortpulse.test/durable-canvas-motion.mp4?token=fresh",
    });
    expect(onMotionVideoChange).not.toHaveBeenCalled();
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

  it("stages storage-backed Media Library video drags for motion drops when only a poster URL is exposed", async () => {
    const onMotionVideoChange = vi.fn();
    const onStageMotionVideoSelection = vi.fn().mockResolvedValue(undefined);
    getSignedMediaUrlMock.mockResolvedValue(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user-1/library/source/reference-video-original?token=fresh"
    );

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

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        files: { length: 0, item: () => null } as unknown as FileList,
        types: [
          "text/shortpulse-media-library-marker",
          "text/shortpulse-media-library-kind",
          "text/shortpulse-media-library-id",
          "text/shortpulse-media-library-file-type",
          "text/shortpulse-media-library-url",
          "text/shortpulse-media-library-full-storage-path",
        ],
        getData: vi.fn((type: string) => {
          if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
          if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
          if (type === "text/shortpulse-media-library-id") return "media-video-storage";
          if (type === "text/shortpulse-media-library-file-type") return "video";
          if (type === "text/shortpulse-media-library-url")
            return "https://cdn.shortpulse.test/reference-poster.jpg";
          if (type === "text/shortpulse-media-library-full-storage-path")
            return "user-1/library/source/reference-video-original";
          return "";
        }),
      },
    } as unknown as Parameters<
      ReturnType<typeof useReferencePropertiesInteractions>["handleMotionVideoDrop"]
    >[0];

    await act(async () => {
      await result.current.handleMotionVideoDrop(event);
    });

    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/library/source/reference-video-original",
      previewProfile: "none",
    });
    expect(onStageMotionVideoSelection).toHaveBeenCalledWith({
      videoUrl:
        "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user-1/library/source/reference-video-original?token=fresh",
    });
    expect(onMotionVideoChange).not.toHaveBeenCalled();
  });

  it("signs storage-backed Media Library image drags for primary image drops", async () => {
    const onPrimaryImageChange = vi.fn();
    const syntheticFile = new File(["synthetic quick-slot image"], "quick-slot-image.png", {
      type: "image/png",
    });
    URL.createObjectURL = vi.fn(() => "blob:synthetic-quickslot-file");
    getSignedMediaUrlMock.mockResolvedValue(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user-1/library/images/character-original?token=fresh"
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange,
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    const event = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [syntheticFile] as unknown as FileList,
        types: [
          "Files",
          "text/shortpulse-media-library-marker",
          "text/shortpulse-media-library-kind",
          "text/shortpulse-media-library-id",
          "text/shortpulse-media-library-file-type",
          "text/shortpulse-media-library-url",
          "text/shortpulse-media-library-full-storage-path",
        ],
        getData: vi.fn((type: string) => {
          if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
          if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
          if (type === "text/shortpulse-media-library-id") return "media-image-storage";
          if (type === "text/shortpulse-media-library-file-type") return "image";
          if (type === "text/shortpulse-media-library-url")
            return "user-1/library/images/character-original";
          if (type === "text/shortpulse-media-library-full-storage-path")
            return "user-1/library/images/character-original";
          return "";
        }),
      },
    } as unknown as Parameters<
      ReturnType<typeof useReferencePropertiesInteractions>["handlePrimaryDrop"]
    >[0];

    await act(async () => {
      await result.current.handlePrimaryDrop(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/library/images/character-original",
      previewProfile: "none",
    });
    expect(onPrimaryImageChange).toHaveBeenCalledWith(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user-1/library/images/character-original?token=fresh"
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("resolves primary internal reference drops before synthetic browser files", async () => {
    const onPrimaryImageChange = vi.fn();
    const syntheticFile = new File(["synthetic reference-grid image"], "reference-grid.png", {
      type: "image/png",
    });
    URL.createObjectURL = vi.fn(() => "blob:synthetic-reference-grid-file");
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "out-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-reference-grid-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: "media-reference-grid-1",
      mediaSource: "generated" as const,
      preview: { url: "https://cdn.shortpulse.test/reference-grid-preview.png" },
      previewStoragePath: "user-1/generations/images/reference-grid-preview.png",
      fullStoragePath: "user-1/generations/images/reference-grid-full.png",
      promptText: null,
      preparedImageUrl: "https://cdn.shortpulse.test/reference-grid-durable.png",
      loadBlob: async () => new Blob(["durable"], { type: "image/png" }),
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

    const event = makeInternalReferenceDragEvent({
      mediaKind: "image",
      referenceUrl: "blob:temporary-reference-grid-render",
      imageUrl: "blob:temporary-reference-grid-render",
      files: [syntheticFile],
    });

    await act(async () => {
      await result.current.handlePrimaryDrop(event);
    });

    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(onPrimaryImageChange).toHaveBeenCalledWith(
      "https://cdn.shortpulse.test/reference-grid-durable.png"
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("stages Motion Control primary image file selections through reference-image upload", async () => {
    const onPrimaryImageChange = vi.fn();
    const file = new File(["large-image"], "large-character.png", { type: "image/png" });
    uploadImageBlobAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed.shortpulse.test/images/reference/staged-character.png",
      path: "user-1/reference-images/staged-character.png",
      size: 11,
    });
    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange,
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        stagePrimaryImageForProviderAccess: true,
        klingMultiPrompts: [],
        klingElements: [],
      })
    );
    const event = {
      target: {
        files: [file],
        value: "large-character.png",
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handlePrimaryFileSelection(event);
    });

    expect(uploadImageBlobAssetToStorageMock).toHaveBeenCalledWith(file);
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
    expect(onPrimaryImageChange).toHaveBeenCalledWith(
      "https://signed.shortpulse.test/images/reference/staged-character.png"
    );
    expect(event.target.value).toBe("");
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

  it("creates secondary display previews at a higher-fidelity slot-sized resolution", async () => {
    const extraImageUrls: (string | null)[] = [null, null, null];
    const onExtraImageChange = vi.fn((index: number, url: string | null) => {
      extraImageUrls[index] = url;
    });
    const bitmapClose = vi.fn();
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const drawImage = vi.fn();
    const encodedCanvases: Array<{
      width: number;
      height: number;
      mimeType: string;
      quality: number;
    }> = [];

    URL.createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:selected-file")
      .mockReturnValueOnce("blob:display-preview");
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      writable: true,
      value: vi.fn(async () => ({
        width: 4000,
        height: 3000,
        close: bitmapClose,
      })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        drawImage,
      })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      writable: true,
      value: vi.fn(function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        mimeType?: string,
        quality?: number
      ) {
        encodedCanvases.push({
          width: this.width,
          height: this.height,
          mimeType: mimeType ?? "",
          quality: quality ?? 0,
        });
        callback(new Blob(["display-preview"], { type: mimeType ?? "image/webp" }));
      }),
    });

    try {
      const { result, rerender } = renderHook(() =>
        useReferencePropertiesInteractions({
          referenceImageUrl: null,
          extraImageUrls,
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
        result.current.handleExtraFileSelection(0)(event as never);
        await Promise.resolve();
        await Promise.resolve();
      });
      rerender();

      expect(onExtraImageChange).toHaveBeenCalledWith(0, "blob:selected-file");
      expect(encodedCanvases).toEqual([
        {
          width: 224,
          height: 168,
          mimeType: "image/webp",
          quality: 0.82,
        },
      ]);
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 224, 168);
      expect(result.current.extraImageDisplayUrls[0]).toBe("blob:display-preview");
      expect(bitmapClose).toHaveBeenCalledTimes(1);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          writable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
        configurable: true,
        writable: true,
        value: originalToBlob,
      });
    }
  });

  it("accepts file-selected images when the browser omits MIME type", async () => {
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

    const file = new File(["secondary-ref"], "secondary.png", { type: "" });
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

  it("accepts file-selected images for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    uploadImageBlobAssetToStorageMock.mockResolvedValueOnce({
      url: "https://cdn.test/staged-seedance-slot.png",
      path: "user-1/reference-images/staged-seedance-slot.png",
      size: 14,
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const file = new File(["seedance-slot"], "seedance-slot.png", { type: "image/png" });
    const event = {
      target: {
        files: [file],
        value: "seedance-slot.png",
      },
    };

    await act(async () => {
      result.current.handleSeedanceElementMediaFileSelection(2)(event as never);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadImageBlobAssetToStorageMock).toHaveBeenCalledWith(file);
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(2, {
      kind: "image",
      url: "https://cdn.test/staged-seedance-slot.png",
      name: "seedance-slot.png",
    });
    expect(resolveInternalMediaRefForUrl("https://cdn.test/staged-seedance-slot.png")).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/reference-images/staged-seedance-slot.png",
      })
    );
  });

  it("accepts file-selected videos for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    uploadReferenceVideoFileToStorageMock.mockResolvedValueOnce({
      url: "https://cdn.test/staged-seedance-slot.mp4",
      path: "user-1/reference-videos/staged-seedance-slot.mp4",
      size: 140,
      mimeType: "video/mp4",
      name: "seedance-slot.mp4",
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const file = new File(["seedance-slot"], "seedance-slot.mp4", { type: "video/mp4" });
    const event = {
      target: {
        files: [file],
        value: "seedance-slot.mp4",
      },
    };

    await act(async () => {
      result.current.handleSeedanceElementMediaFileSelection(2)(event as never);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadReferenceVideoFileToStorageMock).toHaveBeenCalledWith(file);
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(2, {
      kind: "video",
      url: "https://cdn.test/staged-seedance-slot.mp4",
      name: "seedance-slot.mp4",
    });
    expect(resolveInternalMediaRefForUrl("https://cdn.test/staged-seedance-slot.mp4")).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/reference-videos/staged-seedance-slot.mp4",
      })
    );
  });

  it("accepts file-selected audio for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    uploadAudioBlobToStorageMock.mockResolvedValueOnce({
      url: "https://cdn.test/staged-seedance-slot.mp3",
      path: "user-1/reference-audio/staged-seedance-slot.mp3",
      size: 72,
      mimeType: "audio/mpeg",
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const file = new File(["seedance-audio"], "seedance-slot.mp3", { type: "audio/mpeg" });
    const event = {
      target: {
        files: [file],
        value: "seedance-slot.mp3",
      },
    };

    await act(async () => {
      result.current.handleSeedanceElementMediaFileSelection(2)(event as never);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadAudioBlobToStorageMock).toHaveBeenCalledWith(file, {
      sourceName: "seedance-slot.mp3",
      mimeType: "audio/mpeg",
    });
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(2, {
      kind: "audio",
      url: "https://cdn.test/staged-seedance-slot.mp3",
      name: "seedance-slot.mp3",
    });
    expect(resolveInternalMediaRefForUrl("https://cdn.test/staged-seedance-slot.mp3")).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/reference-audio/staged-seedance-slot.mp3",
      })
    );
  });

  it("does not create transient object URLs for Seedance slot file selections", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    const revokeObjectUrl = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:selected-file");
    URL.revokeObjectURL = revokeObjectUrl;
    uploadImageBlobAssetToStorageMock.mockResolvedValueOnce({
      url: "https://cdn.test/staged-seedance-slot.png",
      path: "user-1/reference-images/staged-seedance-slot.png",
      size: 14,
    });

    const { result, unmount } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const file = new File(["seedance-slot"], "seedance-slot.png", { type: "image/png" });
    const event = {
      target: {
        files: [file],
        value: "seedance-slot.png",
      },
    };

    await act(async () => {
      result.current.handleSeedanceElementMediaFileSelection(2)(event as never);
      await Promise.resolve();
      await Promise.resolve();
    });

    unmount();

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalledWith("blob:selected-file");
    expect(readRememberedObjectUrlBlob("blob:selected-file")).toBeNull();
  });

  it("accepts internal image drags for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-seedance-slot",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-seedance-slot",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-1",
      mediaId: "media-seedance-slot",
      mediaSource: "generated" as const,
      preparedImageUrl: "https://cdn.shortpulse.test/seedance-slot.png",
      preview: {
        url: "https://cdn.shortpulse.test/seedance-slot-preview.png",
        width: 1024,
        height: 1024,
        mimeType: "image/png",
      },
      previewStoragePath: "user/images/seedance-slot-preview.png",
      fullStoragePath: "user/images/seedance-slot-full.png",
      promptText: null,
      loadBlob: async () => new Blob(["image"], { type: "image/png" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
        resolveInternalReferenceImageDropSource,
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "image",
      referenceUrl: "https://cdn.shortpulse.test/seedance-slot.png",
    });

    await act(async () => {
      await result.current.handleSeedanceElementMediaDrop(3)(dropEvent);
    });

    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(3, {
      kind: "image",
      url: "https://cdn.shortpulse.test/seedance-slot.png",
    });
    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
  });

  it("accepts video drags for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        storagePath: "user-1/uploads/videos/copied-seedance-slot.mp4",
        fileSize: 128,
        delivery: {
          fullUrl: "https://signed.shortpulse.test/videos/copied-seedance-slot.mp4",
        },
      }),
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "video",
      referenceUrl: "https://cdn.shortpulse.test/seedance-slot.mp4",
    });

    await act(async () => {
      result.current.handleSeedanceElementMediaDrop(3)(dropEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dropEvent.preventDefault).toHaveBeenCalled();
    expect(dropEvent.stopPropagation).toHaveBeenCalled();
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(3, {
      kind: "video",
      url: "https://signed.shortpulse.test/videos/copied-seedance-slot.mp4",
      name: null,
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"mode":"video"'),
      })
    );
    expect(uploadReferenceVideoAssetToStorageMock).not.toHaveBeenCalled();
    expect(
      resolveInternalMediaRefForUrl(
        "https://signed.shortpulse.test/videos/copied-seedance-slot.mp4"
      )
    ).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/uploads/videos/copied-seedance-slot.mp4",
      })
    );
  });

  it("accepts audio drags for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        storagePath: "user-1/uploads/audio/copied-seedance-slot.mp3",
        fileSize: 64,
        delivery: {
          fullUrl: "https://signed.shortpulse.test/audio/copied-seedance-slot.mp3",
        },
      }),
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "audio",
      referenceUrl: "https://cdn.shortpulse.test/seedance-slot.mp3",
    });

    await act(async () => {
      result.current.handleSeedanceElementMediaDrop(3)(dropEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dropEvent.preventDefault).toHaveBeenCalled();
    expect(dropEvent.stopPropagation).toHaveBeenCalled();
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(3, {
      kind: "audio",
      url: "https://signed.shortpulse.test/audio/copied-seedance-slot.mp3",
      name: undefined,
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"mode":"audio"'),
      })
    );
    expect(uploadAudioBlobToStorageMock).not.toHaveBeenCalled();
    expect(
      resolveInternalMediaRefForUrl("https://signed.shortpulse.test/audio/copied-seedance-slot.mp3")
    ).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/uploads/audio/copied-seedance-slot.mp3",
      })
    );
  });

  it("accepts Quick Slot video drags for Seedance element slots through storage authority", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    getSignedMediaUrlMock.mockResolvedValueOnce(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/videos/quick-slot.mp4?token=fresh"
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "video",
      sourceSurface: "curated",
      referenceUrl: "https://cdn.shortpulse.test/quick-slot-stale.mp4",
      fullStoragePath: "user/videos/quick-slot.mp4",
    });

    await act(async () => {
      result.current.handleSeedanceElementMediaDrop(2)(dropEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(2, {
      kind: "video",
      url: "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/videos/quick-slot.mp4?token=fresh",
      name: undefined,
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(
      resolveInternalMediaRefForUrl(
        "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/videos/quick-slot.mp4?token=fresh"
      )
    ).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user/videos/quick-slot.mp4",
      })
    );
  });

  it("accepts Quick Slot audio drags for Seedance element slots through storage authority", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    getSignedMediaUrlMock.mockResolvedValueOnce(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/quick-slot.mp3?token=fresh"
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const dropEvent = makeInternalReferenceDragEvent({
      mediaKind: "audio",
      sourceSurface: "curated",
      referenceUrl: "https://cdn.shortpulse.test/quick-slot-stale.mp3",
      fullStoragePath: "user/audio/quick-slot.mp3",
    });

    await act(async () => {
      result.current.handleSeedanceElementMediaDrop(2)(dropEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(2, {
      kind: "audio",
      url: "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/quick-slot.mp3?token=fresh",
      name: undefined,
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(
      resolveInternalMediaRefForUrl(
        "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/quick-slot.mp3?token=fresh"
      )
    ).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user/audio/quick-slot.mp3",
      })
    );
  });

  it("resolves Seedance audio drags through fresh signed storage URLs when available", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    getSignedMediaUrlMock.mockResolvedValueOnce(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/reference.mp3?token=fresh"
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const dropEvent = createMotionDropEvent({
      mediaKind: "audio",
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      outputId: "audio-out-1",
      referenceUrl:
        "https://stale.shortpulse.test/storage/v1/object/sign/media_library/user/audio/reference.mp3?token=old",
      fullStoragePath: "user/audio/reference.mp3",
    });

    await act(async () => {
      result.current.handleSeedanceElementMediaDrop(3)(dropEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePath: "user/audio/reference.mp3",
        previewProfile: "none",
      });
    });
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(3, {
      kind: "audio",
      url: "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/reference.mp3?token=fresh",
      name: undefined,
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(uploadAudioBlobToStorageMock).not.toHaveBeenCalled();
  });

  it("uploads local audio file drops for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    uploadAudioBlobToStorageMock.mockResolvedValueOnce({
      url: "https://cdn.test/staged-dropped-seedance-slot.mp3",
      path: "user-1/reference-audio/staged-dropped-seedance-slot.mp3",
      size: 72,
      mimeType: "audio/mpeg",
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    const file = new File(["seedance-audio-drop"], "seedance-drop.mp3", {
      type: "audio/mpeg",
    });
    const dropEvent = createMotionDropEvent({ files: [file] });

    await act(async () => {
      result.current.handleSeedanceElementMediaDrop(3)(dropEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(uploadAudioBlobToStorageMock).toHaveBeenCalledWith(file, {
        sourceName: "seedance-drop.mp3",
        mimeType: "audio/mpeg",
      });
    });
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(3, {
      kind: "audio",
      url: "https://cdn.test/staged-dropped-seedance-slot.mp3",
      name: "seedance-drop.mp3",
    });
  });

  it("accepts canvas tear-out image payloads for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        storagePath: "user-1/reference-images/canvas-seedance-slot.png",
        fileSize: 18,
        delivery: {
          previewUrl: "https://signed.shortpulse.test/images/reference/canvas-seedance-slot.png",
        },
      }),
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    await act(async () => {
      result.current.acceptSeedanceElementMediaCanvasTearOutPayload(4, {
        kind: "image",
        internalPayload: null,
        composerImagePayload: {
          version: 1,
          origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
          referenceId: "canvas-seedance-slot",
          outputId: "canvas-seedance-slot",
          mediaId: "media-canvas-seedance-slot",
          displayArtifactUrl: "https://cdn.shortpulse.test/canvas-seedance-slot.png",
          displayArtifactKind: "url",
          referenceUrl: "https://cdn.shortpulse.test/canvas-seedance-slot.png",
          sourceSurface: "all-refs",
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("https://cdn.shortpulse.test/canvas-seedance-slot.png"),
      })
    );
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(4, {
      kind: "image",
      url: "https://signed.shortpulse.test/images/reference/canvas-seedance-slot.png",
    });
    expect(
      resolveInternalMediaRefForUrl(
        "https://signed.shortpulse.test/images/reference/canvas-seedance-slot.png"
      )
    ).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/reference-images/canvas-seedance-slot.png",
      })
    );
  });

  it("accepts canvas tear-out video payloads for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    getSignedMediaUrlMock.mockResolvedValueOnce(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/videos/canvas-motion.mp4?token=fresh"
    );
    const resolveInternalReferenceVideoDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-video-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-video-1",
        mediaId: "media-video-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-video-1",
      mediaId: "media-video-1",
      mediaSource: "generated" as const,
      preview: { url: "https://cdn.shortpulse.test/canvas-motion-poster.jpg" },
      previewStoragePath: null,
      fullStoragePath: "user/videos/canvas-motion.mp4",
      promptText: null,
      preparedImageUrl: "https://signed.shortpulse.test/canvas-motion.mp4?token=stale",
      loadBlob: async () => new Blob(["video"], { type: "video/mp4" }),
    }));

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
        resolveInternalReferenceVideoDropSource,
      })
    );

    await act(async () => {
      result.current.acceptSeedanceElementMediaCanvasTearOutPayload(
        4,
        makeCanvasTearOutVideoPayload()
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveInternalReferenceVideoDropSource).toHaveBeenCalledTimes(1);
    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(4, {
      kind: "video",
      url: "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/videos/canvas-motion.mp4?token=fresh",
      name: undefined,
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(uploadReferenceVideoAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("accepts canvas tear-out audio payloads for Seedance element slots", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        storagePath: "user-1/uploads/audio/copied-canvas-voice.mp3",
        fileSize: 96,
        delivery: {
          fullUrl: "https://signed.shortpulse.test/audio/copied-canvas-voice.mp3",
        },
      }),
    });

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    await act(async () => {
      result.current.acceptSeedanceElementMediaCanvasTearOutPayload(4, {
        kind: "audio",
        audioUrl: "https://cdn.shortpulse.test/canvas-voice.mp3",
        title: "Canvas voice",
        internalPayload: null,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(4, {
      kind: "audio",
      url: "https://signed.shortpulse.test/audio/copied-canvas-voice.mp3",
      name: "Canvas voice",
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"mode":"audio"'),
      })
    );
    expect(uploadAudioBlobToStorageMock).not.toHaveBeenCalled();
  });

  it("resolves canvas tear-out audio payloads through fresh signed storage URLs when available", async () => {
    const onSeedanceElementMediaSlotChange = vi.fn();
    getSignedMediaUrlMock.mockResolvedValueOnce(
      "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/canvas-voice.mp3?token=fresh"
    );

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange: vi.fn(),
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
        seedanceElementSlotCount: 6,
        onSeedanceElementMediaSlotChange,
      })
    );

    await act(async () => {
      result.current.acceptSeedanceElementMediaCanvasTearOutPayload(4, {
        kind: "audio",
        audioUrl: "https://stale.shortpulse.test/canvas-voice.mp3",
        audioStoragePath: "user/audio/canvas-voice.mp3",
        title: "Canvas voice",
        internalPayload: null,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSeedanceElementMediaSlotChange).toHaveBeenCalledWith(4, {
      kind: "audio",
      url: "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/canvas-voice.mp3?token=fresh",
      name: "Canvas voice",
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(
      resolveInternalMediaRefForUrl(
        "https://signed.shortpulse.test/storage/v1/object/sign/media_library/user/audio/canvas-voice.mp3?token=fresh"
      )
    ).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user/audio/canvas-voice.mp3",
      })
    );
  });

  it("accepts computer-dropped image files in the Motion Control character slot when MIME type is missing", async () => {
    const onPrimaryImageChange = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:dropped-primary");
    const file = new File(["character"], "character.png", { type: "" });
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [file],
        types: ["Files"],
        getData: vi.fn(() => ""),
      },
    } as unknown as Parameters<
      ReturnType<typeof useReferencePropertiesInteractions>["handlePrimaryDrop"]
    >[0];

    const { result } = renderHook(() =>
      useReferencePropertiesInteractions({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        onPrimaryImageChange,
        onExtraImageChange: vi.fn(),
        onPromptTextChange: vi.fn(),
        klingMultiPrompts: [],
        klingElements: [],
      })
    );

    await act(async () => {
      await result.current.handlePrimaryDrop(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onPrimaryImageChange).toHaveBeenCalledWith("blob:dropped-primary");
    expect(readRememberedObjectUrlBlob("blob:dropped-primary")).toBe(file);
  });

  it("stages file-selected motion videos before committing them, even when MIME type is missing", async () => {
    const onMotionVideoChange = vi.fn();
    const onStageMotionVideoSelection = vi.fn().mockResolvedValue(undefined);
    const file = new File(["motion"], "motion.webm", { type: "" });

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

  it("stages dropped local motion videos before committing them, even when MIME type is missing", async () => {
    const onMotionVideoChange = vi.fn();
    const onStageMotionVideoSelection = vi.fn().mockResolvedValue(undefined);
    const file = new File(["motion"], "motion.mp4", { type: "" });

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

  it("uses a local flattened render artifact in secondary slots when durable resolution fails", async () => {
    const onExtraImageChange = vi.fn();
    const flattenedBlob = new Blob(["secondary flattened"], { type: "image/png" });
    URL.createObjectURL = vi.fn(() => "blob:secondary-flattened-prepared");
    rememberObjectUrlBlob("blob:secondary-flattened-source", flattenedBlob);
    const resolveInternalReferenceImageDropSource = vi.fn().mockResolvedValue(null);

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

    const dropEvent = makeFlattenedComposerImageDropEvent();

    await act(async () => {
      await result.current.handleExtraDrop(0)(dropEvent);
    });

    expect(resolveInternalReferenceImageDropSource).not.toHaveBeenCalled();
    expect(onExtraImageChange).toHaveBeenCalledWith(0, "blob:secondary-flattened-prepared");
    expect(readRememberedObjectUrlBlob("blob:secondary-flattened-prepared")).toBe(flattenedBlob);
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

  it("registers the image-compatible storage ref for resolved internal image drops", async () => {
    const onExtraImageChange = vi.fn();
    const displayUrl = "https://example.com/durable-poster-preview.png";
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "source-image-slot-poster",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-image-slot-poster",
        mediaId: "media-image-slot-poster",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-image-slot-poster",
      mediaId: "media-image-slot-poster",
      mediaSource: "generated" as const,
      preview: { url: displayUrl },
      previewStoragePath: "user-1/variants/videos/out-video/poster_720.jpg",
      fullStoragePath: "user-1/generations/videos/out-video.mp4",
      promptText: null,
      preparedImageUrl: "https://example.com/generations/videos/out-video.mp4",
      loadBlob: async () => new Blob(["poster"], { type: "image/jpeg" }),
    }));

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
      referenceUrl: "blob:temporary-render",
      imageUrl: "blob:temporary-render",
    });

    await act(async () => {
      await result.current.handleExtraDrop(0)(dropEvent);
    });

    expect(onExtraImageChange).toHaveBeenCalledWith(0, displayUrl);
    expect(resolveInternalMediaRefForUrl(displayUrl)).toEqual({
      version: 1,
      kind: "storage_object",
      bucket: "media_library",
      storagePath: "user-1/variants/videos/out-video/poster_720.jpg",
      mediaFileId: "media-image-slot-poster",
    });
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
