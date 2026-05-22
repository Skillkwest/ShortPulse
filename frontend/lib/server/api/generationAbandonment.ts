import { getSupabaseAdmin } from "./supabaseAdmin";
import { settleGenerationOutcome } from "./generationBilling";
import { cleanupAudioCompanionArt } from "../audioCompanionArt/cleanup";

type JsonObject = Record<string, unknown>;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const ABANDONED_ERROR_MESSAGE = "Generation abandoned by user.";
const ABANDONED_FAILURE_REASON_CODE = "user_abandoned";

export type GenerationAbandonmentIdentifiers = {
  userId: string;
  sourceRef?: string | null;
  generationId?: string | null;
  requestId?: string | null;
};

export type RecordGenerationAbandonmentInput = GenerationAbandonmentIdentifiers & {
  reason?: string;
  metadata?: JsonObject;
  noRefund?: boolean;
  supabaseAdmin?: SupabaseAdmin;
};

export type GenerationAbandonmentContext = {
  abandoned: boolean;
  noRefund: boolean;
  source: "metadata" | "abandonment_row" | null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const isDuplicateError = (error: unknown): boolean => {
  const record = asObject(error);
  return record.code === "23505" || String(record.message ?? "").includes("duplicate key");
};

export const isGenerationAbandonedMetadata = (metadata: unknown): boolean => {
  const record = asObject(metadata);
  return record.user_abandoned === true || record.abandoned_no_refund === true;
};

const readNoRefundFromMetadata = (metadata: unknown): boolean => {
  const record = asObject(metadata);
  if (typeof record.abandoned_no_refund === "boolean") return record.abandoned_no_refund;
  if (typeof record.no_refund === "boolean") return record.no_refund;
  return isGenerationAbandonedMetadata(record);
};

const buildAbandonedMetadata = ({
  metadata,
  nowIso,
  reason,
  noRefund,
}: {
  metadata: unknown;
  nowIso: string;
  reason: string;
  noRefund: boolean;
}): JsonObject => ({
  ...asObject(metadata),
  user_abandoned: true,
  abandoned_at: nowIso,
  abandon_reason: reason,
  abandoned_no_refund: noRefund,
  hidden_in_reference_grid: true,
});

const isActiveGenerationStatus = (value: unknown): boolean => {
  const normalized = normalizeString(value)?.toLowerCase();
  return normalized === "pending" || normalized === "submitted" || normalized === "running";
};

const resolveGenerationIds = async ({
  adminClient,
  userId,
  sourceRef,
  generationId,
  requestId,
}: GenerationAbandonmentIdentifiers & { adminClient: SupabaseAdmin }): Promise<string[]> => {
  const ids = new Set<string>();
  const normalizedGenerationId = normalizeString(generationId);
  const normalizedSourceRef = normalizeString(sourceRef);
  const normalizedRequestId = normalizeString(requestId);
  if (normalizedGenerationId) ids.add(normalizedGenerationId);

  const addProjectionMatches = async (column: "source_ref" | "request_id", value: string) => {
    const { data, error } = await adminClient
      .from("generation_projection")
      .select("generation_id")
      .eq("user_id", userId)
      .eq(column, value)
      .limit(20);
    if (error || !Array.isArray(data)) return;
    data.forEach((row) => {
      const id = normalizeString((row as Record<string, unknown>).generation_id);
      if (id) ids.add(id);
    });
  };

  if (normalizedSourceRef) {
    await addProjectionMatches("source_ref", normalizedSourceRef);
  }

  if (normalizedRequestId) {
    await addProjectionMatches("request_id", normalizedRequestId);
  }

  return [...ids];
};

const readExistingAbandonmentId = async ({
  adminClient,
  userId,
  sourceRef,
  generationId,
  requestId,
}: GenerationAbandonmentIdentifiers & { adminClient: SupabaseAdmin }): Promise<string | null> => {
  const filters: Array<["source_ref" | "generation_id" | "request_id", string | null]> = [
    ["generation_id", normalizeString(generationId)],
    ["source_ref", normalizeString(sourceRef)],
    ["request_id", normalizeString(requestId)],
  ];
  for (const [column, value] of filters) {
    if (!value) continue;
    const { data, error } = await adminClient
      .from("generation_abandonments")
      .select("id")
      .eq("user_id", userId)
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error || !data || typeof data !== "object" || Array.isArray(data)) continue;
    const id = normalizeString((data as Record<string, unknown>).id);
    if (id) return id;
  }
  return null;
};

export const recordGenerationAbandonment = async ({
  userId,
  sourceRef,
  generationId,
  requestId,
  reason = "reference_grid_clear",
  metadata = {},
  noRefund = true,
  supabaseAdmin,
}: RecordGenerationAbandonmentInput): Promise<{
  abandonmentId: string | null;
  matchedGenerationIds: string[];
}> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const normalizedSourceRef = normalizeString(sourceRef);
  const normalizedGenerationId = normalizeString(generationId);
  const normalizedRequestId = normalizeString(requestId);
  if (!normalizedSourceRef && !normalizedGenerationId && !normalizedRequestId) {
    throw new Error("generation_abandonment_identifier_required");
  }

  const nowIso = new Date().toISOString();
  const abandonmentMetadata = {
    ...metadata,
    user_abandoned: true,
    abandoned_at: nowIso,
    no_refund: noRefund,
  };
  const existingId = await readExistingAbandonmentId({
    adminClient,
    userId,
    sourceRef: normalizedSourceRef,
    generationId: normalizedGenerationId,
    requestId: normalizedRequestId,
  });

  let abandonmentId = existingId;
  if (existingId) {
    const { error } = await adminClient
      .from("generation_abandonments")
      .update({
        source_ref: normalizedSourceRef,
        generation_id: normalizedGenerationId,
        request_id: normalizedRequestId,
        reason,
        no_refund: noRefund,
        metadata: abandonmentMetadata,
        updated_at: nowIso,
      })
      .eq("id", existingId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { data, error } = await adminClient
      .from("generation_abandonments")
      .insert({
        user_id: userId,
        source_ref: normalizedSourceRef,
        generation_id: normalizedGenerationId,
        request_id: normalizedRequestId,
        reason,
        no_refund: noRefund,
        metadata: abandonmentMetadata,
      })
      .select("id")
      .maybeSingle();
    if (error && !isDuplicateError(error)) throw error;
    abandonmentId =
      normalizeString(
        data && typeof data === "object" ? (data as Record<string, unknown>).id : null
      ) ?? null;
  }

  const matchedGenerationIds = await resolveGenerationIds({
    adminClient,
    userId,
    sourceRef: normalizedSourceRef,
    generationId: normalizedGenerationId,
    requestId: normalizedRequestId,
  });

  await Promise.all(
    matchedGenerationIds.map(async (id) => {
      const { data } = await adminClient
        .from("ai_generations")
        .select("metadata, request_id, status")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      const generationRow = asObject(data);
      const nextMetadata = buildAbandonedMetadata({
        metadata: generationRow.metadata,
        nowIso,
        reason,
        noRefund,
      });
      const providerRequestId = normalizeString(generationRow.request_id) ?? normalizedRequestId;
      const shouldCloseGeneration = isActiveGenerationStatus(generationRow.status);
      if (shouldCloseGeneration && providerRequestId) {
        const settlement = await settleGenerationOutcome({
          userId,
          providerRequestId,
          outcome: "fail",
          reason: ABANDONED_ERROR_MESSAGE,
          routeLabel: "generation-abandon",
          abandonedNoRefund: noRefund,
          detail: {
            generation_id: id,
            abandon_reason: reason,
            abandoned_at: nowIso,
          },
        });
        if (!settlement.settled) {
          throw new Error(
            `Failed to settle abandoned generation before terminalizing it: ${settlement.note}`
          );
        }
      }
      const generationPayload: Record<string, unknown> = { metadata: nextMetadata };
      if (shouldCloseGeneration) {
        generationPayload.status = "fail";
        generationPayload.completed_at = nowIso;
        generationPayload.failure_reason_code = ABANDONED_FAILURE_REASON_CODE;
        generationPayload.error_message = ABANDONED_ERROR_MESSAGE;
        generationPayload.recovery_state = "exhausted";
        generationPayload.next_recovery_at = null;
        generationPayload.last_recovery_at = nowIso;
      }
      const generationUpdate = await adminClient
        .from("ai_generations")
        .update(generationPayload)
        .eq("id", id)
        .eq("user_id", userId);
      if (generationUpdate.error) {
        throw new Error(generationUpdate.error.message || "Failed to mark generation abandoned.");
      }
      if (shouldCloseGeneration) {
        const attemptUpdate = await adminClient
          .from("generation_attempts")
          .update({
            status: "abandoned",
            completed_at: nowIso,
            error_message: ABANDONED_ERROR_MESSAGE,
          })
          .eq("generation_id", id)
          .eq("user_id", userId);
        if (attemptUpdate.error) {
          throw new Error(
            attemptUpdate.error.message || "Failed to mark generation attempt abandoned."
          );
        }
      }
      const projectionUpdate = await adminClient
        .from("generation_projection")
        .update({
          ...(shouldCloseGeneration
            ? {
                status: "ready",
                task_state: "fail",
                queue_state: "failed",
                error_message: ABANDONED_ERROR_MESSAGE,
                error_message_short: ABANDONED_ERROR_MESSAGE,
                error_detail: ABANDONED_ERROR_MESSAGE,
                completed_at: nowIso,
              }
            : {}),
          companion_art_status: null,
          companion_art_storage_path: null,
          hidden_in_reference_grid: true,
          reference_grid_visible: false,
          publication_state: "suppressed",
          updated_at: nowIso,
        })
        .eq("generation_id", id)
        .eq("user_id", userId);
      if (projectionUpdate.error) {
        throw new Error(
          projectionUpdate.error.message || "Failed to suppress generation projection."
        );
      }
      const publicationUpdate = await adminClient
        .from("generation_publications")
        .update({
          publication_state: "suppressed",
          visible_in_reference_grid: false,
          updated_at: nowIso,
        })
        .eq("generation_id", id)
        .eq("user_id", userId);
      if (publicationUpdate.error) {
        throw new Error(
          publicationUpdate.error.message || "Failed to suppress generation publication."
        );
      }
      await cleanupAudioCompanionArt({
        generationId: id,
        userId,
        clearProjection: false,
        supabaseAdmin: adminClient,
      });
    })
  );

  return { abandonmentId, matchedGenerationIds };
};

export const readGenerationAbandonmentContext = async ({
  userId,
  sourceRef,
  generationId,
  requestId,
  metadata,
  supabaseAdmin,
}: GenerationAbandonmentIdentifiers & {
  metadata?: unknown;
  supabaseAdmin?: SupabaseAdmin;
}): Promise<GenerationAbandonmentContext> => {
  if (isGenerationAbandonedMetadata(metadata)) {
    return {
      abandoned: true,
      noRefund: readNoRefundFromMetadata(metadata),
      source: "metadata",
    };
  }

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const filters: Array<["source_ref" | "generation_id" | "request_id", string | null]> = [
    ["generation_id", normalizeString(generationId)],
    ["source_ref", normalizeString(sourceRef)],
    ["request_id", normalizeString(requestId)],
  ];
  for (const [column, value] of filters) {
    if (!value) continue;
    const { data, error } = await adminClient
      .from("generation_abandonments")
      .select("no_refund")
      .eq("user_id", userId)
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error || !data || typeof data !== "object" || Array.isArray(data)) continue;
    const noRefund = (data as Record<string, unknown>).no_refund;
    return {
      abandoned: true,
      noRefund: typeof noRefund === "boolean" ? noRefund : true,
      source: "abandonment_row",
    };
  }

  return { abandoned: false, noRefund: false, source: null };
};
