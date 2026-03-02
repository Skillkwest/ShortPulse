/**
 * Runtime policy for temporary beginner-mode lockdown behavior.
 * Centralizes env parsing so pages/components use deterministic booleans.
 */

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const BEGINNER_MODE_FORCE_OFF_DEFAULT = true;
const BEGINNER_MODE_TOGGLE_VISIBLE_DEFAULT = false;

export const BEGINNER_MODE_FORCE_OFF = parseBoolean(
  process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF,
  BEGINNER_MODE_FORCE_OFF_DEFAULT
);

export const BEGINNER_MODE_TOGGLE_VISIBLE = parseBoolean(
  process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE,
  BEGINNER_MODE_TOGGLE_VISIBLE_DEFAULT
);

/**
 * Resolves beginner mode under runtime policy precedence.
 */
export const resolveEffectiveBeginnerMode = (value: boolean): boolean => {
  if (BEGINNER_MODE_FORCE_OFF) return false;
  return value;
};

/**
 * Returns whether beginner toggle controls should be rendered.
 * Force-off always hides the toggle regardless of visibility flag.
 */
export const isBeginnerModeToggleVisible = (): boolean => {
  if (BEGINNER_MODE_FORCE_OFF) return false;
  return BEGINNER_MODE_TOGGLE_VISIBLE;
};
