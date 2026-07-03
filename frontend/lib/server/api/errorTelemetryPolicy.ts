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
export const AI_STUDIO_STABILITY_TELEMETRY_SOURCE_PREFIX = "telemetry.ai_studio.stability.";
export const ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_PREFIXES = [
  ...GROWTH_TELEMETRY_SOURCE_PREFIXES,
  AI_STUDIO_STABILITY_TELEMETRY_SOURCE_PREFIX,
] as const;
export const ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_LIKE_PATTERNS =
  ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_PREFIXES.map((prefix) => `${prefix}%`);

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
export const PROJECT_WORKSPACE_REPAIR_PENDING_TELEMETRY_SOURCE =
  "telemetry.ai_studio.project_workspace.repair_pending";

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
 * Returns true when a source should keep rich browser context such as
 * breadcrumbs in the raw event row.
 */
export const shouldRetainRichEventContext = (params: {
  source: string;
  severity?: string | null;
}): boolean => {
  if (!isTelemetrySource(params.source)) return true;
  return params.severity === "high";
};

/**
 * Telemetry rows keep user_id for aggregate/operator correlation, but avoid
 * duplicating email snapshots in the raw event stream.
 */
export const shouldRetainEventUserEmail = (source: string): boolean => {
  return !isTelemetrySource(source);
};

/**
 * Growth attribution/funnel telemetry is useful in raw event views, but should
 * not be treated as operator-actionable error work.
 */
export const isGrowthTelemetrySource = (source: string): boolean => {
  return GROWTH_TELEMETRY_SOURCE_PREFIXES.some((prefix) => source.startsWith(prefix));
};

/**
 * Routine telemetry remains available in raw event/source views, but should not
 * create default operator work in the Actionable queue.
 */
export const isRoutineNonActionableTelemetrySource = (source: string): boolean => {
  return ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_PREFIXES.some((prefix) =>
    source.startsWith(prefix)
  );
};
