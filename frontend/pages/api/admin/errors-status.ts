/**
 * Admin API: update incident status for app error logs.
 * Supports operator triage workflows (resolve, ignore, reopen) with audit metadata.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../_utils/auth";
import { getSupabaseAdmin } from "../_utils/supabaseAdmin";
import { logApiRouteException } from "../_utils/appErrorLogs";

type ErrorStatus = "open" | "resolved" | "ignored";

type UpdateStatusRequest = {
  errorId?: string;
  status?: ErrorStatus;
  note?: string;
};

type ExistingErrorRow = {
  id: string;
  status: ErrorStatus;
  metadata: Record<string, unknown> | null;
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
  const status = asStatus(body.status);
  const note = asTrimmedString(body.note, MAX_NOTE_LENGTH);
  if (!errorId) {
    return res.status(400).json({ error: "errorId is required." });
  }
  if (!status) {
    return res.status(400).json({ error: "status must be one of open, resolved, ignored." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingRaw, error: findError } = await supabaseAdmin
      .from("app_error_logs")
      .select("id, status, metadata")
      .eq("id", errorId)
      .maybeSingle();
    if (findError) {
      return res.status(500).json({ error: findError.message });
    }

    const existing = (existingRaw as ExistingErrorRow | null) ?? null;
    if (!existing?.id) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const nowIso = new Date().toISOString();
    const metadata = buildStatusMetadata({
      previousMetadata: existing.metadata ?? null,
      previousStatus: existing.status,
      nextStatus: status,
      note,
      adminUserId: adminUser.id,
      adminUserEmail: adminUser.email ?? null,
      occurredAtIso: nowIso,
    });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("app_error_logs")
      .update({
        status,
        metadata,
        updated_at: nowIso,
      })
      .eq("id", errorId)
      .select("id, status, updated_at")
      .maybeSingle();
    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      incident: updated ?? { id: errorId, status, updated_at: nowIso },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/errors-status",
      user: adminUser,
      metadata: {
        target_error_id: errorId,
        target_status: status,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to update incident status.",
    });
  }
}
