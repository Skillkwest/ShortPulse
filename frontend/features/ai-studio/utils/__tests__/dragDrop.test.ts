/**
 * Drag/drop payload parsing tests for AI Studio.
 * Verifies internal reference drags prefer explicit reference URLs over ambient URI-list payloads.
 */
import { describe, expect, it, vi } from "vitest";
import {
  clearComposerImageDropSession,
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  registerComposerImageDropSession,
  resolveComposerImageDropSession,
} from "../../../../lib/internalReferenceDragSession";
import {
  clearDragState,
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
  extractDragDropPayload,
  extractPromptDropText,
  extractVideoDragDropPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  INTERNAL_REFERENCE_DRAG_ORIGIN,
  isImageDragTransfer,
  isVideoDragTransfer,
  looksLikeImageUrl,
  prepareReferenceDrag,
  resolveReferenceTransferUrl,
} from "../dragDrop";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const makeTransfer = (data: Record<string, string>): DataTransfer =>
  ({
    files: emptyFileList,
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

const makeTransferWithFiles = (data: Record<string, string>, files: File[]): DataTransfer =>
  ({
    files,
    types: ["Files", ...Object.keys(data)],
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

const makeDragEvent = () => {
  const dragNode = document.createElement("div");
  const transferData: Record<string, string> = {};
  const setData = vi.fn((type: string, value: string) => {
    transferData[type] = value;
  });
  const setDragImage = vi.fn();
  const event = {
    dataTransfer: {
      effectAllowed: "all",
      setData,
      getData: (type: string) => transferData[type] ?? "",
      get types() {
        return Object.keys(transferData);
      },
      files: emptyFileList,
      setDragImage,
    },
    currentTarget: dragNode,
  } as unknown as Parameters<typeof prepareReferenceDrag>[0];

  return { dragNode, setData, setDragImage, event, transferData };
};

describe("dragDrop payload extraction", () => {
  it("prefers text/reference-url for image drags when URI list points at the current page", () => {
    const transfer = makeTransfer({
      "text/reference-id": "ref-1",
      "text/reference-url": "https://cdn.example.com/reference-image.png",
      "text/uri-list": window.location.href,
      "text/plain": "cinematic portrait",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.referenceId).toBe("ref-1");
    expect(payload.imageUrl).toBe("https://cdn.example.com/reference-image.png");
    expect(payload.promptText).toBe("cinematic portrait");
  });

  it("extracts a dedicated composer image payload when present", () => {
    const transfer = makeTransfer({
      "application/x-shortpulse-composer-image-drop": JSON.stringify({
        version: 1,
        origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
        referenceId: "ref-1",
        outputId: "ref-1",
        mediaId: "media-1",
        displayArtifactUrl: "blob:artifact-preview",
        displayArtifactKind: "blob",
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
        promptText: "dragged prompt",
        sourceSurface: "all-refs",
      }),
    });

    const payload = extractComposerImageDropPayload(transfer);

    expect(payload).toMatchObject({
      referenceId: "ref-1",
      outputId: "ref-1",
      mediaId: "media-1",
      displayArtifactUrl: "blob:artifact-preview",
      displayArtifactKind: "blob",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      promptText: "dragged prompt",
      sourceSurface: "all-refs",
    });
  });

  it("extracts a dedicated composer image payload from the session token path", () => {
    const token = registerComposerImageDropSession({
      version: 1,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: "ref-1",
      outputId: "ref-1",
      mediaId: "media-1",
      displayArtifactUrl: "data:image/png;base64,abc123",
      displayArtifactKind: "data",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      promptText: "dragged prompt",
      sourceSurface: "curated",
    });

    const payload = extractComposerImageDropPayload(
      makeTransfer({
        [COMPOSER_IMAGE_DROP_SESSION_TYPE]: token,
        [COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE]: token,
      })
    );

    expect(payload).toMatchObject({
      referenceId: "ref-1",
      outputId: "ref-1",
      mediaId: "media-1",
      displayArtifactUrl: "data:image/png;base64,abc123",
      displayArtifactKind: "data",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      promptText: "dragged prompt",
      sourceSurface: "curated",
    });

    clearComposerImageDropSession(token);
  });

  it("prefers render snapshots over durable internal reference URLs for image previews", () => {
    const transfer = makeTransfer({
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-id": "ref-1",
      "text/reference-output-id": "ref-1",
      "text/reference-media-kind": "image",
      "text/reference-url": "https://cdn.example.com/reference-image.png",
      "text/reference-render-url": "data:image/jpeg;base64,render-snapshot",
      "text/plain": "cinematic portrait",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.referenceId).toBe("ref-1");
    expect(payload.imageUrl).toBe("data:image/jpeg;base64,render-snapshot");
    expect(payload.promptText).toBe("cinematic portrait");
  });

  it("uses text/reference-render-url when custom internal drag types are absent", () => {
    const transfer = makeTransfer({
      "text/reference-id": "ref-1",
      "text/reference-render-url": "https://cdn.example.com/reference-render.png",
      "text/reference-url": "https://cdn.example.com/reference-image.png",
      "text/plain": "cinematic portrait",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.referenceId).toBe("ref-1");
    expect(payload.imageUrl).toBe("https://cdn.example.com/reference-render.png");
    expect(payload.promptText).toBe("cinematic portrait");
  });

  it("preserves internal storage-path identity when custom drag session types are absent", () => {
    const transfer = makeTransfer({
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-id": "ref-1",
      "text/reference-output-id": "ref-1",
      "text/reference-media-id": "media-1",
      "text/reference-preview-storage-path": "user-1/generated/preview.png",
      "text/reference-full-storage-path": "user-1/generated/full.png",
      "text/reference-render-url":
        "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75",
    });

    const payload = extractInternalReferenceDragPayload(transfer);

    expect(payload).toEqual(
      expect.objectContaining({
        outputId: "ref-1",
        mediaId: "media-1",
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
      })
    );
  });

  it("prefers image/url over text/reference-url when richer preview fields are unavailable", () => {
    const transfer = makeTransfer({
      "text/reference-id": "ref-1",
      "text/reference-url": "https://cdn.example.com/reference-image.png",
      "image/url": "https://cdn.example.com/reference-preview.png",
      "text/plain": "cinematic portrait",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.referenceId).toBe("ref-1");
    expect(payload.imageUrl).toBe("https://cdn.example.com/reference-preview.png");
    expect(payload.promptText).toBe("cinematic portrait");
  });

  it("unwraps Next image optimizer URLs before extracting image payloads", () => {
    const encodedSourceUrl = encodeURIComponent("https://cdn.example.com/reference-image.png");
    const transfer = makeTransfer({
      "text/reference-id": "ref-1",
      "text/reference-url": `${window.location.origin}/_next/image?url=${encodedSourceUrl}&w=640&q=75`,
      "text/plain": "portrait notes",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.referenceId).toBe("ref-1");
    expect(payload.imageUrl).toBe("https://cdn.example.com/reference-image.png");
    expect(payload.promptText).toBe("portrait notes");
  });

  it("falls back to uri-list when no internal reference URL exists", () => {
    const transfer = makeTransfer({
      "text/uri-list": "https://example.com/image.webp",
      "text/plain": "https://example.com/image.webp",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.imageUrl).toBe("https://example.com/image.webp");
    expect(payload.promptText).toBeNull();
  });

  it("ignores video URLs for image-only drops", () => {
    const transfer = makeTransfer({
      "text/uri-list": "https://cdn.example.com/clip.mp4",
      "image/url": "https://cdn.example.com/clip.mp4",
      "text/plain": "https://cdn.example.com/clip.mp4",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.imageUrl).toBeNull();
    expect(payload.promptText).toBeNull();
  });

  it("prefers explicit prompt payloads over synthetic browser files for prompt-only drops", () => {
    const transfer = makeTransferWithFiles(
      {
        "text/plain": "Dragged prompt text",
        "text/prompt": "Dragged prompt text",
      },
      [new File(["ghost"], "ghost.png", { type: "image/png" })]
    );

    expect(extractPromptDropText(transfer)).toBe("Dragged prompt text");
  });

  it("keeps plain-text file drags out of prompt-only extraction without an explicit prompt type", () => {
    const transfer = makeTransferWithFiles(
      {
        "text/plain": "ghost.png",
      },
      [new File(["ghost"], "ghost.png", { type: "image/png" })]
    );

    expect(extractPromptDropText(transfer)).toBeNull();
  });

  it("ignores video references for image-only drops even when a poster image is present", () => {
    const transfer = makeTransfer({
      "text/reference-id": "ref-video-1",
      "text/reference-output-id": "ref-video-1",
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-media-kind": "video",
      "text/reference-url": "https://cdn.example.com/reference-video.mp4",
      "image/url": "https://cdn.example.com/reference-video-poster.jpg",
      "text/plain": "camera move",
    });

    const payload = extractDragDropPayload(transfer);

    expect(payload.referenceId).toBe("ref-video-1");
    expect(payload.imageUrl).toBeNull();
    expect(payload.mediaKind).toBe("video");
    expect(payload.promptText).toBe("camera move");
  });

  it("prefers text/reference-url for video drags when URI list points at the current page", () => {
    const transfer = makeTransfer({
      "text/reference-id": "ref-video-1",
      "text/reference-url": "https://cdn.example.com/reference-video.mp4",
      "text/uri-list": window.location.href,
      "text/plain": "camera move",
    });

    const payload = extractVideoDragDropPayload(transfer);

    expect(payload.referenceId).toBe("ref-video-1");
    expect(payload.videoUrl).toBe("https://cdn.example.com/reference-video.mp4");
    expect(payload.promptText).toBe("camera move");
  });

  it("accepts internal reference drags for video targets during dragover", () => {
    const transfer = makeTransfer({
      "text/reference-id": "ref-video-2",
      "text/reference-url": "",
      "text/uri-list": "",
      "text/plain": "",
    });

    expect(isVideoDragTransfer(transfer)).toBe(true);
  });

  it("detects internal reference drag hints from transfer types when dragover data is unavailable", () => {
    const transfer = makeTransfer({
      "text/reference-id": "",
      "text/reference-output-id": "",
      "text/reference-origin": "",
    });

    expect(hasInternalReferenceDragTypeHints(transfer)).toBe(true);
  });

  it("accepts internal reference drags for image targets during dragover", () => {
    const transfer = makeTransfer({
      "text/reference-id": "out-1",
      "text/reference-output-id": "out-1",
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-url": "",
      "text/reference-render-url": "",
    });

    expect(isImageDragTransfer(transfer)).toBe(true);
  });

  it("rejects internal video reference drags for image targets during dragover", () => {
    const transfer = makeTransfer({
      "text/reference-id": "out-video-1",
      "text/reference-output-id": "out-video-1",
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-media-kind": "video",
      "text/reference-url": "https://cdn.example.com/out-video-1.mp4",
      "image/url": "https://cdn.example.com/out-video-1-poster.jpg",
    });

    expect(isImageDragTransfer(transfer)).toBe(false);
  });

  it("caches normalized transfer types per transfer object", () => {
    const transfer = {
      types: [" Text/Plain ", "FILES", "text/reference-id"],
    } as unknown as DataTransfer;

    const firstPass = getNormalizedTransferTypes(transfer);
    const secondPass = getNormalizedTransferTypes(transfer);

    expect(firstPass).toEqual(["text/plain", "files", "text/reference-id"]);
    expect(secondPass).toBe(firstPass);
  });

  it("writes source-surface metadata for internal reference drags", () => {
    const { event, setData } = makeDragEvent();
    prepareReferenceDrag(
      event,
      {
        id: "ref-1",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        previewUrl: "https://example.com/ref-1.png",
      },
      { sourceSurface: "curated" }
    );

    expect(setData).toHaveBeenCalledWith("text/reference-origin", INTERNAL_REFERENCE_DRAG_ORIGIN);
    expect(setData).toHaveBeenCalledWith(
      INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
      expect.stringMatching(/^ref-drag-/)
    );
    expect(setData).toHaveBeenCalledWith(
      INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
      expect.stringMatching(/^ref-drag-/)
    );
    expect(setData).toHaveBeenCalledWith("text/reference-version", "1");
    expect(setData).toHaveBeenCalledWith("text/reference-output-id", "ref-1");
    expect(setData).toHaveBeenCalledWith("text/reference-image-index", "0");
    expect(setData).toHaveBeenCalledWith("text/reference-source-surface", "curated");
    expect(setData).toHaveBeenCalledWith("text/reference-media-kind", "image");
  });

  it("writes internal drag image dimensions when a rendered image is available", () => {
    const { event, dragNode, setData } = makeDragEvent();
    const image = document.createElement("img");
    image.className = "reference-card-image";
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 1600,
    });
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 900,
    });
    dragNode.appendChild(image);

    prepareReferenceDrag(event, {
      id: "ref-image-dims",
      prompt: "Prompt",
      mode: "image",
      aspect: "16:9",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-image-dims.png",
    });

    expect(setData).toHaveBeenCalledWith("text/reference-width", "1600");
    expect(setData).toHaveBeenCalledWith("text/reference-height", "900");
  });

  it("writes playable video reference URLs while preserving poster previews for video drags", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-video-poster",
      prompt: "Camera move",
      mode: "video",
      aspect: "16:9",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-video-poster.jpg",
      fullStoragePath: "https://example.com/ref-video-full.mp4",
      previewStoragePath: "https://example.com/ref-video-poster.jpg",
      resultUrls: ["https://example.com/ref-video-full.mp4"],
    });

    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://example.com/ref-video-full.mp4"
    );
    expect(setData).toHaveBeenCalledWith("text/uri-list", "https://example.com/ref-video-full.mp4");
    expect(setData).toHaveBeenCalledWith("image/url", "https://example.com/ref-video-poster.jpg");
    expect(setData).toHaveBeenCalledWith("text/reference-media-kind", "video");
  });

  it("normalizes internal drag storage payloads for poster-backed video drags", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-video-storage-contract",
      prompt: "Camera move",
      mode: "video",
      aspect: "16:9",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-video-poster.jpg",
      fullStoragePath: "user-1/generations/videos/ref-video-full.mp4",
      previewStoragePath: "user-1/variants/videos/ref-video/poster_720.jpg",
      resultUrls: ["https://example.com/ref-video-full.mp4"],
    });

    expect(setData).toHaveBeenCalledWith(
      "text/reference-preview-storage-path",
      "user-1/generations/videos/ref-video-full.mp4"
    );
    expect(setData).toHaveBeenCalledWith(
      "text/reference-full-storage-path",
      "user-1/generations/videos/ref-video-full.mp4"
    );

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];
    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload?.mediaKind).toBe("video");
    expect(payload?.previewStoragePath).toBe("user-1/generations/videos/ref-video-full.mp4");
    expect(payload?.fullStoragePath).toBe("user-1/generations/videos/ref-video-full.mp4");
  });

  it("writes playable audio reference URLs for audio drags", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-audio",
      prompt: "Voice sample",
      mode: "audio",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-audio-preview.mp3",
      fullStoragePath: "https://example.com/ref-audio-full.mp3",
      previewStoragePath: "https://example.com/ref-audio-preview.mp3",
      resultUrls: ["https://example.com/ref-audio-full.mp3"],
      savedMediaIds: ["media-audio-1"],
    });

    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://example.com/ref-audio-full.mp3"
    );
    expect(setData).toHaveBeenCalledWith("text/uri-list", "https://example.com/ref-audio-full.mp3");
    expect(setData).toHaveBeenCalledWith("text/reference-media-id", "media-audio-1");

    const payload = extractInternalReferenceDragPayload(event.dataTransfer);
    expect(payload?.referenceUrl).toBe("https://example.com/ref-audio-full.mp3");
    expect(payload?.mediaId).toBe("media-audio-1");
  });

  it("writes rendered-image transfer metadata for image drags", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragImageSrc = "blob:http://localhost:3000/ref-rendered-image";
    dragNode.dataset.dragPreviewUrl = "https://cdn.example.com/weaker-preview.png";

    prepareReferenceDrag(event, {
      id: "ref-rendered",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-rendered.png",
    });

    expect(setData.mock.calls.some(([type]) => type === "text/reference-render-url")).toBe(false);
    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://example.com/ref-rendered.png"
    );
    expect(setData).toHaveBeenCalledWith("image/url", "https://example.com/ref-rendered.png");

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];
    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload?.referenceRenderUrl).toBe("blob:http://localhost:3000/ref-rendered-image");
  });

  it("prefers rendered snapshot data URLs for style-intake transfer metadata", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragImageSrc = "blob:http://localhost:3000/ref-rendered-image";
    const image = document.createElement("img");
    image.className = "reference-card-image";
    image.setAttribute("src", "/reference.png");
    Object.defineProperty(image, "complete", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 768,
    });
    dragNode.appendChild(image);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: () => "data:image/jpeg;base64,drag-snapshot",
    });

    try {
      prepareReferenceDrag(event, {
        id: "ref-rendered-snapshot",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        previewUrl: "https://example.com/ref-rendered.png",
      });

      expect(setData.mock.calls.some(([type]) => type === "text/reference-render-url")).toBe(false);
      expect(setData).toHaveBeenCalledWith(
        "text/reference-url",
        "https://example.com/ref-rendered.png"
      );
      expect(setData).toHaveBeenCalledWith("image/url", "https://example.com/ref-rendered.png");

      const dragSessionToken = setData.mock.calls.find(
        ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
      )?.[1];
      const payload = extractInternalReferenceDragPayload({
        files: emptyFileList,
        types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
        getData: (type: string) =>
          type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
      } as unknown as DataTransfer);

      expect(payload?.referenceRenderUrl).toBe("data:image/jpeg;base64,drag-snapshot");
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalToDataUrl,
      });
    }
  });

  it("extracts versioned internal reference payload metadata", () => {
    const transfer = makeTransfer({
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-version": "1",
      "text/reference-id": "out-123",
      "text/reference-output-id": "out-123",
      "text/reference-image-index": "2",
      "text/reference-media-id": "media-123",
      "text/reference-source-surface": "all-refs",
      "text/reference-url": "https://cdn.example.com/out-123.png",
      "text/reference-render-url": "https://cdn.example.com/out-123-render.png",
    });

    const payload = extractInternalReferenceDragPayload(transfer);

    expect(payload).toEqual({
      version: 1,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: "out-123",
      outputId: "out-123",
      imageIndex: 2,
      mediaId: "media-123",
      referenceUrl: "https://cdn.example.com/out-123.png",
      referenceRenderUrl: "https://cdn.example.com/out-123-render.png",
      sourceSurface: "all-refs",
      sessionBacked: false,
    });
  });

  it("extracts internal reference payloads from same-document drag session tokens", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(
      event,
      {
        id: "out-token",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        previewUrl: "https://example.com/out-token.png",
        savedMediaIds: ["media-token"],
      },
      { sourceSurface: "all-refs" }
    );

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];
    expect(typeof dragSessionToken).toBe("string");

    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload).toEqual({
      version: 1,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: "out-token",
      outputId: "out-token",
      imageIndex: 0,
      mediaId: "media-token",
      mediaKind: "image",
      previewStoragePath: null,
      fullStoragePath: null,
      referenceUrl: "https://example.com/out-token.png",
      referenceRenderUrl: "https://example.com/out-token.png",
      sourceSurface: "all-refs",
      sessionBacked: true,
    });

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("extracts internal reference payloads from text drag session tokens", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(
      event,
      {
        id: "out-text-token",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        previewUrl: "https://example.com/out-text-token.png",
        savedMediaIds: ["media-text-token"],
      },
      { sourceSurface: "all-refs" }
    );

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE
    )?.[1];
    expect(typeof dragSessionToken).toBe("string");

    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload).toEqual({
      version: 1,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: "out-text-token",
      outputId: "out-text-token",
      imageIndex: 0,
      mediaId: "media-text-token",
      mediaKind: "image",
      previewStoragePath: null,
      fullStoragePath: null,
      referenceUrl: "https://example.com/out-text-token.png",
      referenceRenderUrl: "https://example.com/out-text-token.png",
      sourceSurface: "all-refs",
      sessionBacked: true,
    });

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("preserves rendered transfer urls alongside durable same-document drag session payloads", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragImageSrc = "data:image/jpeg;base64,generated-render";

    prepareReferenceDrag(
      event,
      {
        id: "out-render-session",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        previewUrl: "https://provider.example.com/generated.png",
      },
      { sourceSurface: "all-refs" }
    );

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];

    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload?.referenceUrl).toBe("https://provider.example.com/generated.png");
    expect(payload?.referenceRenderUrl).toBe("data:image/jpeg;base64,generated-render");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("exports a dedicated composer image payload from a provided display artifact", () => {
    vi.useFakeTimers();
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(
      event,
      {
        id: "out-composer-artifact",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
      },
      {
        sourceSurface: "curated",
        composerImageArtifact: {
          displayArtifactUrl: "blob:resolved-card-artifact",
          displayArtifactKind: "blob",
          promptText: "Dragged prompt",
          mediaId: "media-1",
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
        },
      }
    );

    const composerSessionToken = setData.mock.calls.find(
      ([type]) => type === COMPOSER_IMAGE_DROP_SESSION_TYPE
    )?.[1];
    const payload = extractComposerImageDropPayload({
      files: emptyFileList,
      types: [COMPOSER_IMAGE_DROP_SESSION_TYPE],
      getData: (type: string) =>
        type === COMPOSER_IMAGE_DROP_SESSION_TYPE ? composerSessionToken : "",
    } as unknown as DataTransfer);

    expect(composerSessionToken).toBeTruthy();
    expect(
      setData.mock.calls.some(
        ([type, value]) => type === "application/x-shortpulse-composer-image-drop" && value
      )
    ).toBe(false);
    expect(
      setData.mock.calls.some(
        ([type, value]) => type === "image/url" && value === "blob:resolved-card-artifact"
      )
    ).toBe(false);
    expect(resolveComposerImageDropSession(composerSessionToken)?.displayArtifactUrl).toBe(
      "blob:resolved-card-artifact"
    );
    expect(payload).toMatchObject({
      referenceId: "out-composer-artifact",
      outputId: "out-composer-artifact",
      mediaId: "media-1",
      displayArtifactUrl: "blob:resolved-card-artifact",
      displayArtifactKind: "blob",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      promptText: "Dragged prompt",
      sourceSurface: "curated",
    });

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
    expect(resolveComposerImageDropSession(composerSessionToken)?.displayArtifactUrl).toBe(
      "blob:resolved-card-artifact"
    );
    vi.runAllTimers();
    expect(resolveComposerImageDropSession(composerSessionToken)).toBeNull();
    vi.useRealTimers();
  });

  it("prefers a drag-time snapshot thumbnail for composer image payloads when available", () => {
    vi.useFakeTimers();
    const { event, dragNode, setData } = makeDragEvent();
    const image = document.createElement("img");
    image.className = "reference-card-image";
    image.setAttribute("src", "/reference.png");
    Object.defineProperty(image, "complete", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 768,
    });
    dragNode.appendChild(image);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: () => "data:image/jpeg;base64,composer-chip-snapshot",
    });

    try {
      prepareReferenceDrag(
        event,
        {
          id: "out-composer-snapshot",
          prompt: "Prompt",
          mode: "image",
          aspect: "1:1",
          model: "Model",
          status: "ready",
          timestamp: "Now",
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
        },
        {
          sourceSurface: "curated",
          composerImageArtifact: {
            displayArtifactUrl: "blob:resolved-card-artifact",
            displayArtifactKind: "blob",
            promptText: "Dragged prompt",
            mediaId: "media-1",
            previewStoragePath: "user-1/generated/preview.png",
            fullStoragePath: "user-1/generated/full.png",
          },
        }
      );

      const composerSessionToken = setData.mock.calls.find(
        ([type]) => type === COMPOSER_IMAGE_DROP_SESSION_TYPE
      )?.[1];
      const payload = extractComposerImageDropPayload({
        files: emptyFileList,
        types: [COMPOSER_IMAGE_DROP_SESSION_TYPE],
        getData: (type: string) =>
          type === COMPOSER_IMAGE_DROP_SESSION_TYPE ? composerSessionToken : "",
      } as unknown as DataTransfer);

      expect(resolveComposerImageDropSession(composerSessionToken)?.displayArtifactUrl).toBe(
        "data:image/jpeg;base64,composer-chip-snapshot"
      );
      expect(payload).toMatchObject({
        displayArtifactUrl: "data:image/jpeg;base64,composer-chip-snapshot",
        displayArtifactKind: "data",
      });
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalToDataUrl,
      });
      clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
      vi.runAllTimers();
      vi.useRealTimers();
    }
  });

  it("does not export raw provider urls for generated outputs without storage authority", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragImageSrc = "data:image/jpeg;base64,generated-render";

    prepareReferenceDrag(
      event,
      {
        id: "out-generated-tracked",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        mediaSource: "generated",
        generationId: "gen-1",
        previewUrl: "https://provider.example.com/generated.png",
      },
      { sourceSurface: "all-refs" }
    );

    expect(setData).not.toHaveBeenCalledWith(
      "text/reference-url",
      "https://provider.example.com/generated.png"
    );
    expect(setData.mock.calls.some(([type]) => type === "image/url")).toBe(false);

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];
    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload?.outputId).toBe("out-generated-tracked");
    expect(payload?.referenceUrl).toBeNull();
    expect(payload?.referenceRenderUrl).toBe("data:image/jpeg;base64,generated-render");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("keeps generated saved-media-only drags identity-only when output storage paths are absent", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(
      event,
      {
        id: "out-generated-saved-only",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        mediaSource: "generated",
        generationId: "gen-saved-only",
        savedMediaIds: ["media-generated-1"],
        previewUrl: "https://provider.example.com/generated-saved-only.png",
      },
      { sourceSurface: "all-refs" }
    );

    expect(setData).not.toHaveBeenCalledWith(
      "text/reference-url",
      "https://provider.example.com/generated-saved-only.png"
    );
    expect(setData).not.toHaveBeenCalledWith("image/url", expect.any(String));

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];
    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload?.outputId).toBe("out-generated-saved-only");
    expect(payload?.mediaId).toBe("media-generated-1");
    expect(payload?.referenceUrl).toBeNull();
    expect(payload?.referenceRenderUrl).toBeNull();

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("exports storage-path fallback fields for storage-backed generated outputs", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(
      event,
      {
        id: "out-storage-backed",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        mediaSource: "generated",
        generationId: "gen-storage-backed",
        previewUrl: "https://provider.example.com/storage-backed.png",
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
      },
      { sourceSurface: "all-refs" }
    );

    expect(setData).toHaveBeenCalledWith(
      "text/reference-preview-storage-path",
      "user-1/generated/preview.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "text/reference-full-storage-path",
      "user-1/generated/full.png"
    );

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("keeps same-origin rendered previews available for tracked generated drags without exporting provider urls", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragImageSrc =
      "/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75";

    prepareReferenceDrag(
      event,
      {
        id: "out-generated-render-only",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        mediaSource: "generated",
        generationId: "gen-render-only",
        previewUrl: "https://provider.example.com/generated-render-only.png",
      },
      { sourceSurface: "all-refs" }
    );

    expect(setData).not.toHaveBeenCalledWith(
      "text/reference-url",
      "https://provider.example.com/generated-render-only.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "image/url",
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75"
    );
    expect(setData).toHaveBeenCalledWith(
      "text/reference-render-url",
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75"
    );

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];
    const payload = extractInternalReferenceDragPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload?.outputId).toBe("out-generated-render-only");
    expect(payload?.referenceUrl).toBeNull();
    expect(payload?.referenceRenderUrl).toBe(
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75"
    );

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("keeps rendered snapshot data urls available for tracked generated drags when no durable url can be exported", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    const image = document.createElement("img");
    image.className = "reference-card-image";
    image.setAttribute("src", "/reference.png");
    Object.defineProperty(image, "complete", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 768,
    });
    dragNode.appendChild(image);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: () => "data:image/jpeg;base64,tracked-generated-snapshot",
    });

    try {
      prepareReferenceDrag(
        event,
        {
          id: "out-generated-data-render",
          prompt: "Prompt",
          mode: "image",
          aspect: "1:1",
          model: "Model",
          status: "ready",
          timestamp: "Now",
          mediaSource: "generated",
          generationId: "gen-data-render",
          previewUrl: "https://provider.example.com/generated-data-render.png",
        },
        { sourceSurface: "all-refs" }
      );

      expect(setData).not.toHaveBeenCalledWith(
        "text/reference-url",
        "https://provider.example.com/generated-data-render.png"
      );
      expect(setData.mock.calls.some(([type]) => type === "image/url")).toBe(false);
      expect(setData.mock.calls.some(([type]) => type === "text/reference-render-url")).toBe(false);

      const dragSessionToken = setData.mock.calls.find(
        ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
      )?.[1];
      const payload = extractInternalReferenceDragPayload({
        files: emptyFileList,
        types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
        getData: (type: string) =>
          type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
      } as unknown as DataTransfer);

      expect(payload?.referenceRenderUrl).toBe("data:image/jpeg;base64,tracked-generated-snapshot");
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalToDataUrl,
      });
      clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
    }
  });

  it("keeps saved-media render urls available after project reload without exporting provider urls", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragImageSrc = "https://storage.example.com/signed/project-media-preview.png";

    prepareReferenceDrag(
      event,
      {
        id: "out-generated-reloaded",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        mediaSource: "generated",
        generationId: "gen-reloaded",
        savedMediaIds: ["media-generated-1"],
        previewUrl: "https://provider.example.com/generated-reloaded.png",
      },
      { sourceSurface: "all-refs" }
    );

    expect(setData).not.toHaveBeenCalledWith(
      "text/reference-url",
      "https://provider.example.com/generated-reloaded.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "image/url",
      "https://storage.example.com/signed/project-media-preview.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "text/reference-render-url",
      "https://storage.example.com/signed/project-media-preview.png"
    );

    const dragSessionToken = setData.mock.calls.find(
      ([type]) => type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE
    )?.[1];
    const payload = extractDragDropPayload({
      files: emptyFileList,
      types: [INTERNAL_REFERENCE_DRAG_SESSION_TYPE],
      getData: (type: string) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE ? dragSessionToken : "",
    } as unknown as DataTransfer);

    expect(payload.referenceId).toBe("out-generated-reloaded");
    expect(payload.imageUrl).toBe("https://storage.example.com/signed/project-media-preview.png");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("continues exporting direct urls for storage-backed generated outputs", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(
      event,
      {
        id: "out-generated-storage",
        prompt: "Prompt",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        mediaSource: "generated",
        generationId: "gen-2",
        previewStoragePath: "https://example.com/storage-preview.png",
        fullStoragePath: "https://example.com/storage-full.png",
      },
      { sourceSurface: "all-refs" }
    );

    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://example.com/storage-full.png"
    );
    expect(setData).toHaveBeenCalledWith("image/url", "https://example.com/storage-full.png");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("extracts optional dimension metadata from internal reference payloads", () => {
    const transfer = makeTransfer({
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-version": "1",
      "text/reference-id": "out-123",
      "text/reference-output-id": "out-123",
      "text/reference-width": "1920",
      "text/reference-height": "1080",
    });

    const payload = extractInternalReferenceDragPayload(transfer);

    expect(payload?.width).toBe(1920);
    expect(payload?.height).toBe(1080);
  });

  it("ignores invalid internal reference dimension metadata", () => {
    const transfer = makeTransfer({
      "text/reference-origin": INTERNAL_REFERENCE_DRAG_ORIGIN,
      "text/reference-version": "1",
      "text/reference-id": "out-123",
      "text/reference-output-id": "out-123",
      "text/reference-width": "nope",
      "text/reference-height": "-20",
    });

    const payload = extractInternalReferenceDragPayload(transfer);

    expect(payload).toBeTruthy();
    expect(payload?.width).toBeUndefined();
    expect(payload?.height).toBeUndefined();
  });

  it("supports legacy internal payloads without explicit origin metadata", () => {
    const transfer = makeTransfer({
      "text/reference-id": "legacy-1",
      "text/reference-source-surface": "curated",
      "text/reference-url": "https://cdn.example.com/legacy-1.png",
    });

    const payload = extractInternalReferenceDragPayload(transfer);

    expect(payload?.origin).toBe(INTERNAL_REFERENCE_DRAG_ORIGIN);
    expect(payload?.outputId).toBe("legacy-1");
    expect(payload?.referenceId).toBe("legacy-1");
    expect(payload?.sourceSurface).toBe("curated");
    expect(payload?.sessionBacked).toBe(false);
  });

  it("accepts internal output-id/media-id hints even when origin metadata is absent", () => {
    const transfer = makeTransfer({
      "text/reference-output-id": "out-456",
      "text/reference-media-id": "media-456",
      "text/reference-url": "https://cdn.example.com/out-456.png",
    });

    const payload = extractInternalReferenceDragPayload(transfer);

    expect(payload?.origin).toBe(INTERNAL_REFERENCE_DRAG_ORIGIN);
    expect(payload?.outputId).toBe("out-456");
    expect(payload?.mediaId).toBe("media-456");
    expect(payload?.sessionBacked).toBe(false);
  });

  it("accepts relative image-like paths", () => {
    expect(looksLikeImageUrl("/storage/v1/object/public/media/image.webp?token=1")).toBe(true);
    expect(looksLikeImageUrl("/storage/v1/object/public/media/clip.mp4")).toBe(false);
  });

  it("renders image drag ghosts as media-only without prompt/footer text", () => {
    const { event, setDragImage } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-image-media-only",
      prompt: "Prompt should not appear in media ghost",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-image-media-only.png",
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(ghost?.querySelector("img")).toBeTruthy();
    expect(ghost?.textContent?.trim()).toBe("");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("prefers rendered image sources from card dataset for drag ghosts", () => {
    const { event, dragNode, setDragImage } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragImageSrc = `${window.location.origin}/rendered-image.png`;
    dragNode.dataset.dragPreviewUrl = `${window.location.origin}/rendered-preview.png`;

    prepareReferenceDrag(event, {
      id: "ref-image-rendered-priority",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: `${window.location.origin}/canonical-image.png`,
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    const renderedImageNode = ghost?.querySelector("img") as HTMLImageElement | null;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(renderedImageNode).toBeTruthy();
    expect(renderedImageNode?.getAttribute("src")).toBe(
      `${window.location.origin}/rendered-image.png`
    );

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("prefers rendered image URLs over weaker preview URLs for transfer payload image/url", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragPreviewUrl = `${window.location.origin}/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fsigned.png&w=512&q=75`;
    dragNode.dataset.dragImageSrc = "https://cdn.example.com/rendered-current-src.png";

    prepareReferenceDrag(event, {
      id: "ref-priority-1",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://cdn.example.com/output-preview.png",
    });

    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://cdn.example.com/output-preview.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "image/url",
      "https://cdn.example.com/rendered-current-src.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "text/reference-render-url",
      "https://cdn.example.com/rendered-current-src.png"
    );
  });

  it("keeps drag ghosts at a 4:5 aspect ratio", () => {
    const { event, setDragImage } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-image-ratio-check",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-image-ratio-check.png",
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(ghost).toBeInstanceOf(HTMLElement);
    const ghostWidth = Number.parseFloat(ghost?.style.width ?? "0");
    const ghostHeight = Number.parseFloat(ghost?.style.height ?? "0");
    expect(ghostWidth).toBeGreaterThan(0);
    expect(ghostHeight).toBeGreaterThan(0);
    expect(Math.round((ghostWidth / ghostHeight) * 100)).toBe(80);

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("uses prompt text when no image source is available for image drags", () => {
    const { event, dragNode, setDragImage } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";

    prepareReferenceDrag(event, {
      id: "ref-image-text-fallback",
      prompt: "Fallback prompt text",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: undefined,
      previewStoragePath: undefined,
      fullStoragePath: undefined,
      resultUrls: [],
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(ghost?.querySelector("img")).toBeNull();
    expect(ghost?.textContent).toContain("Fallback prompt text");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("renders video drag ghosts from thumbnail candidates without prompt/footer text", () => {
    const { event, setDragImage } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-video-thumb",
      prompt: "Camera move prompt should not appear",
      mode: "video",
      aspect: "16:9",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-video-thumb.mp4",
      previewStoragePath: "https://example.com/ref-video-thumb.jpg",
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(ghost?.querySelector("img")).toBeTruthy();
    expect(ghost?.textContent?.trim()).toBe("");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("renders video drag ghosts without thumbnails as blank media tiles", () => {
    const { event, setDragImage } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-video-blank",
      prompt: "No text should appear",
      mode: "video",
      aspect: "16:9",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-video-blank.mp4",
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(ghost?.querySelector("img")).toBeNull();
    expect(ghost?.children.length).toBeGreaterThan(0);
    expect(ghost?.textContent?.trim()).toBe("");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("keeps prompt-only drag ghosts text-based when no media is available", () => {
    const { event, setDragImage } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-prompt-only",
      prompt: "Prompt-only ghost text",
      mode: "text",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(ghost?.querySelector("img")).toBeNull();
    expect(ghost?.textContent).toContain("Prompt-only ghost text");

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("removes selected-card action controls from the drag ghost preview", () => {
    const dragNode = document.createElement("div");
    dragNode.className = "reference-card is-active";
    dragNode.innerHTML = `
      <img class="reference-card-image" src="https://example.com/ref.png" alt="" />
      <div class="reference-card-actions">
        <button type="button" class="reference-card-action-btn">Delete</button>
      </div>
      <button type="button" class="reference-generate-pill">Generate</button>
    `;

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const event = {
      dataTransfer: {
        effectAllowed: "all",
        setData,
        setDragImage,
      },
      currentTarget: dragNode,
    } as unknown as Parameters<typeof prepareReferenceDrag>[0];

    prepareReferenceDrag(event, {
      id: "ref-ghost-1",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-ghost-1.png",
    });

    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(ghost?.classList.contains("is-active")).toBe(false);
    expect(ghost?.querySelector(".reference-card-actions")).toBeNull();
    expect(ghost?.querySelector(".reference-generate-pill")).toBeNull();
    expect(ghost?.querySelector("button")).toBeNull();

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("keeps drag payload stable when custom drag image API throws", () => {
    const dragNode = document.createElement("div");
    dragNode.className = "reference-card is-active";
    const setData = vi.fn();
    const setDragImage = vi.fn(() => {
      throw new Error("drag image not supported");
    });
    const event = {
      dataTransfer: {
        effectAllowed: "all",
        setData,
        setDragImage,
      },
      currentTarget: dragNode,
    } as unknown as Parameters<typeof prepareReferenceDrag>[0];

    expect(() =>
      prepareReferenceDrag(event, {
        id: "ref-fallback-1",
        prompt: "Prompt fallback",
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        previewUrl: "https://example.com/ref-fallback-1.png",
      })
    ).not.toThrow();

    expect(setData).toHaveBeenCalledWith("text/reference-id", "ref-fallback-1");
    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://example.com/ref-fallback-1.png"
    );
    expect(setDragImage).toHaveBeenCalledTimes(1);
    expect(dragNode.classList.contains("is-dragging")).toBe(true);

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("applies dragging class before setDragImage snapshot is taken", () => {
    const dragNode = document.createElement("div");
    let hadDraggingClassAtSnapshot = false;
    const event = {
      dataTransfer: {
        effectAllowed: "all",
        setData: vi.fn(),
        setDragImage: vi.fn(() => {
          hadDraggingClassAtSnapshot = dragNode.classList.contains("is-dragging");
        }),
      },
      currentTarget: dragNode,
    } as unknown as Parameters<typeof prepareReferenceDrag>[0];

    prepareReferenceDrag(event, {
      id: "ref-snapshot-order",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/ref-snapshot-order.png",
    });

    expect(hadDraggingClassAtSnapshot).toBe(true);

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("uses storage/full URL fallbacks when previewUrl is missing during internal drags", () => {
    const setData = vi.fn();
    const event = {
      dataTransfer: {
        effectAllowed: "all",
        setData,
        setDragImage: vi.fn(),
      },
      currentTarget: document.createElement("div"),
    } as unknown as Parameters<typeof prepareReferenceDrag>[0];

    prepareReferenceDrag(event, {
      id: "ref-2",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: undefined,
      fullStoragePath: "https://example.com/fallback-full.png",
      previewStoragePath: "https://example.com/fallback-preview.png",
      resultUrls: ["https://example.com/fallback-result.png"],
    });

    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://example.com/fallback-full.png"
    );
    expect(setData).toHaveBeenCalledWith("image/url", "https://example.com/fallback-full.png");
  });

  it("preserves root-relative preview URLs in internal drag payloads for image outputs", () => {
    const { event, setData } = makeDragEvent();

    prepareReferenceDrag(event, {
      id: "ref-relative-preview",
      prompt: "",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "/api/media/preview?id=123",
    });

    expect(setData).toHaveBeenCalledWith("text/reference-url", "/api/media/preview?id=123");
    expect(setData).toHaveBeenCalledWith("image/url", "/api/media/preview?id=123");
  });

  it("keeps durable reference URLs separate from rendered Next image candidates", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragPreviewUrl = "https://cdn.example.com/weaker-preview.png";
    const renderedImageUrl =
      "/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    dragNode.dataset.dragImageSrc = renderedImageUrl;

    prepareReferenceDrag(event, {
      id: "ref-render-priority",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://cdn.example.com/direct-signed.png",
    });

    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "https://cdn.example.com/direct-signed.png"
    );
    expect(setData).toHaveBeenCalledWith("image/url", `http://localhost:3000${renderedImageUrl}`);
    expect(setData).toHaveBeenCalledWith(
      "text/reference-render-url",
      `http://localhost:3000${renderedImageUrl}`
    );
  });

  it("extracts rendered image candidates from same-document drag sessions", () => {
    const { event, dragNode } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    const renderedImageUrl =
      "/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    dragNode.dataset.dragImageSrc = renderedImageUrl;

    prepareReferenceDrag(event, {
      id: "ref-session-render-priority",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://cdn.example.com/direct-signed.png",
    });

    expect(extractDragDropPayload(event.dataTransfer)).toEqual(
      expect.objectContaining({
        imageUrl: `http://localhost:3000${renderedImageUrl}`,
        referenceId: "ref-session-render-priority",
        mediaKind: "image",
      })
    );
  });

  it("resolves best transfer URL in priority order", () => {
    const resolved = resolveReferenceTransferUrl(
      {
        previewUrl: "",
        fullStoragePath: "https://example.com/full.png",
        previewStoragePath: "https://example.com/preview.png",
        resultUrls: ["https://example.com/result.png"],
      },
      "image"
    );

    expect(resolved).toBe("https://example.com/full.png");
  });

  it("prefers durable storage video URLs over blob preview URLs", () => {
    const resolved = resolveReferenceTransferUrl(
      {
        previewUrl: "blob:http://localhost:3000/transient-preview-video",
        fullStoragePath: "https://example.com/final-video.mp4",
        previewStoragePath: "https://example.com/preview-video.mp4",
        resultUrls: [],
      },
      "video"
    );

    expect(resolved).toBe("https://example.com/final-video.mp4");
  });

  it("ignores non-renderable storage keys and falls back to renderable video URLs", () => {
    const resolved = resolveReferenceTransferUrl(
      {
        previewUrl: "https://example.com/signed-preview-video.mp4",
        fullStoragePath: "82004e53-a9bd-48c8-85ff-20dbeb658d21/generations/videos/final.mp4",
        previewStoragePath: "82004e53-a9bd-48c8-85ff-20dbeb658d21/generations/videos/preview.mp4",
        resultUrls: [],
      },
      "video"
    );

    expect(resolved).toBe("https://example.com/signed-preview-video.mp4");
  });
});
