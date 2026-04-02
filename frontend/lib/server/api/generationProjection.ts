import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type UpsertGenerationProjectionInput = {
  generationId: string;
  userId: string;
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

export const upsertGenerationProjection = async ({
  generationId,
  userId,
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
