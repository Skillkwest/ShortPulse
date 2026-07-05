import { describe, expect, it } from "vitest";
import {
  canDragReferenceOutput,
  canExposeDirectReferenceUrls,
  hasDurableGenerationIdentity,
  hasStorageAuthority,
  resolveReferenceOutputAuthorityTier,
} from "../referenceOutputAuthority";

describe("referenceOutputAuthority", () => {
  it("treats storage-backed generated outputs as reusable", () => {
    const output = {
      mediaSource: "generated" as const,
      previewStoragePath: "user-1/variants/images/ref-1/thumb_480",
      fullStoragePath: null,
      savedMediaIds: [],
    };

    expect(hasStorageAuthority(output)).toBe(true);
    expect(hasDurableGenerationIdentity(output)).toBe(true);
    expect(resolveReferenceOutputAuthorityTier(output)).toBe("reusable");
    expect(canDragReferenceOutput(output)).toBe(true);
    expect(canExposeDirectReferenceUrls(output)).toBe(true);
  });

  it("treats generated outputs with only a generation id as tracked", () => {
    const output = {
      mediaSource: "generated" as const,
      generationId: "gen-1",
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: [],
    };

    expect(hasStorageAuthority(output)).toBe(false);
    expect(hasDurableGenerationIdentity(output)).toBe(true);
    expect(resolveReferenceOutputAuthorityTier(output)).toBe("tracked");
    expect(canDragReferenceOutput(output)).toBe(true);
    expect(canExposeDirectReferenceUrls(output)).toBe(false);
  });

  it("keeps weak generated previews preview-only", () => {
    const output = {
      mediaSource: "generated" as const,
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: [],
    };

    expect(hasStorageAuthority(output)).toBe(false);
    expect(hasDurableGenerationIdentity(output)).toBe(false);
    expect(resolveReferenceOutputAuthorityTier(output)).toBe("preview-only");
    expect(canDragReferenceOutput(output)).toBe(false);
    expect(canExposeDirectReferenceUrls(output)).toBe(false);
  });

  it("allows uploads to stay directly reusable even without generation metadata", () => {
    const output = {
      mediaSource: "upload" as const,
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: [],
    };

    expect(resolveReferenceOutputAuthorityTier(output)).toBe("preview-only");
    expect(canDragReferenceOutput(output)).toBe(true);
    expect(canExposeDirectReferenceUrls(output)).toBe(true);
  });

  it("treats saved media ids as storage authority", () => {
    const output = {
      mediaSource: "generated" as const,
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: ["media-1"],
    };

    expect(hasStorageAuthority(output)).toBe(true);
    expect(resolveReferenceOutputAuthorityTier(output)).toBe("reusable");
    expect(canExposeDirectReferenceUrls(output)).toBe(false);
  });

  it("does not treat render urls as storage path authority", () => {
    const output = {
      mediaSource: "upload" as const,
      previewStoragePath: "https://signed.shortpulse.test/user-1/uploads/images/ref.png",
      fullStoragePath: "blob:local-ref",
      savedMediaIds: [],
    };

    expect(hasStorageAuthority(output)).toBe(false);
    expect(resolveReferenceOutputAuthorityTier(output)).toBe("preview-only");
  });
});
