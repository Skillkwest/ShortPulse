/**
 * Drag/drop payload parsing tests for AI Studio.
 * Verifies internal reference drags prefer explicit reference URLs over ambient URI-list payloads.
 */
import { describe, expect, it, vi } from "vitest";
import {
  clearDragState,
  extractInternalReferenceDragPayload,
  extractDragDropPayload,
  extractVideoDragDropPayload,
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
    expect(setData).toHaveBeenCalledWith("text/reference-version", "1");
    expect(setData).toHaveBeenCalledWith("text/reference-output-id", "ref-1");
    expect(setData).toHaveBeenCalledWith("text/reference-image-index", "0");
    expect(setData).toHaveBeenCalledWith("text/reference-source-surface", "curated");
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
      sourceSurface: "all-refs",
    });
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
});
