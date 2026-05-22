import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAiStudioReferenceSelectionState } from "../useAiStudioReferenceSelectionState";

describe("useAiStudioReferenceSelectionState", () => {
  it("defaults to Create workflow selection for new studio sessions", () => {
    const { result } = renderHook(() =>
      useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null })
    );

    expect(result.current.selectedTool).toBe("create");
    expect(result.current.showCreateTools).toBe(false);
  });

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

  it("keeps reference inputs isolated by project/session authority key", () => {
    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test" },
      }
    );

    act(() => {
      result.current.setReferenceImageUrl("https://example.com/standard-ref.png");
      result.current.setExtraImageUrl(0, "https://example.com/standard-extra.png");
      result.current.setSelectedTool("video");
    });

    rerender({ authorityKey: "project:test" });

    expect(result.current.selectedTool).toBe("create");
    expect(result.current.referenceImageUrl).toBeNull();
    expect(result.current.extraImageUrls).toEqual([null, null, null]);

    act(() => {
      result.current.setReferenceImageUrl("https://example.com/pulse-ref.png");
      result.current.setExtraImageUrl(1, "https://example.com/pulse-extra.png");
    });

    rerender({ authorityKey: "session:test" });

    expect(result.current.selectedTool).toBe("video");
    expect(result.current.referenceImageUrl).toBeNull();
    expect(result.current.extraImageUrls).toEqual([null, null, null]);
    expect(result.current.resolveReferenceInputsForTool("edit")).toEqual({
      referenceImageUrl: "https://example.com/standard-ref.png",
      extraImageUrls: ["https://example.com/standard-extra.png", null, null],
    });

    rerender({ authorityKey: "project:test" });

    expect(result.current.selectedTool).toBe("create");
    expect(result.current.referenceImageUrl).toBe("https://example.com/pulse-ref.png");
    expect(result.current.extraImageUrls).toEqual([
      null,
      "https://example.com/pulse-extra.png",
      null,
    ]);
  });

  it("keeps Standard and Pulse Create reference state isolated when the authority key changes by mode", () => {
    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test:create:standard" },
      }
    );

    act(() => {
      result.current.setReferenceImageUrl("https://example.com/standard-ref.png");
      result.current.toggleReferenceIndicator();
    });

    rerender({ authorityKey: "session:test:create:pulse" });

    expect(result.current.referenceImageUrl).toBeNull();
    expect(result.current.useReferenceImageIndicator).toBe(false);

    act(() => {
      result.current.setReferenceImageUrl("https://example.com/pulse-ref.png");
    });

    rerender({ authorityKey: "session:test:create:standard" });

    expect(result.current.referenceImageUrl).toBe("https://example.com/standard-ref.png");
    expect(result.current.useReferenceImageIndicator).toBe(false);
  });

  it("restores Pulse authority with the Create tool even after leaving Pulse on an off-Create tool", () => {
    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test:create:pulse" },
      }
    );

    act(() => {
      result.current.setSelectedTool("edit");
    });

    rerender({ authorityKey: "session:test:create:standard" });

    expect(result.current.selectedTool).toBe("edit");

    rerender({ authorityKey: "session:test:create:pulse" });

    expect(result.current.selectedTool).toBe("create");
  });

  it("preserves an off-Create tool when leaving Pulse for Standard mode", () => {
    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test:create:pulse" },
      }
    );

    act(() => {
      result.current.setSelectedTool("edit");
    });

    rerender({ authorityKey: "session:test:create:standard" });

    expect(result.current.selectedTool).toBe("edit");
  });

  it("falls back to the restored Standard tool when leaving Pulse with no selected tool", () => {
    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test:create:pulse" },
      }
    );

    act(() => {
      result.current.setSelectedTool(null);
    });

    rerender({ authorityKey: "session:test:create:standard" });

    expect(result.current.selectedTool).toBe("create");
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
