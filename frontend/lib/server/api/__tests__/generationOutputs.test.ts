import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

import { persistGenerationOutputRecords } from "../generationOutputs";

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
});
