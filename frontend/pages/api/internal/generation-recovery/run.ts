import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../../lib/server/api/falRuntimeFlags";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { executeGenerationRecovery } from "../../../../lib/server/falIntegration/recoveryExecution";

type JsonObject = Record<string, unknown>;

type ClaimedGeneration = {
  id: string;
  user_id: string;
  request_id: string | null;
  model_id: string;
  status: string;
  recovery_state: string | null;
  recovery_attempts: number | null;
};

type ReservationCleanupMetrics = {
  scanned: number;
  released: number;
  errors: number;
};

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

const parseCleanupMetrics = (value: unknown): ReservationCleanupMetrics => {
  const row =
    Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === "object"
      ? (value[0] as JsonObject)
      : value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
  if (!row) {
    return { scanned: 0, released: 0, errors: 0 };
  }

  const scanned = asNumber(row.scanned_count) ?? asNumber(row.scanned) ?? 0;
  const released = asNumber(row.released_count) ?? asNumber(row.released) ?? 0;
  const errors = asNumber(row.error_count) ?? asNumber(row.errors) ?? 0;
  return {
    scanned: Math.max(0, Math.trunc(scanned)),
    released: Math.max(0, Math.trunc(released)),
    errors: Math.max(0, Math.trunc(errors)),
  };
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
    model_id: modelId,
    status,
    recovery_state: asString(row.recovery_state),
    recovery_attempts: asNumber(row.recovery_attempts),
  };
};

const secureCompare = (left: string, right: string): boolean => {
  try {
    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  } catch {
    return false;
  }
};

const readHeader = (req: NextApiRequest, name: string): string | null => {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
};

const isAllowedModel = (modelId: string, allowlist: Set<string>): boolean => {
  if (!allowlist.size) return true;
  for (const item of allowlist) {
    if (item === "*") return true;
    if (item.endsWith("*") && modelId.startsWith(item.slice(0, -1))) return true;
    if (item === modelId) return true;
  }
  return false;
};

const claimFallback = async ({
  batchSize,
  maxAttempts,
  minAgeSeconds,
  leaseSeconds,
}: {
  batchSize: number;
  maxAttempts: number;
  minAgeSeconds: number;
  leaseSeconds: number;
}): Promise<ClaimedGeneration[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const oldestCreatedAtIso = new Date(Date.now() - minAgeSeconds * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const leaseUntilIso = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, user_id, request_id, model_id, status, recovery_state, recovery_attempts")
    .eq("provider", "fal")
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
    const nextAttempts = (row.recovery_attempts ?? 0) + 1;
    const { error: updateError } = await supabaseAdmin
      .from("ai_generations")
      .update({
        recovery_state: "recovering",
        recovery_attempts: nextAttempts,
        last_recovery_at: nowIso,
        next_recovery_at: leaseUntilIso,
      })
      .eq("id", row.id)
      .eq("user_id", row.user_id);
    if (!updateError) {
      claimed.push({ ...row, recovery_attempts: nextAttempts, recovery_state: "recovering" });
    }
  }

  return claimed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = readFalRuntimeFlags();
  if (!flags.reconcilerEnabled || flags.integrationMode === "legacy") {
    return res.status(404).json({ error: "Not found" });
  }

  const providedSecret = readHeader(req, "x-shortpulse-cron-secret");
  const expectedSecret = flags.reconcilerCronSecret;
  if (!providedSecret || !expectedSecret || !secureCompare(providedSecret, expectedSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    let reservationCleanupScanned = 0;
    let reservationCleanupReleased = 0;
    let reservationCleanupErrors = 0;
    if (flags.reservationCleanupEnabled) {
      const cleanupResponse = await supabaseAdmin.rpc("release_stale_generation_reservations", {
        p_limit: flags.reservationCleanupBatchSize,
        p_min_age_seconds: flags.reservationCleanupMinAgeSeconds,
      });
      if (cleanupResponse.error) {
        reservationCleanupErrors = 1;
        await logApiRouteException({
          req,
          error: cleanupResponse.error,
          routeLabel: "internal/generation-recovery/run",
          metadata: {
            stage: "reservation_cleanup",
          },
        });
      } else {
        const metrics = parseCleanupMetrics(cleanupResponse.data);
        reservationCleanupScanned = metrics.scanned;
        reservationCleanupReleased = metrics.released;
        reservationCleanupErrors = metrics.errors;
      }
    }

    const claimResponse = await supabaseAdmin.rpc("claim_generation_recovery_batch", {
      p_limit: flags.reconcilerBatchSize,
      p_max_attempts: flags.reconcilerMaxAttempts,
      p_min_age_seconds: flags.reconcilerMinAgeSeconds,
      p_lease_seconds: flags.reconcilerLeaseSeconds,
    });
    let claimedRows: ClaimedGeneration[] = [];
    if (!claimResponse.error && Array.isArray(claimResponse.data)) {
      claimedRows = claimResponse.data
        .map((row) => parseClaimedGeneration(row))
        .filter((row): row is ClaimedGeneration => Boolean(row));
    } else {
      claimedRows = await claimFallback({
        batchSize: flags.reconcilerBatchSize,
        maxAttempts: flags.reconcilerMaxAttempts,
        minAgeSeconds: flags.reconcilerMinAgeSeconds,
        leaseSeconds: flags.reconcilerLeaseSeconds,
      });
    }

    let recovered = 0;
    let requeued = 0;
    let exhausted = 0;
    let skipped = 0;
    let duplicates = 0;
    let processed = 0;
    let errors = 0;

    for (const row of claimedRows) {
      if (!isAllowedModel(row.model_id, flags.modelAllowlist)) {
        skipped += 1;
        continue;
      }
      try {
        const result = await executeGenerationRecovery({
          actor: "reconciler",
          generationId: row.id,
          requestId: row.request_id,
          maxAttempts: flags.reconcilerMaxAttempts,
          routeLabel: "internal/generation-recovery/run",
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
      } catch {
        errors += 1;
        const retryAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from("ai_generations")
          .update({
            recovery_state: "queued",
            next_recovery_at: retryAt,
          })
          .eq("id", row.id)
          .eq("user_id", row.user_id);
      }
    }

    return res.status(200).json({
      ok: true,
      claimed: claimedRows.length,
      processed,
      recovered,
      requeued,
      exhausted,
      duplicates,
      errors,
      skipped,
      reservationCleanupScanned,
      reservationCleanupReleased,
      reservationCleanupErrors,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "internal/generation-recovery/run",
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Recovery run failed",
    });
  }
}
