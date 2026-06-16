/**
 * Captures still-image files from a decoded video frame for Reference Grid ingestion.
 * The caller owns upload/persistence; this module only turns the current video frame into a File.
 */

const DEFAULT_SNAPSHOT_MIME_TYPE = "image/png";
const SNAPSHOT_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type VideoFrameSnapshotErrorCode =
  | "document_unavailable"
  | "video_unavailable"
  | "frame_unavailable"
  | "canvas_unavailable"
  | "encoding_failed";

export class VideoFrameSnapshotError extends Error {
  code: VideoFrameSnapshotErrorCode;

  constructor(code: VideoFrameSnapshotErrorCode, message: string) {
    super(message);
    this.name = "VideoFrameSnapshotError";
    this.code = code;
  }
}

export type CaptureVideoFrameSnapshotFileOptions = {
  filenameHint?: string | null;
  mimeType?: string;
  quality?: number;
};

const sanitizeFilenameSegment = (value: string | null | undefined): string => {
  const normalized = value
    ?.trim()
    .replace(/\.[A-Za-z0-9]{1,8}$/u, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "video-frame";
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    } catch {
      resolve(null);
    }
  });

const resolveVideoFrameSnapshotFilename = ({
  filenameHint,
  currentTimeSeconds,
  mimeType,
}: {
  filenameHint?: string | null;
  currentTimeSeconds: number;
  mimeType: string;
}): string => {
  const extension = SNAPSHOT_EXTENSION_BY_MIME_TYPE[mimeType] ?? "png";
  const timestampMs = Number.isFinite(currentTimeSeconds)
    ? Math.max(0, Math.round(currentTimeSeconds * 1000))
    : 0;
  return `${sanitizeFilenameSegment(filenameHint)}-snapshot-${timestampMs}ms.${extension}`;
};

/**
 * Captures the current decoded frame from a video element as an image File.
 * Inputs: the mounted HTMLVideoElement and optional file naming/encoding settings.
 * Output: an image File preserving the video's native decoded dimensions.
 * Side effects: creates an in-memory canvas only; it does not upload or persist media.
 */
export const captureVideoFrameSnapshotFile = async (
  video: HTMLVideoElement | null,
  {
    filenameHint = null,
    mimeType = DEFAULT_SNAPSHOT_MIME_TYPE,
    quality,
  }: CaptureVideoFrameSnapshotFileOptions = {}
): Promise<File> => {
  if (typeof document === "undefined") {
    throw new VideoFrameSnapshotError(
      "document_unavailable",
      "Snapshot is unavailable in this browser context."
    );
  }
  if (!video) {
    throw new VideoFrameSnapshotError("video_unavailable", "Video frame is not ready yet.");
  }

  const width = Math.max(0, Math.round(video.videoWidth || 0));
  const height = Math.max(0, Math.round(video.videoHeight || 0));
  if (width <= 0 || height <= 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new VideoFrameSnapshotError("frame_unavailable", "Video frame is not ready yet.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new VideoFrameSnapshotError("canvas_unavailable", "Unable to capture that frame.");
  }

  try {
    context.drawImage(video, 0, 0, width, height);
  } catch {
    throw new VideoFrameSnapshotError(
      "frame_unavailable",
      "Unable to capture that frame from this video."
    );
  }

  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) {
    throw new VideoFrameSnapshotError(
      "encoding_failed",
      "Unable to save that video frame as an image."
    );
  }

  return new File(
    [blob],
    resolveVideoFrameSnapshotFilename({
      filenameHint,
      currentTimeSeconds: video.currentTime,
      mimeType: blob.type || mimeType,
    }),
    {
      type: blob.type || mimeType,
      lastModified: Date.now(),
    }
  );
};
