/**
 * Server-authoritative generation safety payload enforcement for provider submit routes.
 */
import type { ModelPayloadValidationSpec } from "../../../lib/model-runtime/modelCatalog";
import { resolvePolicyGenerationLevel, resolvePolicyGenerationOverride } from "./policyDocument";
import type { SafetyPolicyDocumentV2 } from "./types";

type GenerationSafetyConfig = {
  enableSafetyChecker?: boolean;
  safetyTolerance?: 1 | 2 | 3 | 4 | 5;
};

const resolveDefaultGenerationConfigForLevel = (
  level: "off" | "moderate" | "strict"
): GenerationSafetyConfig => {
  if (level === "off") {
    return { enableSafetyChecker: false, safetyTolerance: 5 };
  }
  if (level === "strict") {
    return { enableSafetyChecker: true, safetyTolerance: 1 };
  }
  return { enableSafetyChecker: true, safetyTolerance: 3 };
};

const supportsSafetyChecker = (spec: ModelPayloadValidationSpec | null): boolean =>
  (spec?.optionalBooleanFields ?? []).includes("enable_safety_checker");

const supportsSafetyToleranceAsString = (spec: ModelPayloadValidationSpec | null): boolean =>
  Array.isArray(spec?.enumFields?.safety_tolerance) &&
  spec?.enumFields?.safety_tolerance?.every((item) => typeof item === "string");

const supportsSafetyToleranceAsNumber = (spec: ModelPayloadValidationSpec | null): boolean =>
  (spec?.optionalNumberFields ?? []).includes("safety_tolerance");

export const enforceServerGenerationSafetyPayload = ({
  payload,
  modelId,
  modality,
  spec,
  policyDocument,
}: {
  payload: Record<string, unknown>;
  modelId: string;
  modality: "image" | "video";
  spec: ModelPayloadValidationSpec | null;
  policyDocument: SafetyPolicyDocumentV2;
}): {
  enforced: boolean;
  enforcedLevel: "off" | "moderate" | "strict";
  effectiveConfig: GenerationSafetyConfig;
} => {
  const level = resolvePolicyGenerationLevel({
    policy: policyDocument,
    modality,
    modelId,
  });
  const defaultConfig = resolveDefaultGenerationConfigForLevel(level);
  const perModelOverride = resolvePolicyGenerationOverride({
    policy: policyDocument,
    modelId,
  });
  const effectiveConfig: GenerationSafetyConfig = {
    ...defaultConfig,
    ...(perModelOverride ?? {}),
  };

  let enforced = false;
  if (supportsSafetyChecker(spec) && typeof effectiveConfig.enableSafetyChecker === "boolean") {
    payload.enable_safety_checker = effectiveConfig.enableSafetyChecker;
    enforced = true;
  }
  if (typeof effectiveConfig.safetyTolerance === "number") {
    if (supportsSafetyToleranceAsString(spec)) {
      payload.safety_tolerance = String(effectiveConfig.safetyTolerance);
      enforced = true;
    } else if (supportsSafetyToleranceAsNumber(spec)) {
      payload.safety_tolerance = effectiveConfig.safetyTolerance;
      enforced = true;
    }
  }

  return {
    enforced,
    enforcedLevel: level,
    effectiveConfig,
  };
};
