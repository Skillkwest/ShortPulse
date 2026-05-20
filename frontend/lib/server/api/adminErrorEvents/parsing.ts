/**
 * Query-param parsing helpers for the admin error-events API.
 */

import type { IncidentFilterValue, SignalFilterValue, SyntheticFilterValue } from "./types";

export const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

export const asFilterValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

export const asSyntheticFilter = (value: unknown): SyntheticFilterValue => {
  const normalized = asFilterValue(value);
  if (normalized === "only" || normalized === "exclude") return normalized;
  return "all";
};

export const asSignalFilter = (value: unknown): SignalFilterValue => {
  const normalized = asFilterValue(value);
  if (normalized === "character_mode_reference_refresh_empty") return normalized;
  if (normalized === "character_mode_bundle_unavailable_fallback") return normalized;
  if (normalized === "provider_running_timeout") return normalized;
  if (normalized === "project_workspace_repair_pending") return normalized;
  return "all";
};

export const asIncidentFilter = (value: unknown): IncidentFilterValue => {
  const normalized = asFilterValue(value);
  if (normalized === "actionable") return "actionable";
  if (normalized === "open") return "open";
  if (normalized === "resolved") return "resolved";
  if (normalized === "ignored") return "ignored";
  if (normalized === "unlinked") return "unlinked";
  return "all";
};

export const normalizeSearchTerm = (value: unknown): string => {
  const normalized = asFilterValue(value);
  if (!normalized) return "";
  return normalized
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
};

export const asThreshold = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};
