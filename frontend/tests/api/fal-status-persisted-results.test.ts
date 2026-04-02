import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPersistedCompletedPayload,
  readPersistedGenerationStatusContext,
  readPersistedResultUrlsFromMetadata,
  readPersistedSuccessResultUrls,
} from "../../lib/server/api/falStatusPersistedResults";

const getSupabaseAdminMock = vi.fn();
let persistedProjectionRows: Array<Record<string, unknown>> = [];
let persistedGenerationRows: Array<Record<string, unknown>> = [];
let persistedOutputRows: Array<Record<string, unknown>> = [];
let outputEqCalls: Array<[string, unknown]> = [];

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("falStatusPersistedResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistedProjectionRows = [];
    persistedGenerationRows = [];
    persistedOutputRows = [];
    outputEqCalls = [];
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
      outputQueryChain.eq.mockImplementation((field: string, value: unknown) => {
        outputEqCalls.push([field, value]);
        return outputQueryChain;
      });
      outputQueryChain.order.mockReturnValue(outputQueryChain);

      const projectionQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedProjectionRows, error: null })),
      };
      projectionQueryChain.eq.mockReturnValue(projectionQueryChain);
      projectionQueryChain.order.mockReturnValue(projectionQueryChain);

      return {
        from: vi.fn((tableName: string) => {
          if (tableName === "generation_projection") {
            return {
              select: vi.fn().mockReturnValue(projectionQueryChain),
            };
          }

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
        id: "gen-processing-1",
        status: "processing",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/ignore-me.mp4"],
        },
      },
      {
        id: "gen-success-1",
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

  it("returns the successful generation id when metadata fallback is used", async () => {
    persistedGenerationRows = [
      {
        id: "gen-processing-1",
        status: "processing",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/ignore-me.mp4"],
        },
      },
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/final.mp4"],
        },
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-success-1",
      resultUrls: ["https://cdn.shortpulse.test/final.mp4"],
    });
  });

  it("prefers generation projection result urls before ai_generations fallback", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-1",
        result_urls: ["https://cdn.shortpulse.test/projection-a.mp4"],
        status: "ready",
        task_state: "success",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-projection-1",
      resultUrls: ["https://cdn.shortpulse.test/projection-a.mp4"],
    });
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

  it("scopes canonical persisted output reads to the successful generation row", async () => {
    persistedGenerationRows = [
      {
        id: "gen-processing-1",
        status: "processing",
        metadata: {},
      },
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];
    persistedOutputRows = [
      { output_index: 0, result_url: "https://cdn.shortpulse.test/output-a.mp4" },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-success-1",
      resultUrls: ["https://cdn.shortpulse.test/output-a.mp4"],
    });

    expect(outputEqCalls).toContainEqual(["generation_id", "gen-success-1"]);
    expect(outputEqCalls).not.toContainEqual(["generation_id", "gen-processing-1"]);
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
