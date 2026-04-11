import { getSupabaseAdmin } from "./supabaseAdmin";

export type RecoveryClaimCandidate = {
  id: string;
  userId: string;
  requestId: string | null;
  provider: string | null;
  status: string;
  recoveryState: string | null;
  recoveryAttempts: number | null;
};

export type RecoveryClaimResult =
  | {
      claimed: true;
      requestId: string | null;
      reason: "claimed";
      errorMessage: null;
    }
  | {
      claimed: false;
      requestId: string | null;
      reason: "claim_conflict" | "db_error" | "provider_not_supported";
      errorMessage: string | null;
    };

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const SUPPORTED_PROVIDER_PREFIXES = ["fal", "kie"] as const;

export const resolveSupportedRecoveryProviderFamily = (
  provider: string | null
): "fal" | "kie" | null => {
  if (!provider) return null;
  const normalized = provider.trim().toLowerCase();
  if (!normalized.length) return null;
  if (SUPPORTED_PROVIDER_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return normalized.startsWith("kie") ? "kie" : "fal";
  }
  return null;
};

export const tryClaimRecoveryCandidate = async ({
  candidate,
  maxAttempts,
  oldestAllowedIso,
  nowIso,
  leaseUntilIso,
  bypassMinAge = false,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  candidate: RecoveryClaimCandidate;
  maxAttempts: number;
  oldestAllowedIso: string;
  nowIso: string;
  leaseUntilIso: string;
  bypassMinAge?: boolean;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<RecoveryClaimResult> => {
  const providerFamily = resolveSupportedRecoveryProviderFamily(candidate.provider);
  if (!providerFamily) {
    return {
      claimed: false,
      requestId: candidate.requestId,
      reason: "provider_not_supported",
      errorMessage: null,
    };
  }

  let claimQuery = supabaseAdmin
    .from("ai_generations")
    .update({
      recovery_state: "recovering",
      recovery_attempts: (candidate.recoveryAttempts ?? 0) + 1,
      last_recovery_at: nowIso,
      next_recovery_at: leaseUntilIso,
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.userId)
    .eq("status", candidate.status)
    .eq("recovery_state", candidate.recoveryState ?? "queued")
    .ilike("provider", `${providerFamily}%`)
    .lt("recovery_attempts", maxAttempts)
    .or(`next_recovery_at.is.null,next_recovery_at.lte.${nowIso}`);

  if (!bypassMinAge) {
    claimQuery = claimQuery.lte("created_at", oldestAllowedIso);
  }

  claimQuery =
    candidate.recoveryAttempts === null
      ? claimQuery.is("recovery_attempts", null)
      : claimQuery.eq("recovery_attempts", candidate.recoveryAttempts);

  const { data, error } = await claimQuery.select("id, request_id");
  if (error) {
    return {
      claimed: false,
      requestId: candidate.requestId,
      reason: "db_error",
      errorMessage: error.message ?? "recovery claim failed",
    };
  }

  const claimedRow =
    Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === "object"
      ? (data[0] as Record<string, unknown>)
      : null;
  if (!claimedRow) {
    return {
      claimed: false,
      requestId: candidate.requestId,
      reason: "claim_conflict",
      errorMessage: null,
    };
  }

  return {
    claimed: true,
    requestId: asString(claimedRow.request_id) ?? candidate.requestId,
    reason: "claimed",
    errorMessage: null,
  };
};
