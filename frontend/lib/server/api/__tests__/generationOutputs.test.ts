import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

import {
  attachMediaFileToGenerationOutput,
  persistGenerationOutputRecords,
} from "../generationOutputs";

type OutputRow = {
  id: string;
  output_index: number;
  result_url: string;
  media_file_id: string | null;
};

const createAdminClient = ({
  upsertRows,
  rereadRows = [],
}: {
  upsertRows: OutputRow[];
  rereadRows?: OutputRow[];
}) => {
  const from = vi.fn((table: string) => {
    if (table !== "ai_generation_outputs") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      upsert: vi.fn(() => ({
        select: vi.fn(async (fields: string) => {
          if (fields !== "id, output_index, result_url, media_file_id") {
            throw new Error(`Unexpected upsert select fields: ${fields}`);
          }
          return {
            data: upsertRows,
            error: null,
          };
        }),
      })),
      select: vi.fn((fields: string) => {
        if (fields !== "id, output_index, result_url, media_file_id") {
          throw new Error(`Unexpected reread select fields: ${fields}`);
        }
        const builder = {
          eq: vi.fn(),
          order: vi.fn(),
          limit: vi.fn(async () => ({
            data: rereadRows,
            error: null,
          })),
        };
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        return builder;
      }),
    };
  });

  return { from };
};

describe("generationOutputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-reads authoritative output rows when the upsert response omits expected media ids", async () => {
    const adminClient = createAdminClient({
      upsertRows: [
        {
          id: "output-1",
          output_index: 0,
          result_url: "https://provider.example/out-1.png",
          media_file_id: null,
        },
      ],
      rereadRows: [
        {
          id: "output-1",
          output_index: 0,
          result_url: "https://provider.example/out-1.png",
          media_file_id: "media-1",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(adminClient);

    const result = await persistGenerationOutputRecords({
      generationId: "gen-1",
      userId: "user-1",
      resultUrls: ["https://provider.example/out-1.png"],
      mediaFileIds: ["media-1"],
      metadata: {
        test_case: "stale_upsert_response",
      },
    });

    expect(result).toEqual([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://provider.example/out-1.png",
        mediaFileId: "media-1",
      },
    ]);
    expect(adminClient.from).toHaveBeenCalledTimes(2);
  });

  it("uses an injected Supabase admin client when persisting output records", async () => {
    const adminClient = createAdminClient({
      upsertRows: [
        {
          id: "output-1",
          output_index: 0,
          result_url: "https://provider.example/out-1.png",
          media_file_id: "media-1",
        },
      ],
    });

    const result = await persistGenerationOutputRecords({
      generationId: "gen-1",
      userId: "user-1",
      resultUrls: ["https://provider.example/out-1.png"],
      mediaFileIds: ["media-1"],
      supabaseAdmin: adminClient as never,
    });

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(adminClient.from).toHaveBeenCalledWith("ai_generation_outputs");
    expect(adminClient.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://provider.example/out-1.png",
        mediaFileId: "media-1",
      },
    ]);
  });

  it("uses an injected Supabase admin client when attaching media to an output", async () => {
    const updateMock = vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
    }));
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table !== "ai_generation_outputs") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn(async () => ({
              data: [
                {
                  id: "output-1",
                  output_index: 0,
                  result_url: "https://provider.example/out-1.png",
                  media_file_id: null,
                },
              ],
              error: null,
            })),
          })),
          update: updateMock,
        };
      }),
    };

    await attachMediaFileToGenerationOutput({
      generationId: "gen-1",
      userId: "user-1",
      outputIndex: 0,
      mediaFileId: "media-1",
      supabaseAdmin: adminClient as never,
    });

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(adminClient.from).toHaveBeenCalledWith("ai_generation_outputs");
    expect(updateMock).toHaveBeenCalledWith({
      media_file_id: "media-1",
      updated_at: expect.any(String),
    });
  });
});
