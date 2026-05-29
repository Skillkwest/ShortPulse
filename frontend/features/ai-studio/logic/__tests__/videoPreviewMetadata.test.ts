import { afterEach, describe, expect, it, vi } from "vitest";
import { loadVideoPreviewMetadata } from "../videoPreviewMetadata";

describe("loadVideoPreviewMetadata", () => {
  const originalLoad = HTMLMediaElement.prototype.load;
  const originalCurrentTime = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "currentTime"
  );
  const originalDuration = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "duration");
  const originalReadyState = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "readyState"
  );
  const originalVideoWidth = Object.getOwnPropertyDescriptor(
    HTMLVideoElement.prototype,
    "videoWidth"
  );
  const originalVideoHeight = Object.getOwnPropertyDescriptor(
    HTMLVideoElement.prototype,
    "videoHeight"
  );
  const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;

  afterEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: originalLoad,
    });
    if (originalCurrentTime) {
      Object.defineProperty(HTMLMediaElement.prototype, "currentTime", originalCurrentTime);
    }
    if (originalDuration) {
      Object.defineProperty(HTMLMediaElement.prototype, "duration", originalDuration);
    }
    if (originalReadyState) {
      Object.defineProperty(HTMLMediaElement.prototype, "readyState", originalReadyState);
    }
    if (originalVideoWidth) {
      Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", originalVideoWidth);
    }
    if (originalVideoHeight) {
      Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", originalVideoHeight);
    }
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: originalCanvasGetContext,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: originalCanvasToDataUrl,
    });
    vi.restoreAllMocks();
  });

  const installVideoPreviewEnvironment = (durationSeconds: number) => {
    const seekTimes: number[] = [];

    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __testCurrentTime?: number }).__testCurrentTime ?? 0;
      },
      set(value: number) {
        seekTimes.push(value);
        (this as HTMLMediaElement & { __testCurrentTime?: number }).__testCurrentTime = value;
        queueMicrotask(() => {
          this.dispatchEvent(new Event("seeked"));
        });
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      configurable: true,
      get: () => durationSeconds,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 720,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 1280,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: function load(this: HTMLMediaElement) {
        if (!this.currentSrc && !this.getAttribute("src")) return;
        queueMicrotask(() => {
          this.dispatchEvent(new Event("loadedmetadata"));
          this.dispatchEvent(new Event("loadeddata"));
        });
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () =>
        ({
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: () => "data:image/jpeg;base64,video-poster",
    });

    return seekTimes;
  };

  it("captures the motion poster from the requested 3-second mark when the clip is long enough", async () => {
    const seekTimes = installVideoPreviewEnvironment(5);

    const result = await loadVideoPreviewMetadata("https://example.com/motion.mp4", {
      posterCaptureTimeSeconds: 3,
    });

    expect(seekTimes).toContain(3);
    expect(result.durationMs).toBe(5000);
    expect(result.posterUrl).toBe("data:image/jpeg;base64,video-poster");
  });

  it("clamps the poster seek near the end for short clips", async () => {
    const seekTimes = installVideoPreviewEnvironment(2.5);

    await loadVideoPreviewMetadata("https://example.com/short-motion.mp4", {
      posterCaptureTimeSeconds: 3,
    });

    expect(seekTimes).toContain(2.4);
  });
});
