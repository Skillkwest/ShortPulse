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
  const rpcMock = vi.fn(async (functionName: string, args: Record<string, unknown>) => {
    if (functionName !== "record_browser_crash_session_event_v1") {
      return { data: null, error: new Error(`Unexpected RPC: ${functionName}`) };
    }
    const eventType = String(args.p_event_type);
    const existingMetadata =
      selectedPreviousRow?.metadata && typeof selectedPreviousRow.metadata === "object"
        ? (selectedPreviousRow.metadata as Record<string, unknown>)
        : {};
    const incomingMetadata = (args.p_metadata ?? {}) as Record<string, unknown>;
    const mergedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      ...Object.fromEntries(Object.entries(incomingMetadata).filter(([, value]) => value !== null)),
    };
    if (eventType === "pressure_snapshot") {
      mergedMetadata.pressure_event_count = Math.min(
        10_000,
        Number(existingMetadata.pressure_event_count ?? 0) + 1
      );
      mergedMetadata.last_pressure_snapshot_at = args.p_occurred_at;
    }
    const maxPressureLevel = Math.max(
      Number(existingMetadata.max_pressure_level ?? existingMetadata.pressure_level ?? 0),
      Number(incomingMetadata.pressure_level ?? 0)
    );
    if (maxPressureLevel > 0) mergedMetadata.max_pressure_level = maxPressureLevel;
    const maxHeapUsedToTotalRatio = Math.max(
      Number(
        existingMetadata.max_heap_used_to_total_ratio ??
          existingMetadata.heap_used_to_total_ratio ??
          0
      ),
      Number(incomingMetadata.heap_used_to_total_ratio ?? 0)
    );
    if (maxHeapUsedToTotalRatio > 0) {
      mergedMetadata.max_heap_used_to_total_ratio = maxHeapUsedToTotalRatio;
    }
    const prioritizedMetadata = Object.fromEntries(
      [
        ...Object.keys(incomingMetadata),
        ...Object.keys(mergedMetadata).filter(
          (key) => !Object.prototype.hasOwnProperty.call(incomingMetadata, key)
        ),
      ]
        .slice(0, 48)
        .map((key) => [key, mergedMetadata[key]])
    );
    const payload = {
      browser_session_id: args.p_browser_session_id,
      user_id: args.p_user_id,
      user_email: args.p_user_email,
      last_event: eventType,
      route: args.p_route,
      build_id: args.p_build_id,
      client_release: args.p_client_release,
      client_environment: args.p_client_environment,
      user_agent: args.p_user_agent,
      host: args.p_host,
      vercel_id: args.p_vercel_id,
      metadata: prioritizedMetadata,
      started_at: eventType === "session_start" ? args.p_occurred_at : undefined,
      last_seen_at: args.p_occurred_at,
      ended_at:
        eventType === "clean_close" || eventType === "crash_report" ? args.p_occurred_at : null,
      suspected_at:
        eventType === "previous_session_abandoned" || eventType === "crash_report"
          ? args.p_occurred_at
          : null,
      updated_at: args.p_occurred_at,
      status:
        eventType === "crash_report"
          ? "confirmed_crash"
          : eventType === "clean_close"
            ? "clean_closed"
            : eventType === "previous_session_abandoned"
              ? "possible_ungraceful_exit"
              : "active",
      confidence:
        eventType === "crash_report"
          ? "high"
          : eventType === "previous_session_abandoned"
            ? "low"
            : "none",
      review_status: eventType === "session_start" ? "open" : undefined,
    };
    const updateOnly = args.p_allow_insert !== true;
    if (updateOnly && !selectedPreviousRow) return { data: null, error: null };
    if (updateOnly) updateMock(payload);
    else void upsertMock(payload);
    return {
      data: String(selectedPreviousRow?.id ?? "current-row-id"),
      error: null,
    };
  });
  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
    upsert: upsertMock,
  }));

  return {
    client: { from: fromMock, rpc: rpcMock },
    eqMock: updateEqMock,
    fromMock,
    selectMaybeSingleMock,
    upsertMock,
    updatePayloads,
    upsertPayloads,
    rpcMock,
  };
};

const createListRpcMock = (data: Record<string, unknown>) => {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { client: { rpc }, rpc };
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
      status: "possible_ungraceful_exit",
      confidence: "low",
      last_event: "previous_session_abandoned",
      suspected_at: expect.any(String),
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
      status: "possible_ungraceful_exit",
      confidence: "low",
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

  it("does not upgrade hidden-document timer stalls to high confidence", async () => {
    const supabase = createSupabaseMock({
      id: "previous-row-id",
      metadata: {
        client_environment: "production",
        document_hidden: true,
        stall_duration_ms: 54130,
        visibility_state: "hidden",
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
        route: "/admin/reports",
        occurredAt: "2026-07-07T21:43:02.165Z",
        metadata: {
          last_heartbeat_age_ms: 241166,
          previous_last_seen_at: "2026-07-07T21:39:00.999Z",
          status_reason: "previous_session_missing_clean_close",
        },
      },
    });

    expect(supabase.updatePayloads[0]).toMatchObject({
      status: "possible_ungraceful_exit",
      confidence: "low",
      metadata: {
        client_environment: "production",
        document_hidden: true,
        stall_duration_ms: 54130,
        visibility_state: "hidden",
      },
    });
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

  it("does not let authenticated lifecycle input self-assert a confirmed crash", async () => {
    const supabase = createSupabaseMock(null);
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordBrowserSessionEvent({
      req: { headers: {} } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "crash_report",
        sessionId: "buffered-crash-session",
        route: "/ai-studio?projectId=secret",
        occurredAt: "2026-07-05T12:00:00.000Z",
        metadata: { crash_report_type: "crash" },
      },
    });

    expect(result).toEqual({
      sessionId: "buffered-crash-session",
      previousSessionId: null,
      eventType: "heartbeat",
    });
    expect(supabase.rpcMock).toHaveBeenCalledWith(
      "record_browser_crash_session_event_v1",
      expect.objectContaining({
        p_user_id: "user-1",
        p_event_type: "heartbeat",
        p_allow_insert: true,
      })
    );
    expect(supabase.upsertPayloads[0]).toMatchObject({
      status: "active",
      confidence: "none",
      ended_at: null,
      suspected_at: null,
    });
  });

  it("uses bounded client occurrence time but server receipt time for session ordering", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T20:00:00.000Z"));
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await recordBrowserSessionEvent({
      req: { headers: {} } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "session_start",
        sessionId: "clock-skew-session",
        occurredAt: "2099-01-01T00:00:00.000Z",
      },
    });

    expect(supabase.rpcMock.mock.calls[0]?.[1]).toMatchObject({
      p_occurred_at: "2026-07-10T20:00:00.000Z",
    });
    vi.useRealTimers();
  });

  it("sends only sanitized incoming metadata and leaves row merging to the database guard", async () => {
    const supabase = createSupabaseMock({
      id: "current-row-id",
      metadata: { pressure_level: 2, pressure_event_count: 4 },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await recordBrowserSessionEvent({
      req: { headers: {} } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "heartbeat",
        sessionId: "atomic-session",
        metadata: { visibility_state: "visible" },
      },
    });

    expect(supabase.selectMaybeSingleMock).not.toHaveBeenCalled();
    expect(supabase.rpcMock.mock.calls[0]?.[1]?.p_metadata).toMatchObject({
      visibility_state: "visible",
    });
    expect(supabase.rpcMock.mock.calls[0]?.[1]?.p_metadata).not.toHaveProperty("pressure_level");
  });

  it("preserves browser storage estimate metadata through the crash-session allowlist", async () => {
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
        eventType: "session_start",
        sessionId: "current-session",
        route: "/ai-studio",
        occurredAt: "2026-07-05T12:00:00.000Z",
        metadata: {
          storage_estimate_usage_bytes: 250_000_000,
          storage_estimate_quota_bytes: 1_000_000_000,
          storage_estimate_available_bytes: 750_000_000,
          storage_estimate_usage_to_quota_ratio: 0.25,
          storage_estimate_raw_detail: "must-not-persist",
        },
      },
    });

    expect(supabase.upsertMock.mock.calls[0]?.[0]).toMatchObject({
      metadata: {
        storage_estimate_usage_bytes: 250_000_000,
        storage_estimate_quota_bytes: 1_000_000_000,
        storage_estimate_available_bytes: 750_000_000,
        storage_estimate_usage_to_quota_ratio: 0.25,
      },
    });
    expect(
      (supabase.upsertMock.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> }).metadata
    ).not.toHaveProperty("storage_estimate_raw_detail");
  });

  it("bounds oversized heap evidence and rejects malformed numeric fields", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await recordBrowserSessionEvent({
      req: { headers: {} } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "heartbeat",
        sessionId: "current-session",
        occurredAt: "2026-07-05T12:01:00.000Z",
        metadata: {
          used_js_heap_size: 1e100,
          total_js_heap_size: "not-a-number",
          js_heap_size_limit: -10,
          heap_used_to_limit_ratio: "0.9",
          heap_used_to_total_ratio: 4,
          stall_duration_ms: 1e100,
          document_hidden: "false",
          visibility_state: "sideways",
        },
      },
    });

    expect(supabase.upsertPayloads[0]?.metadata).toMatchObject({
      used_js_heap_size: Number.MAX_SAFE_INTEGER,
      js_heap_size_limit: 0,
      heap_used_to_total_ratio: 1,
      stall_duration_ms: 86_400_000,
    });
    expect(supabase.upsertPayloads[0]?.metadata).not.toHaveProperty("total_js_heap_size");
    expect(supabase.upsertPayloads[0]?.metadata).not.toHaveProperty("heap_used_to_limit_ratio");
    expect(supabase.upsertPayloads[0]?.metadata).not.toHaveProperty("document_hidden");
    expect(supabase.upsertPayloads[0]?.metadata).not.toHaveProperty("visibility_state");
  });

  it("prioritizes critical crash evidence after more than 48 earlier metadata keys", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase.client);
    const leadingNoise = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`untrusted_noise_${index}`, index])
    );

    await recordBrowserSessionEvent({
      req: { headers: {} } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "pressure_snapshot",
        sessionId: "priority-session",
        occurredAt: "2026-07-05T12:01:00.000Z",
        metadata: {
          ...leadingNoise,
          used_js_heap_size: 646 * 1024 * 1024,
          js_heap_size_limit: 4_395_630_592,
          heap_used_to_limit_ratio: 0.154,
          visibility_state: "visible",
          document_hidden: false,
          stall_duration_ms: 2100,
          pressure_level: 2,
          max_pressure_level: 2,
          pressure_reason: "heap_pressure",
        },
      },
    });

    expect(supabase.upsertPayloads[0]?.metadata).toMatchObject({
      used_js_heap_size: 646 * 1024 * 1024,
      js_heap_size_limit: 4_395_630_592,
      heap_used_to_limit_ratio: 0.154,
      visibility_state: "visible",
      document_hidden: false,
      stall_duration_ms: 2100,
      pressure_level: 2,
      max_pressure_level: 2,
      pressure_reason: "heap_pressure",
    });
    expect(Object.keys(supabase.upsertPayloads[0]?.metadata as object).length).toBeLessThanOrEqual(
      48
    );
  });

  it("keeps incoming critical evidence when merging a full prior metadata row", async () => {
    const priorKeys = [
      "build_id",
      "client_release",
      "client_environment",
      "connection_downlink",
      "connection_effective_type",
      "connection_rtt",
      "connection_save_data",
      "crash_report_age_ms",
      "crash_report_is_top_level",
      "crash_report_reason",
      "crash_report_source",
      "crash_report_type",
      "crash_report_url_path",
      "crash_report_visibility_state",
      "device_memory",
      "device_pixel_ratio",
      "document_was_discarded",
      "dom_audios",
      "dom_canvases",
      "dom_images",
      "dom_nodes",
      "dom_videos",
      "extension_roots",
      "hardware_concurrency",
      "heartbeat_interval_ms",
      "is_secure_context",
      "last_heartbeat_age_ms",
      "last_pressure_snapshot_at",
      "long_task_p95_ms",
      "max_heap_used_to_limit_ratio",
      "max_heap_used_to_total_ratio",
      "max_input_stall_ms",
      "max_pressure_level",
      "navigation_type",
      "pagehide_persisted",
      "pageshow_persisted",
      "pressure_event_count",
      "pressure_transition",
      "previous_pressure_level",
      "previous_last_seen_at",
      "rendered_item_count",
      "resource_api_count",
      "resource_decoded_bytes",
      "resource_fetch_count",
      "resource_count",
      "resource_transfer_bytes",
      "screen_height",
      "screen_width",
      "session_age_ms",
      "storage_estimate_available_bytes",
      "storage_estimate_quota_bytes",
    ];
    const previousMetadata = Object.fromEntries(
      priorKeys.map((key) => {
        if (
          [
            "connection_save_data",
            "crash_report_is_top_level",
            "document_was_discarded",
            "is_secure_context",
            "pagehide_persisted",
            "pageshow_persisted",
          ].includes(key)
        ) {
          return [key, false];
        }
        return [
          key,
          key.includes("_id") ||
          key.includes("source") ||
          key.includes("type") ||
          key.includes("reason") ||
          key.includes("path") ||
          key.includes("transition") ||
          key.includes("at")
            ? "value"
            : 1,
        ];
      })
    );
    const supabase = createSupabaseMock({ id: "current-row-id", metadata: previousMetadata });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await recordBrowserSessionEvent({
      req: { headers: {} } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "heartbeat",
        sessionId: "current-session",
        occurredAt: "2026-07-05T12:02:00.000Z",
        metadata: {
          used_js_heap_size: 646 * 1024 * 1024,
          js_heap_size_limit: 4_395_630_592,
          visibility_state: "visible",
          document_hidden: false,
          stall_duration_ms: 2200,
          pressure_level: 2,
          pressure_reason: "heap_pressure",
        },
      },
    });

    expect(supabase.upsertPayloads[0]?.metadata).toMatchObject({
      used_js_heap_size: 646 * 1024 * 1024,
      js_heap_size_limit: 4_395_630_592,
      visibility_state: "visible",
      document_hidden: false,
      stall_duration_ms: 2200,
      pressure_level: 2,
      pressure_reason: "heap_pressure",
    });
    expect(Object.keys(supabase.upsertPayloads[0]?.metadata as object).length).toBeLessThanOrEqual(
      48
    );
  });

  it("keeps prior browser storage estimate metadata when later events send nulls", async () => {
    const supabase = createSupabaseMock({
      id: "current-row-id",
      metadata: {
        storage_estimate_usage_bytes: 250_000_000,
        storage_estimate_quota_bytes: 1_000_000_000,
        storage_estimate_available_bytes: 750_000_000,
        storage_estimate_usage_to_quota_ratio: 0.25,
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
        route: "/ai-studio",
        occurredAt: "2026-07-05T12:01:00.000Z",
        metadata: {
          storage_estimate_usage_bytes: null,
          storage_estimate_quota_bytes: null,
          storage_estimate_available_bytes: null,
          storage_estimate_usage_to_quota_ratio: null,
        },
      },
    });

    expect(supabase.upsertMock.mock.calls[0]?.[0]).toMatchObject({
      metadata: {
        storage_estimate_usage_bytes: 250_000_000,
        storage_estimate_quota_bytes: 1_000_000_000,
        storage_estimate_available_bytes: 750_000_000,
        storage_estimate_usage_to_quota_ratio: 0.25,
      },
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

    expect(supabase.rpcMock.mock.calls[0]?.[1]).not.toHaveProperty("p_review_status");
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
        last_pressure_snapshot_at: expect.any(String),
      },
    });
  });

  it("caps pressure event counts at the ingestion boundary", async () => {
    const supabase = createSupabaseMock({
      id: "current-row-id",
      metadata: { pressure_event_count: 1e100 },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await recordBrowserSessionEvent({
      req: { headers: { host: "www.shortpulse.ai" } } as never,
      user: { id: "user-1", email: "alpha@example.com" },
      payload: {
        eventType: "pressure_snapshot",
        sessionId: "current-session",
        route: "/ai-studio",
        occurredAt: "2026-07-05T12:02:00.000Z",
        metadata: { pressure_event_count: 1e100 },
      },
    });

    expect(supabase.rpcMock.mock.calls[0]?.[1]).toMatchObject({
      p_metadata: { pressure_event_count: 1 },
    });
    expect(supabase.upsertMock.mock.calls[0]?.[0]).toMatchObject({
      metadata: { pressure_event_count: 10_000 },
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
              shortpulse_media_grid_tracked_video_nodes: "23",
              shortpulse_media_grid_attached_video_sources: "3",
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
        media_grid_tracked_video_node_count: 23,
        media_grid_attached_video_source_count: 3,
        pressure_event_count: 2,
      },
    });
    expect(supabase.rpcMock).toHaveBeenCalledWith(
      "record_browser_crash_session_event_v1",
      expect.objectContaining({
        p_browser_session_id: "current-session",
        p_event_type: "crash_report",
        p_allow_insert: false,
      })
    );
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
    const supabase = createListRpcMock({
      sessions: [
        {
          id: "row-1",
          status: "probable_freeze_or_crash",
          effective_status: "probable_freeze_or_crash",
          last_seen_at: "2026-07-05T12:00:00.000Z",
        },
      ],
      pagination: { page: 1, perPage: 50, totalCount: 1, totalPages: 1 },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await fetchBrowserCrashSessions({
      page: 1,
      limit: 50,
      status: "needs_review",
      reviewStatus: "open",
      search: "",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("list_browser_crash_sessions_v2", {
      p_page: 1,
      p_limit: 50,
      p_status: "needs_review",
      p_review_status: "open",
      p_search: "",
    });
    expect(result.pagination.totalCount).toBe(1);
    expect(result.sessions[0]).toMatchObject({
      id: "row-1",
      effective_status: "probable_freeze_or_crash",
    });
  });

  it("maps possible ungraceful exit to stored and stale-active rows", async () => {
    const supabase = createListRpcMock({
      sessions: [
        {
          id: "row-1",
          status: "active",
          effective_status: "possible_ungraceful_exit",
          last_seen_at: "2026-07-05T12:00:00.000Z",
        },
      ],
      pagination: { page: 1, perPage: 50, totalCount: 1, totalPages: 1 },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await fetchBrowserCrashSessions({
      page: 1,
      limit: 50,
      status: "possible_ungraceful_exit",
      reviewStatus: "open",
      search: "",
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "list_browser_crash_sessions_v2",
      expect.objectContaining({ p_status: "possible_ungraceful_exit", p_review_status: "open" })
    );
  });

  it("maps the reviewed history filter to resolved and ignored review rows", async () => {
    const supabase = createListRpcMock({
      sessions: [
        {
          id: "row-1",
          status: "probable_freeze_or_crash",
          review_status: "resolved",
          last_seen_at: "2026-07-05T12:00:00.000Z",
        },
      ],
      pagination: { page: 1, perPage: 50, totalCount: 1, totalPages: 1 },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await fetchBrowserCrashSessions({
      page: 1,
      limit: 50,
      status: "needs_review",
      reviewStatus: "reviewed",
      search: "",
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "list_browser_crash_sessions_v2",
      expect.objectContaining({ p_status: "needs_review", p_review_status: "reviewed" })
    );
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
