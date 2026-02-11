/**
 * Client-side breadcrumb buffer for error triage.
 * Intentionally sanitized: never store DOM text, form values, or arbitrary payloads.
 */

export type BreadcrumbLevel = "info" | "warn" | "error";
export type BreadcrumbType = "route" | "ui" | "network";

export type Breadcrumb = {
  t: number; // epoch ms
  type: BreadcrumbType;
  level: BreadcrumbLevel;
  message: string;
  data?: Record<string, unknown>;
};

const MAX_BREADCRUMBS = 25;
const MAX_MESSAGE_LENGTH = 160;
const MAX_KEY_LENGTH = 40;
const MAX_VALUE_LENGTH = 240;

const buffer: Breadcrumb[] = [];

const sanitizeText = (value: unknown, max = MAX_VALUE_LENGTH): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

const sanitizeKey = (key: string): string => {
  const trimmed = key.trim();
  if (trimmed.length <= MAX_KEY_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_KEY_LENGTH);
};

const sanitizeValue = (value: unknown): unknown => {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") return sanitizeText(value, MAX_VALUE_LENGTH);
  return null;
};

const sanitizeData = (
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(data)) {
    const key = sanitizeKey(rawKey);
    const value = sanitizeValue(rawValue);
    if (value == null) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
};

/**
 * Redacts query values while keeping the path + query keys for debugging.
 * Example: `/api/users?email=foo&limit=50` -> `/api/users?email&limit`
 */
export const redactUrlForTelemetry = (value: string): string => {
  const input = value.trim();
  if (!input) return input;

  const splitIndex = input.indexOf("?");
  if (splitIndex === -1) return input;

  const path = input.slice(0, splitIndex);
  const query = input.slice(splitIndex + 1);
  const keys = query
    .split("&")
    .map((part) => part.split("=")[0]?.trim())
    .filter(Boolean)
    .slice(0, 12);

  if (!keys.length) return path;
  return `${path}?${keys.join("&")}`;
};

export const addBreadcrumb = (crumb: {
  type: BreadcrumbType;
  level?: BreadcrumbLevel;
  message: string;
  data?: Record<string, unknown>;
}): void => {
  const message =
    sanitizeText(crumb.message, MAX_MESSAGE_LENGTH) ??
    sanitizeText(String(crumb.message), MAX_MESSAGE_LENGTH);
  if (!message) return;

  buffer.push({
    t: Date.now(),
    type: crumb.type,
    level: crumb.level ?? "info",
    message,
    data: sanitizeData(crumb.data),
  });

  if (buffer.length > MAX_BREADCRUMBS) {
    buffer.splice(0, buffer.length - MAX_BREADCRUMBS);
  }
};

export const getBreadcrumbsSnapshot = (): Breadcrumb[] => buffer.slice();

export const clearBreadcrumbs = (): void => {
  buffer.length = 0;
};
