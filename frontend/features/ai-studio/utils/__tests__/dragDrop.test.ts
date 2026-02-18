/**
 * Drag/drop payload parsing tests for AI Studio.
 * Verifies internal reference drags prefer explicit reference URLs over ambient URI-list payloads.
 */
import { describe, expect, it, vi } from "vitest";
import {
  extractDragDropPayload,
  extractVideoDragDropPayload,
  isVideoDragTransfer,
  prepareReferenceDrag,
} from "../dragDrop";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const makeTransfer = (data: Record<string, string>): DataTransfer =>
  ({
    files: emptyFileList,
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

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
    const dragNode = document.createElement("div");
    const setData = vi.fn();
    const event = {
      dataTransfer: {
        effectAllowed: "all",
        setData,
        setDragImage: vi.fn(),
      },
      currentTarget: dragNode,
    } as unknown as Parameters<typeof prepareReferenceDrag>[0];
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

    expect(setData).toHaveBeenCalledWith("text/reference-source-surface", "curated");
  });
});
