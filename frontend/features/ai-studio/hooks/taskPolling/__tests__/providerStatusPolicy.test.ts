/**
 * Unit coverage for provider status parsing and classification policy.
 */
import { describe, expect, it } from "vitest";
import {
  classifyProviderSuccess,
  condenseError,
  createShortErrorMessage,
  extractFailureMessageFromDetail,
  normalizeProviderStateToTaskState,
  resolveProviderStatusState,
} from "../providerStatusPolicy";

describe("providerStatusPolicy", () => {
  it("maps provider states to task state", () => {
    expect(normalizeProviderStateToTaskState("success")).toBe("success");
    expect(normalizeProviderStateToTaskState("error")).toBe("fail");
    expect(normalizeProviderStateToTaskState("running")).toBe("running");
  });

  it("resolves provider status from variant payload fields", () => {
    expect(resolveProviderStatusState({ status: "SUCCEEDED" }).state).toBe("success");
    expect(resolveProviderStatusState({ data: { status: "running" } }).state).toBe("running");
    expect(resolveProviderStatusState({}).state).toBe("pending");
  });

  it("classifies forced image success when media appears in nonterminal state", () => {
    const result = classifyProviderSuccess({
      provider: "fal",
      state: "running",
      hasMedia: true,
      hasExplicitState: true,
    });
    expect(result.shouldForceImageMediaSuccess).toBe(true);
    expect(result.shouldTreatAsSuccess).toBe(true);
  });

  it("normalizes long and policy errors", () => {
    expect(condenseError("a".repeat(120)).length).toBeLessThanOrEqual(78);
    expect(createShortErrorMessage("Content policy checker flagged input")).toBe(
      "Content not allowed"
    );
  });

  it("extracts nested failure detail message", () => {
    expect(extractFailureMessageFromDetail({ detail: [{ message: "file_download_error" }] })).toBe(
      "file_download_error"
    );
  });
});
