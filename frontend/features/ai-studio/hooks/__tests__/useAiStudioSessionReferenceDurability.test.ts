import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioSessionReferenceDurability } from "../useAiStudioSessionReferenceDurability";

const uploadAudioAssetToStorageMock = vi.fn();
const uploadImageAssetToStorageMock = vi.fn();
const uploadReferenceVideoAssetToStorageMock = vi.fn();

vi.mock("../../utils/audioUpload", () => ({
  uploadAudioAssetToStorage: (...args: unknown[]) => uploadAudioAssetToStorageMock(...args),
}));

vi.mock("../../utils/imageUpload", () => ({
  uploadImageAssetToStorage: (...args: unknown[]) => uploadImageAssetToStorageMock(...args),
}));

vi.mock("../../utils/videoUpload", () => ({
  uploadReferenceVideoAssetToStorage: (...args: unknown[]) =>
    uploadReferenceVideoAssetToStorageMock(...args),
}));

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Reference",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "now",
  mediaSource: "upload",
  ...overrides,
});

const useHarness = (initialOutputs: StudioOutput[]) => {
  const [outputs, setOutputsState] = useState<StudioOutput[]>(initialOutputs);
  const [archivedOutputs, setArchivedOutputs] = useState<StudioOutput[]>([]);
  useAiStudioSessionReferenceDurability({
    outputs,
    archivedOutputs,
    setOutputsState,
    setArchivedOutputs,
  });
  return {
    outputs,
    archivedOutputs,
    setOutputsState,
    setArchivedOutputs,
  };
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useAiStudioSessionReferenceDurability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads local image references and patches storage-backed delivery", async () => {
    uploadImageAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed/user-1/images/ref.png",
      path: "user-1/images/ref.png",
      size: 123,
    });
    const { result } = renderHook(() =>
      useHarness([createOutput({ previewUrl: "blob:local-image-1" })])
    );

    await waitFor(() => {
      expect(result.current.outputs[0]?.previewUrl).toBe("https://signed/user-1/images/ref.png");
      expect(result.current.outputs[0]?.previewStoragePath).toBe("user-1/images/ref.png");
      expect(result.current.outputs[0]?.fullStoragePath).toBe("user-1/images/ref.png");
    });
    expect(uploadImageAssetToStorageMock).toHaveBeenCalledTimes(1);
  });

  it("settles pending local image upload lifecycle after durability succeeds", async () => {
    uploadImageAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed/user-1/images/frame-shot.png",
      path: "user-1/images/frame-shot.png",
      size: 123,
    });
    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "frame-shot-1",
          previewUrl: "blob:frame-shot-preview",
          localObjectUrl: "blob:frame-shot-preview",
          taskState: "pending",
          taskId: "local-upload-task",
          queueState: "queued",
          queueEnqueuedAtMs: 123,
          saveState: "saving",
          saveError: "still uploading",
        }),
      ])
    );

    await waitFor(() => {
      const output = result.current.outputs[0];
      expect(output?.previewUrl).toBe("https://signed/user-1/images/frame-shot.png");
      expect(output?.previewStoragePath).toBe("user-1/images/frame-shot.png");
      expect(output?.fullStoragePath).toBe("user-1/images/frame-shot.png");
      expect(output?.localObjectUrl).toBeNull();
      expect(output?.taskState).toBeUndefined();
      expect(output?.taskId).toBeUndefined();
      expect(output?.queueState).toBeUndefined();
      expect(output?.queueEnqueuedAtMs).toBeUndefined();
      expect(output?.saveState).toBe("idle");
      expect(output?.saveError).toBeNull();
    });
    expect(uploadImageAssetToStorageMock).toHaveBeenCalledWith("blob:frame-shot-preview");
  });

  it("does not settle generated provider-task rows with transient local previews", async () => {
    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "generated-task-1",
          mediaSource: "generated",
          generationId: "generation-1",
          submissionMode: "provider-task",
          previewUrl: "blob:generated-preview",
          localObjectUrl: "blob:generated-preview",
          taskState: "running",
          saveState: "idle",
        }),
      ])
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
    expect(result.current.outputs[0]).toEqual(
      expect.objectContaining({
        previewUrl: "blob:generated-preview",
        localObjectUrl: "blob:generated-preview",
        taskState: "running",
      })
    );
  });

  it("prefers local object urls over data-url previews when durabilizing image references", async () => {
    uploadImageAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed/user-1/images/ref-data.png",
      path: "user-1/images/ref-data.png",
      size: 123,
    });
    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          previewUrl: "data:image/png;base64,ref-data",
          localObjectUrl: "blob:local-image-upload-1",
        }),
      ])
    );

    await waitFor(() => {
      expect(result.current.outputs[0]?.previewUrl).toBe(
        "https://signed/user-1/images/ref-data.png"
      );
      expect(result.current.outputs[0]?.previewStoragePath).toBe("user-1/images/ref-data.png");
      expect(result.current.outputs[0]?.fullStoragePath).toBe("user-1/images/ref-data.png");
      expect(result.current.outputs[0]?.localObjectUrl).toBeNull();
    });
    expect(uploadImageAssetToStorageMock).toHaveBeenCalledWith("blob:local-image-upload-1");
  });

  it("uploads local video references and patches storage-backed delivery", async () => {
    uploadReferenceVideoAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed/user-1/videos/ref.mp4",
      path: "user-1/videos/ref.mp4",
      size: 456,
    });
    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "video-1",
          mode: "video",
          previewUrl: "blob:local-video-1#video=1",
        }),
      ])
    );

    await waitFor(() => {
      expect(result.current.outputs[0]?.previewUrl).toBe("https://signed/user-1/videos/ref.mp4");
      expect(result.current.outputs[0]?.previewStoragePath).toBe("user-1/videos/ref.mp4");
      expect(result.current.outputs[0]?.fullStoragePath).toBe("user-1/videos/ref.mp4");
    });
    expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledTimes(1);
  });

  it("uploads local video poster images and patches poster-backed preview delivery", async () => {
    uploadReferenceVideoAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed/user-1/videos/ref.mp4",
      path: "user-1/videos/ref.mp4",
      size: 456,
    });
    uploadImageAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed/user-1/variants/videos/ref/poster_720.jpg",
      path: "user-1/variants/videos/ref/poster_720.jpg",
      size: 123,
    });
    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "video-1",
          mode: "video",
          previewUrl: "blob:local-video-1#video=1",
          previewPosterUrl: "data:image/jpeg;base64,poster",
        }),
      ])
    );

    await waitFor(() => {
      expect(result.current.outputs[0]?.previewUrl).toBe("https://signed/user-1/videos/ref.mp4");
      expect(result.current.outputs[0]?.previewPosterUrl).toBe(
        "https://signed/user-1/variants/videos/ref/poster_720.jpg"
      );
      expect(result.current.outputs[0]?.previewPosterStoragePath).toBe(
        "user-1/variants/videos/ref/poster_720.jpg"
      );
      expect(result.current.outputs[0]?.previewStoragePath).toBe(
        "user-1/variants/videos/ref/poster_720.jpg"
      );
      expect(result.current.outputs[0]?.fullStoragePath).toBe("user-1/videos/ref.mp4");
    });
    expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledWith(
      "blob:local-video-1#video=1"
    );
    expect(uploadImageAssetToStorageMock).toHaveBeenCalledWith("data:image/jpeg;base64,poster");
  });

  it("uploads local audio references and patches storage-backed delivery", async () => {
    uploadAudioAssetToStorageMock.mockResolvedValueOnce({
      url: "https://signed/user-1/audio/ref.mp3",
      path: "user-1/voice-changer/source-audio/ref.mp3",
      size: 321,
    });
    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "audio-1",
          mode: "audio",
          previewUrl: "blob:local-audio-1#audio=1",
        }),
      ])
    );

    await waitFor(() => {
      expect(result.current.outputs[0]?.previewUrl).toBe("https://signed/user-1/audio/ref.mp3");
      expect(result.current.outputs[0]?.previewStoragePath).toBe(
        "user-1/voice-changer/source-audio/ref.mp3"
      );
      expect(result.current.outputs[0]?.fullStoragePath).toBe(
        "user-1/voice-changer/source-audio/ref.mp3"
      );
    });
    expect(uploadAudioAssetToStorageMock).toHaveBeenCalledTimes(1);
    expect(uploadAudioAssetToStorageMock).toHaveBeenCalledWith("blob:local-audio-1#audio=1");
  });

  it("does not enqueue non-local references", async () => {
    renderHook(() =>
      useHarness([
        createOutput({
          previewUrl: "https://example.com/reference.png",
          previewStoragePath: "user-1/images/ref.png",
          fullStoragePath: "user-1/images/ref.png",
        }),
      ])
    );

    await waitFor(() => {
      expect(uploadAudioAssetToStorageMock).not.toHaveBeenCalled();
      expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
      expect(uploadReferenceVideoAssetToStorageMock).not.toHaveBeenCalled();
    });
  });

  it("skips unsupported local data image references", async () => {
    renderHook(() =>
      useHarness([
        createOutput({
          previewUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>",
        }),
      ])
    );

    await waitFor(() => {
      expect(uploadAudioAssetToStorageMock).not.toHaveBeenCalled();
      expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
      expect(uploadReferenceVideoAssetToStorageMock).not.toHaveBeenCalled();
    });
  });

  it("keeps local preview unchanged when upload fails", async () => {
    uploadImageAssetToStorageMock.mockRejectedValueOnce(new Error("upload failed"));
    const { result } = renderHook(() =>
      useHarness([createOutput({ previewUrl: "blob:local-image-fail" })])
    );

    await waitFor(() => {
      expect(uploadImageAssetToStorageMock).toHaveBeenCalledTimes(1);
    });
    expect(result.current.outputs[0]?.previewUrl).toBe("blob:local-image-fail");
    expect(result.current.outputs[0]?.previewStoragePath).toBeUndefined();
    expect(result.current.outputs[0]?.fullStoragePath).toBeUndefined();
  });

  it("avoids re-uploading the same local signature", async () => {
    uploadImageAssetToStorageMock.mockResolvedValue({
      url: "https://signed/user-1/images/ref.png",
      path: "user-1/images/ref.png",
      size: 100,
    });
    const { result } = renderHook(() =>
      useHarness([createOutput({ previewUrl: "blob:local-image-once" })])
    );

    await waitFor(() => {
      expect(result.current.outputs[0]?.previewStoragePath).toBe("user-1/images/ref.png");
    });

    act(() => {
      result.current.setOutputsState((rows) => [...rows]);
    });

    await waitFor(() => {
      expect(uploadImageAssetToStorageMock).toHaveBeenCalledTimes(1);
    });
  });

  it("processes queued local video references serially", async () => {
    const first = createDeferred<{
      url: string;
      path: string;
      size: number;
    }>();
    const second = createDeferred<{
      url: string;
      path: string;
      size: number;
    }>();
    uploadReferenceVideoAssetToStorageMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "video-1",
          mode: "video",
          previewUrl: "blob:local-video-1#video=1",
        }),
        createOutput({
          id: "video-2",
          mode: "video",
          previewUrl: "blob:local-video-2#video=1",
        }),
      ])
    );

    await waitFor(() => {
      expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledTimes(1);
      expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenNthCalledWith(
        1,
        "blob:local-video-1#video=1"
      );
    });
    expect(uploadReferenceVideoAssetToStorageMock).not.toHaveBeenCalledWith(
      "blob:local-video-2#video=1"
    );

    first.resolve({
      url: "https://signed/user-1/videos/ref-1.mp4",
      path: "user-1/videos/ref-1.mp4",
      size: 111,
    });

    await waitFor(() => {
      expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledTimes(2);
      expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenNthCalledWith(
        2,
        "blob:local-video-2#video=1"
      );
      expect(result.current.outputs[0]?.previewStoragePath).toBe("user-1/videos/ref-1.mp4");
    });

    second.resolve({
      url: "https://signed/user-1/videos/ref-2.mp4",
      path: "user-1/videos/ref-2.mp4",
      size: 222,
    });

    await waitFor(() => {
      expect(result.current.outputs[1]?.previewStoragePath).toBe("user-1/videos/ref-2.mp4");
    });
  });

  it("continues processing later queued videos after an earlier video upload fails", async () => {
    uploadReferenceVideoAssetToStorageMock
      .mockRejectedValueOnce(new Error("multipart parser exploded"))
      .mockResolvedValueOnce({
        url: "https://signed/user-1/videos/ref-2.mp4",
        path: "user-1/videos/ref-2.mp4",
        size: 222,
      })
      .mockRejectedValueOnce(new Error("multipart parser exploded again"));

    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "video-fail",
          mode: "video",
          previewUrl: "blob:local-video-fail#video=1",
        }),
        createOutput({
          id: "video-ok",
          mode: "video",
          previewUrl: "blob:local-video-ok#video=1",
        }),
      ])
    );

    await waitFor(() => {
      expect(result.current.outputs[1]?.previewStoragePath).toBe("user-1/videos/ref-2.mp4");
    });
    expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledWith(
      "blob:local-video-fail#video=1"
    );
    expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledWith(
      "blob:local-video-ok#video=1"
    );

    expect(result.current.outputs[0]?.previewUrl).toBe("blob:local-video-fail#video=1");
    expect(result.current.outputs[0]?.previewStoragePath).toBeUndefined();
  });

  it("retries a failed local video signature once and then stops after the retry budget is exhausted", async () => {
    vi.useFakeTimers();
    uploadReferenceVideoAssetToStorageMock
      .mockRejectedValueOnce(new Error("multipart parser exploded"))
      .mockRejectedValueOnce(new Error("multipart parser exploded again"));

    const { result } = renderHook(() =>
      useHarness([
        createOutput({
          id: "video-1",
          mode: "video",
          previewUrl: "blob:local-video-fail-once#video=1",
        }),
      ])
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(uploadReferenceVideoAssetToStorageMock).toHaveBeenCalledTimes(2);
    expect(result.current.outputs[0]?.previewUrl).toBe("blob:local-video-fail-once#video=1");
    expect(result.current.outputs[0]?.previewStoragePath).toBeUndefined();
    expect(result.current.outputs[0]?.saveState).toBe("failed");
    expect(result.current.outputs[0]?.saveError).toBe("multipart parser exploded again");
  });
});
