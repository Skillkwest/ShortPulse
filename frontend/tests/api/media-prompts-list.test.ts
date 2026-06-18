import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/prompts/list";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

type PromptRow = {
  id: string;
  user_id?: string;
  title: string | null;
  prompt_text: string;
  mode: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
  folder_membership?: Array<{
    folder_id: string;
    user_id: string;
    project_id?: string;
  }>;
};

const createSupabaseAdminMock = (
  rows: PromptRow[],
  options?: {
    existingFolderIds?: string[];
  }
) => {
  const existingFolderIds = new Set(options?.existingFolderIds ?? []);

  const createQueryBuilder = (selectClause: string) => {
    const eqFilters: Array<{ column: string; value: string }> = [];
    const ltFilters: Array<{ column: string; value: string }> = [];
    const orderFilters: Array<{ column: string; ascending: boolean }> = [];
    let orClause = "";

    const projectRow = (row: PromptRow): Record<string, unknown> => {
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

    const matchesEq = (row: PromptRow, column: string, value: string): boolean => {
      if (column.startsWith("folder_membership.")) {
        const membershipKey = column.replace("folder_membership.", "");
        return (row.folder_membership ?? []).some(
          (membership) =>
            String((membership as Record<string, unknown>)[membershipKey] ?? "") === value
        );
      }
      return String((row as Record<string, unknown>)[column] ?? "") === value;
    };

    const matchesSearch = (row: PromptRow, clause: string): boolean => {
      const segments = clause.split(",").map((segment) => segment.trim());
      return segments.some((segment) => {
        const [left, ...rest] = segment.split(".ilike.");
        const pattern = rest.join(".ilike.").replace(/[%*]/g, ".*");
        const regex = new RegExp(`^${pattern}$`, "i");
        const value =
          left === "title" ? (row.title ?? "") : left === "prompt_text" ? row.prompt_text : "";
        return regex.test(value);
      });
    };

    const builder: {
      eq: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      lt: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn((column: string, value: string) => {
        eqFilters.push({ column, value });
        return builder;
      }),
      or: vi.fn((clause: string) => {
        orClause = clause;
        return builder;
      }),
      order: vi.fn((column: string, options: { ascending: boolean }) => {
        orderFilters.push({ column, ascending: options.ascending });
        return builder;
      }),
      limit: vi.fn(async (value: number) => {
        let filtered = [...rows];
        for (const filter of eqFilters) {
          filtered = filtered.filter((row) => matchesEq(row, filter.column, filter.value));
        }
        for (const filter of ltFilters) {
          filtered = filtered.filter(
            (row) => String((row as Record<string, unknown>)[filter.column] ?? "") < filter.value
          );
        }
        if (orClause) {
          filtered = filtered.filter((row) => matchesSearch(row, orClause));
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
        return { data: filtered.slice(0, value).map(projectRow), error: null };
      }),
      lt: vi.fn((column: string, value: string) => {
        ltFilters.push({ column, value });
        return builder;
      }),
    };

    return builder;
  };

  getSupabaseAdminMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "media_prompts") {
        return {
          select: vi.fn((selectClause: string) => createQueryBuilder(selectClause)),
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
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
};

describe("POST /api/media/prompts/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("logs auth verifier failures before folder or prompt queries", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "POST",
      body: {
        folderId: "all_items",
        query: "",
        cursor: null,
        limit: 10,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: authError,
        routeLabel: "media-prompts-list.auth",
        scope: "app",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to list prompts" });
  });

  it("returns 400 for invalid custom folder ids", async () => {
    const req = {
      method: "POST",
      body: {
        folderId: "not-a-uuid",
        query: "",
        cursor: null,
        limit: 10,
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

  it("returns 404 when a custom folder is not found for the caller", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_folders") {
          throw new Error(`Unexpected table: ${table}`);
        }
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
    });

    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        query: "",
        cursor: null,
        limit: 10,
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

  it("ignores malformed project ids because folder authority is global", async () => {
    createSupabaseAdminMock([]);

    const req = {
      method: "POST",
      body: {
        folderId: "all_items",
        projectId: "not-a-project-id",
        query: "",
        cursor: null,
        limit: 10,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [],
        hasMore: false,
        nextCursor: null,
      })
    );
  });

  it("returns paged prompt rows for root folder", async () => {
    const rows: PromptRow[] = [
      {
        id: "prompt-2",
        user_id: "user-1",
        title: "Prompt Two",
        prompt_text: "Prompt body two",
        mode: "text",
        source: "manual",
        created_at: "2026-03-02T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
      },
      {
        id: "prompt-1",
        user_id: "user-1",
        title: "Prompt One",
        prompt_text: "Prompt body one",
        mode: "image",
        source: "manual",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ];

    createSupabaseAdminMock(rows);
    const expectedRows = rows.map((row) => {
      const normalizedRow = { ...row };
      delete normalizedRow.user_id;
      return normalizedRow;
    });

    const req = {
      method: "POST",
      body: {
        folderId: "all_items",
        query: "",
        cursor: null,
        limit: 10,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expectedRows,
        hasMore: false,
        nextCursor: null,
      })
    );
  });

  it("filters custom folders through folder membership join semantics", async () => {
    const rows: PromptRow[] = [
      {
        id: "prompt-2",
        user_id: "user-1",
        title: "Prompt Two",
        prompt_text: "Prompt body two",
        mode: "text",
        source: "manual",
        created_at: "2026-03-02T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
        folder_membership: [
          {
            folder_id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
            user_id: "user-1",
          },
        ],
      },
      {
        id: "prompt-1",
        user_id: "user-1",
        title: "Prompt One",
        prompt_text: "Prompt body one",
        mode: "image",
        source: "manual",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        folder_membership: [],
      },
    ];

    createSupabaseAdminMock(rows, {
      existingFolderIds: ["2d6fc803-2289-47a9-9a07-063ebf2eec4f"],
    });

    const req = {
      method: "POST",
      body: {
        folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        query: "",
        cursor: null,
        limit: 10,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ id: "prompt-2" })],
        hasMore: false,
        nextCursor: null,
      })
    );
  });

  it("filters custom folders even when a project id is provided", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const folderId = "2d6fc803-2289-47a9-9a07-063ebf2eec4f";
    const rows: PromptRow[] = [
      {
        id: "prompt-2",
        user_id: "user-1",
        title: "Prompt Two",
        prompt_text: "Prompt body two",
        mode: "text",
        source: "manual",
        created_at: "2026-03-02T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
        folder_membership: [
          {
            folder_id: folderId,
            user_id: "user-1",
            project_id: projectId,
          },
        ],
      },
      {
        id: "prompt-1",
        user_id: "user-1",
        title: "Prompt One",
        prompt_text: "Prompt body one",
        mode: "image",
        source: "manual",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        folder_membership: [],
      },
    ];

    createSupabaseAdminMock(rows, {
      existingFolderIds: [folderId],
    });

    const req = {
      method: "POST",
      body: {
        folderId,
        projectId,
        query: "",
        cursor: null,
        limit: 10,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ id: "prompt-2" })],
        hasMore: false,
        nextCursor: null,
      })
    );
  });
});
