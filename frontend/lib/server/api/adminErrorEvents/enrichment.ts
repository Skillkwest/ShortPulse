/**
 * Event enrichment helpers for admin error-events route.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { UUID_PATTERN } from "./constants";
import type { EnrichedEventsResult, EventRow, IncidentStatusRow } from "./types";

/**
 * Actionable events are either unlinked rows or rows linked to an open incident.
 */
export const isActionableEvent = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const incidentId = typeof row.incident_id === "string" ? row.incident_id : null;
  if (!incidentId) return true;
  return typeof row.incident_status === "string" && row.incident_status.toLowerCase() === "open";
};

/**
 * Adds `incident_status` to event rows by joining incident IDs in one batch query.
 */
export const enrichEventsWithIncidentStatus = async (
  supabaseAdmin: SupabaseClient,
  rows: unknown[] | null
): Promise<EnrichedEventsResult> => {
  const events = Array.isArray(rows) ? (rows as EventRow[]) : [];
  const incidentIds = Array.from(
    new Set(
      events
        .map((row) => (typeof row.incident_id === "string" ? row.incident_id : null))
        .filter((value): value is string => Boolean(value && UUID_PATTERN.test(value)))
    )
  );
  if (!incidentIds.length) {
    return {
      events: events.map((row) => ({ ...row, incident_status: null })),
      degraded: false,
      reason: null,
    };
  }

  try {
    const { data: incidentRowsRaw, error } = await supabaseAdmin
      .from("app_error_logs")
      .select("id, status")
      .in("id", incidentIds);
    if (error) {
      return {
        events: events.map((row) => ({ ...row, incident_status: null })),
        degraded: true,
        reason: "Unable to enrich event rows with incident status.",
      };
    }

    const incidentRows = (incidentRowsRaw as IncidentStatusRow[] | null) ?? [];
    const statusByIncidentId = new Map<string, "open" | "resolved" | "ignored">();
    for (const row of incidentRows) {
      if (!row?.id) continue;
      statusByIncidentId.set(row.id, row.status);
    }

    return {
      events: events.map((row) => {
        const incidentId = typeof row.incident_id === "string" ? row.incident_id : null;
        const incidentStatus = incidentId ? (statusByIncidentId.get(incidentId) ?? null) : null;
        return {
          ...row,
          incident_status: incidentStatus,
        };
      }),
      degraded: false,
      reason: null,
    };
  } catch {
    return {
      events: events.map((row) => ({ ...row, incident_status: null })),
      degraded: true,
      reason: "Unable to enrich event rows with incident status.",
    };
  }
};
