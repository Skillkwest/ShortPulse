/**
 * Shared Fal payload validators keyed by model id.
 * Keeps submit route validation policy centralized and testable.
 */

import {
  getModelPayloadValidationSpec,
  type ModelPayloadValidationSpec,
} from "../../model-runtime/modelCatalog";

type ValidationIssue = {
  error: string;
  detail?: unknown;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
};

const hasValidOptionalNumber = (value: unknown): boolean => {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value === "string" && value.trim().length) {
    const numeric = Number(value);
    return Number.isFinite(numeric);
  }
  return false;
};

const validateSpec = (
  modelId: string,
  payload: Record<string, unknown>,
  spec: ModelPayloadValidationSpec
): ValidationIssue | null => {
  for (const field of spec.requiredStringFields ?? []) {
    if (!asTrimmedString(payload[field])) {
      return {
        error: `Missing required ${field} for ${modelId} submission.`,
        detail: { field },
      };
    }
  }

  for (const requirement of spec.requiredStringArrayFields ?? []) {
    const values = readStringArray(payload[requirement.field]);
    const min = requirement.min ?? 1;
    if (values.length < min) {
      return {
        error: `${requirement.field} must contain at least ${min} item(s) for ${modelId} submission.`,
        detail: { field: requirement.field, min, count: values.length },
      };
    }
    if (typeof requirement.max === "number" && values.length > requirement.max) {
      return {
        error: `${requirement.field} accepts at most ${requirement.max} item(s) for ${modelId} submission.`,
        detail: { field: requirement.field, max: requirement.max, count: values.length },
      };
    }
  }

  const hasRequiredAnyString = (spec.requiredAnyOfStringFields ?? []).some((field) =>
    Boolean(asTrimmedString(payload[field]))
  );
  const hasRequiredAnyStringArray = (spec.requiredAnyOfStringArrayFields ?? []).some(
    (field) => readStringArray(payload[field]).length > 0
  );
  if (
    (spec.requiredAnyOfStringFields?.length || spec.requiredAnyOfStringArrayFields?.length) &&
    !hasRequiredAnyString &&
    !hasRequiredAnyStringArray
  ) {
    return {
      error: `Missing required media input for ${modelId} submission.`,
      detail: {
        any_of_fields: spec.requiredAnyOfStringFields ?? [],
        any_of_array_fields: spec.requiredAnyOfStringArrayFields ?? [],
      },
    };
  }

  for (const [field, allowed] of Object.entries(spec.enumFields ?? {})) {
    const raw = payload[field];
    if (raw === undefined || raw === null) continue;
    const value = asTrimmedString(raw);
    if (!value) {
      return {
        error: `${field} must be a non-empty string when provided.`,
        detail: { field, allowed },
      };
    }
    if (!allowed.includes(value)) {
      return {
        error: `Invalid ${field} for ${modelId} submission.`,
        detail: { field, allowed },
      };
    }
  }

  for (const field of spec.optionalBooleanFields ?? []) {
    const value = payload[field];
    if (value !== undefined && typeof value !== "boolean") {
      return {
        error: `${field} must be a boolean when provided.`,
        detail: { field },
      };
    }
  }

  for (const field of spec.optionalNumberFields ?? []) {
    const value = payload[field];
    if (value !== undefined && !hasValidOptionalNumber(value)) {
      return {
        error: `${field} must be numeric when provided.`,
        detail: { field },
      };
    }
  }

  return null;
};

export const validateFalPayloadForModel = (modelId: string) => {
  return (payload: Record<string, unknown>): ValidationIssue | null => {
    const spec = getModelPayloadValidationSpec(modelId);
    if (!spec) return null;
    return validateSpec(modelId, payload, spec);
  };
};
