/**
 * Shared retry policy for AI Studio persistence-side background repair work.
 * Centralizes small bounded retry budgets so autosave and local durability stay aligned.
 */
export const AI_STUDIO_AUTOSAVE_MAX_ATTEMPTS_PER_OUTPUT = 2;
export const AI_STUDIO_DURABILITY_MAX_ATTEMPTS_PER_SIGNATURE = 2;
export const AI_STUDIO_DURABILITY_RETRY_DELAY_MS = 1_500;
