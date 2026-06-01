/**
 * Shared metadata helpers for terminal convergence paths.
 * Preserves shared abandonment/suppression semantics without forcing lane vocabularies together.
 */

type JsonObject = Record<string, unknown>;

export type TerminalConvergenceAbandonmentState = {
  abandoned: boolean;
  noRefund: boolean;
};

/**
 * Stamp the canonical abandonment/suppression metadata used by terminal convergence.
 */
export const applyTerminalAbandonmentMetadata = ({
  metadata,
  abandonment,
}: {
  metadata: JsonObject;
  abandonment: TerminalConvergenceAbandonmentState;
}): JsonObject => {
  if (!abandonment.abandoned) return metadata;
  return {
    ...metadata,
    user_abandoned: true,
    abandoned_no_refund: abandonment.noRefund,
    hidden_in_reference_grid: true,
  };
};
