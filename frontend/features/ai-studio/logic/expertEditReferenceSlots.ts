/**
 * Expert Edit secondary reference slot limits and helpers.
 * Keeps slot-count authority out of UI components so token logic, submission, and persistence agree.
 */

export type ExpertEditSecondaryImageUrls = readonly (string | null)[];
export type ExpertEditSecondarySlotIndex = number;

export const DEFAULT_EXPERT_EDIT_SECONDARY_SLOT_COUNT = 2;
export const MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT = 10;

export const createEmptyExpertEditSecondaryImageUrls = (): (string | null)[] =>
  Array.from({ length: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT }, () => null);

export const normalizeExpertEditSecondaryImageUrls = (
  values: readonly (string | null | undefined)[]
): (string | null)[] =>
  Array.from({ length: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT }, (_, index) => values[index] ?? null);

export const expertEditSecondarySlotIndexes = Array.from(
  { length: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT },
  (_, index) => index
);
