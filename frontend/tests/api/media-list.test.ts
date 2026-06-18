import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/list";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveMediaSigningStoragePathsMock = vi.fn();
const resolvePreferredMediaSigningStoragePathMock = vi.fn();

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
  resolvePreferredMediaSigningStoragePath: (...args: unknown[]) =>
    resolvePreferredMediaSigningStoragePathMock(...args),
}));

type MediaRow = {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  width?: number | null;
  height?: number | null;
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
  folder_membership?: Array<{
    folder_id: string;
    user_id: string;
    project_id?: string;
  }>;
};

type GenerationProjectionRow = {
  generation_id: string;
  user_id: string;
  companion_art_status: string | null;
  companion_art_storage_path: string | null;
  workflow_reload?: unknown;
};

type ProjectOutputDisplayRow = {
  generation_id: string;
  user_id: string;
  companion_art_storage_path: string | null;
  companion_art_url_fallback?: string | null;
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

const projectRowForSelect = (row: MediaRow, selectClause: string): Record<string, unknown> => {
  const keys = selectClause
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const projected: Record<string, unknown> = {};
  for (const key of keys) {
    if (key.includes(":")) {
      const alias = key.split(":")[0]?.trim();
      if (alias) {
        projected[alias] = (row as Record<string, unknown>)[alias];
      }
      continue;
    }
    projected[key] = (row as Record<string, unknown>)[key];
  }
  return projected;
};

const matchesEqFilter = (row: MediaRow, column: string, value: string): boolean => {
  if (column.startsWith("folder_membership.")) {
    const membershipKey = column.replace("folder_membership.", "");
    return (row.folder_membership ?? []).some(
      (membership) => String((membership as Record<string, unknown>)[membershipKey] ?? "") === value
    );
  }
  return String((row as Record<string, unknown>)[column] ?? "") === value;
};

const createSupabaseAdminMock = (
  rows: MediaRow[],
  options?: {
    existingFolderIds?: string[];
    generationProjectionRows?: GenerationProjectionRow[];
    projectOutputDisplayRows?: ProjectOutputDisplayRow[];
  }
) => {
  const existingFolderIds = new Set(options?.existingFolderIds ?? []);
  const generationProjectionRows = options?.generationProjectionRows ?? [];
  const projectOutputDisplayRows = options?.projectOutputDisplayRows ?? [];
  const createSignedUrlsMock = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: `https://signed.test/${encodeURIComponent(path)}`,
    })),
    error: null,
  }));
  const createSignedUrlMock = vi.fn(async (path: string) => {
    const batchResult = await createSignedUrlsMock([path]);
    const first = batchResult.data?.[0];
    return {
      data: first?.signedUrl ? { signedUrl: first.signedUrl } : null,
      error: batchResult.error,
    };
  });

  const createQueryBuilder = (selectClause: string) => {
    const eqFilters: Array<{ column: string; value: string }> = [];
    const likeFilters: Array<{ column: string; pattern: string }> = [];
    const ilikeFilters: Array<{ column: string; pattern: string }> = [];
    const notLikeFilters: Array<{ column: string; pattern: string }> = [];
    const ltFilters: Array<{ column: string; value: string }> = [];
    const inFilters: Array<{ column: string; values: string[] }> = [];
    const orderFilters: Array<{ column: string; ascending: boolean }> = [];
    let orClause = "";

    const builder: {
      eq: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      like: ReturnType<typeof vi.fn>;
      ilike: ReturnType<typeof vi.fn>;
      not: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      lt: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn((column: string, value: string) => {
        eqFilters.push({ column, value });
        return builder;
      }),
      in: vi.fn((column: string, values: string[]) => {
        inFilters.push({ column, values });
        return builder;
      }),
      like: vi.fn((column: string, pattern: string) => {
        likeFilters.push({ column, pattern });
        return builder;
      }),
      ilike: vi.fn((column: string, pattern: string) => {
        ilikeFilters.push({ column, pattern });
        return builder;
      }),
      not: vi.fn((column: string, operator: string, pattern: string) => {
        if (operator === "like") {
          notLikeFilters.push({ column, pattern });
        }
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
          filtered = filtered.filter((row) => matchesEqFilter(row, filter.column, filter.value));
        }
        for (const filter of inFilters) {
          const allowed = new Set(filter.values);
          filtered = filtered.filter((row) =>
            allowed.has(String((row as Record<string, unknown>)[filter.column] ?? ""))
          );
        }
        for (const filter of likeFilters) {
          filtered = filtered.filter((row) =>
            matchesIlike(
              String((row as Record<string, unknown>)[filter.column] ?? ""),
              filter.pattern
            )
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
        for (const filter of notLikeFilters) {
          filtered = filtered.filter(
            (row) =>
              !matchesIlike(
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
        return {
          data: filtered.slice(0, value).map((row) => projectRowForSelect(row, selectClause)),
          error: null,
        };
      }),
    };

    return builder;
  };

  const createCountQueryBuilder = () => {
    const eqFilters: Array<{ column: string; value: string }> = [];
    const likeFilters: Array<{ column: string; pattern: string }> = [];
    const notLikeFilters: Array<{ column: string; pattern: string }> = [];

    const resolveCount = async () => {
      let filtered = [...rows];
      for (const filter of eqFilters) {
        filtered = filtered.filter((row) => matchesEqFilter(row, filter.column, filter.value));
      }
      for (const filter of likeFilters) {
        filtered = filtered.filter((row) =>
          matchesIlike(
            String((row as Record<string, unknown>)[filter.column] ?? ""),
            filter.pattern
          )
        );
      }
      for (const filter of notLikeFilters) {
        filtered = filtered.filter(
          (row) =>
            !matchesIlike(
              String((row as Record<string, unknown>)[filter.column] ?? ""),
              filter.pattern
            )
        );
      }
      return {
        count: filtered.length,
        error: null,
      };
    };

    type CountQueryResult = {
      count: number;
      error: null;
    };

    type CountQueryBuilder = {
      eq: (column: string, value: string) => CountQueryBuilder;
      like: (column: string, pattern: string) => CountQueryBuilder;
      not: (column: string, operator: string, pattern: string) => CountQueryBuilder;
      then: (
        onFulfilled?: ((value: CountQueryResult) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => Promise<unknown>;
      catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>;
      finally: (onFinally?: (() => void) | null) => Promise<CountQueryResult>;
    };

    const builder: CountQueryBuilder = {
      eq: vi.fn((column: string, value: string) => {
        eqFilters.push({ column, value });
        return builder;
      }),
      like: vi.fn((column: string, pattern: string) => {
        likeFilters.push({ column, pattern });
        return builder;
      }),
      not: vi.fn((column: string, operator: string, pattern: string) => {
        if (operator === "like") {
          notLikeFilters.push({ column, pattern });
        }
        return builder;
      }),
      then: (onFulfilled, onRejected) =>
        resolveCount().then(onFulfilled ?? undefined, onRejected ?? undefined),
      catch: (onRejected) => resolveCount().catch(onRejected ?? undefined),
      finally: (onFinally) => resolveCount().finally(onFinally ?? undefined),
    };

    return builder;
  };

  getSupabaseAdminMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "media_files") {
        return {
          select: vi.fn((selectClause: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count === "exact" && options?.head === true) {
              return createCountQueryBuilder();
            }
            return createQueryBuilder(selectClause);
          }),
        };
      }
      if (table === "media_folders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((idColumn: string, idValue: string) => ({
              eq: vi.fn((userColumn: string, userValue: string) => ({
                maybeSingle: vi.fn(async () => ({
                  data:
                    idColumn === "id" &&
                    userColumn === "user_id" &&
                    userValue === "user-1" &&
                    existingFolderIds.has(idValue)
                      ? { id: idValue }
                      : null,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "generation_projection") {
        return {
          select: vi.fn(() => {
            let scopedUserId: string | null = null;
            let scopedGenerationIds: string[] = [];
            const builder: {
              eq: ReturnType<typeof vi.fn>;
              in: ReturnType<typeof vi.fn>;
            } = {} as never;
            builder.eq = vi.fn((column: string, value: string) => {
              if (column === "user_id") {
                scopedUserId = value;
              }
              return builder;
            });
            builder.in = vi.fn(async (column: string, values: string[]) => {
              if (column === "generation_id") {
                scopedGenerationIds = values;
              }
              return {
                data: generationProjectionRows.filter(
                  (row) =>
                    (!scopedUserId || row.user_id === scopedUserId) &&
                    (!scopedGenerationIds.length || scopedGenerationIds.includes(row.generation_id))
                ),
                error: null,
              };
            });
            return builder;
          }),
        };
      }
      if (table === "project_output_display_items") {
        return {
          select: vi.fn(() => {
            let scopedUserId: string | null = null;
            let scopedGenerationIds: string[] = [];
            const builder: {
              eq: ReturnType<typeof vi.fn>;
              in: ReturnType<typeof vi.fn>;
            } = {} as never;
            builder.eq = vi.fn((column: string, value: string) => {
              if (column === "user_id") {
                scopedUserId = value;
              }
              return builder;
            });
            builder.in = vi.fn(async (column: string, values: string[]) => {
              if (column === "generation_id") {
                scopedGenerationIds = values;
              }
              return {
                data: projectOutputDisplayRows.filter(
                  (row) =>
                    (!scopedUserId || row.user_id === scopedUserId) &&
                    (!scopedGenerationIds.length || scopedGenerationIds.includes(row.generation_id))
                ),
                error: null,
              };
            });
            return builder;
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrls: createSignedUrlsMock,
        createSignedUrl: createSignedUrlMock,
      })),
    },
  });

  return {
    createSignedUrlsMock,
    createSignedUrlMock,
  };
};

describe("POST /api/media/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    resolveMediaSigningStoragePathsMock.mockImplementation((row: { storage_path: string }) => [
      row.storage_path,
    ]);
    resolvePreferredMediaSigningStoragePathMock.mockImplementation(
      (row: { storage_path: string }) => row.storage_path
    );
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
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("logs auth verifier failures before media queries or signing", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        surface: "media-library-modal",
        profile: "minimal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "media-list.auth",
        scope: "app",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to load media" });
  });

  it("returns scoped rows and signed map for a tab/query slice", async () => {
    const { createSignedUrlsMock, createSignedUrlMock } = createSupabaseAdminMock([
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
        profile: "expanded",
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
        signedById: undefined,
      })
    );
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it("drops contaminated rows whose primary storage path falls outside the caller scope", async () => {
    const { createSignedUrlsMock, createSignedUrlMock } = createSupabaseAdminMock([
      {
        id: "media-safe-1",
        user_id: "user-1",
        filename: "safe.png",
        storage_path: "user-1/upload/safe.png",
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
        id: "media-foreign-1",
        user_id: "user-1",
        filename: "foreign.png",
        storage_path: "user-2/upload/foreign.png",
        file_type: "image/png",
        file_size: 10,
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
    ]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        profile: "expanded",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ id: "media-safe-1" })],
      })
    );
  });

  it("pages over displayable caller-scoped media instead of letting newer unsafe rows mask valid rows", async () => {
    createSupabaseAdminMock([
      {
        id: "hidden-companion-newer",
        user_id: "user-1",
        filename: "cover.webp",
        storage_path: "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
        file_type: "audio",
        file_size: 10,
        source: "ai_studio",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-22T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "unsafe-newer",
        user_id: "user-1",
        filename: "unsafe-newer.png",
        storage_path: "legacy/uploads/unsafe-newer.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-21T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "unsafe-traversal",
        user_id: "user-1",
        filename: "unsafe-traversal.png",
        storage_path: "user-1/../unsafe-traversal.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T11:00:00.000Z",
        updated_at: null,
      },
      {
        id: "safe-older",
        user_id: "user-1",
        filename: "safe-older.png",
        storage_path: "user-1/upload/safe-older.png",
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
    ]);

    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        query: "",
        cursor: null,
        limit: 1,
        surface: "media-library-panel",
        profile: "expanded",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ id: "safe-older" })],
      })
    );
  });

  it("counts only caller-scoped displayable media for root saved totals", async () => {
    createSupabaseAdminMock([
      {
        id: "safe-counted",
        user_id: "user-1",
        filename: "safe-counted.png",
        storage_path: "user-1/upload/safe-counted.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-21T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "hidden-companion-not-counted",
        user_id: "user-1",
        filename: "cover.webp",
        storage_path: "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
        file_type: "audio",
        file_size: 10,
        source: "ai_studio",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-22T10:00:00.000Z",
        updated_at: null,
      },
      {
        id: "unsafe-not-counted",
        user_id: "user-1",
        filename: "unsafe-not-counted.png",
        storage_path: "legacy/uploads/unsafe-not-counted.png",
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
    ]);

    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        cursor: null,
        limit: 1,
        surface: "media-library-panel",
        includeLibraryTotalCount: true,
        countOnly: true,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [],
        libraryTotalCount: 1,
      })
    );
  });

  it("uses minimal profile by default and excludes metadata from rows", async () => {
    createSupabaseAdminMock([
      {
        id: "media-1",
        user_id: "user-1",
        filename: "cat-shot.png",
        storage_path: "user-1/upload/cat-shot.png",
        file_type: "image/png",
        width: 1024,
        height: 768,
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: { prompt: "cat", aspect_ratio: 4 / 3 },
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
      },
    ]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const payload = res.json.mock.calls[0]?.[0] as { rows: Array<Record<string, unknown>> };
    expect(payload.rows[0]?.metadata).toBeUndefined();
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-list-profile", "minimal");
  });

  it.each(["media-library-panel", "elements-media-panel", "character-media-panel"] as const)(
    "supports count-only requests for %s without row hydration or seeded signing",
    async (surface) => {
      const { createSignedUrlsMock, createSignedUrlMock } = createSupabaseAdminMock([
        {
          id: "media-1",
          user_id: "user-1",
          filename: "cat-shot.png",
          storage_path: "user-1/upload/cat-shot.png",
          file_type: "image/png",
          width: 1024,
          height: 768,
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
          filename: "dog-shot.png",
          storage_path: "user-1/upload/dog-shot.png",
          file_type: "image/png",
          width: 1024,
          height: 768,
          file_size: 10,
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
      ]);

      const req = {
        method: "POST",
        body: {
          mediaKind: "all",
          query: "",
          cursor: null,
          limit: 36,
          surface,
          includeLibraryTotalCount: true,
          countOnly: true,
        },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(createSignedUrlsMock).not.toHaveBeenCalled();
      expect(createSignedUrlMock).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-list-count-only", "true");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: [],
          hasMore: false,
          libraryTotalCount: 2,
        })
      );
    }
  );

  it("returns expanded rows with metadata when requested explicitly", async () => {
    createSupabaseAdminMock([
      {
        id: "media-1",
        user_id: "user-1",
        filename: "cat-shot.png",
        storage_path: "user-1/upload/cat-shot.png",
        file_type: "image/png",
        width: 1024,
        height: 768,
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: { prompt: "cat", aspect_ratio: 4 / 3 },
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
      },
    ]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        profile: "expanded",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const payload = res.json.mock.calls[0]?.[0] as {
      rows: Array<{ metadata?: Record<string, unknown> | null }>;
    };
    expect(payload.rows[0]?.metadata).toEqual({ prompt: "cat", aspect_ratio: 4 / 3 });
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-list-profile", "expanded");
  });

  it("enriches ai-generated audio rows with signed companion art", async () => {
    createSupabaseAdminMock(
      [
        {
          id: "hidden-audio-companion-row",
          user_id: "user-1",
          filename: "cover.webp",
          storage_path: "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
          file_type: "audio",
          file_size: 10,
          source: "ai_studio",
          source_ref: null,
          prompt_id: null,
          metadata: null,
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
          created_at: "2026-02-21T10:00:00.000Z",
          updated_at: null,
        },
        {
          id: "audio-1",
          user_id: "user-1",
          filename: "voice-note.wav",
          storage_path: "user-1/generations/audio/voice-note.wav",
          file_type: "audio/wav",
          file_size: 10,
          source: "ai_studio",
          source_ref: "gen-audio-1",
          prompt_id: null,
          metadata: null,
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
          created_at: "2026-02-20T10:00:00.000Z",
          updated_at: null,
        },
      ],
      {
        generationProjectionRows: [
          {
            generation_id: "gen-audio-1",
            user_id: "user-1",
            companion_art_status: "ready",
            companion_art_storage_path:
              "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
          },
        ],
      }
    );

    const req = {
      method: "POST",
      body: {
        mediaKind: "audio",
        query: "",
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
            id: "audio-1",
            companion_art_status: "ready",
            companion_art_storage_path:
              "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
            companion_art_url:
              "https://signed.test/user-1%2Fgenerations%2Faudio%2Fgen-audio-1%2Fcompanion-art%2Fcover.webp",
          }),
        ],
      })
    );
  });

  it("falls back to project output display companion art for audio media rows", async () => {
    createSupabaseAdminMock(
      [
        {
          id: "audio-display-1",
          user_id: "user-1",
          filename: "theme.mp3",
          storage_path: "user-1/generations/audio/theme.mp3",
          file_type: "audio/mpeg",
          file_size: 10,
          source: "ai_studio",
          source_ref: "gen-display-audio-1",
          prompt_id: null,
          metadata: null,
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
          created_at: "2026-02-20T10:00:00.000Z",
          updated_at: null,
        },
      ],
      {
        generationProjectionRows: [],
        projectOutputDisplayRows: [
          {
            generation_id: "gen-display-audio-1",
            user_id: "user-1",
            companion_art_storage_path:
              "user-1/generations/audio/gen-display-audio-1/companion-art/cover.webp",
            companion_art_url_fallback: "https://expired.example.com/cover.webp",
          },
        ],
      }
    );

    const req = {
      method: "POST",
      body: {
        mediaKind: "audio",
        query: "",
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
            id: "audio-display-1",
            companion_art_status: "ready",
            companion_art_storage_path:
              "user-1/generations/audio/gen-display-audio-1/companion-art/cover.webp",
            companion_art_url:
              "https://signed.test/user-1%2Fgenerations%2Faudio%2Fgen-display-audio-1%2Fcompanion-art%2Fcover.webp",
          }),
        ],
      })
    );
  });

  it("enriches saved AI Studio media rows with workflow reload metadata from projection", async () => {
    const workflowReload = {
      version: 1,
      source: "ai_studio_generation",
      capturedAt: "2026-06-06T14:00:00.000Z",
      originTool: "create",
      panelKind: "create",
      outputMode: "image",
      restoreBehavior: "navigate_and_hydrate",
      projectId: "project-1",
      createMode: "standard",
      pulse: null,
      prompt: {
        display: "A glass fox in a desert observatory",
      },
      model: {
        id: "fal-ai/imagen4/preview",
      },
      payload: {
        kind: "image",
        submitTool: "create",
        aspect: "16:9",
        imageResolution: "1K",
        referenceInputs: [],
        internalMediaRefs: [],
      },
    };
    createSupabaseAdminMock(
      [
        {
          id: "image-1",
          user_id: "user-1",
          filename: "glass-fox.png",
          storage_path: "user-1/generations/images/glass-fox.png",
          file_type: "image/png",
          file_size: 10,
          source: "ai_studio",
          source_ref: "gen-image-1",
          prompt_id: null,
          metadata: { prompt: "stale prompt" },
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
          created_at: "2026-02-20T10:00:00.000Z",
          updated_at: null,
        },
      ],
      {
        generationProjectionRows: [
          {
            generation_id: "gen-image-1",
            user_id: "user-1",
            companion_art_status: null,
            companion_art_storage_path: null,
            workflow_reload: workflowReload,
          },
        ],
      }
    );

    const req = {
      method: "POST",
      body: {
        mediaKind: "images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        profile: "expanded",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            id: "image-1",
            metadata: {
              prompt: "stale prompt",
              workflow_reload: workflowReload,
            },
          }),
        ],
      })
    );
  });

  it("does not sign or return out-of-scope companion art storage paths", async () => {
    const { createSignedUrlsMock, createSignedUrlMock } = createSupabaseAdminMock(
      [
        {
          id: "audio-foreign-companion-1",
          user_id: "user-1",
          filename: "voice-note.wav",
          storage_path: "user-1/generations/audio/voice-note.wav",
          file_type: "audio/wav",
          file_size: 10,
          source: "ai_studio",
          source_ref: "gen-audio-foreign-companion-1",
          prompt_id: null,
          metadata: null,
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
          created_at: "2026-02-20T10:00:00.000Z",
          updated_at: null,
        },
      ],
      {
        generationProjectionRows: [
          {
            generation_id: "gen-audio-foreign-companion-1",
            user_id: "user-1",
            companion_art_status: "ready",
            companion_art_storage_path: "user-2/generations/audio/victim/cover.webp",
          },
        ],
      }
    );

    const req = {
      method: "POST",
      body: {
        mediaKind: "audio",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            id: "audio-foreign-companion-1",
            companion_art_status: "ready",
            companion_art_storage_path: null,
            companion_art_url: null,
          }),
        ],
      })
    );
  });

  it("does not perform initial image signing for modal list hydration even when transform flags are enabled", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");

    const { createSignedUrlMock } = createSupabaseAdminMock([
      {
        id: "media-1",
        user_id: "user-1",
        filename: "cat-shot.png",
        storage_path: "user-1/upload/cat-shot.png",
        file_type: "image/png",
        width: 1024,
        height: 768,
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
    ]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-list-initial-signed-count", "0");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("excludes character-scoped storage paths when containment flag is enabled", async () => {
    createSupabaseAdminMock([
      {
        id: "media-1",
        user_id: "user-1",
        filename: "regular.png",
        storage_path: "user-1/upload/regular.png",
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
        filename: "character.png",
        storage_path: "user-1/characters/char-1/profile/character.png",
        file_type: "image/png",
        file_size: 8,
        source: "character_reference",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-21T10:00:00.000Z",
        updated_at: null,
      },
    ]);

    vi.stubEnv("SHORTPULSE_MEDIA_LIBRARY_EXCLUDE_CHARACTER_SCOPE", "true");

    const req = {
      method: "POST",
      body: {
        mediaKind: "images",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as { rows?: Array<{ id: string }> };
    expect(payload.rows?.map((row) => row.id)).toEqual(["media-1"]);
    expect(res.setHeader).toHaveBeenCalledWith(
      "x-shortpulse-media-list-character-scope-exclusion",
      "on"
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
        surface: "media-library-modal",
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
        surface: "media-library-modal",
      },
    };
    const secondRes = createMockResponse();
    await handler(secondReq as never, secondRes as never);
    const secondPayload = secondRes.json.mock.calls[0]?.[0];

    expect(secondPayload.rows.map((row: { id: string }) => row.id)).toEqual(["a"]);
  });

  it("does not seed initial signed urls for the modal surface", async () => {
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
    const { createSignedUrlsMock, createSignedUrlMock } = createSupabaseAdminMock(rows);

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

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-list-initial-signed-count", "0");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([expect.objectContaining({ id: "private-01" })]),
        signedById: undefined,
      })
    );
  });

  it("seeds initial signed urls for the panel surface on the default mixed open", async () => {
    const rows = [
      {
        id: "audio-1",
        user_id: "user-1",
        filename: "audio-1.wav",
        storage_path: "user-1/uploads/audio/audio-1.wav",
        file_type: "audio/wav",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T12:00:00.000Z",
        updated_at: null,
      } satisfies MediaRow,
      {
        id: "panel-media-1",
        user_id: "user-1",
        filename: "panel-target.png",
        storage_path: "user-1/uploads/images/panel-target.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: "user-1/uploads/images/panel-target-thumb.png",
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T11:00:00.000Z",
        updated_at: null,
      } satisfies MediaRow,
      {
        id: "panel-media-2",
        user_id: "user-1",
        filename: "panel-target-2.png",
        storage_path: "user-1/uploads/images/panel-target-2.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: "user-1/uploads/images/panel-target-2-thumb.png",
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
      } satisfies MediaRow,
      {
        id: "panel-media-3",
        user_id: "user-1",
        filename: "panel-target-3.png",
        storage_path: "user-1/uploads/images/panel-target-3.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: "user-1/uploads/images/panel-target-3-thumb.png",
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T09:00:00.000Z",
        updated_at: null,
      } satisfies MediaRow,
    ];
    const { createSignedUrlsMock, createSignedUrlMock } = createSupabaseAdminMock(rows);
    resolvePreferredMediaSigningStoragePathMock.mockImplementation(
      (row: MediaRow) => row.thumb_variant_path ?? row.storage_path
    );

    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        cursor: null,
        query: "",
        limit: 36,
        surface: "media-library-panel",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      ["user-1/uploads/audio/audio-1.wav", "user-1/uploads/images/panel-target-thumb.png"],
      3600
    );
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-list-initial-signed-count", "2");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({ id: "panel-media-1" }),
          expect.objectContaining({ id: "panel-media-2" }),
          expect.objectContaining({ id: "panel-media-3" }),
        ]),
        signedById: {
          "audio-1": "https://signed.test/user-1%2Fuploads%2Faudio%2Faudio-1.wav",
          "panel-media-1": "https://signed.test/user-1%2Fuploads%2Fimages%2Fpanel-target-thumb.png",
        },
      })
    );
  });

  it("sanitizes foreign variant paths out of returned rows before seeded signing", async () => {
    const rows = [
      {
        id: "panel-foreign-variant-1",
        user_id: "user-1",
        filename: "panel-target.png",
        storage_path: "user-1/uploads/images/panel-target.png",
        file_type: "image/png",
        file_size: 10,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: null,
        thumb_variant_path: "user-2/uploads/images/foreign-thumb.png",
        poster_variant_path: "user-2/uploads/images/foreign-poster.png",
        preview_variant_path: "user-2/uploads/images/foreign-preview.png",
        created_at: "2026-02-20T11:00:00.000Z",
        updated_at: null,
      } satisfies MediaRow,
    ];
    const { createSignedUrlsMock } = createSupabaseAdminMock(rows);
    resolvePreferredMediaSigningStoragePathMock.mockImplementation(
      (row: MediaRow) => row.thumb_variant_path ?? row.storage_path
    );

    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        cursor: null,
        query: "",
        limit: 36,
        surface: "media-library-panel",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      ["user-1/uploads/images/panel-target.png"],
      3600
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            id: "panel-foreign-variant-1",
            storage_path: "user-1/uploads/images/panel-target.png",
            thumb_variant_path: null,
            poster_variant_path: null,
            preview_variant_path: null,
          }),
        ],
        signedById: {
          "panel-foreign-variant-1":
            "https://signed.test/user-1%2Fuploads%2Fimages%2Fpanel-target.png",
        },
      })
    );
  });

  it("seeds only the first usable signed previews for the panel mixed open", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: `panel-seed-${index + 1}`,
      user_id: "user-1",
      filename: `panel-seed-${index + 1}.png`,
      storage_path: `user-1/uploads/images/panel-seed-${index + 1}.png`,
      file_type: "image/png",
      file_size: 10,
      source: "upload",
      source_ref: null,
      prompt_id: null,
      metadata: null,
      thumb_variant_path: `user-1/uploads/images/panel-seed-${index + 1}-thumb.png`,
      poster_variant_path: null,
      preview_variant_path: null,
      created_at: `2026-02-20T0${5 - index}:00:00.000Z`,
      updated_at: null,
    })) as MediaRow[];
    const { createSignedUrlsMock } = createSupabaseAdminMock(rows);
    resolvePreferredMediaSigningStoragePathMock.mockImplementation(
      (row: MediaRow) => row.thumb_variant_path
    );

    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        cursor: null,
        query: "",
        limit: 36,
        surface: "media-library-panel",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      [
        "user-1/uploads/images/panel-seed-1-thumb.png",
        "user-1/uploads/images/panel-seed-2-thumb.png",
      ],
      3600
    );
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-list-initial-signed-count", "2");
  });

  it.each(["elements-media-panel", "character-media-panel"] as const)(
    "seeds initial signed urls for the %s surface on the default mixed open",
    async (surface) => {
      const rows = [
        {
          id: "elements-audio-1",
          user_id: "user-1",
          filename: "elements-audio-1.wav",
          storage_path: "user-1/uploads/audio/elements-audio-1.wav",
          file_type: "audio/wav",
          file_size: 10,
          source: "upload",
          source_ref: null,
          prompt_id: null,
          metadata: null,
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
          created_at: "2026-02-20T12:00:00.000Z",
          updated_at: null,
        } satisfies MediaRow,
        {
          id: "elements-media-1",
          user_id: "user-1",
          filename: "elements-target.png",
          storage_path: "user-1/uploads/images/elements-target.png",
          file_type: "image/png",
          file_size: 10,
          source: "upload",
          source_ref: null,
          prompt_id: null,
          metadata: null,
          thumb_variant_path: "user-1/uploads/images/elements-target-thumb.png",
          poster_variant_path: null,
          preview_variant_path: null,
          created_at: "2026-02-20T11:00:00.000Z",
          updated_at: null,
        } satisfies MediaRow,
      ];
      const { createSignedUrlsMock } = createSupabaseAdminMock(rows);
      resolvePreferredMediaSigningStoragePathMock.mockImplementation(
        (row: MediaRow) => row.thumb_variant_path ?? row.storage_path
      );

      const req = {
        method: "POST",
        body: {
          mediaKind: "all",
          cursor: null,
          query: "",
          limit: 36,
          surface,
        },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(createSignedUrlsMock).toHaveBeenCalledWith(
        [
          "user-1/uploads/audio/elements-audio-1.wav",
          "user-1/uploads/images/elements-target-thumb.png",
        ],
        3600
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "x-shortpulse-media-list-initial-signed-count",
        "2"
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          signedById: {
            "elements-audio-1":
              "https://signed.test/user-1%2Fuploads%2Faudio%2Felements-audio-1.wav",
            "elements-media-1":
              "https://signed.test/user-1%2Fuploads%2Fimages%2Felements-target-thumb.png",
          },
        })
      );
    }
  );

  it("keeps the canonical list API available without an env gate", async () => {
    createSupabaseAdminMock([]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        cursor: null,
        query: "",
        limit: 2,
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [],
        hasMore: false,
      })
    );
  });

  it("returns 400 for invalid profile values", async () => {
    createSupabaseAdminMock([]);

    const req = {
      method: "POST",
      body: {
        tab: "uploaded_images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        profile: "full-fat",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid tab, surface, or profile",
      })
    );
  });

  it("supports panel mediaKind queries without tab", async () => {
    createSupabaseAdminMock([
      {
        id: "media-image-1",
        user_id: "user-1",
        filename: "frame.png",
        storage_path: "user-1/upload/frame.png",
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
        id: "media-video-1",
        user_id: "user-1",
        filename: "clip.mp4",
        storage_path: "user-1/upload/clip.mp4",
        file_type: "video/mp4",
        file_size: 10,
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
    ]);

    const req = {
      method: "POST",
      body: {
        mediaKind: "images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        folderId: "all_items",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload.rows.map((row: { id: string }) => row.id)).toEqual(["media-image-1"]);
  });

  it("supports audio mediaKind queries without tab", async () => {
    createSupabaseAdminMock([
      {
        id: "media-audio-1",
        user_id: "user-1",
        filename: "voice.mp3",
        storage_path: "user-1/upload/voice.mp3",
        file_type: "audio/mpeg",
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
        id: "media-video-1",
        user_id: "user-1",
        filename: "clip.mp4",
        storage_path: "user-1/upload/clip.mp4",
        file_type: "video/mp4",
        file_size: 10,
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
    ]);

    const req = {
      method: "POST",
      body: {
        mediaKind: "audio",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-panel",
        folderId: "all_items",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload.rows.map((row: { id: string }) => row.id)).toEqual(["media-audio-1"]);
  });

  it("returns 400 for invalid folder id", async () => {
    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        folderId: "not-a-uuid",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid folder id",
      })
    );
  });

  it("ignores malformed project ids because folder authority is global", async () => {
    createSupabaseAdminMock([]);

    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        projectId: "not-a-project-id",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [],
      })
    );
  });

  it("returns 404 when a custom folder is not found", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_folders") throw new Error(`Unexpected table: ${table}`);
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
        };
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: vi.fn(),
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        mediaKind: "all",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Folder not found",
      })
    );
  });

  it("filters custom folders through folder membership join semantics", async () => {
    const rows: MediaRow[] = [
      {
        id: "media-image-1",
        user_id: "user-1",
        filename: "forest.png",
        storage_path: "user-1/uploads/forest.png",
        file_type: "image/png",
        width: 1024,
        height: 768,
        file_size: 1234,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: { alt: "Forest" },
        thumb_variant_path: "user-1/variants/forest-thumb.webp",
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
        folder_membership: [
          {
            folder_id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
            user_id: "user-1",
          },
        ],
      },
      {
        id: "media-image-2",
        user_id: "user-1",
        filename: "desert.png",
        storage_path: "user-1/uploads/desert.png",
        file_type: "image/png",
        width: 1024,
        height: 768,
        file_size: 2234,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: { alt: "Desert" },
        thumb_variant_path: "user-1/variants/desert-thumb.webp",
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-19T10:00:00.000Z",
        updated_at: null,
        folder_membership: [],
      },
    ];

    createSupabaseAdminMock(rows, {
      existingFolderIds: ["2d6fc803-2289-47a9-9a07-063ebf2eec4f"],
    });

    const req = {
      method: "POST",
      body: {
        mediaKind: "images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload.rows.map((row: { id: string }) => row.id)).toEqual(["media-image-1"]);
  });

  it("filters custom folders even when a project id is provided", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const folderId = "2d6fc803-2289-47a9-9a07-063ebf2eec4f";
    const rows: MediaRow[] = [
      {
        id: "media-image-1",
        user_id: "user-1",
        filename: "forest.png",
        storage_path: "user-1/uploads/forest.png",
        file_type: "image/png",
        width: 1024,
        height: 768,
        file_size: 1234,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: { alt: "Forest" },
        thumb_variant_path: "user-1/variants/forest-thumb.webp",
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-20T10:00:00.000Z",
        updated_at: null,
        folder_membership: [
          {
            folder_id: folderId,
            user_id: "user-1",
            project_id: projectId,
          },
        ],
      },
      {
        id: "media-image-2",
        user_id: "user-1",
        filename: "desert.png",
        storage_path: "user-1/uploads/desert.png",
        file_type: "image/png",
        width: 1024,
        height: 768,
        file_size: 2234,
        source: "upload",
        source_ref: null,
        prompt_id: null,
        metadata: { alt: "Desert" },
        thumb_variant_path: "user-1/variants/desert-thumb.webp",
        poster_variant_path: null,
        preview_variant_path: null,
        created_at: "2026-02-19T10:00:00.000Z",
        updated_at: null,
        folder_membership: [],
      },
    ];

    createSupabaseAdminMock(rows, {
      existingFolderIds: [folderId],
    });

    const req = {
      method: "POST",
      body: {
        mediaKind: "images",
        query: "",
        cursor: null,
        limit: 36,
        surface: "media-library-modal",
        folderId,
        projectId,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload.rows.map((row: { id: string }) => row.id)).toEqual(["media-image-1"]);
  });
});
