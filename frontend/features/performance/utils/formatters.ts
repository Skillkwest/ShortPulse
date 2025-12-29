/**
 * Formatting helpers for performance analytics.
 * Keeps number, date, and link formatting consistent across tooltips, cards, and filters.
 * Contains only pure helpers with no framework dependencies for easy reuse.
 */

/**
 * Format a whole number with locale separators.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Render a decimal ratio as a percentage string (e.g. 0.52 -> "52.0%").
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Render a decimal ratio as a percentage with configurable precision (default 2 decimals).
 */
export function formatRate(value: number, digits: number = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Render a percentile as a string with suffix (e.g. 95 -> "95.0pctl").
 */
export function formatPercentile(value: number): string {
  return `${value.toFixed(1)}pctl`;
}

/**
 * Compact large integers for UI badges (e.g. 120000 -> "120K").
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Humanize recency relative to now (hours or minutes ago).
 */
export function formatAgo(publishIso: string): string {
  const diffHours = (Date.now() - new Date(publishIso).getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return `${Math.max(1, Math.round(diffHours * 60))}m ago`;
  if (diffHours < 48) return `${Math.round(diffHours)}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

/**
 * Normalize handles so the UI always includes a leading @ symbol.
 */
export function formatHandle(handle?: string | null): string {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

/**
 * Simplify a full URL into host/slug for compact display; falls back to truncation on parse errors.
 */
export function prettifyUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const slug = pathname.split("/").filter(Boolean).slice(-1)[0];
    const host = hostname.replace(/^www\./, "");
    return slug ? `${host}/${slug}` : host;
  } catch {
    return url.length > 42 ? `${url.slice(0, 42)}…` : url;
  }
}
