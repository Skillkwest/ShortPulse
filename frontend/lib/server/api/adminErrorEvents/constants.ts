/**
 * Constants for admin error-events retrieval and summary computation.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export const ACTIONABLE_PREFETCH_LIMIT = 800;

export const DEFAULT_TOTAL_15M_THRESHOLD = 40;
export const DEFAULT_HIGH_15M_THRESHOLD = 8;
export const DEFAULT_GENERATION_15M_THRESHOLD = 20;
export const DEFAULT_PROVIDER_RUNNING_TIMEOUT_15M_THRESHOLD = 2;

export const APP_ERROR_EVENTS_MISSING_REASON =
  "app_error_events is unavailable; apply sql/migrations/015_add_app_error_events.sql.";

export const ADMISSION_TIERS = ["video_long", "image_heavy", "image_standard"] as const;
export const ADMISSION_REASONS = ["global_limit", "tier_limit", "global_and_tier_limit"] as const;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
