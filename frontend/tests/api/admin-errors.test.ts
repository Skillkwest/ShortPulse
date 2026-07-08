import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/errors";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
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

type QueryResult = {
  data?: unknown[] | null;
  count?: number | null;
  error?: { message: string } | null;
};

const createSupabaseAdminMock = (
  queues: Record<string, QueryResult[]>,
  orFilters: string[] = [],
  notFilters: Array<{ column: string; operator: string; value: string }> = []
) => ({
  from: (table: string) => {
    const queue = queues[table];
    if (!queue) {
      throw new Error(`Unexpected table: ${table}`);
    }

    let selected: QueryResult | null = null;
    const ensureSelected = () => {
      if (!selected) {
        selected = queue.shift() ?? { data: null, count: null, error: null };
      }
    };

    const query = {
      select: () => {
        ensureSelected();
        return query;
      },
      order: () => query,
      range: () => query,
      eq: () => query,
      gte: () => query,
      not: (column: string, operator: string, value: string) => {
        notFilters.push({ column, operator, value });
        return query;
      },
      or: (filters: string) => {
        orFilters.push(filters);
        return query;
      },
      then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) => {
        ensureSelected();
        const payload: QueryResult = {
          data: selected?.data ?? null,
          count: selected?.count ?? null,
          error: selected?.error ?? null,
        };
        return Promise.resolve(payload).then(resolve, reject);
      },
    };

    return query;
  },
});

const ADMIN_QUEUE_NON_ACTIONABLE_MESSAGE_PATTERNS = [
  "%flagged%as%sensitive%",
  "%content%polic%",
  "%content%not%allowed%",
  "%unsafe%content%",
  "%safety%policy%",
  "%safety%system%",
  "%safety%filter%",
  "%Fetched%media%exceeds%size%limit%",
  "%layer%images%are%unavailable%",
  "%layer%images%expired%",
  "%API%429%response%from%/api/kie/upload-url%",
  "%reference%preparation%failed:%Too%many%requests%",
  "%too%many%active%generations%",
  "%max%active%generations%",
] as const;

const expectedAdminQueueVisibilityFilters = (queryCount: number) =>
  Array.from({ length: queryCount }).flatMap(() =>
    ADMIN_QUEUE_NON_ACTIONABLE_MESSAGE_PATTERNS.map((value) => ({
      column: "message",
      operator: "ilike",
      value,
    }))
  );

describe("GET /api/admin/errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = { method: "GET", query: { page: "1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/errors.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load admin errors." });
  });

  it("returns incidents with summary and healthy status", async () => {
    const notFilters: Array<{ column: string; operator: string; value: string }> = [];
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock(
        {
          app_error_logs: [
            {
              data: [
                {
                  id: "inc-1",
                  source: "client.api_response",
                  scope: "app",
                  severity: "medium",
                  status: "open",
                  message: "API 500 response from /api/admin/errors",
                },
              ],
              error: null,
            },
            { count: 11, error: null },
            { count: 4, error: null },
            { count: 1, error: null },
            { count: 3, error: null },
            { count: 1, error: null },
            { count: 8, error: null },
          ],
        },
        [],
        notFilters
      )
    );

    const req = { method: "GET", query: { page: "1", limit: "50", status: "open" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(notFilters).toEqual(expectedAdminQueueVisibilityFilters(7));
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      errors: Array<{ id: string }>;
      summary: {
        openCount: number;
        highSeverityOpenCount: number;
        appOpenCount: number;
        generationOpenCount: number;
        last24hCount: number;
      };
      health: {
        degraded: boolean;
        reason: string | null;
      };
      pagination: {
        page: number;
        perPage: number;
        totalCount: number;
        totalPages: number;
      };
    };
    expect(payload.errors[0]?.id).toBe("inc-1");
    expect(payload.summary).toMatchObject({
      openCount: 4,
      highSeverityOpenCount: 1,
      appOpenCount: 3,
      generationOpenCount: 1,
      last24hCount: 8,
    });
    expect(payload.health).toMatchObject({
      degraded: false,
      reason: null,
    });
    expect(payload.pagination).toMatchObject({
      page: 1,
      perPage: 50,
      totalCount: 11,
      totalPages: 1,
    });
  });

  it("keeps provider-sensitive success incidents out of admin queue queries", async () => {
    const notFilters: Array<{ column: string; operator: string; value: string }> = [];
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock(
        {
          app_error_logs: [
            {
              data: [],
              error: null,
            },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
          ],
        },
        [],
        notFilters
      )
    );

    const req = { method: "GET", query: { status: "open", scope: "generation" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(notFilters).toEqual(expectedAdminQueueVisibilityFilters(7));
  });

  it("returns degraded health when non-core summary queries fail", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_logs: [
          { data: [], error: null },
          { count: null, error: { message: "count failure" } },
          { count: null, error: { message: "open count failure" } },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
        ],
      })
    );

    const req = { method: "GET", query: { page: "1", limit: "50", status: "open" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      health: {
        degraded: boolean;
        reason: string | null;
      };
      summary: {
        openCount: number;
      };
      pagination: {
        page: number;
        totalPages: number;
      };
    };
    expect(payload.health.degraded).toBe(true);
    expect(payload.health.reason).toContain("summary metrics");
    expect(payload.summary.openCount).toBe(0);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "admin/errors.summary",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        filtered_count_error: "count failure",
        open_count_error: "open count failure",
        high_severity_open_error: null,
        app_open_count_error: null,
        generation_open_count_error: null,
        last_24h_count_error: null,
      },
    });
    expect(payload.pagination).toMatchObject({
      page: 1,
      totalPages: 1,
    });
  });

  it("returns degraded payload when app_error_logs table is unavailable", async () => {
    const missingTableMessage =
      "Could not find the table 'public.app_error_logs' in the schema cache";
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_logs: [{ data: null, error: { message: missingTableMessage } }],
      })
    );

    const req = { method: "GET", query: { page: "1", limit: "50", status: "open" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      health: { degraded: boolean; reason: string | null };
      summary: {
        openCount: number;
        highSeverityOpenCount: number;
      };
      pagination: {
        page: number;
        perPage: number;
        totalCount: number;
      };
    };
    expect(payload.health).toMatchObject({
      degraded: true,
    });
    expect(payload.health.reason).toContain("app_error_logs");
    expect(payload.summary.openCount).toBe(0);
    expect(payload.summary.highSeverityOpenCount).toBe(0);
    expect(payload.pagination).toMatchObject({ page: 1, perPage: 50, totalCount: 0 });
  });

  it("keeps text search off uuid columns", async () => {
    const orFilters: string[] = [];
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock(
        {
          app_error_logs: [
            { data: [], error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
          ],
        },
        orFilters
      )
    );

    const req = { method: "GET", query: { search: "/api/media/list" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(orFilters).toHaveLength(2);
    for (const filter of orFilters) {
      expect(filter).toContain("endpoint.ilike.%/api/media/list%");
      expect(filter).toContain("route.ilike.%/api/media/list%");
      expect(filter).toContain("request_id.ilike.%/api/media/list%");
      expect(filter).not.toContain("user_id.ilike");
      expect(filter).not.toMatch(/(^|,)id\.ilike/);
    }
  });

  it("matches uuid searches with exact uuid filters", async () => {
    const orFilters: string[] = [];
    const uuid = "11111111-1111-4111-8111-111111111111";
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock(
        {
          app_error_logs: [
            { data: [], error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
            { count: 0, error: null },
          ],
        },
        orFilters
      )
    );

    const req = { method: "GET", query: { search: uuid } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(orFilters).toHaveLength(2);
    for (const filter of orFilters) {
      expect(filter).toContain(`id.eq.${uuid}`);
      expect(filter).toContain(`user_id.eq.${uuid}`);
      expect(filter).not.toContain("user_id.ilike");
      expect(filter).not.toMatch(/(^|,)id\.ilike/);
    }
  });

  it("returns 500 when core incident query fails", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_logs: [
          { data: null, error: { message: "core incident failure" } },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
        ],
      })
    );

    const req = { method: "GET", query: { page: "1", limit: "50", status: "open" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: { message: "core incident failure" },
      routeLabel: "admin/errors.list",
      user: { id: "admin-1", email: "admin@example.com" },
    });
    const payload = res.json.mock.calls[0]?.[0] as { error: string };
    expect(payload.error).toContain("core incident failure");
  });
});
