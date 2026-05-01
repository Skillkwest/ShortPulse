import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";

const makeInternalReferenceDragEvent = (overrides?: {
  mediaKind?: "image" | "video" | "audio" | "text";
  referenceUrl?: string;
  imageUrl?: string;
}) =>
  ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      files: { length: 0, item: () => null } as unknown as FileList,
      types: [
        "text/reference-origin",
        "text/reference-output-id",
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
});
