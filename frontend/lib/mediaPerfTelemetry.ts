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
};

const MAX_MEDIA_PERF_EVENTS = 500;
const MAX_KEY_LENGTH = 48;
const MAX_STRING_LENGTH = 140;

const eventBuffer: MediaPerfEvent[] = [];

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
 * Installs a small debug handle on `window` for manual baseline collection in dev tools.
 */
export const installMediaPerfDebugHandle = (): void => {
  if (typeof window === "undefined") return;
  if (window.__shortpulseMediaPerf) return;
  window.__shortpulseMediaPerf = {
    snapshot: getMediaPerfSnapshot,
    clear: clearMediaPerfEvents,
  };
};

declare global {
  interface Window {
    __shortpulseMediaPerf?: MediaPerfDebugHandle;
  }
}
