/**
 * Browser crash-session persistence tests.
 * Covers the server-side classification rules that decide which rows need review.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBrowserCrashSessions,
  recordBrowserSessionEvent,
  updateBrowserCrashSessionReviewStatus,
} from "../browserCrashSessions";

const getSupabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

type UpdatePayload = Record<string, unknown>;
type UpsertPayload = Record<string, unknown>;

const createSupabaseMock = () => {
  const updatePayloads: UpdatePayload[] = [];
  const upsertPayloads: UpsertPayload[] = [];
  const eqMock = vi.fn();
  const maybeSingleMock = vi
    .fn()
    .mockResolvedValue({ data: { id: "previous-row-id" }, error: null });
  const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const updateBuilder = {
    eq: eqMock,
    select: selectMock,
  };
  eqMock.mockReturnValue(updateBuilder);

  const updateMock = vi.fn((payload: UpdatePayload) => {
    updatePayloads.push(payload);
    return updateBuilder;
  });
  const upsertMock = vi.fn((payload: UpsertPayload) => {
    upsertPayloads.push(payload);
    return Promise.resolve({ error: null });
  });
  const fromMock = vi.fn(() => ({
    update: updateMock,
    upsert: upsertMock,
  }));

  return {
    client: { from: fromMock },
    eqMock,
    fromMock,
    upsertMock,
    updatePayloads,
    upsertPayloads,
  };
};

describe("browserCrashSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks only the previous row when the current session reports abandonment", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordBrowserSessionEvent({
      req: {
        headers: {
          "user-agent": "Mozilla/5.0 Chrome/120",
          host: "www.shortpulse.ai",
          "x-vercel-id": "iad1::abc",
        },
      } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "previous_session_abandoned",
        sessionId: "current-session",
        previousSessionId: "previous-session",
        route: "/ai-studio?projectId=secret",
        occurredAt: "2026-07-05T12:00:00.000Z",
        metadata: {
          last_heartbeat_age_ms: 120000,
          previous_last_seen_at: "2026-07-05T11:58:00.000Z",
          status_reason: "previous_session_missing_clean_close",
        },
      },
    });

    expect(result).toEqual({
      sessionId: "current-session",
      previousSessionId: "previous-row-id",
      eventType: "previous_session_abandoned",
    });
    expect(supabase.updatePayloads[0]).toMatchObject({
      status: "probable_freeze_or_crash",
      confidence: "medium",
      last_event: "previous_session_abandoned",
      suspected_at: "2026-07-05T12:00:00.000Z",
    });
    expect(supabase.upsertMock).not.toHaveBeenCalled();
  });

  it("records normal current-session starts as active rows", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordBrowserSessionEvent({
      req: {
        headers: {
          "user-agent": "Mozilla/5.0 Chrome/120",
          host: "www.shortpulse.ai",
          "x-vercel-id": "iad1::abc",
        },
      } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "session_start",
        sessionId: "current-session",
        route: "/ai-studio?projectId=secret",
        occurredAt: "2026-07-05T12:00:00.000Z",
        metadata: {
          build_id: "build-1",
          client_environment: "production",
        },
      },
    });

    expect(result).toEqual({
      sessionId: "current-session",
      previousSessionId: null,
      eventType: "session_start",
    });
    expect(supabase.updatePayloads).toHaveLength(0);
    expect(supabase.upsertMock).toHaveBeenCalledTimes(1);
    expect(supabase.upsertMock.mock.calls[0]?.[0]).toMatchObject({
      browser_session_id: "current-session",
      user_id: "user-1",
      user_email: "alpha@example.com",
      status: "active",
      confidence: "none",
      last_event: "session_start",
      review_status: "open",
      route: "/ai-studio?projectId",
      suspected_at: null,
    });
  });

  it("does not reset review state on later heartbeat upserts", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await recordBrowserSessionEvent({
      req: {
        headers: {
          "user-agent": "Mozilla/5.0 Chrome/120",
          host: "www.shortpulse.ai",
        },
      } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "heartbeat",
        sessionId: "current-session",
        route: "/ai-studio",
        occurredAt: "2026-07-05T12:01:00.000Z",
      },
    });

    expect(supabase.upsertMock.mock.calls[0]?.[0]).not.toHaveProperty("review_status");
  });

  it("maps the needs-review list filter to probable and confirmed crash rows", async () => {
    const inMock = vi.fn();
    const rangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "row-1",
          status: "probable_freeze_or_crash",
          confidence: "medium",
          last_seen_at: "2026-07-05T12:00:00.000Z",
        },
      ],
      error: null,
      count: 1,
    });
    const query = {
      select: vi.fn(),
      order: vi.fn(),
      in: inMock,
      eq: vi.fn(),
      or: vi.fn(),
      range: rangeMock,
    };
    query.select.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.or.mockReturnValue(query);
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await fetchBrowserCrashSessions({
      page: 1,
      limit: 50,
      status: "needs_review",
      reviewStatus: "open",
      search: "",
    });

    expect(inMock).toHaveBeenCalledWith("status", ["probable_freeze_or_crash", "confirmed_crash"]);
    expect(query.eq).toHaveBeenCalledWith("review_status", "open");
    expect(rangeMock).toHaveBeenCalledWith(0, 49);
    expect(result.pagination.totalCount).toBe(1);
    expect(result.sessions[0]).toMatchObject({
      id: "row-1",
      effective_status: "probable_freeze_or_crash",
    });
  });

  it("updates crash-session review state without changing crash evidence status", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await updateBrowserCrashSessionReviewStatus({
      user: { id: "admin-1", email: "admin@example.com" },
      payload: {
        sessionId: "crash-1",
        status: "resolved",
      },
    });

    expect(result).toEqual({
      id: "previous-row-id",
      review_status: "resolved",
      reviewed_at: null,
    });
    expect(supabase.updatePayloads[0]).toMatchObject({
      review_status: "resolved",
      reviewed_by: "admin-1",
      reviewed_by_email: "admin@example.com",
    });
    expect(supabase.updatePayloads[0]).not.toHaveProperty("status");
    expect(supabase.eqMock).toHaveBeenCalledWith("id", "crash-1");
  });
});
