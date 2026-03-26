/**
 * Canonical time thresholds for admin user-health diagnostics.
 * Keeps operator visibility thresholds explicit and separate from runtime cleanup policies.
 */
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;

export const STUCK_GENERATION_WARNING_MS = 30 * MINUTE_MS;
export const STUCK_GENERATION_CRITICAL_MS = 60 * MINUTE_MS;
export const PROVIDER_ATTACHED_RESERVED_HOLD_CRITICAL_MS = 60 * MINUTE_MS;
export const PRE_SUBMIT_RESERVED_HOLD_WARNING_MS = 15 * MINUTE_MS;
