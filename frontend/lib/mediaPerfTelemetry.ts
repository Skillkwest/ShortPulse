/**
 * Media performance telemetry buffer and helpers.
 * Collects sanitized, low-cardinality timing events for local baselines and debugging.
 */
import { addBreadcrumb } from "./clientBreadcrumbs";

export type MediaPerfSurface = "media-library-route" | "media-library-modal" | "reference-grid";

export type MediaPerfEventName =
  | "media.route.first_card_shell"
  | "media.route.first_media_paint"
  | "media.modal.first_card_shell"
  | "media.modal.first_media_paint"
  | "media.move.bulk.completed"
  | "media.move.bulk.failed"
  | "media.sign.batch.completed"
  | "media.sign.batch.failed"
  | "media.grid.scroll.sample"
  | "media.grid.autoplay.started"
  | "media.grid.autoplay.stopped";

type Primitive = string | number | boolean | null;
type MediaPerfData = Record<string, Primitive>;

export type MediaPerfEvent = {
  t: number;
  event: MediaPerfEventName;
  data: MediaPerfData;
};

type MediaPerfDebugHandle = {
  snapshot: () => MediaPerfEvent[];
  clear: () => void;
  durationStats: () => MediaPerfDurationStat[];
  signStats: () => MediaPerfSignStat[];
};

export type MediaPerfDurationStat = {
  event: MediaPerfEventName;
  samples: number;
  p50_ms: number;
  p95_ms: number;
  avg_ms: number;
  max_ms: number;
};

export type MediaPerfSignStat = {
  surface: string;
  tab: string;
  query_mode: string;
  samples: number;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  total_batch_size: number;
  total_signed: number;
  total_failed: number;
  failed_ratio: number;
};

const MAX_MEDIA_PERF_EVENTS = 500;
const MAX_KEY_LENGTH = 48;
const MAX_STRING_LENGTH = 140;

const eventBuffer: MediaPerfEvent[] = [];

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const percentile = (sortedValues: number[], ratio: number): number => {
  if (!sortedValues.length) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * ratio))
  );
  return sortedValues[index] ?? 0;
};

const trimKey = (key: string): string => {
  const trimmed = key.trim();
  if (!trimmed) return "";
  return trimmed.length > MAX_KEY_LENGTH ? trimmed.slice(0, MAX_KEY_LENGTH) : trimmed;
};

const sanitizeString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > MAX_STRING_LENGTH ? `${trimmed.slice(0, MAX_STRING_LENGTH)}…` : trimmed;
};

const sanitizeValue = (value: unknown): Primitive => {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") return sanitizeString(value);
  return null;
};

const sanitizeData = (raw: Record<string, unknown>): MediaPerfData => {
  const out: MediaPerfData = {};
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = trimKey(rawKey);
    if (!key) continue;
    const value = sanitizeValue(rawValue);
    if (value == null) continue;
    out[key] = value;
  }
  return out;
};

const getNow = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

/**
 * Writes a media performance event into the in-memory buffer and breadcrumb stream.
 */
export const logMediaPerf = (
  event: MediaPerfEventName,
  data: Record<string, unknown> = {}
): void => {
  const sanitized = sanitizeData(data);
  eventBuffer.push({
    t: Date.now(),
    event,
    data: sanitized,
  });

  if (eventBuffer.length > MAX_MEDIA_PERF_EVENTS) {
    eventBuffer.splice(0, eventBuffer.length - MAX_MEDIA_PERF_EVENTS);
  }

  addBreadcrumb({
    type: event.includes(".sign.") ? "network" : "ui",
    message: `media_perf.${event}`,
    data: sanitized,
  });
};

/**
 * Starts a timer and returns a function that logs elapsed time under a chosen event name.
 */
export const createMediaPerfTimer = (baseData: Record<string, unknown> = {}) => {
  const startedAt = getNow();
  return (event: MediaPerfEventName, extraData: Record<string, unknown> = {}) => {
    const durationMs = Math.max(0, Math.round(getNow() - startedAt));
    logMediaPerf(event, {
      ...baseData,
      ...extraData,
      duration_ms: durationMs,
    });
  };
};

/**
 * Returns a snapshot of buffered media performance events.
 */
export const getMediaPerfSnapshot = (): MediaPerfEvent[] => eventBuffer.slice();

/**
 * Clears the buffered media performance events.
 */
export const clearMediaPerfEvents = (): void => {
  eventBuffer.length = 0;
};

/**
 * Aggregates duration-bearing events into percentile and average stats for quick local audits.
 */
export const getMediaPerfDurationStats = (): MediaPerfDurationStat[] => {
  const durationsByEvent = new Map<MediaPerfEventName, number[]>();
  for (const event of eventBuffer) {
    const durationMs = toFiniteNumber(event.data.duration_ms);
    if (durationMs == null) continue;
    const list = durationsByEvent.get(event.event) ?? [];
    list.push(durationMs);
    durationsByEvent.set(event.event, list);
  }
  return Array.from(durationsByEvent.entries())
    .map(([event, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const total = sorted.reduce((sum, value) => sum + value, 0);
      const max = sorted[sorted.length - 1] ?? 0;
      return {
        event,
        samples: sorted.length,
        p50_ms: Math.round(percentile(sorted, 0.5)),
        p95_ms: Math.round(percentile(sorted, 0.95)),
        avg_ms: Math.round(total / Math.max(1, sorted.length)),
        max_ms: Math.round(max),
      };
    })
    .sort((a, b) => b.p95_ms - a.p95_ms);
};

/**
 * Aggregates sign-batch completion telemetry by surface/tab/query-mode for tuning.
 */
export const getMediaPerfSignStats = (): MediaPerfSignStat[] => {
  type SignAccumulator = {
    durations: number[];
    totalBatchSize: number;
    totalSigned: number;
    totalFailed: number;
  };
  const buckets = new Map<string, SignAccumulator>();

  for (const event of eventBuffer) {
    if (event.event !== "media.sign.batch.completed") continue;
    const surface = String(event.data.surface ?? "unknown");
    const tab = String(event.data.tab ?? "unknown");
    const queryMode = String(event.data.query_mode ?? "default");
    const key = `${surface}|${tab}|${queryMode}`;
    const bucket = buckets.get(key) ?? {
      durations: [],
      totalBatchSize: 0,
      totalSigned: 0,
      totalFailed: 0,
    };

    const durationMs = toFiniteNumber(event.data.duration_ms);
    const batchSize = toFiniteNumber(event.data.batch_size) ?? 0;
    const signedCount = toFiniteNumber(event.data.signed_count) ?? 0;
    const failedCount = toFiniteNumber(event.data.failed_count) ?? 0;
    if (durationMs != null) bucket.durations.push(durationMs);
    bucket.totalBatchSize += batchSize;
    bucket.totalSigned += signedCount;
    bucket.totalFailed += failedCount;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const [surface, tab, queryMode] = key.split("|");
      const sortedDurations = [...bucket.durations].sort((a, b) => a - b);
      const totalDuration = sortedDurations.reduce((sum, value) => sum + value, 0);
      const samples = sortedDurations.length;
      const denominator = bucket.totalSigned + bucket.totalFailed;
      const failedRatio = denominator > 0 ? bucket.totalFailed / denominator : 0;
      return {
        surface,
        tab,
        query_mode: queryMode,
        samples,
        avg_duration_ms: samples > 0 ? Math.round(totalDuration / samples) : 0,
        p50_duration_ms: Math.round(percentile(sortedDurations, 0.5)),
        p95_duration_ms: Math.round(percentile(sortedDurations, 0.95)),
        total_batch_size: Math.round(bucket.totalBatchSize),
        total_signed: Math.round(bucket.totalSigned),
        total_failed: Math.round(bucket.totalFailed),
        failed_ratio: Number(failedRatio.toFixed(4)),
      };
    })
    .sort((a, b) => b.p95_duration_ms - a.p95_duration_ms);
};

/**
 * Installs a small debug handle on `window` for manual baseline collection in dev tools.
 */
export const installMediaPerfDebugHandle = (): void => {
  if (typeof window === "undefined") return;
  if (window.__shortpulseMediaPerf) return;
  window.__shortpulseMediaPerf = {
    snapshot: getMediaPerfSnapshot,
    clear: clearMediaPerfEvents,
    durationStats: getMediaPerfDurationStats,
    signStats: getMediaPerfSignStats,
  };
};

declare global {
  interface Window {
    __shortpulseMediaPerf?: MediaPerfDebugHandle;
  }
}
