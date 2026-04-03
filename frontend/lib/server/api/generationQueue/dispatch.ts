import { getSupabaseAdmin } from "../supabaseAdmin";
import { logGenerationFailure } from "../appErrorLogs";
import { readFalRuntimeFlags } from "../falRuntimeFlags";
import { upsertGenerationProjection } from "../generationProjection";
import {
  markGenerationReservationSubmitted,
  releaseGenerationReservationBySourceRef,
} from "../generationBilling/reservationRpcAdapter";
import { getFalModelProfileByModelId } from "../../falIntegration/modelProfiles";
import type { SubmitTarget } from "../../falIntegration/contracts";
import { resolveWebhookCallbackUrl, withWebhookTargets } from "../falSubmitTargeting";
import { dispatchProviderSubmit } from "../../providerIntegration/submitProviderDispatcher";
import { evaluateFalPayloadContractForModel } from "../falPayloadValidation";
import {
  readProviderApiKey,
  resolveKieSubmitTargetsForModel,
  resolveProviderFromGenerationContext,
} from "../../providerIntegration/providerRuntimeConfig";
import { isFalProviderKey, isKieProviderKey } from "../../providerIntegration/providerKey";
import {
  claimGenerationSubmitQueueBatch,
  markQueueItemExhausted,
  releaseQueueLeaseBackToQueued,
  removeQueueItem,
  updateQueueItemForRetry,
  type ClaimedGenerationQueueItem,
} from "./service";
import {
  QueueTransitionError,
  assertGenerationAttemptMarkedRunning,
  assertGenerationAttemptRecorded,
  assertGenerationMarkedRunning,
  assertQueueIdentityInvariant,
  assertQueueMutationApplied,
  assertReservationSubmissionAccepted,
  decideQueueTransitionCompensation,
} from "./transitionGuard";
import { readActiveProviderCapacitySnapshot } from "./activeProviderCapacity";
import {
  isVideoGenerationModelId,
  normalizeVideoQueueDispatchPayload,
} from "../videoSubmitContracts";
import type { GenerationControlPlaneLogContext } from "../../generationControlPlane/types";
import { applyAcceptedRunningGenerationTransition } from "../generationAcceptedTransitionService";
import { applyGenerationLifecycleTransition } from "../generationLifecycleTransitionService";
import {
  buildAcceptedRunningGenerationUpdate,
  buildQueueDispatchExhaustedGenerationUpdate,
} from "../generationRequestTransitions";

type JsonObject = Record<string, unknown>;

type QueueDispatchMetrics = {
  claimed: number;
  submitted: number;
  retried: number;
  requeuedNoCapacity: number;
  exhausted: number;
  skipped: number;
  errors: number;
};

type QueueDispatchItemResult = Pick<
  QueueDispatchMetrics,
  "submitted" | "retried" | "requeuedNoCapacity" | "exhausted" | "skipped" | "errors"
> & {
  deferredWork?: Promise<void>;
};

type QueueDispatchContext = Pick<GenerationControlPlaneLogContext, "req" | "routeLabel">;

type ProviderCapacitySnapshot = {
  tier: string;
  globalActive: number;
  tierActive: number;
  staleIgnoredGlobal: number;
  staleIgnoredTier: number;
};

type QueueDispatchStageTimings = {
  existingRequestReconcile: number;
  capacityCheck: number;
  providerKeyRead: number;
  targetResolution: number;
  payloadPreparation: number;
  providerSubmit: number;
  reservationSubmit: number;
  generationTransition: number;
  projectionSync: number;
  queueRemove: number;
};

type DispatchOptions = QueueDispatchContext & {
  limit: number;
  userId?: string | null;
};

const retryableSubmitStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const RETRY_BACKOFF_JITTER_FACTOR = 0.2;
const RETRY_BACKOFF_MAX_SECONDS = 300;
const QUEUE_LEASE_TIMEOUT_WARN_RATIO = 0.8;
const MAX_QUEUE_REFILL_PASSES = 4;
const MAX_CONCURRENT_CLAIMED_ITEMS = 2;

const isRetryableTransportError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const detail = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|network|fetch failed|econnreset|etimedout|eai_again/i.test(detail);
};

const isRetryableUpstreamFailure = ({
  status,
  payload,
}: {
  status: number;
  payload: JsonObject;
}): boolean => {
  if (retryableSubmitStatuses.has(status)) return true;
  const upstreamCode = String(payload.code ?? "").toLowerCase();
  return upstreamCode === "rate_limit" || upstreamCode === "overloaded";
};

const normalizeError = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const asString = String(error ?? "").trim();
  return asString.length ? asString : "queue_dispatch_failed";
};

const readErrorCode = (error: unknown): string => {
  if (error instanceof QueueTransitionError) return error.code;
  return "DISPATCH_EXCEPTION";
};

const asObject = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readQueueLatencyMs = ({
  createdAt,
  generationMetadata,
  dispatchAtIso,
}: {
  createdAt: string | null;
  generationMetadata: unknown;
  dispatchAtIso: string;
}): number | null => {
  const metadata = asObject(generationMetadata);
  const enqueuedAtRaw = asString(metadata.queue_enqueued_at) ?? createdAt;
  if (!enqueuedAtRaw) return null;
  const enqueuedAtMs = Date.parse(enqueuedAtRaw);
  const dispatchAtMs = Date.parse(dispatchAtIso);
  if (!Number.isFinite(enqueuedAtMs) || !Number.isFinite(dispatchAtMs)) return null;
  return Math.max(0, dispatchAtMs - enqueuedAtMs);
};

const syncQueueDispatchProjection = async ({
  displayPrompt,
  generationId,
  modelId,
  provider,
  providerRequestId,
  queueState,
  requestId,
  sourceRef,
  taskState,
  userId,
}: {
  displayPrompt?: string | null;
  generationId: string;
  modelId: string;
  provider: string;
  providerRequestId?: string | null;
  queueState: "queued" | "dispatched";
  requestId?: string | null;
  sourceRef?: string | null;
  taskState: "pending" | "running";
  userId: string;
}) =>
  upsertGenerationProjection({
    generationId,
    userId,
    sourceRef: sourceRef ?? null,
    requestId: requestId ?? providerRequestId ?? null,
    provider,
    providerRequestId: providerRequestId ?? null,
    status: "ready",
    taskState,
    queueState,
    displayPrompt: displayPrompt ?? null,
    modelId,
    saveState: "idle",
    publicationState: "pending",
    resultUrls: [],
    savedMediaIds: [],
  });

const markAttemptRunningForExistingRequestId = async ({
  providerRequestId,
  userId,
  queueId,
  attemptNumber,
}: {
  providerRequestId: string;
  userId: string;
  queueId: string;
  attemptNumber: number;
}) => {
  const observedAt = new Date().toISOString();
  const result = await applyGenerationLifecycleTransition({
    intent: "queue_reconcile_running",
    attemptMutation: {
      kind: "state_update",
      input: {
        providerRequestId,
        userId,
        status: "running",
        observedAt,
        metadata: {
          queue_reconcile_at: observedAt,
          queue_id: queueId,
          queue_attempts: attemptNumber,
          queue_reconcile_reason: "existing_request_id",
        },
      },
      allowMissingAttempt: true,
    },
  });
  if (result.ok) {
    return;
  }
  throw new QueueTransitionError({
    code: "GENERATION_ATTEMPT_RUNNING_FAILED",
    step: "generation_attempt_running",
    message: result.error,
    retryable: true,
  });
};

const readProviderCapacitySnapshot = async ({
  scopeUserId,
  provider,
  modelId,
}: {
  scopeUserId?: string | null;
  provider: string;
  modelId: string;
}): Promise<ProviderCapacitySnapshot> => {
  const flags = readFalRuntimeFlags();
  const readSnapshot = async (scopeUserId?: string | null) =>
    readActiveProviderCapacitySnapshot({
      userId: scopeUserId,
      provider,
      modelId,
      includeUnattachedReservations: false,
      // Ignore orphaned holds once they outlive queue max-wait.
      staleIgnoreMinAgeSeconds: flags.queueMaxWaitSeconds,
      // Keep provider-linked running rows active until they exceed recovery cleanup windows.
      activeGenerationStaleIgnoreMinAgeSeconds: Math.max(
        flags.runningExhaustMinAgeSeconds,
        flags.providerAttachedReservationCleanupMinAgeSeconds
      ),
      // Keep very recent unmatched reservations fail-closed during persistence races.
      orphanGraceSeconds: Math.max(60, flags.queueBaseBackoffSeconds * 12),
    });
  const [userSnapshot, sharedSnapshot] = flags.admission.sharedProviderEnabled
    ? await Promise.all([readSnapshot(userId), readSnapshot(null)])
    : [await readSnapshot(userId), null];
  return {
    userSnapshot,
    sharedSnapshot,
  };
};

type DispatchCapacityReservationCounts = {
  global: number;
  tier: number;
};

type DispatchCapacityDecision = {
  atCap: boolean;
  scope: "per_user" | "shared_provider";
  snapshot: ProviderCapacitySnapshot;
};

type DispatchCapacityCoordinator = {
  acquire: (args: {
    userId: string;
    provider: string;
    modelId: string;
  }) => Promise<DispatchCapacityDecision>;
};

type DispatchCapacitySnapshotCache = {
  userSnapshots: Map<string, Promise<ProviderCapacitySnapshot>>;
  sharedSnapshots: Map<string, Promise<ProviderCapacitySnapshot>>;
};

const createReservationCounts = (): DispatchCapacityReservationCounts => ({
  global: 0,
  tier: 0,
});

const readMapReservationCounts = (
  reservations: Map<string, DispatchCapacityReservationCounts>,
  key: string
): DispatchCapacityReservationCounts => reservations.get(key) ?? createReservationCounts();

const incrementMapReservationCount = (
  reservations: Map<string, DispatchCapacityReservationCounts>,
  key: string,
  field: keyof DispatchCapacityReservationCounts
) => {
  const current = readMapReservationCounts(reservations, key);
  reservations.set(key, {
    ...current,
    [field]: current[field] + 1,
  });
};

const buildUserGlobalCapacityKey = ({
  userId,
  provider,
}: {
  userId: string;
  provider: string;
}): string => `${userId}:${provider}`;

const buildUserTierCapacityKey = ({
  userId,
  provider,
  tier,
}: {
  userId: string;
  provider: string;
  tier: string;
}): string => `${userId}:${provider}:${tier}`;

const buildSharedGlobalCapacityKey = ({ provider }: { provider: string }): string =>
  `shared:${provider}`;

const buildSharedTierCapacityKey = ({
  provider,
  tier,
}: {
  provider: string;
  tier: string;
}): string => `shared:${provider}:${tier}`;

const isCapacitySnapshotAtLimit = ({
  snapshot,
  reservedGlobal,
  reservedTier,
  globalMax,
  tierMax,
}: {
  snapshot: ProviderCapacitySnapshot;
  reservedGlobal: number;
  reservedTier: number;
  globalMax: number;
  tierMax: number;
}): boolean =>
  snapshot.globalActive + reservedGlobal >= globalMax ||
  snapshot.tierActive + reservedTier >= tierMax;

const createDispatchCapacityCoordinator = (): DispatchCapacityCoordinator => {
  let gate = Promise.resolve();
  const userReservations = new Map<string, DispatchCapacityReservationCounts>();
  const sharedReservations = new Map<string, DispatchCapacityReservationCounts>();
  // Cache capacity snapshots within the current worker pass; local reservations still gate
  // subsequent admits so overlapping claims cannot overrun the sampled capacity window.
  const snapshotCache: DispatchCapacitySnapshotCache = {
    userSnapshots: new Map(),
    sharedSnapshots: new Map(),
  };

  const readCachedSnapshot = <T>({
    cache,
    key,
    load,
  }: {
    cache: Map<string, Promise<T>>;
    key: string;
    load: () => Promise<T>;
  }): Promise<T> => {
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = load().catch((error) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, pending);
    return pending;
  };

  const withGate = async <T>(work: () => Promise<T>): Promise<T> => {
    const previousGate = gate;
    let releaseGate: (() => void) | null = null;
    gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    await previousGate;
    try {
      return await work();
    } finally {
      releaseGate?.();
    }
  };

  return {
    acquire: ({ userId, provider, modelId }) =>
      withGate(async () => {
        const flags = readFalRuntimeFlags();
        const userSnapshotCacheKey = `${userId}:${provider}:${modelId}`;
        const sharedSnapshotCacheKey = `${provider}:${modelId}`;
        const userSnapshotPromise = readCachedSnapshot({
          cache: snapshotCache.userSnapshots,
          key: userSnapshotCacheKey,
          load: async () =>
            await readProviderCapacitySnapshot({
              scopeUserId: userId,
              provider,
              modelId,
            }),
        });
        const sharedSnapshotPromise = flags.admission.sharedProviderEnabled
          ? readCachedSnapshot({
              cache: snapshotCache.sharedSnapshots,
              key: sharedSnapshotCacheKey,
              load: async () =>
                await readProviderCapacitySnapshot({
                  scopeUserId: null,
                  provider,
                  modelId,
                }),
            })
          : Promise.resolve(null);
        const [userSnapshot, sharedSnapshot] = await Promise.all([
          userSnapshotPromise,
          sharedSnapshotPromise,
        ]);
        const userGlobalKey = buildUserGlobalCapacityKey({ userId, provider });
        const userTierKey = buildUserTierCapacityKey({
          userId,
          provider,
          tier: userSnapshot.tier,
        });
        const userCounts = {
          global: readMapReservationCounts(userReservations, userGlobalKey).global,
          tier: readMapReservationCounts(userReservations, userTierKey).tier,
        };

        if (flags.admission.sharedProviderEnabled && sharedSnapshot) {
          const sharedGlobalKey = buildSharedGlobalCapacityKey({ provider });
          const sharedTierKey = buildSharedTierCapacityKey({
            provider,
            tier: sharedSnapshot.tier,
          });
          const sharedCounts = {
            global: readMapReservationCounts(sharedReservations, sharedGlobalKey).global,
            tier: readMapReservationCounts(sharedReservations, sharedTierKey).tier,
          };

          if (
            isCapacitySnapshotAtLimit({
              snapshot: sharedSnapshot,
              reservedGlobal: sharedCounts.global,
              reservedTier: sharedCounts.tier,
              globalMax: flags.admission.sharedProviderGlobalMax,
              tierMax: flags.admission.tierLimits[sharedSnapshot.tier],
            })
          ) {
            return {
              atCap: true,
              scope: "shared_provider" as const,
              snapshot: sharedSnapshot,
            };
          }

          if (
            isCapacitySnapshotAtLimit({
              snapshot: userSnapshot,
              reservedGlobal: userCounts.global,
              reservedTier: userCounts.tier,
              globalMax: flags.admission.globalMax,
              tierMax: flags.admission.tierLimits[userSnapshot.tier],
            })
          ) {
            return {
              atCap: true,
              scope: "per_user" as const,
              snapshot: userSnapshot,
            };
          }

          incrementMapReservationCount(userReservations, userGlobalKey, "global");
          incrementMapReservationCount(userReservations, userTierKey, "tier");
          incrementMapReservationCount(sharedReservations, sharedGlobalKey, "global");
          incrementMapReservationCount(sharedReservations, sharedTierKey, "tier");
          return {
            atCap: false,
            scope: "per_user" as const,
            snapshot: userSnapshot,
          };
        }

        if (
          isCapacitySnapshotAtLimit({
            snapshot: userSnapshot,
            reservedGlobal: userCounts.global,
            reservedTier: userCounts.tier,
            globalMax: flags.admission.globalMax,
            tierMax: flags.admission.tierLimits[userSnapshot.tier],
          })
        ) {
          return {
            atCap: true,
            scope: "per_user" as const,
            snapshot: userSnapshot,
          };
        }

        incrementMapReservationCount(userReservations, userGlobalKey, "global");
        incrementMapReservationCount(userReservations, userTierKey, "tier");
        return {
          atCap: false,
          scope: "per_user" as const,
          snapshot: userSnapshot,
        };
      }),
  };
};

const mapWithConcurrencyLimit = async <T, R>({
  items,
  limit,
  work,
}: {
  items: readonly T[];
  limit: number;
  work: (item: T) => Promise<R>;
}): Promise<R[]> => {
  if (!items.length) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) return;
        results[currentIndex] = await work(items[currentIndex]);
      }
    })
  );

  return results;
};

const resolveBackoffSeconds = ({
  baseSeconds,
  attempts,
}: {
  baseSeconds: number;
  attempts: number;
}) => {
  const exponent = Math.max(0, Math.min(8, attempts));
  return Math.max(1, Math.min(RETRY_BACKOFF_MAX_SECONDS, baseSeconds * 2 ** exponent));
};

const resolveJitteredBackoffSeconds = ({
  baseSeconds,
  attempts,
}: {
  baseSeconds: number;
  attempts: number;
}) => {
  const baseDelay = resolveBackoffSeconds({ baseSeconds, attempts });
  const jitterWindow = Math.max(1, Math.round(baseDelay * RETRY_BACKOFF_JITTER_FACTOR));
  const jitterOffset = Math.round((Math.random() * 2 - 1) * jitterWindow);
  return Math.max(1, Math.min(RETRY_BACKOFF_MAX_SECONDS, baseDelay + jitterOffset));
};

const toIsoAfterSeconds = (seconds: number): string =>
  new Date(Date.now() + seconds * 1000).toISOString();

const toRetryNextAttemptAtIso = ({
  baseSeconds,
  attempts,
}: {
  baseSeconds: number;
  attempts: number;
}) =>
  toIsoAfterSeconds(
    resolveJitteredBackoffSeconds({
      baseSeconds,
      attempts,
    })
  );

const parseIsoTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const readQueueAgeSeconds = (createdAt: string | null): number | null => {
  const parsedCreatedAt = parseIsoTimestamp(createdAt);
  if (parsedCreatedAt === null) return null;
  return Math.max(0, Math.floor((Date.now() - parsedCreatedAt) / 1000));
};

const readQueueSubmitTargets = ({
  provider,
  modelId,
}: {
  provider: string;
  modelId: string;
}): {
  targets: SubmitTarget[];
  resolutionErrorCode: string | null;
  resolutionErrorMessage: string | null;
} => {
  if (isFalProviderKey(provider)) {
    const profile = getFalModelProfileByModelId(modelId);
    if (!profile?.submitTargets?.length) {
      return {
        targets: [],
        resolutionErrorCode: null,
        resolutionErrorMessage: null,
      };
    }
    return {
      targets: profile.submitTargets,
      resolutionErrorCode: null,
      resolutionErrorMessage: null,
    };
  }
  if (isKieProviderKey(provider)) {
    try {
      return {
        targets: resolveKieSubmitTargetsForModel(modelId),
        resolutionErrorCode: null,
        resolutionErrorMessage: null,
      };
    } catch (error) {
      const message = normalizeError(error);
      const lowerMessage = message.toLowerCase();
      const errorCode = lowerMessage.includes("disabled by runtime flag")
        ? "KIE_RUNTIME_DISABLED"
        : lowerMessage.includes("not allowlisted")
          ? "KIE_MODEL_NOT_ALLOWLISTED"
          : "KIE_SUBMIT_TARGET_RESOLUTION_FAILED";
      return {
        targets: [],
        resolutionErrorCode: errorCode,
        resolutionErrorMessage: message,
      };
    }
  }
  return {
    targets: [],
    resolutionErrorCode: null,
    resolutionErrorMessage: null,
  };
};

const setGenerationFailed = async ({
  generationId,
  userId,
  message,
}: {
  generationId: string;
  userId: string;
  message: string;
}) => {
  const completedAtIso = new Date().toISOString();
  const result = await applyGenerationLifecycleTransition({
    intent: "queue_dispatch_exhausted",
    applyGenerationMutation: async () => {
      const response = await getSupabaseAdmin()
        .from("ai_generations")
        .update(
          buildQueueDispatchExhaustedGenerationUpdate({
            message,
            completedAtIso,
          })
        )
        .eq("id", generationId)
        .eq("user_id", userId)
        .select("id");
      const affectedCount = Array.isArray(response.data) ? response.data.length : 0;
      if (response.error) {
        return {
          ok: false,
          error: response.error.message ?? "generation_mark_failed_failed",
        };
      }
      if (affectedCount !== 1) {
        return {
          ok: false,
          error: `Expected one generation row update, received ${affectedCount}.`,
        };
      }
      return { ok: true };
    },
  });
  if (!result.ok) throw new Error(result.error);
};

const mergeGenerationMetadata = (existing: unknown, patch: JsonObject): JsonObject => {
  const base = asObject(existing);
  return {
    ...base,
    ...patch,
  };
};

const buildQueuedAcceptedRunningGenerationMetadata = ({
  generationMetadata,
  sourceRef,
  queueId,
}: {
  generationMetadata: unknown;
  sourceRef: string;
  queueId: string;
}): JsonObject =>
  mergeGenerationMetadata(generationMetadata, {
    source_ref: sourceRef,
    generation_submit_authority: "worker",
    queue_id: queueId,
  });

const createQueueDispatchStageTimings = (): QueueDispatchStageTimings => ({
  existingRequestReconcile: 0,
  capacityCheck: 0,
  providerKeyRead: 0,
  targetResolution: 0,
  payloadPreparation: 0,
  providerSubmit: 0,
  reservationSubmit: 0,
  generationTransition: 0,
  projectionSync: 0,
  queueRemove: 0,
});

const measureDispatchStage = async <T>({
  stageTimings,
  stage,
  work,
}: {
  stageTimings: QueueDispatchStageTimings;
  stage: keyof QueueDispatchStageTimings;
  work: () => Promise<T>;
}): Promise<T> => {
  const startedAt = Date.now();
  try {
    return await work();
  } finally {
    stageTimings[stage] = Math.max(0, Date.now() - startedAt);
  }
};

const processClaimedQueueItem = async ({
  req,
  routeLabel,
  item,
  maxAttempts,
  baseBackoffSeconds,
  capacityCoordinator,
}: {
  req?: QueueDispatchContext["req"];
  routeLabel: string;
  item: ClaimedGenerationQueueItem;
  maxAttempts: number;
  baseBackoffSeconds: number;
  capacityCoordinator: DispatchCapacityCoordinator;
}): Promise<QueueDispatchItemResult> => {
  const metrics = {
    submitted: 0,
    retried: 0,
    requeuedNoCapacity: 0,
    exhausted: 0,
    skipped: 0,
    errors: 0,
  };

  const generationMetadata = asObject(item.generationMetadata);
  const generationSourceRef = asString(generationMetadata.source_ref);
  const attemptNumber = item.attempts + 1;
  const provider = resolveProviderFromGenerationContext({
    provider: item.generationProvider,
    modelId: item.modelId,
    fallback: "fal",
  });
  const runtimeFlags = readFalRuntimeFlags();
  const stageTimings = createQueueDispatchStageTimings();

  if (
    attemptNumber === 1 &&
    item.timeoutMs > 0 &&
    runtimeFlags.queueLeaseSeconds * 1000 >= item.timeoutMs * QUEUE_LEASE_TIMEOUT_WARN_RATIO
  ) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "telemetry.queue.dispatch.lease_timeout_ratio_warn",
      statusCode: 200,
      message: "Queue lease duration is close to submit timeout budget.",
      userId: item.userId,
      metadata: {
        queue_id: item.queueId,
        generation_id: item.generationId,
        source_ref: item.sourceRef,
        queue_lease_seconds: runtimeFlags.queueLeaseSeconds,
        submit_timeout_ms: item.timeoutMs,
        warn_ratio: QUEUE_LEASE_TIMEOUT_WARN_RATIO,
      },
    });
  }

  const existingRequestId = item.generationRequestId;
  if (existingRequestId) {
    try {
      await measureDispatchStage({
        stageTimings,
        stage: "existingRequestReconcile",
        work: async () => {
          const reconcileAtIso = new Date().toISOString();
          const reservationResult = await markGenerationReservationSubmitted({
            userId: item.userId,
            sourceRef: item.sourceRef,
            providerRequestId: existingRequestId,
            metadata: {
              queue_reconcile_at: reconcileAtIso,
              queue_id: item.queueId,
              queue_attempts: attemptNumber,
              queue_reconcile_reason: "existing_request_id",
            },
          });
          assertReservationSubmissionAccepted({ result: reservationResult });
          await markAttemptRunningForExistingRequestId({
            providerRequestId: existingRequestId,
            userId: item.userId,
            queueId: item.queueId,
            attemptNumber,
          });
        },
      });

      const removeResult = await measureDispatchStage({
        stageTimings,
        stage: "queueRemove",
        work: () => removeQueueItem(item.queueId),
      });
      assertQueueMutationApplied({ result: removeResult, step: "queue_remove" });
      await measureDispatchStage({
        stageTimings,
        stage: "projectionSync",
        work: () =>
          syncQueueDispatchProjection({
            displayPrompt: asString(asObject(item.submitPayload).prompt),
            generationId: item.generationId,
            modelId: item.modelId,
            provider,
            providerRequestId: existingRequestId,
            queueState: "dispatched",
            requestId: existingRequestId,
            sourceRef: item.sourceRef,
            taskState: "running",
            userId: item.userId,
          }).catch(async (projectionError) => {
            await logGenerationFailure({
              req,
              routeLabel,
              source: "telemetry.queue.dispatch.projection_failed",
              statusCode: 200,
              message: "Queued generation running projection sync failed.",
              userId: item.userId,
              metadata: {
                queue_id: item.queueId,
                generation_id: item.generationId,
                source_ref: item.sourceRef,
                provider_request_id: existingRequestId,
                projection_error:
                  projectionError instanceof Error
                    ? projectionError.message
                    : String(projectionError),
              },
            });
          }),
      });
      metrics.skipped += 1;
    } catch (error) {
      const message = normalizeError(error);
      const errorCode = readErrorCode(error);
      const compensation = decideQueueTransitionCompensation({
        attemptNumber,
        maxAttempts,
        error,
        submitAccepted: false,
      });
      if (compensation === "retry") {
        const retryResult = await updateQueueItemForRetry({
          queueId: item.queueId,
          attempts: attemptNumber,
          nextAttemptAt: toRetryNextAttemptAtIso({
            baseSeconds: baseBackoffSeconds,
            attempts: attemptNumber,
          }),
          lastError: message,
          lastErrorCode: errorCode,
        });
        assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
        metrics.retried += 1;
      } else {
        const exhaustResult = await markQueueItemExhausted({
          queueId: item.queueId,
          attempts: attemptNumber,
          lastError: message,
          lastErrorCode: errorCode,
        });
        assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
        metrics.exhausted += 1;
      }
      metrics.errors += 1;
    }
    return metrics;
  }

  const capacityDecision = await measureDispatchStage({
    stageTimings,
    stage: "capacityCheck",
    work: () =>
      capacityCoordinator.acquire({
        userId: item.userId,
        provider,
        modelId: item.modelId,
      }),
  });
  if (capacityDecision.snapshot.staleIgnoredGlobal > 0 && attemptNumber === 1) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "telemetry.queue.dispatch.capacity_stale_ignored",
      statusCode: 200,
      message: "Ignored stale provider-attached reservations while evaluating queue capacity.",
      userId: item.userId,
      metadata: {
        queue_id: item.queueId,
        generation_id: item.generationId,
        model_id: item.modelId,
        tier: capacityDecision.snapshot.tier,
        stale_ignored_global: capacityDecision.snapshot.staleIgnoredGlobal,
        stale_ignored_tier: capacityDecision.snapshot.staleIgnoredTier,
      },
    });
  }

  if (capacityDecision.atCap) {
    const queueAgeSeconds = readQueueAgeSeconds(item.createdAt);
    if (queueAgeSeconds !== null && queueAgeSeconds >= runtimeFlags.queueMaxWaitSeconds) {
      const message = "Queued generation exceeded max wait time without available capacity.";
      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: message,
        lastErrorCode: "QUEUE_WAIT_TIMEOUT",
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      await releaseGenerationReservationBySourceRef({
        userId: item.userId,
        sourceRef: item.sourceRef,
        reason: "Auto-release: queued submit exceeded max wait time without capacity.",
        metadata: {
          queue_id: item.queueId,
          queue_attempts: attemptNumber,
          queue_age_seconds: queueAgeSeconds,
          queue_max_wait_seconds: runtimeFlags.queueMaxWaitSeconds,
        },
      });
      await setGenerationFailed({
        generationId: item.generationId,
        userId: item.userId,
        message: "Generation timed out in queue. Please retry.",
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.dispatch.exhausted",
        statusCode: 408,
        message,
        userId: item.userId,
        metadata: {
          queue_id: item.queueId,
          generation_id: item.generationId,
          source_ref: item.sourceRef,
          attempts: attemptNumber,
          model_id: item.modelId,
          error_code: "QUEUE_WAIT_TIMEOUT",
          queue_age_seconds: queueAgeSeconds,
          queue_max_wait_seconds: runtimeFlags.queueMaxWaitSeconds,
        },
      });
      metrics.exhausted += 1;
      return metrics;
    }

    const releaseResult = await releaseQueueLeaseBackToQueued({
      queueId: item.queueId,
      nextAttemptAt: toIsoAfterSeconds(Math.max(1, baseBackoffSeconds)),
    });
    assertQueueMutationApplied({ result: releaseResult, step: "queue_release" });
    metrics.requeuedNoCapacity += 1;
    return metrics;
  }

  let apiKey: string;
  try {
    apiKey = await measureDispatchStage({
      stageTimings,
      stage: "providerKeyRead",
      work: async () => readProviderApiKey(provider),
    });
  } catch (error) {
    const exhaustResult = await markQueueItemExhausted({
      queueId: item.queueId,
      attempts: item.attempts,
      lastError: normalizeError(error),
      lastErrorCode: "PROVIDER_KEY_MISSING",
    });
    assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
    await setGenerationFailed({
      generationId: item.generationId,
      userId: item.userId,
      message: "Generation queue dispatch failed due to missing server configuration.",
    });
    metrics.exhausted += 1;
    return metrics;
  }

  if (attemptNumber > maxAttempts) {
    const exhaustResult = await markQueueItemExhausted({
      queueId: item.queueId,
      attempts: attemptNumber,
      lastError: "Queue dispatch attempts exhausted before submit.",
      lastErrorCode: "QUEUE_ATTEMPTS_EXHAUSTED",
    });
    assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
    await releaseGenerationReservationBySourceRef({
      userId: item.userId,
      sourceRef: item.sourceRef,
      reason: "Auto-release: queue dispatch attempts exhausted.",
      metadata: {
        queue_id: item.queueId,
        queue_attempts: attemptNumber,
      },
    });
    await setGenerationFailed({
      generationId: item.generationId,
      userId: item.userId,
      message: "Generation failed while waiting in the submit queue. Please retry.",
    });
    metrics.exhausted += 1;
    return metrics;
  }

  const { webhookCallbackUrl, providerSubmitTargetResolution } = await measureDispatchStage({
    stageTimings,
    stage: "targetResolution",
    work: async () => ({
      webhookCallbackUrl: resolveWebhookCallbackUrl(runtimeFlags, {
        userId: item.userId,
        modelId: item.modelId,
      }),
      providerSubmitTargetResolution: readQueueSubmitTargets({
        provider,
        modelId: item.modelId,
      }),
    }),
  });
  const providerSubmitTargets = providerSubmitTargetResolution.targets;
  const submitTargets = isFalProviderKey(provider)
    ? withWebhookTargets(providerSubmitTargets, webhookCallbackUrl)
    : providerSubmitTargets;
  if (!submitTargets.length) {
    const resolutionErrorCode = providerSubmitTargetResolution.resolutionErrorCode;
    const resolutionErrorMessage = providerSubmitTargetResolution.resolutionErrorMessage;
    const missingTargetMessage =
      resolutionErrorMessage && resolutionErrorMessage !== "queue_dispatch_failed"
        ? `No submit target configured for queued model/provider (${provider}): ${resolutionErrorMessage}`
        : `No submit target configured for queued model/provider (${provider}).`;
    const exhaustResult = await markQueueItemExhausted({
      queueId: item.queueId,
      attempts: attemptNumber,
      lastError: missingTargetMessage,
      lastErrorCode: resolutionErrorCode ?? "MISSING_SUBMIT_TARGET",
    });
    assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
    await releaseGenerationReservationBySourceRef({
      userId: item.userId,
      sourceRef: item.sourceRef,
      reason: "Auto-release: queued submit model missing target.",
      metadata: {
        queue_id: item.queueId,
        model_id: item.modelId,
        provider_target_resolution_error_code: resolutionErrorCode,
        provider_target_resolution_error_message: resolutionErrorMessage,
      },
    });
    await setGenerationFailed({
      generationId: item.generationId,
      userId: item.userId,
      message: "Generation failed to start from queue. Please retry.",
    });
    metrics.exhausted += 1;
    return metrics;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, item.timeoutMs);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let submitAccepted = false;

  try {
    assertQueueIdentityInvariant({
      queueSourceRef: item.sourceRef,
      generationSourceRef,
    });

    const contractValidation = await measureDispatchStage({
      stageTimings,
      stage: "payloadPreparation",
      work: async () => {
        let queueDispatchPayload = item.submitPayload;
        if (isVideoGenerationModelId(item.modelId)) {
          const normalizedQueuePayload = normalizeVideoQueueDispatchPayload({
            modelId: item.modelId,
            payload: item.submitPayload,
          });
          if (!normalizedQueuePayload.ok) {
            const exhaustResult = await markQueueItemExhausted({
              queueId: item.queueId,
              attempts: attemptNumber,
              lastError: normalizedQueuePayload.error,
              lastErrorCode: normalizedQueuePayload.code,
            });
            assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
            await releaseGenerationReservationBySourceRef({
              userId: item.userId,
              sourceRef: item.sourceRef,
              reason: "Auto-release: queued video payload contract normalization failed.",
              metadata: {
                queue_id: item.queueId,
                queue_attempts: attemptNumber,
                error_code: normalizedQueuePayload.code,
                detail: normalizedQueuePayload.detail ?? null,
              },
            });
            await setGenerationFailed({
              generationId: item.generationId,
              userId: item.userId,
              message: "Generation failed queue payload normalization before provider submit.",
            });
            metrics.exhausted += 1;
            return null;
          }

          if (
            normalizedQueuePayload.queueCompatibilityApplied &&
            !runtimeFlags.videoQueueCompatNormalizationEnabled
          ) {
            const exhaustResult = await markQueueItemExhausted({
              queueId: item.queueId,
              attempts: attemptNumber,
              lastError: "Legacy queue payload compatibility is disabled.",
              lastErrorCode: "VIDEO_QUEUE_COMPAT_DISABLED",
            });
            assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
            await releaseGenerationReservationBySourceRef({
              userId: item.userId,
              sourceRef: item.sourceRef,
              reason: "Auto-release: queued video payload compatibility disabled.",
              metadata: {
                queue_id: item.queueId,
                queue_attempts: attemptNumber,
                error_code: "VIDEO_QUEUE_COMPAT_DISABLED",
              },
            });
            await setGenerationFailed({
              generationId: item.generationId,
              userId: item.userId,
              message: "Generation failed because legacy queue payload compatibility is disabled.",
            });
            metrics.exhausted += 1;
            return null;
          }

          queueDispatchPayload = normalizedQueuePayload.payload;
          if (
            normalizedQueuePayload.queueCompatibilityApplied ||
            normalizedQueuePayload.aliasUsage.length
          ) {
            await logGenerationFailure({
              req,
              routeLabel,
              source: "telemetry.queue.dispatch.video_payload_normalized",
              statusCode: 200,
              message: "Normalized queued video payload before dispatch.",
              userId: item.userId,
              metadata: {
                queue_id: item.queueId,
                generation_id: item.generationId,
                model_id: item.modelId,
                compatibility_applied: normalizedQueuePayload.queueCompatibilityApplied,
                alias_usage: normalizedQueuePayload.aliasUsage,
                envelope_version: normalizedQueuePayload.envelopeVersion,
              },
            });
          }
        }

        return evaluateFalPayloadContractForModel(item.modelId, {
          projectAllowedTopLevelFields: true,
          enforceAllowedTopLevelFields: true,
        })(queueDispatchPayload);
      },
    });
    if (contractValidation === null) {
      return metrics;
    }
    if (!contractValidation.valid) {
      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: contractValidation.error,
        lastErrorCode: "QUEUE_PAYLOAD_CONTRACT_VIOLATION",
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      await releaseGenerationReservationBySourceRef({
        userId: item.userId,
        sourceRef: item.sourceRef,
        reason: "Auto-release: queued submit payload violated dispatch contract.",
        metadata: {
          queue_id: item.queueId,
          queue_attempts: attemptNumber,
          error_code: "QUEUE_PAYLOAD_CONTRACT_VIOLATION",
          detail: contractValidation.detail ?? null,
        },
      });
      await setGenerationFailed({
        generationId: item.generationId,
        userId: item.userId,
        message: "Generation failed queue contract validation before provider submit.",
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.dispatch.exhausted",
        statusCode: 400,
        message: contractValidation.error,
        userId: item.userId,
        metadata: {
          queue_id: item.queueId,
          generation_id: item.generationId,
          source_ref: item.sourceRef,
          attempts: attemptNumber,
          model_id: item.modelId,
          error_code: "QUEUE_PAYLOAD_CONTRACT_VIOLATION",
          detail: contractValidation.detail ?? null,
        },
      });
      metrics.exhausted += 1;
      return metrics;
    }

    const submitResult = await measureDispatchStage({
      stageTimings,
      stage: "providerSubmit",
      work: () =>
        dispatchProviderSubmit({
          provider,
          modelId: item.modelId,
          targets: submitTargets,
          payload: contractValidation.projectedPayload,
          apiKey,
          signal: controller.signal,
          requestStartTimeoutSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
        }),
    });
    const upstream = submitResult.response;
    const upstreamData = asObject(submitResult.data);

    if (!upstream.ok) {
      const message =
        asString(upstreamData.error) ??
        asString(upstreamData.message) ??
        `Queued submit rejected (${upstream.status})`;
      const retryable = isRetryableUpstreamFailure({
        status: upstream.status,
        payload: upstreamData,
      });
      if (retryable && attemptNumber < maxAttempts) {
        const retryResult = await updateQueueItemForRetry({
          queueId: item.queueId,
          attempts: attemptNumber,
          nextAttemptAt: toRetryNextAttemptAtIso({
            baseSeconds: baseBackoffSeconds,
            attempts: attemptNumber,
          }),
          lastError: message,
          lastErrorCode: asString(upstreamData.code),
        });
        assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
        metrics.retried += 1;
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.queue.dispatch.retry",
          statusCode: upstream.status,
          message,
          userId: item.userId,
          metadata: {
            queue_id: item.queueId,
            generation_id: item.generationId,
            source_ref: item.sourceRef,
            attempts: attemptNumber,
            model_id: item.modelId,
          },
        });
        return metrics;
      }

      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: message,
        lastErrorCode: asString(upstreamData.code),
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      await releaseGenerationReservationBySourceRef({
        userId: item.userId,
        sourceRef: item.sourceRef,
        reason: "Auto-release: queued submit rejected by provider.",
        metadata: {
          queue_id: item.queueId,
          upstream_status: upstream.status,
          upstream_error: upstreamData,
        },
      });
      await setGenerationFailed({
        generationId: item.generationId,
        userId: item.userId,
        message,
      });
      metrics.exhausted += 1;
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.dispatch.exhausted",
        statusCode: upstream.status,
        message,
        userId: item.userId,
        metadata: {
          queue_id: item.queueId,
          generation_id: item.generationId,
          source_ref: item.sourceRef,
          attempts: attemptNumber,
          model_id: item.modelId,
        },
      });
      return metrics;
    }

    const providerRequestId = submitResult.providerRequestId;
    if (!providerRequestId) {
      const message = "Queued submit response did not include request_id.";
      if (attemptNumber < maxAttempts) {
        const retryResult = await updateQueueItemForRetry({
          queueId: item.queueId,
          attempts: attemptNumber,
          nextAttemptAt: toRetryNextAttemptAtIso({
            baseSeconds: baseBackoffSeconds,
            attempts: attemptNumber,
          }),
          lastError: message,
          lastErrorCode: "MISSING_REQUEST_ID",
        });
        assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
        metrics.retried += 1;
        return metrics;
      }

      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: message,
        lastErrorCode: "MISSING_REQUEST_ID",
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      await releaseGenerationReservationBySourceRef({
        userId: item.userId,
        sourceRef: item.sourceRef,
        reason: "Auto-release: queued submit response missing request id.",
        metadata: {
          queue_id: item.queueId,
          upstream_payload: upstreamData,
        },
      });
      await setGenerationFailed({
        generationId: item.generationId,
        userId: item.userId,
        message: "Generation failed to start from queue. Please retry.",
      });
      metrics.exhausted += 1;
      return metrics;
    }

    submitAccepted = true;
    const dispatchAtIso = new Date().toISOString();
    const reservationResult = await measureDispatchStage({
      stageTimings,
      stage: "reservationSubmit",
      work: () =>
        markGenerationReservationSubmitted({
          userId: item.userId,
          sourceRef: item.sourceRef,
          providerRequestId,
          metadata: {
            queue_id: item.queueId,
          },
        }),
    });
    assertReservationSubmissionAccepted({ result: reservationResult });
    assertQueueIdentityInvariant({
      queueSourceRef: item.sourceRef,
      generationSourceRef,
      reservationSourceRef: reservationResult.sourceRef ?? null,
    });

    const nextRecoveryAtIso = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const transitionResult = await measureDispatchStage({
      stageTimings,
      stage: "generationTransition",
      work: () =>
        applyAcceptedRunningGenerationTransition({
          applyGenerationMutation: async () => {
            const generationUpdate = await getSupabaseAdmin()
              .from("ai_generations")
              .update(
                buildAcceptedRunningGenerationUpdate({
                  provider,
                  modelId: item.modelId,
                  providerRequestId,
                  nextRecoveryAtIso,
                  metadata: buildQueuedAcceptedRunningGenerationMetadata({
                    generationMetadata,
                    sourceRef: item.sourceRef,
                    queueId: item.queueId,
                  }),
                })
              )
              .eq("id", item.generationId)
              .eq("user_id", item.userId)
              .select("id");
            const affectedCount = Array.isArray(generationUpdate.data)
              ? generationUpdate.data.length
              : 0;
            if (generationUpdate.error) {
              return {
                ok: false,
                error: generationUpdate.error.message ?? "generation_mark_running_failed",
              };
            }
            if (affectedCount !== 1) {
              return {
                ok: false,
                error: `Expected one generation row update, received ${affectedCount}.`,
              };
            }
            return { ok: true };
          },
          attemptInput: {
            generationId: item.generationId,
            userId: item.userId,
            provider,
            modelId: item.modelId,
            providerRequestId,
            dispatchSource: "queued_submit",
            submitRoute: item.submitRoute,
            queueId: item.queueId,
            observedAt: dispatchAtIso,
            metadata: {
              source_ref: item.sourceRef,
              generation_submit_authority: "worker",
              queue_dispatch_at: dispatchAtIso,
              queue_id: item.queueId,
              queue_attempts: attemptNumber,
              dispatch_source: "queued_submit",
              upstream_target_url: submitResult.targetUrl,
              upstream_target_index: submitResult.targetIndex,
            },
          },
        }),
    });
    if (!transitionResult.ok && transitionResult.stage === "generation") {
      assertGenerationMarkedRunning({
        affectedCount: 0,
        errorMessage: transitionResult.error,
      });
    }
    assertGenerationAttemptRecorded({
      ok: transitionResult.ok || transitionResult.stage === "running",
      errorMessage: transitionResult.ok
        ? null
        : transitionResult.stage === "record"
          ? transitionResult.error
          : null,
    });
    assertGenerationAttemptMarkedRunning({
      ok: transitionResult.ok || transitionResult.stage === "record",
      errorMessage: transitionResult.ok
        ? null
        : transitionResult.stage === "running"
          ? transitionResult.error
          : null,
    });
    const removeResult = await measureDispatchStage({
      stageTimings,
      stage: "queueRemove",
      work: () => removeQueueItem(item.queueId),
    });
    assertQueueMutationApplied({ result: removeResult, step: "queue_remove" });
    metrics.submitted += 1;
    const queueLatencyMs = readQueueLatencyMs({
      createdAt: item.createdAt,
      generationMetadata,
      dispatchAtIso,
    });
    const deferredWork = (async () => {
      try {
        await measureDispatchStage({
          stageTimings,
          stage: "projectionSync",
          work: () =>
            syncQueueDispatchProjection({
              displayPrompt: asString(asObject(item.submitPayload).prompt),
              generationId: item.generationId,
              modelId: item.modelId,
              provider,
              providerRequestId,
              queueState: "dispatched",
              requestId: providerRequestId,
              sourceRef: item.sourceRef,
              taskState: "running",
              userId: item.userId,
            }).catch(async (projectionError) => {
              await logGenerationFailure({
                req,
                routeLabel,
                source: "telemetry.queue.dispatch.projection_failed",
                statusCode: 200,
                message: "Queued generation running projection sync failed.",
                userId: item.userId,
                metadata: {
                  queue_id: item.queueId,
                  generation_id: item.generationId,
                  source_ref: item.sourceRef,
                  provider_request_id: providerRequestId,
                  projection_error:
                    projectionError instanceof Error
                      ? projectionError.message
                      : String(projectionError),
                },
              });
            }),
        });
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.queue.dispatch.submitted",
          statusCode: 200,
          message: "Queued generation submit dispatched.",
          userId: item.userId,
          metadata: {
            queue_id: item.queueId,
            generation_id: item.generationId,
            source_ref: item.sourceRef,
            attempts: attemptNumber,
            model_id: item.modelId,
            provider_request_id: providerRequestId,
            queue_latency_ms: queueLatencyMs,
            queue_latency_seconds:
              typeof queueLatencyMs === "number" ? Math.floor(queueLatencyMs / 1000) : null,
            dispatch_stage_timings_ms: stageTimings,
            provider_submit_diagnostics: submitResult.providerDiagnostics,
          },
        });
      } catch (tailError) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.queue.dispatch.tail_failed",
          statusCode: 200,
          message: "Queued generation dispatch tail work failed.",
          userId: item.userId,
          metadata: {
            queue_id: item.queueId,
            generation_id: item.generationId,
            source_ref: item.sourceRef,
            provider_request_id: providerRequestId,
            tail_error: tailError instanceof Error ? tailError.message : String(tailError),
          },
        });
      }
    })();
    return {
      ...metrics,
      deferredWork,
    };
  } catch (error) {
    const message = normalizeError(error);
    if (!submitAccepted && isRetryableTransportError(error) && attemptNumber < maxAttempts) {
      const retryResult = await updateQueueItemForRetry({
        queueId: item.queueId,
        attempts: attemptNumber,
        nextAttemptAt: toRetryNextAttemptAtIso({
          baseSeconds: baseBackoffSeconds,
          attempts: attemptNumber,
        }),
        lastError: message,
        lastErrorCode: "TRANSPORT_RETRYABLE",
      });
      assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
      metrics.retried += 1;
      return metrics;
    }

    const errorCode = readErrorCode(error);
    const compensation = decideQueueTransitionCompensation({
      attemptNumber,
      maxAttempts,
      error,
      submitAccepted,
    });
    if (compensation === "retry") {
      const retryResult = await updateQueueItemForRetry({
        queueId: item.queueId,
        attempts: attemptNumber,
        nextAttemptAt: toRetryNextAttemptAtIso({
          baseSeconds: baseBackoffSeconds,
          attempts: attemptNumber,
        }),
        lastError: message,
        lastErrorCode: errorCode,
      });
      assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
      metrics.retried += 1;
    } else {
      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: message,
        lastErrorCode: errorCode,
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      if (!submitAccepted || errorCode === "QUEUE_IDENTITY_MISMATCH") {
        await releaseGenerationReservationBySourceRef({
          userId: item.userId,
          sourceRef: item.sourceRef,
          reason:
            errorCode === "QUEUE_IDENTITY_MISMATCH"
              ? "Auto-release: queue dispatch identity mismatch."
              : "Auto-release: queue dispatch exception.",
          metadata: {
            queue_id: item.queueId,
            queue_attempts: attemptNumber,
            error: message,
            error_code: errorCode,
          },
        });
        await setGenerationFailed({
          generationId: item.generationId,
          userId: item.userId,
          message:
            errorCode === "QUEUE_IDENTITY_MISMATCH"
              ? "Generation failed queue identity validation. Please retry."
              : "Generation failed while queued. Please retry.",
        });
      }
      metrics.exhausted += 1;
    }

    metrics.errors += 1;
    return metrics;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const dispatchGenerationSubmitQueueBatch = async ({
  req,
  routeLabel,
  limit,
  userId,
}: DispatchOptions): Promise<QueueDispatchMetrics> => {
  const flags = readFalRuntimeFlags();
  const metrics: QueueDispatchMetrics = {
    claimed: 0,
    submitted: 0,
    retried: 0,
    requeuedNoCapacity: 0,
    exhausted: 0,
    skipped: 0,
    errors: 0,
  };

  if (!flags.queueEnabled) {
    return metrics;
  }

  const capacityCoordinator = createDispatchCapacityCoordinator();

  for (let pass = 0; pass < MAX_QUEUE_REFILL_PASSES; pass += 1) {
    const claimed = await claimGenerationSubmitQueueBatch({
      limit,
      leaseSeconds: flags.queueLeaseSeconds,
      userId,
    }).catch(async (error) => {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.dispatch.claim_failed",
        statusCode: 500,
        message: "Failed to claim queued generation dispatch batch.",
        userId: userId ?? undefined,
        metadata: {
          queue_limit: limit,
          queue_lease_seconds: flags.queueLeaseSeconds,
          queue_enabled: flags.queueEnabled,
          queue_refill_pass: pass + 1,
          detail: normalizeError(error),
        },
      });
      throw error;
    });

    metrics.claimed += claimed.length;
    if (!claimed.length) {
      break;
    }

    let passSubmitted = 0;
    let passRetried = 0;
    let passExhausted = 0;
    let passSkipped = 0;
    const deferredWork: Promise<void>[] = [];

    const results = await mapWithConcurrencyLimit({
      items: claimed,
      limit: MAX_CONCURRENT_CLAIMED_ITEMS,
      work: (item) =>
        processClaimedQueueItem({
          req,
          routeLabel,
          item,
          maxAttempts: flags.queueMaxAttempts,
          baseBackoffSeconds: flags.queueBaseBackoffSeconds,
          capacityCoordinator,
        }),
    });

    for (const result of results) {
      metrics.submitted += result.submitted;
      metrics.retried += result.retried;
      metrics.requeuedNoCapacity += result.requeuedNoCapacity;
      metrics.exhausted += result.exhausted;
      metrics.skipped += result.skipped;
      metrics.errors += result.errors;
      passSubmitted += result.submitted;
      passRetried += result.retried;
      passExhausted += result.exhausted;
      passSkipped += result.skipped;
      if (result.deferredWork) {
        deferredWork.push(result.deferredWork);
      }
    }

    if (deferredWork.length) {
      await Promise.allSettled(deferredWork);
    }

    const madeForwardProgress =
      passSubmitted > 0 || passRetried > 0 || passExhausted > 0 || passSkipped > 0;
    if (!madeForwardProgress) {
      break;
    }
  }

  return metrics;
};
