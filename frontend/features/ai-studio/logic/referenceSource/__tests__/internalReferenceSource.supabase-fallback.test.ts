/**
 * Regression coverage for internal reference source lookup when `preview_storage_path`
 * is unavailable in the PostgREST schema cache.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import type { InternalReferenceDragPayload } from "../../../utils/dragDrop";

const {
  ensureSupabaseClientMock,
  ensureSupabaseQueryClientMock,
  mediaMaybeSingleMock,
  mediaListMock,
  generationOutputMaybeSingleMock,
  generationPublicationMaybeSingleMock,
  getSignedMediaUrlMock,
} = vi.hoisted(() => ({
  ensureSupabaseClientMock: vi.fn(),
  ensureSupabaseQueryClientMock: vi.fn(),
  mediaMaybeSingleMock: vi.fn(),
  mediaListMock: vi.fn(),
  generationOutputMaybeSingleMock: vi.fn(),
  generationPublicationMaybeSingleMock: vi.fn(),
  getSignedMediaUrlMock: vi.fn(),
}));

vi.mock("../../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: ensureSupabaseClientMock,
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
}));

vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: getSignedMediaUrlMock,
}));

import { resolveInternalReferenceSource } from "../internalReferenceSource";

const makePayload = (
  overrides: Partial<InternalReferenceDragPayload> = {}
): InternalReferenceDragPayload => ({
  version: 1,
  origin: "ai-studio-reference-grid",
  referenceId: null,
  outputId: "out-1",
  imageIndex: 0,
  mediaId: null,
  referenceUrl: null,
  sourceSurface: "all-refs",
  ...overrides,
});

const makeImageOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id: "out-1",
    prompt: "cinematic portrait",
    mode: "image",
    aspect: "1:1",
    model: "model",
    status: "ready",
    timestamp: "now",
    previewUrl: "https://cdn.example.com/out-1-preview.png",
    resultUrls: ["https://cdn.example.com/out-1-result.png"],
    savedMediaIds: [],
    previewStoragePath: null,
    fullStoragePath: null,
    mediaSource: "generated",
    ...overrides,
  }) as StudioOutput;

const schemaCacheError = {
  message: "Could not find the 'preview_storage_path' column of 'media_files' in the schema cache",
};

const createSupabaseMock = () => ({
  from: (table: string) => {
    if (table === "media_files") {
      return {
        select: (columns: string) => {
          const base = {
            eq: () => base,
            contains: () => base,
            order: () => base,
            limit: () => base,
            maybeSingle: async () => await mediaMaybeSingleMock(columns),
            then: undefined,
          };
          if (columns.includes("metadata")) {
            return {
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: async () => await mediaListMock(columns),
                  }),
                }),
              }),
            };
          }
          return base;
        },
      };
    }
    if (table === "ai_generation_outputs") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => await generationOutputMaybeSingleMock(),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "generation_publications") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => await generationPublicationMaybeSingleMock(),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "ai_generations") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  },
  storage: {
    from: () => ({
      download: async () => ({ data: null, error: new Error("not used") }),
    }),
  },
});

describe("resolveInternalReferenceSource schema-cache fallback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ensureSupabaseClientMock.mockReturnValue(createSupabaseMock());
    ensureSupabaseQueryClientMock.mockReturnValue(createSupabaseMock());
    mediaMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mediaListMock.mockResolvedValue({ data: [], error: null });
    generationOutputMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    generationPublicationMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    getSignedMediaUrlMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to storage_path-only lookup for media id resolution when preview_storage_path is unavailable", async () => {
    mediaMaybeSingleMock
      .mockResolvedValueOnce({ data: null, error: schemaCacheError })
      .mockResolvedValueOnce({
        data: { storage_path: "user-1/uploads/images/from-media-id.png" },
        error: null,
      });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload({
        outputId: "out-missing",
        mediaId: "media-1",
      }),
      getOutputById: () => null,
      getOutputSnapshot: () => ({
        outputOrder: [],
        archivedOutputOrder: [],
        outputById: {},
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved?.previewStoragePath).toBe("user-1/uploads/images/from-media-id.png");
    expect(resolved?.fullStoragePath).toBe("user-1/uploads/images/from-media-id.png");
    expect(resolved?.provenance.resolutionReason).toBe("saved_media_lookup");
  });

  it("falls back to storage_path-only lookup for legacy generated output metadata when preview_storage_path is unavailable", async () => {
    const output = makeImageOutput({
      generationId: "gen-1",
      taskId: "task-1",
    });
    mediaMaybeSingleMock
      .mockResolvedValueOnce({ data: null, error: schemaCacheError })
      .mockResolvedValueOnce({ data: null, error: null });
    mediaListMock.mockResolvedValueOnce({
      data: [
        {
          metadata: { generation_output_index: 0 },
          storage_path: "user-1/generations/images/from-generation.png",
        },
      ],
      error: null,
    });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved?.previewStoragePath).toBe("user-1/generations/images/from-generation.png");
    expect(resolved?.fullStoragePath).toBe("user-1/generations/images/from-generation.png");
    expect(resolved?.provenance.resolutionReason).toBe("generation_index_lookup");
  });

  it("prefers canonical generation output media linkage before metadata scans", async () => {
    const output = makeImageOutput({
      generationId: "gen-1",
      taskId: "task-1",
    });
    generationOutputMaybeSingleMock.mockResolvedValue({
      data: { id: "generation-output-1", media_file_id: "media-from-canonical-output" },
      error: null,
    });
    mediaMaybeSingleMock.mockResolvedValue({
      data: { storage_path: "user-1/generations/images/from-canonical-output.png" },
      error: null,
    });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved?.previewStoragePath).toBe(
      "user-1/generations/images/from-canonical-output.png"
    );
    expect(resolved?.fullStoragePath).toBe("user-1/generations/images/from-canonical-output.png");
    expect(resolved?.provenance.resolutionReason).toBe("generation_index_lookup");
    expect(mediaListMock).not.toHaveBeenCalled();
  });

  it("prefers publication-owned media linkage before legacy generation fallbacks", async () => {
    const output = makeImageOutput({
      generationId: "gen-1",
      taskId: "task-1",
    });
    generationOutputMaybeSingleMock.mockResolvedValue({
      data: { id: "generation-output-1", media_file_id: null },
      error: null,
    });
    generationPublicationMaybeSingleMock.mockResolvedValue({
      data: {
        owned_media_file_id: "media-from-publication",
        preview_storage_path: null,
        full_storage_path: null,
      },
      error: null,
    });
    mediaMaybeSingleMock.mockResolvedValue({
      data: { storage_path: "user-1/generations/images/from-publication.png" },
      error: null,
    });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved?.previewStoragePath).toBe("user-1/generations/images/from-publication.png");
    expect(resolved?.fullStoragePath).toBe("user-1/generations/images/from-publication.png");
    expect(resolved?.provenance.resolutionReason).toBe("generation_index_lookup");
    expect(mediaListMock).not.toHaveBeenCalled();
  });

  it("falls back to a signed storage URL when direct storage download fails", async () => {
    const output = makeImageOutput({
      previewStoragePath: "user-1/generations/images/out-1-preview.png",
      fullStoragePath: "user-1/generations/images/out-1-full.png",
    });
    const downloadMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("download denied") });
    const supabaseMock = {
      ...createSupabaseMock(),
      storage: {
        from: () => ({
          download: downloadMock,
        }),
      },
    };
    ensureSupabaseClientMock.mockReturnValue(supabaseMock);
    ensureSupabaseQueryClientMock.mockReturnValue(supabaseMock);
    getSignedMediaUrlMock.mockResolvedValue("https://signed.example.com/out-1-full.png");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: true,
        mediaFileIds: [],
        delivery: null,
        error: null,
      }),
      resolveSavedMediaIdFromOutput: (row) => row?.savedMediaIds?.[0] ?? null,
    });

    await expect(resolved?.loadBlob()).resolves.toBeInstanceOf(Blob);
    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/generations/images/out-1-full.png",
      previewProfile: "none",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://signed.example.com/out-1-full.png");
  });
});
