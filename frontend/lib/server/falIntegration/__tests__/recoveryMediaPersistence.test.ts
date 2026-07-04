import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertVideoPosterVariantFromBufferMock = vi.fn();
const upsertVideoPreviewVariantFromBufferMock = vi.fn();

vi.mock("../../videoPosterVariant", () => ({
  upsertVideoPosterVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPosterVariantFromBufferMock(...args),
  upsertVideoPreviewVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPreviewVariantFromBufferMock(...args),
}));

import {
  persistRecoveryMediaFilesForGeneration,
  readExistingRecoveryMediaRows,
} from "../recoveryMediaPersistence";
import { MAX_SUPABASE_STANDARD_UPLOAD_BYTES } from "../../mediaIngest";

const getSupabaseAdminMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };
const trustedUserPreviewUrl = (userId: string, filename: string): string =>
  `https://cdn.shortpulse.test/${userId}/${filename}`;

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type SupabaseScenario = {
  listResponses?: Array<{ data: unknown; error: unknown }>;
  insertResponses?: Array<{ data: unknown; error: unknown }>;
  duplicateLookupResponses?: Array<{ data: unknown; error: unknown }>;
  uploadResponses?: Array<{ error: unknown }>;
  storageLookupRows?: Array<{ id: string; storage_path: string }>;
  generationOutputListResponses?: Array<{ data: unknown; error: unknown }>;
  generationOutputInsertResponses?: Array<{ error: unknown }>;
  generationOutputUpdateResponses?: Array<{ error: unknown }>;
};

const cloneResponse = <T>(response: T): T => structuredClone(response);

const shiftOrReuseLast = <T>(queue: T[], fallback: T): T => {
  if (queue.length > 1) return cloneResponse(queue.shift() as T);
  if (queue.length === 1) return cloneResponse(queue[0] as T);
  return cloneResponse(fallback);
};

type QueryBuilderStub = {
  eq: ReturnType<typeof vi.fn>;
  order?: ReturnType<typeof vi.fn>;
  contains?: ReturnType<typeof vi.fn>;
};

const createSupabaseScenario = (scenario: SupabaseScenario) => {
  const listResponses = [...(scenario.listResponses ?? [])];
  const insertResponses = [...(scenario.insertResponses ?? [])];
  const duplicateLookupResponses = [...(scenario.duplicateLookupResponses ?? [])];
  const uploadResponses = [...(scenario.uploadResponses ?? [])];
  const generationOutputInsertResponses = [...(scenario.generationOutputInsertResponses ?? [])];
  const generationOutputUpdateResponses = [...(scenario.generationOutputUpdateResponses ?? [])];

  const mediaFileInsertPayloads: Record<string, unknown>[] = [];
  const mediaEventInsertPayloads: Record<string, unknown>[] = [];
  const generationOutputInsertPayloads: Record<string, unknown>[] = [];
  const generationOutputUpdatePayloads: Record<string, unknown>[] = [];
  const generationPublicationUpsertPayloads: Record<string, unknown>[] = [];
  const generationProjectionUpsertPayloads: Record<string, unknown>[] = [];
  const mediaFileListFilters: Array<{ column: string; value: unknown }> = [];
  const duplicateLookupFilters: Array<{ column: string; value: unknown }> = [];
  const generationOutputRows = Array.isArray(scenario.generationOutputListResponses?.[0]?.data)
    ? structuredClone(scenario.generationOutputListResponses?.[0]?.data)
    : [];
  const mediaStorageRows = [
    ...(scenario.storageLookupRows ?? []).map((row) => ({ ...row })),
    ...mediaFileInsertPayloads,
  ];

  const mediaFilesTable = {
    select: vi.fn((fields: string) => {
      if (fields === "id, metadata") {
        const limit = vi.fn(async () => shiftOrReuseLast(listResponses, { data: [], error: null }));
        const builder: QueryBuilderStub = {
          eq: vi.fn(),
          order: vi.fn(() => ({ limit })),
        };
        builder.eq.mockImplementation((column: string, value: unknown) => {
          mediaFileListFilters.push({ column, value });
          return builder;
        });
        return builder;
      }

      if (
        fields === "id, storage_path" ||
        fields ===
          "id, storage_path, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
      ) {
        const limit = vi.fn(async () => ({
          data: mediaStorageRows
            .map((row) => {
              const rowRecord = row as Record<string, unknown>;
              return {
                id: typeof row.id === "string" ? row.id : null,
                storage_path: typeof row.storage_path === "string" ? row.storage_path : null,
                file_type: typeof rowRecord.file_type === "string" ? rowRecord.file_type : "image",
                poster_variant_path:
                  typeof rowRecord.poster_variant_path === "string"
                    ? rowRecord.poster_variant_path
                    : null,
                thumb_variant_path:
                  typeof rowRecord.thumb_variant_path === "string"
                    ? rowRecord.thumb_variant_path
                    : null,
                preview_variant_path:
                  typeof rowRecord.preview_variant_path === "string"
                    ? rowRecord.preview_variant_path
                    : null,
                user_id: typeof rowRecord.user_id === "string" ? rowRecord.user_id : null,
              };
            })
            .filter(
              (
                row
              ): row is {
                id: string;
                storage_path: string;
                file_type: string;
                thumb_variant_path: string | null;
                poster_variant_path: string | null;
                preview_variant_path: string | null;
                user_id: string | null;
              } => Boolean(row.id && row.storage_path)
            ),
          error: null,
        }));
        const builder = {
          eq: vi.fn(),
          in: vi.fn(),
          limit,
        };
        builder.eq.mockReturnValue(builder);
        builder.in.mockReturnValue(builder);
        return builder;
      }

      if (fields === "id") {
        const maybeSingle = vi.fn(async () =>
          shiftOrReuseLast(duplicateLookupResponses, { data: null, error: null })
        );
        const limit = vi.fn(() => ({ maybeSingle }));
        const builder: QueryBuilderStub = {
          eq: vi.fn(),
          contains: vi.fn(() => ({ limit })),
        };
        builder.eq.mockImplementation((column: string, value: unknown) => {
          duplicateLookupFilters.push({ column, value });
          return builder;
        });
        return builder;
      }

      throw new Error(`Unexpected select fields: ${fields}`);
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      mediaFileInsertPayloads.push(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => {
            const response = shiftOrReuseLast(insertResponses, { data: null, error: null });
            const insertedId =
              response.data && typeof response.data === "object" && !Array.isArray(response.data)
                ? (response.data as Record<string, unknown>).id
                : null;
            if (typeof insertedId === "string") {
              const target = mediaFileInsertPayloads[mediaFileInsertPayloads.length - 1];
              target.id = insertedId;
              const storagePath =
                typeof target.storage_path === "string" ? target.storage_path : null;
              if (storagePath) {
                mediaStorageRows.push({
                  id: insertedId,
                  storage_path: storagePath,
                });
              }
            }
            return response;
          }),
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
      if (fields === "id, output_index, result_url, media_file_id, metadata") {
        const limit = vi.fn(async () => ({
          data: structuredClone(generationOutputRows),
          error: null,
        }));
        const order = vi.fn(() => ({ limit }));
        const secondEq = vi.fn(() => ({ order }));
        return { eq: vi.fn(() => ({ eq: secondEq })) };
      }

      throw new Error(`Unexpected ai_generation_outputs select fields: ${fields}`);
    }),
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      generationOutputInsertPayloads.push(payload);
      const response = shiftOrReuseLast(generationOutputInsertResponses, { error: null });
      if (!response.error) {
        generationOutputRows.push({
          id: `output-${generationOutputRows.length + 1}`,
          output_index: payload.output_index,
          result_url: payload.result_url,
          media_file_id: payload.media_file_id ?? null,
          metadata: payload.metadata ?? {},
        });
      }
      return response;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      generationOutputUpdatePayloads.push(payload);
      const eqUserId = vi.fn(async () =>
        shiftOrReuseLast(generationOutputUpdateResponses, { error: null })
      );
      const eqId = vi.fn((column: string, columnValue: string) => {
        if (column !== "id") {
          return { eq: eqUserId };
        }
        const targetRow = generationOutputRows.find(
          (row) =>
            row &&
            typeof row === "object" &&
            !Array.isArray(row) &&
            String((row as Record<string, unknown>).id ?? "") === columnValue
        );
        if (targetRow && typeof targetRow === "object" && !Array.isArray(targetRow)) {
          (targetRow as Record<string, unknown>).media_file_id = payload.media_file_id ?? null;
        }
        return { eq: eqUserId };
      });
      return { eq: eqId };
    }),
  };

  const generationPublicationsTable = {
    upsert: vi.fn(async (payload: Record<string, unknown>) => {
      generationPublicationUpsertPayloads.push(payload);
      return { error: null };
    }),
  };

  const generationProjectionTable = {
    upsert: vi.fn(async (payload: Record<string, unknown>) => {
      generationProjectionUpsertPayloads.push(payload);
      return { error: null };
    }),
  };

  const upload = vi.fn(async () => uploadResponses.shift() ?? { error: null });
  const createSignedUploadUrl = vi.fn(async (storagePath: string) => ({
    data: {
      path: storagePath,
      token: "signed-upload-token",
    },
    error: null,
  }));
  const uploadToSignedUrl = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const fromStorage = vi.fn(() => ({ upload, createSignedUploadUrl, uploadToSignedUrl, remove }));
  const fromTable = vi.fn((table: string) => {
    if (table === "media_files") return mediaFilesTable;
    if (table === "media_events") return mediaEventsTable;
    if (table === "ai_generation_outputs") return aiGenerationOutputsTable;
    if (table === "generation_publications") return generationPublicationsTable;
    if (table === "generation_projection") return generationProjectionTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    adminClient: {
      from: fromTable,
      storage: { from: fromStorage },
    },
    upload,
    createSignedUploadUrl,
    uploadToSignedUrl,
    remove,
    mediaFileInsertPayloads,
    mediaEventInsertPayloads,
    generationOutputInsertPayloads,
    generationOutputUpdatePayloads,
    generationPublicationUpsertPayloads,
    generationProjectionUpsertPayloads,
    mediaFileListFilters,
    duplicateLookupFilters,
    mediaStorageRows,
    mediaFilesTable,
    mediaEventsTable,
    aiGenerationOutputsTable,
  };
};

describe("recoveryMediaPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertVideoPosterVariantFromBufferMock.mockResolvedValue(null);
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValue(null);
    process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS = "true";
    process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS = "cdn.shortpulse.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("reads existing recovery media rows with parsed legacy and current indexes", async () => {
    const scenario = createSupabaseScenario({
      storageLookupRows: [
        { id: "media-1", storage_path: "user-1/generations/images/media-1.png" },
        { id: "media-2", storage_path: "user-1/generations/images/media-2.png" },
      ],
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: trustedUserPreviewUrl("user-1", "generated-a.png"),
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
            { id: "media-2", metadata: { index: "2" } },
            { id: "media-3", metadata: { index: "NaN" } },
            { id: null, metadata: { index: 4 } },
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
    expect(scenario.mediaFileListFilters).toEqual(
      expect.arrayContaining([
        { column: "source_ref", value: "gen-1" },
        { column: "user_id", value: "user-1" },
        { column: "source", value: "ai_studio" },
      ])
    );
  });

  it("fails closed when existing recovery media lookup has no user scope", async () => {
    await expect(readExistingRecoveryMediaRows("gen-1", " ")).rejects.toThrow(
      "Recovery media lookup requires a user scope."
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns already-persisted canonical media ids without fetch/upload when coverage is complete", async () => {
    const scenario = createSupabaseScenario({
      storageLookupRows: [
        {
          id: "media-existing-2",
          storage_path: "user-1/generations/videos/media-existing-2.mp4",
        },
      ],
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: trustedUserPreviewUrl("user-1", "a.png"),
              media_file_id: "media-1",
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: trustedUserPreviewUrl("user-1", "b.png"),
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
      mediaUrls: [
        trustedUserPreviewUrl("user-1", "a.png"),
        trustedUserPreviewUrl("user-1", "b.png"),
      ],
    });

    expect(ids).toEqual(["media-1", "media-2"]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(scenario.upload).not.toHaveBeenCalled();
    expect(scenario.mediaFilesTable.insert).not.toHaveBeenCalled();
    expect(scenario.mediaEventsTable.insert).not.toHaveBeenCalled();
    expect(scenario.generationPublicationUpsertPayloads).toHaveLength(4);
    expect(scenario.generationProjectionUpsertPayloads).toHaveLength(2);
    expect(scenario.generationProjectionUpsertPayloads.at(-1)).toEqual(
      expect.objectContaining({
        generation_id: "gen-1",
        user_id: "user-1",
        result_urls: [
          trustedUserPreviewUrl("user-1", "a.png"),
          trustedUserPreviewUrl("user-1", "b.png"),
        ],
      })
    );
  });

  it("fills missing output indexes instead of returning early for incomplete existing media coverage", async () => {
    const scenario = createSupabaseScenario({
      storageLookupRows: [
        {
          id: "media-existing-0",
          storage_path: "user-1/generations/images/media-existing-0.png",
        },
      ],
      generationOutputListResponses: [{ data: [], error: null }],
      listResponses: [
        {
          data: [
            { id: "media-existing-0", metadata: { generation_output_index: 0 } },
            { id: "legacy-unindexed", metadata: {} },
          ],
          error: null,
        },
      ],
      insertResponses: [{ data: { id: "media-new-1" }, error: null }],
      uploadResponses: [{ error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([4, 5, 6]), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );
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
      mediaUrls: [
        trustedUserPreviewUrl("user-1", "a.png"),
        trustedUserPreviewUrl("user-1", "b.png"),
      ],
    });

    expect(ids).toEqual(["media-existing-0", "media-new-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scenario.upload).toHaveBeenCalledTimes(1);
    expect(scenario.mediaFileInsertPayloads).toHaveLength(1);
    expect(scenario.generationOutputInsertPayloads).toEqual([
      expect.objectContaining({
        output_index: 0,
        result_url: trustedUserPreviewUrl("user-1", "a.png"),
        media_file_id: "media-existing-0",
      }),
      expect.objectContaining({
        output_index: 1,
        result_url: trustedUserPreviewUrl("user-1", "b.png"),
        media_file_id: "media-new-1",
      }),
    ]);
  });

  it("persists recovery media and updates canonical output rows during insert and duplicate fallback", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: trustedUserPreviewUrl("user-1", "frame-a.png"),
              media_file_id: null,
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: trustedUserPreviewUrl("user-1", "frame-b.mp4"),
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
              result_url: trustedUserPreviewUrl("user-1", "frame-a.png"),
              media_file_id: null,
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: trustedUserPreviewUrl("user-1", "frame-b.mp4"),
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
              result_url: trustedUserPreviewUrl("user-1", "frame-a.png"),
              media_file_id: null,
            },
            {
              id: "output-2",
              output_index: 1,
              result_url: trustedUserPreviewUrl("user-1", "frame-b.mp4"),
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
        trustedUserPreviewUrl("user-1", "frame-a.png"),
        trustedUserPreviewUrl("user-1", "frame-b.mp4"),
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(scenario.upload).toHaveBeenCalledTimes(2);
    expect(scenario.remove).toHaveBeenCalledTimes(1);
    expect(mediaFileIds).toEqual(["media-new-1", "media-existing-2"]);
    expect(scenario.duplicateLookupFilters).toEqual(
      expect.arrayContaining([
        { column: "source_ref", value: "gen-1" },
        { column: "user_id", value: "user-1" },
        { column: "source", value: "ai_studio" },
      ])
    );
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
    expect(scenario.generationPublicationUpsertPayloads).toHaveLength(3);
    expect(scenario.generationProjectionUpsertPayloads).toHaveLength(2);
    expect(scenario.generationProjectionUpsertPayloads.at(-1)).toEqual(
      expect.objectContaining({
        generation_id: "gen-1",
        user_id: "user-1",
        result_urls: [
          trustedUserPreviewUrl("user-1", "frame-a.png"),
          trustedUserPreviewUrl("user-1", "frame-b.mp4"),
        ],
        preview_storage_path: expect.any(String),
      })
    );
    expect(scenario.mediaFileInsertPayloads[0]).toEqual(
      expect.objectContaining({
        source_ref: "gen-1",
        source: "ai_studio",
        file_type: "image",
        metadata: expect.objectContaining({
          generation_output_index: 0,
          index: 0,
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
          index: 1,
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

  it("persists a preview-loop variant for recovered videos before reconciliation", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: trustedUserPreviewUrl("user-1", "frame-b.mp4"),
              media_file_id: null,
            },
          ],
          error: null,
        },
      ],
      listResponses: [{ data: [], error: null }],
      insertResponses: [{ data: { id: "media-video-1" }, error: null }],
      uploadResponses: [{ error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);
    upsertVideoPreviewVariantFromBufferMock.mockImplementationOnce(
      async ({ mediaFileId }: { mediaFileId: string }) => {
        const target = scenario.mediaStorageRows.find(
          (row) =>
            row &&
            typeof row === "object" &&
            !Array.isArray(row) &&
            String((row as Record<string, unknown>).id ?? "") === mediaFileId
        );
        if (target) {
          (target as Record<string, unknown>).file_type = "video";
          (target as Record<string, unknown>).preview_variant_path =
            `user-1/variants/videos/${mediaFileId}/preview_loop_360p.mp4`;
        }
        return `user-1/variants/videos/${mediaFileId}/preview_loop_360p.mp4`;
      }
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(Uint8Array.from([4, 5, 6, 7]), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const mediaFileIds = await persistRecoveryMediaFilesForGeneration({
      generation: {
        id: "gen-video-1",
        user_id: "user-1",
        request_id: "req-video-1",
        model_id: "fal-ai/veo3.1",
        provider: "fal",
        prompt_text: "Animate stills",
        metadata: {},
      },
      mediaUrls: [trustedUserPreviewUrl("user-1", "frame-b.mp4")],
    });

    expect(mediaFileIds).toEqual(["media-video-1"]);
    expect(upsertVideoPreviewVariantFromBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        mediaFileId: "media-video-1",
        videoMimeType: "video/mp4",
        metadata: expect.objectContaining({
          generated_by: "recovery_media_persistence",
          generation_id: "gen-video-1",
          generation_output_index: 0,
          index: 0,
        }),
      })
    );
    expect(scenario.generationPublicationUpsertPayloads.at(-1)).toEqual(
      expect.objectContaining({
        generation_id: "gen-video-1",
        owned_media_file_id: "media-video-1",
        preview_storage_path: "user-1/variants/videos/media-video-1/preview_loop_360p.mp4",
        full_storage_path: expect.stringMatching(/^user-1\/generations\/videos\//),
      })
    );
    expect(scenario.generationProjectionUpsertPayloads.at(-1)).toEqual(
      expect.objectContaining({
        generation_id: "gen-video-1",
        preview_storage_path: "user-1/variants/videos/media-video-1/preview_loop_360p.mp4",
        full_storage_path: expect.stringMatching(/^user-1\/generations\/videos\//),
      })
    );
  });

  it("uses signed upload transport for recovered videos above the standard upload ceiling", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [
        {
          data: [
            {
              id: "output-1",
              output_index: 0,
              result_url: trustedUserPreviewUrl("user-1", "large-frame.mp4"),
              media_file_id: null,
            },
          ],
          error: null,
        },
      ],
      listResponses: [{ data: [], error: null }],
      insertResponses: [{ data: { id: "media-large-video-1" }, error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);
    const largeVideo = Buffer.alloc(MAX_SUPABASE_STANDARD_UPLOAD_BYTES + 1, 0);
    largeVideo.write("ftypmp42", 4, "ascii");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(largeVideo, {
        status: 200,
        headers: { "content-type": "video/mp4" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const mediaFileIds = await persistRecoveryMediaFilesForGeneration({
      generation: {
        id: "gen-large-video-1",
        user_id: "user-1",
        request_id: "req-large-video-1",
        model_id: "kie-ai/seedance-2",
        provider: "kie",
        prompt_text: "Large generated video",
        metadata: {},
      },
      mediaUrls: [trustedUserPreviewUrl("user-1", "large-frame.mp4")],
    });

    expect(mediaFileIds).toEqual(["media-large-video-1"]);
    expect(scenario.upload).not.toHaveBeenCalled();
    expect(scenario.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/generations\/videos\//)
    );
    expect(scenario.uploadToSignedUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/generations\/videos\//),
      "signed-upload-token",
      expect.any(Blob),
      expect.objectContaining({
        contentType: "video/mp4",
        cacheControl: "31536000",
      })
    );
    expect(scenario.mediaFileInsertPayloads[0]).toEqual(
      expect.objectContaining({
        source_ref: "gen-large-video-1",
        file_type: "video",
        file_size: MAX_SUPABASE_STANDARD_UPLOAD_BYTES + 1,
      })
    );
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
        trustedUserPreviewUrl("user-1", "parallel-a.png"),
        trustedUserPreviewUrl("user-1", "parallel-b.png"),
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

  it("rejects trusted direct preview urls that are scoped to another user", async () => {
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
          model_id: "fal-ai/nano-banana-pro",
          provider: "fal",
          prompt_text: "cinematic portrait",
          metadata: {},
        },
        mediaUrls: [trustedUserPreviewUrl("user-2", "foreign-frame.png")],
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

  it("accepts trusted Kie media-result hosts during recovery without media preview allowlist", async () => {
    delete process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS;
    delete process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS;
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [{ data: [], error: null }],
      listResponses: [{ data: [], error: null }],
      insertResponses: [{ data: { id: "media-kie-1" }, error: null }],
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
          id: "gen-kie-1",
          user_id: "user-1",
          request_id: "req-kie-1",
          model_id: "kie-ai/gpt-image-2",
          provider: "kie",
          prompt_text: "A generated frame",
          metadata: {},
        },
        mediaUrls: ["https://tempfile.aiquickdraw.com/gpt-image-2-kie/output.png"],
      })
    ).resolves.toEqual(["media-kie-1"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("removes uploaded recovery media when media_files insert fails", async () => {
    const scenario = createSupabaseScenario({
      generationOutputListResponses: [{ data: [], error: null }],
      listResponses: [{ data: [], error: null }],
      insertResponses: [
        {
          data: null,
          error: {
            code: "23503",
            message:
              'insert or update on table "media_files" violates foreign key constraint "media_files_user_id_fkey"',
          },
        },
      ],
      uploadResponses: [{ error: null }],
    });
    getSupabaseAdminMock.mockReturnValue(scenario.adminClient);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      )
    );

    await expect(
      persistRecoveryMediaFilesForGeneration({
        generation: {
          id: "gen-1",
          user_id: "user-1",
          request_id: "req-1",
          model_id: "fal-ai/nano-banana-pro",
          provider: "fal",
          prompt_text: "cinematic portrait",
          metadata: {},
        },
        mediaUrls: [trustedUserPreviewUrl("user-1", "recovered.png")],
      })
    ).rejects.toThrow("media_files insert failed");

    expect(scenario.upload).toHaveBeenCalledTimes(1);
    expect(scenario.remove).toHaveBeenCalledWith([
      expect.stringMatching(new RegExp("^user-1/generations/images/.+\\.png$")),
    ]);
  });

  it("accepts fal media-host recovery media urls by default", async () => {
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
        mediaUrls: ["https://fal.media/files/result.png"],
      })
    ).resolves.toEqual(["media-new-1"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
