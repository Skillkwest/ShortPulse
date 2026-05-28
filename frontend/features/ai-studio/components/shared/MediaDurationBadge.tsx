import React from "react";
import { MusicNotes, SpeakerHigh, VideoCamera, WaveSine } from "phosphor-react";
import type { StudioAudioSourceMode } from "../../types";

type MediaDurationBadgeProps = {
  durationMs?: number | null;
  mediaUrl?: string | null;
  mediaKind: "audio" | "video";
  audioSourceMode?: StudioAudioSourceMode | null;
  className?: string;
};

export type MediaDurationBadgeKind = "audio" | "music" | "sound-effects" | "video";

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

const resolveMediaDurationBadgeKind = ({
  mediaKind,
  audioSourceMode,
}: {
  mediaKind: "audio" | "video";
  audioSourceMode?: StudioAudioSourceMode | null;
}): MediaDurationBadgeKind => {
  if (mediaKind === "video") return "video";
  if (audioSourceMode === "music") return "music";
  if (audioSourceMode === "sound-effects") return "sound-effects";
  return "audio";
};

function MediaDurationBadgeIcon({ kind }: { kind: MediaDurationBadgeKind }) {
  switch (kind) {
    case "video":
      return <VideoCamera size={10} weight="bold" />;
    case "music":
      return <MusicNotes size={10} weight="bold" />;
    case "sound-effects":
      return <WaveSine size={10} weight="bold" />;
    default:
      return <SpeakerHigh size={10} weight="bold" />;
  }
}

export function MediaDurationBadge({
  durationMs = null,
  mediaUrl = null,
  mediaKind,
  audioSourceMode = null,
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

  const badgeKind = resolveMediaDurationBadgeKind({ mediaKind, audioSourceMode });
  return (
    <span
      className={`media-duration-badge${className ? ` ${className}` : ""}`}
      data-media-duration-kind={badgeKind}
    >
      <span className="media-duration-badge__icon" aria-hidden="true">
        <MediaDurationBadgeIcon kind={badgeKind} />
      </span>
      <span className="media-duration-badge__label">
        {formatMediaDurationClock(resolvedDurationMs)}
      </span>
    </span>
  );
}
