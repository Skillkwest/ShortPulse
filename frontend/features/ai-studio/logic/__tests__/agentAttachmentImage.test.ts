import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(async () => null),
}));

vi.mock("../../utils/imageUpload", () => ({
  refreshSupabaseSignedUrlIfNeeded: vi.fn(async (value: string) => value),
}));

import {
  normalizeAttachmentImageUrl,
  resolveAgentAttachmentPreviewUrl,
} from "../agentAttachmentImage";

describe("agentAttachmentImage", () => {
  it("prefers the staged imageUrl before a weaker referenceUrl", async () => {
    const resolvedUrl = await resolveAgentAttachmentPreviewUrl({
      previewStoragePath: null,
      fullStoragePath: null,
      referenceRenderUrl: null,
      referenceUrl: "https://cdn.example.com/weaker-reference.png",
      imageUrl: "https://cdn.example.com/rendered-preview.png",
    });

    expect(resolvedUrl).toBe("https://cdn.example.com/rendered-preview.png");
  });

  it("rejects the current AI Studio document URL as an attachment image candidate", () => {
    expect(normalizeAttachmentImageUrl(window.location.href)).toBeNull();
  });
});
