import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../lib/server/api/falRuntimeFlags";
import {
  readFalWebhookHeaders,
  readRawBody,
  verifyFalWebhookSignature,
  verifyFalWebhookBodyHash,
} from "../../../lib/server/api/falWebhook";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  executeGenerationRecovery,
  type RecoveryObservation,
} from "../../../lib/server/falIntegration/recoveryExecution";
import { asString, normalizeStatus, toRecord } from "../../../lib/server/falIntegration/falAdapter";

type JsonObject = Record<string, unknown>;

const completedStatuses = new Set(["completed", "succeeded", "success", "done", "ok"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);
const runningStatuses = new Set(["running", "pending", "queued", "in_progress", "processing"]);

const parseObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
};

const resolveRequestId = (payload: JsonObject): string | null => {
  const data = toRecord(payload.data);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  const rootPayload = toRecord(payload.payload);
  return (
    asString(payload.request_id) ||
    asString(payload.requestId) ||
    asString(data.request_id) ||
    asString(data.requestId) ||
    asString(result.request_id) ||
    asString(response.request_id) ||
    asString(rootPayload.request_id) ||
    asString(toRecord(payload.meta).request_id)
  );
};

const resolveEventId = (payload: JsonObject): string | null =>
  asString(payload.event_id) || asString(payload.eventId) || asString(payload.id);

const resolveNormalizedStatus = (payload: JsonObject): string | null => {
  const data = toRecord(payload.data);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  const rootPayload = toRecord(payload.payload);
  return (
    normalizeStatus(payload.status) ||
    normalizeStatus(payload.state) ||
    normalizeStatus(rootPayload.status) ||
    normalizeStatus(rootPayload.state) ||
    normalizeStatus(data.status) ||
    normalizeStatus(data.state) ||
    normalizeStatus(result.status) ||
    normalizeStatus(result.state) ||
    normalizeStatus(response.status) ||
    normalizeStatus(response.state)
  );
};

const resolveObservationState = (
  normalizedStatus: string | null
): RecoveryObservation["state"] | null => {
  if (!normalizedStatus) return null;
  if (runningStatuses.has(normalizedStatus)) return "running";
  if (failedStatuses.has(normalizedStatus)) return "failed";
  if (completedStatuses.has(normalizedStatus)) return "completed";
  return null;
};

const extractMediaUrls = (payload: JsonObject): string[] => {
  const candidates = [payload, parseObject(payload.payload), parseObject(payload.data)];
  for (const candidate of candidates) {
    const images = candidate.images;
    if (Array.isArray(images) && images.length) {
      const urls = images
        .map((item) => (typeof item === "string" ? item : asString(parseObject(item).url)))
        .filter((url): url is string => Boolean(url));
      if (urls.length) return urls;
    }
    const videos = candidate.videos;
    if (Array.isArray(videos) && videos.length) {
      const urls = videos
        .map((item) => (typeof item === "string" ? item : asString(parseObject(item).url)))
        .filter((url): url is string => Boolean(url));
      if (urls.length) return urls;
    }
  }
  return [];
};

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
    const rawBody = await readRawBody(req);
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
    await logApiRouteException({
      req,
      error,
      routeLabel: "fal/webhook",
      metadata: {
        fal_signature_present: Boolean(webhookHeaders.signature),
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Webhook processing failed.",
    });
  }
}
