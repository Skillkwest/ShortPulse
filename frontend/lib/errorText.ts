/**
 * Utilities for turning raw API error payloads into safe, user-facing text.
 * Prevents HTML error pages or oversized payloads from leaking into UI surfaces.
 */
type NormalizeErrorTextOptions = {
  fallback?: string;
  maxLength?: number;
};

const DEFAULT_FALLBACK = "Unexpected error.";
const DEFAULT_MAX_LENGTH = 260;

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();

const looksLikeHtmlDocument = (text: string): boolean =>
  /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(text);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const pickKnownErrorField = (value: unknown): string | null => {
  if (!isObjectRecord(value)) return null;

  const primary = value.message ?? value.error ?? value.detail;
  if (typeof primary === "string" && primary.trim().length) return primary;

  const nestedError = value.error;
  if (isObjectRecord(nestedError)) {
    const nested = nestedError.message ?? nestedError.detail;
    if (typeof nested === "string" && nested.trim().length) return nested;
  }

  return null;
};

const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

/**
 * Normalizes unknown/raw error content to compact, safe text for UI.
 */
export const normalizeErrorText = (
  value: unknown,
  options: NormalizeErrorTextOptions = {}
): string => {
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

  if (value == null) return fallback;

  if (typeof value === "object") {
    const knownField = pickKnownErrorField(value);
    if (knownField) {
      return normalizeErrorText(knownField, { fallback, maxLength });
    }
  }

  const raw = collapseWhitespace(String(value));
  if (!raw) return fallback;

  if (looksLikeHtmlDocument(raw)) {
    return "Server returned an invalid error response.";
  }

  const maybeJson = raw.startsWith("{") || raw.startsWith("[");
  if (maybeJson) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const knownField = pickKnownErrorField(parsed);
      if (knownField) {
        return normalizeErrorText(knownField, { fallback, maxLength });
      }
      return truncate(raw, maxLength);
    } catch {
      return truncate(raw, maxLength);
    }
  }

  return truncate(raw, maxLength);
};
