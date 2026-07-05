/**
 * Primitive parsing helpers for generated media authority hydration.
 * Keeps low-level normalization separate from generated-output query and delivery authority.
 */
export const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const toPositiveInteger = (value: unknown): number | null => {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (typeof numericValue !== "number") return null;
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return Math.max(1, Math.round(numericValue));
};

export const parseIsoTimestampMs = (value: unknown): number | null => {
  const iso = asTrimmedString(value);
  const parsed = Date.parse(iso ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

export const asTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

export const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
