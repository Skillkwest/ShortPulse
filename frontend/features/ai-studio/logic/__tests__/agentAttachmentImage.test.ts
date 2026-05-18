import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(async () => null),
  getSignedMediaUrlsBatch: vi.fn(async () => new Map()),
}));

vi.mock("../../utils/imageUpload", () => ({
  refreshSupabaseSignedUrlIfNeeded: vi.fn(async (value: string) => value),
}));

import {
  normalizeAttachmentImageUrl,
  resolveAgentAttachmentSubmissionCandidates,
  resolveAgentAttachmentPreviewUrl,
} from "../agentAttachmentImage";
import { getSignedMediaUrl, getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";

const getSignedMediaUrlMock = vi.mocked(getSignedMediaUrl);
const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

describe("agentAttachmentImage", () => {
  it("uses api-first batch signing for storage-backed attachment previews", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValueOnce(
      new Map([["user-1/generated/preview.png", "https://signed.test/preview.png"]])
    );

    const resolvedUrl = await resolveAgentAttachmentPreviewUrl({
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceRenderUrl: null,
      referenceUrl: null,
      imageUrl: null,
    });

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user-1/generated/preview.png"],
      forceRefresh: true,
    });
    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
    expect(resolvedUrl).toBe("https://signed.test/preview.png");
  });

  it("prefers the staged imageUrl before a weaker referenceUrl", async () => {
    const resolvedUrl = await resolveAgentAttachmentPreviewUrl({
      previewStoragePath: null,
      fullStoragePath: null,
      referenceRenderUrl: null,
      referenceUrl: "https://cdn.example.com/weaker-reference.png",
      imageUrl: "https://cdn.example.com/rendered-preview.png",
      submissionImageUrl: null,
    });

    expect(resolvedUrl).toBe("https://cdn.example.com/rendered-preview.png");
  });

  it("falls back to submissionImageUrl when the display imageUrl is missing", async () => {
    const resolvedUrl = await resolveAgentAttachmentPreviewUrl({
      previewStoragePath: null,
      fullStoragePath: null,
      referenceRenderUrl: null,
      referenceUrl: null,
      imageUrl: null,
      submissionImageUrl: "blob:full-upload-source",
    });

    expect(resolvedUrl).toBe("blob:full-upload-source");
  });

  it("builds submission candidates with local source first and durable identity next", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValueOnce(
      new Map([["user-1/generated/preview.png", "https://signed.test/preview.png"]])
    );

    const candidates = await resolveAgentAttachmentSubmissionCandidates({
      submissionImageUrl: "blob:full-upload-source",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      imageUrl: "data:image/jpeg;base64,preview",
      imageFallbackUrls: ["https://cdn.example.com/fallback.png"],
      referenceRenderUrl: null,
      referenceUrl: "https://cdn.example.com/reference.png",
    });

    expect(candidates).toEqual([
      "blob:full-upload-source",
      "https://signed.test/preview.png",
      "data:image/jpeg;base64,preview",
      "https://cdn.example.com/fallback.png",
      "https://cdn.example.com/reference.png",
    ]);
  });

  it("rejects the current AI Studio document URL as an attachment image candidate", () => {
    expect(normalizeAttachmentImageUrl(window.location.href)).toBeNull();
  });
});
