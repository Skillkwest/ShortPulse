import { describe, expect, it } from "vitest";
import { canDownloadReferenceOutput, canSaveReferenceOutput } from "../referenceActionAvailability";

describe("referenceActionAvailability", () => {
  it("allows save and download for generated outputs with durable identity", () => {
    const output = {
      mediaSource: "generated" as const,
      generationId: "gen-1",
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: [] as string[],
    };

    expect(canSaveReferenceOutput(output)).toBe(true);
    expect(canDownloadReferenceOutput(output)).toBe(true);
  });

  it("blocks save and download for weak generated previews", () => {
    const output = {
      mediaSource: "generated" as const,
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: [] as string[],
    };

    expect(canSaveReferenceOutput(output)).toBe(false);
    expect(canDownloadReferenceOutput(output)).toBe(false);
  });

  it("allows download for storage-backed generated outputs even without generation id", () => {
    const output = {
      mediaSource: "generated" as const,
      previewStoragePath: "user-1/uploads/images/ref-1.png",
      fullStoragePath: null,
      savedMediaIds: [] as string[],
    };

    expect(canSaveReferenceOutput(output)).toBe(true);
    expect(canDownloadReferenceOutput(output)).toBe(true);
  });

  it("keeps uploads available for save and download", () => {
    const output = {
      mediaSource: "upload" as const,
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: [] as string[],
    };

    expect(canSaveReferenceOutput(output)).toBe(true);
    expect(canDownloadReferenceOutput(output)).toBe(true);
  });
});
