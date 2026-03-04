import { describe, expect, it } from "vitest";
import { resolveSafetyPolicyDocument } from "../policyDocument";
import { enforceServerGenerationSafetyPayload } from "../generationSafetyPolicy";
import { getModelPayloadValidationSpec } from "../../../../lib/model-runtime/modelCatalog";

describe("generationSafetyPolicy", () => {
  it("enforces minimum defaults for image models", () => {
    const policy = resolveSafetyPolicyDocument({
      activePolicy: null,
      profileId: "prod_safe_v1",
    });
    const payload: Record<string, unknown> = { prompt: "portrait" };
    const result = enforceServerGenerationSafetyPayload({
      payload,
      modelId: "fal/flux-2-pro",
      modality: "image",
      spec: getModelPayloadValidationSpec("fal/flux-2-pro"),
      policyDocument: policy,
    });

    expect(result.enforced).toBe(true);
    expect(result.enforcedLevel).toBe("off");
    expect(payload.enable_safety_checker).toBe(false);
    expect(payload.safety_tolerance).toBe("5");
  });

  it("keeps minimum defaults even when policy includes stricter per-model overrides", () => {
    const policy = resolveSafetyPolicyDocument({
      activePolicy: {
        schemaVersion: 2,
        generation: {
          defaults: {
            image: { level: "moderate" },
            video: { level: "moderate" },
          },
          per_model: {
            "fal-ai/veo3.1": {
              level: "strict",
              enableSafetyChecker: true,
              safetyTolerance: 1,
            },
          },
        },
      },
      profileId: "prod_safe_v1",
    });
    const payload: Record<string, unknown> = { prompt: "safe clip" };
    enforceServerGenerationSafetyPayload({
      payload,
      modelId: "fal-ai/veo3.1",
      modality: "video",
      spec: getModelPayloadValidationSpec("fal-ai/veo3.1"),
      policyDocument: policy,
    });

    expect(payload.enable_safety_checker).toBe(false);
    expect(payload.safety_tolerance).toBe(5);
  });

  it("enforces off defaults for dev_absolute_zero generation profile", () => {
    const policy = resolveSafetyPolicyDocument({
      activePolicy: null,
      profileId: "dev_absolute_zero",
    });
    const payload: Record<string, unknown> = { prompt: "portrait" };
    const result = enforceServerGenerationSafetyPayload({
      payload,
      modelId: "fal/flux-2-pro",
      modality: "image",
      spec: getModelPayloadValidationSpec("fal/flux-2-pro"),
      policyDocument: policy,
    });

    expect(result.enforced).toBe(true);
    expect(result.enforcedLevel).toBe("off");
    expect(payload.enable_safety_checker).toBe(false);
    expect(payload.safety_tolerance).toBe("5");
  });
});
