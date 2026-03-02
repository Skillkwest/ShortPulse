import { describe, expect, it } from "vitest";
import { resolveSafetyPolicyDocument } from "../policyDocument";
import { runImageSafetyPreflight } from "../imagePreflightClassifier";

describe("imagePreflightClassifier", () => {
  const policy = resolveSafetyPolicyDocument({
    activePolicy: null,
    profileId: "prod_safe_v1",
  });

  it("passes benign URLs", async () => {
    const result = await runImageSafetyPreflight({
      enabled: true,
      imageUrl: "https://cdn.example.com/portrait.png",
      policyDocument: policy,
      environment: "development",
      failMode: "prod_closed_nonprod_open",
    });

    expect(result.outcome).toBe("pass");
    expect(result.providerCallSkipped).toBe(false);
  });

  it("refuses risky URL signals under strict profile", async () => {
    const result = await runImageSafetyPreflight({
      enabled: true,
      imageUrl: "https://cdn.example.com/nsfw-nude-photo.png",
      policyDocument: policy,
      environment: "development",
      failMode: "prod_closed_nonprod_open",
    });

    expect(result.outcome).toBe("refusal");
    expect(result.providerCallSkipped).toBe(true);
  });

  it("fails open in non-production when classifier is unavailable", async () => {
    const result = await runImageSafetyPreflight({
      enabled: true,
      imageUrl: "https://cdn.example.com/simulate_preflight_unavailable.png",
      policyDocument: policy,
      environment: "development",
      failMode: "prod_closed_nonprod_open",
    });

    expect(result.outcome).toBe("pass");
    expect(result.classifierUnavailable).toBe(true);
    expect(result.providerCallSkipped).toBe(false);
  });

  it("fails closed in production when classifier is unavailable", async () => {
    const result = await runImageSafetyPreflight({
      enabled: true,
      imageUrl: "https://cdn.example.com/simulate_preflight_unavailable.png",
      policyDocument: policy,
      environment: "production",
      failMode: "prod_closed_nonprod_open",
    });

    expect(result.outcome).toBe("refusal");
    expect(result.classifierUnavailable).toBe(true);
    expect(result.providerCallSkipped).toBe(true);
  });
});
