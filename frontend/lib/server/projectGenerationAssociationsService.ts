/**
 * Project generation association helpers.
 * Owns project-scoped association and snapshot-delivery refresh for generated outputs
 * without changing the global generation inventory/read models.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";

const PROJECT_GENERATION_PROJECTION_SELECT_COLUMNS = [
  "generation_id",
  "request_id",
  "source_ref",
  "provider",
  "model_id",
  "display_prompt",
  "preview_url",
  "result_urls",
  "preview_storage_path",
  "full_storage_path",
  "task_state",
  "queue_state",
  "error_message",
  "error_message_short",
  "error_detail",
  "generation_replay",
  "character_context",
  "style_context",
].join(", ");

type SnapshotRecord = Record<string, unknown>;

type ProjectGenerationProjectionRow = {
  generation_id?: unknown;
  request_id?: unknown;
  source_ref?: unknown;
  provider?: unknown;
  model_id?: unknown;
  display_prompt?: unknown;
  preview_url?: unknown;
  result_urls?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  task_state?: unknown;
  queue_state?: unknown;
  error_message?: unknown;
  error_message_short?: unknown;
  error_detail?: unknown;
  generation_replay?: unknown;
  character_context?: unknown;
  style_context?: unknown;
};

const asRecord = (value: unknown): SnapshotRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as SnapshotRecord) : {};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const asTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const hasSettledSnapshotOutputPayload = (row: SnapshotRecord): boolean => {
  if (
    Array.isArray(row.resultUrls) &&
    row.resultUrls.some((value) => typeof value === "string" && value.trim().length > 0)
  ) {
    return true;
  }
  if (typeof row.previewUrl === "string" && row.previewUrl.trim().length > 0) return true;
  if (typeof row.previewText === "string" && row.previewText.trim().length > 0) return true;
  if (typeof row.previewStoragePath === "string" && row.previewStoragePath.trim().length > 0) {
    return true;
  }
  if (typeof row.fullStoragePath === "string" && row.fullStoragePath.trim().length > 0) {
    return true;
  }
  if (
    Array.isArray(row.savedMediaIds) &&
    row.savedMediaIds.some((value) => typeof value === "string" && value.trim().length > 0)
  ) {
    return true;
  }
  return row.status === "saved";
};

const collectSnapshotGenerationIds = (snapshot: SnapshotRecord): string[] => {
  const outputsRecord = asRecord(snapshot.outputs);
  const rows = [
    ...(Array.isArray(outputsRecord.active) ? outputsRecord.active : []),
    ...(Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []),
  ];
  const generationIds = new Set<string>();

  rows.forEach((row) => {
    const generationId = asTrimmedString(asRecord(row).generationId);
    if (generationId) {
      generationIds.add(generationId);
    }
  });

  return [...generationIds];
};

const resolveOwnedGenerationIds = async ({
  userId,
  generationIds,
}: {
  userId: string;
  generationIds: string[];
}): Promise<string[]> => {
  if (generationIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id")
    .eq("user_id", userId)
    .in("id", generationIds);

  if (error) {
    throw new Error(error.message || "Failed to resolve owned ai_generations ids");
  }

  return Array.isArray(data)
    ? data.map((row) => asTrimmedString(asRecord(row).id)).filter((id): id is string => Boolean(id))
    : [];
};

const readProjectAssociatedGenerationIds = async ({
  userId,
  projectId,
  generationIds,
}: {
  userId: string;
  projectId: string;
  generationIds: string[];
}): Promise<Set<string>> => {
  if (generationIds.length === 0) return new Set<string>();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_generation_items")
    .select("generation_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .in("generation_id", generationIds);

  if (error) {
    throw new Error(error.message || "Failed to resolve project-associated generations");
  }

  return new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => asTrimmedString(asRecord(row).generation_id))
      .filter((generationId): generationId is string => Boolean(generationId))
  );
};

const normalizeProjectionTaskState = (value: unknown): string | null => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  switch (normalized) {
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "success":
    case "completed":
    case "complete":
    case "ready":
      return "success";
    case "fail":
    case "failed":
    case "error":
      return "fail";
    default:
      return null;
  }
};

const normalizeProjectionQueueState = (value: unknown): string | null => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  switch (normalized) {
    case "queued":
      return "queued";
    case "dispatching":
      return "dispatching";
    case "dispatched":
      return "dispatched";
    default:
      return null;
  }
};

const buildProjectionByGenerationId = async ({
  userId,
  generationIds,
}: {
  userId: string;
  generationIds: string[];
}): Promise<Map<string, ProjectGenerationProjectionRow>> => {
  if (generationIds.length === 0) return new Map();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("generation_projection")
    .select(PROJECT_GENERATION_PROJECTION_SELECT_COLUMNS)
    .eq("user_id", userId)
    .in("generation_id", generationIds);

  if (error) {
    throw new Error(error.message || "Failed to load generation projection rows");
  }

  return new Map(
    (Array.isArray(data) ? data : [])
      .map((row) => {
        const generationId = asTrimmedString(asRecord(row).generation_id);
        if (!generationId) return null;
        return [generationId, row as ProjectGenerationProjectionRow] as const;
      })
      .filter((entry): entry is readonly [string, ProjectGenerationProjectionRow] => Boolean(entry))
  );
};

/**
 * Associates one owned generation with one owned project.
 * This is used by direct-complete provider lanes that must eagerly persist
 * project ownership at generation success time rather than waiting for later
 * workspace snapshot backfill.
 */
export const associateGenerationWithProjectForUser = async ({
  userId,
  projectId,
  generationId,
}: {
  userId: string;
  projectId: string;
  generationId: string;
}): Promise<boolean> => {
  const normalizedProjectId = asTrimmedString(projectId);
  const normalizedGenerationId = asTrimmedString(generationId);
  if (!normalizedProjectId || !normalizedGenerationId) return false;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: projectRow, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", normalizedProjectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message || "Failed to verify owned project before association");
  }
  if (!projectRow) return false;

  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin.from("project_generation_items").upsert(
    {
      project_id: normalizedProjectId,
      generation_id: normalizedGenerationId,
      user_id: userId,
      updated_at: nowIso,
    },
    {
      onConflict: "project_id,generation_id",
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to associate generation with project");
  }

  return true;
};

const patchSnapshotOutputRow = ({
  row,
  projection,
}: {
  row: SnapshotRecord;
  projection: ProjectGenerationProjectionRow;
}): SnapshotRecord => {
  const nextResultUrls = asTrimmedStringArray(projection.result_urls);
  const nextPreviewUrl = asTrimmedString(projection.preview_url) ?? nextResultUrls[0] ?? null;
  const nextPreviewStoragePath = asTrimmedString(projection.preview_storage_path);
  const nextFullStoragePath =
    asTrimmedString(projection.full_storage_path) ?? nextPreviewStoragePath ?? null;
  const nextTaskState = normalizeProjectionTaskState(projection.task_state);
  const nextQueueState = normalizeProjectionQueueState(projection.queue_state);
  const nextErrorMessage = asTrimmedString(projection.error_message);
  const nextErrorMessageShort = asTrimmedString(projection.error_message_short);
  const nextErrorDetail = asTrimmedString(projection.error_detail);
  const nextPrompt = asTrimmedString(projection.display_prompt);
  const nextProvider = asTrimmedString(projection.provider);
  const nextModelId = asTrimmedString(projection.model_id);
  const nextSourceRef = asTrimmedString(projection.source_ref);
  const nextTaskId = asTrimmedString(projection.request_id);
  const nextGenerationReplay = asRecord(projection.generation_replay);
  const nextCharacterContext = asRecord(projection.character_context);
  const nextStyleContext = asRecord(projection.style_context);

  return {
    ...row,
    prompt: nextPrompt ?? row.prompt ?? "",
    provider: nextProvider ?? row.provider,
    modelId: nextModelId ?? row.modelId,
    sourceRef: nextSourceRef ?? row.sourceRef,
    taskId: nextTaskId ?? row.taskId,
    taskState: nextTaskState ?? row.taskState,
    queueState: nextQueueState ?? row.queueState,
    errorMessage: nextErrorMessage ?? row.errorMessage ?? null,
    errorMessageShort: nextErrorMessageShort ?? row.errorMessageShort ?? null,
    errorDetail: nextErrorDetail ?? row.errorDetail ?? null,
    resultUrls: nextResultUrls.length > 0 ? nextResultUrls : (row.resultUrls ?? []),
    previewUrl: nextPreviewUrl ?? row.previewUrl ?? null,
    previewStoragePath: nextPreviewStoragePath ?? row.previewStoragePath ?? null,
    fullStoragePath: nextFullStoragePath ?? row.fullStoragePath ?? null,
    generationReplay:
      Object.keys(nextGenerationReplay).length > 0 ? nextGenerationReplay : row.generationReplay,
    characterContext:
      Object.keys(nextCharacterContext).length > 0 ? nextCharacterContext : row.characterContext,
    styleContext: Object.keys(nextStyleContext).length > 0 ? nextStyleContext : row.styleContext,
  };
};

/**
 * Associates the generated outputs referenced by a project workspace snapshot with that project.
 */
export const backfillProjectGenerationAssociationsForSnapshot = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: SnapshotRecord;
}): Promise<void> => {
  const ownedGenerationIds = await resolveOwnedGenerationIds({
    userId,
    generationIds: collectSnapshotGenerationIds(snapshot),
  });
  if (ownedGenerationIds.length === 0) return;

  const supabaseAdmin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin.from("project_generation_items").upsert(
    ownedGenerationIds.map((generationId) => ({
      project_id: projectId,
      generation_id: generationId,
      user_id: userId,
      updated_at: nowIso,
    })),
    {
      onConflict: "project_id,generation_id",
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to associate project generations");
  }
};

/**
 * Refreshes snapshot outputs from project-associated generation projection rows only.
 */
export const hydrateProjectSnapshotGeneratedOutputs = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: SnapshotRecord;
}): Promise<SnapshotRecord> => {
  const outputsRecord = asRecord(snapshot.outputs);
  const snapshotGenerationIds = collectSnapshotGenerationIds(snapshot);
  if (snapshotGenerationIds.length === 0) return snapshot;

  const associatedGenerationIds = await readProjectAssociatedGenerationIds({
    userId,
    projectId,
    generationIds: snapshotGenerationIds,
  });

  let changed = false;
  const projectionByGenerationId =
    associatedGenerationIds.size > 0
      ? await buildProjectionByGenerationId({
          userId,
          generationIds: [...associatedGenerationIds],
        })
      : new Map<string, ProjectGenerationProjectionRow>();
  const patchRows = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
        const generationId = asTrimmedString(normalizedRow.generationId);
        if (generationId && !associatedGenerationIds.has(generationId)) {
          changed = true;
          return null;
        }
        if (!generationId && hasSettledSnapshotOutputPayload(normalizedRow)) {
          changed = true;
          return null;
        }
        if (!generationId) {
          return row;
        }
        const projection = projectionByGenerationId.get(generationId);
        if (!projection) {
          changed = true;
          return {
            ...normalizedRow,
            resultUrls: [],
            previewUrl: null,
            previewStoragePath: null,
            fullStoragePath: null,
          };
        }
        changed = true;
        return patchSnapshotOutputRow({
          row: normalizedRow,
          projection,
        });
      })
      .filter((row): row is SnapshotRecord => Boolean(row));
  };

  const nextOutputs = {
    ...outputsRecord,
    active: patchRows(outputsRecord.active),
    archived: patchRows(outputsRecord.archived),
  };

  return changed
    ? {
        ...snapshot,
        outputs: nextOutputs,
      }
    : snapshot;
};
