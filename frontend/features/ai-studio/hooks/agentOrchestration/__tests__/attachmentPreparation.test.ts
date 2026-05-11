import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareImageUrl } from "../../../logic/imageDescription";
import { prepareAgentImageAttachments } from "../attachmentPreparation";
import { resolveAgentAttachmentPreviewUrl } from "../../../logic/agentAttachmentImage";

vi.mock("../../../logic/imageDescription", () => ({
  prepareImageUrl: vi.fn(async (url: string) => url),
}));

vi.mock("../../../logic/agentAttachmentImage", () => ({
  resolveAgentAttachmentPreviewUrl: vi.fn(async () => null),
}));

const prepareImageUrlMock = vi.mocked(prepareImageUrl);
const resolveAgentAttachmentPreviewUrlMock = vi.mocked(resolveAgentAttachmentPreviewUrl);

describe("prepareAgentImageAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when an image attachment is missing URL", async () => {
    const result = await prepareAgentImageAttachments({
      attachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "",
          text: null,
          aspect: null,
        },
      ],
      preparedImageUrlCache: new Map(),
    });

    expect(result).toEqual({
      ok: false,
      reason: "missing_url",
      failedIds: ["img-1"],
    });
    expect(prepareImageUrlMock).not.toHaveBeenCalled();
  });

  it("uses durable attachment identity to resolve a sendable image URL", async () => {
    resolveAgentAttachmentPreviewUrlMock.mockResolvedValueOnce("https://cdn.test/resolved.png");
    prepareImageUrlMock.mockResolvedValueOnce("https://cdn.test/prepared.png");

    const result = await prepareAgentImageAttachments({
      attachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "",
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
          text: null,
          aspect: null,
        },
      ],
      preparedImageUrlCache: new Map(),
    });

    expect(result).toEqual({
      ok: true,
      imageAttachmentIds: ["img-1"],
      preparedImageUrls: new Map([["img-1", "https://cdn.test/prepared.png"]]),
    });
    expect(resolveAgentAttachmentPreviewUrlMock).toHaveBeenCalledTimes(1);
    expect(prepareImageUrlMock).toHaveBeenCalledWith("https://cdn.test/resolved.png");
  });

  it("reuses cached prepared URL for repeated calls", async () => {
    prepareImageUrlMock.mockResolvedValue("https://cdn.test/prepared.png");
    const cache = new Map<string, { safeUrl: string; expiresAtMs: number }>();
    const attachments = [
      {
        id: "img-1",
        kind: "image" as const,
        imageUrl: "https://cdn.test/source.png",
        text: null,
        aspect: null,
      },
    ];

    const first = await prepareAgentImageAttachments({
      attachments,
      preparedImageUrlCache: cache,
    });
    const second = await prepareAgentImageAttachments({
      attachments,
      preparedImageUrlCache: cache,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(prepareImageUrlMock).toHaveBeenCalledTimes(1);
  });
});
