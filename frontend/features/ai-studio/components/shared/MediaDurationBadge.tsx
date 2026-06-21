import React from "react";
import { MusicNotes, SpeakerHigh, VideoCamera, WaveSine } from "phosphor-react";
import type { StudioAudioSourceMode } from "../../types";

type MediaDurationBadgeProps = {
  durationMs?: number | null;
  mediaUrl?: string | null;
  mediaKind: "audio" | "video";
  audioSourceMode?: StudioAudioSourceMode | null;
  className?: string;
  allowProbe?: boolean;
};

export type MediaDurationBadgeKind = "audio" | "music" | "sound-effects" | "video";

const MEDIA_DURATION_PROBE_MAX_INFLIGHT = 2;
const MEDIA_DURATION_PROBE_MAX_CACHE_ENTRIES = 300;
const MEDIA_DURATION_PROBE_TIMEOUT_MS = 8_000;
const mediaDurationProbeCache = new Map<string, number | null>();
const mediaDurationProbeInFlightByKey = new Map<string, Promise<number | null>>();
let mediaDurationProbeInflightCount = 0;
const mediaDurationProbeQueue: Array<() => void> = [];

type ResolvedMediaDurationState = {
  cacheKey: string | null;
  durationMs: number | null;
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

const resolveDurationProbeCacheKey = ({
  mediaKind,
  mediaUrl,
}: {
  mediaKind: "audio" | "video";
  mediaUrl: string;
}): string => `${mediaKind}:${mediaUrl}`;

const rememberMediaDurationProbeResult = (cacheKey: string, durationMs: number | null) => {
  if (!mediaDurationProbeCache.has(cacheKey)) {
    while (mediaDurationProbeCache.size >= MEDIA_DURATION_PROBE_MAX_CACHE_ENTRIES) {
      const oldestCacheKey = mediaDurationProbeCache.keys().next().value;
      if (typeof oldestCacheKey !== "string") break;
      mediaDurationProbeCache.delete(oldestCacheKey);
    }
  }
  mediaDurationProbeCache.set(cacheKey, durationMs);
};

const runNextDurationProbe = () => {
  if (mediaDurationProbeInflightCount >= MEDIA_DURATION_PROBE_MAX_INFLIGHT) return;
  const nextProbe = mediaDurationProbeQueue.shift();
  if (!nextProbe) return;
  mediaDurationProbeInflightCount += 1;
  nextProbe();
};

const completeDurationProbe = () => {
  mediaDurationProbeInflightCount = Math.max(0, mediaDurationProbeInflightCount - 1);
  runNextDurationProbe();
};

const requestQueuedMediaDurationProbe = ({
  mediaKind,
  mediaUrl,
}: {
  mediaKind: "audio" | "video";
  mediaUrl: string;
}): Promise<number | null> => {
  const cacheKey = resolveDurationProbeCacheKey({ mediaKind, mediaUrl });
  if (mediaDurationProbeCache.has(cacheKey)) {
    return Promise.resolve(mediaDurationProbeCache.get(cacheKey) ?? null);
  }
  const pendingProbe = mediaDurationProbeInFlightByKey.get(cacheKey);
  if (pendingProbe) return pendingProbe;

  const durationProbePromise = new Promise<number | null>((resolve) => {
    const runProbe = () => {
      if (typeof document === "undefined") {
        mediaDurationProbeInFlightByKey.delete(cacheKey);
        completeDurationProbe();
        resolve(null);
        return;
      }

      let settled = false;
      let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
      const media =
        mediaKind === "audio" ? document.createElement("audio") : document.createElement("video");
      media.preload = "metadata";

      function handleLoadedMetadata() {
        const nextDurationSeconds = media.duration;
        if (!Number.isFinite(nextDurationSeconds) || nextDurationSeconds < 0) {
          settle(null);
          return;
        }
        settle(Math.max(0, Math.round(nextDurationSeconds * 1000)));
      }

      function handleError() {
        settle(null);
      }

      function settle(nextDurationMs: number | null) {
        if (settled) return;
        settled = true;
        if (timeoutId != null) {
          globalThis.clearTimeout(timeoutId);
          timeoutId = null;
        }
        rememberMediaDurationProbeResult(cacheKey, nextDurationMs);
        mediaDurationProbeInFlightByKey.delete(cacheKey);
        media.removeEventListener("loadedmetadata", handleLoadedMetadata);
        media.removeEventListener("error", handleError);
        media.removeAttribute("src");
        try {
          media.load();
        } catch {
          // Some browser/test environments throw when resetting detached media.
        }
        completeDurationProbe();
        resolve(nextDurationMs);
      }

      media.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
      media.addEventListener("error", handleError, { once: true });
      timeoutId = globalThis.setTimeout(() => {
        settle(null);
      }, MEDIA_DURATION_PROBE_TIMEOUT_MS);
      media.src = mediaUrl;
      try {
        media.load();
      } catch {
        settle(null);
      }
    };

    mediaDurationProbeQueue.push(runProbe);
    runNextDurationProbe();
  });
  mediaDurationProbeInFlightByKey.set(cacheKey, durationProbePromise);
  return durationProbePromise;
};

export function MediaDurationBadge({
  durationMs = null,
  mediaUrl = null,
  mediaKind,
  audioSourceMode = null,
  className,
  allowProbe = true,
}: MediaDurationBadgeProps) {
  const [resolvedDuration, setResolvedDuration] = React.useState<ResolvedMediaDurationState>(() => {
    const normalizedMediaUrl = mediaUrl?.trim() ?? "";
    const cacheKey = normalizedMediaUrl
      ? resolveDurationProbeCacheKey({ mediaKind, mediaUrl: normalizedMediaUrl })
      : null;
    return {
      cacheKey,
      durationMs: normalizeDurationMs(durationMs),
    };
  });
  const resolvedDurationRef = React.useRef(resolvedDuration);
  const updateResolvedDuration = React.useCallback((nextDuration: ResolvedMediaDurationState) => {
    const current = resolvedDurationRef.current;
    if (
      current.cacheKey === nextDuration.cacheKey &&
      current.durationMs === nextDuration.durationMs
    ) {
      return;
    }
    resolvedDurationRef.current = nextDuration;
    setResolvedDuration(nextDuration);
  }, []);

  React.useEffect(() => {
    resolvedDurationRef.current = resolvedDuration;
  }, [resolvedDuration]);

  React.useEffect(() => {
    const normalizedMediaUrl = mediaUrl?.trim() ?? "";
    const cacheKey = normalizedMediaUrl
      ? resolveDurationProbeCacheKey({ mediaKind, mediaUrl: normalizedMediaUrl })
      : null;
    const explicitDurationMs = normalizeDurationMs(durationMs);
    if (explicitDurationMs != null) {
      if (cacheKey) {
        rememberMediaDurationProbeResult(cacheKey, explicitDurationMs);
      }
      updateResolvedDuration({ cacheKey, durationMs: explicitDurationMs });
      return;
    }
    if (!cacheKey) {
      updateResolvedDuration({ cacheKey: null, durationMs: null });
      return;
    }
    if (!allowProbe || typeof document === "undefined") {
      const cachedDurationMs = mediaDurationProbeCache.has(cacheKey)
        ? (mediaDurationProbeCache.get(cacheKey) ?? null)
        : undefined;
      const current = resolvedDurationRef.current;
      if (cachedDurationMs !== undefined) {
        updateResolvedDuration({ cacheKey, durationMs: cachedDurationMs });
        return;
      }
      if (current.cacheKey !== cacheKey) {
        updateResolvedDuration({ cacheKey, durationMs: null });
      }
      return;
    }

    let cancelled = false;
    void requestQueuedMediaDurationProbe({ mediaKind, mediaUrl: normalizedMediaUrl }).then(
      (nextDurationMs) => {
        if (!cancelled) {
          updateResolvedDuration({ cacheKey, durationMs: nextDurationMs });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [allowProbe, durationMs, mediaKind, mediaUrl, updateResolvedDuration]);

  const resolvedDurationMs = resolvedDuration.durationMs;
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
