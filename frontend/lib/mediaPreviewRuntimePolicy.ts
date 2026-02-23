/**
 * Shared policy helpers for media preview signing runtime surfaces.
 * Centralizes device-aware sign-budget resolution and retry-cap checks.
 */

export type MediaSignBudget = {
  initialSignLimit: number;
  prefetchWindow: number;
  signBatchSize: number;
};

export type MediaSignBudgetProfile = {
  desktop: MediaSignBudget;
  smallScreen: MediaSignBudget;
  constrained: MediaSignBudget;
  smallScreenQuery: string;
};

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

export const MEDIA_PREVIEW_SIGNED_URL_RETRY_MAX_ATTEMPTS = 3;
export const MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM = 3;

export const canRetryMediaPreviewSignedUrl = (
  attempts: number,
  maxAttempts = MEDIA_PREVIEW_SIGNED_URL_RETRY_MAX_ATTEMPTS
): boolean => attempts < maxAttempts;

export const canAttemptMediaPreviewSignBatch = (
  attempts: number,
  maxAttempts = MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM
): boolean => attempts < maxAttempts;

export const resolveMediaPreviewSignBudget = (profile: MediaSignBudgetProfile): MediaSignBudget => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return profile.desktop;
  }
  const nav = navigator as NavigatorWithConnection;
  const isSmallScreen =
    typeof window.matchMedia === "function" && window.matchMedia(profile.smallScreenQuery).matches;
  const saveData = nav.connection?.saveData === true;
  const effectiveType = (nav.connection?.effectiveType ?? "").toLowerCase();
  const isSlowNetwork = effectiveType.includes("2g");
  const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  if (saveData || isSlowNetwork || isLowMemory) {
    return profile.constrained;
  }
  if (isSmallScreen) {
    return profile.smallScreen;
  }
  return profile.desktop;
};
