import React from "react";

type MediaDurationBadgeProps = {
  durationMs?: number | null;
  mediaUrl?: string | null;
  mediaKind: "audio" | "video";
  className?: string;
};

const normalizeDurationMs = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.max(0, Math.round(value));
};

export const formatMediaDurationClock = (valueMs: number | null | undefined): string => {
  const durationMs = normalizeDurationMs(valueMs);
  if (durationMs == null) return "0:00";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function MediaDurationBadge({
  durationMs = null,
  mediaUrl = null,
  mediaKind,
  className,
}: MediaDurationBadgeProps) {
  const [resolvedDurationMs, setResolvedDurationMs] = React.useState<number | null>(() =>
    normalizeDurationMs(durationMs)
  );

  React.useEffect(() => {
    const explicitDurationMs = normalizeDurationMs(durationMs);
    if (explicitDurationMs != null) {
      setResolvedDurationMs(explicitDurationMs);
      return;
    }
    const normalizedMediaUrl = mediaUrl?.trim() ?? "";
    if (!normalizedMediaUrl || typeof document === "undefined") {
      setResolvedDurationMs(null);
      return;
    }

    let cancelled = false;
    const media =
      mediaKind === "audio" ? document.createElement("audio") : document.createElement("video");
    media.preload = "metadata";
    media.src = normalizedMediaUrl;

    const finalize = (nextDurationMs: number | null) => {
      if (cancelled) return;
      setResolvedDurationMs(nextDurationMs);
    };

    const handleLoadedMetadata = () => {
      const nextDurationSeconds = media.duration;
      if (!Number.isFinite(nextDurationSeconds) || nextDurationSeconds < 0) {
        finalize(null);
        return;
      }
      finalize(Math.max(0, Math.round(nextDurationSeconds * 1000)));
    };

    const handleError = () => finalize(null);

    media.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    media.addEventListener("error", handleError, { once: true });
    media.load();

    return () => {
      cancelled = true;
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
      media.removeEventListener("error", handleError);
      media.removeAttribute("src");
      media.load();
    };
  }, [durationMs, mediaKind, mediaUrl]);

  if (resolvedDurationMs == null) return null;

  return (
    <span className={`media-duration-badge${className ? ` ${className}` : ""}`}>
      {formatMediaDurationClock(resolvedDurationMs)}
    </span>
  );
}
