/**
 * Browser crash-session persistence tests.
 * Covers the server-side classification rules that decide which rows need review.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBrowserCrashSessions,
  recordBrowserCrashReports,
  recordBrowserSessionEvent,
  updateBrowserCrashSessionReviewStatus,
} from "../browserCrashSessions";

const getSupabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

type UpdatePayload = Record<string, unknown>;
type UpsertPayload = Record<string, unknown>;

const createSupabaseMock = (
  selectedPreviousRow: Record<string, unknown> | null = { id: "previous-row-id", metadata: {} }
) => {
  const updatePayloads: UpdatePayload[] = [];
  const upsertPayloads: UpsertPayload[] = [];
  const updateEqMock = vi.fn();
  const updateMaybeSingleMock = vi
    .fn()
    .mockResolvedValue({ data: { id: "previous-row-id" }, error: null });
  const updateSelectMock = vi.fn(() => ({ maybeSingle: updateMaybeSingleMock }));
  const updateBuilder = {
    eq: updateEqMock,
    select: updateSelectMock,
  };
  updateEqMock.mockReturnValue(updateBuilder);

  const selectEqMock = vi.fn();
  const selectMaybeSingleMock = vi
    .fn()
    .mockResolvedValue({ data: selectedPreviousRow, error: null });
  const selectBuilder = {
    eq: selectEqMock,
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: selectMaybeSingleMock,
  };
  selectEqMock.mockReturnValue(selectBuilder);
  selectBuilder.order.mockReturnValue(selectBuilder);
  selectBuilder.limit.mockReturnValue(selectBuilder);
  const selectMock = vi.fn(() => selectBuilder);

  const updateMock = vi.fn((payload: UpdatePayload) => {
    updatePayloads.push(payload);
    return updateBuilder;
  });
  const upsertMock = vi.fn((payload: UpsertPayload) => {
    upsertPayloads.push(payload);
    return Promise.resolve({ error: null });
  });
  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
    upsert: upsertMock,
  }));

  return {
    client: { from: fromMock },
    eqMock: updateEqMock,
    fromMock,
    selectMaybeSingleMock,
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

  it("preserves previous row metadata when marking abandonment evidence", async () => {
    const supabase = createSupabaseMock({
      id: "previous-row-id",
      metadata: {
        build_id: "previous-build",
        client_release: "previous-release",
        client_environment: "production",
        pressure_level: 2,
      },
    });
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
        eventType: "previous_session_abandoned",
        sessionId: "current-session",
        previousSessionId: "previous-session",
        route: "/ai-studio?projectId=secret",
        occurredAt: "2026-07-05T12:00:00.000Z",
        metadata: {
          build_id: "detector-build",
          client_release: "detector-release",
          client_environment: "production",
          visibility_state: "visible",
          document_hidden: false,
          last_heartbeat_age_ms: 120000,
          previous_last_seen_at: "2026-07-05T11:58:00.000Z",
          status_reason: "previous_session_missing_clean_close",
        },
      },
    });

    expect(supabase.updatePayloads[0]).toMatchObject({
      confidence: "high",
      metadata: {
        build_id: "previous-build",
        client_release: "previous-release",
        client_environment: "production",
        pressure_level: 2,
        last_heartbeat_age_ms: 120000,
        previous_last_seen_at: "2026-07-05T11:58:00.000Z",
        status_reason: "previous_session_missing_clean_close",
        abandonment_detected_build_id: "detector-build",
        abandonment_detected_client_release: "detector-release",
        abandonment_detected_client_environment: "production",
        abandonment_detected_visibility_state: "visible",
        abandonment_detected_document_hidden: false,
      },
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

  it("preserves high-water pressure evidence when later heartbeat metadata is calm", async () => {
    const supabase = createSupabaseMock({
      id: "current-row-id",
      metadata: {
        pressure_level: 2,
        heap_used_to_total_ratio: 0.94,
        max_input_stall_ms: 1400,
        pressure_event_count: 1,
        last_pressure_snapshot_at: "2026-07-05T12:00:20.000Z",
      },
    });
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
        route: "/ai-studio?projectId=secret&sid=runtime",
        occurredAt: "2026-07-05T12:01:00.000Z",
        metadata: {
          heap_used_to_limit_ratio: 0.014,
          heap_usage_ratio: 0.014,
          used_js_heap_size: 58_109_145,
          js_heap_size_limit: 4_395_630_592,
        },
      },
    });

    expect(supabase.upsertMock.mock.calls[0]?.[0]).toMatchObject({
      last_event: "heartbeat",
      route: "/ai-studio?projectId&sid",
      metadata: {
        pressure_level: 2,
        heap_used_to_total_ratio: 0.94,
        heap_used_to_limit_ratio: 0.014,
        heap_usage_ratio: 0.014,
        max_pressure_level: 2,
        max_heap_used_to_total_ratio: 0.94,
        max_input_stall_ms: 1400,
        pressure_event_count: 1,
        last_pressure_snapshot_at: "2026-07-05T12:00:20.000Z",
      },
    });
  });

  it("increments pressure snapshot high-water evidence", async () => {
    const supabase = createSupabaseMock({
      id: "current-row-id",
      metadata: {
        pressure_level: 1,
        max_pressure_level: 1,
        pressure_event_count: 1,
      },
    });
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
        eventType: "pressure_snapshot",
        sessionId: "current-session",
        route: "/ai-studio",
        occurredAt: "2026-07-05T12:02:00.000Z",
        metadata: {
          pressure_level: 2,
          heap_used_to_total_ratio: 0.91,
        },
      },
    });

    expect(supabase.upsertMock.mock.calls[0]?.[0]).toMatchObject({
      status: "active",
      confidence: "none",
      metadata: {
        pressure_level: 2,
        max_pressure_level: 2,
        heap_used_to_total_ratio: 0.91,
        max_heap_used_to_total_ratio: 0.91,
        pressure_event_count: 2,
        last_pressure_snapshot_at: "2026-07-05T12:02:00.000Z",
      },
    });
  });

  it("confirms an existing session from a browser-delivered Reporting API crash", async () => {
    const supabase = createSupabaseMock({
      id: "current-row-id",
      route: "/ai-studio?projectId&sid",
      metadata: {
        pressure_level: 1,
        pressure_event_count: 2,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordBrowserCrashReports({
      payload: [
        {
          type: "crash",
          age: 1250,
          url: "https://www.shortpulse.ai/ai-studio?projectId=secret&sid=secret",
          body: {
            reason: "oom",
            visibility_state: "visible",
            is_top_level: true,
            crash_report_api: {
              shortpulse_browser_session_id: "current-session",
              shortpulse_route: "/ai-studio?projectId&sid",
              shortpulse_build_id: "build-1",
              shortpulse_client_release: "release-1",
              shortpulse_client_environment: "production",
              shortpulse_pressure_level: "2",
              shortpulse_max_input_stall_ms: "1400",
              shortpulse_heap_used_to_total_ratio: "0.91",
              shortpulse_heap_used_to_limit_ratio: "0.72",
            },
          },
        },
      ],
    });

    expect(result).toEqual({
      received: 1,
      processed: 1,
      skipped: 0,
      sessionIds: ["current-session"],
    });
    expect(supabase.updatePayloads[0]).toMatchObject({
      status: "confirmed_crash",
      confidence: "high",
      last_event: "crash_report",
      route: "/ai-studio?projectId&sid",
      build_id: "build-1",
      client_release: "release-1",
      client_environment: "production",
      metadata: {
        crash_report_source: "reporting_api",
        crash_report_type: "crash",
        crash_report_url_path: "/ai-studio?projectId&sid",
        crash_report_age_ms: 1250,
        crash_report_reason: "oom",
        crash_report_visibility_state: "visible",
        crash_report_is_top_level: true,
        pressure_level: 2,
        max_pressure_level: 2,
        max_input_stall_ms: 1400,
        heap_used_to_total_ratio: 0.91,
        max_heap_used_to_total_ratio: 0.91,
        heap_used_to_limit_ratio: 0.72,
        max_heap_used_to_limit_ratio: 0.72,
        pressure_event_count: 2,
      },
    });
    expect(supabase.eqMock).toHaveBeenCalledWith("id", "current-row-id");
    expect(supabase.upsertMock).not.toHaveBeenCalled();
  });

  it("accepts browser crash reports supplied as a raw JSON string payload", async () => {
    const supabase = createSupabaseMock({
      id: "current-row-id",
      route: "/ai-studio?projectId&sid",
      metadata: {},
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordBrowserCrashReports({
      payload: JSON.stringify([
        {
          type: "crash",
          body: {
            reason: "unresponsive",
            crash_report_api: {
              shortpulse_browser_session_id: "current-session",
            },
          },
        },
      ]),
    });

    expect(result).toMatchObject({
      received: 1,
      processed: 1,
      skipped: 0,
      sessionIds: ["current-session"],
    });
    expect(supabase.updatePayloads[0]).toMatchObject({
      status: "confirmed_crash",
      confidence: "high",
      metadata: expect.objectContaining({
        crash_report_reason: "unresponsive",
      }),
    });
  });

  it("does not create rows for browser crash reports without session context", async () => {
    const supabase = createSupabaseMock(null);
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordBrowserCrashReports({
      payload: [
        {
          type: "crash",
          body: {
            reason: "unresponsive",
          },
        },
      ],
    });

    expect(result).toEqual({
      received: 1,
      processed: 0,
      skipped: 1,
      sessionIds: [],
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(supabase.fromMock).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
    expect(supabase.upsertMock).not.toHaveBeenCalled();
  });

  it("does not create rows for browser crash reports with unknown session ids", async () => {
    const supabase = createSupabaseMock(null);
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordBrowserCrashReports({
      payload: [
        {
          type: "crash",
          body: {
            crash_report_api: {
              shortpulse_browser_session_id: "unknown-session",
            },
          },
        },
      ],
    });

    expect(result).toEqual({
      received: 1,
      processed: 0,
      skipped: 1,
      sessionIds: [],
    });
    expect(supabase.updatePayloads).toHaveLength(0);
    expect(supabase.upsertMock).not.toHaveBeenCalled();
  });

  it("maps the needs-review list filter to confirmed and probable crash rows", async () => {
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
    expect(query.or).not.toHaveBeenCalledWith(expect.stringContaining("status.eq.active"));
    expect(query.eq).toHaveBeenCalledWith("review_status", "open");
    expect(rangeMock).toHaveBeenCalledWith(0, 49);
    expect(result.pagination.totalCount).toBe(1);
    expect(result.sessions[0]).toMatchObject({
      id: "row-1",
      effective_status: "probable_freeze_or_crash",
    });
  });

  it("maps possible ungraceful exit to stored and stale-active rows", async () => {
    const orMock = vi.fn();
    const rangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "row-1",
          status: "active",
          confidence: "none",
          last_seen_at: "2026-07-05T12:00:00.000Z",
        },
      ],
      error: null,
      count: 1,
    });
    const query = {
      select: vi.fn(),
      order: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
      or: orMock,
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

    await fetchBrowserCrashSessions({
      page: 1,
      limit: 50,
      status: "possible_ungraceful_exit",
      reviewStatus: "open",
      search: "",
    });

    expect(orMock).toHaveBeenCalledWith(
      expect.stringContaining("status.eq.possible_ungraceful_exit")
    );
    expect(orMock).toHaveBeenCalledWith(expect.stringContaining("status.eq.active"));
    expect(orMock).toHaveBeenCalledWith(expect.stringContaining("last_seen_at.lt."));
    expect(query.eq).toHaveBeenCalledWith("review_status", "open");
  });

  it("maps the reviewed history filter to resolved and ignored review rows", async () => {
    const inMock = vi.fn();
    const rangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "row-1",
          status: "probable_freeze_or_crash",
          confidence: "medium",
          review_status: "resolved",
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

    await fetchBrowserCrashSessions({
      page: 1,
      limit: 50,
      status: "needs_review",
      reviewStatus: "reviewed",
      search: "",
    });

    expect(inMock).toHaveBeenCalledWith("status", ["probable_freeze_or_crash", "confirmed_crash"]);
    expect(inMock).toHaveBeenCalledWith("review_status", ["resolved", "ignored"]);
    expect(query.eq).not.toHaveBeenCalledWith("review_status", "reviewed");
    expect(rangeMock).toHaveBeenCalledWith(0, 49);
  });

  it("updates crash-session review state without changing crash evidence status", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await updateBrowserCrashSessionReviewStatus({
      user: { id: "admin-1", email: "admin@example.com" },
      payload: {
        sessionId: "crash-1",
        status: "resolved",
        note: "Monitoring only.",
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
      review_note: "Monitoring only.",
    });
    expect(supabase.updatePayloads[0]).not.toHaveProperty("status");
    expect(supabase.eqMock).toHaveBeenCalledWith("id", "crash-1");
  });
});
