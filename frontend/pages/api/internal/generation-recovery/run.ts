import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../../lib/server/api/falRuntimeFlags";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

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

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

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
}: {
  batchSize: number;
  maxAttempts: number;
  minAgeSeconds: number;
}): Promise<ClaimedGeneration[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const oldestCreatedAtIso = new Date(Date.now() - minAgeSeconds * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, user_id, request_id, model_id, status, recovery_state, recovery_attempts")
    .eq("provider", "fal")
    .in("recovery_state", ["queued", "recovering"])
    .lte("created_at", oldestCreatedAtIso)
    .lt("recovery_attempts", maxAttempts)
    .order("next_recovery_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error || !Array.isArray(data)) return [];

  const claimed: ClaimedGeneration[] = [];
  const nowIso = new Date().toISOString();
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
    const claimResponse = await supabaseAdmin.rpc("claim_generation_recovery_batch", {
      p_limit: flags.reconcilerBatchSize,
      p_max_attempts: flags.reconcilerMaxAttempts,
      p_min_age_seconds: flags.reconcilerMinAgeSeconds,
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
      });
    }

    const now = Date.now();
    let exhausted = 0;
    let requeued = 0;
    let skipped = 0;
    for (const row of claimedRows) {
      if (!isAllowedModel(row.model_id, flags.modelAllowlist)) {
        skipped += 1;
        continue;
      }
      const attempts = row.recovery_attempts ?? 0;
      if (!row.request_id || attempts >= flags.reconcilerMaxAttempts) {
        const { error } = await supabaseAdmin
          .from("ai_generations")
          .update({
            recovery_state: "exhausted",
            failure_reason_code: "recovery_exhausted",
            next_recovery_at: null,
            last_recovery_at: new Date(now).toISOString(),
          })
          .eq("id", row.id)
          .eq("user_id", row.user_id);
        if (!error) exhausted += 1;
        continue;
      }

      const { error } = await supabaseAdmin
        .from("ai_generations")
        .update({
          recovery_state: "queued",
          next_recovery_at: new Date(now + 2 * 60 * 1000).toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", row.user_id);
      if (!error) requeued += 1;
    }

    return res.status(200).json({
      ok: true,
      claimed: claimedRows.length,
      requeued,
      exhausted,
      skipped,
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
