/**
 * Video frame snapshot utility tests.
 * Verifies decoded video frames become image Files for Reference Grid ingestion.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureVideoFrameSnapshotFile, VideoFrameSnapshotError } from "../videoFrameSnapshot";

describe("captureVideoFrameSnapshotFile", () => {
  const originalCanvasGetContext = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "getContext"
  );
  const originalCanvasToBlob = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "toBlob"
  );
  const originalVideoWidth = Object.getOwnPropertyDescriptor(
    HTMLVideoElement.prototype,
    "videoWidth"
  );
  const originalVideoHeight = Object.getOwnPropertyDescriptor(
    HTMLVideoElement.prototype,
    "videoHeight"
  );
  const originalReadyState = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "readyState"
  );
  const originalCurrentTime = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "currentTime"
  );

  afterEach(() => {
    if (originalCanvasGetContext) {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", originalCanvasGetContext);
    }
    if (originalCanvasToBlob) {
      Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", originalCanvasToBlob);
    }
    if (originalVideoWidth) {
      Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", originalVideoWidth);
    }
    if (originalVideoHeight) {
      Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", originalVideoHeight);
    }
    if (originalReadyState) {
      Object.defineProperty(HTMLMediaElement.prototype, "readyState", originalReadyState);
    }
    if (originalCurrentTime) {
      Object.defineProperty(HTMLMediaElement.prototype, "currentTime", originalCurrentTime);
    }
    vi.restoreAllMocks();
  });

  const installVideoFrameEnvironment = ({
    width = 1920,
    height = 1080,
    readyState = HTMLMediaElement.HAVE_CURRENT_DATA,
    currentTime = 3.25,
    blob = new Blob(["frame"], { type: "image/png" }),
  }: {
    width?: number;
    height?: number;
    readyState?: number;
    currentTime?: number;
    blob?: Blob | null;
  } = {}) => {
    const drawImage = vi.fn();
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => width,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => height,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => readyState,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      configurable: true,
      get: () => currentTime,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () =>
        ({
          drawImage,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback, type?: string) => {
        callback(blob ? new Blob([blob], { type }) : null);
      },
    });
    return { drawImage };
  };

  it("captures the current decoded video frame as a native-resolution image file", async () => {
    const { drawImage } = installVideoFrameEnvironment();
    vi.spyOn(Date, "now").mockReturnValue(1781652343000);

    const video = document.createElement("video");
    const file = await captureVideoFrameSnapshotFile(video, {
      filenameHint: "Generated Clip.mp4",
    });

    expect(file.name).toBe("Generated-Clip-snapshot-3250ms.png");
    expect(file.type).toBe("image/png");
    expect(file.lastModified).toBe(1781652343000);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
  });

  it("rejects when the video has no decoded current frame", async () => {
    installVideoFrameEnvironment({
      readyState: HTMLMediaElement.HAVE_METADATA,
    });

    await expect(
      captureVideoFrameSnapshotFile(document.createElement("video"))
    ).rejects.toMatchObject({
      code: "frame_unavailable",
    } satisfies Partial<VideoFrameSnapshotError>);
  });

  it("rejects when canvas encoding fails", async () => {
    installVideoFrameEnvironment({
      blob: null,
    });

    await expect(
      captureVideoFrameSnapshotFile(document.createElement("video"))
    ).rejects.toMatchObject({
      code: "encoding_failed",
    } satisfies Partial<VideoFrameSnapshotError>);
  });
});
