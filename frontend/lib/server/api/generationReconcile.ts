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
import { getProjectForUser } from "../projectsService";

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
const PROJECT_GENERATION_RECONCILE_SELECT_COLUMNS = [
  "generation_id",
  "request_id",
  "source_ref",
  "task_state",
  "hidden_in_reference_grid",
  "reference_grid_visible",
  "started_at",
  "created_at",
  "updated_at",
].join(", ");
const AI_GENERATION_PROJECT_RECONCILE_SELECT_COLUMNS = [
  "id",
  "request_id",
  "metadata",
  "status",
  "recovery_state",
  "failure_reason_code",
  "created_at",
  "updated_at",
  "last_recovery_at",
  "next_recovery_at",
  "completed_at",
].join(", ");

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

export const normalizeGenerationReconcileProjectId = (value: unknown): string | null =>
  normalizeString(value);

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

type VisibleProjectGenerationIdentity = GenerationReconcileIdentity & {
  recencyMs: number | null;
};

const parseIsoTimestampMs = (value: unknown): number | null => {
  const timestamp = normalizeString(value);
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseProjectProjectionGenerationIdentity = (
  value: unknown,
  recencyMsOverride: number | null = null
): VisibleProjectGenerationIdentity | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const taskState = normalizeString(row.task_state)?.toLowerCase();
  if (taskState !== "pending" && taskState !== "running") return null;
  const generationId = normalizeString(row.generation_id);
  const requestId = normalizeString(row.request_id);
  const sourceRef = normalizeString(row.source_ref);
  if (!generationId && !requestId && !sourceRef) return null;
  const recencyMs =
    recencyMsOverride ??
    parseIsoTimestampMs(row.started_at) ??
    parseIsoTimestampMs(row.created_at) ??
    parseIsoTimestampMs(row.updated_at);
  return {
    generationId,
    requestId,
    sourceRef,
    recencyMs,
  };
};

const isRecoverableProjectGenerationRow = (row: Record<string, unknown>): boolean => {
  const status = normalizeString(row.status)?.toLowerCase();
  const recoveryState = normalizeString(row.recovery_state)?.toLowerCase();
  const failureReasonCode = normalizeString(row.failure_reason_code)?.toLowerCase();
  if (status === "pending" || status === "submitted" || status === "running") return true;
  if (recoveryState === "queued" || recoveryState === "recovering") return true;
  if (failureReasonCode === "terminal_success_no_media") return true;
  if (failureReasonCode === "user_abandoned") return Boolean(normalizeString(row.request_id));
  return false;
};

const parseProjectAiGenerationIdentity = (
  value: unknown,
  recencyMsOverride: number | null = null
): VisibleProjectGenerationIdentity | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isRecoverableProjectGenerationRow(row)) return null;
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const generationId = normalizeString(row.id);
  const requestId = normalizeString(row.request_id);
  const sourceRef = normalizeString(metadata.source_ref);
  if (!generationId && !requestId && !sourceRef) return null;
  const recencyMs =
    recencyMsOverride ??
    parseIsoTimestampMs(row.last_recovery_at) ??
    parseIsoTimestampMs(row.next_recovery_at) ??
    parseIsoTimestampMs(row.updated_at) ??
    parseIsoTimestampMs(row.completed_at) ??
    parseIsoTimestampMs(row.created_at);
  return {
    generationId,
    requestId,
    sourceRef,
    recencyMs,
  };
};

const toProjectIdentityDedupeKey = (identity: GenerationReconcileIdentity): string => {
  const generationId = normalizeString(identity.generationId);
  if (generationId) return `generation:${generationId}`;
  const requestId = normalizeString(identity.requestId);
  if (requestId) return `request:${requestId}`;
  const sourceRef = normalizeString(identity.sourceRef);
  return sourceRef ? `source:${sourceRef}` : "";
};

const listVisibleProjectGenerationIdentitiesForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<GenerationReconcileIdentity[]> => {
  const project = await getProjectForUser({ userId, projectId });
  if (!project) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const associationResponse = await supabaseAdmin
    .from("project_generation_items")
    .select("generation_id, updated_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(MAX_RECONCILE_IDENTITIES);

  const associatedGenerationRecencyById = new Map<string, number | null>();
  const associatedGenerationIds = (
    !associationResponse.error && Array.isArray(associationResponse.data)
      ? associationResponse.data
      : []
  )
    .map((row) => {
      const record = row && typeof row === "object" && !Array.isArray(row) ? row : null;
      const generationId = normalizeString(
        (record as Record<string, unknown> | null)?.generation_id
      );
      if (generationId) {
        associatedGenerationRecencyById.set(
          generationId,
          parseIsoTimestampMs((record as Record<string, unknown>).updated_at)
        );
      }
      return generationId;
    })
    .filter((value): value is string => Boolean(value));

  const directProjectQuery = supabaseAdmin
    .from("generation_projection")
    .select(PROJECT_GENERATION_RECONCILE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(MAX_RECONCILE_IDENTITIES);

  const associatedProjectionQuery = associatedGenerationIds.length
    ? supabaseAdmin
        .from("generation_projection")
        .select(PROJECT_GENERATION_RECONCILE_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("generation_id", associatedGenerationIds)
        .order("updated_at", { ascending: false })
        .limit(MAX_RECONCILE_IDENTITIES)
    : Promise.resolve({ data: [], error: null });

  const associatedGenerationRowsQuery = associatedGenerationIds.length
    ? supabaseAdmin
        .from("ai_generations")
        .select(AI_GENERATION_PROJECT_RECONCILE_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("id", associatedGenerationIds)
        .order("updated_at", { ascending: false })
        .limit(MAX_RECONCILE_IDENTITIES)
    : Promise.resolve({ data: [], error: null });

  const metadataProjectGenerationRowsQuery = supabaseAdmin
    .from("ai_generations")
    .select(AI_GENERATION_PROJECT_RECONCILE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .filter("metadata->shortpulse_context->>project_id", "eq", projectId)
    .order("updated_at", { ascending: false })
    .limit(MAX_RECONCILE_IDENTITIES);

  const camelMetadataProjectGenerationRowsQuery = supabaseAdmin
    .from("ai_generations")
    .select(AI_GENERATION_PROJECT_RECONCILE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .filter("metadata->shortpulseContext->>projectId", "eq", projectId)
    .order("updated_at", { ascending: false })
    .limit(MAX_RECONCILE_IDENTITIES);

  const [
    directProjectResponse,
    associatedProjectionResponse,
    associatedGenerationRowsResponse,
    metadataProjectGenerationRowsResponse,
    camelMetadataProjectGenerationRowsResponse,
  ] = await Promise.all([
    directProjectQuery,
    associatedProjectionQuery,
    associatedGenerationRowsQuery,
    metadataProjectGenerationRowsQuery,
    camelMetadataProjectGenerationRowsQuery,
  ]);
  if (directProjectResponse.error && associatedProjectionResponse.error) {
    throw directProjectResponse.error;
  }

  const identityByKey = new Map<string, VisibleProjectGenerationIdentity>();
  const appendIdentity = (identity: VisibleProjectGenerationIdentity | null) => {
    if (!identity) return;
    const key = toProjectIdentityDedupeKey(identity);
    if (!key.trim()) return;
    const current = identityByKey.get(key);
    if (!current || (identity.recencyMs ?? 0) > (current.recencyMs ?? 0)) {
      identityByKey.set(key, identity);
    }
  };

  const directProjectGenerationRecencyById = new Map<string, number | null>();
  const directProjectRows: unknown[] =
    !directProjectResponse.error && Array.isArray(directProjectResponse.data)
      ? directProjectResponse.data
      : [];
  directProjectRows.forEach((row) => {
    const record =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : null;
    if (!record) return;
    const generationId = normalizeString(record.generation_id);
    if (generationId) {
      directProjectGenerationRecencyById.set(
        generationId,
        parseIsoTimestampMs(record.started_at) ??
          parseIsoTimestampMs(record.created_at) ??
          parseIsoTimestampMs(record.updated_at)
      );
    }
    appendIdentity(parseProjectProjectionGenerationIdentity(row));
  });

  const directProjectGenerationIds = [...directProjectGenerationRecencyById.keys()];
  const directProjectGenerationRowsResponse = directProjectGenerationIds.length
    ? await supabaseAdmin
        .from("ai_generations")
        .select(AI_GENERATION_PROJECT_RECONCILE_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("id", directProjectGenerationIds)
        .order("updated_at", { ascending: false })
        .limit(MAX_RECONCILE_IDENTITIES)
    : { data: [], error: null };

  (!associatedProjectionResponse.error && Array.isArray(associatedProjectionResponse.data)
    ? associatedProjectionResponse.data
    : []
  ).forEach((row) => {
    const record = row && typeof row === "object" && !Array.isArray(row) ? row : null;
    const generationId = normalizeString((record as Record<string, unknown> | null)?.generation_id);
    appendIdentity(
      parseProjectProjectionGenerationIdentity(
        row,
        generationId ? (associatedGenerationRecencyById.get(generationId) ?? null) : null
      )
    );
  });
  (!associatedGenerationRowsResponse.error && Array.isArray(associatedGenerationRowsResponse.data)
    ? associatedGenerationRowsResponse.data
    : []
  ).forEach((row) => {
    const record = row && typeof row === "object" && !Array.isArray(row) ? row : null;
    const generationId = normalizeString((record as Record<string, unknown> | null)?.id);
    appendIdentity(
      parseProjectAiGenerationIdentity(
        row,
        generationId ? (associatedGenerationRecencyById.get(generationId) ?? null) : null
      )
    );
  });
  (!directProjectGenerationRowsResponse.error &&
  Array.isArray(directProjectGenerationRowsResponse.data)
    ? directProjectGenerationRowsResponse.data
    : []
  ).forEach((row) => {
    const record = row && typeof row === "object" && !Array.isArray(row) ? row : null;
    const generationId = normalizeString((record as Record<string, unknown> | null)?.id);
    appendIdentity(
      parseProjectAiGenerationIdentity(
        row,
        generationId ? (directProjectGenerationRecencyById.get(generationId) ?? null) : null
      )
    );
  });
  (!metadataProjectGenerationRowsResponse.error &&
  Array.isArray(metadataProjectGenerationRowsResponse.data)
    ? metadataProjectGenerationRowsResponse.data
    : []
  ).forEach((row) => {
    appendIdentity(parseProjectAiGenerationIdentity(row));
  });
  (!camelMetadataProjectGenerationRowsResponse.error &&
  Array.isArray(camelMetadataProjectGenerationRowsResponse.data)
    ? camelMetadataProjectGenerationRowsResponse.data
    : []
  ).forEach((row) => {
    appendIdentity(parseProjectAiGenerationIdentity(row));
  });

  return [...identityByKey.values()]
    .sort((a, b) => (b.recencyMs ?? 0) - (a.recencyMs ?? 0))
    .slice(0, MAX_RECONCILE_IDENTITIES)
    .map(({ generationId, requestId, sourceRef }) => ({
      generationId: generationId ?? null,
      requestId: requestId ?? null,
      sourceRef: sourceRef ?? null,
    }));
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

export const reconcileVisibleProjectGenerationsForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<GenerationReconcileBatchResult> => {
  const identities = await listVisibleProjectGenerationIdentitiesForUser({
    userId,
    projectId,
  });
  return reconcileVisibleGenerationsForUser({
    userId,
    identities,
  });
};
