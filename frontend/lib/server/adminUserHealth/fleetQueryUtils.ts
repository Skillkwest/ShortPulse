/**
 * Query/result normalization helpers for fleet scan data loads.
 */

export type QueryError = {
  message?: string;
  code?: string;
};

export const normalizeQueryError = (error: unknown): QueryError | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

export const isSchemaCompatibilityError = (error: QueryError | null): boolean => {
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

export const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

export const chunk = <T>(rows: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    out.push(rows.slice(index, index + size));
  }
  return out;
};
