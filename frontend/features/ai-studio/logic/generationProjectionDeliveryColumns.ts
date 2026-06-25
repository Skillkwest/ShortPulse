/**
 * Generation projection delivery column contract.
 * Owns select-list construction and optional-column fallback for generated media reads.
 */
export type GenerationProjectionDeliveryRow = {
  generation_id?: unknown;
  project_id?: unknown;
  workspace_runtime_key?: unknown;
  request_id?: unknown;
  source_ref?: unknown;
  provider?: unknown;
  model_id?: unknown;
  display_prompt?: unknown;
  display_title?: unknown;
  transcript_text?: unknown;
  preview_url?: unknown;
  companion_art_status?: unknown;
  companion_art_storage_path?: unknown;
  result_urls?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  task_state?: unknown;
  queue_state?: unknown;
  error_message_short?: unknown;
  error_detail?: unknown;
  error_payload?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
  generation_replay?: unknown;
  workflow_reload?: unknown;
  character_context?: unknown;
  style_context?: unknown;
  started_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export const GENERATION_PROJECTION_DELIVERY_SELECT_COLUMN_LIST = [
  "generation_id",
  "project_id",
  "workspace_runtime_key",
  "request_id",
  "source_ref",
  "provider",
  "model_id",
  "display_prompt",
  "display_title",
  "transcript_text",
  "preview_url",
  "companion_art_status",
  "companion_art_storage_path",
  "result_urls",
  "preview_storage_path",
  "full_storage_path",
  "task_state",
  "queue_state",
  "error_message_short",
  "error_detail",
  "error_payload",
  "hidden_in_reference_grid",
  "reference_grid_visible",
  "generation_replay",
  "workflow_reload",
  "character_context",
  "style_context",
  "started_at",
  "created_at",
  "updated_at",
] as const;

const HEAVY_GENERATION_PROJECTION_CONTEXT_COLUMNS = new Set<string>([
  "generation_replay",
  "workflow_reload",
  "character_context",
  "style_context",
]);
export const GENERATION_PROJECTION_LIGHTWEIGHT_DELIVERY_SELECT_COLUMN_LIST =
  GENERATION_PROJECTION_DELIVERY_SELECT_COLUMN_LIST.filter(
    (column) => !HEAVY_GENERATION_PROJECTION_CONTEXT_COLUMNS.has(column)
  );
const OPTIONAL_GENERATION_PROJECTION_DELIVERY_COLUMNS = ["display_title", "error_payload"] as const;
type OptionalGenerationProjectionDeliveryColumn =
  (typeof OPTIONAL_GENERATION_PROJECTION_DELIVERY_COLUMNS)[number];
const buildGenerationProjectionDeliverySelectColumns = (
  omittedColumns: ReadonlySet<OptionalGenerationProjectionDeliveryColumn>,
  columnList: readonly string[]
): string =>
  columnList
    .filter((column) => !omittedColumns.has(column as OptionalGenerationProjectionDeliveryColumn))
    .join(", ");

export const resolveMissingGenerationProjectionOptionalColumn = (
  error: unknown
): OptionalGenerationProjectionDeliveryColumn | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof record.code === "string" ? record.code : null;
  const messageParts = [record.message, record.details]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  if (!messageParts.includes("generation_projection")) return null;
  if (
    code !== "42703" &&
    code !== "PGRST204" &&
    !/does not exist|schema cache/.test(messageParts)
  ) {
    return null;
  }
  return (
    OPTIONAL_GENERATION_PROJECTION_DELIVERY_COLUMNS.find((column) =>
      messageParts.includes(column)
    ) ?? null
  );
};

export const loadGenerationProjectionWithOptionalColumnFallback = async <
  TResult extends { error: unknown },
>(
  loadRows: (selectColumns: string) => Promise<TResult>,
  {
    columnList = GENERATION_PROJECTION_DELIVERY_SELECT_COLUMN_LIST,
  }: {
    columnList?: readonly string[];
  } = {}
): Promise<TResult> => {
  const omittedColumns = new Set<OptionalGenerationProjectionDeliveryColumn>();
  while (true) {
    const selectColumns = buildGenerationProjectionDeliverySelectColumns(
      omittedColumns,
      columnList
    );
    const result = await loadRows(selectColumns);
    const missingColumn = resolveMissingGenerationProjectionOptionalColumn(result.error);
    if (!missingColumn || omittedColumns.has(missingColumn)) return result;
    omittedColumns.add(missingColumn);
  }
};
