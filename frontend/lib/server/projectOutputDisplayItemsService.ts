/**
 * Project output display item persistence.
 * Owns the project-scoped read model that keeps rich output display data out of
 * large workspace checkpoints while preserving compatibility snapshots on read.
 * Size note: this file intentionally keeps the first-cut checkpoint/display split
 * in one module; split SQL-row mapping from snapshot materialization after the
 * large-project rollout is stable.
 */
export {
  areProjectWorkspaceCheckpointsStructurallyEqual,
  computeProjectOutputDisplayChecksumForSnapshot,
  createLightweightProjectWorkspaceCheckpointSnapshot,
  projectWorkspaceCheckpointNeedsCompaction,
} from "../ai-studio-session/projectWorkspaceCheckpoint";
import {
  createProjectOutputDisplayComparisonValuesForOutput,
  getProjectWorkspaceSnapshotActiveOutputs,
  getProjectWorkspaceSnapshotArchivedOutputs,
  getProjectWorkspaceSnapshotOutputRows,
  type ProjectOutputDisplayComparisonValues,
} from "../ai-studio-session/projectWorkspaceCheckpoint";
import { stripHiddenVideoShotModePromptPrefix } from "../model-runtime/videoShotModePromptVisibility";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { chunkValues } from "./queryBatching";

const PROJECT_OUTPUT_DISPLAY_SELECT_COLUMNS = [
  "project_id",
  "user_id",
  "output_id",
  "version",
  "source_snapshot_updated_at",
  "mode",
  "media_source",
  "created_at",
  "generation_id",
  "prompt_id",
  "task_id",
  "source_ref",
  "generation_trace_id",
  "preview_text",
  "display_title",
  "display_prompt_summary",
  "mime_type",
  "width",
  "height",
  "duration_ms",
  "preview_storage_path",
  "full_storage_path",
  "preview_poster_storage_path",
  "companion_art_storage_path",
  "preview_url_fallback",
  "preview_poster_url_fallback",
  "companion_art_url_fallback",
  "result_urls_fallback",
  "saved_media_ids",
  "task_state",
  "queue_state",
  "save_state",
  "status",
  "error_message_short",
  "hidden_in_reference_grid",
  "updated_at",
] as const;

type ProjectOutputDisplayItemRow = {
  project_id: string;
  user_id: string;
  output_id: string;
  version: number;
  source_snapshot_updated_at: string;
  mode: string | null;
  media_source: string | null;
  created_at: string | null;
  generation_id: string | null;
  prompt_id: string | null;
  task_id: string | null;
  source_ref: string | null;
  generation_trace_id: string | null;
  preview_text: string | null;
  display_title?: string | null;
  display_prompt_summary: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  preview_storage_path: string | null;
  full_storage_path: string | null;
  preview_poster_storage_path: string | null;
  companion_art_storage_path: string | null;
  preview_url_fallback: string | null;
  preview_poster_url_fallback: string | null;
  companion_art_url_fallback: string | null;
  result_urls_fallback: unknown;
  saved_media_ids: unknown;
  task_state: string | null;
  queue_state: string | null;
  save_state: string | null;
  status: string | null;
  error_message_short: string | null;
  hidden_in_reference_grid: boolean;
  updated_at: string;
};

type ProjectOutputDisplayItemUpsertRow = Omit<ProjectOutputDisplayItemRow, "updated_at"> & {
  updated_at: string;
};

type ProjectPromptTextAuthorityRow = {
  id: string;
  title: string | null;
  prompt_text: string | null;
};

export type ProjectOutputDisplaySyncResult = {
  outputCount: number;
  upsertedCount: number;
  deletedCount: number;
  deferredDeleteCount: number;
  skippedStaleCount: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeUuid = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
};

const compareIsoTimestamps = (left: string, right: string): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
  if (leftTime === rightTime) return 0;
  return leftTime > rightTime ? 1 : -1;
};

const normalizeJsonArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [];

const compactRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const compacted: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) && value.length === 0) return;
    compacted[key] = value;
  });
  return compacted;
};

const collectSnapshotOutputIdsForMaterialization = (
  snapshot: Record<string, unknown>
): string[] => {
  const outputIds = new Set<string>();
  getProjectWorkspaceSnapshotOutputRows(snapshot).forEach((output) => {
    const outputId = normalizeString(output.id);
    if (outputId) outputIds.add(outputId);
  });
  return [...outputIds];
};

const toDisplayItemCandidate = ({
  userId,
  projectId,
  snapshotUpdatedAt,
  nowIso,
  output,
  existingVersion,
}: {
  userId: string;
  projectId: string;
  snapshotUpdatedAt: string;
  nowIso: string;
  output: Record<string, unknown>;
  existingVersion: number;
}): ProjectOutputDisplayItemUpsertRow | null => {
  const outputId = normalizeString(output.id);
  if (!outputId) return null;
  const displayValues = createProjectOutputDisplayComparisonValuesForOutput(output);
  return {
    project_id: projectId,
    user_id: userId,
    output_id: outputId,
    version: existingVersion + 1,
    source_snapshot_updated_at: snapshotUpdatedAt,
    ...displayValues,
    updated_at: nowIso,
  };
};

const displayValuesForComparison = (
  row: ProjectOutputDisplayItemUpsertRow | ProjectOutputDisplayItemRow
): ProjectOutputDisplayComparisonValues => ({
  mode: row.mode,
  media_source: row.media_source,
  created_at: row.created_at,
  generation_id: row.generation_id,
  prompt_id: row.prompt_id,
  task_id: row.task_id,
  source_ref: row.source_ref,
  generation_trace_id: row.generation_trace_id,
  preview_text: stripHiddenVideoShotModePromptPrefix(row.preview_text),
  display_title: row.display_title ?? null,
  display_prompt_summary: stripHiddenVideoShotModePromptPrefix(row.display_prompt_summary),
  mime_type: row.mime_type,
  width: row.width,
  height: row.height,
  duration_ms: row.duration_ms,
  preview_storage_path: row.preview_storage_path,
  full_storage_path: row.full_storage_path,
  preview_poster_storage_path: row.preview_poster_storage_path,
  companion_art_storage_path: row.companion_art_storage_path,
  preview_url_fallback: row.preview_url_fallback,
  preview_poster_url_fallback: row.preview_poster_url_fallback,
  companion_art_url_fallback: row.companion_art_url_fallback,
  result_urls_fallback: normalizeJsonArray(row.result_urls_fallback),
  saved_media_ids: normalizeJsonArray(row.saved_media_ids),
  task_state: row.task_state,
  queue_state: row.queue_state,
  save_state: row.save_state,
  status: row.status,
  error_message_short: row.error_message_short,
  hidden_in_reference_grid: row.hidden_in_reference_grid,
});

const areDisplayValuesEqual = (
  left: ProjectOutputDisplayItemUpsertRow,
  right: ProjectOutputDisplayItemRow
): boolean =>
  JSON.stringify(displayValuesForComparison(left)) ===
  JSON.stringify(displayValuesForComparison(right));

export const loadProjectOutputDisplayItemsForProject = async ({
  userId,
  projectId,
  outputIds,
}: {
  userId: string;
  projectId: string;
  outputIds?: readonly string[];
}): Promise<ProjectOutputDisplayItemRow[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const normalizedOutputIds = outputIds
    ? Array.from(
        new Set(
          outputIds.map((id) => normalizeString(id)).filter((id): id is string => Boolean(id))
        )
      )
    : null;
  if (normalizedOutputIds && normalizedOutputIds.length === 0) return [];

  const loadRows = async (idChunk?: readonly string[]): Promise<ProjectOutputDisplayItemRow[]> => {
    const query = supabaseAdmin
      .from("project_output_display_items")
      .select(PROJECT_OUTPUT_DISPLAY_SELECT_COLUMNS.join(", "))
      .eq("project_id", projectId)
      .eq("user_id", userId);
    const { data, error } = idChunk ? await query.in("output_id", idChunk) : await query;

    if (error) {
      throw new Error(error.message || "Failed to load project output display items");
    }
    return (Array.isArray(data) ? data : []) as unknown as ProjectOutputDisplayItemRow[];
  };

  if (!normalizedOutputIds) {
    return loadRows();
  }

  const rows: ProjectOutputDisplayItemRow[] = [];
  for (const outputIdChunk of chunkValues(normalizedOutputIds)) {
    rows.push(...(await loadRows(outputIdChunk)));
  }
  return rows;
};

export const syncProjectOutputDisplayItemsForSnapshot = async ({
  userId,
  projectId,
  snapshot,
  snapshotUpdatedAt,
  deferDeletes = false,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  snapshotUpdatedAt: string;
  deferDeletes?: boolean;
}): Promise<ProjectOutputDisplaySyncResult> => {
  const existingRows = await loadProjectOutputDisplayItemsForProject({ userId, projectId });
  const existingByOutputId = new Map(existingRows.map((row) => [row.output_id, row]));
  const nowIso = new Date().toISOString();
  const candidates = getProjectWorkspaceSnapshotOutputRows(snapshot)
    .map((output) => {
      const outputId = normalizeString(output.id);
      const existing = outputId ? existingByOutputId.get(outputId) : null;
      return toDisplayItemCandidate({
        userId,
        projectId,
        snapshotUpdatedAt,
        nowIso,
        output,
        existingVersion: existing?.version ?? 0,
      });
    })
    .filter((row): row is ProjectOutputDisplayItemUpsertRow => Boolean(row));
  const incomingOutputIds = new Set(candidates.map((row) => row.output_id));
  const rowsToUpsert = candidates.filter((candidate) => {
    const existing = existingByOutputId.get(candidate.output_id);
    if (!existing) return true;
    if (
      compareIsoTimestamps(
        existing.source_snapshot_updated_at,
        candidate.source_snapshot_updated_at
      ) > 0
    ) {
      return false;
    }
    return !areDisplayValuesEqual(candidate, existing);
  });
  const skippedStaleCount = candidates.filter((candidate) => {
    const existing = existingByOutputId.get(candidate.output_id);
    return existing
      ? compareIsoTimestamps(
          existing.source_snapshot_updated_at,
          candidate.source_snapshot_updated_at
        ) > 0
      : false;
  }).length;
  const supabaseAdmin = getSupabaseAdmin();

  for (const rowChunk of chunkValues(rowsToUpsert)) {
    const { error } = await supabaseAdmin.from("project_output_display_items").upsert(rowChunk, {
      onConflict: "project_id,output_id",
    });
    if (error) {
      throw new Error(error.message || "Failed to upsert project output display items");
    }
  }

  const staleOutputIds = existingRows
    .map((row) => row.output_id)
    .filter((outputId) => !incomingOutputIds.has(outputId));
  const idsToDelete = deferDeletes ? [] : staleOutputIds;
  for (const idChunk of chunkValues(idsToDelete)) {
    const { error } = await supabaseAdmin
      .from("project_output_display_items")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .in("output_id", idChunk);
    if (error) {
      throw new Error(error.message || "Failed to delete stale project output display items");
    }
  }

  return {
    outputCount: candidates.length,
    upsertedCount: rowsToUpsert.length,
    deletedCount: idsToDelete.length,
    deferredDeleteCount: deferDeletes ? staleOutputIds.length : 0,
    skippedStaleCount,
  };
};

const toCompatibilityOutputPatch = (row: ProjectOutputDisplayItemRow): Record<string, unknown> =>
  compactRecord({
    mode: row.mode,
    mediaSource: row.media_source,
    createdAt: row.created_at,
    generationId: row.generation_id,
    promptId: row.prompt_id,
    taskId: row.task_id,
    sourceRef: row.source_ref,
    generationTraceId: row.generation_trace_id,
    previewText: stripHiddenVideoShotModePromptPrefix(row.preview_text),
    title: row.display_title,
    prompt: stripHiddenVideoShotModePromptPrefix(row.display_prompt_summary),
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    previewStoragePath: row.preview_storage_path,
    fullStoragePath: row.full_storage_path,
    previewPosterStoragePath: row.preview_poster_storage_path,
    companionArtStoragePath: row.companion_art_storage_path,
    previewUrl: row.preview_url_fallback,
    previewPosterUrl: row.preview_poster_url_fallback,
    companionArtUrl: row.companion_art_url_fallback,
    resultUrls: normalizeJsonArray(row.result_urls_fallback),
    savedMediaIds: normalizeJsonArray(row.saved_media_ids),
    taskState: row.task_state,
    queueState: row.queue_state,
    saveState: row.save_state,
    status: row.status,
    errorMessageShort: row.error_message_short,
    hiddenInReferenceGrid: row.hidden_in_reference_grid,
  });

const collectSnapshotPromptIdsForMaterialization = ({
  snapshot,
  displayItems,
}: {
  snapshot: Record<string, unknown>;
  displayItems: readonly ProjectOutputDisplayItemRow[];
}): string[] => {
  const promptIds = new Set<string>();
  getProjectWorkspaceSnapshotOutputRows(snapshot).forEach((output) => {
    const promptId = normalizeUuid(output.promptId);
    if (promptId) promptIds.add(promptId);
  });
  displayItems.forEach((row) => {
    const promptId = normalizeUuid(row.prompt_id);
    if (promptId) promptIds.add(promptId);
  });
  return [...promptIds];
};

const loadProjectPromptTextAuthorities = async ({
  userId,
  promptIds,
}: {
  userId: string;
  promptIds: string[];
}): Promise<Map<string, ProjectPromptTextAuthorityRow>> => {
  if (promptIds.length === 0) return new Map();
  const supabaseAdmin = getSupabaseAdmin();
  const promptRows = new Map<string, ProjectPromptTextAuthorityRow>();

  for (const idChunk of chunkValues(promptIds)) {
    const { data, error } = await supabaseAdmin
      .from("media_prompts")
      .select("id, title, prompt_text")
      .eq("user_id", userId)
      .in("id", idChunk);

    if (error) {
      throw new Error(error.message || "Failed to load project prompt text authorities");
    }

    (Array.isArray(data) ? data : []).forEach((row) => {
      const record = asRecord(row);
      const id = normalizeUuid(record.id);
      const promptText = normalizeString(record.prompt_text);
      if (!id || !promptText) return;
      promptRows.set(id, {
        id,
        title: normalizeString(record.title),
        prompt_text: promptText,
      });
    });
  }

  return promptRows;
};

const preservePromptTextAuthority = ({
  patch,
  promptAuthority,
}: {
  patch: Record<string, unknown>;
  promptAuthority: ProjectPromptTextAuthorityRow | null;
}): Record<string, unknown> => {
  const promptText = normalizeString(promptAuthority?.prompt_text);
  if (!promptText) return patch;
  return compactRecord({
    ...patch,
    previewText: promptText,
    prompt: promptText,
    title: normalizeString(promptAuthority?.title) ?? patch.title,
  });
};

const preserveSnapshotTextAuthority = ({
  output,
  patch,
}: {
  output: Record<string, unknown>;
  patch: Record<string, unknown>;
}): Record<string, unknown> => {
  const merged = { ...patch };
  (["previewText", "prompt", "title", "errorMessageShort"] as const).forEach((field) => {
    if (normalizeString(output[field])) {
      merged[field] = output[field];
    }
  });
  return merged;
};

export const materializeProjectWorkspaceSnapshotWithDisplayItems = ({
  snapshot,
  displayItems,
  promptTextAuthorities = new Map(),
}: {
  snapshot: Record<string, unknown>;
  displayItems: readonly ProjectOutputDisplayItemRow[];
  promptTextAuthorities?: ReadonlyMap<string, ProjectPromptTextAuthorityRow>;
}): Record<string, unknown> => {
  const displayByOutputId = new Map(displayItems.map((row) => [row.output_id, row]));
  const outputs = asRecord(snapshot.outputs);
  const patchOutputRows = (rows: Record<string, unknown>[]) =>
    rows.map((output) => {
      const outputId = normalizeString(output.id);
      const displayItem = outputId ? displayByOutputId.get(outputId) : null;
      const promptId = normalizeUuid(output.promptId ?? displayItem?.prompt_id);
      const promptAuthority = promptId ? (promptTextAuthorities.get(promptId) ?? null) : null;
      if (!displayItem && !promptAuthority) return output;
      const snapshotPreservedPatch = preserveSnapshotTextAuthority({
        output,
        patch: displayItem ? toCompatibilityOutputPatch(displayItem) : {},
      });
      const compatibilityPatch = preservePromptTextAuthority({
        patch: snapshotPreservedPatch,
        promptAuthority,
      });
      return {
        ...output,
        ...compatibilityPatch,
        id: outputId,
      };
    });
  const active = patchOutputRows(getProjectWorkspaceSnapshotActiveOutputs(snapshot));
  const archived = patchOutputRows(getProjectWorkspaceSnapshotArchivedOutputs(snapshot));
  return {
    ...snapshot,
    outputs: {
      ...outputs,
      active,
      archived,
    },
  };
};

export const materializeProjectWorkspaceSnapshotForUser = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  const displayItems = await loadProjectOutputDisplayItemsForProject({
    userId,
    projectId,
    outputIds: collectSnapshotOutputIdsForMaterialization(snapshot),
  });
  const promptTextAuthorities = await loadProjectPromptTextAuthorities({
    userId,
    promptIds: collectSnapshotPromptIdsForMaterialization({ snapshot, displayItems }),
  });
  return materializeProjectWorkspaceSnapshotWithDisplayItems({
    snapshot,
    displayItems,
    promptTextAuthorities,
  });
};
