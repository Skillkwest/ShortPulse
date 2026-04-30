/**
 * Generation admission service (IO layer).
 * Reads active provider-attached capacity state and returns submit admission decisions.
 */
import {
  DEFAULT_GENERATION_ADMISSION_TIER_LIMITS,
  evaluateGenerationAdmissionDecision,
} from "./generationAdmissionPolicy";
import type {
  GenerationAdmissionConfig,
  GenerationAdmissionDecision,
  GenerationAdmissionSnapshot,
} from "./types";
import {
  DEFAULT_GENERATION_ADMISSION_TIER,
  resolveGenerationAdmissionTier,
} from "../../../model-runtime/generationAdmissionTiers";
import {
  readActiveProviderCapacitySnapshot,
  type ActiveProviderCapacitySnapshot,
} from "./activeProviderCapacity";
import { resolveProviderFromModelId } from "../../providerIntegration/providerRuntimeConfig";
import {
  readRecoveryBackpressureDecision,
  type RecoveryBackpressureDecision,
} from "./recoveryBackpressure";

export type ScopedGenerationAdmissionDecision = {
  decision: GenerationAdmissionDecision;
  capacitySnapshot: ActiveProviderCapacitySnapshot;
  backpressure: RecoveryBackpressureDecision | null;
};

const buildOffModeSnapshot = ({
  modelId,
  globalMax,
  tierLimits,
}: {
  modelId: string;
  globalMax: number;
  tierLimits: GenerationAdmissionConfig["tierLimits"];
}): GenerationAdmissionSnapshot => {
  const tier = resolveGenerationAdmissionTier(modelId) ?? DEFAULT_GENERATION_ADMISSION_TIER;
  const fallbackTierMax = DEFAULT_GENERATION_ADMISSION_TIER_LIMITS[tier];
  return {
    globalActive: 0,
    globalMax,
    tier,
    tierActive: 0,
    tierMax: tierLimits[tier] ?? fallbackTierMax,
  };
};

/**
 * Evaluates whether a scoped provider-attached submit should be admitted at this moment.
 */
export const evaluateScopedGenerationAdmission = async ({
  scopeUserId,
  provider,
  modelId,
  config,
  globalMax,
  staleIgnoreMinAgeSeconds,
  activeGenerationStaleIgnoreMinAgeSeconds,
  orphanGraceSeconds,
}: {
  scopeUserId?: string | null;
  provider: string;
  modelId: string;
  config: GenerationAdmissionConfig;
  globalMax: number;
  staleIgnoreMinAgeSeconds: number;
  activeGenerationStaleIgnoreMinAgeSeconds: number;
  orphanGraceSeconds: number;
}): Promise<ScopedGenerationAdmissionDecision> => {
  const offModeSnapshot = buildOffModeSnapshot({
    modelId,
    globalMax,
    tierLimits: config.tierLimits,
  });

  if (config.mode === "off") {
    return {
      decision: evaluateGenerationAdmissionDecision({
        mode: config.mode,
        retryAfterSeconds: config.retryAfterSeconds,
        snapshot: offModeSnapshot,
      }),
      capacitySnapshot: {
        tier: offModeSnapshot.tier,
        globalActive: 0,
        tierActive: 0,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      },
      backpressure: null,
    };
  }

  const backpressure =
    scopeUserId == null && config.sharedProviderEnabled
      ? await readRecoveryBackpressureDecision({
          provider,
          requestedGlobalMax: globalMax,
        })
      : null;
  const effectiveGlobalMax = backpressure?.effectiveGlobalMax ?? globalMax;
  const capacitySnapshot = await readActiveProviderCapacitySnapshot({
    userId: scopeUserId,
    provider,
    modelId,
    staleIgnoreMinAgeSeconds,
    activeGenerationStaleIgnoreMinAgeSeconds,
    orphanGraceSeconds,
  });

  const tierMax =
    config.tierLimits[capacitySnapshot.tier] ??
    DEFAULT_GENERATION_ADMISSION_TIER_LIMITS[capacitySnapshot.tier];

  return {
    decision: evaluateGenerationAdmissionDecision({
      mode: config.mode,
      retryAfterSeconds: config.retryAfterSeconds,
      snapshot: {
        globalActive: capacitySnapshot.globalActive + 1,
        globalMax: effectiveGlobalMax,
        tier: capacitySnapshot.tier,
        tierActive: capacitySnapshot.tierActive + 1,
        tierMax,
      },
    }),
    capacitySnapshot,
    backpressure,
  };
};

/**
 * Evaluates whether a user/model submit should be admitted at this moment.
 */
export const evaluateUserGenerationAdmission = async ({
  userId,
  modelId,
  config,
  provider = resolveProviderFromModelId({ modelId }),
  staleIgnoreMinAgeSeconds = 0,
  activeGenerationStaleIgnoreMinAgeSeconds = 0,
  orphanGraceSeconds = 0,
}: {
  userId: string;
  modelId: string;
  config: GenerationAdmissionConfig;
  provider?: string;
  staleIgnoreMinAgeSeconds?: number;
  activeGenerationStaleIgnoreMinAgeSeconds?: number;
  orphanGraceSeconds?: number;
}): Promise<GenerationAdmissionDecision> =>
  (
    await evaluateScopedGenerationAdmission({
      scopeUserId: userId,
      provider,
      modelId,
      config,
      globalMax: config.globalMax,
      staleIgnoreMinAgeSeconds,
      activeGenerationStaleIgnoreMinAgeSeconds,
      orphanGraceSeconds,
    })
  ).decision;
