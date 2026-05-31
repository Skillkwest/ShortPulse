import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";
import { useAiStudioPageMediaReferenceRuntime } from "../useAiStudioPageMediaReferenceRuntime";

type MockDualCanvasArgs = {
  resolveCanvasDropReference?: (payload: InternalReferenceDragPayload) => unknown;
  resolveCanvasDroppedMediaReference?: (payload: {
    url: string;
    mimeType?: string | null;
  }) => Promise<unknown> | unknown;
  resolveCanvasDropFiles?: (files: FileList) => Promise<unknown> | unknown;
};

vi.mock("../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

let latestDualCanvasArgs: MockDualCanvasArgs | null = null;

vi.mock("../../components/canvas/useAiStudioCanvasWorkspaceState", () => ({
  useAiStudioDualCanvasWorkspaceState: (args: MockDualCanvasArgs) => {
    latestDualCanvasArgs = args;
    return {
      railCanvasProps: {},
      sessionState: {
        items: [],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      },
      hydrateSessionState: vi.fn(),
    };
  },
}));

const makeOutput = (overrides: Partial<StudioOutput>): StudioOutput =>
  ({
    id: "output-1",
    prompt: "Reference clip",
    mode: "video",
    aspect: "16:9",
    model: "Test model",
    status: "ready",
    timestamp: "now",
    taskState: "success",
    mediaSource: "generated",
    resultUrls: [],
    savedMediaIds: [],
    ...overrides,
  }) as StudioOutput;

const makePayload = (
  overrides: Partial<InternalReferenceDragPayload> = {}
): InternalReferenceDragPayload => ({
  version: 1,
  origin: "ai-studio-reference-grid",
  referenceId: "output-1",
  outputId: "output-1",
  mediaId: null,
  imageIndex: 0,
  mediaKind: "video",
  referenceUrl: "https://signed.shortpulse.test/reference.mp4",
  referenceRenderUrl: "https://signed.shortpulse.test/reference.mp4",
  sourceSurface: "curated",
  ...overrides,
});

const makeFileList = (files: File[]): FileList =>
  ({
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  }) as unknown as FileList;

describe("useAiStudioPageMediaReferenceRuntime", () => {
  const defaultParams = {
    addCuratedReference: vi.fn(),
    addLibraryMediaReferenceToQuickSlot: vi.fn(async () => null),
    addLibraryPromptReferenceToQuickSlot: vi.fn(() => null),
    addPastedPromptReference: vi.fn(),
    insertPastedMediaReference: vi.fn(() => []),
    ingestReferenceFiles: vi.fn(async () => []),
    reorderCuratedReference: vi.fn(),
    setActiveOutputId: vi.fn(),
    setUiError: vi.fn(),
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    latestDualCanvasArgs = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves a storage-backed reference-grid video for the voice changer pipeline", async () => {
    const output = makeOutput({
      id: "output-video-1",
      prompt: "Launch cut",
      durationMs: 12_500,
      mimeType: "video/mp4",
      fullStoragePath: "user-1/generations/video/output-video-1/full.mp4",
      resultUrls: ["https://signed.shortpulse.test/reference-video.mp4"],
      savedMediaIds: ["media-video-1"],
    });

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolved = await result.current.resolveVoiceChangerInternalReferenceSource(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        referenceUrl: "https://signed.shortpulse.test/reference-video.mp4",
      })
    );

    expect(resolved).toMatchObject({
      kind: "video",
      origin: "reference-grid",
      name: "Launch cut",
      mimeType: "video/mp4",
      sourceUrl: "https://signed.shortpulse.test/reference-video.mp4",
      previewUrl: "https://signed.shortpulse.test/reference-video.mp4",
      storagePath: "user-1/generations/video/output-video-1/full.mp4",
      durationMs: 12_500,
      referenceOutputId: "output-video-1",
      referenceMediaId: "media-video-1",
    });
    expect(resolved?.file).toBeNull();
  });

  it("falls back to a browser file when a reference-grid video only has a local blob URL", async () => {
    const output = makeOutput({
      id: "output-local-video-1",
      prompt: "Local clip",
      durationMs: 8_000,
      mimeType: "video/mp4",
      localObjectUrl: "blob:https://shortpulse.test/local-video-1",
      previewUrl: "blob:https://shortpulse.test/local-video-1",
      savedMediaIds: ["media-local-video-1"],
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("blob:https://shortpulse.test/local-video-1");
      return {
        ok: true,
        blob: async () => new Blob(["video"], { type: "video/mp4" }),
      } as Response;
    }) as typeof fetch;

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolved = await result.current.resolveVoiceChangerInternalReferenceSource(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        referenceUrl: output.localObjectUrl,
        referenceRenderUrl: output.localObjectUrl,
      })
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(resolved).toMatchObject({
      kind: "video",
      origin: "reference-grid",
      referenceOutputId: "output-local-video-1",
      referenceMediaId: "media-local-video-1",
      durationMs: 8_000,
      storagePath: null,
    });
    expect(resolved?.file).toBeInstanceOf(File);
    expect(resolved?.file?.name).toBe("Local clip.mp4");
    expect(resolved?.file?.type).toBe("video/mp4");
  });

  it("projects direct dropped images into quick slot in target order", async () => {
    const addCuratedReference = vi.fn();
    const reorderCuratedReference = vi.fn();
    const setActiveOutputId = vi.fn();
    const fileA = new File(["a"], "a.png", { type: "image/png" });
    const fileB = new File(["b"], "b.png", { type: "image/png" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-a",
        payload: {
          id: "media-a",
          url: "https://cdn.shortpulse.test/a.png",
          fileType: "image" as const,
          filename: "a.png",
          promptText: "A",
        },
        output: makeOutput({
          id: "output-a",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/a.png",
        }),
        file: fileA,
      },
      {
        outputId: "output-b",
        payload: {
          id: "media-b",
          url: "https://cdn.shortpulse.test/b.png",
          fileType: "image" as const,
          filename: "b.png",
          promptText: "B",
        },
        output: makeOutput({
          id: "output-b",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/b.png",
        }),
        file: fileB,
      },
    ]);

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        addCuratedReference,
        getOutputById: () => null,
        ingestReferenceFiles,
        reorderCuratedReference,
        setActiveOutputId,
      })
    );

    const files = makeFileList([fileA, fileB]);

    const insertedIds = await result.current.handleQuickSlotDroppedFiles(files, {
      targetId: "target-1",
      placement: "before",
    });

    expect(ingestReferenceFiles).toHaveBeenCalledWith([fileA, fileB], "drop");
    expect(addCuratedReference).toHaveBeenCalledTimes(2);
    expect(addCuratedReference).toHaveBeenNthCalledWith(1, "output-b");
    expect(addCuratedReference).toHaveBeenNthCalledWith(2, "output-a");
    expect(reorderCuratedReference).toHaveBeenNthCalledWith(1, "output-b", "target-1", "before");
    expect(reorderCuratedReference).toHaveBeenNthCalledWith(2, "output-a", "output-b", "before");
    expect(setActiveOutputId).toHaveBeenCalledWith("output-b");
    expect(insertedIds).toEqual(["output-a", "output-b"]);
  });

  it("surfaces partial-rejection feedback for mixed quick-slot file drops", async () => {
    const imageFile = new File(["img"], "mixed.png", { type: "image/png" });
    const textFile = new File(["text"], "notes.txt", { type: "text/plain" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-mixed-1",
        payload: {
          id: "media-mixed-1",
          url: "https://cdn.shortpulse.test/mixed.png",
          fileType: "image" as const,
          filename: "mixed.png",
          promptText: "Mixed",
        },
        output: makeOutput({
          id: "output-mixed-1",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/mixed.png",
        }),
        file: imageFile,
      },
    ]);
    const setUiError = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
        setUiError,
      })
    );

    const insertedIds = await result.current.handleQuickSlotDroppedFiles(
      makeFileList([imageFile, textFile])
    );

    expect(ingestReferenceFiles).toHaveBeenCalledWith([imageFile], "drop");
    expect(setUiError).toHaveBeenCalledWith("Some files could not be added. The rest were added.");
    expect(insertedIds).toEqual(["output-mixed-1"]);
  });

  it("accepts direct dropped video files into quick slot", async () => {
    const videoFile = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-video-1",
        payload: {
          id: "media-video-1",
          url: "https://cdn.shortpulse.test/clip.mp4",
          fileType: "video" as const,
          filename: "clip.mp4",
          promptText: "Clip",
        },
        output: makeOutput({
          id: "output-video-1",
          mode: "video",
          prompt: "Clip",
          previewUrl: "https://cdn.shortpulse.test/clip.mp4",
          resultUrls: ["https://cdn.shortpulse.test/clip.mp4"],
        }),
        file: videoFile,
      },
    ]);

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
      })
    );

    const insertedIds = await result.current.handleQuickSlotDroppedFiles(makeFileList([videoFile]));

    expect(ingestReferenceFiles).toHaveBeenCalledWith([videoFile], "drop");
    expect(insertedIds).toEqual(["output-video-1"]);
  });

  it("projects dropped external media references into quick slot in target order", () => {
    const addCuratedReference = vi.fn();
    const reorderCuratedReference = vi.fn();
    const setActiveOutputId = vi.fn();
    const insertedOutput = makeOutput({
      id: "output-media-1",
      mode: "image",
      prompt: "External media",
      previewUrl: "https://cdn.shortpulse.test/external-media.png",
      resultUrls: ["https://cdn.shortpulse.test/external-media.png"],
      savedMediaIds: ["saved-media-1"],
    });
    const insertPastedMediaReference = vi.fn(() => [insertedOutput]);

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        addCuratedReference,
        getOutputById: () => null,
        insertPastedMediaReference,
        reorderCuratedReference,
        setActiveOutputId,
      })
    );

    const insertedId = result.current.handleQuickSlotDroppedMediaReference(
      {
        url: "https://cdn.shortpulse.test/external-media.png",
        mimeType: "image/png",
      },
      {
        targetId: "target-1",
        placement: "after",
      }
    );

    expect(insertPastedMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.shortpulse.test/external-media.png",
      mimeType: "image/png",
    });
    expect(addCuratedReference).toHaveBeenCalledWith("output-media-1");
    expect(reorderCuratedReference).toHaveBeenCalledWith("output-media-1", "target-1", "after");
    expect(setActiveOutputId).toHaveBeenCalledWith("output-media-1");
    expect(insertedId).toBe("output-media-1");
  });

  it("exposes a canvas file resolver that uploads dropped media through reference ingestion", async () => {
    const file = new File(["img"], "image-1.png", { type: "image/png" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-image-1",
        payload: {
          id: "media-image-1",
          url: "https://cdn.shortpulse.test/image-1.png",
          fileType: "image" as const,
          filename: "image-1.png",
          promptText: "Reference image",
        },
        output: makeOutput({
          id: "output-image-1",
          mode: "image",
          prompt: "Dropped image",
          previewUrl: "https://cdn.shortpulse.test/image-1.png",
          resultUrls: ["https://cdn.shortpulse.test/image-1.png"],
          savedMediaIds: ["saved-media-image-1"],
        }),
        file,
      },
    ]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
      })
    );

    const files = makeFileList([file]);

    const resolvedItems = await latestDualCanvasArgs?.resolveCanvasDropFiles?.(files);

    expect(ingestReferenceFiles).toHaveBeenCalledWith([file], "drop");
    expect(resolvedItems).toEqual([
      {
        kind: "image",
        outputId: "output-image-1",
        mediaId: "saved-media-image-1",
        src: "https://cdn.shortpulse.test/image-1.png",
        alt: "Dropped image",
      },
    ]);
  });

  it("falls back to hydrated output dimensions when a canvas reference drag omits dimensions", () => {
    const output = makeOutput({
      id: "output-image-dimensions",
      mode: "image",
      prompt: "Exact output",
      previewUrl: "https://cdn.shortpulse.test/exact-output.png",
      resultUrls: ["https://cdn.shortpulse.test/exact-output.png"],
      savedMediaIds: ["saved-media-image-1"],
      width: 1536,
      height: 1024,
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolvedItem = latestDualCanvasArgs?.resolveCanvasDropReference?.(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        mediaKind: "image",
        referenceUrl: "https://cdn.shortpulse.test/exact-output.png",
        width: undefined,
        height: undefined,
      })
    );

    expect(resolvedItem).toEqual({
      kind: "image",
      outputId: "output-image-dimensions",
      mediaId: "saved-media-image-1",
      src: "https://cdn.shortpulse.test/exact-output.png",
      alt: "Exact output",
      width: 1536,
      height: 1024,
      sourceSurface: "curated",
    });
  });

  it("resolves dropped video files into canvas video items", async () => {
    const file = new File(["video"], "clip-1.mp4", { type: "video/mp4" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-video-1",
        payload: {
          id: "media-video-1",
          url: "https://cdn.shortpulse.test/clip-1.mp4",
          fileType: "video" as const,
          filename: "clip-1.mp4",
          promptText: "Dropped video",
        },
        output: makeOutput({
          id: "output-video-1",
          mode: "video",
          prompt: "Dropped video",
          previewUrl: "https://cdn.shortpulse.test/clip-1.mp4",
          previewPosterUrl: "https://cdn.shortpulse.test/clip-1-poster.webp",
          resultUrls: ["https://cdn.shortpulse.test/clip-1.mp4"],
          savedMediaIds: ["saved-media-video-1"],
        }),
        file,
      },
    ]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
      })
    );

    const resolvedItems = await latestDualCanvasArgs?.resolveCanvasDropFiles?.(
      makeFileList([file])
    );

    expect(resolvedItems).toEqual([
      {
        kind: "video",
        outputId: "output-video-1",
        mediaId: "saved-media-video-1",
        videoUrl: "https://cdn.shortpulse.test/clip-1.mp4",
        posterUrl: "https://cdn.shortpulse.test/clip-1-poster.webp",
        title: "Dropped video",
        durationMs: null,
      },
    ]);
  });

  it("surfaces partial-rejection feedback for mixed canvas file drops", async () => {
    const imageFile = new File(["img"], "canvas-mixed.png", { type: "image/png" });
    const textFile = new File(["text"], "canvas-notes.txt", { type: "text/plain" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-canvas-mixed-1",
        payload: {
          id: "media-canvas-mixed-1",
          url: "https://cdn.shortpulse.test/canvas-mixed.png",
          fileType: "image" as const,
          filename: "canvas-mixed.png",
          promptText: "Canvas mixed",
        },
        output: makeOutput({
          id: "output-canvas-mixed-1",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/canvas-mixed.png",
          resultUrls: ["https://cdn.shortpulse.test/canvas-mixed.png"],
          savedMediaIds: ["saved-media-canvas-mixed-1"],
        }),
        file: imageFile,
      },
    ]);
    const setUiError = vi.fn();

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
        setUiError,
      })
    );

    const resolvedItems = await latestDualCanvasArgs?.resolveCanvasDropFiles?.(
      makeFileList([imageFile, textFile])
    );

    expect(ingestReferenceFiles).toHaveBeenCalledWith([imageFile], "drop");
    expect(setUiError).toHaveBeenCalledWith("Some files could not be added. The rest were added.");
    expect(resolvedItems).toEqual([
      {
        kind: "image",
        outputId: "output-canvas-mixed-1",
        mediaId: "saved-media-canvas-mixed-1",
        src: "https://cdn.shortpulse.test/canvas-mixed.png",
        alt: "Reference clip",
      },
    ]);
  });

  it("exposes a canvas dropped-media resolver that inserts into reference state first", async () => {
    const insertedOutput = makeOutput({
      id: "output-audio-1",
      mode: "audio",
      prompt: "Dropped audio",
      previewUrl: "https://cdn.shortpulse.test/dropped-audio.mp3",
      resultUrls: ["https://cdn.shortpulse.test/dropped-audio.mp3"],
      savedMediaIds: ["saved-audio-1"],
      companionArtUrl: "https://cdn.shortpulse.test/dropped-audio.webp",
      companionArtStoragePath: "user-1/audio/dropped-audio.webp",
      durationMs: 8_500,
      waveformPeaks: [5, 10, 15],
    });
    const insertPastedMediaReference = vi.fn(() => [insertedOutput]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        insertPastedMediaReference,
      })
    );

    const resolvedItem = await latestDualCanvasArgs?.resolveCanvasDroppedMediaReference?.({
      url: "https://cdn.shortpulse.test/dropped-audio.mp3",
      mimeType: "audio/mpeg",
    });

    expect(insertPastedMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.shortpulse.test/dropped-audio.mp3",
      mimeType: "audio/mpeg",
    });
    expect(resolvedItem).toEqual({
      kind: "audio",
      outputId: "output-audio-1",
      mediaId: "saved-audio-1",
      audioUrl: "https://cdn.shortpulse.test/dropped-audio.mp3",
      title: "Dropped audio",
      companionArtUrl: "https://cdn.shortpulse.test/dropped-audio.webp",
      companionArtStoragePath: "user-1/audio/dropped-audio.webp",
      audioSourceMode: null,
      durationMs: 8_500,
      waveformPeaks: [5, 10, 15],
      width: 160,
      height: 200,
    });
  });

  it("maps dropped external videos into canvas video items", async () => {
    const insertedOutput = makeOutput({
      id: "output-video-2",
      mode: "video",
      prompt: "Dropped video",
      previewUrl: "https://cdn.shortpulse.test/dropped-video.mp4",
      previewPosterUrl: "https://cdn.shortpulse.test/dropped-video-poster.webp",
      resultUrls: ["https://cdn.shortpulse.test/dropped-video.mp4"],
      savedMediaIds: ["saved-video-2"],
    });
    const insertPastedMediaReference = vi.fn(() => [insertedOutput]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        insertPastedMediaReference,
      })
    );

    const resolvedItem = await latestDualCanvasArgs?.resolveCanvasDroppedMediaReference?.({
      url: "https://cdn.shortpulse.test/dropped-video.mp4",
      mimeType: "video/mp4",
    });

    expect(resolvedItem).toEqual({
      kind: "video",
      outputId: "output-video-2",
      mediaId: "saved-video-2",
      videoUrl: "https://cdn.shortpulse.test/dropped-video.mp4",
      posterUrl: "https://cdn.shortpulse.test/dropped-video-poster.webp",
      title: "Dropped video",
      durationMs: null,
    });
  });
});
