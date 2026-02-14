import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAiStudioReferenceSelectionState } from "../useAiStudioReferenceSelectionState";

describe("useAiStudioReferenceSelectionState", () => {
  it("routes reference and extra image updates by selected tool", () => {
    const { result } = renderHook(() =>
      useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null })
    );

    act(() => {
      result.current.setReferenceImageUrl("https://example.com/image-ref.png");
      result.current.setExtraImageUrl(0, "https://example.com/image-extra.png");
    });
    act(() => {
      result.current.setSelectedTool("video");
    });
    act(() => {
      result.current.setReferenceImageUrl("https://example.com/video-ref.png");
      result.current.setExtraImageUrl(1, "https://example.com/video-extra.png");
    });

    expect(result.current.referenceImageUrl).toBe("https://example.com/video-ref.png");
    expect(result.current.extraImageUrls[1]).toBe("https://example.com/video-extra.png");
    expect(result.current.resolveReferenceInputsForTool("edit").referenceImageUrl).toBe(
      "https://example.com/image-ref.png"
    );
    expect(result.current.resolveReferenceInputsForTool("video").referenceImageUrl).toBe(
      "https://example.com/video-ref.png"
    );
  });

  it("only toggles reference indicator when there is an active preview", () => {
    const { result, rerender } = renderHook(
      ({ preview }: { preview: string | null }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: preview }),
      { initialProps: { preview: null as string | null } }
    );

    act(() => {
      result.current.toggleReferenceIndicator();
    });
    expect(result.current.useReferenceImageIndicator).toBe(false);

    rerender({ preview: "https://example.com/preview.png" });
    act(() => {
      result.current.toggleReferenceIndicator();
    });
    expect(result.current.useReferenceImageIndicator).toBe(true);
  });

  it("opens and closes the model modal and clears all reference assets", () => {
    const { result } = renderHook(() =>
      useAiStudioReferenceSelectionState({
        activeOutputPreviewUrl: "https://example.com/preview.png",
      })
    );
    const anchor = document.createElement("button");
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 10,
        right: 20,
        height: 30,
        left: 0,
        bottom: 40,
        width: 20,
        x: 0,
        y: 10,
        toJSON: () => ({}),
      }),
    });

    act(() => {
      result.current.setReferenceImageUrl("https://example.com/image-ref.png");
      result.current.setExtraImageUrl(0, "https://example.com/image-extra.png");
      result.current.setSelectedTool("video");
    });
    act(() => {
      result.current.setReferenceImageUrl("https://example.com/video-ref.png");
      result.current.setExtraImageUrl(2, "https://example.com/video-extra.png");
      result.current.setMotionReferenceVideoUrl("https://example.com/motion.mp4");
      result.current.openModelModal("model-trigger", anchor, "reference-image");
    });

    expect(result.current.isModelModalOpen).toBe(true);
    expect(result.current.modelModalAnchor).toBe("model-trigger");
    expect(result.current.modelModalContext).toBe("reference-image");
    expect(result.current.modelModalPosition).toEqual({ top: 25, left: 36 });

    act(() => {
      result.current.closeModelModal();
      result.current.clearReferenceImages();
    });

    expect(result.current.isModelModalOpen).toBe(false);
    expect(result.current.modelModalAnchor).toBeNull();
    expect(result.current.modelModalContext).toBeNull();
    expect(result.current.resolveReferenceInputsForTool("edit").referenceImageUrl).toBeNull();
    expect(result.current.resolveReferenceInputsForTool("video").referenceImageUrl).toBeNull();
    expect(result.current.motionReferenceVideoUrl).toBeNull();
  });
});
