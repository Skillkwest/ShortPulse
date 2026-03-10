/**
 * Presentation-safe helper utilities for admin error incident/event views.
 * Keeps deterministic formatting/filtering logic out of React component files.
 */

import type {
  AdminErrorEventIncidentFilter,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorStatus,
} from "../types";

/**
 * Formats ISO-ish timestamps for display in the operator panel.
 */
export const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

/**
 * Converts dotted source identifiers into readable labels.
 */
export const sourceLabel = (value: string): string =>
  value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");

/**
 * User-facing label for event signal filter values.
 */
export const eventSignalFilterLabel = (value: AdminErrorEventSignalFilter): string => {
  if (value === "character_mode_reference_refresh_empty") {
    return "Character Mode: reference refresh empty";
  }
  if (value === "character_mode_bundle_unavailable_fallback") {
    return "Character Mode: bundle unavailable fallback";
  }
  if (value === "provider_running_timeout") {
    return "Generation Recovery: provider running timeout";
  }
  return "All event signals";
};

/**
 * User-facing label for event incident filter values.
 */
export const eventIncidentFilterLabel = (value: AdminErrorEventIncidentFilter): string => {
  if (value === "actionable") return "Actionable (open + unlinked)";
  if (value === "open") return "Open incidents only";
  if (value === "resolved") return "Resolved incidents only";
  if (value === "ignored") return "Ignored incidents only";
  if (value === "unlinked") return "Unlinked events only";
  return "All incident states";
};

/**
 * Predicate used by event list filters and pagination auto-advance logic.
 */
export const eventMatchesIncidentFilter = (
  row: AdminErrorEventRow,
  filter: AdminErrorEventIncidentFilter
): boolean => {
  if (filter === "all") return true;
  if (filter === "actionable") {
    return row.incidentStatus === "open" || row.incidentId === null;
  }
  if (filter === "unlinked") {
    return row.incidentId === null;
  }
  return row.incidentStatus === filter;
};

/**
 * User-facing label for incident status chips.
 */
export const incidentStatusLabel = (status: AdminErrorStatus | null): string => {
  if (status === "resolved") return "Resolved";
  if (status === "ignored") return "Ignored";
  if (status === "open") return "Open";
  return "Unlinked";
};
