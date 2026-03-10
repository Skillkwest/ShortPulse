/**
 * Summary/health helpers for admin error-events API responses.
 */

import { ADMISSION_REASONS, ADMISSION_TIERS } from "./constants";
import type {
  AdmissionDimensionCounts,
  AdmissionSummary,
  AdmissionWindowSummary,
  CountQueryResult,
  ErrorEventsHealth,
} from "./types";

const buildAdmissionDimensionSeed = (keys: readonly string[]): AdmissionDimensionCounts => {
  const seed: AdmissionDimensionCounts = { unknown: 0 };
  for (const key of keys) {
    seed[key] = 0;
  }
  return seed;
};

const createAdmissionWindowSummary = (): AdmissionWindowSummary => ({
  total: 0,
  byTier: buildAdmissionDimensionSeed(ADMISSION_TIERS),
  byReason: buildAdmissionDimensionSeed(ADMISSION_REASONS),
});

export const createAdmissionSummary = (): AdmissionSummary => ({
  last15m: createAdmissionWindowSummary(),
  lastHour: createAdmissionWindowSummary(),
  last24h: createAdmissionWindowSummary(),
});

const asIsoTimeMs = (value: unknown): number | null => {
  if (typeof value !== "string" || !value.trim().length) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asMetadataRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asAdmissionDimension = (
  value: unknown,
  allowedValues: readonly string[]
): string | "unknown" => {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  return allowedValues.includes(normalized) ? normalized : "unknown";
};

const incrementAdmissionSummary = (
  window: AdmissionWindowSummary,
  tier: string | "unknown",
  reason: string | "unknown"
) => {
  window.total += 1;
  window.byTier[tier] = (window.byTier[tier] ?? 0) + 1;
  window.byReason[reason] = (window.byReason[reason] ?? 0) + 1;
};

export const buildAdmissionSummary = ({
  rows,
  since15mMs,
  sinceHourMs,
  since24hMs,
}: {
  rows: unknown[] | null;
  since15mMs: number;
  sinceHourMs: number;
  since24hMs: number;
}): AdmissionSummary => {
  const summary = createAdmissionSummary();
  const entries = Array.isArray(rows) ? rows : [];
  for (const entry of entries) {
    const row = asMetadataRecord(entry);
    if (!row) continue;
    const occurredAtMs = asIsoTimeMs(row.occurred_at);
    if (occurredAtMs === null || occurredAtMs < since24hMs) continue;
    const metadata = asMetadataRecord(row.metadata);
    const tier = asAdmissionDimension(metadata?.tier, ADMISSION_TIERS);
    const reason = asAdmissionDimension(metadata?.reason, ADMISSION_REASONS);
    incrementAdmissionSummary(summary.last24h, tier, reason);
    if (occurredAtMs >= sinceHourMs) {
      incrementAdmissionSummary(summary.lastHour, tier, reason);
    }
    if (occurredAtMs >= since15mMs) {
      incrementAdmissionSummary(summary.last15m, tier, reason);
    }
  }
  return summary;
};

export const countOrZero = (result: CountQueryResult): number => Number(result.count ?? 0);

export const countErrorMessage = (result: CountQueryResult): string | null =>
  result.error?.message ?? null;

export const isMissingEventsTableError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  if (!normalized.includes("app_error_events")) return false;
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table") ||
    (normalized.includes("relation") && normalized.includes("does not exist"))
  );
};

export const degradedHealth = (reason: string): ErrorEventsHealth => ({
  eventsTableAvailable: false,
  degraded: true,
  reason,
});

export const healthyState = (): ErrorEventsHealth => ({
  eventsTableAvailable: true,
  degraded: false,
  reason: null,
});

export const buildDegradedEventsPayload = (params: {
  perPage: number;
  total15mThreshold: number;
  high15mThreshold: number;
  generation15mThreshold: number;
  providerRunningTimeout15mThreshold: number;
  reason: string;
}) => ({
  events: [],
  summary: {
    last15mCount: 0,
    high15mCount: 0,
    generation15mCount: 0,
    providerRunningTimeout15mCount: 0,
    lastHourCount: 0,
    last24hCount: 0,
    app24hCount: 0,
    generation24hCount: 0,
    high24hCount: 0,
    characterModeReferenceRefreshEmptyLastHourCount: 0,
    characterModeReferenceRefreshEmptyLast24hCount: 0,
    characterModeBundleUnavailableFallbackLastHourCount: 0,
    characterModeBundleUnavailableFallbackLast24hCount: 0,
    admissionDeniedTelemetry: createAdmissionSummary(),
    total15mThreshold: params.total15mThreshold,
    high15mThreshold: params.high15mThreshold,
    generation15mThreshold: params.generation15mThreshold,
    providerRunningTimeout15mThreshold: params.providerRunningTimeout15mThreshold,
    total15mBreached: false,
    high15mBreached: false,
    generation15mBreached: false,
    providerRunningTimeout15mBreached: false,
  },
  health: degradedHealth(params.reason),
  pagination: {
    page: 1,
    perPage: params.perPage,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
});
