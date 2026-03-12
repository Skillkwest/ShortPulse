import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  mergeOutputWithPersistedDelivery,
  type PersistedMediaDelivery,
} from "../useAiStudioPersistenceActions";

const makeOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id: "out-1",
    prompt: "prompt",
    mode: "image",
    aspect: "1:1",
    model: "model",
    status: "ready",
    timestamp: "now",
    ...overrides,
  }) as StudioOutput;

const makeDelivery = (overrides: Partial<PersistedMediaDelivery> = {}): PersistedMediaDelivery => ({
  previewStoragePath: "user-1/generations/images/preview.png",
  fullStoragePath: "user-1/generations/images/full.png",
  previewUrl: "https://cdn.example.com/preview-signed.png",
  fullUrl: "https://cdn.example.com/full-signed.png",
  ...overrides,
});

describe("mergeOutputWithPersistedDelivery", () => {
  it("prefers delivery URLs over stale output preview URLs", () => {
    const output = makeOutput({
      previewUrl: "https://provider.example.com/stale-url.png",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    const merged = mergeOutputWithPersistedDelivery(output, makeDelivery());

    expect(merged.previewUrl).toBe("https://cdn.example.com/preview-signed.png");
    expect(merged.previewStoragePath).toBe("user-1/generations/images/preview.png");
    expect(merged.fullStoragePath).toBe("user-1/generations/images/full.png");
  });

  it("falls back to existing preview URL when delivery URL values are empty", () => {
    const output = makeOutput({
      previewUrl: "https://provider.example.com/existing.png",
      previewStoragePath: "user-1/generations/images/existing-preview.png",
      fullStoragePath: "user-1/generations/images/existing-full.png",
    });

    const merged = mergeOutputWithPersistedDelivery(
      output,
      makeDelivery({
        previewUrl: "   ",
        fullUrl: null,
      })
    );

    expect(merged.previewUrl).toBe("https://provider.example.com/existing.png");
    expect(merged.previewStoragePath).toBe("user-1/generations/images/preview.png");
    expect(merged.fullStoragePath).toBe("user-1/generations/images/full.png");
  });

  it("uses preview storage path as full storage fallback when delivery full path is absent", () => {
    const output = makeOutput({
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: "",
    });

    const merged = mergeOutputWithPersistedDelivery(
      output,
      makeDelivery({
        fullStoragePath: null,
      })
    );

    expect(merged.previewStoragePath).toBe("user-1/generations/images/preview.png");
    expect(merged.fullStoragePath).toBe("user-1/generations/images/preview.png");
    expect(merged.previewUrl).toBe("https://cdn.example.com/preview-signed.png");
  });
});
