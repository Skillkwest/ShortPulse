import {
  resolveSupportedRecoveryProviderFamily,
  tryClaimRecoveryCandidate,
} from "../api/generationRecoveryClaimPolicy";
import { getSupabaseAdmin } from "../api/supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type ClaimedGeneration = {
  id: string;
  user_id: string;
  request_id: string | null;
  provider: string | null;
  model_id: string;
  status: string;
  recovery_state: string | null;
  recovery_attempts: number | null;
};

export type RecoveryBatchAcquisitionResult = {
  rows: ClaimedGeneration[];
  claimSource: "rpc" | "fallback";
  rpcError: unknown | null;
};

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseClaimedGeneration = (value: unknown): ClaimedGeneration | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const modelId = asString(row.model_id);
  const status = asString(row.status);
  if (!id || !userId || !modelId || !status) return null;
  return {
    id,
    user_id: userId,
    request_id: asString(row.request_id),
    provider: asString(row.provider),
    model_id: modelId,
    status,
    recovery_state: asString(row.recovery_state),
    recovery_attempts: asNumber(row.recovery_attempts),
  };
};

const claimFallback = async ({
  supabaseAdmin,
  batchSize,
  maxAttempts,
  minAgeSeconds,
  leaseSeconds,
}: {
  supabaseAdmin: SupabaseAdminClient;
  batchSize: number;
  maxAttempts: number;
  minAgeSeconds: number;
  leaseSeconds: number;
}): Promise<ClaimedGeneration[]> => {
  const oldestCreatedAtIso = new Date(Date.now() - minAgeSeconds * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const leaseUntilIso = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select(
      "id, user_id, request_id, provider, model_id, status, recovery_state, recovery_attempts"
    )
    .in("recovery_state", ["queued", "recovering"])
    .lte("created_at", oldestCreatedAtIso)
    .or(`next_recovery_at.is.null,next_recovery_at.lte.${nowIso}`)
    .lt("recovery_attempts", maxAttempts)
    .order("next_recovery_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error || !Array.isArray(data)) return [];

  const claimed: ClaimedGeneration[] = [];
  for (const raw of data) {
    const row = parseClaimedGeneration(raw);
    if (!row) continue;
    if (!resolveSupportedRecoveryProviderFamily(row.provider)) continue;
    const claimResult = await tryClaimRecoveryCandidate({
      candidate: {
        id: row.id,
        userId: row.user_id,
        requestId: row.request_id,
        provider: row.provider,
        status: row.status,
        recoveryState: row.recovery_state,
        recoveryAttempts: row.recovery_attempts,
      },
      maxAttempts,
      oldestAllowedIso: oldestCreatedAtIso,
      nowIso,
      leaseUntilIso,
      supabaseAdmin,
    });
    if (claimResult.claimed) {
      claimed.push({
        ...row,
        request_id: claimResult.requestId,
        recovery_attempts: (row.recovery_attempts ?? 0) + 1,
        recovery_state: "recovering",
      });
    }
  }

  return claimed;
};

const claimImmediateNoMediaRows = async ({
  supabaseAdmin,
  batchSize,
  maxAttempts,
  leaseSeconds,
}: {
  supabaseAdmin: SupabaseAdminClient;
  batchSize: number;
  maxAttempts: number;
  leaseSeconds: number;
}): Promise<ClaimedGeneration[]> => {
  if (batchSize <= 0) return [];

  const nowIso = new Date().toISOString();
  const oldestAllowedIso = nowIso;
  const leaseUntilIso = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const query = supabaseAdmin
    .from("ai_generations")
    .select(
      [
        "id",
        "user_id",
        "request_id",
        "provider",
        "model_id",
        "status",
        "recovery_state",
        "recovery_attempts",
      ].join(", ")
    )
    .in("recovery_state", ["queued", "recovering"])
    .eq("failure_reason_code", "terminal_success_no_media")
    .or(`next_recovery_at.is.null,next_recovery_at.lte.${nowIso}`)
    .lt("recovery_attempts", maxAttempts)
    .order("next_recovery_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];

  const claimed: ClaimedGeneration[] = [];
  for (const raw of data) {
    const row = parseClaimedGeneration(raw);
    if (!row) continue;
    if (!resolveSupportedRecoveryProviderFamily(row.provider)) continue;
    const claimResult = await tryClaimRecoveryCandidate({
      candidate: {
        id: row.id,
        userId: row.user_id,
        requestId: row.request_id,
        provider: row.provider,
        status: row.status,
        recoveryState: row.recovery_state,
        recoveryAttempts: row.recovery_attempts,
      },
      maxAttempts,
      oldestAllowedIso,
      nowIso,
      leaseUntilIso,
      bypassMinAge: true,
      supabaseAdmin,
    });
    if (claimResult.claimed) {
      claimed.push({
        ...row,
        request_id: claimResult.requestId,
        recovery_attempts: (row.recovery_attempts ?? 0) + 1,
        recovery_state: "recovering",
      });
    }
  }

  return claimed;
};

const claimAttemptBudgetRows = async ({
  supabaseAdmin,
  batchSize,
  maxAttempts,
  minAgeSeconds,
  leaseSeconds,
}: {
  supabaseAdmin: SupabaseAdminClient;
  batchSize: number;
  maxAttempts: number;
  minAgeSeconds: number;
  leaseSeconds: number;
}): Promise<ClaimedGeneration[]> => {
  if (batchSize <= 0) return [];

  const oldestCreatedAtIso = new Date(Date.now() - minAgeSeconds * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const leaseUntilIso = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select(
      [
        "id",
        "user_id",
        "request_id",
        "provider",
        "model_id",
        "status",
        "recovery_state",
        "recovery_attempts",
      ].join(", ")
    )
    .in("status", ["running", "pending"])
    .in("recovery_state", ["queued", "recovering"])
    .lte("created_at", oldestCreatedAtIso)
    .or(`next_recovery_at.is.null,next_recovery_at.lte.${nowIso}`)
    .gte("recovery_attempts", maxAttempts)
    .order("next_recovery_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error || !Array.isArray(data)) return [];

  const claimed: ClaimedGeneration[] = [];
  for (const raw of data) {
    const row = parseClaimedGeneration(raw);
    if (!row) continue;
    if (!resolveSupportedRecoveryProviderFamily(row.provider)) continue;

    let claimQuery = supabaseAdmin
      .from("ai_generations")
      .update({
        recovery_state: "recovering",
        last_recovery_at: nowIso,
        next_recovery_at: leaseUntilIso,
      })
      .eq("id", row.id)
      .eq("user_id", row.user_id)
      .eq("status", row.status)
      .eq("recovery_state", row.recovery_state ?? "queued")
      .gte("recovery_attempts", maxAttempts);

    claimQuery =
      row.recovery_attempts === null
        ? claimQuery.is("recovery_attempts", null)
        : claimQuery.eq("recovery_attempts", row.recovery_attempts);

    const { data: claimedRows, error: claimError } = await claimQuery.select("id, request_id");
    if (claimError) continue;
    const claimedRow =
      Array.isArray(claimedRows) &&
      claimedRows.length === 1 &&
      claimedRows[0] &&
      typeof claimedRows[0] === "object"
        ? (claimedRows[0] as JsonObject)
        : null;
    if (!claimedRow) continue;

    claimed.push({
      ...row,
      request_id: asString(claimedRow.request_id) ?? row.request_id,
      recovery_state: "recovering",
    });
  }

  return claimed;
};

export const claimGenerationRecoveryBatch = async ({
  supabaseAdmin,
  batchSize,
  maxAttempts,
  minAgeSeconds,
  leaseSeconds,
}: {
  supabaseAdmin?: SupabaseAdminClient;
  batchSize: number;
  maxAttempts: number;
  minAgeSeconds: number;
  leaseSeconds: number;
}): Promise<RecoveryBatchAcquisitionResult> => {
  const client = supabaseAdmin ?? getSupabaseAdmin();
  const claimResponse = await client.rpc("claim_generation_recovery_batch", {
    p_limit: batchSize,
    p_max_attempts: maxAttempts,
    p_min_age_seconds: minAgeSeconds,
    p_lease_seconds: leaseSeconds,
  });

  const claimImmediateRows = async (claimedRows: ClaimedGeneration[]) => {
    const remaining = Math.max(0, batchSize - claimedRows.length);
    if (remaining === 0) return claimedRows;
    const attemptBudgetRows = await claimAttemptBudgetRows({
      supabaseAdmin: client,
      batchSize: remaining,
      maxAttempts,
      minAgeSeconds,
      leaseSeconds,
    });
    const remainingAfterBudgetRows = Math.max(0, remaining - attemptBudgetRows.length);
    const rowsWithBudgetClaims = [...claimedRows, ...attemptBudgetRows];
    if (remainingAfterBudgetRows === 0) return rowsWithBudgetClaims;
    const immediateRows = await claimImmediateNoMediaRows({
      supabaseAdmin: client,
      batchSize: remainingAfterBudgetRows,
      maxAttempts,
      leaseSeconds,
    });
    if (!immediateRows.length) return rowsWithBudgetClaims;
    return [...rowsWithBudgetClaims, ...immediateRows];
  };

  if (!claimResponse.error && Array.isArray(claimResponse.data)) {
    const parsedRows = claimResponse.data
      .map((row) => parseClaimedGeneration(row))
      .filter((row): row is ClaimedGeneration => Boolean(row));
    return {
      rows: await claimImmediateRows(parsedRows),
      claimSource: "rpc",
      rpcError: null,
    };
  }

  const fallbackRows = await claimFallback({
    supabaseAdmin: client,
    batchSize,
    maxAttempts,
    minAgeSeconds,
    leaseSeconds,
  });
  return {
    rows: await claimImmediateRows(fallbackRows),
    claimSource: "fallback",
    rpcError: claimResponse.error,
  };
};
