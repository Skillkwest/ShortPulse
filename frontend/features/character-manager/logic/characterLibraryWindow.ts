/**
 * Character Library visibility policy for progressive rendering.
 * Keeps 0-50 fully smooth and progressively reveals larger lists.
 */

export const CHARACTER_LIBRARY_SMOOTH_TARGET = 50;
export const CHARACTER_LIBRARY_EXPAND_STEP = 25;

export type CharacterLibraryWindowInput = {
  totalCharacterCount: number;
  selectedCharacterIndex: number;
  requestedVisibleCount: number;
};

export type CharacterLibraryWindow = {
  startIndex: number;
  endIndexExclusive: number;
  visibleCount: number;
  hiddenCount: number;
};

const normalizeCount = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/**
 * Resolve the visible/hidden character counts for progressive list rendering.
 * Ensures the selected character remains visible even when the list is windowed.
 */
export const resolveCharacterLibraryWindow = ({
  totalCharacterCount,
  selectedCharacterIndex,
  requestedVisibleCount,
}: CharacterLibraryWindowInput): CharacterLibraryWindow => {
  const total = normalizeCount(totalCharacterCount);
  if (!total) {
    return {
      startIndex: 0,
      endIndexExclusive: 0,
      visibleCount: 0,
      hiddenCount: 0,
    };
  }

  const requested = normalizeCount(requestedVisibleCount);
  const selectedIndex = Math.max(-1, Math.floor(selectedCharacterIndex));
  const baseVisible =
    total <= CHARACTER_LIBRARY_SMOOTH_TARGET
      ? total
      : Math.max(CHARACTER_LIBRARY_SMOOTH_TARGET, requested);
  const visibleCount = Math.min(total, baseVisible);
  const anchoredStartIndex = selectedIndex >= visibleCount ? selectedIndex - visibleCount + 1 : 0;
  const startIndex = Math.min(Math.max(0, anchoredStartIndex), Math.max(0, total - visibleCount));
  const endIndexExclusive = Math.min(total, startIndex + visibleCount);
  return {
    startIndex,
    endIndexExclusive,
    visibleCount,
    hiddenCount: Math.max(0, total - visibleCount),
  };
};
