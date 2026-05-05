import { describe, expect, it } from "vitest";
import {
  resolveProviderErrorHandling,
  resolveProviderErrorNormalizationMode,
} from "../providerErrorPolicy";

describe("safetyPolicy providerErrorPolicy", () => {
  it("maps transient upstream failures to hard errors with normalized client detail", () => {
    const result = resolveProviderErrorHandling({
      status: 503,
      detail: "service unavailable",
      normalizationMode: "production_normalized",
    });

    expect(result.failureClass).toBe("infra_transient");
    expect(result.failureResolution).toBe("hard_error");
    expect(result.detailForClient).toBeUndefined();
  });

  it("keeps auth hard errors explicit in production-normalized mode", () => {
    const result = resolveProviderErrorHandling({
      status: 401,
      detail: "invalid api key",
      normalizationMode: "production_normalized",
    });

    expect(result.failureClass).toBe("auth_config");
    expect(result.failureResolution).toBe("hard_error");
    expect(result.detailForClient).toBe("invalid api key");
  });

  it("returns verbatim detail for hard errors in development-verbatim mode", () => {
    const result = resolveProviderErrorHandling({
      status: 401,
      detail: "provider stack trace payload",
      normalizationMode: "development_verbatim",
    });

    expect(result.failureResolution).toBe("hard_error");
    expect(result.detailForClient).toBe("provider stack trace payload");
  });

  it("maps explicit safety refusal inputs to canonical refusal resolution", () => {
    const result = resolveProviderErrorHandling({
      status: 400,
      detail: "content policy violation",
      safetyRefusal: true,
      normalizationMode: "production_normalized",
    });

    expect(result.failureClass).toBe("safety_refusal");
    expect(result.failureResolution).toBe("canonical_refusal");
  });

  it("parses normalization mode with fail-closed default", () => {
    expect(resolveProviderErrorNormalizationMode("development_verbatim")).toBe(
      "development_verbatim"
    );
    expect(resolveProviderErrorNormalizationMode("verbatim")).toBe("development_verbatim");
    expect(resolveProviderErrorNormalizationMode("anything-else")).toBe("production_normalized");
  });
});
