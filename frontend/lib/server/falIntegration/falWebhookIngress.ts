import crypto from "crypto";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { lookupGenerationAttemptByProviderRequest } from "../api/generationAttempts";
import { persistGenerationObservation } from "../api/generationObservationInbox";
import { readPersistedGenerationStatusContext } from "../api/falStatusPersistedResults";
import { readRecoveryGenerationRow } from "./recoveryGenerationLookup";
import { requestGenerationControlPlaneWake } from "../generationControlPlane/controlPlaneWake";
import { executeGenerationRecovery } from "./recoveryExecution";
import {
  asProviderRecord,
  readCanonicalProviderEventId,
  readCanonicalProviderRequestId,
  readCanonicalProviderStatus,
} from "../providerIntegration/canonicalProviderPayload";

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
): "running" | "failed" | "completed" | null => {
  if (!normalizedStatus) return null;
  if (runningStatuses.has(normalizedStatus)) return "running";
  if (failedStatuses.has(normalizedStatus)) return "failed";
  if (completedStatuses.has(normalizedStatus)) return "completed";
  return null;
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

const buildWebhookObservationIdempotencyKey = (eventId: string): string => `fal:webhook:${eventId}`;

const buildSyntheticWebhookEventId = ({
  requestId,
  timestamp,
  normalizedStatus,
  payloadHash,
}: {
  requestId: string | null;
  timestamp: string | null;
  normalizedStatus: string | null;
  payloadHash: string | null;
}): string | null => {
  if (!requestId) return null;
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      [requestId, timestamp ?? "na", normalizedStatus ?? "unknown", payloadHash ?? "na"].join("\n")
    )
    .digest("hex");
  return `synthetic:${requestId}:${fingerprint.slice(0, 24)}`;
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
  | { kind: "accepted"; requestId: string; status: string };

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
  void maxAttempts;
  const requestId = headers.requestId ?? resolveRequestId(payload);
  const normalizedStatus = resolveNormalizedStatus(payload);
  const eventId =
    headers.eventId ??
    resolveEventId(payload) ??
    buildSyntheticWebhookEventId({
      requestId,
      timestamp: headers.timestamp,
      normalizedStatus,
      payloadHash,
    });
  if (!eventId) {
    return { kind: "ignored", reason: "missing_event_id" };
  }
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
  let immediateRecoverySettled = false;
  try {
    await executeGenerationRecovery({
      actor: "webhook",
      generationId: identity.generationId,
      requestId,
      userId: identity.userId,
      observation: {
        state: observationState,
        payload,
        mediaUrls: [],
      },
      routeLabel: "fal/webhook",
    });
    if (identity.userId) {
      const canonicalContext = await readPersistedGenerationStatusContext({
        userId: identity.userId,
        requestId,
      });
      immediateRecoverySettled =
        canonicalContext.resultUrls.length > 0 || canonicalContext.taskState === "fail";
    }
  } catch {
    // Fall back to the observation inbox + control plane when immediate persistence fails.
  }
  if (!immediateRecoverySettled) {
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
    void requestGenerationControlPlaneWake({
      routeLabel: "fal/webhook",
      reason: "webhook_observation",
    });
  }

  await markWebhookEventProcessed({
    eventId,
    processingStatus: immediateRecoverySettled
      ? "accepted_immediate_recovery"
      : "accepted_pending_observation",
    processingError: null,
  });

  return {
    kind: "accepted",
    requestId,
    status: observationState,
  };
};
