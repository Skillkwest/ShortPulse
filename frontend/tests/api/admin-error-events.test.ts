import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/error-events";
import * as errorEventQueries from "../../lib/server/api/adminErrorEvents/queries";

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
    const queue = queues[table] ?? [];

    let selected: QueryResult | null = null;
    const eqCalls: string[] = [];
    const ensureSelected = () => {
      if (!selected) {
        selected = queue.shift() ?? { data: null, count: null, error: null };
      }
    };

    const query = {
      select: (columns?: string) => {
        ensureSelected();
        return query;
      },
      order: () => query,
      range: () => query,
      eq: (column: string, value: string) => {
        eqCalls.push(`${column}=${value}`);
        return query;
      },
      in: () => query,
      is: () => query,
      like: () => query,
      not: () => query,
      gte: () => query,
      or: () => query,
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
    vi.restoreAllMocks();
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    process.env.SHORTPULSE_ADMIN_ALERT_TOTAL_15M = "40";
    process.env.SHORTPULSE_ADMIN_ALERT_HIGH_15M = "8";
    process.env.SHORTPULSE_ADMIN_ALERT_GENERATION_15M = "20";
    process.env.SHORTPULSE_ADMIN_ALERT_PROVIDER_RUNNING_TIMEOUT_15M = "2";
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
                metadata: {
                  tier: "video_long",
                  reason: "tier_limit",
                  admission_scope: "shared_provider",
                },
              },
              {
                occurred_at: new Date(nowMs - 30 * 60 * 1000).toISOString(),
                metadata: {
                  tier: "image_standard",
                  reason: "global_limit",
                  admission_scope: "per_user",
                },
              },
              {
                occurred_at: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
                metadata: {
                  tier: "image_heavy",
                  reason: "global_and_tier_limit",
                  admission_scope: "per_user",
                },
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
        providerRunningTimeout15mCount: number;
        total15mThreshold: number;
        high15mThreshold: number;
        generation15mThreshold: number;
        providerRunningTimeout15mThreshold: number;
        characterModeReferenceRefreshEmptyLastHourCount: number;
        characterModeReferenceRefreshEmptyLast24hCount: number;
        characterModeBundleUnavailableFallbackLastHourCount: number;
        characterModeBundleUnavailableFallbackLast24hCount: number;
        admissionDeniedTelemetry: {
          last15m: {
            total: number;
            byTier: Record<string, number>;
            byReason: Record<string, number>;
            byScope: Record<string, number>;
          };
          lastHour: {
            total: number;
            byTier: Record<string, number>;
            byReason: Record<string, number>;
            byScope: Record<string, number>;
          };
          last24h: {
            total: number;
            byTier: Record<string, number>;
            byReason: Record<string, number>;
            byScope: Record<string, number>;
          };
        };
        total15mBreached: boolean;
        high15mBreached: boolean;
        generation15mBreached: boolean;
        providerRunningTimeout15mBreached: boolean;
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
      providerRunningTimeout15mCount: 0,
      total15mThreshold: 40,
      high15mThreshold: 8,
      generation15mThreshold: 20,
      providerRunningTimeout15mThreshold: 2,
      characterModeReferenceRefreshEmptyLastHourCount: 3,
      characterModeReferenceRefreshEmptyLast24hCount: 9,
      characterModeBundleUnavailableFallbackLastHourCount: 2,
      characterModeBundleUnavailableFallbackLast24hCount: 7,
      total15mBreached: true,
      high15mBreached: true,
      generation15mBreached: true,
      providerRunningTimeout15mBreached: false,
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
        byScope: {
          per_user: 0,
          shared_provider: 1,
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
        byScope: {
          per_user: 1,
          shared_provider: 1,
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
        byScope: {
          per_user: 2,
          shared_provider: 1,
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

  it("returns actionable events by combining open incidents and unlinked rows", async () => {
    const req = {
      method: "GET",
      query: { page: "1", limit: "50", synthetic: "exclude", incident: "actionable" },
    };
    const res = createMockResponse();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        app_error_logs: [
          {
            data: [
              { id: "11111111-1111-4111-8111-111111111111", status: "open" },
              { id: "22222222-2222-4222-8222-222222222222", status: "resolved" },
            ],
            error: null,
          },
        ],
      })
    );
    vi.spyOn(errorEventQueries, "fetchErrorEventsDataset").mockResolvedValue({
      eventsResult: {
        data: [
          {
            id: "evt-ignored",
            incident_id: "22222222-2222-4222-8222-222222222222",
            source: "api-ignored",
            scope: "app",
            severity: "low",
            message: "Ignored from dataset",
            occurred_at: "2026-02-27T18:01:00.000Z",
          },
        ],
        error: null,
      },
      filteredCountResult: { count: 0, error: null },
      last15mCountResult: { count: 3, error: null },
      high15mCountResult: { count: 1, error: null },
      generation15mCountResult: { count: 0, error: null },
      providerRunningTimeout15mCountResult: { count: 0, error: null },
      lastHourCountResult: { count: 3, error: null },
      last24hCountResult: { count: 3, error: null },
      app24hCountResult: { count: 3, error: null },
      generation24hCountResult: { count: 3, error: null },
      high24hCountResult: { count: 1, error: null },
      characterModeReferenceRefreshEmptyLastHourCountResult: { count: 1, error: null },
      characterModeReferenceRefreshEmptyLast24hCountResult: { count: 0, error: null },
      characterModeBundleUnavailableFallbackLastHourCountResult: { count: 0, error: null },
      characterModeBundleUnavailableFallbackLast24hCountResult: { count: 0, error: null },
      admissionDeniedTelemetryRowsResult: { data: [], error: null },
    });
    vi.spyOn(errorEventQueries, "fetchActionableErrorEvents").mockResolvedValue({
      openEventsResult: {
        data: [
          {
            id: "evt-open",
            incident_id: "11111111-1111-4111-8111-111111111111",
            source: "api.beta",
            scope: "app",
            severity: "high",
            message: "Open incident event",
            occurred_at: "2026-02-27T17:59:00.000Z",
          },
        ],
        error: null,
      },
      unlinkedEventsResult: {
        data: [
          {
            id: "evt-unlinked",
            incident_id: null,
            source: "api.alpha",
            scope: "app",
            severity: "medium",
            message: "Unlinked event",
            occurred_at: "2026-02-27T18:00:00.000Z",
          },
        ],
        error: null,
      },
      openCountResult: { count: 1, error: null },
      unlinkedCountResult: { count: 1, error: null },
    });

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      events: Array<{ id: string }>;
      health: { degraded: boolean; reason: string | null };
      pagination: { totalCount: number };
    };

    expect(payload.events.map((event) => event.id)).toEqual(["evt-unlinked", "evt-open"]);
    expect(payload.pagination.totalCount).toBe(2);
    expect(payload.health.degraded).toBe(false);
    expect(payload.health.reason).toBeNull();
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
