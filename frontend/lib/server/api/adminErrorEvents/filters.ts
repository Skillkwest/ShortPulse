/**
 * SQL filter composition for admin error-events list/count queries.
 */

import {
  CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT,
  CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT,
  CHARACTER_MODE_TELEMETRY_SOURCE,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE,
  SYNTHETIC_TEST_SOURCE_LIKE_PATTERN,
  TELEMETRY_SOURCE_LIKE_PATTERN,
} from "../errorTelemetryPolicy";
import type { EventFilterInput, EventQuery } from "./types";

export const applyEventFilters = (query: EventQuery, filters: EventFilterInput): EventQuery => {
  let next = query;
  if (filters.scope && filters.scope !== "all") {
    next = next.eq("scope", filters.scope);
  }
  if (filters.severity && filters.severity !== "all") {
    next = next.eq("severity", filters.severity);
  }
  if (filters.source && filters.source !== "all") {
    next = next.eq("source", filters.source);
  }
  if (filters.synthetic === "only") {
    next = next.like("source", SYNTHETIC_TEST_SOURCE_LIKE_PATTERN);
  } else if (filters.synthetic === "exclude") {
    next = next.not("source", "like", SYNTHETIC_TEST_SOURCE_LIKE_PATTERN);
  }
  if (filters.excludeTelemetrySources) {
    next = next.not("source", "like", TELEMETRY_SOURCE_LIKE_PATTERN);
  }
  if (filters.signal === "character_mode_reference_refresh_empty") {
    next = next
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq("message", CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT);
  } else if (filters.signal === "character_mode_bundle_unavailable_fallback") {
    next = next
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq("message", CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT);
  } else if (filters.signal === "provider_running_timeout") {
    next = next
      .eq("source", GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE)
      .eq("message", GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT);
  }

  if (filters.incident === "open") {
    next = next.eq("app_error_logs.status", "open");
  } else if (filters.incident === "resolved") {
    next = next.eq("app_error_logs.status", "resolved");
  } else if (filters.incident === "ignored") {
    next = next.eq("app_error_logs.status", "ignored");
  } else if (filters.incident === "unlinked") {
    next = next.is("incident_id", null);
  }

  const searchClause = (() => {
    if (!filters.search) return null;
    const pattern = `%${filters.search.replace(/\s+/g, "%")}%`;
    return [
      `message.ilike.${pattern}`,
      `user_email.ilike.${pattern}`,
      `user_id.ilike.${pattern}`,
      `endpoint.ilike.${pattern}`,
      `route.ilike.${pattern}`,
      `request_id.ilike.${pattern}`,
      `source.ilike.${pattern}`,
      `fingerprint.ilike.${pattern}`,
      `incident_id.ilike.${pattern}`,
    ].join(",");
  })();

  if (filters.incident === "actionable") {
    if (searchClause) {
      next = next.or(searchClause);
    }
    return next;
  }

  if (searchClause) {
    next = next.or(searchClause);
  }
  return next;
};
