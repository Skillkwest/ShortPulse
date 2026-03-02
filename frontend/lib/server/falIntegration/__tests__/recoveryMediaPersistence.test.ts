import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistRecoveryMediaFilesForGeneration,
  readExistingRecoveryMediaRows,
} from "../recoveryMediaPersistence";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type SupabaseScenario = {
  listResponses?: Array<{ data: unknown; error: unknown }>;
  insertResponses?: Array<{ data: unknown; error: unknown }>;
  duplicateLookupResponses?: Array<{ data: unknown; error: unknown }>;
  uploadResponses?: Array<{ error: unknown }>;
};

const createSupabaseScenario = (scenario: SupabaseScenario) => {
  const listResponses = [...(scenario.listResponses ?? [])];
  const insertResponses = [...(scenario.insertResponses ?? [])];
  const duplicateLookupResponses = [...(scenario.duplicateLookupResponses ?? [])];
  const uploadResponses = [...(scenario.uploadResponses ?? [])];

  const mediaFileInsertPayloads: Record<string, unknown>[] = [];
  const mediaEventInsertPayloads: Record<string, unknown>[] = [];

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

  const upload = vi.fn(async () => uploadResponses.shift() ?? { error: null });
  const remove = vi.fn(async () => ({ error: null }));
  const fromStorage = vi.fn(() => ({ upload, remove }));
  const fromTable = vi.fn((table: string) => {
    if (table === "media_files") return mediaFilesTable;
    if (table === "media_events") return mediaEventsTable;
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
    mediaFilesTable,
    mediaEventsTable,
  };
};

describe("recoveryMediaPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads existing recovery media rows with parsed output indexes", async () => {
    const scenario = createSupabaseScenario({
      listResponses: [
        {
          data: [
            { id: "media-1", metadata: { generation_output_index: 0 } },
            { id: "media-2", metadata: { generation_output_index: "2" } },
            { id: "media-3", metadata: { generation_output_index: "NaN" } },
            { id: null, metadata: { generation_output_index: 4 } },
          ],
          error: null,
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);

    const rows = await readExistingRecoveryMediaRows("gen-1");

    expect(rows).toEqual([
      { id: "media-1", index: 0 },
      { id: "media-2", index: 2 },
      { id: "media-3", index: null },
    ]);
  });

  it("returns already-persisted media ids without fetch/upload when coverage is complete", async () => {
    const scenario = createSupabaseScenario({
      listResponses: [
        {
          data: [
            { id: "media-1", metadata: { generation_output_index: 0 } },
            { id: "media-2", metadata: { generation_output_index: 1 } },
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

  it("persists recovery media and resolves duplicate inserts via indexed lookup", async () => {
    const scenario = createSupabaseScenario({
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
});
