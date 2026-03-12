/**
 * Media Library feature-flag helpers.
 * Centralizes client-side rollout gates for list API, virtualization, video budgets, and sign prefetch.
 */

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

export const MEDIA_LIST_API_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MEDIA_LIST_API_ENABLED,
  true
);

export const MEDIA_LIBRARY_VIRTUALIZATION_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
  true
);

export const MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
  true
);

export const MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
  true
);

export const MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED,
  false
);

export const AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED,
  false
);
