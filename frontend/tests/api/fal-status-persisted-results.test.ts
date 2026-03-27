import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPersistedCompletedPayload,
  readPersistedGenerationStatusContext,
  readPersistedResultUrlsFromMetadata,
  readPersistedSuccessResultUrls,
} from "../../lib/server/api/falStatusPersistedResults";

const getSupabaseAdminMock = vi.fn();
let persistedGenerationRows: Array<Record<string, unknown>> = [];
let persistedOutputRows: Array<Record<string, unknown>> = [];

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("falStatusPersistedResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistedGenerationRows = [];
    persistedOutputRows = [];
    getSupabaseAdminMock.mockImplementation(() => {
      const generationQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedGenerationRows, error: null })),
      };
      generationQueryChain.eq.mockReturnValue(generationQueryChain);
      generationQueryChain.order.mockReturnValue(generationQueryChain);

      const outputQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedOutputRows, error: null })),
      };
      outputQueryChain.eq.mockReturnValue(outputQueryChain);
      outputQueryChain.order.mockReturnValue(outputQueryChain);

      return {
        from: vi.fn((tableName: string) => {
          if (tableName === "ai_generations") {
            return {
              select: vi.fn().mockReturnValue(generationQueryChain),
            };
          }

          if (tableName === "ai_generation_outputs") {
            return {
              select: vi.fn().mockReturnValue(outputQueryChain),
            };
          }

          throw new Error(`Unexpected table ${tableName}`);
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

  it("prefers canonical persisted generation outputs over metadata result urls", async () => {
    persistedGenerationRows = [
      {
        id: "gen-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];
    persistedOutputRows = [
      { output_index: 1, result_url: "https://cdn.shortpulse.test/output-b.mp4" },
      { output_index: 0, result_url: "https://cdn.shortpulse.test/output-a.mp4" },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-1",
      resultUrls: [
        "https://cdn.shortpulse.test/output-a.mp4",
        "https://cdn.shortpulse.test/output-b.mp4",
      ],
    });
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
