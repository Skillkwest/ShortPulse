import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioSessionReferenceDurability } from "../useAiStudioSessionReferenceDurability";

const uploadImageAssetToStorageMock = vi.fn();
const uploadVideoAssetToStorageMock = vi.fn();

vi.mock("../../utils/imageUpload", () => ({
  uploadImageAssetToStorage: (...args: unknown[]) => uploadImageAssetToStorageMock(...args),
}));

vi.mock("../../utils/videoUpload", () => ({
  uploadVideoAssetToStorage: (...args: unknown[]) => uploadVideoAssetToStorageMock(...args),
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

  it("uploads local video references and patches storage-backed delivery", async () => {
    uploadVideoAssetToStorageMock.mockResolvedValueOnce({
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
    expect(uploadVideoAssetToStorageMock).toHaveBeenCalledTimes(1);
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
      expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
      expect(uploadVideoAssetToStorageMock).not.toHaveBeenCalled();
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
});
