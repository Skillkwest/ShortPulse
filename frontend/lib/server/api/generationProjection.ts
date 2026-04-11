import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type UpsertGenerationProjectionInput = {
  generationId: string;
  userId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
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

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  return null;
};

export type GenerationProjectionStatusContext = {
  generationId: string;
  resultUrls: string[];
  status: string | null;
  taskState: string | null;
  queueState: string | null;
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

export type GenerationProjectionLink = {
  generationId: string;
  sourceRef: string | null;
  requestId: string | null;
};

export type GenerationProjectionOwnershipContext = {
  userIds: string[];
};

type RepairableProjectionRow = {
  generationId: string;
  userId: string;
  sourceRef: string | null;
  requestId: string | null;
  provider: string | null;
  providerRequestId: string | null;
  latestAttemptId: string | null;
  displayPrompt: string | null;
  modelId: string | null;
  hiddenInReferenceGrid: boolean;
  referenceGridVisible: boolean | null;
  generationReplay: JsonObject;
  characterContext: JsonObject;
  styleContext: JsonObject;
  startedAt: string | null;
};

type RepairableGenerationRow = {
  generationId: string;
  userId: string;
  requestId: string | null;
  provider: string | null;
  modelId: string | null;
  promptText: string | null;
  status: string | null;
  failureReasonCode: string | null;
  completedAt: string | null;
};

export type TerminalGenerationProjectionRepairMetrics = {
  scanned: number;
  repaired: number;
  skipped: number;
};

const parseRepairableProjectionRow = (value: unknown): RepairableProjectionRow | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const generationId = asString(row.generation_id);
  const userId = asString(row.user_id);
  if (!generationId || !userId) return null;

  return {
    generationId,
    userId,
    sourceRef: asString(row.source_ref),
    requestId: asString(row.request_id),
    provider: asString(row.provider),
    providerRequestId: asString(row.provider_request_id),
    latestAttemptId: asString(row.latest_attempt_id),
    displayPrompt: asString(row.display_prompt),
    modelId: asString(row.model_id),
    hiddenInReferenceGrid: asBoolean(row.hidden_in_reference_grid) ?? false,
    referenceGridVisible: asBoolean(row.reference_grid_visible),
    generationReplay: asObject(row.generation_replay),
    characterContext: asObject(row.character_context),
    styleContext: asObject(row.style_context),
    startedAt: asString(row.started_at),
  };
};

const parseRepairableGenerationRow = (value: unknown): RepairableGenerationRow | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const generationId = asString(row.id);
  const userId = asString(row.user_id);
  if (!generationId || !userId) return null;

  return {
    generationId,
    userId,
    requestId: asString(row.request_id),
    provider: asString(row.provider),
    modelId: asString(row.model_id),
    promptText: asString(row.prompt_text),
    status: asString(row.status),
    failureReasonCode: asString(row.failure_reason_code),
    completedAt: asString(row.completed_at),
  };
};

const readFailedProjectionMessage = (
  failureReasonCode: string | null
): {
  errorMessage: string;
  errorMessageShort: string;
  errorDetail: string;
} => {
  switch (failureReasonCode) {
    case "terminal_success_no_media":
      return {
        errorMessage: "Generation failed.",
        errorMessageShort: "No media returned.",
        errorDetail: "Provider terminal success without media payload.",
      };
    case "provider_running_timeout":
      return {
        errorMessage: "Generation timed out during recovery.",
        errorMessageShort: "Generation timed out",
        errorDetail: "Provider exceeded running hard-timeout during recovery execution.",
      };
    case "provider_error":
      return {
        errorMessage: "Generation failed.",
        errorMessageShort: "Generation failed",
        errorDetail: "Provider reported failed state during recovery execution.",
      };
    case "recovery_exhausted":
      return {
        errorMessage: "Generation recovery exhausted.",
        errorMessageShort: "Generation failed",
        errorDetail: "Generation recovery exhausted before media could be recovered.",
      };
    default:
      return {
        errorMessage: "Generation failed.",
        errorMessageShort: "Generation failed",
        errorDetail: "Generation completed with a terminal failure state.",
      };
  }
};

export const upsertGenerationProjection = async ({
  generationId,
  userId,
  supabaseAdmin,
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
    if (value === null) {
      payload[key] = null;
      continue;
    }
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

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const { error } = await adminClient.from("generation_projection").upsert(payload, {
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
      "generation_id, result_urls, status, task_state, queue_state, error_message_short, error_detail, updated_at"
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
      queueState: asString(row.queue_state),
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

export const readGenerationProjectionLinkByGenerationId = async ({
  userId,
  generationId,
  supabaseAdmin,
}: {
  userId: string;
  generationId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<GenerationProjectionLink | null> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("generation_projection")
    .select("generation_id, source_ref, request_id")
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
  };
};

export const readGenerationProjectionLinkByRequestId = async ({
  userId,
  requestId,
  supabaseAdmin,
}: {
  userId: string;
  requestId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<GenerationProjectionLink | null> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("generation_projection")
    .select("generation_id, source_ref, request_id, updated_at")
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error || !Array.isArray(data) || !data.length) return null;

  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const resolvedGenerationId = asString(row.generation_id);
    if (!resolvedGenerationId) continue;
    return {
      generationId: resolvedGenerationId,
      sourceRef: asString(row.source_ref),
      requestId: asString(row.request_id),
    };
  }

  return null;
};

export const readGenerationProjectionLinkBySourceRef = async ({
  userId,
  sourceRef,
  supabaseAdmin,
}: {
  userId: string;
  sourceRef: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<GenerationProjectionLink | null> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("generation_projection")
    .select("generation_id, source_ref, request_id, updated_at")
    .eq("user_id", userId)
    .eq("source_ref", sourceRef)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error || !Array.isArray(data) || !data.length) return null;

  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const resolvedGenerationId = asString(row.generation_id);
    if (!resolvedGenerationId) continue;
    return {
      generationId: resolvedGenerationId,
      sourceRef: asString(row.source_ref),
      requestId: asString(row.request_id),
    };
  }

  return null;
};

export const readGenerationProjectionLinkByProviderRequestId = async ({
  userId,
  providerRequestId,
  supabaseAdmin,
}: {
  userId: string;
  providerRequestId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<GenerationProjectionLink | null> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("generation_projection")
    .select("generation_id, source_ref, request_id, updated_at")
    .eq("user_id", userId)
    .eq("provider_request_id", providerRequestId)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error || !Array.isArray(data) || !data.length) return null;

  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const resolvedGenerationId = asString(row.generation_id);
    if (!resolvedGenerationId) continue;
    return {
      generationId: resolvedGenerationId,
      sourceRef: asString(row.source_ref),
      requestId: asString(row.request_id),
    };
  }

  return null;
};

export const readGenerationProjectionOwnershipByProviderRequestId = async ({
  providerRequestId,
  supabaseAdmin,
}: {
  providerRequestId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<GenerationProjectionOwnershipContext> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("generation_projection")
    .select("user_id, updated_at")
    .eq("provider_request_id", providerRequestId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error || !Array.isArray(data) || !data.length) {
    return { userIds: [] };
  }

  return {
    userIds: Array.from(
      new Set(
        data
          .map((item) =>
            item && typeof item === "object" && !Array.isArray(item)
              ? asString((item as Record<string, unknown>).user_id)
              : null
          )
          .filter((userId): userId is string => Boolean(userId))
      )
    ),
  };
};

export const repairStaleTerminalGenerationProjections = async ({
  supabaseAdmin,
  limit = 25,
  minAgeSeconds = 15 * 60,
  now = new Date(),
}: {
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
  limit?: number;
  minAgeSeconds?: number;
  now?: Date;
}): Promise<TerminalGenerationProjectionRepairMetrics> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const cutoffIso = new Date(now.getTime() - Math.max(0, minAgeSeconds) * 1000).toISOString();

  const staleProjectionResponse = await adminClient
    .from("generation_projection")
    .select(
      [
        "generation_id",
        "user_id",
        "source_ref",
        "request_id",
        "provider",
        "provider_request_id",
        "latest_attempt_id",
        "display_prompt",
        "model_id",
        "hidden_in_reference_grid",
        "reference_grid_visible",
        "generation_replay",
        "character_context",
        "style_context",
        "started_at",
      ].join(", ")
    )
    .in("task_state", ["pending", "running"])
    .lte("updated_at", cutoffIso)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (staleProjectionResponse.error) throw staleProjectionResponse.error;

  const projectionRows = Array.isArray(staleProjectionResponse.data)
    ? staleProjectionResponse.data
        .map((row) => parseRepairableProjectionRow(row))
        .filter((row): row is RepairableProjectionRow => Boolean(row))
    : [];
  if (!projectionRows.length) {
    return { scanned: 0, repaired: 0, skipped: 0 };
  }

  const generationResponse = await adminClient
    .from("ai_generations")
    .select(
      "id, user_id, request_id, provider, model_id, prompt_text, status, failure_reason_code, completed_at"
    )
    .in(
      "id",
      projectionRows.map((row) => row.generationId)
    )
    .limit(projectionRows.length);
  if (generationResponse.error) throw generationResponse.error;

  const generationById = new Map(
    (Array.isArray(generationResponse.data) ? generationResponse.data : [])
      .map((row) => parseRepairableGenerationRow(row))
      .filter((row): row is RepairableGenerationRow => Boolean(row))
      .map((row) => [row.generationId, row])
  );

  let repaired = 0;
  let skipped = 0;

  for (const projection of projectionRows) {
    const generation = generationById.get(projection.generationId);
    if (
      !generation ||
      generation.userId !== projection.userId ||
      generation.status !== "fail" ||
      !generation.completedAt
    ) {
      skipped += 1;
      continue;
    }

    const message = readFailedProjectionMessage(generation.failureReasonCode);
    await upsertGenerationProjection({
      supabaseAdmin: adminClient,
      generationId: projection.generationId,
      userId: projection.userId,
      sourceRef: projection.sourceRef,
      requestId: projection.requestId ?? generation.requestId,
      provider: projection.provider ?? generation.provider,
      providerRequestId: projection.providerRequestId ?? generation.requestId,
      latestAttemptId: projection.latestAttemptId,
      status: "ready",
      taskState: "fail",
      displayPrompt: projection.displayPrompt ?? generation.promptText,
      modelId: projection.modelId ?? generation.modelId,
      errorMessage: message.errorMessage,
      errorMessageShort: message.errorMessageShort,
      errorDetail: message.errorDetail,
      saveState: "idle",
      hiddenInReferenceGrid: projection.hiddenInReferenceGrid,
      referenceGridVisible: projection.referenceGridVisible ?? !projection.hiddenInReferenceGrid,
      publicationState: "suppressed",
      resultUrls: [],
      savedMediaIds: [],
      generationReplay: projection.generationReplay,
      characterContext: projection.characterContext,
      styleContext: projection.styleContext,
      startedAt: projection.startedAt,
      completedAt: generation.completedAt,
    });
    repaired += 1;
  }

  return {
    scanned: projectionRows.length,
    repaired,
    skipped,
  };
};
