type VideoPreviewMetadata = {
  durationMs: number | null;
  posterUrl: string | null;
};

type LoadVideoPreviewMetadataOptions = {
  posterCaptureTimeSeconds?: number;
  posterMimeType?: string;
  posterQuality?: number;
};

const DEFAULT_POSTER_CAPTURE_TIME_SECONDS = 0.05;
const DEFAULT_POSTER_MIME_TYPE = "image/jpeg";
const DEFAULT_POSTER_QUALITY = 0.72;
const SEEK_EPSILON_SECONDS = 0.001;
const SEEK_END_PADDING_SECONDS = 0.1;

const normalizeDurationMs = (valueSeconds: number): number | null => {
  if (!Number.isFinite(valueSeconds) || valueSeconds < 0) return null;
  return Math.max(0, Math.round(valueSeconds * 1000));
};

const resolvePosterCaptureTimeSeconds = ({
  durationSeconds,
  requestedSeconds,
}: {
  durationSeconds: number;
  requestedSeconds: number;
}): number => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const safeUpperBound = Math.max(durationSeconds - SEEK_END_PADDING_SECONDS, 0);
  if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) {
    return Math.min(DEFAULT_POSTER_CAPTURE_TIME_SECONDS, safeUpperBound);
  }
  return Math.min(requestedSeconds, safeUpperBound);
};

const captureVideoPosterDataUrl = ({
  video,
  mimeType,
  quality,
}: {
  video: HTMLVideoElement;
  mimeType: string;
  quality: number;
}): string | null => {
  try {
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (width <= 0 || height <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL(mimeType, quality);
  } catch {
    return null;
  }
};

export const loadVideoPreviewMetadata = async (
  videoUrl: string,
  {
    posterCaptureTimeSeconds = DEFAULT_POSTER_CAPTURE_TIME_SECONDS,
    posterMimeType = DEFAULT_POSTER_MIME_TYPE,
    posterQuality = DEFAULT_POSTER_QUALITY,
  }: LoadVideoPreviewMetadataOptions = {}
): Promise<VideoPreviewMetadata> => {
  if (typeof document === "undefined") {
    return {
      durationMs: null,
      posterUrl: null,
    };
  }

  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  return await new Promise<VideoPreviewMetadata>((resolve) => {
    let settled = false;
    let durationMs: number | null = null;
    let targetTimeSeconds = 0;

    const finalize = (posterUrl: string | null) => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleFailure);
      video.removeAttribute("src");
      video.load();
      resolve({
        durationMs,
        posterUrl,
      });
    };

    const handleFailure = () => finalize(null);
    const capturePoster = () =>
      finalize(
        captureVideoPosterDataUrl({
          video,
          mimeType: posterMimeType,
          quality: posterQuality,
        })
      );

    const maybeCapturePoster = () => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (Math.abs((video.currentTime ?? 0) - targetTimeSeconds) > SEEK_EPSILON_SECONDS) return;
      capturePoster();
    };

    const handleSeeked = () => {
      maybeCapturePoster();
    };

    const handleLoadedData = () => {
      maybeCapturePoster();
    };

    const handleLoadedMetadata = () => {
      const nextDurationSeconds = video.duration;
      durationMs = normalizeDurationMs(nextDurationSeconds);
      targetTimeSeconds = resolvePosterCaptureTimeSeconds({
        durationSeconds: nextDurationSeconds,
        requestedSeconds: posterCaptureTimeSeconds,
      });

      if (Math.abs((video.currentTime ?? 0) - targetTimeSeconds) <= SEEK_EPSILON_SECONDS) {
        maybeCapturePoster();
        return;
      }

      try {
        video.currentTime = targetTimeSeconds;
      } catch {
        maybeCapturePoster();
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleFailure, { once: true });
    video.src = videoUrl;
    video.load();
  });
};

export const extractVideoPosterDataUrl = async (
  videoUrl: string,
  options?: LoadVideoPreviewMetadataOptions
): Promise<string | null> => {
  const preview = await loadVideoPreviewMetadata(videoUrl, options);
  return preview.posterUrl;
};
