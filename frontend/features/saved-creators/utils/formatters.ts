/**
 * Formatting helpers for saved creator metrics.
 */
export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
