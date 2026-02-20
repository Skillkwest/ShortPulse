import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../lib/server/api/falRuntimeFlags";
import { settleGenerationOutcome } from "../../../lib/server/api/generationBilling";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { readRawBody, verifyFalWebhookSignature } from "../../../lib/server/api/falWebhook";
import {
  asString,
  hasMediaPayload,
  normalizeStatus,
  toRecord,
} from "../../../lib/server/falIntegration/falAdapter";
import {
  isLegalGenerationTransition,
  normalizeGenerationLifecycleState,
} from "../../../lib/server/falIntegration/stateMachine";

type JsonObject = Record<string, unknown>;

type GenerationRow = {
  id: string;
  user_id: string;
  request_id: string | null;
  status: string;
  metadata: JsonObject;
};

const completedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);
const runningStatuses = new Set(["running", "pending", "queued", "in_progress", "processing"]);

const parseObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const resolveRequestId = (payload: JsonObject): string | null => {
  const data = toRecord(payload.data);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  return (
    asString(payload.request_id) ||
    asString(payload.requestId) ||
    asString(data.request_id) ||
    asString(data.requestId) ||
    asString(result.request_id) ||
    asString(response.request_id) ||
    asString(toRecord(payload.meta).request_id)
  );
};

const resolveEventId = (payload: JsonObject): string | null =>
  asString(payload.event_id) || asString(payload.eventId) || asString(payload.id);

const resolveNormalizedStatus = (payload: JsonObject): string | null => {
  const data = toRecord(payload.data);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  return (
    normalizeStatus(payload.status) ||
    normalizeStatus(payload.state) ||
    normalizeStatus(data.status) ||
    normalizeStatus(data.state) ||
    normalizeStatus(result.status) ||
    normalizeStatus(result.state) ||
    normalizeStatus(response.status) ||
    normalizeStatus(response.state)
  );
};

const resolveTargetState = ({
  normalizedStatus,
  hasMedia,
}: {
  normalizedStatus: string | null;
  hasMedia: boolean;
}): "running" | "success" | "fail" | null => {
  if (!normalizedStatus) return null;
  if (runningStatuses.has(normalizedStatus)) return "running";
  if (failedStatuses.has(normalizedStatus)) return "fail";
  if (completedStatuses.has(normalizedStatus)) {
    return hasMedia ? "success" : "fail";
  }
  return null;
};

const readGenerationRowByRequestId = async (requestId: string): Promise<GenerationRow | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, user_id, request_id, status, metadata")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = parseObject(data);
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const status = asString(row.status);
  if (!id || !userId || !status) return null;
  return {
    id,
    user_id: userId,
    request_id: asString(row.request_id),
    status,
    metadata: parseObject(row.metadata),
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = readFalRuntimeFlags();
  if (!flags.webhookEnabled || flags.integrationMode === "legacy") {
    return res.status(404).json({ error: "Not found" });
  }

  const signatureHeader =
    (req.headers["x-fal-signature"] as string | undefined) ||
    (req.headers["fal-signature"] as string | undefined) ||
    (req.headers["x-webhook-signature"] as string | undefined) ||
    null;
  const timestampHeader =
    (req.headers["x-fal-timestamp"] as string | undefined) ||
    (req.headers["fal-timestamp"] as string | undefined) ||
    null;

  try {
    const rawBody = await readRawBody(req);
    if (
      !verifyFalWebhookSignature({
        rawBody,
        signatureHeader,
        timestampHeader,
      })
    ) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const payload = parseObject(JSON.parse(rawBody));
    const requestId = resolveRequestId(payload);
    if (!requestId) {
      return res.status(202).json({ accepted: true, ignored: "missing_request_id" });
    }

    const row = await readGenerationRowByRequestId(requestId);
    if (!row) {
      return res.status(202).json({ accepted: true, ignored: "generation_not_found" });
    }

    const eventId = resolveEventId(payload);
    if (eventId && asString(row.metadata.last_webhook_event_id) === eventId) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const normalizedStatus = resolveNormalizedStatus(payload);
    const mediaDetected = hasMediaPayload(payload);
    const targetState = resolveTargetState({ normalizedStatus, hasMedia: mediaDetected });
    if (!targetState) {
      return res.status(202).json({ accepted: true, ignored: "non_terminal_status" });
    }

    const currentState = normalizeGenerationLifecycleState(row.status) ?? "submitted";
    if (!isLegalGenerationTransition({ from: currentState, to: targetState })) {
      const nextMetadata = {
        ...row.metadata,
        last_webhook_event_id: eventId,
        last_webhook_at: new Date().toISOString(),
        state_transition_invalid: {
          from: currentState,
          to: targetState,
          normalized_status: normalizedStatus,
        },
      };
      await getSupabaseAdmin()
        .from("ai_generations")
        .update({ metadata: nextMetadata })
        .eq("id", row.id)
        .eq("user_id", row.user_id);
      return res.status(202).json({ accepted: true, ignored: "state_transition_invalid" });
    }

    const nowIso = new Date().toISOString();
    const failureReason =
      targetState === "fail" && normalizedStatus && completedStatuses.has(normalizedStatus)
        ? "terminal_success_no_media"
        : targetState === "fail"
          ? "provider_error"
          : null;
    if (targetState === "success" || targetState === "fail") {
      await settleGenerationOutcome({
        userId: row.user_id,
        providerRequestId: requestId,
        outcome: targetState === "success" ? "success" : "fail",
        reason:
          targetState === "success"
            ? "Fal webhook terminal success."
            : failureReason === "terminal_success_no_media"
              ? "Fal webhook terminal status without media."
              : "Fal webhook terminal failure.",
        routeLabel: "fal/webhook",
        detail: {
          webhook_status: normalizedStatus,
          event_id: eventId,
        },
      });
    }

    const nextMetadata = {
      ...row.metadata,
      last_webhook_event_id: eventId,
      last_webhook_at: nowIso,
      last_webhook_status: normalizedStatus,
    };
    const updates: JsonObject = {
      status: targetState,
      metadata: nextMetadata,
      failure_reason_code: failureReason,
      recovery_state: targetState === "success" ? "recovered" : "queued",
      last_recovery_at: targetState === "success" ? nowIso : null,
      next_recovery_at: targetState === "success" ? null : nowIso,
      completed_at: targetState === "running" ? null : nowIso,
      last_media_detected_at: mediaDetected ? nowIso : null,
    };

    const { error: updateError } = await getSupabaseAdmin()
      .from("ai_generations")
      .update(updates)
      .eq("id", row.id)
      .eq("user_id", row.user_id);

    if (updateError) {
      return res.status(500).json({ error: "Failed to update generation state" });
    }

    return res.status(200).json({
      received: true,
      request_id: requestId,
      status: targetState,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "fal/webhook",
      metadata: {
        fal_signature_present: Boolean(signatureHeader),
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Webhook processing failed.",
    });
  }
}
