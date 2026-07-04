/**
 * Error-payload hydration for generated media projection rows.
 */
import type { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import type { StudioOutput } from "../types";
import {
  resolveMissingGenerationProjectionOptionalColumn,
  type GenerationProjectionDeliveryRow,
} from "./generationProjectionDeliveryColumns";

type SupabaseClient = ReturnType<typeof ensureSupabaseQueryClient>;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const shouldHydrateGeneratedOutputErrorPayload = (output: StudioOutput): boolean =>
  output.taskState === "fail" && Boolean(output.generationId);

export const hydrateGeneratedOutputErrorPayloads = async ({
  supabase,
  userId,
  outputs,
}: {
  supabase: SupabaseClient;
  userId: string;
  outputs: StudioOutput[];
}): Promise<StudioOutput[]> => {
  const generationIds = Array.from(
    new Set(
      outputs
        .filter(shouldHydrateGeneratedOutputErrorPayload)
        .map((output) => asTrimmedString(output.generationId))
        .filter((generationId): generationId is string => Boolean(generationId))
    )
  );
  if (generationIds.length === 0) return outputs;

  const { data, error } = await supabase
    .from("generation_projection")
    .select("generation_id, error_payload")
    .eq("user_id", userId)
    .in("generation_id", generationIds);
  if (resolveMissingGenerationProjectionOptionalColumn(error) === "error_payload") return outputs;
  if (error || !Array.isArray(data)) return outputs;

  const errorPayloadByGenerationId = new Map<string, unknown>();
  data.forEach((row) => {
    const record =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as GenerationProjectionDeliveryRow)
        : null;
    const generationId = asTrimmedString(record?.generation_id);
    if (!generationId || errorPayloadByGenerationId.has(generationId)) return;
    errorPayloadByGenerationId.set(generationId, record?.error_payload ?? null);
  });
  if (errorPayloadByGenerationId.size === 0) return outputs;

  return outputs.map((output) => {
    const generationId = asTrimmedString(output.generationId);
    if (!generationId || !errorPayloadByGenerationId.has(generationId)) return output;
    const errorPayload = errorPayloadByGenerationId.get(generationId) ?? null;
    if (output.errorPayload === errorPayload) return output;
    return {
      ...output,
      errorPayload,
    };
  });
};
