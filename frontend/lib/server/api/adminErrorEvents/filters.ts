/**
 * SQL filter composition for admin error-events list/count queries.
 */

import {
  CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT,
  CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT,
  CHARACTER_MODE_TELEMETRY_SOURCE,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE,
  PROJECT_WORKSPACE_REPAIR_PENDING_TELEMETRY_SOURCE,
  GROWTH_TELEMETRY_SOURCE_LIKE_PATTERNS,
  ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_LIKE_PATTERNS,
  SYNTHETIC_TEST_SOURCE_LIKE_PATTERN,
  TELEMETRY_SOURCE_LIKE_PATTERN,
} from "../errorTelemetryPolicy";
import { UUID_PATTERN } from "./constants";
import type { EventFilterInput, EventQuery } from "./types";

const buildSearchClause = (search: string): string | null => {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) return null;

  if (UUID_PATTERN.test(trimmedSearch)) {
    return [
      `id.eq.${trimmedSearch}`,
      `user_id.eq.${trimmedSearch}`,
      `incident_id.eq.${trimmedSearch}`,
      `request_id.eq.${trimmedSearch}`,
    ].join(",");
  }

  const pattern = `%${trimmedSearch.replace(/\s+/g, "%")}%`;
  return [
    `message.ilike.${pattern}`,
    `user_email.ilike.${pattern}`,
    `endpoint.ilike.${pattern}`,
    `route.ilike.${pattern}`,
    `request_id.ilike.${pattern}`,
    `source.ilike.${pattern}`,
    `fingerprint.ilike.${pattern}`,
  ].join(",");
};

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
  if (filters.excludeGrowthTelemetrySources) {
    for (const pattern of GROWTH_TELEMETRY_SOURCE_LIKE_PATTERNS) {
      next = next.not("source", "like", pattern);
    }
  }
  if (filters.excludeRoutineNonActionableTelemetrySources) {
    for (const pattern of ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_LIKE_PATTERNS) {
      next = next.not("source", "like", pattern);
    }
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
  } else if (filters.signal === "project_workspace_repair_pending") {
    next = next.eq("source", PROJECT_WORKSPACE_REPAIR_PENDING_TELEMETRY_SOURCE);
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

  const searchClause = filters.search ? buildSearchClause(filters.search) : null;

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
