/**
 * Shared deep-diagnostics helpers used by /api/admin/user-health.
 * Keeps route behavior stable while decoupling common parsing/compat logic.
 */

export const DEFAULT_DEEP_LOOKBACK_DAYS = 30;
export const MAX_DEEP_LOOKBACK_DAYS = 90;

export type DeepLookupMode = "auto" | "email" | "user_id";

export type DeepQueryError = {
  message?: string;
  code?: string;
};

export const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

export const asLookupMode = (value: unknown): DeepLookupMode => {
  const normalized = asSingleString(value).trim().toLowerCase();
  if (normalized === "email") return "email";
  if (normalized === "user_id") return "user_id";
  return "auto";
};

export const asPositiveInt = (value: unknown, fallback: number): number => {
  if (value === null || typeof value === "undefined" || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

export const normalizeQueryError = (error: unknown): DeepQueryError | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

export const isSchemaCompatibilityError = (error: DeepQueryError | null): boolean => {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  if (code === "42703" || code === "PGRST204" || code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the") ||
    message.includes("schema cache") ||
    message.includes("failed to parse select parameter")
  );
};

export const parseTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const computeStatusCounts = <T extends { status: string | null }>(
  rows: T[]
): Record<string, number> =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.status ? String(row.status) : "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

export const ratioPercent = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
};

export const pushUniqueSteps = (steps: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  steps.forEach((step) => {
    const normalized = step.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    deduped.push(normalized);
  });
  return deduped;
};
