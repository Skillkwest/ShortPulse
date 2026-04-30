/**
 * Project generation association helpers.
 * Owns project-scoped association and snapshot-delivery refresh for generated outputs
 * without changing the global generation inventory/read models.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";

const PROJECT_GENERATION_PROJECTION_SELECT_COLUMNS = [
  "generation_id",
  "project_id",
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
  "updated_at",
  "hidden_in_reference_grid",
  "reference_grid_visible",
].join(", ");

const PROJECT_SNAPSHOT_GENERATED_OUTPUT_APPEND_LIMIT = 100;

type SnapshotRecord = Record<string, unknown>;

type ProjectGenerationProjectionRow = {
  generation_id?: unknown;
  project_id?: unknown;
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
  updated_at?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
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

const asBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

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

  const associatedGenerationIds = new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => asTrimmedString(asRecord(row).generation_id))
      .filter((generationId): generationId is string => Boolean(generationId))
  );
  const { data: projectionData, error: projectionError } = await supabaseAdmin
    .from("generation_projection")
    .select("generation_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .in("generation_id", generationIds);

  if (projectionError) {
    throw new Error(projectionError.message || "Failed to resolve project-scoped projections");
  }

  (Array.isArray(projectionData) ? projectionData : [])
    .map((row) => asTrimmedString(asRecord(row).generation_id))
    .filter((generationId): generationId is string => Boolean(generationId))
    .forEach((generationId) => associatedGenerationIds.add(generationId));

  return associatedGenerationIds;
};

const readRecentProjectAssociatedGenerationIds = async ({
  userId,
  projectId,
  limit = PROJECT_SNAPSHOT_GENERATED_OUTPUT_APPEND_LIMIT,
}: {
  userId: string;
  projectId: string;
  limit?: number;
}): Promise<string[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const boundedLimit = Math.max(1, Math.min(limit, PROJECT_SNAPSHOT_GENERATED_OUTPUT_APPEND_LIMIT));
  const { data, error } = await supabaseAdmin
    .from("project_generation_items")
    .select("generation_id, updated_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(error.message || "Failed to load project-associated generation ids");
  }

  const { data: projectionData, error: projectionError } = await supabaseAdmin
    .from("generation_projection")
    .select("generation_id, updated_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);

  if (projectionError) {
    throw new Error(projectionError.message || "Failed to load project-scoped projection ids");
  }

  const generationIdsByUpdatedAt = new Map<string, string | null>();
  (Array.isArray(data) ? data : [])
    .map((row) => {
      const record = asRecord(row);
      return {
        generationId: asTrimmedString(record.generation_id),
        updatedAt: asTrimmedString(record.updated_at),
      };
    })
    .forEach(({ generationId, updatedAt }) => {
      if (!generationId) return;
      generationIdsByUpdatedAt.set(generationId, updatedAt);
    });

  (Array.isArray(projectionData) ? projectionData : [])
    .map((row) => {
      const record = asRecord(row);
      return {
        generationId: asTrimmedString(record.generation_id),
        updatedAt: asTrimmedString(record.updated_at),
      };
    })
    .forEach(({ generationId, updatedAt }) => {
      if (!generationId) return;
      generationIdsByUpdatedAt.set(
        generationId,
        updatedAt ?? generationIdsByUpdatedAt.get(generationId) ?? null
      );
    });

  return [...generationIdsByUpdatedAt.entries()]
    .sort(([, aUpdatedAt], [, bUpdatedAt]) => {
      const aMs = Date.parse(aUpdatedAt ?? "");
      const bMs = Date.parse(bUpdatedAt ?? "");
      return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
    })
    .slice(0, boundedLimit)
    .map(([generationId]) => generationId);
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

const resolveSnapshotOutputMode = (projection: ProjectGenerationProjectionRow): string => {
  const modelId = asTrimmedString(projection.model_id)?.toLowerCase() ?? "";
  const provider = asTrimmedString(projection.provider)?.toLowerCase() ?? "";
  if (provider.includes("eleven") || modelId.includes("eleven")) return "audio";
  if (
    modelId.includes("video") ||
    modelId.includes("kling") ||
    modelId.includes("veo") ||
    modelId.includes("seedance")
  ) {
    return "video";
  }
  return "image";
};

const shouldAppendProjectionToSnapshot = (projection: ProjectGenerationProjectionRow): boolean => {
  if (asBoolean(projection.hidden_in_reference_grid) === true) return false;
  if (asBoolean(projection.reference_grid_visible) === false) return false;
  return Boolean(asTrimmedString(projection.generation_id));
};

const createSnapshotOutputRowFromProjection = (
  projection: ProjectGenerationProjectionRow
): SnapshotRecord | null => {
  const generationId = asTrimmedString(projection.generation_id);
  if (!generationId || !shouldAppendProjectionToSnapshot(projection)) return null;
  const mode = resolveSnapshotOutputMode(projection);
  const requestId = asTrimmedString(projection.request_id);
  const modelId = asTrimmedString(projection.model_id);

  return patchSnapshotOutputRow({
    row: {
      id: `generated:${generationId}`,
      mode,
      model: modelId ?? "Generated media",
      modelId: modelId ?? undefined,
      prompt: asTrimmedString(projection.display_prompt) ?? "",
      status: "ready",
      timestamp: "Just now",
      generationId,
      taskId: requestId ?? undefined,
      generationTraceId: requestId ?? undefined,
      sourceRef: asTrimmedString(projection.source_ref) ?? undefined,
      provider: asTrimmedString(projection.provider) ?? undefined,
      mediaSource: "generated",
      previewTier: mode === "video" ? "preview_loop" : "full",
      archivedAt: null,
      archiveReason: null,
      saveState: "idle",
      saveError: null,
      hiddenInReferenceGrid: asBoolean(projection.hidden_in_reference_grid) ?? false,
    },
    projection,
  });
};

const areSnapshotRowsSameOrder = (left: SnapshotRecord[], right: SnapshotRecord[]): boolean =>
  left.length === right.length && left.every((row, index) => row === right[index]);

const projectionUpdatedAtMs = (
  projection: ProjectGenerationProjectionRow | undefined
): number | null => {
  const updatedAt = asTrimmedString(projection?.updated_at);
  const updatedAtMs = Date.parse(updatedAt ?? "");
  return Number.isFinite(updatedAtMs) ? updatedAtMs : null;
};

const orderActiveSnapshotRowsByProjectGenerationRecency = ({
  rows,
  recentAssociatedGenerationIds,
  projectionByGenerationId,
}: {
  rows: SnapshotRecord[];
  recentAssociatedGenerationIds: string[];
  projectionByGenerationId: Map<string, ProjectGenerationProjectionRow>;
}): SnapshotRecord[] => {
  if (rows.length <= 1) return rows;
  const generationRankById = new Map(
    recentAssociatedGenerationIds.map((generationId, index) => [generationId, index])
  );
  const rankedRows: Array<{
    row: SnapshotRecord;
    index: number;
    rank: number | null;
    updatedAtMs: number | null;
  }> = [];
  const unrankedRows: SnapshotRecord[] = [];

  rows.forEach((row, index) => {
    const generationId = asTrimmedString(row.generationId);
    if (!generationId) {
      unrankedRows.push(row);
      return;
    }
    const rank = generationRankById.get(generationId) ?? null;
    const updatedAtMs = projectionUpdatedAtMs(projectionByGenerationId.get(generationId));
    if (updatedAtMs !== null || rank !== null) {
      rankedRows.push({ row, index, rank, updatedAtMs });
      return;
    }
    unrankedRows.push(row);
  });

  if (rankedRows.length <= 1) return rows;
  return [
    ...rankedRows
      .sort((left, right) => {
        const leftUpdatedAtMs = left.updatedAtMs ?? Number.NEGATIVE_INFINITY;
        const rightUpdatedAtMs = right.updatedAtMs ?? Number.NEGATIVE_INFINITY;
        return (
          rightUpdatedAtMs - leftUpdatedAtMs ||
          (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
          left.index - right.index
        );
      })
      .map(({ row }) => row),
    ...unrankedRows,
  ];
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
  const [associatedSnapshotGenerationIds, recentAssociatedGenerationIds] = await Promise.all([
    snapshotGenerationIds.length > 0
      ? readProjectAssociatedGenerationIds({
          userId,
          projectId,
          generationIds: snapshotGenerationIds,
        })
      : Promise.resolve(new Set<string>()),
    readRecentProjectAssociatedGenerationIds({
      userId,
      projectId,
    }),
  ]);

  let changed = false;
  const projectionGenerationIds = [
    ...new Set([...associatedSnapshotGenerationIds, ...recentAssociatedGenerationIds]),
  ];
  const projectionByGenerationId =
    projectionGenerationIds.length > 0
      ? await buildProjectionByGenerationId({
          userId,
          generationIds: projectionGenerationIds,
        })
      : new Map<string, ProjectGenerationProjectionRow>();
  const patchRows = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
        const generationId = asTrimmedString(normalizedRow.generationId);
        if (generationId && !associatedSnapshotGenerationIds.has(generationId)) {
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

  const activeRows = patchRows(outputsRecord.active);
  const archivedRows = patchRows(outputsRecord.archived);
  const existingGenerationIds = new Set(
    [
      ...(Array.isArray(activeRows) ? activeRows : []),
      ...(Array.isArray(archivedRows) ? archivedRows : []),
    ]
      .map((row) => asTrimmedString(asRecord(row).generationId))
      .filter((generationId): generationId is string => Boolean(generationId))
  );
  const appendedActiveRows = recentAssociatedGenerationIds
    .filter((generationId) => !existingGenerationIds.has(generationId))
    .map((generationId) => {
      const projection = projectionByGenerationId.get(generationId);
      return projection ? createSnapshotOutputRowFromProjection(projection) : null;
    })
    .filter((row): row is SnapshotRecord => Boolean(row));

  if (appendedActiveRows.length > 0) {
    changed = true;
  }
  const unorderedActiveRows = [
    ...appendedActiveRows,
    ...(Array.isArray(activeRows) ? activeRows : []),
  ];
  const orderedActiveRows = orderActiveSnapshotRowsByProjectGenerationRecency({
    rows: unorderedActiveRows,
    recentAssociatedGenerationIds,
    projectionByGenerationId,
  });
  if (!areSnapshotRowsSameOrder(unorderedActiveRows, orderedActiveRows)) {
    changed = true;
  }

  const nextOutputs = {
    ...outputsRecord,
    active: orderedActiveRows,
    archived: Array.isArray(archivedRows) ? archivedRows : [],
  };

  return changed
    ? {
        ...snapshot,
        outputs: nextOutputs,
      }
    : snapshot;
};
