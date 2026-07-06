/**
 * Pure lightweight-checkpoint helpers shared by browser autosave selection and
 * server-side project workspace persistence.
 */
import { stripHiddenVideoShotModePromptPrefix } from "../model-runtime/videoShotModePromptVisibility";
import { computeAiStudioSessionChecksum } from "./projectWorkspaceSnapshot";

export const CHECKPOINT_OUTPUT_STUB_FIELDS = [
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

export const RICH_OUTPUT_CHECKPOINT_EXCLUDED_FIELDS = [
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_OUTPUT_DISPLAY_ERROR_MAX_CHARS = 1000;
const PROJECT_OUTPUT_DISPLAY_TITLE_MAX_CHARS = 40;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

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

const truncateTextField = (value: unknown, maxChars: number): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
};

const truncateSummary = (value: unknown): string | null =>
  truncateTextField(value, PROJECT_OUTPUT_DISPLAY_ERROR_MAX_CHARS);

const truncateDisplayTitle = (value: unknown): string | null =>
  truncateTextField(value, PROJECT_OUTPUT_DISPLAY_TITLE_MAX_CHARS);

const normalizeVisiblePromptText = (value: unknown): string | null =>
  normalizeString(stripHiddenVideoShotModePromptPrefix(normalizeString(value)));

export const getProjectWorkspaceSnapshotActiveOutputs = (
  snapshot: Record<string, unknown>
): Record<string, unknown>[] => {
  const outputs = asRecord(snapshot.outputs);
  return Array.isArray(outputs.active) ? outputs.active.map((row) => asRecord(row)) : [];
};

export const getProjectWorkspaceSnapshotArchivedOutputs = (
  snapshot: Record<string, unknown>
): Record<string, unknown>[] => {
  const outputs = asRecord(snapshot.outputs);
  return Array.isArray(outputs.archived) ? outputs.archived.map((row) => asRecord(row)) : [];
};

export const getProjectWorkspaceSnapshotOutputRows = (
  snapshot: Record<string, unknown>
): Record<string, unknown>[] => [
  ...getProjectWorkspaceSnapshotActiveOutputs(snapshot),
  ...getProjectWorkspaceSnapshotArchivedOutputs(snapshot),
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

export type ProjectOutputDisplayComparisonValues = {
  mode: string | null;
  media_source: string | null;
  created_at: string | null;
  generation_id: string | null;
  prompt_id: string | null;
  task_id: string | null;
  source_ref: string | null;
  generation_trace_id: string | null;
  preview_text: string | null;
  display_title: string | null;
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
  result_urls_fallback: string[];
  saved_media_ids: string[];
  task_state: string | null;
  queue_state: string | null;
  save_state: string | null;
  status: string | null;
  error_message_short: string | null;
  hidden_in_reference_grid: boolean;
};

export const createProjectOutputDisplayComparisonValuesForOutput = (
  output: Record<string, unknown>
): ProjectOutputDisplayComparisonValues => ({
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
  result_urls_fallback: normalizeStringArray(output.resultUrls),
  saved_media_ids: normalizeStringArray(output.savedMediaIds),
  task_state: normalizeString(output.taskState),
  queue_state: normalizeString(output.queueState),
  save_state: normalizeString(output.saveState),
  status: normalizeString(output.status),
  error_message_short: truncateSummary(output.errorMessageShort),
  hidden_in_reference_grid: normalizeBoolean(output.hiddenInReferenceGrid),
});

type ProjectOutputDisplayChecksumEntry = {
  outputId: string;
  values: ProjectOutputDisplayComparisonValues;
};

export function computeProjectOutputDisplayChecksumForSnapshot(
  snapshot: Record<string, unknown>
): string {
  const displayValues = getProjectWorkspaceSnapshotOutputRows(snapshot)
    .map((output) => {
      const outputId = normalizeString(output.id);
      if (!outputId) return null;
      return {
        outputId,
        values: createProjectOutputDisplayComparisonValuesForOutput(output),
      };
    })
    .filter((value): value is ProjectOutputDisplayChecksumEntry => Boolean(value));
  return computeAiStudioSessionChecksum(displayValues);
}

export const readProjectOutputDisplayChecksum = (
  snapshot: Record<string, unknown>
): string | null => normalizeString(asRecord(snapshot.meta).outputDisplayChecksum);

export const isProjectWorkspaceOutputCheckpointStub = (row: Record<string, unknown>): boolean =>
  Boolean(normalizeString(row.id)) &&
  !RICH_OUTPUT_CHECKPOINT_EXCLUDED_FIELDS.some((field) => field in row);

export const isLightweightProjectWorkspaceCheckpointSnapshot = (
  snapshot: Record<string, unknown>
): boolean => {
  const rows = getProjectWorkspaceSnapshotOutputRows(snapshot);
  return rows.length > 0 && rows.every(isProjectWorkspaceOutputCheckpointStub);
};

export const createLightweightProjectWorkspaceCheckpointSnapshot = ({
  snapshot,
  checkpointRevision,
}: {
  snapshot: Record<string, unknown>;
  checkpointRevision: number;
}): Record<string, unknown> => {
  const outputs = asRecord(snapshot.outputs);
  const active = getProjectWorkspaceSnapshotActiveOutputs(snapshot)
    .map((row) => buildCheckpointOutputStub(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const archived = getProjectWorkspaceSnapshotArchivedOutputs(snapshot)
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
    outputDisplayChecksum: isLightweightProjectWorkspaceCheckpointSnapshot(snapshot)
      ? (readProjectOutputDisplayChecksum(snapshot) ??
        computeProjectOutputDisplayChecksumForSnapshot(snapshot))
      : computeProjectOutputDisplayChecksumForSnapshot(snapshot),
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
  getProjectWorkspaceSnapshotOutputRows(snapshot).some((row) =>
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
