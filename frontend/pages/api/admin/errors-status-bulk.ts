/**
 * Admin API: bulk update incident status for app error logs.
 * Uses the same atomic RPC per incident with bounded concurrency for safe batch operations.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type ErrorStatus = "open" | "resolved" | "ignored";

type BulkUpdateStatusRequest = {
  errorIds?: unknown;
  status?: ErrorStatus;
  note?: string;
  watch?: boolean;
};

type RpcIncidentPayload = {
  incident_id?: string;
  status?: ErrorStatus;
  updated_at?: string;
};

type BulkFailureRow = {
  errorId: string;
  error: string;
  code: string | null;
};

const ALLOWED_STATUSES: ErrorStatus[] = ["open", "resolved", "ignored"];
const MAX_NOTE_LENGTH = 400;
const MAX_BULK_IDS = 200;
const MAX_FAILURES_IN_RESPONSE = 25;
const MAX_CONCURRENCY = 8;

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

const asErrorIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const item of value) {
    const normalized = asTrimmedString(item, 120);
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped);
};

const normalizeRpcPayload = (payload: unknown): RpcIncidentPayload | null => {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as RpcIncidentPayload) : null;
  }
  return payload && typeof payload === "object" ? (payload as RpcIncidentPayload) : null;
};

const toFailureRow = (
  errorId: string,
  error: { code?: string; message?: string } | null
): BulkFailureRow => ({
  errorId,
  error: error?.message || "Unable to update incident status.",
  code: asTrimmedString(error?.code, 40),
});

const runWorkerPool = async <TItem>(params: {
  items: TItem[];
  concurrency: number;
  worker: (item: TItem) => Promise<void>;
}) => {
  let index = 0;
  const threads = Math.min(Math.max(1, params.concurrency), params.items.length);
  const runWorker = async () => {
    while (index < params.items.length) {
      const item = params.items[index];
      index += 1;
      // Isolate individual failures so one failed update does not stop the batch.
      await params.worker(item);
    }
  };
  await Promise.all(Array.from({ length: threads }, () => runWorker()));
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
      routeLabel: "admin/errors-status-bulk.auth",
    });
    return res.status(500).json({ error: "Unable to update incident status." });
  }
  if (!adminUser) {
    return;
  }
  const verifiedAdminUser = adminUser;

  const body = (req.body ?? {}) as BulkUpdateStatusRequest;
  const errorIds = asErrorIds(body.errorIds);
  const status = asStatus(body.status);
  const note = asTrimmedString(body.note, MAX_NOTE_LENGTH);
  const watch = body.watch === true;

  if (!errorIds.length) {
    return res.status(400).json({ error: "errorIds must be a non-empty array." });
  }
  if (errorIds.length > MAX_BULK_IDS) {
    return res.status(400).json({
      error: `errorIds cannot exceed ${MAX_BULK_IDS} items per request.`,
    });
  }
  if (!status) {
    return res.status(400).json({ error: "status must be one of open, resolved, ignored." });
  }
  if (watch && status !== "resolved") {
    return res.status(400).json({ error: "watch items must use resolved status." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const updatedIncidentIds: string[] = [];
    const failures: BulkFailureRow[] = [];

    await runWorkerPool({
      items: errorIds,
      concurrency: MAX_CONCURRENCY,
      worker: async (errorId) => {
        try {
          const { data, error } = await supabaseAdmin.rpc("admin_update_app_error_status", {
            p_error_id: errorId,
            p_event_id: null,
            p_status: status,
            p_note: note,
            p_admin_user_id: verifiedAdminUser.id,
            p_admin_user_email: verifiedAdminUser.email ?? null,
            p_watch_item: watch,
          });
          if (error) {
            failures.push(toFailureRow(errorId, error));
            return;
          }

          const payload = normalizeRpcPayload(data);
          const incidentId = asTrimmedString(payload?.incident_id, 120);
          if (!incidentId) {
            failures.push(toFailureRow(errorId, { message: "Unable to update incident status." }));
            return;
          }

          updatedIncidentIds.push(incidentId);
        } catch (error) {
          failures.push(
            toFailureRow(errorId, {
              message: error instanceof Error ? error.message : "Unable to update incident status.",
            })
          );
        }
      },
    });

    const failedCount = failures.length;
    const updatedCount = updatedIncidentIds.length;
    if (failedCount > 0) {
      await logApiRouteException({
        req,
        error: new Error("Bulk admin error status update had failures."),
        routeLabel: "admin/errors-status-bulk.partial",
        user: verifiedAdminUser,
        metadata: {
          requested_status: status,
          requested_watch_item: watch,
          requested_count: errorIds.length,
          updated_count: updatedCount,
          failed_count: failedCount,
          failed_preview: failures.slice(0, MAX_FAILURES_IN_RESPONSE),
        },
      });
    }
    const responsePayload = {
      ok: failedCount === 0,
      partial: failedCount > 0 && updatedCount > 0,
      status,
      summary: {
        requestedCount: errorIds.length,
        updatedCount,
        failedCount,
      },
      updatedIncidentIds,
      failed: failures.slice(0, MAX_FAILURES_IN_RESPONSE),
    };

    if (updatedCount === 0) {
      return res.status(500).json(responsePayload);
    }
    return res.status(200).json(responsePayload);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/errors-status-bulk",
      user: adminUser,
      metadata: {
        requested_status: status,
        requested_watch_item: watch,
        requested_count: errorIds.length,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to update incident status.",
    });
  }
}
