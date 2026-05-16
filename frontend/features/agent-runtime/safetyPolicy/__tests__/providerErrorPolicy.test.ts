import { describe, expect, it } from "vitest";
import {
  REMOTE_MEDIA_FETCH_FAILURE_MESSAGE,
  resolveProviderErrorHandling,
  resolveProviderErrorNormalizationMode,
} from "../providerErrorPolicy";

describe("providerErrorPolicy", () => {
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

  it("replaces remote media fetch timeout details with safe client copy", () => {
    const result = resolveProviderErrorHandling({
      status: 400,
      detail:
        "Timeout while downloading https://example.supabase.co/storage/v1/object/sign/media_library/user-1/full.png?token=secret",
      normalizationMode: "production_normalized",
    });

    expect(result.detailForClient).toBe(REMOTE_MEDIA_FETCH_FAILURE_MESSAGE);
  });

  it("redacts signed media urls from other client-visible provider details", () => {
    const result = resolveProviderErrorHandling({
      status: 400,
      detail:
        "Invalid image URL: https://example.supabase.co/storage/v1/object/sign/media_library/user-1/full.png?token=secret",
      normalizationMode: "production_normalized",
    });

    expect(result.detailForClient).toBe("Invalid image URL: [signed media URL]");
  });

  it("keeps verbatim details in development mode", () => {
    const detail =
      "Timeout while downloading https://example.supabase.co/storage/v1/object/sign/media_library/user-1/full.png?token=secret";
    const result = resolveProviderErrorHandling({
      status: 400,
      detail,
      normalizationMode: "development_verbatim",
    });

    expect(result.detailForClient).toBe(detail);
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
