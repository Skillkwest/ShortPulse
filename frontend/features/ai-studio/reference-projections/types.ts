/**
 * Reference projection contracts.
 * Encodes explicit surface semantics for all refs vs quick slots while archiving remains separate.
 */
export type ReferenceProjectionState = {
  quickSlotIds: string[];
  removedFromAllRefsIds: string[];
};
