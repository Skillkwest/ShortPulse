import { getSupabaseAdmin } from "./supabaseAdmin";
import { readPersistedGenerationOutputs } from "./generationOutputs";
import { readMediaDeliveryPathsById } from "./mediaDeliveryPaths";
import { upsertGenerationPublication } from "./generationPublications";
import { toErrorMessage } from "./errorMessage";
import {
  associateGenerationWithProjectForUser,
  associateMediaFilesWithProjectForUser,
} from "../projectGenerationAssociationsService";
import {
  readGenerationProjectIdFromContext,
  readGenerationWorkspaceRuntimeKeyFromMetadata,
} from "./generationWorkspaceRuntimeKey";

type JsonObject = Record<string, unknown>;

export type UpsertGenerationProjectionInput = {
  generationId: string;
  userId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
  projectId?: string | null;
  workspaceRuntimeKey?: string | null;
  sourceRef?: string | null;
  requestId?: string | null;
  provider?: string | null;
  providerRequestId?: string | null;
  latestAttemptId?: string | null;
  status?: string | null;
  taskState?: string | null;
  queueState?: string | null;
  displayPrompt?: string | null;
  displayTitle?: string | null;
  transcriptText?: string | null;
  modelId?: string | null;
  previewUrl?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  companionArtStatus?: string | null;
  companionArtStoragePath?: string | null;
  companionArtAttemptCount?: number | null;
  errorMessage?: string | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
  errorPayload?: unknown;
  saveState?: string | null;
  saveError?: string | null;
  hiddenInReferenceGrid?: boolean;
  referenceGridVisible?: boolean;
  publicationState?: string | null;
  resultUrls?: string[];
  savedMediaIds?: string[];
  generationReplay?: JsonObject;
  workflowReload?: JsonObject;
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
  publicationState: string | null;
  status: string | null;
  taskState: string | null;
  queueState: string | null;
  errorMessageShort: string | null;
  errorDetail: string | null;
  errorPayload: unknown | null;
  saveState: string | null;
  saveError: string | null;
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
  errorPayload: unknown | null;
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
  projectId: string | null;
  workspaceRuntimeKey: string | null;
  sourceRef: string | null;
  requestId: string | null;
  provider: string | null;
  providerRequestId: string | null;
  latestAttemptId: string | null;
  displayPrompt: string | null;
  displayTitle: string | null;
  transcriptText: string | null;
  modelId: string | null;
  hiddenInReferenceGrid: boolean;
  referenceGridVisible: boolean | null;
  generationReplay: JsonObject;
  workflowReload: JsonObject;
  characterContext: JsonObject;
  styleContext: JsonObject;
  startedAt: string | null;
  taskState: string | null;
  publicationState: string | null;
  repairReason: "stale_projection" | "generation_fallback" | "project_scope_backfill";
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
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string | null;
  metadata: JsonObject;
};

export type TerminalGenerationProjectionRepairMetrics = {
  scanned: number;
  repaired: number;
  skipped: number;
};

type TerminalGenerationProjectionAssociationFailureStage = "generation" | "media";

type TerminalGenerationProjectionAssociationFailure = {
  stage: TerminalGenerationProjectionAssociationFailureStage;
  userId: string;
  projectId: string;
  generationId: string;
  mediaFileIds?: string[];
  error: unknown;
};

const OPTIONAL_GENERATION_PROJECTION_COLUMNS = [
  "workspace_runtime_key",
  "workflow_reload",
  "save_error",
  "display_title",
  "error_payload",
] as const;

type OptionalGenerationProjectionColumn = (typeof OPTIONAL_GENERATION_PROJECTION_COLUMNS)[number];

const resolveMissingOptionalProjectionColumn = (
  error: unknown
): OptionalGenerationProjectionColumn | null => {
  if (!error || typeof error !== "object") return null;
  const code =
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;
  if (code !== "42703" && code !== "PGRST204") return null;
  const message = toErrorMessage(error, "").toLowerCase();
  if (!message.includes("generation_projection")) return null;
  return OPTIONAL_GENERATION_PROJECTION_COLUMNS.find((column) => message.includes(column)) ?? null;
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
    projectId: asString(row.project_id),
    workspaceRuntimeKey: asString(row.workspace_runtime_key),
    sourceRef: asString(row.source_ref),
    requestId: asString(row.request_id),
    provider: asString(row.provider),
    providerRequestId: asString(row.provider_request_id),
    latestAttemptId: asString(row.latest_attempt_id),
    displayPrompt: asString(row.display_prompt),
    displayTitle: asString(row.display_title),
    transcriptText: asString(row.transcript_text),
    modelId: asString(row.model_id),
    hiddenInReferenceGrid: asBoolean(row.hidden_in_reference_grid) ?? false,
    referenceGridVisible: asBoolean(row.reference_grid_visible),
    generationReplay: asObject(row.generation_replay),
    workflowReload: asObject(row.workflow_reload),
    characterContext: asObject(row.character_context),
    styleContext: asObject(row.style_context),
    startedAt: asString(row.started_at),
    taskState: asString(row.task_state),
    publicationState: asString(row.publication_state),
    repairReason: "stale_projection",
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
    errorMessage: asString(row.error_message),
    completedAt: asString(row.completed_at),
    createdAt: asString(row.created_at),
    metadata: asObject(row.metadata),
  };
};

const readMetadataObject = (metadata: JsonObject, ...keys: string[]): JsonObject => {
  for (const key of keys) {
    const value = metadata[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonObject;
    }
  }
  return {};
};

const readRepairProjectIdFromMetadata = (metadata: JsonObject): string | null =>
  readGenerationProjectIdFromContext(metadata) ??
  readGenerationProjectIdFromContext(
    readMetadataObject(metadata, "shortpulse_context", "shortpulseContext")
  );

const isTerminalProjectionTaskState = (value: string | null): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "success" || normalized === "fail";
};

const resolveRepairProjectId = ({
  generation,
  projection,
}: {
  generation: RepairableGenerationRow;
  projection: RepairableProjectionRow | null;
}): string | null => projection?.projectId ?? readRepairProjectIdFromMetadata(generation.metadata);

const resolveRepairWorkspaceRuntimeKey = ({
  generation,
  projection,
}: {
  generation: RepairableGenerationRow;
  projection: RepairableProjectionRow | null;
}): string | null =>
  projection?.workspaceRuntimeKey ??
  readGenerationWorkspaceRuntimeKeyFromMetadata(generation.metadata);

const resolveRepairSourceRef = ({
  generation,
  projection,
}: {
  generation: RepairableGenerationRow;
  projection: RepairableProjectionRow | null;
}): string | null => projection?.sourceRef ?? asString(generation.metadata.source_ref);

const buildRepairProjectionFallback = ({
  generation,
  projection,
}: {
  generation: RepairableGenerationRow;
  projection: RepairableProjectionRow | null;
}): RepairableProjectionRow => {
  const metadata = generation.metadata;
  return {
    generationId: generation.generationId,
    userId: generation.userId,
    projectId: readRepairProjectIdFromMetadata(metadata),
    workspaceRuntimeKey: readGenerationWorkspaceRuntimeKeyFromMetadata(metadata),
    sourceRef: asString(metadata.source_ref),
    requestId: generation.requestId,
    provider: generation.provider,
    providerRequestId: generation.requestId,
    latestAttemptId: null,
    displayPrompt: generation.promptText,
    displayTitle: null,
    transcriptText: null,
    modelId: generation.modelId,
    hiddenInReferenceGrid: false,
    referenceGridVisible: true,
    generationReplay: readMetadataObject(metadata, "generation_replay", "generationReplay"),
    workflowReload: readMetadataObject(metadata, "workflow_reload", "workflowReload"),
    characterContext: readMetadataObject(metadata, "character_context", "characterContext"),
    styleContext: readMetadataObject(metadata, "style_context", "styleContext"),
    startedAt: generation.createdAt,
    taskState: projection?.taskState ?? null,
    publicationState: projection?.publicationState ?? null,
    repairReason: "generation_fallback",
  };
};

const readRepairableProjectionRowsWithFallback = async ({
  selectColumns,
  runSelect,
}: {
  selectColumns: readonly string[];
  runSelect: (columns: readonly string[]) => Promise<{ data: unknown; error: unknown }>;
}): Promise<RepairableProjectionRow[]> => {
  let activeColumns = [...selectColumns];
  const omittedOptionalColumns = new Set<OptionalGenerationProjectionColumn>();
  while (true) {
    const response = await runSelect(activeColumns);
    const missingColumn = resolveMissingOptionalProjectionColumn(response.error);
    if (!response.error) {
      return Array.isArray(response.data)
        ? response.data
            .map((row) => parseRepairableProjectionRow(row))
            .filter((row): row is RepairableProjectionRow => Boolean(row))
        : [];
    }
    if (
      !missingColumn ||
      omittedOptionalColumns.has(missingColumn) ||
      !activeColumns.includes(missingColumn)
    ) {
      throw response.error;
    }
    omittedOptionalColumns.add(missingColumn);
    activeColumns = activeColumns.filter((column) => column !== missingColumn);
  }
};

const loadRepairableProjectionRowsByGenerationIds = async ({
  adminClient,
  generationIds,
  selectColumns,
}: {
  adminClient: ReturnType<typeof getSupabaseAdmin>;
  generationIds: string[];
  selectColumns: readonly string[];
}): Promise<RepairableProjectionRow[]> => {
  if (!generationIds.length) return [];
  return await readRepairableProjectionRowsWithFallback({
    selectColumns,
    runSelect: async (columns) =>
      await adminClient
        .from("generation_projection")
        .select(columns.join(", "))
        .in("generation_id", generationIds),
  });
};

const readFailedProjectionMessage = (
  failureReasonCode: string | null,
  providerErrorMessage?: string | null
): {
  errorMessage: string;
  errorMessageShort: string;
  errorDetail: string;
} => {
  const normalizedProviderErrorMessage = asString(providerErrorMessage);
  if (failureReasonCode === "provider_error" && normalizedProviderErrorMessage) {
    return {
      errorMessage: normalizedProviderErrorMessage,
      errorMessageShort: normalizedProviderErrorMessage,
      errorDetail: normalizedProviderErrorMessage,
    };
  }
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
  projectId,
  workspaceRuntimeKey,
  sourceRef,
  requestId,
  provider,
  providerRequestId,
  latestAttemptId,
  status,
  taskState,
  queueState,
  displayPrompt,
  displayTitle,
  transcriptText,
  modelId,
  previewUrl,
  previewStoragePath,
  fullStoragePath,
  companionArtStatus,
  companionArtStoragePath,
  companionArtAttemptCount,
  errorMessage,
  errorMessageShort,
  errorDetail,
  errorPayload,
  saveState,
  saveError,
  hiddenInReferenceGrid,
  referenceGridVisible,
  publicationState,
  resultUrls,
  savedMediaIds,
  generationReplay,
  workflowReload,
  characterContext,
  styleContext,
  startedAt,
  completedAt,
}: UpsertGenerationProjectionInput): Promise<void> => {
  const payload: Record<string, unknown> = {
    generation_id: generationId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (resultUrls !== undefined) payload.result_urls = resultUrls;
  if (savedMediaIds !== undefined) payload.saved_media_ids = savedMediaIds;
  if (generationReplay !== undefined) payload.generation_replay = generationReplay;
  if (workflowReload !== undefined) payload.workflow_reload = workflowReload;
  if (characterContext !== undefined) payload.character_context = characterContext;
  if (styleContext !== undefined) payload.style_context = styleContext;

  const stringFields: Record<string, string | null | undefined> = {
    project_id: projectId,
    workspace_runtime_key: workspaceRuntimeKey,
    source_ref: sourceRef,
    request_id: requestId,
    provider,
    provider_request_id: providerRequestId,
    latest_attempt_id: latestAttemptId,
    status,
    task_state: taskState,
    queue_state: queueState,
    display_prompt: displayPrompt,
    display_title: displayTitle,
    transcript_text: transcriptText,
    model_id: modelId,
    preview_url: previewUrl,
    preview_storage_path: previewStoragePath,
    full_storage_path: fullStoragePath,
    companion_art_status: companionArtStatus,
    companion_art_storage_path: companionArtStoragePath,
    error_message: errorMessage,
    error_message_short: errorMessageShort,
    error_detail: errorDetail,
    save_state: saveState,
    save_error: saveError,
    publication_state: publicationState,
    started_at: startedAt,
    completed_at: completedAt,
  };

  if (errorPayload !== undefined) {
    payload.error_payload = errorPayload;
  } else if (taskState === "success") {
    payload.error_payload = null;
  }

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

  if (saveError === undefined && taskState === "success") {
    payload.save_error = null;
  }

  if (typeof hiddenInReferenceGrid === "boolean") {
    payload.hidden_in_reference_grid = hiddenInReferenceGrid;
  }
  if (typeof referenceGridVisible === "boolean") {
    payload.reference_grid_visible = referenceGridVisible;
  }
  if (typeof companionArtAttemptCount === "number" && Number.isFinite(companionArtAttemptCount)) {
    payload.companion_art_attempt_count = Math.max(0, Math.trunc(companionArtAttemptCount));
  }

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const runUpsert = async (nextPayload: Record<string, unknown>) => {
    const { error } = await adminClient.from("generation_projection").upsert(nextPayload, {
      onConflict: "generation_id",
    });
    if (error) throw error;
  };

  const fallbackPayload = { ...payload };
  const omittedOptionalColumns = new Set<OptionalGenerationProjectionColumn>();
  while (true) {
    try {
      await runUpsert({ ...fallbackPayload });
      return;
    } catch (error) {
      const missingColumn = resolveMissingOptionalProjectionColumn(error);
      if (
        !missingColumn ||
        omittedOptionalColumns.has(missingColumn) ||
        !(missingColumn in fallbackPayload)
      ) {
        throw error;
      }
      omittedOptionalColumns.add(missingColumn);
      delete fallbackPayload[missingColumn];
    }
  }
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
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();

  const readByColumn = async (column: "request_id" | "provider_request_id") => {
    const { data, error } = await adminClient
      .from("generation_projection")
      .select(
        "generation_id, result_urls, publication_state, status, task_state, queue_state, error_message_short, error_detail, error_payload, save_state, save_error, updated_at"
      )
      .eq("user_id", userId)
      .eq(column, requestId)
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
        publicationState: asString(row.publication_state),
        status: asString(row.status),
        taskState: asString(row.task_state),
        queueState: asString(row.queue_state),
        errorMessageShort: asString(row.error_message_short),
        errorDetail: asString(row.error_detail),
        errorPayload: row.error_payload ?? null,
        saveState: asString(row.save_state),
        saveError: asString(row.save_error),
      };
    }

    return null;
  };

  return (await readByColumn("request_id")) ?? (await readByColumn("provider_request_id"));
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
        "error_payload",
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
    errorPayload: row.error_payload ?? null,
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
  onAssociationFailure,
}: {
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
  limit?: number;
  minAgeSeconds?: number;
  now?: Date;
  onAssociationFailure?: (
    failure: TerminalGenerationProjectionAssociationFailure
  ) => Promise<void> | void;
}): Promise<TerminalGenerationProjectionRepairMetrics> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const cutoffIso = new Date(now.getTime() - Math.max(0, minAgeSeconds) * 1000).toISOString();

  const repairSelectColumns = [
    "generation_id",
    "user_id",
    "project_id",
    "workspace_runtime_key",
    "source_ref",
    "request_id",
    "provider",
    "provider_request_id",
    "latest_attempt_id",
    "display_prompt",
    "display_title",
    "transcript_text",
    "model_id",
    "hidden_in_reference_grid",
    "reference_grid_visible",
    "generation_replay",
    "workflow_reload",
    "character_context",
    "style_context",
    "started_at",
    "task_state",
    "publication_state",
  ];
  const projectionRows = await readRepairableProjectionRowsWithFallback({
    selectColumns: repairSelectColumns,
    runSelect: async (columns) =>
      await adminClient
        .from("generation_projection")
        .select(columns.join(", "))
        .in("task_state", ["pending", "running"])
        .lte("updated_at", cutoffIso)
        .order("updated_at", { ascending: true })
        .limit(limit),
  });
  const existingProjectionIds = new Set(projectionRows.map((row) => row.generationId));
  const remainingTerminalGenerationLimit = Math.max(0, limit - projectionRows.length);
  if (remainingTerminalGenerationLimit > 0) {
    const terminalScanPageSize = remainingTerminalGenerationLimit;
    const terminalScanMaxRows = Math.max(terminalScanPageSize, Math.min(250, limit * 10));
    let terminalScanOffset = 0;
    while (projectionRows.length < limit && terminalScanOffset < terminalScanMaxRows) {
      const terminalGenerationResponse = await adminClient
        .from("ai_generations")
        .select(
          "id, user_id, request_id, provider, model_id, prompt_text, status, failure_reason_code, error_message, completed_at, created_at, metadata"
        )
        .in("status", ["success", "fail"])
        .lte("completed_at", cutoffIso)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .range(terminalScanOffset, terminalScanOffset + terminalScanPageSize - 1);
      if (terminalGenerationResponse.error) throw terminalGenerationResponse.error;

      const terminalGenerations = Array.isArray(terminalGenerationResponse.data)
        ? terminalGenerationResponse.data
            .map((row) => parseRepairableGenerationRow(row))
            .filter((row): row is RepairableGenerationRow => Boolean(row))
            .filter((row) => !existingProjectionIds.has(row.generationId))
        : [];
      if (!terminalGenerations.length) {
        if (
          !Array.isArray(terminalGenerationResponse.data) ||
          terminalGenerationResponse.data.length < terminalScanPageSize
        ) {
          break;
        }
        terminalScanOffset += terminalScanPageSize;
        continue;
      }

      const projectionByGenerationId = new Map(
        (
          await loadRepairableProjectionRowsByGenerationIds({
            adminClient,
            generationIds: terminalGenerations.map((row) => row.generationId),
            selectColumns: repairSelectColumns,
          })
        ).map((row) => [row.generationId, row])
      );
      const remainingSlots = Math.max(0, limit - projectionRows.length);
      projectionRows.push(
        ...terminalGenerations
          .filter((generation) => {
            const projection = projectionByGenerationId.get(generation.generationId) ?? null;
            if (!projection || !isTerminalProjectionTaskState(projection.taskState)) return true;
            return (
              !projection.projectId && Boolean(readRepairProjectIdFromMetadata(generation.metadata))
            );
          })
          .map((generation) => {
            const projection = projectionByGenerationId.get(generation.generationId) ?? null;
            if (projection && isTerminalProjectionTaskState(projection.taskState)) {
              return {
                ...projection,
                repairReason: "project_scope_backfill" as const,
              };
            }
            return buildRepairProjectionFallback({
              generation,
              projection,
            });
          })
          .slice(0, remainingSlots)
      );
      if (
        !Array.isArray(terminalGenerationResponse.data) ||
        terminalGenerationResponse.data.length < terminalScanPageSize
      ) {
        break;
      }
      terminalScanOffset += terminalScanPageSize;
    }
  }

  if (!projectionRows.length) {
    return { scanned: 0, repaired: 0, skipped: 0 };
  }

  const generationResponse = await adminClient
    .from("ai_generations")
    .select(
      "id, user_id, request_id, provider, model_id, prompt_text, status, failure_reason_code, error_message, completed_at, created_at, metadata"
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
      (generation.status !== "fail" && generation.status !== "success") ||
      !generation.completedAt
    ) {
      skipped += 1;
      continue;
    }

    if (generation.status === "success") {
      const projectId = resolveRepairProjectId({ generation, projection });
      if (projection.repairReason === "project_scope_backfill" && !projectId) {
        skipped += 1;
        continue;
      }
      const workspaceRuntimeKey = resolveRepairWorkspaceRuntimeKey({ generation, projection });
      const sourceRef = resolveRepairSourceRef({ generation, projection });
      const outputRows = await readPersistedGenerationOutputs({
        generationId: projection.generationId,
        userId: projection.userId,
        supabaseAdmin: adminClient,
      });
      if (!outputRows.length) {
        skipped += 1;
        continue;
      }

      const resultUrls = outputRows.map((row) => row.resultUrl);
      const savedMediaIds = outputRows
        .map((row) => asString(row.mediaFileId))
        .filter((mediaFileId): mediaFileId is string => Boolean(mediaFileId));
      const deliveryPathsByMediaId = await readMediaDeliveryPathsById({
        supabaseAdmin: adminClient,
        userId: projection.userId,
        mediaFileIds: savedMediaIds,
      });
      const verifiedSavedMediaIds = savedMediaIds.filter((mediaFileId) =>
        deliveryPathsByMediaId.has(mediaFileId)
      );
      const allOutputsOwned =
        outputRows.length > 0 &&
        outputRows.every(
          (row) =>
            typeof row.mediaFileId === "string" && deliveryPathsByMediaId.has(row.mediaFileId)
        );
      const hasDisplayableResultMedia = resultUrls.length > 0;
      const preservesSuppressedPublication =
        projection.publicationState?.toLowerCase() === "suppressed";
      const publicationState = preservesSuppressedPublication
        ? "suppressed"
        : allOutputsOwned
          ? "published"
          : "suppressed";
      const referenceGridVisible =
        preservesSuppressedPublication && projection.referenceGridVisible === false
          ? false
          : hasDisplayableResultMedia && !projection.hiddenInReferenceGrid;

      await upsertGenerationProjection({
        supabaseAdmin: adminClient,
        generationId: projection.generationId,
        userId: projection.userId,
        projectId,
        workspaceRuntimeKey,
        sourceRef,
        requestId: projection.requestId ?? generation.requestId,
        provider: projection.provider ?? generation.provider,
        providerRequestId: projection.providerRequestId ?? generation.requestId,
        latestAttemptId: projection.latestAttemptId,
        status: "ready",
        taskState: "success",
        displayPrompt: projection.displayPrompt ?? generation.promptText,
        displayTitle: projection.displayTitle,
        transcriptText: projection.transcriptText,
        modelId: projection.modelId ?? generation.modelId,
        previewUrl: resultUrls[0] ?? null,
        errorMessage: null,
        errorMessageShort: null,
        errorDetail: null,
        saveState: "idle",
        hiddenInReferenceGrid: projection.hiddenInReferenceGrid,
        referenceGridVisible,
        publicationState,
        resultUrls,
        savedMediaIds: allOutputsOwned ? verifiedSavedMediaIds : [],
        generationReplay: projection.generationReplay,
        workflowReload: projection.workflowReload,
        characterContext: projection.characterContext,
        styleContext: projection.styleContext,
        startedAt: projection.startedAt,
        completedAt: generation.completedAt,
      });
      await Promise.all(
        outputRows.map(async (row) => {
          if (!row.id) return;
          const deliveryPaths = row.mediaFileId
            ? (deliveryPathsByMediaId.get(row.mediaFileId) ?? null)
            : null;
          await upsertGenerationPublication({
            generationId: projection.generationId,
            generationOutputId: row.id,
            userId: projection.userId,
            supabaseAdmin: adminClient,
            generationAttemptId: projection.latestAttemptId,
            publicationState,
            ownedMediaFileId: row.mediaFileId,
            previewUrl: row.outputIndex === 0 ? row.resultUrl : null,
            fullUrl: row.resultUrl,
            previewStoragePath: deliveryPaths?.previewStoragePath ?? null,
            fullStoragePath: deliveryPaths?.fullStoragePath ?? null,
            publishedAt: generation.completedAt,
            visibleInReferenceGrid: publicationState === "published" && referenceGridVisible,
            metadata: {
              projection_repair: true,
              provider_request_id: projection.providerRequestId ?? generation.requestId,
            },
          });
        })
      );
      if (projectId) {
        await associateGenerationWithProjectForUser({
          userId: projection.userId,
          projectId,
          generationId: projection.generationId,
        }).catch(async (error) => {
          await onAssociationFailure?.({
            stage: "generation",
            userId: projection.userId,
            projectId,
            generationId: projection.generationId,
            error,
          });
          return false;
        });
        if (verifiedSavedMediaIds.length > 0) {
          await associateMediaFilesWithProjectForUser({
            userId: projection.userId,
            projectId,
            mediaFileIds: verifiedSavedMediaIds,
          }).catch(async (error) => {
            await onAssociationFailure?.({
              stage: "media",
              userId: projection.userId,
              projectId,
              generationId: projection.generationId,
              mediaFileIds: verifiedSavedMediaIds,
              error,
            });
            return false;
          });
        }
      }
      repaired += 1;
      continue;
    }

    const projectId = resolveRepairProjectId({ generation, projection });
    if (projection.repairReason === "project_scope_backfill" && !projectId) {
      skipped += 1;
      continue;
    }
    const workspaceRuntimeKey = resolveRepairWorkspaceRuntimeKey({ generation, projection });
    const sourceRef = resolveRepairSourceRef({ generation, projection });
    const message = readFailedProjectionMessage(
      generation.failureReasonCode,
      generation.errorMessage
    );
    await upsertGenerationProjection({
      supabaseAdmin: adminClient,
      generationId: projection.generationId,
      userId: projection.userId,
      projectId,
      workspaceRuntimeKey,
      sourceRef,
      requestId: projection.requestId ?? generation.requestId,
      provider: projection.provider ?? generation.provider,
      providerRequestId: projection.providerRequestId ?? generation.requestId,
      latestAttemptId: projection.latestAttemptId,
      status: "ready",
      taskState: "fail",
      displayPrompt: projection.displayPrompt ?? generation.promptText,
      displayTitle: projection.displayTitle,
      transcriptText: projection.transcriptText,
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
      workflowReload: projection.workflowReload,
      characterContext: projection.characterContext,
      styleContext: projection.styleContext,
      startedAt: projection.startedAt,
      completedAt: generation.completedAt,
    });
    if (projectId) {
      await associateGenerationWithProjectForUser({
        userId: projection.userId,
        projectId,
        generationId: projection.generationId,
      }).catch(async (error) => {
        await onAssociationFailure?.({
          stage: "generation",
          userId: projection.userId,
          projectId,
          generationId: projection.generationId,
          error,
        });
        return false;
      });
    }
    repaired += 1;
  }

  return {
    scanned: projectionRows.length,
    repaired,
    skipped,
  };
};
