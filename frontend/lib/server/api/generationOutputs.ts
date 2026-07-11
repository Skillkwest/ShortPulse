import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type PersistGenerationOutputsInput = {
  generationId: string;
  userId: string;
  generationAttemptId?: string | null;
  providerRequestId?: string | null;
  resultUrls: string[];
  mediaFileIds?: string[];
  metadata?: JsonObject;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
};

export type PersistedGenerationOutputRow = {
  id: string | undefined;
  outputIndex: number;
  resultUrl: string;
  mediaFileId: string | null;
  metadata: JsonObject;
};

export type GenerationOutputVisibilityMetadataKey =
  | "direct_terminal_visibility_state"
  | "recovery_visibility_state";

const hasExpectedMediaFileAttachments = ({
  persistedRows,
  expectedMediaFileIds,
}: {
  persistedRows: PersistedGenerationOutputRow[];
  expectedMediaFileIds: Array<string | null>;
}): boolean => {
  const expectedEntries = expectedMediaFileIds
    .map((mediaFileId, outputIndex) => ({ outputIndex, mediaFileId: asString(mediaFileId) }))
    .filter((entry): entry is { outputIndex: number; mediaFileId: string } =>
      Boolean(entry.mediaFileId)
    );
  if (!expectedEntries.length) {
    return true;
  }

  const persistedRowsByOutputIndex = new Map(
    persistedRows.map((row) => [row.outputIndex, row.mediaFileId] as const)
  );

  return expectedEntries.every(
    ({ outputIndex, mediaFileId }) => persistedRowsByOutputIndex.get(outputIndex) === mediaFileId
  );
};

const normalizePersistedGenerationOutputRows = (data: unknown): PersistedGenerationOutputRow[] => {
  if (!Array.isArray(data)) return [];

  const rows = data
    .map((row) => {
      const record = asObject(row);
      const outputIndex = asOutputIndex(record.output_index);
      const resultUrl = asString(record.result_url);
      if (outputIndex === null || !resultUrl) return null;
      return {
        id: asString(record.id) ?? undefined,
        outputIndex,
        resultUrl,
        mediaFileId: asString(record.media_file_id),
        metadata: asObject(record.metadata),
      };
    })
    .filter((row): row is PersistedGenerationOutputRow => Boolean(row));

  return rows.sort((left, right) => left.outputIndex - right.outputIndex);
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asOutputIndex = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

export const persistGenerationOutputRecords = async ({
  generationId,
  userId,
  generationAttemptId,
  providerRequestId,
  resultUrls,
  mediaFileIds = [],
  metadata = {},
  supabaseAdmin,
}: PersistGenerationOutputsInput): Promise<PersistedGenerationOutputRow[]> => {
  if (!resultUrls.length) return [];

  const nowIso = new Date().toISOString();
  const rows = resultUrls
    .map((resultUrl, outputIndex) => {
      const normalizedUrl = asString(resultUrl);
      if (!normalizedUrl) return null;
      const row: Record<string, unknown> = {
        generation_id: generationId,
        user_id: userId,
        output_index: outputIndex,
        result_url: normalizedUrl,
        metadata: metadata,
        updated_at: nowIso,
      };
      const normalizedGenerationAttemptId = asString(generationAttemptId);
      if (normalizedGenerationAttemptId) {
        row.generation_attempt_id = normalizedGenerationAttemptId;
      }
      const normalizedProviderRequestId = asString(providerRequestId);
      if (normalizedProviderRequestId) {
        row.provider_request_id = normalizedProviderRequestId;
      }
      const mediaFileId = asString(mediaFileIds[outputIndex]);
      if (mediaFileId) {
        row.media_file_id = mediaFileId;
      }
      return row;
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));

  if (!rows.length) return [];

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const { data, error } = await adminClient
    .from("ai_generation_outputs")
    .upsert(rows, { onConflict: "generation_id,output_index" })
    .select("id, output_index, result_url, media_file_id, metadata");
  if (error) {
    throw error;
  }

  const normalizedRows = normalizePersistedGenerationOutputRows(data);
  if (
    normalizedRows.length &&
    hasExpectedMediaFileAttachments({
      persistedRows: normalizedRows,
      expectedMediaFileIds: mediaFileIds,
    })
  ) {
    return normalizedRows;
  }

  return readPersistedGenerationOutputs({
    generationId,
    userId,
    supabaseAdmin: adminClient,
  });
};

export const readPersistedGenerationOutputs = async ({
  generationId,
  userId,
  supabaseAdmin,
}: {
  generationId: string;
  userId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<PersistedGenerationOutputRow[]> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    adminClient = getSupabaseAdmin();
  }

  const { data, error } = await adminClient
    .from("ai_generation_outputs")
    .select("id, output_index, result_url, media_file_id, metadata")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .order("output_index", { ascending: true })
    .limit(50);
  if (error || !Array.isArray(data)) return [];

  return normalizePersistedGenerationOutputRows(data);
};

export const markGenerationOutputRowsVisibilitySettled = async ({
  generationId,
  userId,
  outputRows,
  visibilityMetadataKey,
  supabaseAdmin,
}: {
  generationId: string;
  userId: string;
  outputRows: PersistedGenerationOutputRow[];
  visibilityMetadataKey: GenerationOutputVisibilityMetadataKey;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<PersistedGenerationOutputRow[]> => {
  const pendingRows = outputRows.filter(
    (row) => asObject(row.metadata)[visibilityMetadataKey] === "settlement_pending"
  );
  if (!pendingRows.length) {
    return outputRows;
  }

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  for (const row of pendingRows) {
    const metadata = {
      ...asObject(row.metadata),
      [visibilityMetadataKey]: "settled",
    };
    if (row.id) {
      const { error } = await adminClient
        .from("ai_generation_outputs")
        .update({
          metadata,
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (error) throw error;
      continue;
    }

    const { error } = await adminClient
      .from("ai_generation_outputs")
      .update({
        metadata,
        updated_at: nowIso,
      })
      .eq("generation_id", generationId)
      .eq("user_id", userId)
      .eq("output_index", row.outputIndex);
    if (error) throw error;
  }

  return readPersistedGenerationOutputs({
    generationId,
    userId,
    supabaseAdmin: adminClient,
  });
};

export const attachMediaFileToGenerationOutput = async ({
  generationId,
  userId,
  outputIndex,
  mediaFileId,
  resultUrl,
  providerRequestId,
  generationAttemptId,
  metadata = {},
  supabaseAdmin,
}: {
  generationId: string;
  userId: string;
  outputIndex: number;
  mediaFileId: string;
  resultUrl?: string | null;
  providerRequestId?: string | null;
  generationAttemptId?: string | null;
  metadata?: JsonObject;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<void> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const existingRows = await readPersistedGenerationOutputs({
    generationId,
    userId,
    supabaseAdmin: adminClient,
  });
  const existingRow = existingRows.find((row) => row.outputIndex === outputIndex);
  const nowIso = new Date().toISOString();

  if (existingRow?.id) {
    const { error } = await adminClient
      .from("ai_generation_outputs")
      .update({
        media_file_id: mediaFileId,
        updated_at: nowIso,
      })
      .eq("id", existingRow.id)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const normalizedResultUrl = asString(resultUrl);
  if (!normalizedResultUrl) return;

  const insertPayload: Record<string, unknown> = {
    generation_id: generationId,
    user_id: userId,
    output_index: outputIndex,
    result_url: normalizedResultUrl,
    media_file_id: mediaFileId,
    metadata,
    updated_at: nowIso,
  };
  const normalizedGenerationAttemptId = asString(generationAttemptId);
  if (normalizedGenerationAttemptId) {
    insertPayload.generation_attempt_id = normalizedGenerationAttemptId;
  }
  const normalizedProviderRequestId = asString(providerRequestId);
  if (normalizedProviderRequestId) {
    insertPayload.provider_request_id = normalizedProviderRequestId;
  }

  const { error } = await adminClient.from("ai_generation_outputs").insert(insertPayload);
  if (!error) return;

  const duplicateError =
    asString((error as { code?: unknown }).code) === "23505" ||
    String((error as { message?: unknown }).message ?? "")
      .toLowerCase()
      .includes("duplicate");
  if (!duplicateError) throw error;

  const fallbackRows = await readPersistedGenerationOutputs({
    generationId,
    userId,
    supabaseAdmin: adminClient,
  });
  const fallbackRow = fallbackRows.find((row) => row.outputIndex === outputIndex);
  if (!fallbackRow?.id) throw error;

  const { error: updateError } = await adminClient
    .from("ai_generation_outputs")
    .update({
      media_file_id: mediaFileId,
      updated_at: nowIso,
    })
    .eq("id", fallbackRow.id)
    .eq("user_id", userId);
  if (updateError) throw updateError;
};

/**
 * Attaches an owned media row to an owned generation output.
 * Caller identity is supplied by a verified server route; all relational
 * ownership checks happen before the service-role mutation.
 */
export const attachOwnedMediaFileToGenerationOutput = async ({
  generationId,
  userId,
  outputIndex,
  mediaFileId,
  resultUrl,
  supabaseAdmin,
}: {
  generationId: string;
  userId: string;
  outputIndex: number;
  mediaFileId: string;
  resultUrl?: string | null;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<void> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const [generationResult, mediaResult] = await Promise.all([
    adminClient
      .from("ai_generations")
      .select("id")
      .eq("id", generationId)
      .eq("user_id", userId)
      .maybeSingle(),
    adminClient
      .from("media_files")
      .select("id")
      .eq("id", mediaFileId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (generationResult.error) throw generationResult.error;
  if (mediaResult.error) throw mediaResult.error;
  if (!generationResult.data || !mediaResult.data) {
    const ownershipError = new Error("Generation output ownership could not be verified.");
    ownershipError.name = "GenerationOutputOwnershipError";
    throw ownershipError;
  }

  await attachMediaFileToGenerationOutput({
    generationId,
    userId,
    outputIndex,
    mediaFileId,
    resultUrl,
    supabaseAdmin: adminClient,
    metadata: {
      media_library_persistence: true,
      media_library_persisted_at: new Date().toISOString(),
    },
  });
};
