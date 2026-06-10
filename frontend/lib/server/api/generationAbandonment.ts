import { getSupabaseAdmin } from "./supabaseAdmin";
import { recordGenerationVisibilitySuppression } from "./generationVisibilitySuppression";

type JsonObject = Record<string, unknown>;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export type GenerationAbandonmentIdentifiers = {
  userId: string;
  sourceRef?: string | null;
  generationId?: string | null;
  requestId?: string | null;
};

export type RecordGenerationAbandonmentInput = GenerationAbandonmentIdentifiers & {
  reason?: string;
  metadata?: JsonObject;
  noRefund?: boolean;
  supabaseAdmin?: SupabaseAdmin;
};

export type GenerationAbandonmentContext = {
  abandoned: boolean;
  noRefund: boolean;
  source: "metadata" | "abandonment_row" | null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

export const isGenerationAbandonedMetadata = (metadata: unknown): boolean => {
  const record = asObject(metadata);
  return record.user_abandoned === true || record.abandoned_no_refund === true;
};

const readNoRefundFromMetadata = (metadata: unknown): boolean => {
  const record = asObject(metadata);
  if (typeof record.abandoned_no_refund === "boolean") return record.abandoned_no_refund;
  if (typeof record.no_refund === "boolean") return record.no_refund;
  return isGenerationAbandonedMetadata(record);
};

export const recordGenerationAbandonment = async ({
  userId,
  sourceRef,
  generationId,
  requestId,
  reason = "reference_grid_clear",
  metadata = {},
  noRefund = true,
  supabaseAdmin,
}: RecordGenerationAbandonmentInput): Promise<{
  abandonmentId: string | null;
  matchedGenerationIds: string[];
}> => {
  const result = await recordGenerationVisibilitySuppression({
    supabaseAdmin,
    userId,
    sourceRef,
    generationId,
    requestId,
    reason,
    metadata: {
      ...metadata,
      no_refund: noRefund,
      compatibility_route: "generation_abandonment",
    },
  });

  return {
    abandonmentId: result.suppressionId,
    matchedGenerationIds: result.matchedGenerationIds,
  };
};

export const readGenerationAbandonmentContext = async ({
  userId,
  sourceRef,
  generationId,
  requestId,
  metadata,
  supabaseAdmin,
}: GenerationAbandonmentIdentifiers & {
  metadata?: unknown;
  supabaseAdmin?: SupabaseAdmin;
}): Promise<GenerationAbandonmentContext> => {
  if (isGenerationAbandonedMetadata(metadata)) {
    return {
      abandoned: true,
      noRefund: readNoRefundFromMetadata(metadata),
      source: "metadata",
    };
  }

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const filters: Array<["source_ref" | "generation_id" | "request_id", string | null]> = [
    ["generation_id", normalizeString(generationId)],
    ["source_ref", normalizeString(sourceRef)],
    ["request_id", normalizeString(requestId)],
  ];
  for (const [column, value] of filters) {
    if (!value) continue;
    const { data, error } = await adminClient
      .from("generation_abandonments")
      .select("no_refund")
      .eq("user_id", userId)
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error || !data || typeof data !== "object" || Array.isArray(data)) continue;
    const noRefund = (data as Record<string, unknown>).no_refund;
    return {
      abandoned: true,
      noRefund: typeof noRefund === "boolean" ? noRefund : true,
      source: "abandonment_row",
    };
  }

  return { abandoned: false, noRefund: false, source: null };
};
