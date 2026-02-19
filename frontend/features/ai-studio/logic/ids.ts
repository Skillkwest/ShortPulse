/**
 * Generates short random identifiers for client-only data.
 * Keeps ephemeral output IDs unique without round-tripping to a backend.
 */
export const randomId = () => Math.random().toString(36).slice(2);

/**
 * Stable per-submission client trace id used before provider request ids exist.
 */
export const buildGenerationSubmissionTraceId = (outputId: string) =>
  `sub_${outputId.replace(/[^a-z0-9_-]/gi, "_")}_${Date.now().toString(36)}`;
