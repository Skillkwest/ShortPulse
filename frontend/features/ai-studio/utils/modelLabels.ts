/**
 * Shared display-label helpers for AI Studio model picker surfaces.
 */
/**
 * Removes workflow/provider suffixes that are useful in the catalog but noisy in compact UI.
 */
export const stripEditLabel = (label: string) =>
  label
    .replace(/\s+\(Kie\)$/i, "")
    .replace(/\s+Edit$/i, "")
    .trim();
