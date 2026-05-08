/**
 * Beginner mode is retired from the live runtime.
 * AI Studio and Character always run in expert mode.
 */

export const BEGINNER_MODE_FORCE_OFF = true;
export const BEGINNER_MODE_TOGGLE_VISIBLE = false;

/**
 * Resolves beginner mode under the canonical runtime policy.
 */
export const resolveEffectiveBeginnerMode = (_value: boolean): boolean => {
  return false;
};

/**
 * Returns whether beginner toggle controls should be rendered.
 */
export const isBeginnerModeToggleVisible = (): boolean => {
  return false;
};
