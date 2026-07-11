import { createHash } from "crypto";
import type { AdminPricingCustomRowsDocument } from "../../model-runtime/adminPricingCustomRows";
import {
  IncompletePublishedPricingPolicyError,
  materializeImageBilledCreditPolicy,
} from "../../model-runtime/materializeImageBilledCreditPolicy";
import { resolvePricingGridCostBreakdown } from "../../model-runtime/pricingGridBilledCredits";
import {
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../model-runtime/providerModelIds";
import {
  compactModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../model-runtime/pricingPolicy";

type PublishedRule = {
  modelId: string;
  variantId: string | null;
  billedCreditsOverride: number | null;
  billedCreditsQuantityRule: unknown | null;
};

export type ModelPricingPublicationDryRun = {
  activePolicyVersion: number;
  activePolicyVersionId: number | null;
  artifactSha256: string;
  addedRules: PublishedRule[];
  changedRules: PublishedRule[];
  removedRules: PublishedRule[];
  missingRules: Array<{ source: "catalog" | "custom"; key: string }>;
  complete: boolean;
  publishedRuleCount: number;
  candidatePolicy: ModelPricingPolicyDocument;
};

export type SeedanceCompositionNeutralMarginEnvelope = {
  modelId: string;
  resolution: string;
  outputDurationSeconds: number;
  inputVideoDurationSeconds: number;
  customerCredits: number;
  customerUsd: number;
  modeledProviderCredits: number | null;
  modeledProviderUsd: number | null;
  modeledMarginUsd: number | null;
};

export type SeedanceCompositionNeutralRateComparison = {
  modelId: string;
  resolution: string;
  continuityCostCreditsPerOutputSecond: number | null;
  equalDurationConservativeCostCreditsPerOutputSecond: number | null;
};

export type SeedanceCompositionNeutralPublicationDryRun = ModelPricingPublicationDryRun & {
  targetBillingVariantProfile: "seedance_composition_neutral_v1";
  proposedSeedanceRules: PublishedRule[];
  rateComparisons: SeedanceCompositionNeutralRateComparison[];
  marginEnvelopes: SeedanceCompositionNeutralMarginEnvelope[];
};

const stableJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = stableJsonValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
};

const stableJson = (value: unknown): string => JSON.stringify(stableJsonValue(value));

/** Returns the deterministic review hash for one compact published pricing artifact. */
export const hashModelPricingPolicyArtifact = (policy: ModelPricingPolicyDocument): string =>
  createHash("sha256")
    .update(stableJson(compactModelPricingPolicyDocument(policy)))
    .digest("hex");

const listPublishedRules = (policy: ModelPricingPolicyDocument): PublishedRule[] =>
  Object.entries(policy.perModel)
    .flatMap(([modelId, modelOverride]) => {
      const rules: PublishedRule[] = [];
      if (
        modelOverride.billedCreditsOverride != null ||
        modelOverride.billedCreditsQuantityRule != null
      ) {
        rules.push({
          modelId,
          variantId: null,
          billedCreditsOverride: modelOverride.billedCreditsOverride ?? null,
          billedCreditsQuantityRule: modelOverride.billedCreditsQuantityRule ?? null,
        });
      }
      Object.entries(modelOverride.variants ?? {}).forEach(([variantId, variantOverride]) => {
        if (
          variantOverride.billedCreditsOverride == null &&
          variantOverride.billedCreditsQuantityRule == null
        ) {
          return;
        }
        rules.push({
          modelId,
          variantId,
          billedCreditsOverride: variantOverride.billedCreditsOverride ?? null,
          billedCreditsQuantityRule: variantOverride.billedCreditsQuantityRule ?? null,
        });
      });
      return rules;
    })
    .sort((left, right) =>
      `${left.modelId}:${left.variantId ?? ""}`.localeCompare(
        `${right.modelId}:${right.variantId ?? ""}`
      )
    );

const ruleKey = (rule: PublishedRule): string => `${rule.modelId}:${rule.variantId ?? ""}`;

export const buildModelPricingPublicationDryRun = ({
  activePolicyVersion,
  activePolicyVersionId = null,
  activePolicy,
  activeCustomRows,
}: {
  activePolicyVersion: number;
  activePolicyVersionId?: number | null;
  activePolicy: ModelPricingPolicyDocument;
  activeCustomRows: AdminPricingCustomRowsDocument;
}): ModelPricingPublicationDryRun => {
  const normalizedActivePolicy = compactModelPricingPolicyDocument(activePolicy);
  const candidatePolicy = materializeImageBilledCreditPolicy(
    normalizedActivePolicy,
    activeCustomRows
  );
  let missingRules: ModelPricingPublicationDryRun["missingRules"] = [];
  try {
    materializeImageBilledCreditPolicy(normalizedActivePolicy, activeCustomRows, {
      requireComplete: true,
    });
  } catch (error) {
    if (!(error instanceof IncompletePublishedPricingPolicyError)) throw error;
    missingRules = [
      ...error.missingPublishedRows.map((key) => ({ source: "catalog" as const, key })),
      ...error.missingCustomRows.map((key) => ({ source: "custom" as const, key })),
    ].sort((left, right) =>
      `${left.source}:${left.key}`.localeCompare(`${right.source}:${right.key}`)
    );
  }
  const activeRules = listPublishedRules(normalizedActivePolicy);
  const candidateRules = listPublishedRules(candidatePolicy);
  const activeByKey = new Map(activeRules.map((rule) => [ruleKey(rule), rule]));
  const candidateByKey = new Map(candidateRules.map((rule) => [ruleKey(rule), rule]));
  const addedRules = candidateRules.filter((rule) => !activeByKey.has(ruleKey(rule)));
  const changedRules = candidateRules.filter((rule) => {
    const activeRule = activeByKey.get(ruleKey(rule));
    return activeRule != null && stableJson(activeRule) !== stableJson(rule);
  });
  const removedRules = activeRules.filter((rule) => !candidateByKey.has(ruleKey(rule)));
  const artifactSha256 = hashModelPricingPolicyArtifact(candidatePolicy);

  return {
    activePolicyVersion,
    activePolicyVersionId,
    artifactSha256,
    addedRules,
    changedRules,
    removedRules,
    missingRules,
    complete: missingRules.length === 0,
    publishedRuleCount: candidateRules.length,
    candidatePolicy,
  };
};

const SEEDANCE_TARGET_MODELS = [
  { modelId: KIE_SEEDANCE_2_MODEL_ID, resolutions: ["1080p", "720p", "480p"] },
  { modelId: KIE_SEEDANCE_2_FAST_MODEL_ID, resolutions: ["720p", "480p"] },
] as const;
const SEEDANCE_MARGIN_OUTPUT_SECONDS = [4, 5, 10, 15] as const;
const SEEDANCE_MARGIN_INPUT_SECONDS = [0, 2, 5, 10, 15] as const;

/**
 * Builds a non-mutating composition-neutral Seedance candidate from the exact active policy.
 */
export const buildSeedanceCompositionNeutralPublicationDryRun = ({
  activePolicyVersion,
  activePolicyVersionId,
  activePolicy,
  activeCustomRows,
}: {
  activePolicyVersion: number;
  activePolicyVersionId: number;
  activePolicy: ModelPricingPolicyDocument;
  activeCustomRows: AdminPricingCustomRowsDocument;
}): SeedanceCompositionNeutralPublicationDryRun => {
  const normalizedActivePolicy = compactModelPricingPolicyDocument(activePolicy);
  const legacyPublishedPolicy = materializeImageBilledCreditPolicy(
    normalizedActivePolicy,
    activeCustomRows,
    { requireComplete: true }
  );
  const targetAuthoringPolicy: ModelPricingPolicyDocument = {
    ...normalizedActivePolicy,
    schemaVersion: 5,
    perModel: {
      ...normalizedActivePolicy.perModel,
      [KIE_SEEDANCE_2_MODEL_ID]: {
        ...(normalizedActivePolicy.perModel[KIE_SEEDANCE_2_MODEL_ID] ?? {}),
        billingVariantProfile: "seedance_composition_neutral_v1",
      },
      [KIE_SEEDANCE_2_FAST_MODEL_ID]: {
        ...(normalizedActivePolicy.perModel[KIE_SEEDANCE_2_FAST_MODEL_ID] ?? {}),
        billingVariantProfile: "seedance_composition_neutral_v1",
      },
    },
  };
  const candidatePolicy = materializeImageBilledCreditPolicy(
    targetAuthoringPolicy,
    activeCustomRows,
    { requireComplete: true }
  );
  const legacyRules = listPublishedRules(legacyPublishedPolicy);
  const candidateRules = listPublishedRules(candidatePolicy);
  const legacyByKey = new Map(legacyRules.map((rule) => [ruleKey(rule), rule]));
  const candidateByKey = new Map(candidateRules.map((rule) => [ruleKey(rule), rule]));
  const addedRules = candidateRules.filter((rule) => !legacyByKey.has(ruleKey(rule)));
  const changedRules = candidateRules.filter((rule) => {
    const legacyRule = legacyByKey.get(ruleKey(rule));
    return legacyRule != null && stableJson(legacyRule) !== stableJson(rule);
  });
  const removedRules = legacyRules.filter((rule) => !candidateByKey.has(ruleKey(rule)));
  const artifactSha256 = hashModelPricingPolicyArtifact(candidatePolicy);
  const proposedSeedanceRules = candidateRules.filter((rule) =>
    SEEDANCE_TARGET_MODELS.some((model) => model.modelId === rule.modelId)
  );
  const rateComparisons = SEEDANCE_TARGET_MODELS.flatMap(({ modelId, resolutions }) =>
    resolutions.map((resolution) => {
      const noVideoBreakdown = resolvePricingGridCostBreakdown({
        modelId,
        params: {
          resolution,
          durationSeconds: 4,
          inputVideoCount: 0,
        },
        pricingPolicy: candidatePolicy,
        requirePublishedBillingRule: true,
      });
      const equalDurationVideoBreakdown = resolvePricingGridCostBreakdown({
        modelId,
        params: {
          resolution,
          durationSeconds: 4,
          inputVideoCount: 1,
          inputVideoDurationSeconds: 4,
        },
        pricingPolicy: candidatePolicy,
        requirePublishedBillingRule: true,
      });
      const continuityCostCreditsPerOutputSecond =
        noVideoBreakdown?.rawCredits == null
          ? null
          : Number((noVideoBreakdown.rawCredits / 4).toFixed(12));
      const equalDurationVideoCostCreditsPerOutputSecond =
        equalDurationVideoBreakdown?.rawCredits == null
          ? null
          : Number((equalDurationVideoBreakdown.rawCredits / 4).toFixed(12));
      return {
        modelId,
        resolution,
        continuityCostCreditsPerOutputSecond,
        equalDurationConservativeCostCreditsPerOutputSecond:
          continuityCostCreditsPerOutputSecond == null ||
          equalDurationVideoCostCreditsPerOutputSecond == null
            ? null
            : Math.max(
                continuityCostCreditsPerOutputSecond,
                equalDurationVideoCostCreditsPerOutputSecond
              ),
      };
    })
  );
  const marginEnvelopes = SEEDANCE_TARGET_MODELS.flatMap(({ modelId, resolutions }) =>
    resolutions.flatMap((resolution) =>
      SEEDANCE_MARGIN_OUTPUT_SECONDS.flatMap((outputDurationSeconds) =>
        SEEDANCE_MARGIN_INPUT_SECONDS.flatMap((inputVideoDurationSeconds) => {
          const params = {
            resolution,
            durationSeconds: outputDurationSeconds,
            inputVideoCount: inputVideoDurationSeconds > 0 ? 1 : 0,
            ...(inputVideoDurationSeconds > 0 ? { inputVideoDurationSeconds } : {}),
          };
          const breakdown = resolvePricingGridCostBreakdown({
            modelId,
            params,
            pricingPolicy: candidatePolicy,
            requirePublishedBillingRule: true,
          });
          if (!breakdown) return [];
          const modeledProviderUsd = breakdown.usdRaw;
          return [
            {
              modelId,
              resolution,
              outputDurationSeconds,
              inputVideoDurationSeconds,
              customerCredits: breakdown.credits,
              customerUsd: breakdown.usd,
              modeledProviderCredits: breakdown.rawCredits,
              modeledProviderUsd,
              modeledMarginUsd:
                modeledProviderUsd == null
                  ? null
                  : Number((breakdown.usd - modeledProviderUsd).toFixed(6)),
            },
          ];
        })
      )
    )
  );

  return {
    activePolicyVersion,
    activePolicyVersionId,
    artifactSha256,
    addedRules,
    changedRules,
    removedRules,
    missingRules: [],
    complete:
      proposedSeedanceRules.length === 5 &&
      rateComparisons.length === 5 &&
      rateComparisons.every(
        (comparison) =>
          comparison.continuityCostCreditsPerOutputSecond != null &&
          comparison.equalDurationConservativeCostCreditsPerOutputSecond != null
      ) &&
      marginEnvelopes.length === 100,
    publishedRuleCount: candidateRules.length,
    candidatePolicy,
    targetBillingVariantProfile: "seedance_composition_neutral_v1",
    proposedSeedanceRules,
    rateComparisons,
    marginEnvelopes,
  };
};
