import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { lookupGenerationAttemptByProviderRequest } from "../api/generationAttempts";
import {
  markGenerationObservationProcessingState,
  persistGenerationObservation,
} from "../api/generationObservationInbox";
import {
  executeGenerationRecovery,
  type RecoveryObservation,
} from "../falIntegration/recoveryExecution";
import { readRecoveryGenerationRow } from "./recoveryGenerationLookup";
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

const buildWebhookObservationIdempotencyKey = (eventId: string): string => `fal:webhook:${eventId}`;

const resolveObservationProcessingState = (resultState: string): "processed" | "ignored" => {
  if (resultState === "missing_generation" || resultState === "skipped") {
    return "ignored";
  }
  return "processed";
};

const resolveWebhookObservationIdentity = async ({
  requestId,
}: {
  requestId: string;
}): Promise<{
  generationId: string | null;
  generationAttemptId: string | null;
  userId: string | null;
}> => {
  const attemptLookup = await lookupGenerationAttemptByProviderRequest({
    providerRequestId: requestId,
  }).catch(() => ({ data: null, error: null }));

  if (attemptLookup.data) {
    return {
      generationId: attemptLookup.data.generationId ?? null,
      generationAttemptId: attemptLookup.data.id ?? null,
      userId: attemptLookup.data.userId ?? null,
    };
  }

  const generation = await readRecoveryGenerationRow({
    requestId,
  }).catch(() => null);
  return {
    generationId: generation?.id ?? null,
    generationAttemptId: null,
    userId: generation?.user_id ?? null,
  };
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
  const normalizedStatus = resolveNormalizedStatus(payload);
  const observationState = resolveObservationState(normalizedStatus);
  const observationIdempotencyKey = buildWebhookObservationIdempotencyKey(eventId);
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

  if (!observationState) {
    await markWebhookEventProcessed({
      eventId,
      processingStatus: "ignored_non_terminal_status",
    });
    return { kind: "ignored", reason: "non_terminal_status" };
  }

  const identity = await resolveWebhookObservationIdentity({
    requestId,
  });
  await persistGenerationObservation({
    generationId: identity.generationId,
    generationAttemptId: identity.generationAttemptId,
    userId: identity.userId,
    provider: "fal",
    providerRequestId: requestId,
    observationSource: "webhook",
    observationType: observationState,
    idempotencyKey: observationIdempotencyKey,
    payload,
  });

  const observation: RecoveryObservation = {
    state: observationState,
    payload,
    mediaUrls: extractMediaUrls(payload),
  };
  let result;
  try {
    result = await executeGenerationRecovery({
      actor: "webhook",
      requestId,
      observation,
      routeLabel: "fal/webhook",
      maxAttempts,
    });
  } catch (error) {
    await markGenerationObservationProcessingState({
      idempotencyKey: observationIdempotencyKey,
      processingState: "failed",
      processingError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await markGenerationObservationProcessingState({
    idempotencyKey: observationIdempotencyKey,
    processingState: resolveObservationProcessingState(result.state),
    processingError: result.note ?? null,
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
