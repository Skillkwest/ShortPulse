/**
 * Shared telemetry source policy for app-error ingestion and admin telemetry queries.
 * Keeps source prefixes, known signal identifiers, and filter patterns in one place.
 */

export const TELEMETRY_SOURCE_PREFIX = "telemetry.";
export const TELEMETRY_SOURCE_LIKE_PATTERN = `${TELEMETRY_SOURCE_PREFIX}%`;
export const GROWTH_TELEMETRY_SOURCE_PREFIXES = [
  "telemetry.marketing.",
  "telemetry.auth.",
  "telemetry.billing.",
] as const;
export const GROWTH_TELEMETRY_SOURCE_LIKE_PATTERNS = GROWTH_TELEMETRY_SOURCE_PREFIXES.map(
  (prefix) => `${prefix}%`
);

export const SYNTHETIC_TEST_SOURCE_PREFIX = "admin.synthetic_test.";
export const SYNTHETIC_TEST_SOURCE_LIKE_PATTERN = `${SYNTHETIC_TEST_SOURCE_PREFIX}%`;

export const ADMISSION_LIMITED_TELEMETRY_SOURCE = "telemetry.api.fal_submit.admission_limited";
export const DIRECT_SUBMIT_ADMISSION_LIMITED_TELEMETRY_SOURCE =
  "telemetry.api.direct_submit.admission_limited";
export const CHARACTER_MODE_TELEMETRY_SOURCE = "telemetry.character_mode";
export const GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE =
  "telemetry.generation.recovery.running_hard_timeout";
export const GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE =
  "telemetry.generation.recovery.media_visible";

export const CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT =
  "character_mode_reference_refresh_empty";
export const CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT =
  "character_mode_injection_fallback.bundle_unavailable";
export const GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT = "provider_running_timeout";
export const GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT = "media_visible";

/**
 * Returns true when a source should be treated as telemetry-only (event stream, no incident).
 */
export const isTelemetrySource = (source: string): boolean => {
  return source.startsWith(TELEMETRY_SOURCE_PREFIX);
};

/**
 * Growth attribution/funnel telemetry is useful in raw event views, but should
 * not be treated as operator-actionable error work.
 */
export const isGrowthTelemetrySource = (source: string): boolean => {
  return GROWTH_TELEMETRY_SOURCE_PREFIXES.some((prefix) => source.startsWith(prefix));
};
