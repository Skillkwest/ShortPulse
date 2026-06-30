/**
 * Project output display item persistence.
 * Owns the project-scoped read model that keeps rich output display data out of
 * large workspace checkpoints while preserving compatibility snapshots on read.
 * Size note: this file intentionally keeps the first-cut checkpoint/display split
 * in one module; split SQL-row mapping from snapshot materialization after the
 * large-project rollout is stable.
 */
import { computeAiStudioSessionChecksum } from "../ai-studio-session/projectWorkspaceSnapshot";
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

const CHECKPOINT_OUTPUT_STUB_FIELDS = [
  "id",
  "mode",
  "mediaSource",
  "createdAt",
  "generationId",
  "savedMediaIds",
  "hiddenInReferenceGrid",
  "archivedAt",
  "archiveReason",
] as const;

const RICH_OUTPUT_CHECKPOINT_EXCLUDED_FIELDS = [
  "prompt",
  "title",
  "transcriptText",
  "resultUrls",
  "previewUrl",
  "previewPosterUrl",
  "companionArtUrl",
  "previewStoragePath",
  "fullStoragePath",
  "previewPosterStoragePath",
  "companionArtStoragePath",
  "saveState",
  "saveError",
  "status",
  "queueState",
  "queueEnqueuedAtMs",
  "generationTraceId",
  "submissionMode",
  "errorMessage",
  "errorMessageShort",
  "errorDetail",
  "audioSourceMode",
  "durationMs",
  "waveformPeaks",
  "previewTier",
  "width",
  "height",
  "pinned",
  "characterContext",
  "styleContext",
  "generationReplay",
  "workflowReload",
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

const normalizeIsoTimestamp = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

const normalizeUuid = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
};

const normalizeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizePositiveInteger = (value: unknown): number | null => {
  const normalized = normalizeNumber(value);
  if (normalized == null || normalized <= 0) return null;
  return Math.trunc(normalized);
};

const normalizeNonNegativeInteger = (value: unknown): number | null => {
  const normalized = normalizeNumber(value);
  if (normalized == null || normalized < 0) return null;
  return Math.trunc(normalized);
};

const normalizeBoolean = (value: unknown): boolean => value === true;

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => normalizeString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

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

const PROJECT_OUTPUT_DISPLAY_ERROR_MAX_CHARS = 1000;
const PROJECT_OUTPUT_DISPLAY_TITLE_MAX_CHARS = 40;

const truncateTextField = (value: unknown, maxChars: number): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
};

const truncateSummary = (value: unknown): string | null =>
  truncateTextField(value, PROJECT_OUTPUT_DISPLAY_ERROR_MAX_CHARS);

const normalizeVisiblePromptText = (value: unknown): string | null =>
  normalizeString(stripHiddenVideoShotModePromptPrefix(normalizeString(value)));

const truncateDisplayTitle = (value: unknown): string | null =>
  truncateTextField(value, PROJECT_OUTPUT_DISPLAY_TITLE_MAX_CHARS);

const getSnapshotActiveOutputs = (snapshot: Record<string, unknown>): Record<string, unknown>[] => {
  const outputs = asRecord(snapshot.outputs);
  return Array.isArray(outputs.active) ? outputs.active.map((row) => asRecord(row)) : [];
};

const getSnapshotArchivedOutputs = (
  snapshot: Record<string, unknown>
): Record<string, unknown>[] => {
  const outputs = asRecord(snapshot.outputs);
  return Array.isArray(outputs.archived) ? outputs.archived.map((row) => asRecord(row)) : [];
};

const getSnapshotOutputRows = (snapshot: Record<string, unknown>): Record<string, unknown>[] => [
  ...getSnapshotActiveOutputs(snapshot),
  ...getSnapshotArchivedOutputs(snapshot),
];

const buildCheckpointOutputStub = (
  row: Record<string, unknown>
): Record<string, unknown> | null => {
  const id = normalizeString(row.id);
  if (!id) return null;
  const stub: Record<string, unknown> = { id };
  CHECKPOINT_OUTPUT_STUB_FIELDS.forEach((field) => {
    if (field === "id") return;
    const value = row[field];
    if (value !== undefined && value !== null) {
      stub[field] = value;
    }
  });
  return stub;
};

const filterOutputIds = (value: unknown, validOutputIds: Set<string>): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((entry) => normalizeString(entry))
            .filter((entry): entry is string => entry !== null && validOutputIds.has(entry))
        )
      )
    : [];

export const createLightweightProjectWorkspaceCheckpointSnapshot = ({
  snapshot,
  checkpointRevision,
}: {
  snapshot: Record<string, unknown>;
  checkpointRevision: number;
}): Record<string, unknown> => {
  const outputs = asRecord(snapshot.outputs);
  const active = getSnapshotActiveOutputs(snapshot)
    .map((row) => buildCheckpointOutputStub(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const archived = getSnapshotArchivedOutputs(snapshot)
    .map((row) => buildCheckpointOutputStub(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const activeOutputIds = new Set(
    active.map((row) => normalizeString(row.id)).filter((value): value is string => Boolean(value))
  );
  const persistedOutputIds = new Set([
    ...activeOutputIds,
    ...archived
      .map((row) => normalizeString(row.id))
      .filter((value): value is string => Boolean(value)),
  ]);
  const activeOutputId = normalizeString(outputs.activeOutputId);
  const nextSnapshot = {
    ...snapshot,
    outputs: {
      ...outputs,
      active,
      archived,
      activeOutputId: activeOutputId && activeOutputIds.has(activeOutputId) ? activeOutputId : null,
      curatedReferenceIds: filterOutputIds(outputs.curatedReferenceIds, activeOutputIds),
      removedFromAllRefsIds: filterOutputIds(outputs.removedFromAllRefsIds, persistedOutputIds),
    },
  };
  const meta = {
    ...asRecord(snapshot.meta),
    generatedAt:
      normalizeString(snapshot.updatedAt) ?? normalizeString(asRecord(snapshot.meta).generatedAt),
    checkpointRevision,
    outputDisplayChecksum: computeProjectOutputDisplayChecksumForSnapshot(snapshot),
  };
  const snapshotWithoutChecksum = {
    ...nextSnapshot,
    meta,
  };
  return {
    ...nextSnapshot,
    meta: {
      ...meta,
      checksum: computeAiStudioSessionChecksum(snapshotWithoutChecksum),
    },
  };
};

export const projectWorkspaceCheckpointNeedsCompaction = (
  snapshot: Record<string, unknown>
): boolean =>
  getSnapshotOutputRows(snapshot).some((row) =>
    RICH_OUTPUT_CHECKPOINT_EXCLUDED_FIELDS.some((field) => field in row)
  );

const normalizeCheckpointForComparison = (snapshot: Record<string, unknown>) => {
  const normalized = createLightweightProjectWorkspaceCheckpointSnapshot({
    snapshot,
    checkpointRevision: 0,
  });
  const { updatedAt: _updatedAt, meta: _meta, ...rest } = normalized;
  void _updatedAt;
  void _meta;
  return rest;
};

export const areProjectWorkspaceCheckpointsStructurallyEqual = (
  left: Record<string, unknown>,
  right: Record<string, unknown>
): boolean =>
  JSON.stringify(normalizeCheckpointForComparison(left)) ===
  JSON.stringify(normalizeCheckpointForComparison(right));

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
  const savedMediaIds = normalizeStringArray(output.savedMediaIds);
  const resultUrlsFallback = normalizeStringArray(output.resultUrls);
  return {
    project_id: projectId,
    user_id: userId,
    output_id: outputId,
    version: existingVersion + 1,
    source_snapshot_updated_at: snapshotUpdatedAt,
    mode: normalizeString(output.mode),
    media_source: normalizeString(output.mediaSource),
    created_at: normalizeIsoTimestamp(output.createdAt),
    generation_id: normalizeUuid(output.generationId),
    prompt_id: normalizeUuid(output.promptId),
    task_id: normalizeString(output.taskId),
    source_ref: normalizeString(output.sourceRef),
    generation_trace_id: normalizeString(output.generationTraceId),
    preview_text: normalizeVisiblePromptText(output.previewText),
    display_title: truncateDisplayTitle(output.title),
    display_prompt_summary:
      normalizeVisiblePromptText(output.prompt) ?? normalizeVisiblePromptText(output.previewText),
    mime_type: normalizeString(output.mimeType),
    width: normalizePositiveInteger(output.width),
    height: normalizePositiveInteger(output.height),
    duration_ms: normalizeNonNegativeInteger(output.durationMs),
    preview_storage_path: normalizeString(output.previewStoragePath),
    full_storage_path: normalizeString(output.fullStoragePath),
    preview_poster_storage_path: normalizeString(output.previewPosterStoragePath),
    companion_art_storage_path: normalizeString(output.companionArtStoragePath),
    preview_url_fallback: normalizeString(output.previewUrl),
    preview_poster_url_fallback: normalizeString(output.previewPosterUrl),
    companion_art_url_fallback: normalizeString(output.companionArtUrl),
    result_urls_fallback: resultUrlsFallback,
    saved_media_ids: savedMediaIds,
    task_state: normalizeString(output.taskState),
    queue_state: normalizeString(output.queueState),
    save_state: normalizeString(output.saveState),
    status: normalizeString(output.status),
    error_message_short: truncateSummary(output.errorMessageShort),
    hidden_in_reference_grid: normalizeBoolean(output.hiddenInReferenceGrid),
    updated_at: nowIso,
  };
};

const displayValuesForComparison = (
  row: ProjectOutputDisplayItemUpsertRow | ProjectOutputDisplayItemRow
) => ({
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

type ProjectOutputDisplayChecksumEntry = {
  outputId: string;
  values: ReturnType<typeof displayValuesForComparison>;
};

export function computeProjectOutputDisplayChecksumForSnapshot(
  snapshot: Record<string, unknown>
): string {
  const displayValues = getSnapshotOutputRows(snapshot)
    .map((output) => {
      const outputId = normalizeString(output.id);
      if (!outputId) return null;
      const candidate = toDisplayItemCandidate({
        userId: "",
        projectId: "",
        snapshotUpdatedAt: "",
        nowIso: "",
        output,
        existingVersion: 0,
      });
      if (!candidate) return null;
      return {
        outputId,
        values: displayValuesForComparison(candidate),
      };
    })
    .filter((value): value is ProjectOutputDisplayChecksumEntry => Boolean(value));
  return computeAiStudioSessionChecksum(displayValues);
}

export const loadProjectOutputDisplayItemsForProject = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<ProjectOutputDisplayItemRow[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_output_display_items")
    .select(PROJECT_OUTPUT_DISPLAY_SELECT_COLUMNS.join(", "))
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Failed to load project output display items");
  }
  return (Array.isArray(data) ? data : []) as unknown as ProjectOutputDisplayItemRow[];
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
  const candidates = getSnapshotOutputRows(snapshot)
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
  getSnapshotOutputRows(snapshot).forEach((output) => {
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
  const active = patchOutputRows(getSnapshotActiveOutputs(snapshot));
  const archived = patchOutputRows(getSnapshotArchivedOutputs(snapshot));
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
  const displayItems = await loadProjectOutputDisplayItemsForProject({ userId, projectId });
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
