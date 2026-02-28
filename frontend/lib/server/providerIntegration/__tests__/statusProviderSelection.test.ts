/**
 * Unit coverage for provider-owned status/result candidate selection policy.
 */

import { describe, expect, it } from "vitest";
import {
  selectBestProviderResultCandidate,
  selectBestProviderStatusCandidate,
} from "../statusProviderSelection";

describe("statusProviderSelection", () => {
  it("selects highest-confidence status candidate for fal", () => {
    const selected = selectBestProviderStatusCandidate({
      provider: "fal",
      candidates: [
        {
          index: 1,
          baseUrl: "https://queue.fal.run",
          isJson: true,
          isRetryableAlias: false,
          httpStatus: 200,
          isHttpOk: true,
          status: "running",
          isTerminal: false,
          isCompleted: false,
          isFailed: false,
          hasResponseUrl: false,
          hasMedia: false,
        },
        {
          index: 0,
          baseUrl: "https://queue.fal.run",
          isJson: true,
          isRetryableAlias: false,
          httpStatus: 200,
          isHttpOk: true,
          status: "completed",
          isTerminal: true,
          isCompleted: true,
          isFailed: false,
          hasResponseUrl: true,
          hasMedia: true,
        },
      ],
    });

    expect(selected?.status).toBe("completed");
    expect(selected?.index).toBe(0);
  });

  it("selects highest-confidence result candidate for fal", () => {
    const selected = selectBestProviderResultCandidate({
      provider: "fal",
      candidates: [
        {
          index: 0,
          baseUrl: "https://queue.fal.run",
          isJson: true,
          isRetryableAlias: false,
          httpStatus: 500,
          isHttpOk: false,
          status: "error",
          hasError: true,
          hasMedia: false,
        },
        {
          index: 1,
          baseUrl: "https://queue.fal.run",
          isJson: true,
          isRetryableAlias: false,
          httpStatus: 200,
          isHttpOk: true,
          status: "completed",
          hasError: false,
          hasMedia: true,
        },
      ],
    });

    expect(selected?.status).toBe("completed");
    expect(selected?.index).toBe(1);
  });

  it("returns null when candidate arrays are empty", () => {
    expect(
      selectBestProviderStatusCandidate({
        provider: "fal",
        candidates: [],
      })
    ).toBeNull();
    expect(
      selectBestProviderResultCandidate({
        provider: "fal",
        candidates: [],
      })
    ).toBeNull();
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      selectBestProviderStatusCandidate({
        provider: "kie",
        candidates: [],
      })
    ).toThrow("Unsupported provider for status candidate selection");

    expect(() =>
      selectBestProviderResultCandidate({
        provider: "kie",
        candidates: [],
      })
    ).toThrow("Unsupported provider for status candidate selection");
  });
});
