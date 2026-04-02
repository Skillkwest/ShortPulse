import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type UpsertGenerationProjectionInput = {
  generationId: string;
  userId: string;
  sourceRef?: string | null;
  requestId?: string | null;
  provider?: string | null;
  providerRequestId?: string | null;
  latestAttemptId?: string | null;
  status?: string | null;
  taskState?: string | null;
  queueState?: string | null;
  displayPrompt?: string | null;
  modelId?: string | null;
  previewUrl?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  errorMessage?: string | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
  saveState?: string | null;
  hiddenInReferenceGrid?: boolean;
  referenceGridVisible?: boolean;
  publicationState?: string | null;
  resultUrls?: string[];
  savedMediaIds?: string[];
  generationReplay?: JsonObject;
  characterContext?: JsonObject;
  styleContext?: JsonObject;
  startedAt?: string | null;
  completedAt?: string | null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
};

export type GenerationProjectionStatusContext = {
  generationId: string;
  resultUrls: string[];
  status: string | null;
  taskState: string | null;
  errorMessageShort: string | null;
  errorDetail: string | null;
};

export type GenerationProjectionQueueContext = {
  generationId: string;
  sourceRef: string | null;
  requestId: string | null;
  provider: string | null;
  providerRequestId: string | null;
  modelId: string | null;
  status: string | null;
  taskState: string | null;
  queueState: string | null;
  errorMessageShort: string | null;
  errorDetail: string | null;
};

export const upsertGenerationProjection = async ({
  generationId,
  userId,
  sourceRef,
  requestId,
  provider,
  providerRequestId,
  latestAttemptId,
  status,
  taskState,
  queueState,
  displayPrompt,
  modelId,
  previewUrl,
  previewStoragePath,
  fullStoragePath,
  errorMessage,
  errorMessageShort,
  errorDetail,
  saveState,
  hiddenInReferenceGrid,
  referenceGridVisible,
  publicationState,
  resultUrls = [],
  savedMediaIds = [],
  generationReplay = {},
  characterContext = {},
  styleContext = {},
  startedAt,
  completedAt,
}: UpsertGenerationProjectionInput): Promise<void> => {
  const payload: Record<string, unknown> = {
    generation_id: generationId,
    user_id: userId,
    result_urls: resultUrls,
    saved_media_ids: savedMediaIds,
    generation_replay: generationReplay,
    character_context: characterContext,
    style_context: styleContext,
    updated_at: new Date().toISOString(),
  };

  const stringFields: Record<string, string | null | undefined> = {
    source_ref: sourceRef,
    request_id: requestId,
    provider,
    provider_request_id: providerRequestId,
    latest_attempt_id: latestAttemptId,
    status,
    task_state: taskState,
    queue_state: queueState,
    display_prompt: displayPrompt,
    model_id: modelId,
    preview_url: previewUrl,
    preview_storage_path: previewStoragePath,
    full_storage_path: fullStoragePath,
    error_message: errorMessage,
    error_message_short: errorMessageShort,
    error_detail: errorDetail,
    save_state: saveState,
    publication_state: publicationState,
    started_at: startedAt,
    completed_at: completedAt,
  };

  for (const [key, value] of Object.entries(stringFields)) {
    const normalized = asString(value);
    if (normalized) {
      payload[key] = normalized;
    }
  }

  if (typeof hiddenInReferenceGrid === "boolean") {
    payload.hidden_in_reference_grid = hiddenInReferenceGrid;
  }
  if (typeof referenceGridVisible === "boolean") {
    payload.reference_grid_visible = referenceGridVisible;
  }

  const { error } = await getSupabaseAdmin().from("generation_projection").upsert(payload, {
    onConflict: "generation_id",
  });
  if (error) throw error;
};

export const readGenerationProjectionStatusContext = async ({
  userId,
  requestId,
  supabaseAdmin,
}: {
  userId: string;
  requestId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<GenerationProjectionStatusContext | null> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("generation_projection")
    .select(
      "generation_id, result_urls, status, task_state, error_message_short, error_detail, updated_at"
    )
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error || !Array.isArray(data) || !data.length) return null;

  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const generationId = asString(row.generation_id);
    if (!generationId) continue;
    return {
      generationId,
      resultUrls: asStringArray(row.result_urls),
      status: asString(row.status),
      taskState: asString(row.task_state),
      errorMessageShort: asString(row.error_message_short),
      errorDetail: asString(row.error_detail),
    };
  }

  return null;
};

export const readGenerationProjectionQueueContext = async ({
  userId,
  generationId,
  supabaseAdmin,
}: {
  userId: string;
  generationId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<GenerationProjectionQueueContext | null> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("generation_projection")
    .select(
      [
        "generation_id",
        "source_ref",
        "request_id",
        "provider",
        "provider_request_id",
        "model_id",
        "status",
        "task_state",
        "queue_state",
        "error_message_short",
        "error_detail",
      ].join(", ")
    )
    .eq("user_id", userId)
    .eq("generation_id", generationId)
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as Record<string, unknown>;
  const resolvedGenerationId = asString(row.generation_id);
  if (!resolvedGenerationId) return null;

  return {
    generationId: resolvedGenerationId,
    sourceRef: asString(row.source_ref),
    requestId: asString(row.request_id),
    provider: asString(row.provider),
    providerRequestId: asString(row.provider_request_id),
    modelId: asString(row.model_id),
    status: asString(row.status),
    taskState: asString(row.task_state),
    queueState: asString(row.queue_state),
    errorMessageShort: asString(row.error_message_short),
    errorDetail: asString(row.error_detail),
  };
};
