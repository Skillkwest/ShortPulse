import { describe, expect, it } from "vitest";
import { evaluateFalPayloadContract } from "../falPayloadValidation";

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
});
