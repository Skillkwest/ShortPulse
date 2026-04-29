/**
 * Provider-key normalization helpers.
 * Keeps provider alias matching consistent across adapter dispatchers.
 */

/**
 * Normalizes provider identifiers for stable comparisons.
 */
export const normalizeProviderKey = (value: string): string => value.trim().toLowerCase();

/**
 * Returns true when a provider key maps to the Fal family.
 */
export const isFalProviderKey = (provider: string): boolean => {
  const normalized = normalizeProviderKey(provider);
  return normalized === "fal";
};

/**
 * Returns true when a provider key maps to the Kie family.
 */
export const isKieProviderKey = (provider: string): boolean => {
  const normalized = normalizeProviderKey(provider);
  return normalized === "kie";
};
