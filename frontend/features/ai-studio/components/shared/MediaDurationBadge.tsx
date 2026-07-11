import React from "react";
import { MusicNotes, SpeakerHigh, VideoCamera, WaveSine } from "phosphor-react";
import type { StudioAudioSourceMode } from "../../types";
import { logMediaPerf } from "../../../../lib/mediaPerfTelemetry";

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
const MEDIA_DURATION_PROBE_MAX_QUEUED = 64;
const MEDIA_DURATION_PROBE_MAX_CACHE_ENTRIES = 300;
const MEDIA_DURATION_PROBE_TIMEOUT_MS = 8_000;
const mediaDurationProbeCache = new Map<string, number | null>();
type MediaDurationProbeEntry = {
  cacheKey: string;
  mediaKind: "audio" | "video";
  mediaUrl: string;
  promise: Promise<number | null>;
  resolve: (durationMs: number | null) => void;
  consumerCount: number;
  status: "queued" | "running" | "settled";
  cancelActive: (() => void) | null;
};
const mediaDurationProbeByKey = new Map<string, MediaDurationProbeEntry>();
let mediaDurationProbeInflightCount = 0;
const mediaDurationProbeQueue: MediaDurationProbeEntry[] = [];
let mediaDurationProbeDrainScheduled = false;

export type MediaDurationProbeWorkload = {
  inflightCount: number;
  queuedCount: number;
  cacheEntryCount: number;
};

export const readMediaDurationProbeWorkload = (): MediaDurationProbeWorkload => ({
  inflightCount: mediaDurationProbeInflightCount,
  queuedCount: mediaDurationProbeQueue.length,
  cacheEntryCount: mediaDurationProbeCache.size,
});

const logMediaDurationProbeWorkload = () => {
  const workload = readMediaDurationProbeWorkload();
  logMediaPerf("media.grid.memory.sample", {
    surface: "duration-probe",
    duration_probe_inflight_count: workload.inflightCount,
    duration_probe_queued_count: workload.queuedCount,
    duration_probe_cache_entry_count: workload.cacheEntryCount,
  });
};

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

const scheduleDurationProbeDrain = () => {
  if (mediaDurationProbeDrainScheduled) return;
  mediaDurationProbeDrainScheduled = true;
  queueMicrotask(() => {
    mediaDurationProbeDrainScheduled = false;
    runNextDurationProbe();
  });
};

const runNextDurationProbe = () => {
  while (
    mediaDurationProbeInflightCount < MEDIA_DURATION_PROBE_MAX_INFLIGHT &&
    mediaDurationProbeQueue.length
  ) {
    const entry = mediaDurationProbeQueue.shift();
    if (!entry || entry.status !== "queued" || entry.consumerCount <= 0) continue;
    const activeEntry = entry;
    activeEntry.status = "running";
    mediaDurationProbeInflightCount += 1;
    logMediaDurationProbeWorkload();

    let settled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const media =
      typeof document === "undefined"
        ? null
        : activeEntry.mediaKind === "audio"
          ? document.createElement("audio")
          : document.createElement("video");

    function handleLoadedMetadata() {
      const nextDurationSeconds = media?.duration;
      if (!Number.isFinite(nextDurationSeconds) || (nextDurationSeconds ?? -1) < 0) {
        settle(null);
        return;
      }
      settle(Math.max(0, Math.round((nextDurationSeconds ?? 0) * 1000)));
    }

    function handleError() {
      settle(null);
    }

    function settle(nextDurationMs: number | null, rememberResult = true, drainImmediately = true) {
      if (settled) return;
      settled = true;
      activeEntry.status = "settled";
      activeEntry.cancelActive = null;
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (rememberResult) rememberMediaDurationProbeResult(activeEntry.cacheKey, nextDurationMs);
      if (mediaDurationProbeByKey.get(activeEntry.cacheKey) === activeEntry) {
        mediaDurationProbeByKey.delete(activeEntry.cacheKey);
      }
      media?.removeEventListener("loadedmetadata", handleLoadedMetadata);
      media?.removeEventListener("error", handleError);
      media?.removeAttribute("src");
      try {
        media?.load();
      } catch {
        // Some browser/test environments throw when resetting detached media.
      }
      mediaDurationProbeInflightCount = Math.max(0, mediaDurationProbeInflightCount - 1);
      activeEntry.resolve(nextDurationMs);
      logMediaDurationProbeWorkload();
      if (drainImmediately) runNextDurationProbe();
      else scheduleDurationProbeDrain();
    }

    activeEntry.cancelActive = () => settle(null, false, false);
    if (!media) {
      settle(null, false);
      continue;
    }
    media.preload = "metadata";
    media.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    media.addEventListener("error", handleError, { once: true });
    timeoutId = globalThis.setTimeout(() => settle(null), MEDIA_DURATION_PROBE_TIMEOUT_MS);
    media.src = activeEntry.mediaUrl;
    try {
      media.load();
    } catch {
      settle(null);
    }
  }
};

const requestQueuedMediaDurationProbe = ({
  mediaKind,
  mediaUrl,
}: {
  mediaKind: "audio" | "video";
  mediaUrl: string;
}): { promise: Promise<number | null>; release: () => void } => {
  const cacheKey = resolveDurationProbeCacheKey({ mediaKind, mediaUrl });
  if (mediaDurationProbeCache.has(cacheKey)) {
    return {
      promise: Promise.resolve(mediaDurationProbeCache.get(cacheKey) ?? null),
      release: () => undefined,
    };
  }
  let entry = mediaDurationProbeByKey.get(cacheKey);
  if (entry) {
    entry.consumerCount += 1;
  } else if (mediaDurationProbeQueue.length >= MEDIA_DURATION_PROBE_MAX_QUEUED) {
    return { promise: Promise.resolve(null), release: () => undefined };
  } else {
    let resolveProbe: (durationMs: number | null) => void = () => undefined;
    const promise = new Promise<number | null>((resolve) => {
      resolveProbe = resolve;
    });
    entry = {
      cacheKey,
      mediaKind,
      mediaUrl,
      promise,
      resolve: resolveProbe,
      consumerCount: 1,
      status: "queued",
      cancelActive: null,
    };
    mediaDurationProbeByKey.set(cacheKey, entry);
    mediaDurationProbeQueue.push(entry);
    logMediaDurationProbeWorkload();
    runNextDurationProbe();
  }

  let released = false;
  return {
    promise: entry.promise,
    release: () => {
      if (released || !entry || entry.status === "settled") return;
      released = true;
      entry.consumerCount = Math.max(0, entry.consumerCount - 1);
      if (entry.consumerCount > 0) return;
      if (entry.status === "running") {
        entry.cancelActive?.();
        return;
      }
      const queueIndex = mediaDurationProbeQueue.indexOf(entry);
      if (queueIndex >= 0) mediaDurationProbeQueue.splice(queueIndex, 1);
      entry.status = "settled";
      if (mediaDurationProbeByKey.get(entry.cacheKey) === entry) {
        mediaDurationProbeByKey.delete(entry.cacheKey);
      }
      entry.resolve(null);
      logMediaDurationProbeWorkload();
      scheduleDurationProbeDrain();
    },
  };
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
    const probeRequest = requestQueuedMediaDurationProbe({
      mediaKind,
      mediaUrl: normalizedMediaUrl,
    });
    void probeRequest.promise.then((nextDurationMs) => {
      if (!cancelled) {
        updateResolvedDuration({ cacheKey, durationMs: nextDurationMs });
      }
    });

    return () => {
      cancelled = true;
      probeRequest.release();
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
