/**
 * AI Studio stability telemetry and pressure quarantine helpers.
 * Keeps crash-adjacent diagnostics low-cardinality and avoids user-visible UI changes.
 */
import { reportAppError } from "../../../lib/appErrorReporter";
import { reportBrowserSessionHealthEvent } from "../../../lib/browserSessionHealth";

export type AiStudioStabilityEvent =
  | "session_started"
  | "visibility_hidden"
  | "visibility_visible"
  | "pagehide"
  | "pageshow"
  | "beforeunload"
  | "unload"
  | "window_blur"
  | "window_focus"
  | "first_grid_commit"
  | "pressure_level_changed"
  | "pressure_quarantine_set";

type StabilityMetadata = Record<string, string | number | boolean | null>;

type PressureQuarantineRecord = {
  expiresAt: number;
  level: 1 | 2;
  reason: string;
  updatedAt: number;
};

type AiStudioCrashEvidenceMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number | null;
  usedToTotalRatio: number | null;
  usedToLimitRatio: number | null;
} | null;

export type AiStudioCrashEvidenceSnapshot = {
  capturedAt: string;
  path: string | null;
  search: string | null;
  readyState: string | null;
  visibilityState: string | null;
  pressureQuarantine: PressureQuarantineRecord | null;
  memory: AiStudioCrashEvidenceMemory;
  resources: {
    total: number;
    fetch: number;
    api: number;
    totalTransferBytes: number;
    totalDecodedBytes: number;
  };
  dom: {
    nodes: number;
    images: number;
    videos: number;
    audios: number;
    canvases: number;
    extensionRoots: number;
  };
};

type AiStudioCrashEvidenceWindow = Window & {
  __shortpulseAiStudioCrashEvidence?: {
    snapshot: () => AiStudioCrashEvidenceSnapshot;
  };
};

type PressureQuarantineInput = {
  level: 0 | 1 | 2;
  longTaskP95Ms: number | null;
  maxInputStallMs: number;
  heapUsageRatio: number | null;
};

type StabilityEventOptions = {
  message?: string;
};

const STABILITY_SOURCE_PREFIX = "telemetry.ai_studio.stability";
const PRESSURE_QUARANTINE_STORAGE_KEY = "shortpulse.ai_studio.pressure_quarantine.v1";
const PRESSURE_QUARANTINE_TTL_MS = 10 * 60 * 1000;
const SEVERE_LONG_TASK_MS = 100;
const SEVERE_INPUT_STALL_MS = 800;
const SEVERE_HEAP_RATIO = 0.86;

const nowMs = (): number => Date.now();

const readStoredPressureQuarantine = (): PressureQuarantineRecord | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PRESSURE_QUARANTINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PressureQuarantineRecord>;
    if (
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.updatedAt !== "number" ||
      (parsed.level !== 1 && parsed.level !== 2) ||
      typeof parsed.reason !== "string"
    ) {
      window.sessionStorage.removeItem(PRESSURE_QUARANTINE_STORAGE_KEY);
      return null;
    }
    if (parsed.expiresAt <= nowMs()) {
      window.sessionStorage.removeItem(PRESSURE_QUARANTINE_STORAGE_KEY);
      return null;
    }
    return {
      expiresAt: parsed.expiresAt,
      level: parsed.level,
      reason: parsed.reason,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

const writePressureQuarantine = (record: PressureQuarantineRecord): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PRESSURE_QUARANTINE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Best-effort pressure memory only.
  }
};

const readCrashEvidenceMemory = (): AiStudioCrashEvidenceMemory => {
  if (typeof performance === "undefined") return null;
  const memory = (
    performance as Performance & {
      memory?: {
        usedJSHeapSize?: number;
        totalJSHeapSize?: number;
        jsHeapSizeLimit?: number;
      };
    }
  ).memory;
  const used = memory?.usedJSHeapSize;
  const total = memory?.totalJSHeapSize;
  if (typeof used !== "number" || typeof total !== "number" || total <= 0) return null;
  const limit = typeof memory?.jsHeapSizeLimit === "number" ? memory.jsHeapSizeLimit : null;
  return {
    usedJSHeapSize: used,
    totalJSHeapSize: total,
    jsHeapSizeLimit: limit,
    usedToTotalRatio: Math.round((used / total) * 1000) / 1000,
    usedToLimitRatio: limit && limit > 0 ? Math.round((used / limit) * 1000) / 1000 : null,
  };
};

const readCrashEvidenceResources = (): AiStudioCrashEvidenceSnapshot["resources"] => {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return {
      total: 0,
      fetch: 0,
      api: 0,
      totalTransferBytes: 0,
      totalDecodedBytes: 0,
    };
  }
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  return resources.reduce(
    (summary, resource) => {
      const name = typeof resource.name === "string" ? resource.name : "";
      summary.total += 1;
      if (resource.initiatorType === "fetch") summary.fetch += 1;
      if (name.includes("/api/")) summary.api += 1;
      summary.totalTransferBytes += Math.max(0, Math.round(resource.transferSize || 0));
      summary.totalDecodedBytes += Math.max(0, Math.round(resource.decodedBodySize || 0));
      return summary;
    },
    {
      total: 0,
      fetch: 0,
      api: 0,
      totalTransferBytes: 0,
      totalDecodedBytes: 0,
    }
  );
};

const readCrashEvidenceDom = (): AiStudioCrashEvidenceSnapshot["dom"] => {
  if (typeof document === "undefined") {
    return {
      nodes: 0,
      images: 0,
      videos: 0,
      audios: 0,
      canvases: 0,
      extensionRoots: 0,
    };
  }
  return {
    nodes: document.getElementsByTagName("*").length,
    images: document.images.length,
    videos: document.querySelectorAll("video").length,
    audios: document.querySelectorAll("audio").length,
    canvases: document.querySelectorAll("canvas").length,
    extensionRoots: document.querySelectorAll(
      '[id*="extension" i], [class*="extension" i], iframe[src^="chrome-extension://"], script[src^="chrome-extension://"], [src^="chrome-extension://"]'
    ).length,
  };
};

/**
 * Reads local browser evidence for crash-adjacent AI Studio investigations.
 * This intentionally does not send network telemetry or expose secrets.
 */
export const readAiStudioCrashEvidenceSnapshot = (): AiStudioCrashEvidenceSnapshot => ({
  capturedAt: new Date().toISOString(),
  path: typeof window === "undefined" ? null : (window.location?.pathname ?? null),
  search: typeof window === "undefined" ? null : (window.location?.search ?? null),
  readyState: typeof document === "undefined" ? null : document.readyState,
  visibilityState: typeof document === "undefined" ? null : document.visibilityState,
  pressureQuarantine: readStoredPressureQuarantine(),
  memory: readCrashEvidenceMemory(),
  resources: readCrashEvidenceResources(),
  dom: readCrashEvidenceDom(),
});

/**
 * Installs a local window handle for manual crash forensics in affected browsers.
 */
export const installAiStudioCrashEvidenceHandle = (): (() => void) => {
  if (typeof window === "undefined") return () => undefined;
  const evidenceWindow = window as AiStudioCrashEvidenceWindow;
  const handle = {
    snapshot: readAiStudioCrashEvidenceSnapshot,
  };
  evidenceWindow.__shortpulseAiStudioCrashEvidence = handle;
  return () => {
    if (evidenceWindow.__shortpulseAiStudioCrashEvidence === handle) {
      delete evidenceWindow.__shortpulseAiStudioCrashEvidence;
    }
  };
};

/**
 * Emits one AI Studio stability event through the existing telemetry-only error pipeline.
 */
export const reportAiStudioStabilityEvent = (
  event: AiStudioStabilityEvent,
  metadata: StabilityMetadata = {},
  options: StabilityEventOptions = {}
): void => {
  if (
    event === "pressure_level_changed" ||
    event === "pressure_quarantine_set" ||
    event === "first_grid_commit"
  ) {
    reportBrowserSessionHealthEvent("pressure_snapshot", metadata);
  }

  void reportAppError({
    source: `${STABILITY_SOURCE_PREFIX}.${event}`,
    scope: "app",
    severity: "medium",
    message: options.message ?? `ai_studio_stability.${event}`,
    metadata,
  });
};

/**
 * Returns the active short-lived pressure floor for newly rendered AI Studio surfaces.
 */
export const resolveAiStudioPressureQuarantineLevel = (): 0 | 1 | 2 => {
  return readStoredPressureQuarantine()?.level ?? 0;
};

/**
 * Applies the active pressure quarantine floor to an existing adaptive pressure level.
 */
export const applyAiStudioPressureQuarantineLevel = <TLevel extends 0 | 1 | 2>(
  level: TLevel
): 0 | 1 | 2 => {
  return Math.max(level, resolveAiStudioPressureQuarantineLevel()) as 0 | 1 | 2;
};

/**
 * Stores a short-lived conservative-mode hint after severe repeated pressure.
 */
export const maybeMarkAiStudioPressureQuarantine = ({
  level,
  longTaskP95Ms,
  maxInputStallMs,
  heapUsageRatio,
}: PressureQuarantineInput): boolean => {
  if (level < 2) return false;
  if (readStoredPressureQuarantine()) return false;

  const severeLongTask = typeof longTaskP95Ms === "number" && longTaskP95Ms >= SEVERE_LONG_TASK_MS;
  const severeInputStall = maxInputStallMs >= SEVERE_INPUT_STALL_MS;
  const severeHeap = typeof heapUsageRatio === "number" && heapUsageRatio >= SEVERE_HEAP_RATIO;
  if (!severeLongTask && !severeInputStall && !severeHeap) return false;

  const updatedAt = nowMs();
  const reason = severeInputStall ? "input_stall" : severeLongTask ? "long_task" : "heap_pressure";
  writePressureQuarantine({
    expiresAt: updatedAt + PRESSURE_QUARANTINE_TTL_MS,
    level: 2,
    reason,
    updatedAt,
  });
  reportAiStudioStabilityEvent("pressure_quarantine_set", {
    pressure_level: level,
    reason,
    long_task_p95_ms: longTaskP95Ms,
    max_input_stall_ms: maxInputStallMs,
    heap_usage_ratio: heapUsageRatio,
  });
  return true;
};

export const clearAiStudioPressureQuarantineForTests = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PRESSURE_QUARANTINE_STORAGE_KEY);
};
