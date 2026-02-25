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
    const nowMs = Date.now();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_events: [
          {
            data: [
              {
                id: "evt-1",
                incident_id: "11111111-1111-4111-8111-111111111111",
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
          { count: 3, error: null },
          { count: 9, error: null },
          { count: 2, error: null },
          { count: 7, error: null },
          {
            data: [
              {
                occurred_at: new Date(nowMs - 2 * 60 * 1000).toISOString(),
                metadata: { tier: "video_long", reason: "tier_limit" },
              },
              {
                occurred_at: new Date(nowMs - 30 * 60 * 1000).toISOString(),
                metadata: { tier: "image_standard", reason: "global_limit" },
              },
              {
                occurred_at: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
                metadata: { tier: "image_heavy", reason: "global_and_tier_limit" },
              },
            ],
            error: null,
          },
        ],
        app_error_logs: [
          { data: [{ id: "11111111-1111-4111-8111-111111111111", status: "open" }], error: null },
        ],
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
        characterModeReferenceRefreshEmptyLastHourCount: number;
        characterModeReferenceRefreshEmptyLast24hCount: number;
        characterModeBundleUnavailableFallbackLastHourCount: number;
        characterModeBundleUnavailableFallbackLast24hCount: number;
        admissionDeniedTelemetry: {
          last15m: {
            total: number;
            byTier: Record<string, number>;
            byReason: Record<string, number>;
          };
          lastHour: {
            total: number;
            byTier: Record<string, number>;
            byReason: Record<string, number>;
          };
          last24h: {
            total: number;
            byTier: Record<string, number>;
            byReason: Record<string, number>;
          };
        };
        total15mBreached: boolean;
        high15mBreached: boolean;
        generation15mBreached: boolean;
      };
      health: {
        eventsTableAvailable: boolean;
        degraded: boolean;
        reason: string | null;
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
      characterModeReferenceRefreshEmptyLastHourCount: 3,
      characterModeReferenceRefreshEmptyLast24hCount: 9,
      characterModeBundleUnavailableFallbackLastHourCount: 2,
      characterModeBundleUnavailableFallbackLast24hCount: 7,
      total15mBreached: true,
      high15mBreached: true,
      generation15mBreached: true,
    });
    expect(payload.summary.admissionDeniedTelemetry).toMatchObject({
      last15m: {
        total: 1,
        byTier: {
          video_long: 1,
          image_heavy: 0,
          image_standard: 0,
          unknown: 0,
        },
        byReason: {
          tier_limit: 1,
          global_limit: 0,
          global_and_tier_limit: 0,
          unknown: 0,
        },
      },
      lastHour: {
        total: 2,
        byTier: {
          video_long: 1,
          image_heavy: 0,
          image_standard: 1,
          unknown: 0,
        },
        byReason: {
          tier_limit: 1,
          global_limit: 1,
          global_and_tier_limit: 0,
          unknown: 0,
        },
      },
      last24h: {
        total: 3,
        byTier: {
          video_long: 1,
          image_heavy: 1,
          image_standard: 1,
          unknown: 0,
        },
        byReason: {
          tier_limit: 1,
          global_limit: 1,
          global_and_tier_limit: 1,
          unknown: 0,
        },
      },
    });
    expect(payload.health).toMatchObject({
      eventsTableAvailable: true,
      degraded: false,
      reason: null,
    });
  });

  it("returns degraded mode when app_error_events is unavailable", async () => {
    const missingTableMessage =
      "Could not find the table 'public.app_error_events' in the schema cache";
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_events: [
          { data: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { count: null, error: { message: missingTableMessage } },
          { data: null, error: { message: missingTableMessage } },
        ],
        app_error_logs: [],
      })
    );

    const req = { method: "GET", query: { page: "1", limit: "20" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      events: unknown[];
      summary: {
        last15mCount: number;
        high15mCount: number;
        generation15mCount: number;
        total15mThreshold: number;
      };
      health: {
        eventsTableAvailable: boolean;
        degraded: boolean;
        reason: string | null;
      };
      pagination: {
        totalCount: number;
      };
    };
    expect(payload.events).toEqual([]);
    expect(payload.pagination.totalCount).toBe(0);
    expect(payload.summary).toMatchObject({
      last15mCount: 0,
      high15mCount: 0,
      generation15mCount: 0,
      total15mThreshold: 40,
    });
    expect(payload.health).toMatchObject({
      eventsTableAvailable: false,
      degraded: true,
    });
    expect(payload.health.reason).toContain("app_error_events");
  });

  it("returns degraded mode when app_error_events throws in catch path", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => {
        throw new Error('relation "app_error_events" does not exist');
      },
    });

    const req = { method: "GET", query: { page: "1", limit: "20" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      events: unknown[];
      health: {
        eventsTableAvailable: boolean;
        degraded: boolean;
        reason: string | null;
      };
    };
    expect(payload.events).toEqual([]);
    expect(payload.health).toMatchObject({
      eventsTableAvailable: false,
      degraded: true,
    });
    expect(payload.health.reason).toContain("app_error_events");
  });

  it("returns degraded health when non-core summary queries fail", async () => {
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
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { data: [], error: null },
        ],
        app_error_logs: [],
      })
    );

    const req = { method: "GET", query: { page: "1", limit: "20" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      health: {
        eventsTableAvailable: boolean;
        degraded: boolean;
        reason: string | null;
      };
      pagination: {
        page: number;
        totalPages: number;
      };
    };
    expect(payload.health).toMatchObject({
      eventsTableAvailable: true,
      degraded: true,
    });
    expect(payload.health.reason).toContain("pagination totals are estimated");
    expect(payload.pagination).toMatchObject({
      page: 1,
      totalPages: 1,
    });
  });

  it("returns 500 when core events query fails", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_events: [
          { data: null, error: { message: "core events failure" } },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { count: 0, error: null },
          { data: [], error: null },
        ],
        app_error_logs: [],
      })
    );

    const req = { method: "GET", query: { page: "1", limit: "20" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0]?.[0] as { error: string };
    expect(payload.error).toContain("core events failure");
  });
});
