/**
 * Centralizes generation safety payload defaults so image/video model routes stay aligned.
 * Policy target: use provider defaults unless a model family needs stricter handling.
 */
import { getModelPayloadValidationSpec } from "../../../../lib/model-runtime/modelCatalog";

export type SubmissionSafetyPayload = {
  enable_safety_checker?: boolean;
  safety_tolerance?: SafetyToleranceValue;
};

type SafetyToleranceValue = 1 | 2 | 3 | 4 | 5 | "1" | "2" | "3" | "4" | "5";

const toSafetyToleranceNumber = (value: unknown): 1 | 2 | 3 | 4 | 5 | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    if (normalized >= 1 && normalized <= 5) {
      return normalized as 1 | 2 | 3 | 4 | 5;
    }
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(normalized) && normalized >= 1 && normalized <= 5) {
      return normalized as 1 | 2 | 3 | 4 | 5;
    }
  }
  return null;
};

const toSafetyToleranceString = (value: 1 | 2 | 3 | 4 | 5): "1" | "2" | "3" | "4" | "5" =>
  String(value) as "1" | "2" | "3" | "4" | "5";

const prefersEnabledSafetyChecker = (modelId: string): boolean => modelId.includes("seedream");

const resolveMaximumTolerance = (modelId: string): SafetyToleranceValue | undefined => {
  const spec = getModelPayloadValidationSpec(modelId);
  const enumValues = spec?.enumFields?.safety_tolerance;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const numericCandidates = enumValues
      .map((value) => toSafetyToleranceNumber(value))
      .filter((value): value is 1 | 2 | 3 | 4 | 5 => value !== null);
    if (numericCandidates.length > 0) {
      const maxTolerance = Math.max(...numericCandidates) as 1 | 2 | 3 | 4 | 5;
      const expectsNumber = (spec?.optionalNumberFields ?? []).includes("safety_tolerance");
      return expectsNumber ? maxTolerance : toSafetyToleranceString(maxTolerance);
    }
  }
  if ((spec?.optionalNumberFields ?? []).includes("safety_tolerance")) {
    return 5;
  }
  return undefined;
};

const buildSafetyPayload = (modelId: string): SubmissionSafetyPayload => {
  const spec = getModelPayloadValidationSpec(modelId);
  const supportsChecker = (spec?.optionalBooleanFields ?? []).includes("enable_safety_checker");
  const safetyTolerance = resolveMaximumTolerance(modelId);
  if (!supportsChecker && safetyTolerance === undefined) {
    return {};
  }

  return {
    ...(supportsChecker ? { enable_safety_checker: prefersEnabledSafetyChecker(modelId) } : {}),
    ...(safetyTolerance !== undefined ? { safety_tolerance: safetyTolerance } : {}),
  };
};

export const resolveImageSubmissionSafetyPayload = (modelId: string): SubmissionSafetyPayload =>
  buildSafetyPayload(modelId);
