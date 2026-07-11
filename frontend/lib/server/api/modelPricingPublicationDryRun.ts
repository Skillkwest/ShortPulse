import { createHash } from "crypto";
import type { AdminPricingCustomRowsDocument } from "../../model-runtime/adminPricingCustomRows";
import {
  IncompletePublishedPricingPolicyError,
  materializeImageBilledCreditPolicy,
} from "../../model-runtime/materializeImageBilledCreditPolicy";
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
  artifactSha256: string;
  addedRules: PublishedRule[];
  changedRules: PublishedRule[];
  removedRules: PublishedRule[];
  missingRules: Array<{ source: "catalog" | "custom"; key: string }>;
  complete: boolean;
  publishedRuleCount: number;
  candidatePolicy: ModelPricingPolicyDocument;
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
  activePolicy,
  activeCustomRows,
}: {
  activePolicyVersion: number;
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
  const artifactSha256 = createHash("sha256").update(stableJson(candidatePolicy)).digest("hex");

  return {
    activePolicyVersion,
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
