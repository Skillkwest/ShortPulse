import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type PersistGenerationOutputsInput = {
  generationId: string;
  userId: string;
  providerRequestId?: string | null;
  resultUrls: string[];
  mediaFileIds?: string[];
  metadata?: JsonObject;
};

export type PersistedGenerationOutputRow = {
  outputIndex: number;
  resultUrl: string;
  mediaFileId: string | null;
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
  providerRequestId,
  resultUrls,
  mediaFileIds = [],
  metadata = {},
}: PersistGenerationOutputsInput): Promise<void> => {
  if (!resultUrls.length) return;

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

  if (!rows.length) return;

  const { error } = await getSupabaseAdmin()
    .from("ai_generation_outputs")
    .upsert(rows, { onConflict: "generation_id,output_index" });
  if (error) {
    throw error;
  }
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
    .select("output_index, result_url, media_file_id")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .order("output_index", { ascending: true })
    .limit(50);
  if (error || !Array.isArray(data)) return [];

  const rows = data
    .map((row) => {
      const record = asObject(row);
      const outputIndex = asOutputIndex(record.output_index);
      const resultUrl = asString(record.result_url);
      if (outputIndex === null || !resultUrl) return null;
      return {
        outputIndex,
        resultUrl,
        mediaFileId: asString(record.media_file_id),
      };
    })
    .filter((row): row is PersistedGenerationOutputRow => Boolean(row));

  return rows.sort((left, right) => left.outputIndex - right.outputIndex);
};
