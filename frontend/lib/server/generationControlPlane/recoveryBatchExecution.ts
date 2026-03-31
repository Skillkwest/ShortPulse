import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { executeGenerationRecovery } from "../falIntegration/recoveryExecution";
import type { ClaimedGeneration } from "./recoveryBatchAcquisition";

const ALLOWLIST_SKIP_RETRY_DELAY_SECONDS = 15 * 60;
const EXECUTION_ERROR_RETRY_DELAY_SECONDS = 2 * 60;

export type RecoveryBatchExecutionMetrics = {
  recovered: number;
  requeued: number;
  exhausted: number;
  skipped: number;
  duplicates: number;
  processed: number;
  errors: number;
};

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

const isAllowedModel = (modelId: string, allowlist: Set<string>): boolean => {
  if (!allowlist.size) return true;
  for (const item of allowlist) {
    if (item === "*") return true;
    if (item.endsWith("*") && modelId.startsWith(item.slice(0, -1))) return true;
    if (item === modelId) return true;
  }
  return false;
};

const requeueAllowlistSkippedGeneration = async ({
  supabaseAdmin,
  row,
}: {
  supabaseAdmin: SupabaseAdminClient;
  row: ClaimedGeneration;
}) => {
  const previousAttempts = Math.max((row.recovery_attempts ?? 1) - 1, 0);
  const retryAtIso = new Date(Date.now() + ALLOWLIST_SKIP_RETRY_DELAY_SECONDS * 1000).toISOString();
  return supabaseAdmin
    .from("ai_generations")
    .update({
      recovery_state: "queued",
      recovery_attempts: previousAttempts,
      next_recovery_at: retryAtIso,
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id);
};

const requeueErroredGeneration = async ({
  supabaseAdmin,
  row,
}: {
  supabaseAdmin: SupabaseAdminClient;
  row: ClaimedGeneration;
}) => {
  const retryAt = new Date(Date.now() + EXECUTION_ERROR_RETRY_DELAY_SECONDS * 1000).toISOString();
  return supabaseAdmin
    .from("ai_generations")
    .update({
      recovery_state: "queued",
      next_recovery_at: retryAt,
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id);
};

export const executeClaimedRecoveryBatch = async ({
  supabaseAdmin,
  rows,
  modelAllowlist,
  maxAttempts,
  routeLabel,
  logException,
}: {
  supabaseAdmin: SupabaseAdminClient;
  rows: ClaimedGeneration[];
  modelAllowlist: Set<string>;
  maxAttempts: number;
  routeLabel: string;
  logException: (args: { error: unknown; metadata: Record<string, unknown> }) => Promise<void>;
}): Promise<RecoveryBatchExecutionMetrics> => {
  let recovered = 0;
  let requeued = 0;
  let exhausted = 0;
  let skipped = 0;
  let duplicates = 0;
  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    if (!isAllowedModel(row.model_id, modelAllowlist)) {
      skipped += 1;
      try {
        await requeueAllowlistSkippedGeneration({
          supabaseAdmin,
          row,
        });
      } catch (error) {
        errors += 1;
        await logException({
          error,
          metadata: {
            stage: "allowlist_skip_requeue",
            generation_id: row.id,
            model_id: row.model_id,
          },
        });
      }
      continue;
    }

    try {
      const result = await executeGenerationRecovery({
        actor: "reconciler",
        generationId: row.id,
        requestId: row.request_id,
        maxAttempts,
        routeLabel,
      });
      if (result.processed) processed += 1;
      if (result.state === "recovered") {
        recovered += 1;
        continue;
      }
      if (result.state === "already_persisted") {
        duplicates += 1;
        recovered += 1;
        continue;
      }
      if (result.state === "provider_running" || result.state === "no_media") {
        requeued += 1;
        continue;
      }
      if (result.state === "exhausted" || result.state === "provider_failed") {
        exhausted += 1;
        continue;
      }
      if (result.state === "skipped") {
        skipped += 1;
      }
    } catch (error) {
      errors += 1;
      await logException({
        error,
        metadata: {
          stage: "execute_generation_recovery",
          generation_id: row.id,
          request_id: row.request_id,
        },
      });
      await requeueErroredGeneration({
        supabaseAdmin,
        row,
      });
    }
  }

  return {
    recovered,
    requeued,
    exhausted,
    skipped,
    duplicates,
    processed,
    errors,
  };
};
