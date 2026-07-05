import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import { createEmptyLipSyncAudioState } from "../../logic/lipSyncAudioState";
import { uploadAudioBlobToStorage } from "../../utils/audioUpload";
import { useVideoLipSyncAudioController } from "../useVideoLipSyncAudioController";

vi.mock("../../utils/audioUpload", () => ({
  uploadAudioBlobToStorage: vi.fn(),
}));

const uploadAudioBlobToStorageMock = vi.mocked(uploadAudioBlobToStorage);
const originalCreateObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

const selectAudioFile = (
  handler: ReturnType<typeof useVideoLipSyncAudioController>["handleLipSyncAudioSelection"],
  file: File
) => {
  handler({
    target: {
      files: [file],
      value: file.name,
    },
  } as unknown as Parameters<typeof handler>[0]);
};

const renderController = (onLipSyncAudioChange = vi.fn()) =>
  renderHook(() =>
    useVideoLipSyncAudioController({
      lipSyncAudio: createEmptyLipSyncAudioState(),
      onLipSyncAudioChange,
    })
  );

describe("useVideoLipSyncAudioController", () => {
  beforeEach(() => {
    let objectUrlIndex = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        objectUrlIndex += 1;
        return `blob:lip-sync-audio-${objectUrlIndex}`;
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal("Audio", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    uploadAudioBlobToStorageMock.mockReset();
    if (originalCreateObjectURLDescriptor) {
      Object.defineProperty(URL, "createObjectURL", originalCreateObjectURLDescriptor);
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectURLDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURLDescriptor);
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  it("revokes the previous local audio object URL when a new local file is selected", async () => {
    uploadAudioBlobToStorageMock.mockResolvedValue({
      url: "https://signed.shortpulse.test/audio.mp3",
      path: "user-1/audio/audio.mp3",
      size: 12,
      mimeType: "audio/mpeg",
    });
    const firstFile = new File(["first"], "first.mp3", { type: "audio/mpeg" });
    const secondFile = new File(["second"], "second.mp3", { type: "audio/mpeg" });
    const { result } = renderController();

    act(() => {
      selectAudioFile(result.current.handleLipSyncAudioSelection, firstFile);
    });
    await waitFor(() => expect(uploadAudioBlobToStorageMock).toHaveBeenCalledTimes(1));

    act(() => {
      selectAudioFile(result.current.handleLipSyncAudioSelection, secondFile);
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lip-sync-audio-1");
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:lip-sync-audio-2");
    await waitFor(() => expect(uploadAudioBlobToStorageMock).toHaveBeenCalledTimes(2));
  });

  it("revokes a local audio object URL and ignores its stale upload after Canvas audio wins", async () => {
    const pendingUpload = createDeferred<{
      url: string;
      path: string;
      size: number;
      mimeType: string;
    }>();
    uploadAudioBlobToStorageMock.mockReturnValue(pendingUpload.promise);
    const onLipSyncAudioChange = vi.fn();
    const file = new File(["local"], "local.mp3", { type: "audio/mpeg" });
    const canvasPayload: AgentComposerDirectDropPayload = {
      kind: "audio",
      audioUrl: "https://signed.shortpulse.test/canvas-audio.mp3",
      internalPayload: null,
      outputId: "audio-output-1",
      mediaId: "media-audio-1",
      durationMs: 12000,
      audioSourceMode: "voiceover",
    };
    const { result } = renderController(onLipSyncAudioChange);

    act(() => {
      selectAudioFile(result.current.handleLipSyncAudioSelection, file);
    });
    await waitFor(() => expect(uploadAudioBlobToStorageMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.acceptLipSyncAudioCanvasTearOutPayload(canvasPayload);
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lip-sync-audio-1");
    expect(onLipSyncAudioChange).toHaveBeenLastCalledWith({
      url: "https://signed.shortpulse.test/canvas-audio.mp3",
      durationMs: 12000,
      status: "ready",
      sourceKind: "canvas",
      storagePath: null,
      previewUrl: null,
      mimeType: null,
      size: null,
    });

    await act(async () => {
      pendingUpload.resolve({
        url: "https://signed.shortpulse.test/local-audio.mp3",
        path: "user-1/audio/local-audio.mp3",
        size: 5,
        mimeType: "audio/mpeg",
      });
      await pendingUpload.promise;
      await Promise.resolve();
    });

    expect(onLipSyncAudioChange).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKind: "local",
        status: "ready",
      })
    );
  });

  it("times out stalled local audio duration probes and releases the probe element", async () => {
    vi.useFakeTimers();
    uploadAudioBlobToStorageMock.mockResolvedValue({
      url: "https://signed.shortpulse.test/audio.mp3",
      path: "user-1/audio/audio.mp3",
      size: 12,
      mimeType: "audio/mpeg",
    });
    const audioInstances: Array<{
      load: ReturnType<typeof vi.fn>;
      onerror: (() => void) | null;
      onloadedmetadata: (() => void) | null;
      pause: ReturnType<typeof vi.fn>;
      preload: string;
      removeAttribute: ReturnType<typeof vi.fn>;
      src: string;
    }> = [];

    class MockAudio {
      duration = Number.NaN;
      load = vi.fn();
      onerror: (() => void) | null = null;
      onloadedmetadata: (() => void) | null = null;
      pause = vi.fn();
      preload = "";
      removeAttribute = vi.fn((name: string) => {
        if (name === "src") this.src = "";
      });
      src = "";

      constructor() {
        audioInstances.push(this);
      }
    }

    vi.stubGlobal("Audio", MockAudio);
    const onLipSyncAudioChange = vi.fn();
    const file = new File(["local"], "local.mp3", { type: "audio/mpeg" });
    const { result } = renderController(onLipSyncAudioChange);

    try {
      act(() => {
        selectAudioFile(result.current.handleLipSyncAudioSelection, file);
      });
      expect(uploadAudioBlobToStorageMock).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(uploadAudioBlobToStorageMock).toHaveBeenCalledTimes(1);
      expect(audioInstances).toHaveLength(1);
      expect(audioInstances[0]?.pause).toHaveBeenCalled();
      expect(audioInstances[0]?.removeAttribute).toHaveBeenCalledWith("src");
      expect(audioInstances[0]?.load).toHaveBeenCalled();
      expect(onLipSyncAudioChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "uploading",
          durationMs: null,
          previewUrl: "blob:lip-sync-audio-1#audio=1",
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
