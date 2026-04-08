import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistRecoveryMediaFilesForGeneration,
  readExistingRecoveryMediaRows,
} from "../recoveryMediaPersistence";

const getSupabaseAdminMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type SupabaseScenario = {
  listResponses?: Array<{ data: unknown; error: unknown }>;
  insertResponses?: Array<{ data: unknown; error: unknown }>;
  duplicateLookupResponses?: Array<{ data: unknown; error: unknown }>;
  uploadResponses?: Array<{ error: unknown }>;
  generationOutputListResponses?: Array<{ data: unknown; error: unknown }>;
  generationOutputInsertResponses?: Array<{ error: unknown }>;
  generationOutputUpdateResponses?: Array<{ error: unknown }>;
};

const createSupabaseScenario = (scenario: SupabaseScenario) => {
  const listResponses = [...(scenario.listResponses ?? [])];
  const insertResponses = [...(scenario.insertResponses ?? [])];
  const duplicateLookupResponses = [...(scenario.duplicateLookupResponses ?? [])];
  const uploadResponses = [...(scenario.uploadResponses ?? [])];
  const generationOutputListResponses = [...(scenario.generationOutputListResponses ?? [])];
  const generationOutputInsertResponses = [...(scenario.generationOutputInsertResponses ?? [])];
  const generationOutputUpdateResponses = [...(scenario.generationOutputUpdateResponses ?? [])];

  const mediaFileInsertPayloads: Record<string, unknown>[] = [];
  const mediaEventInsertPayloads: Record<string, unknown>[] = [];
  const generationOutputInsertPayloads: Record<string, unknown>[] = [];
  const generationOutputUpdatePayloads: Record<string, unknown>[] = [];

  const mediaFilesTable = {
    select: vi.fn((fields: string) => {
      if (fields === "id, metadata") {
        const limit = vi.fn(async () => listResponses.shift() ?? { data: [], error: null });
        const order = vi.fn(() => ({ limit }));
        const secondEq = vi.fn(() => ({ order }));
        return { eq: vi.fn(() => ({ eq: secondEq })) };
      }

      if (fields === "id") {
        const maybeSingle = vi.fn(
          async () => duplicateLookupResponses.shift() ?? { data: null, error: null }
        );
        const limit = vi.fn(() => ({ maybeSingle }));
        const contains = vi.fn(() => ({ limit }));
        const secondEq = vi.fn(() => ({ contains }));
        return { eq: vi.fn(() => ({ eq: secondEq })) };
      }

      throw new Error(`Unexpected select fields: ${fields}`);
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      mediaFileInsertPayloads.push(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => insertResponses.shift() ?? { data: null, error: null }),
        })),
      };
    }),
  };

  const mediaEventsTable = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      mediaEventInsertPayloads.push(payload);
      return Promise.resolve({ error: null });
    }),
  };

  const aiGenerationOutputsTable = {
    select: vi.fn((fields: string) => {
      if (fields === "id, output_index, result_url, media_file_id") {
        const limit = vi.fn(
          async () => generationOutputListResponses.shift() ?? { data: [], error: null }
        );
        const order = vi.fn(() => ({ limit }));
        const secondEq = vi.fn(() => ({ order }));
        return { eq: vi.fn(() => ({ eq: secondEq })) };
      }

      throw new Error(`Unexpected ai_generation_outputs select fields: ${fields}`);
    }),
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      generationOutputInsertPayloads.push(payload);
      return generationOutputInsertResponses.shift() ?? { error: null };
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      generationOutputUpdatePayloads.push(payload);
      const secondEq = vi.fn(
        async () => generationOutputUpdateResponses.shift() ?? { error: null }
      );
      return { eq: vi.fn(() => ({ eq: secondEq })) };
    }),
  };

  const upload = vi.fn(async () => uploadResponses.shift() ?? { error: null });
  const remove = vi.fn(async () => ({ error: null }));
  const fromStorage = vi.fn(() => ({ upload, remove }));
  const fromTable = vi.fn((table: string) => {
    if (table === "media_files") return mediaFilesTable;
    if (table === "media_events") return mediaEventsTable;
    if (table === "ai_generation_outputs") return aiGenerationOutputsTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    adminClient: {
      from: fromTable,
      storage: { from: fromStorage },
    },
    upload,
    remove,
    mediaFileInsertPayloads,
    mediaEventInsertPayloads,
    generationOutputInsertPayloads,
    generationOutputUpdatePayloads,
    mediaFilesTable,
    mediaEventsTable,
    aiGenerationOutputsTable,
  };
};

describe("recoveryMediaPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS = "true";
    process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS = "cdn.shortpulse.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("reads existing recovery media rows with parsed output indexes", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: "https://cdn.shortpulse.test/generated-a.png",
              media_file_id: "canonical-media-1",
            },
          ],
          error: null,
        },
      ],
      listResponses: [
        {
          data: [
            { id: "legacy-media-1", metadata: { generation_output_index: 0 } },
            { id: "media-2", metadata: { generation_output_index: "2" } },
            { id: "media-3", metadata: { generation_output_index: "NaN" } },
            { id: null, metadata: { generation_output_index: 4 } },
          ],
          error: null,
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);

    const rows = await readExistingRecoveryMediaRows("gen-1", "user-1");

    expect(rows).toEqual([
      { id: "canonical-media-1", index: 0 },
      { id: "media-2", index: 2 },
      { id: "media-3", index: null },
    ]);
  });

  it("returns already-persisted canonical media ids without fetch/upload when coverage is complete", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: "https://cdn.shortpulse.test/a.png",
              media_file_id: "media-1",
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: "https://cdn.shortpulse.test/b.png",
              media_file_id: "media-2",
            },
          ],
          error: null,
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ids = await persistRecoveryMediaFilesForGeneration({
      generation: {
        id: "gen-1",
        user_id: "user-1",
        request_id: "req-1",
        model_id: "fal-ai/nano-banana-pro",
        provider: "fal",
        prompt_text: "cinematic portrait",
        metadata: {},
      },
      mediaUrls: ["https://cdn.shortpulse.test/a.png", "https://cdn.shortpulse.test/b.png"],
    });

    expect(ids).toEqual(["media-1", "media-2"]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(scenario.upload).not.toHaveBeenCalled();
    expect(scenario.mediaFilesTable.insert).not.toHaveBeenCalled();
    expect(scenario.mediaEventsTable.insert).not.toHaveBeenCalled();
  });

  it("persists recovery media and updates canonical output rows during insert and duplicate fallback", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: "https://cdn.shortpulse.test/frame-a.png",
              media_file_id: null,
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: "https://cdn.shortpulse.test/frame-b.mp4",
              media_file_id: null,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: "https://cdn.shortpulse.test/frame-a.png",
              media_file_id: null,
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: "https://cdn.shortpulse.test/frame-b.mp4",
              media_file_id: null,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: "https://cdn.shortpulse.test/frame-a.png",
              media_file_id: null,
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: "https://cdn.shortpulse.test/frame-b.mp4",
              media_file_id: null,
            },
          ],
          error: null,
        },
      ],
      listResponses: [{ data: [], error: null }],
      insertResponses: [
        { data: { id: "media-new-1" }, error: null },
        { data: null, error: { code: "23505", message: "duplicate key value" } },
      ],
      duplicateLookupResponses: [{ data: { id: "media-existing-2" }, error: null }],
      uploadResponses: [{ error: null }, { error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      )
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([4, 5, 6, 7]), {
          status: 200,
          headers: { "content-type": "video/mp4" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const mediaFileIds = await persistRecoveryMediaFilesForGeneration({
      generation: {
        id: "gen-1",
        user_id: "user-1",
        request_id: "req-1",
        model_id: "fal-ai/veo3.1",
        provider: "fal",
        prompt_text: "Animate stills",
        metadata: {
          generation_trace_id: "trace-1",
          submission_trace_id: "sub-1",
        },
      },
      mediaUrls: [
        "https://cdn.shortpulse.test/frame-a.png",
        "https://cdn.shortpulse.test/frame-b.mp4",
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(scenario.upload).toHaveBeenCalledTimes(2);
    expect(scenario.remove).toHaveBeenCalledTimes(1);
    expect(mediaFileIds).toEqual(["media-new-1", "media-existing-2"]);
    expect(scenario.mediaFileInsertPayloads).toHaveLength(2);
    expect(scenario.generationOutputInsertPayloads).toEqual([]);
    expect(scenario.generationOutputUpdatePayloads).toEqual([
      expect.objectContaining({
        media_file_id: "media-new-1",
      }),
      expect.objectContaining({
        media_file_id: "media-existing-2",
      }),
    ]);
    expect(scenario.mediaFileInsertPayloads[0]).toEqual(
      expect.objectContaining({
        source_ref: "gen-1",
        source: "ai_studio",
        file_type: "image",
        metadata: expect.objectContaining({
          generation_output_index: 0,
          generation_trace_id: "trace-1",
          submission_trace_id: "sub-1",
        }),
      })
    );
    expect(scenario.mediaFileInsertPayloads[1]).toEqual(
      expect.objectContaining({
        source_ref: "gen-1",
        file_type: "video",
        metadata: expect.objectContaining({
          generation_output_index: 1,
        }),
      })
    );
    expect(scenario.mediaEventInsertPayloads).toEqual([
      expect.objectContaining({
        entity_id: "gen-1",
        metadata: expect.objectContaining({
          media_file_ids: ["media-new-1", "media-existing-2"],
        }),
      }),
    ]);
  });

  it("starts uncached media fetches concurrently and preserves output order", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      listResponses: [{ data: [], error: null }],
      insertResponses: [
        { data: { id: "media-new-1" }, error: null },
        { data: { id: "media-new-2" }, error: null },
      ],
      uploadResponses: [{ error: null }, { error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);

    let resolveFirstFetch: ((value: Response) => void) | null = null;
    let resolveSecondFetch: ((value: Response) => void) | null = null;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirstFetch = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondFetch = resolve;
          })
      );
    vi.stubGlobal("fetch", fetchMock);

    const pendingPersistence = persistRecoveryMediaFilesForGeneration({
      generation: {
        id: "gen-2",
        user_id: "user-1",
        request_id: "req-2",
        model_id: "fal-ai/nano-banana-pro",
        provider: "fal",
        prompt_text: "rapid parallel frames",
        metadata: {},
      },
      mediaUrls: [
        "https://cdn.shortpulse.test/parallel-a.png",
        "https://cdn.shortpulse.test/parallel-b.png",
      ],
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const firstFetchResolver = resolveFirstFetch as ((value: Response) => void) | null;
    if (firstFetchResolver) {
      firstFetchResolver(
        new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      );
    }
    const secondFetchResolver = resolveSecondFetch as ((value: Response) => void) | null;
    if (secondFetchResolver) {
      secondFetchResolver(
        new Response(Uint8Array.from([4, 5, 6]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      );
    }

    const mediaFileIds = await pendingPersistence;

    expect(mediaFileIds).toEqual(["media-new-1", "media-new-2"]);
    expect(scenario.upload).toHaveBeenCalledTimes(2);
    expect(scenario.mediaFileInsertPayloads).toHaveLength(2);
    expect(scenario.mediaEventInsertPayloads).toEqual([
      expect.objectContaining({
        entity_id: "gen-2",
        metadata: expect.objectContaining({
          media_file_ids: ["media-new-1", "media-new-2"],
        }),
      }),
    ]);
  });

  it("rejects untrusted recovery media urls before fetch", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [{ data: [], error: null }],
      listResponses: [{ data: [], error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      persistRecoveryMediaFilesForGeneration({
        generation: {
          id: "gen-1",
          user_id: "user-1",
          request_id: "req-1",
          model_id: "fal-ai/veo3.1",
          provider: "fal",
          prompt_text: "Animate stills",
          metadata: {},
        },
        mediaUrls: ["https://malicious.example.com/frame-a.png"],
      })
    ).rejects.toThrow("Untrusted recovery media URL blocked");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(scenario.upload).not.toHaveBeenCalled();
  });

  it("accepts trusted provider-host recovery media urls without media preview allowlist", async () => {
    delete process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS;
    delete process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS;
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [{ data: [], error: null }],
      listResponses: [{ data: [], error: null }],
      insertResponses: [{ data: { id: "media-new-1" }, error: null }],
      uploadResponses: [{ error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      persistRecoveryMediaFilesForGeneration({
        generation: {
          id: "gen-1",
          user_id: "user-1",
          request_id: "req-1",
          model_id: "fal-ai/veo3.1",
          provider: "fal",
          prompt_text: "Animate stills",
          metadata: {},
        },
        mediaUrls: ["https://queue.fal.run/fal-ai/veo3.1/result.png"],
      })
    ).resolves.toEqual(["media-new-1"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
