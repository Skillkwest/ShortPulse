/**
 * Shared server-side error normalization helpers.
 * Converts heterogeneous provider/PostgREST/internal error payloads into user-safe text.
 */

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const toErrorMessage = (error: unknown, fallback: string): string => {
  const direct =
    asTrimmedString(error) ?? (error instanceof Error ? asTrimmedString(error.message) : null);
  if (direct) return direct;

  if (Array.isArray(error)) {
    const joined = error
      .map((entry) => toErrorMessage(entry, ""))
      .filter((entry) => entry.length > 0)
      .join(" ");
    return joined.length > 0 ? joined : fallback;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      asTrimmedString(record.message) ??
      asTrimmedString(record.detail) ??
      asTrimmedString(record.details) ??
      asTrimmedString(record.reason) ??
      asTrimmedString(record.error) ??
      asTrimmedString(record.hint);
    if (message) return message;
  }

  return fallback;
};
