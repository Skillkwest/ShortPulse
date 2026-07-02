/**
 * Browser-side Motion Control video pre-staging.
 * Shrinks oversized local clips before signed storage upload; server finalization remains canonical.
 */
import { shouldDeferAiStudioBackgroundWork } from "../logic/aiStudioPressureConservation";

const MOTION_REFERENCE_LOCAL_PRESTAGE_THRESHOLD_BYTES = 20 * 1024 * 1024;
const MOTION_REFERENCE_LOCAL_PRESTAGE_TARGET_BYTES = 18 * 1024 * 1024;
const MOTION_REFERENCE_LOCAL_PRESTAGE_FPS = 24;
const MOTION_REFERENCE_MIN_DURATION_SECONDS = 3;
const MOTION_REFERENCE_MAX_DURATION_SECONDS = 30;
const MOTION_REFERENCE_METADATA_TIMEOUT_MS = 7_000;
const MOTION_REFERENCE_PLAYBACK_TIMEOUT_PADDING_MS = 3_000;
const MOTION_REFERENCE_LOCAL_PRESTAGE_PLANS = [
  { longEdge: 1280, videoBitsPerSecond: 4_000_000 },
  { longEdge: 960, videoBitsPerSecond: 2_500_000 },
  { longEdge: 720, videoBitsPerSecond: 1_500_000 },
  { longEdge: 540, videoBitsPerSecond: 900_000 },
] as const;

const resolveMotionReferenceRecordingMimeType = (): string | null => {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return (
    candidates.find(
      (candidate) =>
        typeof MediaRecorder.isTypeSupported !== "function" ||
        MediaRecorder.isTypeSupported(candidate)
    ) ?? null
  );
};

const loadVideoElementForPrestage = async (objectUrl: string): Promise<HTMLVideoElement | null> => {
  if (typeof document === "undefined") return null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  const loaded = new Promise<HTMLVideoElement | null>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, MOTION_REFERENCE_METADATA_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onerror = null;
    };
    video.onloadedmetadata = () => {
      cleanup();
      resolve(video);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
  });

  video.src = objectUrl;
  try {
    video.load();
  } catch {
    return null;
  }

  return await loaded;
};

const releaseVideoElementForPrestage = (video: HTMLVideoElement | null): void => {
  if (!video) return;
  video.onloadedmetadata = null;
  video.onerror = null;
  video.onended = null;
  try {
    video.pause();
  } catch {
    // Best-effort browser resource release.
  }
  try {
    video.removeAttribute("src");
    video.load();
  } catch {
    // Best-effort browser resource release.
  }
};

const waitForVideoPlaybackToEnd = async (video: HTMLVideoElement): Promise<boolean> => {
  const durationMs =
    Number.isFinite(video.duration) && video.duration > 0
      ? Math.ceil(video.duration * 1000)
      : MOTION_REFERENCE_MAX_DURATION_SECONDS * 1000;
  const timeoutMs = Math.min(
    durationMs + MOTION_REFERENCE_PLAYBACK_TIMEOUT_PADDING_MS,
    (MOTION_REFERENCE_MAX_DURATION_SECONDS + 5) * 1000
  );

  return await new Promise<boolean>((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.onended = null;
      video.onerror = null;
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    video.onended = () => {
      cleanup();
      resolve(true);
    };
    video.onerror = () => {
      cleanup();
      resolve(false);
    };
  });
};

const resolvePrestageDimensions = ({
  width,
  height,
  maxLongEdge,
}: {
  width: number;
  height: number;
  maxLongEdge: number;
}): { width: number; height: number } => {
  const sourceLongEdge = Math.max(width, height);
  const scale = sourceLongEdge > maxLongEdge ? maxLongEdge / sourceLongEdge : 1;
  const nextWidth = Math.max(2, Math.round(width * scale));
  const nextHeight = Math.max(2, Math.round(height * scale));
  return {
    width: nextWidth % 2 === 0 ? nextWidth : nextWidth - 1,
    height: nextHeight % 2 === 0 ? nextHeight : nextHeight - 1,
  };
};

const transcodeMotionReferenceBlobWithCanvas = async ({
  blob,
  longEdge,
  videoBitsPerSecond,
}: {
  blob: Blob;
  longEdge: number;
  videoBitsPerSecond: number;
}): Promise<Blob | null> => {
  if (typeof URL === "undefined" || typeof MediaRecorder === "undefined") return null;
  const mimeType = resolveMotionReferenceRecordingMimeType();
  if (!mimeType) return null;
  const objectUrl = URL.createObjectURL(blob);
  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let tracksStopped = false;

  const stopStreamTracks = () => {
    if (tracksStopped) return;
    tracksStopped = true;
    stream?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Best-effort browser resource release.
      }
    });
  };

  try {
    video = await loadVideoElementForPrestage(objectUrl);
    const sourceWidth = Math.max(0, Math.round(video?.videoWidth ?? 0));
    const sourceHeight = Math.max(0, Math.round(video?.videoHeight ?? 0));
    if (!video || sourceWidth <= 0 || sourceHeight <= 0) return null;
    const loadedVideo = video;
    if (
      Number.isFinite(loadedVideo.duration) &&
      (loadedVideo.duration < MOTION_REFERENCE_MIN_DURATION_SECONDS ||
        loadedVideo.duration > MOTION_REFERENCE_MAX_DURATION_SECONDS)
    ) {
      return null;
    }
    const dimensions = resolvePrestageDimensions({
      width: sourceWidth,
      height: sourceHeight,
      maxLongEdge: longEdge,
    });

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.captureStream !== "function") return null;
    stream = canvas.captureStream(MOTION_REFERENCE_LOCAL_PRESTAGE_FPS);
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond,
    });
    const chunks: BlobPart[] = [];
    const recorded = new Promise<Blob | null>((resolve) => {
      recorder!.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder!.onerror = () => {
        stopStreamTracks();
        resolve(null);
      };
      recorder!.onstop = () => {
        stopStreamTracks();
        resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null);
      };
    });

    const requestNextFrame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback: FrameRequestCallback) =>
            window.setTimeout(
              () => callback(Date.now()),
              1000 / MOTION_REFERENCE_LOCAL_PRESTAGE_FPS
            );
    const drawFrame = () => {
      if (loadedVideo.paused || loadedVideo.ended) return;
      context.drawImage(loadedVideo, 0, 0, dimensions.width, dimensions.height);
      requestNextFrame(drawFrame);
    };

    recorder.start(250);
    await loadedVideo.play();
    drawFrame();
    const completed = await waitForVideoPlaybackToEnd(loadedVideo);
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await recorded;
    return completed ? blob : null;
  } catch {
    return null;
  } finally {
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        stopStreamTracks();
      }
    } else {
      stopStreamTracks();
    }
    releaseVideoElementForPrestage(video);
    URL.revokeObjectURL(objectUrl);
  }
};

/**
 * Shrinks oversized local Motion Control clips before browser-direct staging.
 * Returns the original blob if browser pre-staging is unavailable or cannot help.
 */
export const maybePrestageMotionReferenceVideoBlob = async (blob: Blob): Promise<Blob> => {
  if (blob.size <= MOTION_REFERENCE_LOCAL_PRESTAGE_THRESHOLD_BYTES) return blob;
  if (shouldDeferAiStudioBackgroundWork()) return blob;
  let bestBlob: Blob | null = null;

  for (const plan of MOTION_REFERENCE_LOCAL_PRESTAGE_PLANS) {
    const transcoded = await transcodeMotionReferenceBlobWithCanvas({
      blob,
      longEdge: plan.longEdge,
      videoBitsPerSecond: plan.videoBitsPerSecond,
    });
    if (!transcoded?.size) continue;
    if (!bestBlob || transcoded.size < bestBlob.size) bestBlob = transcoded;
    if (transcoded.size <= MOTION_REFERENCE_LOCAL_PRESTAGE_TARGET_BYTES) return transcoded;
  }

  return bestBlob && bestBlob.size < blob.size ? bestBlob : blob;
};
