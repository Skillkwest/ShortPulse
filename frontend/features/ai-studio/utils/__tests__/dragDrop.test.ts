/**
 * Drag/drop payload parsing tests for AI Studio.
 * Verifies internal reference drags prefer explicit reference URLs over ambient URI-list payloads.
 */
import { describe, expect, it, vi } from "vitest";
import {
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../../lib/internalReferenceDragSession";
import {
  clearDragState,
  extractInternalReferenceDragPayload,
  extractDragDropPayload,
  extractVideoDragDropPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  INTERNAL_REFERENCE_DRAG_ORIGIN,
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

const makeDragEvent = () => {
  const dragNode = document.createElement("div");
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

  return { dragNode, setData, setDragImage, event };
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

    expect(setData).toHaveBeenCalledWith(
      "text/reference-render-url",
      "blob:http://localhost:3000/ref-rendered-image"
    );
    expect(setData).toHaveBeenCalledWith(
      "text/reference-url",
      "blob:http://localhost:3000/ref-rendered-image"
    );
    expect(setData).toHaveBeenCalledWith(
      "image/url",
      "blob:http://localhost:3000/ref-rendered-image"
    );
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

      expect(setData).toHaveBeenCalledWith(
        "text/reference-render-url",
        "data:image/jpeg;base64,drag-snapshot"
      );
      expect(setData).toHaveBeenCalledWith("image/url", "http://localhost:3000/reference.png");
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
      referenceUrl: "https://example.com/out-token.png",
      referenceRenderUrl: "https://example.com/out-token.png",
      sourceSurface: "all-refs",
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
      referenceUrl: "https://example.com/out-text-token.png",
      referenceRenderUrl: "https://example.com/out-text-token.png",
      sourceSurface: "all-refs",
    });

    clearDragState(event as unknown as Parameters<typeof clearDragState>[0]);
  });

  it("preserves rendered transfer urls inside same-document drag session payloads", () => {
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

    expect(payload?.referenceUrl).toBe("data:image/jpeg;base64,generated-render");
    expect(payload?.referenceRenderUrl).toBe("data:image/jpeg;base64,generated-render");

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

  it("prefers rendered image URL over weaker card preview URL for transfer payload image/url", () => {
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
      "https://cdn.example.com/rendered-current-src.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "image/url",
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

  it("prefers rendered image candidates over weaker preview urls for image reference payloads", () => {
    const { event, dragNode, setData } = makeDragEvent();
    dragNode.dataset.dragPreviewKind = "image";
    dragNode.dataset.dragPreviewUrl = "https://cdn.example.com/weaker-preview.png";
    dragNode.dataset.dragImageSrc =
      "/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";

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
      "http://localhost:3000/storage/v1/object/sign/media_library/user-1/image.png"
    );
    expect(setData).toHaveBeenCalledWith(
      "image/url",
      "http://localhost:3000/storage/v1/object/sign/media_library/user-1/image.png"
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
