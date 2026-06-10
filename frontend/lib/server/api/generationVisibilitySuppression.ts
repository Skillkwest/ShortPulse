/**
 * Reference Grid visibility suppression for generated outputs.
 * Keeps user-facing hide/delete actions separate from provider lifecycle truth.
 */
import { cleanupAudioCompanionArt } from "../audioCompanionArt/cleanup";
import { writeAppErrorLog } from "./appErrorLogs";
import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export const GENERATION_VISIBILITY_SUPPRESSION_REASONS = new Set([
  "reference_grid_clear",
  "reference_grid_delete",
  "quick_slot_detach_finalize",
]);

export type GenerationVisibilitySuppressionIdentifiers = {
  userId: string;
  sourceRef?: string | null;
  generationId?: string | null;
  requestId?: string | null;
};

export type RecordGenerationVisibilitySuppressionInput =
  GenerationVisibilitySuppressionIdentifiers & {
    reason?: string;
    metadata?: JsonObject;
    supabaseAdmin?: SupabaseAdmin;
  };

export type RecordGenerationVisibilitySuppressionResult = {
  suppressionId: string | null;
  matchedGenerationIds: string[];
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

export const normalizeGenerationVisibilitySuppressionReason = (value: unknown): string | null => {
  const normalized = normalizeString(value) ?? "reference_grid_clear";
  return GENERATION_VISIBILITY_SUPPRESSION_REASONS.has(normalized) ? normalized : null;
};

const resolveGenerationIds = async ({
  adminClient,
  userId,
  sourceRef,
  generationId,
  requestId,
}: GenerationVisibilitySuppressionIdentifiers & { adminClient: SupabaseAdmin }): Promise<
  string[]
> => {
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

const buildSuppressionMetadata = ({
  metadata,
  nowIso,
  reason,
  callerMetadata,
}: {
  metadata: unknown;
  nowIso: string;
  reason: string;
  callerMetadata: JsonObject;
}): JsonObject => ({
  ...asObject(metadata),
  reference_grid_suppressed: true,
  reference_grid_suppressed_at: nowIso,
  reference_grid_suppression_reason: reason,
  reference_grid_suppression_metadata: callerMetadata,
  hidden_in_reference_grid: true,
});

/**
 * Suppress Reference Grid visibility without changing provider lifecycle state.
 */
export const recordGenerationVisibilitySuppression = async ({
  userId,
  sourceRef,
  generationId,
  requestId,
  reason = "reference_grid_clear",
  metadata = {},
  supabaseAdmin,
}: RecordGenerationVisibilitySuppressionInput): Promise<RecordGenerationVisibilitySuppressionResult> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const normalizedSourceRef = normalizeString(sourceRef);
  const normalizedGenerationId = normalizeString(generationId);
  const normalizedRequestId = normalizeString(requestId);
  const normalizedReason = normalizeGenerationVisibilitySuppressionReason(reason);

  if (!normalizedReason) {
    throw new Error("generation_visibility_suppression_reason_invalid");
  }

  if (!normalizedSourceRef && !normalizedGenerationId && !normalizedRequestId) {
    throw new Error("generation_visibility_suppression_identifier_required");
  }

  const nowIso = new Date().toISOString();
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
        .select("metadata, request_id, status, recovery_state")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      const generationRow = asObject(data);
      const nextMetadata = buildSuppressionMetadata({
        metadata: generationRow.metadata,
        nowIso,
        reason: normalizedReason,
        callerMetadata: metadata,
      });

      const generationUpdate = await adminClient
        .from("ai_generations")
        .update({
          metadata: nextMetadata,
        })
        .eq("id", id)
        .eq("user_id", userId);
      if (generationUpdate.error) {
        throw new Error(
          generationUpdate.error.message || "Failed to suppress generation visibility."
        );
      }

      const projectionUpdate = await adminClient
        .from("generation_projection")
        .update({
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

      await writeAppErrorLog({
        source: "telemetry.generation.visibility_suppressed",
        scope: "generation",
        severity: "low",
        message: "Generation Reference Grid visibility suppressed without changing lifecycle.",
        route: "generation-abandon",
        endpoint: "/api/generation/abandon",
        requestId: normalizeString(generationRow.request_id) ?? normalizedRequestId,
        userId,
        metadata: {
          generation_id: id,
          reason: normalizedReason,
          generation_status: normalizeString(generationRow.status),
          recovery_state: normalizeString(generationRow.recovery_state),
          lifecycle_preserved: true,
        },
      }).catch(() => undefined);
    })
  );

  return { suppressionId: null, matchedGenerationIds };
};
