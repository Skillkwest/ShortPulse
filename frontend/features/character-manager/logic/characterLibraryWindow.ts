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
      visibleCount: 0,
      hiddenCount: 0,
    };
  }

  const requested = normalizeCount(requestedVisibleCount);
  const selectedIndex = Math.max(-1, Math.floor(selectedCharacterIndex));
  const selectedVisibilityFloor = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const baseVisible =
    total <= CHARACTER_LIBRARY_SMOOTH_TARGET
      ? total
      : Math.max(CHARACTER_LIBRARY_SMOOTH_TARGET, requested);
  const visibleCount = Math.min(total, Math.max(baseVisible, selectedVisibilityFloor));
  return {
    visibleCount,
    hiddenCount: Math.max(0, total - visibleCount),
  };
};
