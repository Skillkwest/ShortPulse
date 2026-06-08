/**
 * Authenticated generation reconciliation service.
 * Gives reopened AI Studio sessions a bounded way to ask the server-owned
 * recovery engine to re-check visible in-flight generations.
 */
import { readGenerationProjectionLinkBySourceRef } from "./generationProjection";
import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  executeGenerationRecovery,
  type RecoveryExecutionResult,
} from "../falIntegration/recoveryExecution";

type GenerationReconcileIdentity = {
  generationId?: string | null;
  requestId?: string | null;
  sourceRef?: string | null;
};

export type GenerationReconcileResult = {
  generationId: string | null;
  requestId: string | null;
  sourceRef: string | null;
  state: RecoveryExecutionResult["state"];
  ok: boolean;
  mediaFileIds: string[];
  mediaUrls: string[];
  note?: string;
};

export type GenerationReconcileBatchResult = {
  attempted: number;
  results: GenerationReconcileResult[];
};

const MAX_RECONCILE_IDENTITIES = 6;

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeIdentity = (value: unknown): GenerationReconcileIdentity | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const generationId = normalizeString(record.generationId);
  const requestId = normalizeString(record.requestId);
  const sourceRef = normalizeString(record.sourceRef);
  if (!generationId && !requestId && !sourceRef) return null;
  return {
    generationId,
    requestId,
    sourceRef,
  };
};

export const normalizeGenerationReconcileIdentities = (
  value: unknown
): GenerationReconcileIdentity[] => {
  const rawIdentities = Array.isArray(value) ? value : [];
  const dedupeKeys = new Set<string>();
  const identities: GenerationReconcileIdentity[] = [];

  for (const rawIdentity of rawIdentities) {
    const identity = normalizeIdentity(rawIdentity);
    if (!identity) continue;
    const key = [identity.generationId ?? "", identity.requestId ?? "", identity.sourceRef ?? ""]
      .join(":")
      .trim();
    if (!key || dedupeKeys.has(key)) continue;
    dedupeKeys.add(key);
    identities.push(identity);
    if (identities.length >= MAX_RECONCILE_IDENTITIES) break;
  }

  return identities;
};

const resolveGenerationIdBySourceRef = async ({
  userId,
  sourceRef,
}: {
  userId: string;
  sourceRef: string | null;
}): Promise<string | null> => {
  const normalizedSourceRef = normalizeString(sourceRef);
  if (!normalizedSourceRef) return null;

  const projectionLink = await readGenerationProjectionLinkBySourceRef({
    userId,
    sourceRef: normalizedSourceRef,
  }).catch(() => null);
  if (projectionLink?.generationId) return projectionLink.generationId;

  const { data, error } = await getSupabaseAdmin()
    .from("ai_generations")
    .select("id, created_at")
    .eq("user_id", userId)
    .filter("metadata->>source_ref", "eq", normalizedSourceRef)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !Array.isArray(data) || !data.length) return null;
  const row = data[0];
  return row && typeof row === "object" && !Array.isArray(row)
    ? normalizeString((row as Record<string, unknown>).id)
    : null;
};

const reconcileOneGeneration = async ({
  identity,
  userId,
}: {
  identity: GenerationReconcileIdentity;
  userId: string;
}): Promise<GenerationReconcileResult> => {
  const generationId =
    normalizeString(identity.generationId) ??
    (await resolveGenerationIdBySourceRef({
      userId,
      sourceRef: identity.sourceRef ?? null,
    }));
  const requestId = normalizeString(identity.requestId);

  const result = await executeGenerationRecovery({
    actor: "user_reconcile",
    generationId,
    requestId,
    userId,
    routeLabel: "generation.reconcile",
  });

  return {
    generationId: result.generationId,
    requestId: result.requestId,
    sourceRef: normalizeString(identity.sourceRef),
    state: result.state,
    ok: result.ok,
    mediaFileIds: result.mediaFileIds,
    mediaUrls: result.mediaUrls,
    note: result.note,
  };
};

export const reconcileVisibleGenerationsForUser = async ({
  userId,
  identities,
}: {
  userId: string;
  identities: GenerationReconcileIdentity[];
}): Promise<GenerationReconcileBatchResult> => {
  const boundedIdentities = identities.slice(0, MAX_RECONCILE_IDENTITIES);
  const results: GenerationReconcileResult[] = [];

  for (const identity of boundedIdentities) {
    results.push(await reconcileOneGeneration({ identity, userId }));
  }

  return {
    attempted: boundedIdentities.length,
    results,
  };
};
