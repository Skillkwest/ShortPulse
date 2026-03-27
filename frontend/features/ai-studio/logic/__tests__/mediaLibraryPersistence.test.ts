import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR,
  saveMediaUrlToLibrary,
} from "../mediaLibraryPersistence";

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: fetchWithAuthMock,
}));

const createMediaFileSelectBuilder = (maybeSingle: ReturnType<typeof vi.fn>) => {
  const builder = {
    eq: vi.fn(),
    contains: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
  };
  builder.eq.mockReturnValue(builder);
  builder.contains.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

describe("saveMediaUrlToLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns existing ai_studio media row before upload when output index already exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "media-existing",
        storage_path: "user-1/generations/images/existing.png",
        file_type: "image",
      },
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const insert = vi.fn();
    const upload = vi.fn();

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
        return {
          select: vi.fn(() => selectBuilder),
          insert,
        };
      }),
      storage: {
        from: vi.fn(() => ({
          upload,
          remove: vi.fn(),
        })),
      },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.png",
      mode: "image",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
    });

    expect(result.mediaFileId).toBe("media-existing");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("maps duplicate ai_studio insert to existing row and returns success semantics", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("uuid-1");
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        width: 1024,
        height: 576,
        close: vi.fn(),
      }))
    );
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: "media-existing-after-duplicate",
          storage_path: "user-1/generations/images/existing-after-duplicate.png",
          file_type: "image",
        },
        error: null,
      });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single,
      })),
    }));
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
        return {
          select: vi.fn(() => selectBuilder),
          insert,
        };
      }),
      storage: {
        from: vi.fn(() => ({
          upload,
          remove,
        })),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Blob(["img"], { type: "image/png" }), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      )
    );

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.png",
      mode: "image",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
    });

    expect(result.mediaFileId).toBe("media-existing-after-duplicate");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("falls back to server copy when browser fetch is blocked", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const insert = vi.fn();
    const upload = vi.fn();

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
        return {
          select: vi.fn(() => selectBuilder),
          insert,
        };
      }),
      storage: {
        from: vi.fn(() => ({
          upload,
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaFileId: "media-server-copy",
        storagePath: "user-1/generations/images/server-copy.png",
        fileType: "image",
        fileSize: 123,
        delivery: {
          previewStoragePath: "user-1/generations/images/server-copy.png",
          fullStoragePath: "user-1/generations/images/server-copy.png",
          previewUrl: "https://cdn.shortpulse.test/server-copy-preview.png",
          fullUrl: "https://cdn.shortpulse.test/server-copy-full.png",
        },
      }),
    });

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.png",
      mode: "image",
      source: "upload",
      index: 0,
    });

    expect(result.mediaFileId).toBe("media-server-copy");
    expect(result.storagePath).toBe("user-1/generations/images/server-copy.png");
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not use server copy fallback for explicit HTTP download failures", async () => {
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() =>
          createMediaFileSelectBuilder(
            vi.fn().mockResolvedValue({
              data: null,
              error: null,
            })
          )
        ),
      })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    await expect(
      saveMediaUrlToLibrary({
        url: "https://cdn.shortpulse.test/missing.png",
        mode: "image",
        source: "upload",
        index: 0,
      })
    ).rejects.toThrow("Fetch failed (404)");
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("persists canonical image dimensions in metadata when saving new image media", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("uuid-2");
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        width: 1600,
        height: 900,
        close: vi.fn(),
      }))
    );

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const single = vi.fn().mockResolvedValue({
      data: { id: "media-new" },
      error: null,
    });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single,
      })),
    }));
    const upload = vi.fn().mockResolvedValue({ error: null });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
        return {
          select: vi.fn(() => selectBuilder),
          insert,
        };
      }),
      storage: {
        from: vi.fn(() => ({
          upload,
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Blob(["img"], { type: "image/png" }), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      )
    );

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.png",
      mode: "image",
      source: "ai_studio",
      generationId: "gen-2",
      index: 1,
      metadata: {
        custom_flag: true,
      },
    });

    expect(result.mediaFileId).toBe("media-new");
    const insertCalls = insert.mock.calls as unknown[][];
    expect(insertCalls.at(0)).toBeTruthy();
    const insertPayload = (insertCalls.at(0)?.at(0) ?? {}) as {
      metadata?: Record<string, unknown>;
    };
    expect(insertPayload.metadata).toEqual(
      expect.objectContaining({
        width: 1600,
        height: 900,
        aspect_ratio: 1.777778,
        generation_output_index: 1,
        index: 1,
        custom_flag: true,
      })
    );
  });

  it("rejects ai_studio saves without a durable generation id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaUrlToLibrary({
        url: "https://cdn.shortpulse.test/output.png",
        mode: "image",
        source: "ai_studio",
        index: 0,
      })
    ).rejects.toThrow(GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });
});
