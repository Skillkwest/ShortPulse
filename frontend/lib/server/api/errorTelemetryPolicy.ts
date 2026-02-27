/**
 * Shared telemetry source policy for app-error ingestion and admin telemetry queries.
 * Keeps source prefixes, known signal identifiers, and filter patterns in one place.
 */

export const TELEMETRY_SOURCE_PREFIX = "telemetry.";
export const TELEMETRY_SOURCE_LIKE_PATTERN = `${TELEMETRY_SOURCE_PREFIX}%`;

export const SYNTHETIC_TEST_SOURCE_PREFIX = "admin.synthetic_test.";
export const SYNTHETIC_TEST_SOURCE_LIKE_PATTERN = `${SYNTHETIC_TEST_SOURCE_PREFIX}%`;

export const ADMISSION_LIMITED_TELEMETRY_SOURCE = "telemetry.api.fal_submit.admission_limited";
export const CHARACTER_MODE_TELEMETRY_SOURCE = "telemetry.character_mode";

export const CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT =
  "character_mode_reference_refresh_empty";
export const CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT =
  "character_mode_injection_fallback.bundle_unavailable";

/**
 * Returns true when a source should be treated as telemetry-only (event stream, no incident).
 */
export const isTelemetrySource = (source: string): boolean => {
  return source.startsWith(TELEMETRY_SOURCE_PREFIX);
};
