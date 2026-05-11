import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR,
  resolveGenerationIdForRequestId,
  savePromptRecord,
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

const createGenerationOutputSelectBuilder = (maybeSingle: ReturnType<typeof vi.fn>) => {
  const builder = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
  };
  builder.eq.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

const createMaybeSingleEqBuilder = (maybeSingle: ReturnType<typeof vi.fn>) => {
  const builder = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
  };
  builder.eq.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

describe("saveMediaUrlToLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns existing ai_studio media row before upload when output index already exists", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "media-existing",
          storage_path: "user-1/generations/images/existing.png",
          file_type: "image",
        },
        error: null,
      })
      .mockResolvedValue({
        data: {
          id: "legacy-media-existing",
          storage_path: "user-1/generations/images/legacy.png",
          file_type: "image",
        },
        error: null,
      });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { media_file_id: "media-existing" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "gen-output-existing" },
        error: null,
      });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    const insert = vi.fn();
    const upload = vi.fn();

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: generationOutputUpdate,
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
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
    expect(selectBuilder.contains).not.toHaveBeenCalled();
    expect(generationOutputUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-existing",
      })
    );
  });

  it("retries ai_studio existing-row lookup before falling back to provider fetch", async () => {
    vi.useFakeTimers();
    const publicationSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({ data: null, error: null })
    );
    const generationOutputMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: "gen-output-raced",
          media_file_id: "media-raced",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "gen-output-raced",
        },
        error: null,
      });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const mediaFileMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "media-raced",
        storage_path: "user-1/generations/videos/raced.mp4",
        file_type: "video",
      },
      error: null,
    });
    const mediaFileSelectBuilder = createMediaFileSelectBuilder(mediaFileMaybeSingle);
    const generationOutputUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    const insert = vi.fn();
    const upload = vi.fn();

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaFileSelectBuilder),
            insert,
          };
        }
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationSelectBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: generationOutputUpdate,
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
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

    const savePromise = saveMediaUrlToLibrary({
      url: "https://tempfile.aiquickdraw.com/r/raced.mp4",
      mode: "video",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
    });

    await vi.advanceTimersByTimeAsync(120);
    const result = await savePromise;

    expect(result.mediaFileId).toBe("media-raced");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(generationOutputUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-raced",
      })
    );
  });

  it("prefers publication-owned media before legacy canonical reuse when output index already exists", async () => {
    const publicationMediaMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "media-from-publication",
        preview_storage_path: "user-1/generations/images/publication-preview.png",
        storage_path: "user-1/generations/images/publication-full.png",
        file_type: "image",
        filename: "publication.png",
        poster_variant_path: null,
      },
      error: null,
    });
    const mediaFileSelectBuilder = createMediaFileSelectBuilder(publicationMediaMaybeSingle);
    const publicationSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: { owned_media_file_id: "media-from-publication" },
        error: null,
      })
    );
    const generationOutputMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "gen-output-existing",
          media_file_id: "stale-canonical-media",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "gen-output-existing" },
        error: null,
      });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    const insert = vi.fn();
    const upload = vi.fn();

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaFileSelectBuilder),
            insert,
          };
        }
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationSelectBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: generationOutputUpdate,
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload,
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn());

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.png",
      mode: "image",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
    });

    expect(result.mediaFileId).toBe("media-from-publication");
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(generationOutputUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-from-publication",
      })
    );
  });

  it("does not re-upload a poster when a publication-owned video row already has one", async () => {
    const publicationMediaMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "media-from-publication-video",
        preview_storage_path: "user-1/generations/videos/publication-preview.mp4",
        storage_path: "user-1/generations/videos/publication-full.mp4",
        file_type: "video",
        filename: "publication-video.mp4",
        poster_variant_path: "user-1/variants/videos/media-from-publication-video/poster_720.jpg",
      },
      error: null,
    });
    const mediaFileSelectBuilder = createMediaFileSelectBuilder(publicationMediaMaybeSingle);
    const publicationSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: { owned_media_file_id: "media-from-publication-video" },
        error: null,
      })
    );
    const generationOutputMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "gen-output-existing-video",
          media_file_id: "stale-canonical-media-video",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "gen-output-existing-video" },
        error: null,
      });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    const insert = vi.fn();
    const upload = vi.fn();
    const mediaUpdate = vi.fn();
    const variantUpsert = vi.fn();

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaFileSelectBuilder),
            insert,
            update: mediaUpdate,
          };
        }
        if (table === "media_asset_variants") {
          return {
            upsert: variantUpsert,
          };
        }
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationSelectBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: generationOutputUpdate,
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload,
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn());

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.mp4",
      mode: "video",
      source: "ai_studio",
      generationId: "gen-video-publication-1",
      index: 0,
      posterUrlHint: "https://cdn.shortpulse.test/poster.jpg",
    });

    expect(result.mediaFileId).toBe("media-from-publication-video");
    expect(upload).not.toHaveBeenCalled();
    expect(variantUpsert).not.toHaveBeenCalled();
    expect(mediaUpdate).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(generationOutputUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-from-publication-video",
      })
    );
  });

  it("falls back to legacy generation_output_index lookup when canonical output media linkage is absent", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "media-existing",
        storage_path: "user-1/generations/images/existing.png",
        file_type: "image",
      },
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({
      data: { media_file_id: null },
      error: null,
    });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert: vi.fn(),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: generationOutputUpdate,
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn());

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.png",
      mode: "image",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
    });

    expect(result.mediaFileId).toBe("media-existing");
    expect(selectBuilder.contains).toHaveBeenCalledWith("metadata", { generation_output_index: 0 });
  });

  it("also falls back to index-only generated rows created during the regression window", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: "media-existing-index-only",
          storage_path: "user-1/generations/images/existing-index-only.png",
          file_type: "image",
        },
        error: null,
      });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({
      data: { media_file_id: null },
      error: null,
    });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert: vi.fn(),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: generationOutputUpdate,
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn());

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.png",
      mode: "image",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
    });

    expect(result.mediaFileId).toBe("media-existing-index-only");
    expect(selectBuilder.contains).toHaveBeenNthCalledWith(1, "metadata", {
      generation_output_index: 0,
    });
    expect(selectBuilder.contains).toHaveBeenNthCalledWith(2, "metadata", { index: 0 });
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
    let insertStarted = false;
    const maybeSingle = vi.fn(async () =>
      insertStarted
        ? {
            data: {
              id: "media-existing-after-duplicate",
              storage_path: "user-1/generations/images/existing-after-duplicate.png",
              file_type: "image",
            },
            error: null,
          }
        : { data: null, error: null }
    );
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn(async () =>
      insertStarted
        ? {
            data: {
              id: "gen-output-duplicate",
              media_file_id: "media-existing-after-duplicate",
            },
            error: null,
          }
        : { data: null, error: null }
    );
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const insert = vi.fn(() => {
      insertStarted = true;
      return {
        select: vi.fn(() => ({
          single,
        })),
      };
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            insert: vi.fn(),
            update: generationOutputUpdate,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
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
    expect(generationOutputUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-existing-after-duplicate",
      })
    );
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

  it("rejects server-copy responses that do not return a persisted media id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
        return {
          select: vi.fn(() => selectBuilder),
          insert: vi.fn(),
        };
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaFileId: null,
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

    await expect(
      saveMediaUrlToLibrary({
        url: "https://cdn.shortpulse.test/output.png",
        mode: "image",
        source: "upload",
        index: 0,
      })
    ).rejects.toThrow("Server copy did not return a persisted media id.");
  });

  it("surfaces server-copy trust failures for generated video saves when provider urls are blocked in-browser", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert: vi.fn(),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: vi.fn(),
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: "Untrusted media URL.",
        details: "URL host is not in the trusted media allowlist.",
      }),
    });

    await expect(
      saveMediaUrlToLibrary({
        url: "https://tempfile.aiquickdraw.com/r/generated-video.mp4",
        mode: "video",
        source: "ai_studio",
        generationId: "gen-1",
        index: 0,
      })
    ).rejects.toThrow("Untrusted media URL.");

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("supports generated video server-copy fallback when browser fetch is blocked", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert: vi.fn(),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: vi.fn(),
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaFileId: "media-generated-video",
        storagePath: "user-1/generations/videos/generated-video.mp4",
        fileType: "video",
        fileSize: 456,
        delivery: {
          previewStoragePath: "user-1/generations/videos/generated-video.mp4",
          fullStoragePath: "user-1/generations/videos/generated-video.mp4",
          previewUrl: "https://cdn.shortpulse.test/generated-video-preview.mp4",
          fullUrl: "https://cdn.shortpulse.test/generated-video-full.mp4",
        },
      }),
    });

    const result = await saveMediaUrlToLibrary({
      url: "https://tempfile.aiquickdraw.com/r/generated-video.mp4",
      mode: "video",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
    });

    expect(result.mediaFileId).toBe("media-generated-video");
    expect(result.fileType).toBe("video");
    expect(result.storagePath).toBe("user-1/generations/videos/generated-video.mp4");
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        method: "POST",
      })
    );
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
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputInsert = vi.fn(async () => ({ error: null }));
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
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            insert: generationOutputInsert,
            update: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
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
    expect(generationOutputInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-2",
        output_index: 1,
        media_file_id: "media-new",
      })
    );
  });

  it("persists a durable poster variant when saving a new video with a poster hint", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("uuid-video")
      .mockReturnValueOnce("uuid-poster");
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        width: 1280,
        height: 720,
        close: vi.fn(),
      }))
    );

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputInsert = vi.fn(async () => ({ error: null }));
    const single = vi.fn().mockResolvedValue({
      data: { id: "media-video-1" },
      error: null,
    });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single,
      })),
    }));
    const mediaUpdateEqUser = vi.fn(async () => ({ error: null }));
    const mediaUpdateEqId = vi.fn(() => ({
      eq: mediaUpdateEqUser,
    }));
    const mediaUpdate = vi.fn(() => ({
      eq: mediaUpdateEqId,
    }));
    const variantUpsert = vi.fn(async () => ({ error: null }));
    const upload = vi.fn().mockResolvedValue({ error: null });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert,
            update: mediaUpdate,
          };
        }
        if (table === "media_asset_variants") {
          return {
            upsert: variantUpsert,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            insert: generationOutputInsert,
            update: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
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
      vi.fn((url: string) => {
        if (url.includes("output.mp4")) {
          return Promise.resolve(
            new Response(new Blob(["video"], { type: "video/mp4" }), {
              status: 200,
              headers: { "content-type": "video/mp4" },
            })
          );
        }
        if (url.includes("poster.jpg")) {
          return Promise.resolve(
            new Response(new Blob(["poster"], { type: "image/jpeg" }), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            })
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.mp4",
      mode: "video",
      source: "ai_studio",
      generationId: "gen-video-1",
      index: 0,
      posterUrlHint: "https://cdn.shortpulse.test/poster.jpg",
    });

    expect(result.mediaFileId).toBe("media-video-1");
    expect(upload).toHaveBeenNthCalledWith(
      1,
      "user-1/generations/videos/uuid-video-0.mp4",
      expect.anything(),
      expect.objectContaining({
        contentType: "video/mp4",
      })
    );
    expect(upload).toHaveBeenNthCalledWith(
      2,
      "user-1/variants/videos/media-video-1/poster_720.jpg",
      expect.anything(),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      })
    );
    expect(variantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-video-1",
        variant_kind: "poster_720",
        storage_path: "user-1/variants/videos/media-video-1/poster_720.jpg",
      }),
      expect.objectContaining({
        onConflict: "media_file_id,variant_kind",
      })
    );
    expect(mediaUpdate).toHaveBeenCalledWith({
      poster_variant_path: "user-1/variants/videos/media-video-1/poster_720.jpg",
    });
    expect(mediaUpdateEqId).toHaveBeenCalledWith("id", "media-video-1");
    expect(mediaUpdateEqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("registers a durable preview-loop variant when a new video save provides a distinct preview path", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValueOnce("uuid-video-preview");

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const generationOutputInsert = vi.fn(async () => ({ error: null }));
    const single = vi.fn().mockResolvedValue({
      data: { id: "media-video-preview-1" },
      error: null,
    });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single,
      })),
    }));
    const mediaUpdateEqUser = vi.fn(async () => ({ error: null }));
    const mediaUpdateEqId = vi.fn(() => ({
      eq: mediaUpdateEqUser,
    }));
    const mediaUpdate = vi.fn(() => ({
      eq: mediaUpdateEqId,
    }));
    const variantUpsert = vi.fn(async () => ({ error: null }));
    const upload = vi.fn().mockResolvedValue({ error: null });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert,
            update: mediaUpdate,
          };
        }
        if (table === "media_asset_variants") {
          return {
            upsert: variantUpsert,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            insert: generationOutputInsert,
            update: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
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
      vi.fn((url: string) => {
        if (url.includes("output.mp4")) {
          return Promise.resolve(
            new Response(new Blob(["video"], { type: "video/mp4" }), {
              status: 200,
              headers: { "content-type": "video/mp4" },
            })
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/output.mp4",
      mode: "video",
      source: "ai_studio",
      generationId: "gen-video-preview-1",
      index: 0,
      previewStoragePathHint: "user-1/variants/videos/media-video-preview-1/preview_loop_360p.mp4",
      fullStoragePathHint: "user-1/generations/videos/uuid-video-preview-0.mp4",
    });

    expect(variantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-video-preview-1",
        variant_kind: "preview_loop_360p",
        storage_path: "user-1/variants/videos/media-video-preview-1/preview_loop_360p.mp4",
        mime_type: "video/mp4",
      }),
      expect.objectContaining({
        onConflict: "media_file_id,variant_kind",
      })
    );
    expect(mediaUpdate).toHaveBeenCalledWith({
      preview_variant_path: "user-1/variants/videos/media-video-preview-1/preview_loop_360p.mp4",
    });
    expect(upload).toHaveBeenCalledTimes(1);
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

  it("forwards poster hints through server-copy fallback for blocked video saves", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert: vi.fn(),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: vi.fn(),
            insert: vi.fn(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          remove: vi.fn(),
        })),
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaFileId: "media-generated-video",
        storagePath: "user-1/generations/videos/generated-video.mp4",
        fileType: "video",
        fileSize: 456,
        delivery: {
          previewStoragePath: "user-1/generations/videos/generated-video.mp4",
          fullStoragePath: "user-1/generations/videos/generated-video.mp4",
          previewUrl: "https://cdn.shortpulse.test/generated-video-preview.mp4",
          fullUrl: "https://cdn.shortpulse.test/generated-video-full.mp4",
        },
      }),
    });

    await saveMediaUrlToLibrary({
      url: "https://tempfile.aiquickdraw.com/r/generated-video.mp4",
      mode: "video",
      source: "ai_studio",
      generationId: "gen-1",
      index: 0,
      posterUrlHint: "https://cdn.shortpulse.test/generated-video-poster.jpg",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/copy-from-url",
      expect.objectContaining({
        body: expect.stringContaining(
          '"posterUrlHint":"https://cdn.shortpulse.test/generated-video-poster.jpg"'
        ),
      })
    );
  });

  it("associates newly saved media with the active project", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectBuilder = createMediaFileSelectBuilder(maybeSingle);
    const generationOutputMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const generationOutputSelectBuilder = createGenerationOutputSelectBuilder(
      generationOutputMaybeSingle
    );
    const projectMediaUpsert = vi.fn().mockResolvedValue({ error: null });
    const mediaInsertSelectSingle = vi.fn().mockResolvedValue({
      data: { id: "media-project-1" },
      error: null,
    });
    const mediaInsertSelect = vi.fn(() => ({
      single: mediaInsertSelectSingle,
    }));
    const mediaInsert = vi.fn(() => ({
      select: mediaInsertSelect,
    }));
    const upload = vi.fn().mockResolvedValue({ error: null });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => selectBuilder),
            insert: mediaInsert,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => generationOutputSelectBuilder),
            update: vi.fn(),
            insert: vi.fn(),
          };
        }
        if (table === "project_media_items") {
          return {
            upsert: projectMediaUpsert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
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
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["video"], { type: "video/mp4" }),
        headers: new Headers({ "content-type": "video/mp4" }),
      })
    );

    const result = await saveMediaUrlToLibrary({
      url: "https://cdn.shortpulse.test/project-video.mp4",
      mode: "video",
      source: "upload",
      index: 0,
      projectId: "project-1",
    });

    expect(result.mediaFileId).toBe("media-project-1");
    expect(projectMediaUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: "media-project-1",
          user_id: "user-1",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,media_file_id",
      })
    );
  });
});

describe("savePromptRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  it("associates saved prompts with the active project", async () => {
    const promptInsertSingle = vi.fn().mockResolvedValue({
      data: { id: "prompt-1" },
      error: null,
    });
    const promptInsertSelect = vi.fn(() => ({
      single: promptInsertSingle,
    }));
    const promptInsert = vi.fn(() => ({
      select: promptInsertSelect,
    }));
    const projectPromptUpsert = vi.fn().mockResolvedValue({ error: null });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_prompts") {
          return {
            insert: promptInsert,
          };
        }
        if (table === "project_prompt_items") {
          return {
            upsert: projectPromptUpsert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      savePromptRecord({
        promptText: "Project prompt",
        mode: "text",
        source: "ai_studio",
        projectId: "project-1",
      })
    ).resolves.toBe("prompt-1");

    expect(projectPromptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        prompt_id: "prompt-1",
        user_id: "user-1",
      }),
      expect.objectContaining({
        onConflict: "project_id,prompt_id",
      })
    );
  });
});

describe("resolveGenerationIdForRequestId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  it("prefers generation_projection before legacy ai_generations lookup", async () => {
    const projectionSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: { generation_id: "gen-from-projection" },
        error: null,
      })
    );
    const generationSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: { id: "gen-from-generations" },
        error: null,
      })
    );

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return { select: vi.fn(() => projectionSelectBuilder) };
        }
        if (table === "ai_generations") {
          return { select: vi.fn(() => generationSelectBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(resolveGenerationIdForRequestId("req-1")).resolves.toBe("gen-from-projection");
    expect(generationSelectBuilder.maybeSingle).not.toHaveBeenCalled();
  });

  it("returns null when projection does not resolve a request-backed generation id", async () => {
    const projectionSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
    );
    const generationSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: { id: "gen-from-generations" },
        error: null,
      })
    );

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return { select: vi.fn(() => projectionSelectBuilder) };
        }
        if (table === "ai_generations") {
          return { select: vi.fn(() => generationSelectBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(resolveGenerationIdForRequestId("req-1")).resolves.toBeNull();
    expect(generationSelectBuilder.maybeSingle).not.toHaveBeenCalled();
  });

  it("returns null on project routes when the request-backed generation is not associated to that project", async () => {
    const projectionSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: { generation_id: "gen-from-projection" },
        error: null,
      })
    );
    const generationSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: { id: "gen-from-generations" },
        error: null,
      })
    );
    const projectGenerationSelectBuilder = createMaybeSingleEqBuilder(
      vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
    );

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return { select: vi.fn(() => projectionSelectBuilder) };
        }
        if (table === "ai_generations") {
          return { select: vi.fn(() => generationSelectBuilder) };
        }
        if (table === "project_generation_items") {
          return { select: vi.fn(() => projectGenerationSelectBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(resolveGenerationIdForRequestId("req-1", "project-1")).resolves.toBeNull();
  });
});
