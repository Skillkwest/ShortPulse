/**
 * Small statistical helpers used by the performance analytics feature.
 * Focused on median, interquartile range, and timing calculations to keep UI components lean.
 */

/**
 * Compute the median of a numeric array; returns 0 for empty arrays.
 */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type IqrStats = { q1: number; q3: number; iqr: number; upperFence: number };

/**
 * Compute quartiles, IQR, and Tukey upper fence used to flag outliers.
 */
export function iqrStats(values: number[]): IqrStats {
  if (!values.length) return { q1: 0, q3: 0, iqr: 0, upperFence: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const q1Pos = (sorted.length - 1) * 0.25;
  const q3Pos = (sorted.length - 1) * 0.75;
  const lerp = (pos: number) => {
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
  };
  const q1 = lerp(q1Pos);
  const q3 = lerp(q3Pos);
  const iqr = q3 - q1;
  const upperFence = q3 + 1.5 * iqr;
  return { q1, q3, iqr, upperFence };
}

/**
 * UTC timestamp for the next midnight used in scrape cadence messaging.
 */
export function nextUtcMidnight(): string {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next.toUTCString();
}
