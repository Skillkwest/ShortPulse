/**
 * Admin API: update incident status for app error logs.
 * Uses a single atomic RPC so incident updates and event promotion/linking
 * cannot partially succeed.
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

type RpcIncidentPayload = {
  incident_id?: string;
  status?: ErrorStatus;
  updated_at?: string;
  event_id?: string | null;
};

const ALLOWED_STATUSES: ErrorStatus[] = ["open", "resolved", "ignored"];
const MAX_NOTE_LENGTH = 400;

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

const normalizeRpcPayload = (payload: unknown): RpcIncidentPayload | null => {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as RpcIncidentPayload) : null;
  }
  return payload && typeof payload === "object" ? (payload as RpcIncidentPayload) : null;
};

const mapRpcErrorToStatus = (error: { code?: string; message?: string } | null): number => {
  const code = String(error?.code ?? "").toUpperCase();
  if (code === "P0002") return 404;
  if (code === "22023") return 400;
  return 500;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/errors-status.auth",
    });
    return res.status(500).json({ error: "Unable to update incident status." });
  }
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
    const { data, error } = await supabaseAdmin.rpc("admin_update_app_error_status", {
      p_error_id: errorId,
      p_event_id: eventId,
      p_status: status,
      p_note: note,
      p_admin_user_id: adminUser.id,
      p_admin_user_email: adminUser.email ?? null,
    });

    if (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "admin/errors-status.rpc",
        user: adminUser,
        metadata: {
          target_error_id: errorId,
          target_event_id: eventId,
          target_status: status,
          rpc_error_code: error.code ?? null,
        },
      });
      return res
        .status(mapRpcErrorToStatus(error))
        .json({ error: error.message || "Unable to update incident status." });
    }

    const payload = normalizeRpcPayload(data);
    const incidentId = asTrimmedString(payload?.incident_id, 120);
    const incidentStatus = asStatus(payload?.status) ?? status;
    const updatedAt = asTrimmedString(payload?.updated_at, 80) ?? new Date().toISOString();
    const resolvedEventId = asTrimmedString(payload?.event_id, 120);
    if (!incidentId) {
      await logApiRouteException({
        req,
        error: new Error("Admin error status RPC returned no incident id."),
        routeLabel: "admin/errors-status.rpc-payload",
        user: adminUser,
        metadata: {
          target_error_id: errorId,
          target_event_id: eventId,
          target_status: status,
        },
      });
      return res.status(500).json({ error: "Unable to update incident status." });
    }

    return res.status(200).json({
      ok: true,
      incident: {
        id: incidentId,
        status: incidentStatus,
        updated_at: updatedAt,
      },
      ...(resolvedEventId ? { eventId: resolvedEventId } : {}),
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
