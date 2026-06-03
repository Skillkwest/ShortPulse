import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { useAiStudioReferenceSelectionState } from "../useAiStudioReferenceSelectionState";

const uploadVideoFileToStorageMock = vi.hoisted(() => vi.fn());
const uploadVideoAssetToStorageMock = vi.hoisted(() => vi.fn());
const deleteUploadedMotionVideoByPathMock = vi.hoisted(() => vi.fn());
const retireCommittedMotionVideoByUrlMock = vi.hoisted(() => vi.fn());
const prepareVideoUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));

vi.mock("../../utils/videoUpload", () => ({
  uploadVideoFileToStorage: (...args: unknown[]) => uploadVideoFileToStorageMock(...args),
  uploadVideoAssetToStorage: (...args: unknown[]) => uploadVideoAssetToStorageMock(...args),
  deleteUploadedMotionVideoByPath: (...args: unknown[]) =>
    deleteUploadedMotionVideoByPathMock(...args),
  retireCommittedMotionVideoByUrl: (...args: unknown[]) =>
    retireCommittedMotionVideoByUrlMock(...args),
  prepareVideoUrl: (...args: unknown[]) => prepareVideoUrlMock(...args),
}));

const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

describe("useAiStudioReferenceSelectionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
    deleteUploadedMotionVideoByPathMock.mockResolvedValue(undefined);
    retireCommittedMotionVideoByUrlMock.mockResolvedValue(undefined);
    prepareVideoUrlMock.mockImplementation(async (value: string | null) => value);
  });

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

  it("retains canonical internal refs across create-mode authority switches", () => {
    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test:create:standard" },
      }
    );

    act(() => {
      result.current.setReferenceImageUrl(
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/a.png?token=stub.invalid.token"
      );
      result.current.setExtraImageUrl(
        0,
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/b.png?token=stub.invalid.token"
      );
    });

    rerender({ authorityKey: "session:test:create:pulse" });

    expect(result.current.getAuthorityState("session:test:create:standard")).toEqual(
      expect.objectContaining({
        referenceImageInternalMediaRefs: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/references/a.png",
          },
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/references/b.png",
          },
          null,
          null,
        ],
      })
    );
  });

  it("refreshes stale signed frame URLs for the video reference slot", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/references/frame.png",
          "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/frame.png?token=refreshed.valid.token",
        ],
        [
          "user-1/references/extra.png",
          "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/extra.png?token=refreshed.extra.token",
        ],
      ])
    );

    const { result } = renderHook(() =>
      useAiStudioReferenceSelectionState({
        activeOutputPreviewUrl: null,
        authorityKey: "session:test:create:standard",
      })
    );

    act(() => {
      result.current.setSelectedTool("video");
    });
    act(() => {
      result.current.setReferenceImageUrl(
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/frame.png?token=expired.invalid.token"
      );
      result.current.setExtraImageUrl(
        0,
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/extra.png?token=expired.extra.token"
      );
    });

    await waitFor(() => {
      expect(result.current.referenceImageUrl).toBe(
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/frame.png?token=refreshed.valid.token"
      );
    });

    expect(result.current.extraImageUrls[0]).toBe(
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/extra.png?token=refreshed.extra.token"
    );
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user-1/references/frame.png", "user-1/references/extra.png"],
    });
  });

  it("preserves an off-Create tool when returning to Pulse authority", () => {
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

    expect(result.current.selectedTool).toBe("edit");
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
    expect(retireCommittedMotionVideoByUrlMock).toHaveBeenCalledWith(
      "https://example.com/motion.mp4"
    );
  });

  it("retires a committed motion-control upload when the slot is cleared", () => {
    const { result } = renderHook(() =>
      useAiStudioReferenceSelectionState({
        activeOutputPreviewUrl: null,
        authorityKey: "session:test:create:standard",
      })
    );
    const motionUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/current.mp4?token=stub.invalid.token";

    act(() => {
      result.current.setMotionReferenceVideoUrl(motionUrl);
    });

    act(() => {
      result.current.clearMotionVideoSelection();
    });

    expect(result.current.motionReferenceVideoUrl).toBeNull();
    expect(retireCommittedMotionVideoByUrlMock).toHaveBeenCalledWith(motionUrl);
  });

  it("retires the previous committed motion-control upload after a replacement succeeds", async () => {
    uploadVideoFileToStorageMock.mockResolvedValue({
      url: "https://example.com/staged-motion.mp4",
      path: "user-1/videos/motion-control/staged-motion.mp4",
      size: 256,
    });

    const { result } = renderHook(() =>
      useAiStudioReferenceSelectionState({
        activeOutputPreviewUrl: null,
        authorityKey: "session:test:create:standard",
      })
    );
    const currentMotionUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/current.mp4?token=stub.invalid.token";

    act(() => {
      result.current.setMotionReferenceVideoUrl(currentMotionUrl);
    });

    await act(async () => {
      await result.current.stageMotionVideoSelection({
        videoFile: new File(["motion"], "replacement.mp4", { type: "video/mp4" }),
      });
    });

    expect(result.current.motionReferenceVideoUrl).toBe("https://example.com/staged-motion.mp4");
    expect(retireCommittedMotionVideoByUrlMock).toHaveBeenCalledWith(currentMotionUrl);
  });

  it("commits staged motion videos back to the originating authority after switching away", async () => {
    let resolveUpload: ((value: { url: string; path: string; size: number }) => void) | null = null;
    uploadVideoFileToStorageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test:create:standard" },
      }
    );

    const file = new File(["motion"], "motion.mp4", { type: "video/mp4" });
    let stagingPromise: Promise<void> | undefined;
    await act(async () => {
      stagingPromise = result.current.stageMotionVideoSelection({ videoFile: file });
    });

    expect(result.current.motionReferenceVideoPending).toBe(true);

    rerender({ authorityKey: "session:test:create:pulse" });

    expect(result.current.motionReferenceVideoPending).toBe(false);
    expect(result.current.motionReferenceVideoUrl).toBeNull();

    await act(async () => {
      resolveUpload?.({
        url: "https://example.com/staged-motion.mp4",
        path: "videos/motion-control/staged-motion.mp4",
        size: 256,
      });
      await stagingPromise;
    });

    expect(result.current.getAuthorityState("session:test:create:standard")).toEqual(
      expect.objectContaining({
        motionReferenceVideoUrl: "https://example.com/staged-motion.mp4",
      })
    );

    rerender({ authorityKey: "session:test:create:standard" });

    expect(result.current.motionReferenceVideoPending).toBe(false);
    expect(result.current.motionReferenceVideoError).toBeNull();
    expect(result.current.motionReferenceVideoUrl).toBe("https://example.com/staged-motion.mp4");
  });

  it("ignores stale staged motion completions after the user clears the slot", async () => {
    let resolveUpload: ((value: { url: string; path: string; size: number }) => void) | null = null;
    uploadVideoFileToStorageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    const { result } = renderHook(() =>
      useAiStudioReferenceSelectionState({
        activeOutputPreviewUrl: null,
        authorityKey: "session:test:create:standard",
      })
    );

    const file = new File(["motion"], "motion.mp4", { type: "video/mp4" });
    let stagingPromise: Promise<void> | undefined;
    await act(async () => {
      stagingPromise = result.current.stageMotionVideoSelection({ videoFile: file });
    });

    expect(result.current.motionReferenceVideoPending).toBe(true);

    act(() => {
      result.current.clearMotionVideoSelection();
    });

    expect(result.current.motionReferenceVideoPending).toBe(false);
    expect(result.current.motionReferenceVideoUrl).toBeNull();

    await act(async () => {
      resolveUpload?.({
        url: "https://example.com/stale-motion.mp4",
        path: "videos/motion-control/stale-motion.mp4",
        size: 256,
      });
      await stagingPromise;
    });

    expect(deleteUploadedMotionVideoByPathMock).toHaveBeenCalledWith(
      "videos/motion-control/stale-motion.mp4"
    );
    expect(result.current.motionReferenceVideoUrl).toBeNull();
    expect(result.current.motionReferenceVideoError).toBeNull();
  });

  it("retains staged motion upload errors on the originating authority after switching away", async () => {
    uploadVideoFileToStorageMock.mockRejectedValue(new Error("Upload failed"));

    const { result, rerender } = renderHook(
      ({ authorityKey }: { authorityKey: string }) =>
        useAiStudioReferenceSelectionState({ activeOutputPreviewUrl: null, authorityKey }),
      {
        initialProps: { authorityKey: "session:test:create:standard" },
      }
    );

    const file = new File(["motion"], "motion.mp4", { type: "video/mp4" });
    await act(async () => {
      const pending = result.current.stageMotionVideoSelection({ videoFile: file });
      rerender({ authorityKey: "session:test:create:pulse" });
      await pending;
    });

    expect(result.current.motionReferenceVideoPending).toBe(false);
    expect(result.current.motionReferenceVideoError).toBeNull();

    rerender({ authorityKey: "session:test:create:standard" });

    expect(result.current.motionReferenceVideoPending).toBe(false);
    expect(result.current.motionReferenceVideoError).toBe("Upload failed");
    expect(result.current.motionReferenceVideoUrl).toBeNull();
  });
});
