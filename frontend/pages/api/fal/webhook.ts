import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../lib/server/api/falRuntimeFlags";
import {
  readFalWebhookHeaders,
  readRawBody,
  verifyFalWebhookSignature,
  verifyFalWebhookBodyHash,
} from "../../../lib/server/api/falWebhook";
import { RequestBodyTooLargeError } from "../../../lib/server/api/requestBody";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  executeGenerationRecovery,
  type RecoveryObservation,
} from "../../../lib/server/falIntegration/recoveryExecution";
import {
  asProviderRecord,
  readCanonicalProviderEventId,
  readCanonicalProviderRequestId,
  readCanonicalProviderStatus,
} from "../../../lib/server/providerIntegration/canonicalProviderPayload";
import { readProviderMediaUrls } from "../../../lib/server/providerIntegration/statusProviderPayload";

type JsonObject = Record<string, unknown>;

const completedStatuses = new Set(["completed", "succeeded", "success", "done", "ok"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);
const runningStatuses = new Set(["running", "pending", "queued", "in_progress", "processing"]);
const FAL_WEBHOOK_MAX_BODY_BYTES = 512 * 1024;

const parseObject = asProviderRecord;

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
};

const resolveRequestId = (payload: JsonObject): string | null => {
  return readCanonicalProviderRequestId(payload);
};

const resolveEventId = (payload: JsonObject): string | null =>
  readCanonicalProviderEventId(payload);

const resolveNormalizedStatus = (payload: JsonObject): string | null =>
  readCanonicalProviderStatus(payload);

const resolveObservationState = (
  normalizedStatus: string | null
): RecoveryObservation["state"] | null => {
  if (!normalizedStatus) return null;
  if (runningStatuses.has(normalizedStatus)) return "running";
  if (failedStatuses.has(normalizedStatus)) return "failed";
  if (completedStatuses.has(normalizedStatus)) return "completed";
  return null;
};

const extractMediaUrls = (payload: JsonObject): string[] =>
  readProviderMediaUrls({ provider: "fal", payload });

const markWebhookEventProcessed = async ({
  eventId,
  processingStatus,
  processingError,
}: {
  eventId: string;
  processingStatus: string;
  processingError?: string | null;
}) => {
  await getSupabaseAdmin()
    .from("fal_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_status: processingStatus,
      processing_error: processingError ?? null,
    })
    .eq("event_id", eventId);
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

  const webhookHeaders = readFalWebhookHeaders(req);

  try {
    const rawBody = await readRawBody(req, { maxBytes: FAL_WEBHOOK_MAX_BODY_BYTES });
    const verification = await verifyFalWebhookSignature({
      rawBody,
      headers: webhookHeaders,
      flags,
    });
    if (!verification.ok) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }
    if (
      !verifyFalWebhookBodyHash({
        rawBody,
        expectedHash: readHeaderValue(req.headers["x-fal-webhook-payload-hash"]),
      })
    ) {
      return res.status(400).json({ error: "Invalid webhook payload hash" });
    }

    let payload: JsonObject;
    try {
      payload = parseObject(JSON.parse(rawBody));
    } catch {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }
    const eventId = webhookHeaders.eventId ?? resolveEventId(payload);
    if (!eventId) {
      return res.status(202).json({ accepted: true, ignored: "missing_event_id" });
    }

    const requestId = webhookHeaders.requestId ?? resolveRequestId(payload);
    const insertResult = await getSupabaseAdmin()
      .from("fal_webhook_events")
      .insert({
        event_id: eventId,
        request_id: requestId,
        fal_user_id: webhookHeaders.userId,
        headers: {
          request_id: webhookHeaders.requestId,
          user_id: webhookHeaders.userId,
          event_id: webhookHeaders.eventId,
          timestamp: webhookHeaders.timestamp,
        },
        payload,
        verification_method: verification.method,
        payload_hash: verification.payloadHash ?? null,
        processing_status: "received",
      })
      .select("event_id")
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw insertResult.error;
    }

    if (!requestId) {
      await markWebhookEventProcessed({
        eventId,
        processingStatus: "ignored_missing_request_id",
      });
      return res.status(202).json({ accepted: true, ignored: "missing_request_id" });
    }

    const normalizedStatus = resolveNormalizedStatus(payload);
    const observationState = resolveObservationState(normalizedStatus);
    if (!observationState) {
      await markWebhookEventProcessed({
        eventId,
        processingStatus: "ignored_non_terminal_status",
      });
      return res.status(202).json({ accepted: true, ignored: "non_terminal_status" });
    }

    const observation: RecoveryObservation = {
      state: observationState,
      payload,
      mediaUrls: extractMediaUrls(payload),
    };
    const result = await executeGenerationRecovery({
      actor: "webhook",
      requestId,
      observation,
      routeLabel: "fal/webhook",
      maxAttempts: flags.reconcilerMaxAttempts,
    });

    await markWebhookEventProcessed({
      eventId,
      processingStatus: result.state,
      processingError: result.note ?? null,
    });

    return res.status(200).json({
      received: true,
      request_id: requestId,
      status: result.state,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return res.status(413).json({ error: "Webhook payload too large." });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "fal/webhook",
      metadata: {
        fal_signature_present: Boolean(webhookHeaders.signature),
      },
    });
    return res.status(500).json({
      error: "Webhook processing failed.",
    });
  }
}
