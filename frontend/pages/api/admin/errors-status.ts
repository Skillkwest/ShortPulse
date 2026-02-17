/**
 * Admin API: update incident status for app error logs.
 * Supports operator triage workflows (resolve, ignore, reopen) with audit metadata.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";

type ErrorStatus = "open" | "resolved" | "ignored";

type UpdateStatusRequest = {
  errorId?: string;
  eventId?: string;
  status?: ErrorStatus;
  note?: string;
};

type ExistingErrorRow = {
  id: string;
  status: ErrorStatus;
  metadata: Record<string, unknown> | null;
};

type ExistingEventRow = {
  id: string;
  incident_id: string | null;
  fingerprint: string;
  source: string;
  scope: string;
  severity: string;
  message: string;
  stack: string | null;
  route: string | null;
  endpoint: string | null;
  request_id: string | null;
  http_status: number | null;
  user_id: string | null;
  user_email: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string | null;
};

const ALLOWED_STATUSES: ErrorStatus[] = ["open", "resolved", "ignored"];
const MAX_NOTE_LENGTH = 400;
const MAX_HISTORY_ITEMS = 25;

const asTrimmedString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  return normalized.slice(0, maxLength);
};

const asStatus = (value: unknown): ErrorStatus | null => {
  const normalized = asTrimmedString(value, 24)?.toLowerCase() ?? null;
  if (!normalized) return null;
  return ALLOWED_STATUSES.includes(normalized as ErrorStatus) ? (normalized as ErrorStatus) : null;
};

const asScope = (value: unknown): "app" | "generation" => {
  return String(value ?? "").toLowerCase() === "generation" ? "generation" : "app";
};

const asSeverity = (value: unknown): "low" | "medium" | "high" => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "medium";
};

const asHistoryList = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object")
    .slice(0, MAX_HISTORY_ITEMS) as Record<string, unknown>[];
};

const buildStatusMetadata = (params: {
  previousMetadata: Record<string, unknown> | null;
  previousStatus: ErrorStatus;
  nextStatus: ErrorStatus;
  note: string | null;
  adminUserId: string;
  adminUserEmail: string | null;
  occurredAtIso: string;
}): Record<string, unknown> => {
  const previousMetadata = params.previousMetadata ?? {};
  const history = asHistoryList(previousMetadata.status_history);
  const historyEntry: Record<string, unknown> = {
    from: params.previousStatus,
    to: params.nextStatus,
    at: params.occurredAtIso,
    by: params.adminUserId,
    by_email: params.adminUserEmail,
  };
  if (params.note) {
    historyEntry.note = params.note;
  }

  const nextMetadata: Record<string, unknown> = {
    ...previousMetadata,
    status_updated_at: params.occurredAtIso,
    status_updated_by: params.adminUserId,
    status_updated_email: params.adminUserEmail,
    status_update_note: params.note,
    status_history: [...history, historyEntry].slice(-MAX_HISTORY_ITEMS),
  };

  if (params.nextStatus === "resolved") {
    nextMetadata.resolved_at = params.occurredAtIso;
    nextMetadata.resolved_by = params.adminUserId;
    nextMetadata.resolved_by_email = params.adminUserEmail;
  }
  if (params.nextStatus === "ignored") {
    nextMetadata.ignored_at = params.occurredAtIso;
    nextMetadata.ignored_by = params.adminUserId;
    nextMetadata.ignored_by_email = params.adminUserEmail;
  }
  if (params.nextStatus === "open") {
    nextMetadata.reopened_at = params.occurredAtIso;
    nextMetadata.reopened_by = params.adminUserId;
    nextMetadata.reopened_by_email = params.adminUserEmail;
  }

  return nextMetadata;
};

const updateIncidentStatus = async (params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  incidentId: string;
  status: ErrorStatus;
  note: string | null;
  adminUserId: string;
  adminUserEmail: string | null;
}) => {
  const { data: existingRaw, error: findError } = await params.supabaseAdmin
    .from("app_error_logs")
    .select("id, status, metadata")
    .eq("id", params.incidentId)
    .maybeSingle();
  if (findError) {
    return { error: findError.message, code: 500 as const };
  }

  const existing = (existingRaw as ExistingErrorRow | null) ?? null;
  if (!existing?.id) {
    return { error: "Incident not found.", code: 404 as const };
  }

  const nowIso = new Date().toISOString();
  const metadata = buildStatusMetadata({
    previousMetadata: existing.metadata ?? null,
    previousStatus: existing.status,
    nextStatus: params.status,
    note: params.note,
    adminUserId: params.adminUserId,
    adminUserEmail: params.adminUserEmail,
    occurredAtIso: nowIso,
  });

  const { data: updated, error: updateError } = await params.supabaseAdmin
    .from("app_error_logs")
    .update({
      status: params.status,
      metadata,
      updated_at: nowIso,
    })
    .eq("id", params.incidentId)
    .select("id, status, updated_at")
    .maybeSingle();
  if (updateError) {
    return { error: updateError.message, code: 500 as const };
  }

  return {
    code: 200 as const,
    incident: updated ?? { id: params.incidentId, status: params.status, updated_at: nowIso },
  };
};

const promoteEventToIncidentWithStatus = async (params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  event: ExistingEventRow;
  status: ErrorStatus;
  note: string | null;
  adminUserId: string;
  adminUserEmail: string | null;
}) => {
  const occurredAtIso = asTrimmedString(params.event.occurred_at, 80) ?? new Date().toISOString();
  const metadata = buildStatusMetadata({
    previousMetadata: {
      ...(params.event.metadata ?? {}),
      promoted_from_event_id: params.event.id,
      promoted_from_event_stream: true,
    },
    previousStatus: "open",
    nextStatus: params.status,
    note: params.note,
    adminUserId: params.adminUserId,
    adminUserEmail: params.adminUserEmail,
    occurredAtIso,
  });

  const { data: inserted, error: insertError } = await params.supabaseAdmin
    .from("app_error_logs")
    .insert({
      fingerprint: params.event.fingerprint,
      source: params.event.source,
      scope: asScope(params.event.scope),
      severity: asSeverity(params.event.severity),
      status: params.status,
      message: params.event.message,
      stack: params.event.stack,
      route: params.event.route,
      endpoint: params.event.endpoint,
      request_id: params.event.request_id,
      http_status: params.event.http_status,
      user_id: params.event.user_id,
      user_email: params.event.user_email,
      metadata,
      first_seen_at: occurredAtIso,
      last_seen_at: occurredAtIso,
      occurrences_count: 1,
    })
    .select("id, status, updated_at")
    .maybeSingle();
  if (insertError) {
    return { error: insertError.message, code: 500 as const };
  }

  const incidentId = asTrimmedString((inserted as { id?: unknown } | null)?.id, 120);
  if (!incidentId) {
    return { error: "Failed to create incident from event.", code: 500 as const };
  }

  const { error: linkError } = await params.supabaseAdmin
    .from("app_error_events")
    .update({ incident_id: incidentId })
    .eq("id", params.event.id);
  if (linkError) {
    return { error: linkError.message, code: 500 as const };
  }

  return {
    code: 200 as const,
    incident:
      inserted ??
      ({
        id: incidentId,
        status: params.status,
        updated_at: occurredAtIso,
      } as Record<string, unknown>),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) {
    return;
  }

  const body = (req.body ?? {}) as UpdateStatusRequest;
  const errorId = asTrimmedString(body.errorId, 120);
  const eventId = asTrimmedString(body.eventId, 120);
  const status = asStatus(body.status);
  const note = asTrimmedString(body.note, MAX_NOTE_LENGTH);
  if (!errorId && !eventId) {
    return res.status(400).json({ error: "errorId or eventId is required." });
  }
  if (!status) {
    return res.status(400).json({ error: "status must be one of open, resolved, ignored." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (errorId) {
      const updateResult = await updateIncidentStatus({
        supabaseAdmin,
        incidentId: errorId,
        status,
        note,
        adminUserId: adminUser.id,
        adminUserEmail: adminUser.email ?? null,
      });
      if (updateResult.code !== 200) {
        return res.status(updateResult.code).json({ error: updateResult.error });
      }

      return res.status(200).json({
        ok: true,
        incident: updateResult.incident,
      });
    }

    const { data: eventRaw, error: eventFindError } = await supabaseAdmin
      .from("app_error_events")
      .select(
        "id, incident_id, fingerprint, source, scope, severity, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, occurred_at"
      )
      .eq("id", eventId)
      .maybeSingle();
    if (eventFindError) {
      return res.status(500).json({ error: eventFindError.message });
    }
    const event = (eventRaw as ExistingEventRow | null) ?? null;
    if (!event?.id) {
      return res.status(404).json({ error: "Event not found." });
    }

    if (event.incident_id) {
      const updateResult = await updateIncidentStatus({
        supabaseAdmin,
        incidentId: event.incident_id,
        status,
        note,
        adminUserId: adminUser.id,
        adminUserEmail: adminUser.email ?? null,
      });
      if (updateResult.code !== 200) {
        return res.status(updateResult.code).json({ error: updateResult.error });
      }

      return res.status(200).json({
        ok: true,
        incident: updateResult.incident,
        eventId: event.id,
      });
    }

    const promotedResult = await promoteEventToIncidentWithStatus({
      supabaseAdmin,
      event,
      status,
      note,
      adminUserId: adminUser.id,
      adminUserEmail: adminUser.email ?? null,
    });
    if (promotedResult.code !== 200) {
      return res.status(promotedResult.code).json({ error: promotedResult.error });
    }

    return res.status(200).json({
      ok: true,
      incident: promotedResult.incident,
      eventId: event.id,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/errors-status",
      user: adminUser,
      metadata: {
        target_error_id: errorId,
        target_event_id: eventId,
        target_status: status,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to update incident status.",
    });
  }
}
