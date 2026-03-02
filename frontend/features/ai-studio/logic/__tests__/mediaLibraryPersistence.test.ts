import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveMediaUrlToLibrary } from "../mediaLibraryPersistence";

const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: ensureSupabaseClientMock,
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

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
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

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
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
});
