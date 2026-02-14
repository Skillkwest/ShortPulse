import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/error-events";

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

const createSupabaseAdminMock = (queues: Record<string, QueryResult[]>) => ({
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
      like: () => query,
      not: () => query,
      gte: () => query,
      or: () => query,
      in: () => query,
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

describe("GET /api/admin/error-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    process.env.SHORTPULSE_ADMIN_ALERT_TOTAL_15M = "40";
    process.env.SHORTPULSE_ADMIN_ALERT_HIGH_15M = "8";
    process.env.SHORTPULSE_ADMIN_ALERT_GENERATION_15M = "20";
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns enriched events with threshold summary", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_events: [
          {
            data: [
              {
                id: "evt-1",
                incident_id: "inc-1",
                fingerprint: "fp-1",
                source: "api.example",
                scope: "app",
                severity: "high",
                message: "Boom",
                stack: null,
                route: "api/example",
                endpoint: "/api/example",
                request_id: "req-1",
                http_status: 500,
                user_id: "user-1",
                user_email: "user@example.com",
                metadata: {},
                occurred_at: "2026-02-14T00:00:00.000Z",
                created_at: "2026-02-14T00:00:00.000Z",
              },
            ],
            error: null,
          },
          { count: 123, error: null },
          { count: 50, error: null },
          { count: 9, error: null },
          { count: 22, error: null },
          { count: 60, error: null },
          { count: 500, error: null },
          { count: 300, error: null },
          { count: 200, error: null },
          { count: 40, error: null },
        ],
        app_error_logs: [{ data: [{ id: "inc-1", status: "open" }], error: null }],
      })
    );

    const req = {
      method: "GET",
      query: { page: "1", limit: "50", synthetic: "exclude" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      events: Array<{ id: string; incident_status: string | null }>;
      summary: {
        last15mCount: number;
        high15mCount: number;
        generation15mCount: number;
        total15mThreshold: number;
        high15mThreshold: number;
        generation15mThreshold: number;
        total15mBreached: boolean;
        high15mBreached: boolean;
        generation15mBreached: boolean;
      };
    };

    expect(payload.events[0]).toMatchObject({
      id: "evt-1",
      incident_status: "open",
    });
    expect(payload.summary).toMatchObject({
      last15mCount: 50,
      high15mCount: 9,
      generation15mCount: 22,
      total15mThreshold: 40,
      high15mThreshold: 8,
      generation15mThreshold: 20,
      total15mBreached: true,
      high15mBreached: true,
      generation15mBreached: true,
    });
  });

  it("returns 500 when query execution fails", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_events: [
          { data: [], error: null },
          { count: null, error: { message: "db failure" } },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
        ],
        app_error_logs: [],
      })
    );

    const req = { method: "GET", query: { page: "1", limit: "20" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0]?.[0] as { error: string };
    expect(payload.error).toContain("db failure");
  });
});
