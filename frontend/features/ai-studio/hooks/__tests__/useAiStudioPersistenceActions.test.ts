import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  hasDurableGenerationIdentity,
  isDurablyGeneratedOutput,
  mergeOutputWithPersistedDelivery,
  resolvePersistableOutputUrls,
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

describe("resolvePersistableOutputUrls", () => {
  it("prefers upload local object urls ahead of mutable preview urls", () => {
    const output = makeOutput({
      mediaSource: "upload",
      localObjectUrl: "blob:local-upload-original",
      previewUrl: "https://signed.example.com/upload-preview.png",
    });

    expect(resolvePersistableOutputUrls(output)).toEqual([
      "blob:local-upload-original",
      "https://signed.example.com/upload-preview.png",
    ]);
  });

  it("keeps result urls as the primary persistence source when available", () => {
    const output = makeOutput({
      mediaSource: "upload",
      localObjectUrl: "blob:local-upload-original",
      previewUrl: "https://signed.example.com/upload-preview.png",
      resultUrls: ["https://provider.example.com/result-1.png"],
    });

    expect(resolvePersistableOutputUrls(output)).toEqual([
      "https://provider.example.com/result-1.png",
    ]);
  });
});

describe("isDurablyGeneratedOutput", () => {
  it("returns true when a generation id is present", () => {
    expect(
      isDurablyGeneratedOutput(
        makeOutput({
          generationId: "gen-1",
        })
      )
    ).toBe(true);
  });

  it("returns true when media source is generated", () => {
    expect(
      isDurablyGeneratedOutput(
        makeOutput({
          mediaSource: "generated",
        })
      )
    ).toBe(true);
  });

  it("does not treat task id alone as durable generated identity", () => {
    expect(
      isDurablyGeneratedOutput(
        makeOutput({
          taskId: "req-1",
        })
      )
    ).toBe(false);
  });
});

describe("hasDurableGenerationIdentity", () => {
  it("returns true only when generation id is present", () => {
    expect(
      hasDurableGenerationIdentity(
        makeOutput({
          generationId: "gen-1",
          taskId: "req-1",
          mediaSource: "generated",
        })
      )
    ).toBe(true);
  });

  it("does not treat media source or task id alone as durable generation identity", () => {
    expect(
      hasDurableGenerationIdentity(
        makeOutput({
          mediaSource: "generated",
          taskId: "req-1",
        })
      )
    ).toBe(false);
  });
});
