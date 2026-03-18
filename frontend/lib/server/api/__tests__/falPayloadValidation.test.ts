import { describe, expect, it } from "vitest";
import {
  evaluateFalPayloadContract,
  evaluateFalPayloadContractForModel,
} from "../falPayloadValidation";
import { listModelCatalogEntries } from "../../../model-runtime/modelCatalog";

const buildRepresentativePayload = (modelId: string) => {
  const validatePayload = evaluateFalPayloadContractForModel(modelId, {
    enforceAllowedTopLevelFields: true,
    projectAllowedTopLevelFields: true,
  });
  const entry = listModelCatalogEntries().find((candidate) => candidate.modelId === modelId);
  if (!entry?.payloadValidation) {
    throw new Error(`Missing payload validation spec for ${modelId}`);
  }

  const payload: Record<string, unknown> = {};
  for (const field of entry.payloadValidation.requiredStringFields ?? []) {
    if (field.includes("image") || field.includes("frame") || field.includes("mask")) {
      payload[field] = `https://cdn.shortpulse.test/${field}.png`;
    } else {
      payload[field] = `${modelId}-${field}`;
    }
  }

  for (const requirement of entry.payloadValidation.requiredStringArrayFields ?? []) {
    payload[requirement.field] = [`https://cdn.shortpulse.test/${requirement.field}.png`];
  }

  for (const field of entry.payloadValidation.requiredAnyOfStringFields ?? []) {
    payload[field] = `https://cdn.shortpulse.test/${field}.png`;
  }

  for (const field of entry.payloadValidation.requiredAnyOfStringArrayFields ?? []) {
    payload[field] = [`https://cdn.shortpulse.test/${field}.png`];
  }

  for (const [field, allowed] of Object.entries(entry.payloadValidation.enumFields ?? {})) {
    payload[field] = allowed[0];
  }

  for (const field of entry.payloadValidation.optionalBooleanFields ?? []) {
    payload[field] = true;
  }

  for (const field of entry.payloadValidation.optionalNumberFields ?? []) {
    payload[field] = 1;
  }

  const contract = validatePayload(payload);
  if (!contract.valid) {
    throw new Error(`Representative payload failed for ${modelId}: ${contract.error}`);
  }
  return payload;
};

describe("evaluateFalPayloadContract", () => {
  it("projects payload to the allowlisted top-level fields when provided", () => {
    const result = evaluateFalPayloadContract({
      modelId: "fal-ai/test-model",
      payload: {
        prompt: "portrait",
        image_url: "https://cdn.shortpulse.test/input.png",
        rogue: true,
      },
      spec: {
        allowedTopLevelFields: ["prompt", "image_url"],
        requiredStringFields: ["prompt", "image_url"],
      },
      options: {
        projectAllowedTopLevelFields: true,
      },
    });

    expect(result).toEqual({
      valid: true,
      projectedPayload: {
        prompt: "portrait",
        image_url: "https://cdn.shortpulse.test/input.png",
      },
    });
  });

  it("returns a deterministic contract violation when required fields are missing", () => {
    const result = evaluateFalPayloadContract({
      modelId: "fal-ai/test-model",
      payload: {},
      spec: {
        requiredStringFields: ["prompt"],
      },
    });

    expect(result).toEqual({
      valid: false,
      code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      error: "Missing required prompt for fal-ai/test-model submission.",
      detail: {
        field: "prompt",
      },
    });
  });

  it("accepts representative payloads for every payload-validated model when allowlist enforcement is enabled", () => {
    const modelsWithPayloadValidation = listModelCatalogEntries().filter(
      (entry) => entry.payloadValidation
    );

    for (const entry of modelsWithPayloadValidation) {
      const payload = buildRepresentativePayload(entry.modelId);
      const result = evaluateFalPayloadContractForModel(entry.modelId, {
        enforceAllowedTopLevelFields: true,
        projectAllowedTopLevelFields: true,
      })(payload);

      expect(result.valid, entry.modelId).toBe(true);
    }
  });

  it("rejects injected unknown top-level fields when allowlist enforcement is enabled", () => {
    const modelsWithPayloadValidation = listModelCatalogEntries().filter(
      (entry) => entry.payloadValidation
    );

    for (const entry of modelsWithPayloadValidation) {
      const payload = {
        ...buildRepresentativePayload(entry.modelId),
        unexpected_debug_flag: true,
      };
      const result = evaluateFalPayloadContractForModel(entry.modelId, {
        enforceAllowedTopLevelFields: true,
        projectAllowedTopLevelFields: true,
      })(payload);

      expect(result, entry.modelId).toEqual({
        valid: false,
        code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
        error: `Unknown top-level field(s) for ${entry.modelId} submission.`,
        detail: expect.objectContaining({
          unknown_fields: ["unexpected_debug_flag"],
        }),
      });
    }
  });
});
