import { describe, expect, it } from "vitest";
import {
  resolveSafetyDecision,
  resolveSafetyEnvironment,
  resolveSafetyModality,
} from "../decisionEngine";
import { resolveSafetyPolicyDocument } from "../policyDocument";

describe("safetyPolicy decisionEngine", () => {
  it("enforces hard-floor refusal for explicit category in production", () => {
    const result = resolveSafetyDecision({
      classification: "sexual_explicit",
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.action).toBe("refuse");
    expect(result.source).toBe("hard_floor");
  });

  it("allows lenient rewrite outcome in staging profile for explicit category", () => {
    const result = resolveSafetyDecision({
      classification: "sexual_explicit",
      modality: "image",
      environment: "development",
      profileId: "staging_lenient",
    });

    expect(result.action).toBe("rewrite");
    expect(result.source).toBe("profile");
  });

  it("supports development absolute-zero override outside production", () => {
    const result = resolveSafetyDecision({
      classification: "sexual_explicit",
      modality: "video",
      environment: "development",
      profileId: "prod_safe_v1",
      devAbsoluteZeroEnabled: true,
    });

    expect(result.action).toBe("allow");
    expect(result.source).toBe("absolute_zero");
  });

  it("supports split suggestive/explicit actions via policy document overrides", () => {
    const policy = resolveSafetyPolicyDocument({
      profileId: "prod_safe_v1",
      activePolicy: {
        schemaVersion: 2,
        input: {
          text: {
            text: {
              sexual: { level: "refuse" },
              violence: {
                level: "rewrite",
                suggestiveAction: "allow",
                explicitAction: "refuse",
              },
              self_harm: { level: "refuse" },
              hate: { level: "refuse" },
            },
            image: {
              sexual: { level: "refuse" },
              violence: {
                level: "rewrite",
                suggestiveAction: "allow",
                explicitAction: "refuse",
              },
              self_harm: { level: "refuse" },
              hate: { level: "refuse" },
            },
            video: {
              sexual: { level: "refuse" },
              violence: {
                level: "rewrite",
                suggestiveAction: "allow",
                explicitAction: "refuse",
              },
              self_harm: { level: "refuse" },
              hate: { level: "refuse" },
            },
          },
        },
      },
    });

    const suggestive = resolveSafetyDecision({
      classification: "violence_suggestive",
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
      policyDocument: policy,
    });
    const explicit = resolveSafetyDecision({
      classification: "violence_explicit",
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
      policyDocument: policy,
    });

    expect(suggestive.action).toBe("allow");
    expect(explicit.action).toBe("refuse");
  });

  it("maps runtime route/flow to expected modality", () => {
    expect(resolveSafetyModality({ route: "studio-agent", flow: "MIXED" })).toBe("image");
    expect(resolveSafetyModality({ route: "studio-agent", flow: "TEXT_ONLY" })).toBe("text");
  });

  it("normalizes node environment to safety environment", () => {
    expect(resolveSafetyEnvironment("production")).toBe("production");
    expect(resolveSafetyEnvironment("test")).toBe("development");
    expect(resolveSafetyEnvironment(undefined)).toBe("development");
  });
});
