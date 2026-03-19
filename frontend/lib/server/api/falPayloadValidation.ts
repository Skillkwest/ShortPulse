/**
 * Shared Fal payload validators keyed by model id.
 * Keeps submit route validation policy centralized and testable.
 */

import {
  getModelCatalogEntry,
  getModelPayloadValidationSpec,
  type ModelPayloadValidationSpec,
} from "../../model-runtime/modelCatalog";

type ValidationIssue = {
  error: string;
  detail?: unknown;
};

export type PayloadContractViolation = ValidationIssue & {
  valid: false;
  code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION";
};

export type PayloadContractSuccess = {
  valid: true;
  projectedPayload: Record<string, unknown>;
};

export type PayloadContractResult = PayloadContractSuccess | PayloadContractViolation;

type PayloadContractOptions = {
  projectAllowedTopLevelFields?: boolean;
  enforceAllowedTopLevelFields?: boolean;
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

const projectAllowedTopLevelFields = ({
  payload,
  allowedTopLevelFields,
}: {
  payload: Record<string, unknown>;
  allowedTopLevelFields?: string[];
}): Record<string, unknown> => {
  if (!allowedTopLevelFields?.length) return { ...payload };
  const projectedPayload: Record<string, unknown> = {};
  for (const field of allowedTopLevelFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      projectedPayload[field] = payload[field];
    }
  }
  return projectedPayload;
};

const collectKnownTopLevelFields = (spec: ModelPayloadValidationSpec): string[] => {
  const knownFields = [
    ...(spec.requiredStringFields ?? []),
    ...(spec.requiredStringArrayFields ?? []).map((requirement) => requirement.field),
    ...(spec.requiredAnyOfStringFields ?? []),
    ...(spec.requiredAnyOfStringArrayFields ?? []),
    ...Object.keys(spec.enumFields ?? {}),
    ...(spec.optionalBooleanFields ?? []),
    ...(spec.optionalNumberFields ?? []),
  ];

  return [...new Set(knownFields)];
};

const resolveAllowedTopLevelFields = (
  modelId: string,
  spec: ModelPayloadValidationSpec
): string[] => {
  const knownFields = spec.allowedTopLevelFields?.length
    ? [...spec.allowedTopLevelFields]
    : collectKnownTopLevelFields(spec);
  const submitAspectField = getModelCatalogEntry(modelId)?.submitAspectField;
  if (submitAspectField && submitAspectField !== "none") {
    knownFields.push(submitAspectField);
  }
  return [...new Set(knownFields)];
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

export const evaluateFalPayloadContract = ({
  modelId,
  payload,
  spec,
  options,
}: {
  modelId: string;
  payload: Record<string, unknown>;
  spec?: ModelPayloadValidationSpec | null;
  options?: PayloadContractOptions;
}): PayloadContractResult => {
  if (!spec) {
    return {
      valid: true,
      projectedPayload: { ...payload },
    };
  }

  const violation = validateSpec(modelId, payload, spec);
  if (violation) {
    return {
      valid: false,
      code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      error: violation.error,
      detail: violation.detail,
    };
  }

  const allowedTopLevelFields = resolveAllowedTopLevelFields(modelId, spec);
  if (options?.enforceAllowedTopLevelFields && allowedTopLevelFields.length) {
    const unknownFields = Object.keys(payload).filter(
      (field) => !allowedTopLevelFields.includes(field)
    );
    if (unknownFields.length) {
      return {
        valid: false,
        code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
        error: `Unknown top-level field(s) for ${modelId} submission.`,
        detail: {
          unknown_fields: unknownFields,
          allowed_top_level_fields: allowedTopLevelFields,
        },
      };
    }
  }

  return {
    valid: true,
    projectedPayload:
      options?.projectAllowedTopLevelFields && allowedTopLevelFields.length
        ? projectAllowedTopLevelFields({
            payload,
            allowedTopLevelFields,
          })
        : { ...payload },
  };
};

export const evaluateFalPayloadContractForModel = (
  modelId: string,
  options?: PayloadContractOptions
) => {
  return (payload: Record<string, unknown>): PayloadContractResult => {
    return evaluateFalPayloadContract({
      modelId,
      payload,
      spec: getModelPayloadValidationSpec(modelId),
      options,
    });
  };
};

export const validateFalPayloadForModel = (modelId: string, options?: PayloadContractOptions) => {
  return evaluateFalPayloadContractForModel(modelId, options);
};
