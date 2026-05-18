import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareAgentImageAttachments } from "../attachmentPreparation";
import { resolveAgentAttachmentSubmissionCandidates } from "../../../logic/agentAttachmentImage";
import { prepareImageUrlForSubmission } from "../../../utils/imageUpload";

vi.mock("../../../utils/imageUpload", () => ({
  prepareImageUrlForSubmission: vi.fn(async (url: string) => url),
}));

vi.mock("../../../logic/agentAttachmentImage", () => ({
  normalizeAttachmentImageUrl: (value: string | null | undefined) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  resolveAgentAttachmentSubmissionCandidates: vi.fn(
    async (attachment: {
      submissionImageUrl?: string | null;
      imageUrl?: string | null;
      imageFallbackUrls?: string[] | null;
      referenceRenderUrl?: string | null;
      referenceUrl?: string | null;
    }) =>
      [
        attachment.submissionImageUrl,
        attachment.imageUrl,
        ...(attachment.imageFallbackUrls ?? []),
        attachment.referenceRenderUrl,
        attachment.referenceUrl,
      ].filter((value): value is string => Boolean(value?.trim()))
  ),
}));

const prepareImageUrlForSubmissionMock = vi.mocked(prepareImageUrlForSubmission);
const resolveAgentAttachmentSubmissionCandidatesMock = vi.mocked(
  resolveAgentAttachmentSubmissionCandidates
);

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
    expect(prepareImageUrlForSubmissionMock).not.toHaveBeenCalled();
  });

  it("uses durable attachment identity to resolve a sendable image URL", async () => {
    resolveAgentAttachmentSubmissionCandidatesMock.mockResolvedValueOnce([
      "https://cdn.test/resolved.png",
    ]);
    prepareImageUrlForSubmissionMock.mockResolvedValueOnce("https://cdn.test/prepared.png");

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
    expect(resolveAgentAttachmentSubmissionCandidatesMock).toHaveBeenCalledTimes(1);
    expect(prepareImageUrlForSubmissionMock).toHaveBeenCalledWith(
      "https://cdn.test/resolved.png",
      expect.objectContaining({
        onStage: expect.any(Function),
      })
    );
  });

  it("prefers the dedicated submission image source over preview resolution", async () => {
    prepareImageUrlForSubmissionMock.mockResolvedValueOnce(
      "https://cdn.test/prepared-uploaded.png"
    );

    const result = await prepareAgentImageAttachments({
      attachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "blob:tiny-preview",
          submissionImageUrl: "blob:full-upload-source",
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
      preparedImageUrls: new Map([["img-1", "https://cdn.test/prepared-uploaded.png"]]),
    });
    expect(prepareImageUrlForSubmissionMock).toHaveBeenCalledWith(
      "blob:full-upload-source",
      expect.objectContaining({
        onStage: expect.any(Function),
      })
    );
  });

  it("falls back to durable identity when the dedicated submission source can no longer prepare", async () => {
    resolveAgentAttachmentSubmissionCandidatesMock.mockResolvedValueOnce([
      "blob:full-upload-source",
      "https://cdn.test/resolved.png",
    ]);
    prepareImageUrlForSubmissionMock.mockRejectedValueOnce(new Error("Local blob expired."));
    prepareImageUrlForSubmissionMock.mockResolvedValueOnce("https://cdn.test/prepared.png");

    const result = await prepareAgentImageAttachments({
      attachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "data:image/jpeg;base64,preview",
          submissionImageUrl: "blob:full-upload-source",
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
          referenceUrl: "https://cdn.test/reference.png",
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
    expect(prepareImageUrlForSubmissionMock).toHaveBeenNthCalledWith(
      1,
      "blob:full-upload-source",
      expect.objectContaining({
        onStage: expect.any(Function),
      })
    );
    expect(prepareImageUrlForSubmissionMock).toHaveBeenNthCalledWith(
      2,
      "https://cdn.test/resolved.png",
      expect.objectContaining({
        onStage: expect.any(Function),
      })
    );
  });

  it("uses the shared projected preview when a legacy image attachment only has render-hint preview fields", async () => {
    prepareImageUrlForSubmissionMock.mockResolvedValueOnce("https://cdn.test/prepared-legacy.png");

    const result = await prepareAgentImageAttachments({
      attachments: [
        {
          id: "img-legacy-1",
          kind: "image",
          imageUrl: "",
          referenceRenderUrl: "https://cdn.test/legacy-preview.png",
          text: null,
          aspect: null,
        },
      ],
      preparedImageUrlCache: new Map(),
    });

    expect(result).toEqual({
      ok: true,
      imageAttachmentIds: ["img-legacy-1"],
      preparedImageUrls: new Map([["img-legacy-1", "https://cdn.test/prepared-legacy.png"]]),
    });
    expect(prepareImageUrlForSubmissionMock).toHaveBeenCalledWith(
      "https://cdn.test/legacy-preview.png",
      expect.objectContaining({
        onStage: expect.any(Function),
      })
    );
  });

  it("reuses cached prepared URL for repeated calls", async () => {
    prepareImageUrlForSubmissionMock.mockResolvedValue("https://cdn.test/prepared.png");
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
    expect(prepareImageUrlForSubmissionMock).toHaveBeenCalledTimes(1);
  });

  it("returns per-attachment failure messages when all candidates fail", async () => {
    resolveAgentAttachmentSubmissionCandidatesMock.mockResolvedValueOnce([
      "blob:full-upload-source",
      "https://cdn.test/resolved.png",
    ]);
    prepareImageUrlForSubmissionMock.mockRejectedValueOnce(new Error("Local blob expired."));
    prepareImageUrlForSubmissionMock.mockRejectedValueOnce(
      new Error("Reference URL expired and could not be refreshed. Please reselect the image.")
    );

    const result = await prepareAgentImageAttachments({
      attachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "data:image/jpeg;base64,preview",
          submissionImageUrl: "blob:full-upload-source",
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
          referenceUrl: "https://cdn.test/reference.png",
          text: null,
          aspect: null,
        },
      ],
      preparedImageUrlCache: new Map(),
    });

    expect(result).toEqual({
      ok: false,
      reason: "prepare_failed",
      failedIds: ["img-1"],
      attemptedCount: 1,
      failureMessages: {
        "img-1": "Local blob expired.",
      },
    });
  });
});
