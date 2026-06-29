/**
 * AI Studio stability telemetry and pressure quarantine helpers.
 * Keeps crash-adjacent diagnostics low-cardinality and avoids user-visible UI changes.
 */
import { reportAppError } from "../../../lib/appErrorReporter";

export type AiStudioStabilityEvent =
  | "session_started"
  | "visibility_hidden"
  | "pagehide"
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

/**
 * Emits one AI Studio stability event through the existing telemetry-only error pipeline.
 */
export const reportAiStudioStabilityEvent = (
  event: AiStudioStabilityEvent,
  metadata: StabilityMetadata = {},
  options: StabilityEventOptions = {}
): void => {
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
