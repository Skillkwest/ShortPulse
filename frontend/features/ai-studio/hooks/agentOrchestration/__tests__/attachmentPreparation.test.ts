import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareImageUrl } from "../../../logic/imageDescription";
import { prepareAgentImageAttachments } from "../attachmentPreparation";

vi.mock("../../../logic/imageDescription", () => ({
  prepareImageUrl: vi.fn(async (url: string) => url),
}));

const prepareImageUrlMock = vi.mocked(prepareImageUrl);

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
