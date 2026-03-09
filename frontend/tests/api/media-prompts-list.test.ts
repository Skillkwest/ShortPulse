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

describe("POST /api/media/prompts/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
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

  it("returns paged prompt rows for root folder", async () => {
    const rows = [
      {
        id: "prompt-2",
        title: "Prompt Two",
        prompt_text: "Prompt body two",
        mode: "text",
        source: "manual",
        created_at: "2026-03-02T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
      },
      {
        id: "prompt-1",
        title: "Prompt One",
        prompt_text: "Prompt body one",
        mode: "image",
        source: "manual",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ];

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_prompts") {
          throw new Error(`Unexpected table: ${table}`);
        }
        const builder = {
          eq: vi.fn(() => builder),
          in: vi.fn(() => builder),
          or: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(async () => ({ data: rows, error: null })),
        };
        return {
          select: vi.fn(() => builder),
        };
      }),
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
        rows,
        hasMore: false,
        nextCursor: null,
      })
    );
  });
});
