/**
 * Element reference-slot helpers.
 * Keeps image reference reordering as a small pure operation for panel wiring and tests.
 */

export const ELEMENT_IMAGE_REFERENCE_SLOT_LIMIT = 6;

/**
 * Swaps one populated element image reference slot with another slot.
 */
export const swapElementImageReferenceSlots = (
  referenceUrls: string[],
  sourceIndex: number,
  targetIndex: number,
  maxSlots = ELEMENT_IMAGE_REFERENCE_SLOT_LIMIT
): string[] | null => {
  if (
    !Number.isInteger(sourceIndex) ||
    !Number.isInteger(targetIndex) ||
    !Number.isInteger(maxSlots) ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= maxSlots ||
    targetIndex >= maxSlots ||
    sourceIndex === targetIndex
  ) {
    return null;
  }

  const nextReferenceUrls = referenceUrls.slice(0, maxSlots);
  while (nextReferenceUrls.length <= Math.max(sourceIndex, targetIndex)) {
    nextReferenceUrls.push("");
  }

  const sourceReferenceUrl = nextReferenceUrls[sourceIndex] ?? "";
  if (!sourceReferenceUrl.trim()) return null;

  nextReferenceUrls[sourceIndex] = nextReferenceUrls[targetIndex] ?? "";
  nextReferenceUrls[targetIndex] = sourceReferenceUrl;
  return nextReferenceUrls;
};
