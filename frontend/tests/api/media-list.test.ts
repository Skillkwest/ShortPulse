import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/list";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveMediaSigningStoragePathsMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/mediaPreviewPath", () => ({
  resolveMediaSigningStoragePaths: (...args: unknown[]) =>
    resolveMediaSigningStoragePathsMock(...args),
}));

type MediaRow = {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  source: string;
  source_ref: string | null;
  prompt_id: string | null;
  metadata: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
  created_at: string;
  updated_at: string | null;
};

const createMockResponse = () => {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader: vi.fn((key: string, value: string) => {
      headers.set(key.toLowerCase(), value);
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
};

const matchesIlike = (value: string | null | undefined, pattern: string): boolean => {
  const raw = value ?? "";
  const regex = new RegExp(`^${pattern.replace(/[%*]/g, ".*")}$`, "i");
  return regex.test(raw);
};

const applySearchOrClause = (rows: MediaRow[], clause: string): MediaRow[] => {
  const segments = clause.split(",").map((segment) => segment.trim());
  return rows.filter((row) =>
    segments.some((segment) => {
      const [left, ...rest] = segment.split(".ilike.");
      const pattern = rest.join(".ilike.");
      if (!left || !pattern) return false;
      const value =
        left === "filename" ? row.filename : left === "storage_path" ? row.storage_path : "";
      return matchesIlike(value, pattern);
    })
  );
};

const createSupabaseAdminMock = (rows: MediaRow[]) => {
  const createSignedUrlsMock = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: `https://signed.test/${encodeURIComponent(path)}`,
    })),
    error: null,
  }));

  const createQueryBuilder = () => {
    const eqFilters: Array<{ column: string; value: string }> = [];
    const ilikeFilters: Array<{ column: string; pattern: string }> = [];
    const ltFilters: Array<{ column: string; value: string }> = [];
    const orderFilters: Array<{ column: string; ascending: boolean }> = [];
    let orClause = "";

    const builder: {
      eq: ReturnType<typeof vi.fn>;
      ilike: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      lt: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn((column: string, value: string) => {
        eqFilters.push({ column, value });
        return builder;
      }),
      ilike: vi.fn((column: string, pattern: string) => {
        ilikeFilters.push({ column, pattern });
        return builder;
      }),
      or: vi.fn((clause: string) => {
        orClause = clause;
        return builder;
      }),
      lt: vi.fn((column: string, value: string) => {
        ltFilters.push({ column, value });
        return builder;
      }),
      order: vi.fn((column: string, options: { ascending: boolean }) => {
        orderFilters.push({ column, ascending: options.ascending });
        return builder;
      }),
      limit: vi.fn(async (value: number) => {
        let filtered = [...rows];
        for (const filter of eqFilters) {
          filtered = filtered.filter(
            (row) => String((row as Record<string, unknown>)[filter.column]) === filter.value
          );
        }
        for (const filter of ilikeFilters) {
          filtered = filtered.filter((row) =>
            matchesIlike(
              String((row as Record<string, unknown>)[filter.column] ?? ""),
              filter.pattern
            )
          );
        }
        for (const filter of ltFilters) {
          filtered = filtered.filter((row) => {
            const rowValue = String((row as Record<string, unknown>)[filter.column] ?? "");
            return rowValue < filter.value;
          });
        }
        if (orClause) {
          filtered = applySearchOrClause(filtered, orClause);
        }
        filtered.sort((left, right) => {
          for (const order of orderFilters) {
            const leftValue = String((left as Record<string, unknown>)[order.column] ?? "");
            const rightValue = String((right as Record<string, unknown>)[order.column] ?? "");
            const delta = leftValue.localeCompare(rightValue);
            if (delta === 0) continue;
            return order.ascending ? delta : -delta;
          }
          return 0;
        });
        return { data: filtered.slice(0, value), error: null };
      }),
    };

    return builder;
  };

  getSupabaseAdminMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => createQueryBuilder()),
      };
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrls: createSignedUrlsMock,
      })),
    },
  });

  return {
    createSignedUrlsMock,
  };
};

describe("POST /api/media/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    resolveMediaSigningStoragePathsMock.mockImplementation((row: { storage_path: string }) => [
      row.storage_path,
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enforces auth boundary", async () => {
    requireApiUserMock.mockResolvedValueOnce(null);
    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        surface: "media-library-route",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns scoped rows and signed map for a tab/query slice", async () => {
    createSupabaseAdminMock([
      {
        id: "media-1",
        user_id: "user-1",
        filename: "cat-shot.png",
        storage_path: "user-1/upload/cat-shot.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "media-2",
        user_id: "user-1",
        filename: "dog.mov",
        storage_path: "user-1/upload/dog.mov",
        file_type: "video/mp4",
        file_size: 12,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-19T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "media-3",
        user_id: "user-2",
        filename: "cat-external.png",
        storage_path: "user-2/upload/cat-external.png",
        file_type: "image/png",
        file_size: 9,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-18T10:00:00.000Z",
        updated_at: null,
      },
    ]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        query: "cat",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            id: "media-1",
          }),
        ],
        signedById: {
          "media-1": "https://signed.test/user-1%2Fupload%2Fcat-shot.png",
        },
      })
    );
  });

  it("supports keyset cursor paging without duplicates", async () => {
    createSupabaseAdminMock([
      {
        id: "c",
        user_id: "user-1",
        filename: "one.png",
        storage_path: "user-1/upload/one.png",
        file_type: "image/png",
        file_size: 1,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "b",
        user_id: "user-1",
        filename: "two.png",
        storage_path: "user-1/upload/two.png",
        file_type: "image/png",
        file_size: 1,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "a",
        user_id: "user-1",
        filename: "three.png",
        storage_path: "user-1/upload/three.png",
        file_type: "image/png",
        file_size: 1,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
      },
    ]);

    const firstReq = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        cursor: null,
        query: "",
        limit: 2,
        surface: "media-library-route",
      },
    };
    const firstRes = createMockResponse();
    await handler(firstReq as never, firstRes as never);

    const firstPayload = firstRes.json.mock.calls[0]?.[0];
    expect(firstPayload.rows.map((row: { id: string }) => row.id)).toEqual(["c", "b"]);
    expect(firstPayload.nextCursor).toEqual({
      createdAt: "2026-02-20T10:00:00.000Z",
      id: "b",
    });

    const secondReq = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        cursor: firstPayload.nextCursor,
        query: "",
        limit: 2,
        surface: "media-library-route",
      },
    };
    const secondRes = createMockResponse();
    await handler(secondReq as never, secondRes as never);
    const secondPayload = secondRes.json.mock.calls[0]?.[0];

    expect(secondPayload.rows.map((row: { id: string }) => row.id)).toEqual(["a"]);
  });

  it("uses elevated modal private initial sign seeding", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => {
      const n = String(index + 1).padStart(2, "0");
      return {
        id: `private-${n}`,
        user_id: "user-1",
        filename: `private-${n}.png`,
        storage_path: `user-1/private/images/private-${n}.png`,
        file_type: "image/png",
        file_size: 1,
        source: "private_upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: `2026-02-${n}T10:00:00.000Z`,
        updated_at: null,
      } satisfies MediaRow;
    });
    const { createSignedUrlsMock } = createSupabaseAdminMock(rows);

    const req = {
      method: "POST",
      body: {
        tab: "private",
        cursor: null,
        query: "",
        limit: 36,
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const signedPaths = createSignedUrlsMock.mock.calls[0]?.[0] as string[] | undefined;
    expect(signedPaths).toBeDefined();
    expect(signedPaths).toHaveLength(10);
  });

  it("returns 503 when list API flag is disabled", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_LIST_API_ENABLED", "false");
    createSupabaseAdminMock([]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        cursor: null,
        query: "",
        limit: 2,
        surface: "media-library-route",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
  });
});
