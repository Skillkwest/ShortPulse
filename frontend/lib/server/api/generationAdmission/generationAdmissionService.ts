/**
 * Generation admission service (IO layer).
 * Reads active reservation state and returns submit admission decisions.
 */
import {
  DEFAULT_GENERATION_ADMISSION_TIER_LIMITS,
  evaluateGenerationAdmissionDecision,
} from "./generationAdmissionPolicy";
import type { GenerationAdmissionConfig, GenerationAdmissionDecision } from "./types";
import {
  DEFAULT_GENERATION_ADMISSION_TIER,
  resolveGenerationAdmissionTier,
} from "../../../model-runtime/generationAdmissionTiers";
import { getSupabaseAdmin } from "../supabaseAdmin";

const ACTIVE_RESERVATION_STATUS = "reserved";

const asModelId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readActiveReservationModelIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_credit_reservations")
    .select("model_id")
    .eq("user_id", userId)
    .eq("status", ACTIVE_RESERVATION_STATUS);
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const modelIds: string[] = [];
  for (const row of rows) {
    const record =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : null;
    if (!record) continue;
    const modelId = asModelId(record.model_id);
    if (modelId) modelIds.push(modelId);
  }
  return modelIds;
};

/**
 * Evaluates whether a user/model submit should be admitted at this moment.
 */
export const evaluateUserGenerationAdmission = async ({
  userId,
  modelId,
  config,
}: {
  userId: string;
  modelId: string;
  config: GenerationAdmissionConfig;
}): Promise<GenerationAdmissionDecision> => {
  const tier = resolveGenerationAdmissionTier(modelId) ?? DEFAULT_GENERATION_ADMISSION_TIER;
  const fallbackTierMax = DEFAULT_GENERATION_ADMISSION_TIER_LIMITS[tier];
  const tierMax = config.tierLimits[tier] ?? fallbackTierMax;

  if (config.mode === "off") {
    return evaluateGenerationAdmissionDecision({
      mode: config.mode,
      retryAfterSeconds: config.retryAfterSeconds,
      snapshot: {
        globalActive: 0,
        globalMax: config.globalMax,
        tier,
        tierActive: 0,
        tierMax,
      },
    });
  }

  const activeModelIds = await readActiveReservationModelIds(userId);
  const tierActive = activeModelIds.filter(
    (candidateModelId) => resolveGenerationAdmissionTier(candidateModelId) === tier
  ).length;

  return evaluateGenerationAdmissionDecision({
    mode: config.mode,
    retryAfterSeconds: config.retryAfterSeconds,
    snapshot: {
      globalActive: activeModelIds.length,
      globalMax: config.globalMax,
      tier,
      tierActive,
      tierMax,
    },
  });
};
