import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPersistedCompletedPayload,
  readPersistedResultUrlsFromMetadata,
  readPersistedSuccessResultUrls,
} from "../../lib/server/api/falStatusPersistedResults";

const getSupabaseAdminMock = vi.fn();
let persistedGenerationRows: Array<Record<string, unknown>> = [];

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("falStatusPersistedResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistedGenerationRows = [];
    getSupabaseAdminMock.mockImplementation(() => {
      const queryChain = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: persistedGenerationRows, error: null }),
      };
      return {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(queryChain),
        }),
      };
    });
  });

  it("prefers result_urls and normalizes object entries", () => {
    expect(
      readPersistedResultUrlsFromMetadata({
        result_urls: [
          " https://cdn.shortpulse.test/video-a.mp4 ",
          { download_url: "https://cdn.shortpulse.test/video-b.mp4" },
          { video_url: "https://cdn.shortpulse.test/video-b.mp4" },
          "",
          null,
        ],
        media_urls: ["https://cdn.shortpulse.test/fallback.mp4"],
      })
    ).toEqual([
      "https://cdn.shortpulse.test/video-a.mp4",
      "https://cdn.shortpulse.test/video-b.mp4",
    ]);
  });

  it("falls back to media_urls when result_urls are absent", () => {
    expect(
      readPersistedResultUrlsFromMetadata({
        mediaUrls: [
          { image_url: "https://cdn.shortpulse.test/image-a.png" },
          { file_url: "https://cdn.shortpulse.test/file-a.bin" },
        ],
      })
    ).toEqual([
      "https://cdn.shortpulse.test/image-a.png",
      "https://cdn.shortpulse.test/file-a.bin",
    ]);
  });

  it("reads persisted success rows only", async () => {
    persistedGenerationRows = [
      {
        status: "processing",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/ignore-me.mp4"],
        },
      },
      {
        status: "success",
        metadata: {
          media_urls: [{ url: "https://cdn.shortpulse.test/final.mp4" }],
        },
      },
    ];

    await expect(
      readPersistedSuccessResultUrls({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual(["https://cdn.shortpulse.test/final.mp4"]);
  });

  it("builds the completed proxy payload shape", () => {
    expect(
      buildPersistedCompletedPayload({
        requestId: "req-1",
        resultUrls: ["https://cdn.shortpulse.test/final.mp4"],
      })
    ).toEqual({
      request_id: "req-1",
      status: "completed",
      state: "completed",
      resultUrls: ["https://cdn.shortpulse.test/final.mp4"],
      result_urls: ["https://cdn.shortpulse.test/final.mp4"],
      videos: [{ url: "https://cdn.shortpulse.test/final.mp4" }],
    });
  });
});
