import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  executeGenerationRecovery,
  type RecoveryObservation,
} from "../falIntegration/recoveryExecution";
import {
  asProviderRecord,
  readCanonicalProviderEventId,
  readCanonicalProviderRequestId,
  readCanonicalProviderStatus,
} from "../providerIntegration/canonicalProviderPayload";
import { readProviderMediaUrls } from "../providerIntegration/statusProviderPayload";

type JsonObject = Record<string, unknown>;

const completedStatuses = new Set(["completed", "succeeded", "success", "done", "ok"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);
const runningStatuses = new Set(["running", "pending", "queued", "in_progress", "processing"]);

const parseObject = asProviderRecord;

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

export type FalWebhookIngressHeaders = {
  requestId: string | null;
  userId: string | null;
  eventId: string | null;
  timestamp: string | null;
};

export type FalWebhookIngressResult =
  | { kind: "ignored"; reason: "missing_event_id" | "missing_request_id" | "non_terminal_status" }
  | { kind: "duplicate" }
  | { kind: "processed"; requestId: string; status: string };

export const parseFalWebhookPayload = (rawBody: string): JsonObject => {
  return parseObject(JSON.parse(rawBody));
};

export const ingestFalWebhookEvent = async ({
  payload,
  headers,
  verificationMethod,
  payloadHash,
  maxAttempts,
}: {
  payload: JsonObject;
  headers: FalWebhookIngressHeaders;
  verificationMethod: string | null;
  payloadHash: string | null;
  maxAttempts: number;
}): Promise<FalWebhookIngressResult> => {
  const eventId = headers.eventId ?? resolveEventId(payload);
  if (!eventId) {
    return { kind: "ignored", reason: "missing_event_id" };
  }

  const requestId = headers.requestId ?? resolveRequestId(payload);
  const insertResult = await getSupabaseAdmin()
    .from("fal_webhook_events")
    .insert({
      event_id: eventId,
      request_id: requestId,
      fal_user_id: headers.userId,
      headers: {
        request_id: headers.requestId,
        user_id: headers.userId,
        event_id: headers.eventId,
        timestamp: headers.timestamp,
      },
      payload,
      verification_method: verificationMethod,
      payload_hash: payloadHash ?? null,
      processing_status: "received",
    })
    .select("event_id")
    .single();

  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      return { kind: "duplicate" };
    }
    throw insertResult.error;
  }

  if (!requestId) {
    await markWebhookEventProcessed({
      eventId,
      processingStatus: "ignored_missing_request_id",
    });
    return { kind: "ignored", reason: "missing_request_id" };
  }

  const normalizedStatus = resolveNormalizedStatus(payload);
  const observationState = resolveObservationState(normalizedStatus);
  if (!observationState) {
    await markWebhookEventProcessed({
      eventId,
      processingStatus: "ignored_non_terminal_status",
    });
    return { kind: "ignored", reason: "non_terminal_status" };
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
    maxAttempts,
  });

  await markWebhookEventProcessed({
    eventId,
    processingStatus: result.state,
    processingError: result.note ?? null,
  });

  return {
    kind: "processed",
    requestId,
    status: result.state,
  };
};
