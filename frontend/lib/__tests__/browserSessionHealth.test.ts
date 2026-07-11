import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installBrowserSessionHealthMonitor,
  reportBrowserSessionHealthEvent,
  resetBrowserSessionHealthMonitorForTests,
} from "../browserSessionHealth";
import { clearMediaPerfEvents, logMediaPerf } from "../mediaPerfTelemetry";

const readCachedSupabaseAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAccessTokenHints", () => ({
  readCachedSupabaseAccessToken: () => readCachedSupabaseAccessTokenMock(),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const setStorageEstimate = (estimate: StorageEstimate | Promise<StorageEstimate> | null) => {
  const estimateMock = vi.fn(() => Promise.resolve(estimate));
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: estimate
      ? {
          estimate: estimateMock,
        }
      : undefined,
  });
  return estimate ? estimateMock : null;
};

const dispatchPageHide = (persisted: boolean) => {
  const event = new Event("pagehide");
  Object.defineProperty(event, "persisted", {
    configurable: true,
    value: persisted,
  });
  window.dispatchEvent(event);
};

const setDocumentVisibility = (visibilityState: DocumentVisibilityState, hidden: boolean) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: visibilityState,
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
};

describe("browserSessionHealth", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetBrowserSessionHealthMonitorForTests();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/ai-studio?projectId=secret");
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never;
    (window as Partial<Window>).crashReport = undefined;
    setDocumentVisibility("visible", false);
    setStorageEstimate(null);
    clearMediaPerfEvents();
  });

  it("does not send session events without a cached access token", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue(null);

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
    cleanup();
  });

  it("sends authenticated session start events", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      "/api/log/browser-session",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        }),
        keepalive: true,
      })
    );
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toEqual(
      expect.objectContaining({
        eventType: "session_start",
        route: "/ai-studio?projectId",
      })
    );
    expect(body.metadata).toEqual(
      expect.objectContaining({
        visibility_state: "visible",
        client_environment: "test",
      })
    );
    cleanup();
  });

  it("adds cached browser storage estimate metadata after the background estimate resolves", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    setStorageEstimate({
      usage: 250_000_000,
      quota: 1_000_000_000,
    });

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    vi.mocked(fetch).mockClear();

    reportBrowserSessionHealthEvent("pressure_snapshot");
    await flushPromises();

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.metadata).toEqual(
      expect.objectContaining({
        storage_estimate_usage_bytes: 250_000_000,
        storage_estimate_quota_bytes: 1_000_000_000,
        storage_estimate_available_bytes: 750_000_000,
        storage_estimate_usage_to_quota_ratio: 0.25,
      })
    );
    cleanup();
  });

  it("does not wait for storage estimate before sending session or terminal pagehide evidence", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    let resolveEstimate: (estimate: StorageEstimate) => void = () => undefined;
    setStorageEstimate(
      new Promise<StorageEstimate>((resolve) => {
        resolveEstimate = resolve;
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    dispatchPageHide(false);
    await flushPromises();

    reportBrowserSessionHealthEvent("pressure_snapshot", { pressure_level: 1 });
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies).toContainEqual(expect.objectContaining({ eventType: "session_start" }));
    expect(bodies).toContainEqual(expect.objectContaining({ eventType: "clean_close" }));

    resolveEstimate({ usage: 1, quota: 2 });
    await flushPromises();
    cleanup();
  });

  it("keeps bfcache pagehide nonterminal and resumes the same session on pageshow", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    const sessionStart = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
      .find((body) => body.eventType === "session_start");
    const sessionId = String(sessionStart?.sessionId);
    vi.mocked(fetch).mockClear();

    dispatchPageHide(true);
    window.dispatchEvent(
      Object.assign(new Event("pageshow"), {
        persisted: true,
      })
    );
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies).toContainEqual(expect.objectContaining({ eventType: "pagehide", sessionId }));
    expect(bodies).toContainEqual(expect.objectContaining({ eventType: "pageshow", sessionId }));
    expect(bodies.some((body) => body.eventType === "clean_close")).toBe(false);
    expect(bodies.some((body) => body.eventType === "previous_session_abandoned")).toBe(false);
    const tabId = window.sessionStorage.getItem("shortpulse.browser_session.tab_id.v1");
    expect(
      JSON.parse(
        String(
          window.localStorage.getItem(`shortpulse.browser_session.peer.v2.${tabId}.${sessionId}`)
        )
      ).cleanClosedAt
    ).toBeNull();
    expect(
      JSON.parse(
        String(
          window.localStorage.getItem(`shortpulse.browser_session.peer.v2.${tabId}.${sessionId}`)
        )
      ).bfcacheSuspended
    ).toBe(false);
    cleanup();
  });

  it("does not abandon a BFCache-suspended predecessor when a successor document starts", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");

    const firstCleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    const firstSessionStart = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
      .find((body) => body.eventType === "session_start");
    const firstSessionId = String(firstSessionStart?.sessionId);

    dispatchPageHide(true);
    await flushPromises();
    firstCleanup();
    vi.mocked(fetch).mockClear();

    const secondCleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies).toContainEqual(expect.objectContaining({ eventType: "session_start" }));
    expect(
      bodies.some(
        (body) =>
          body.eventType === "previous_session_abandoned" &&
          body.previousSessionId === firstSessionId
      )
    ).toBe(false);
    secondCleanup();
  });

  it("does not report an old BFCache-suspended peer during stale scans", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.other-tab.bfcache-session",
      JSON.stringify({
        version: 2,
        tabId: "other-tab",
        sessionId: "bfcache-session",
        updatedAt: Date.now() - 20 * 60_000,
        cleanClosedAt: null,
        bfcacheSuspended: true,
        route: "/ai-studio",
        visibilityState: "hidden",
        abandonmentReportedAt: null,
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(
      bodies.some(
        (body) =>
          body.eventType === "previous_session_abandoned" &&
          body.previousSessionId === "bfcache-session"
      )
    ).toBe(false);
    cleanup();
  });

  it("keeps a failed clean close durable and retries it on the next same-tab document", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    let cleanCloseAttempts = 0;
    global.fetch = vi.fn((_url, init) => {
      const body = JSON.parse(String(init?.body)) as { eventType?: string };
      if (body.eventType === "clean_close") {
        cleanCloseAttempts += 1;
        return Promise.resolve({ ok: cleanCloseAttempts > 1 });
      }
      return Promise.resolve({ ok: true });
    }) as never;

    const firstCleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    const firstSessionStart = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
      .find((body) => body.eventType === "session_start");
    const firstSessionId = String(firstSessionStart?.sessionId);

    dispatchPageHide(false);
    await flushPromises();

    const cleanCloseKey = `shortpulse.browser_session.peer.v2.${window.sessionStorage.getItem("shortpulse.browser_session.tab_id.v1")}.${firstSessionId}`;
    expect(cleanCloseAttempts).toBe(1);
    expect(JSON.parse(String(window.localStorage.getItem(cleanCloseKey)))).toEqual(
      expect.objectContaining({
        sessionId: firstSessionId,
        cleanClosedAt: expect.any(Number),
      })
    );

    firstCleanup();
    const secondCleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    expect(cleanCloseAttempts).toBe(2);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
        .some((body) => body.eventType === "clean_close" && body.sessionId === firstSessionId)
    ).toBe(true);
    const retriedCleanClose = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
      .filter((body) => body.eventType === "clean_close" && body.sessionId === firstSessionId)
      .at(-1);
    expect(retriedCleanClose?.metadata).toEqual({});
    expect(
      vi
        .mocked(fetch)
        .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
        .some(
          (body) =>
            body.eventType === "previous_session_abandoned" &&
            body.previousSessionId === firstSessionId
        )
    ).toBe(false);
    expect(window.localStorage.getItem(cleanCloseKey)).toBeNull();
    secondCleanup();
  });

  it("does not start overlapping browser storage estimate refreshes", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    let resolveEstimate: (estimate: StorageEstimate) => void = () => undefined;
    const estimateMock = setStorageEstimate(
      new Promise<StorageEstimate>((resolve) => {
        resolveEstimate = resolve;
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    reportBrowserSessionHealthEvent("pressure_snapshot");
    reportBrowserSessionHealthEvent("main_thread_stall");
    await flushPromises();

    expect(estimateMock).toHaveBeenCalledTimes(1);

    resolveEstimate({ usage: 1, quota: 2 });
    await flushPromises();
    cleanup();
  });

  it("omits incomplete browser storage estimate metadata instead of emitting nulls", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    setStorageEstimate({
      quota: 1_000_000_000,
    });

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    vi.mocked(fetch).mockClear();

    reportBrowserSessionHealthEvent("pressure_snapshot");
    await flushPromises();

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.metadata).toEqual(
      expect.objectContaining({
        storage_estimate_quota_bytes: 1_000_000_000,
      })
    );
    expect(body.metadata).not.toHaveProperty("storage_estimate_usage_bytes");
    expect(body.metadata).not.toHaveProperty("storage_estimate_available_bytes");
    expect(body.metadata).not.toHaveProperty("storage_estimate_usage_to_quota_ratio");
    cleanup();
  });

  it("reports previous sessions that never recorded a clean close", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    window.localStorage.setItem(
      "shortpulse.browser_session.last.v1",
      JSON.stringify({
        sessionId: "previous-session",
        updatedAt: Date.now() - 120_000,
        cleanClosedAt: null,
        route: "/ai-studio",
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.some((body) => body.eventType === "session_start")).toBe(true);
    expect(bodies).toContainEqual(
      expect.objectContaining({
        eventType: "previous_session_abandoned",
        previousSessionId: "previous-session",
      })
    );
    cleanup();
  });

  it("does not promote a recently refreshed previous session as abandoned", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    window.localStorage.setItem(
      "shortpulse.browser_session.last.v1",
      JSON.stringify({
        sessionId: "previous-session",
        updatedAt: Date.now() - 30_000,
        cleanClosedAt: null,
        route: "/ai-studio",
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.some((body) => body.eventType === "session_start")).toBe(true);
    expect(bodies.some((body) => body.eventType === "previous_session_abandoned")).toBe(false);
    cleanup();
  });

  it("does not report fresh per-tab peer sessions", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    const now = Date.now();
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.other-tab.previous-session",
      JSON.stringify({
        version: 2,
        tabId: "other-tab",
        sessionId: "previous-session",
        updatedAt: now,
        cleanClosedAt: null,
        route: "/dashboard",
        visibilityState: "visible",
        abandonmentReportedAt: null,
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.some((body) => body.eventType === "session_start")).toBe(true);
    expect(bodies.some((body) => body.eventType === "previous_session_abandoned")).toBe(false);
    cleanup();
  });

  it("reports a stale visible peer once and marks the per-tab record", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    const now = Date.now();
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.other-tab.stale-visible-session",
      JSON.stringify({
        version: 2,
        tabId: "other-tab",
        sessionId: "stale-visible-session",
        updatedAt: now - 70_000,
        cleanClosedAt: null,
        route: "/ai-studio",
        visibilityState: "visible",
        abandonmentReportedAt: null,
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.filter((body) => body.eventType === "previous_session_abandoned")).toHaveLength(
      1
    );
    expect(
      JSON.parse(
        String(
          window.localStorage.getItem(
            "shortpulse.browser_session.peer.v2.other-tab.stale-visible-session"
          )
        )
      ).abandonmentReportedAt
    ).toEqual(expect.any(Number));
    cleanup();
  });

  it("does not report a hidden peer before the conservative cutoff", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.other-tab.hidden-session",
      JSON.stringify({
        version: 2,
        tabId: "other-tab",
        sessionId: "hidden-session",
        updatedAt: Date.now() - 120_000,
        cleanClosedAt: null,
        route: "/ai-studio",
        visibilityState: "hidden",
        abandonmentReportedAt: null,
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.some((body) => body.eventType === "previous_session_abandoned")).toBe(false);
    cleanup();
  });

  it("detects a newly stale visible peer on the 15-second scan cadence", async () => {
    vi.useFakeTimers();
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.other-tab.deadline-session",
      JSON.stringify({
        version: 2,
        tabId: "other-tab",
        sessionId: "deadline-session",
        updatedAt: Date.now(),
        cleanClosedAt: null,
        route: "/ai-studio",
        visibilityState: "visible",
        abandonmentReportedAt: null,
      })
    );

    const cleanup = installBrowserSessionHealthMonitor();
    await vi.advanceTimersByTimeAsync(60_000);
    let bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.some((body) => body.eventType === "previous_session_abandoned")).toBe(false);

    await vi.advanceTimersByTimeAsync(15_000);
    bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.filter((body) => body.eventType === "previous_session_abandoned")).toHaveLength(
      1
    );
    cleanup();
  });

  it("retries peer abandonment after a failed ingest and acknowledges only success", async () => {
    vi.useFakeTimers();
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    const now = Date.now();
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.other-tab.retry-session",
      JSON.stringify({
        version: 2,
        tabId: "other-tab",
        sessionId: "retry-session",
        updatedAt: now - 70_000,
        cleanClosedAt: null,
        route: "/ai-studio",
        visibilityState: "visible",
        abandonmentReportedAt: null,
      })
    );
    let abandonmentAttempts = 0;
    global.fetch = vi.fn((_url, init) => {
      const body = JSON.parse(String(init?.body)) as { eventType?: string };
      if (body.eventType === "previous_session_abandoned") {
        abandonmentAttempts += 1;
        return Promise.resolve({ ok: abandonmentAttempts > 1 });
      }
      return Promise.resolve({ ok: true });
    }) as never;

    const cleanup = installBrowserSessionHealthMonitor();
    await vi.runAllTicks();
    await Promise.resolve();
    expect(abandonmentAttempts).toBe(1);
    expect(
      JSON.parse(
        String(
          window.localStorage.getItem("shortpulse.browser_session.peer.v2.other-tab.retry-session")
        )
      ).abandonmentReportedAt
    ).toBeNull();

    await vi.advanceTimersByTimeAsync(15_000);
    expect(abandonmentAttempts).toBe(2);
    expect(
      JSON.parse(
        String(
          window.localStorage.getItem("shortpulse.browser_session.peer.v2.other-tab.retry-session")
        )
      ).abandonmentReportedAt
    ).toEqual(expect.any(Number));
    cleanup();
  });

  it("keeps a failed same-tab predecessor durable until a later retry succeeds", async () => {
    vi.useFakeTimers();
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    window.sessionStorage.setItem("shortpulse.browser_session.tab_id.v1", "same-tab");
    window.sessionStorage.setItem("shortpulse.browser_session.current.v1", "old-session");
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.same-tab.old-session",
      JSON.stringify({
        version: 2,
        tabId: "same-tab",
        sessionId: "old-session",
        updatedAt: Date.now(),
        cleanClosedAt: null,
        route: "/ai-studio",
        visibilityState: "visible",
        abandonmentReportedAt: null,
      })
    );
    let abandonmentAttempts = 0;
    global.fetch = vi.fn((_url, init) => {
      const body = JSON.parse(String(init?.body)) as { eventType?: string };
      if (body.eventType === "previous_session_abandoned") {
        abandonmentAttempts += 1;
        return Promise.resolve({ ok: abandonmentAttempts > 1 });
      }
      return Promise.resolve({ ok: true });
    }) as never;

    const cleanup = installBrowserSessionHealthMonitor();
    await vi.runAllTicks();
    await Promise.resolve();
    expect(abandonmentAttempts).toBe(1);
    expect(
      window.localStorage.getItem("shortpulse.browser_session.peer.v2.same-tab.old-session")
    ).not.toBeNull();
    expect(
      Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index)
      ).some(
        (key) =>
          key?.startsWith("shortpulse.browser_session.peer.v2.same-tab.") &&
          key !== "shortpulse.browser_session.peer.v2.same-tab.old-session"
      )
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(abandonmentAttempts).toBe(2);
    expect(
      JSON.parse(
        String(
          window.localStorage.getItem("shortpulse.browser_session.peer.v2.same-tab.old-session")
        )
      ).abandonmentReportedAt
    ).toEqual(expect.any(Number));
    cleanup();
  });

  it("prunes malformed, expired, and excess peer registry records", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    window.localStorage.setItem("shortpulse.browser_session.peer.v2.malformed", "{");
    window.localStorage.setItem(
      "shortpulse.browser_session.peer.v2.expired.expired-session",
      JSON.stringify({
        version: 2,
        tabId: "expired",
        sessionId: "expired-session",
        updatedAt: Date.now() - 25 * 60 * 60 * 1000,
        cleanClosedAt: null,
        route: "/ai-studio",
        visibilityState: "hidden",
        abandonmentReportedAt: null,
      })
    );
    for (let index = 0; index < 70; index += 1) {
      window.localStorage.setItem(
        `shortpulse.browser_session.peer.v2.peer-${index}.peer-session-${index}`,
        JSON.stringify({
          version: 2,
          tabId: `peer-${index}`,
          sessionId: `peer-session-${index}`,
          updatedAt: Date.now() - index,
          cleanClosedAt: null,
          route: "/dashboard",
          visibilityState: "visible",
          abandonmentReportedAt: null,
        })
      );
    }

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    const peerKeys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index)
    ).filter((key) => key?.startsWith("shortpulse.browser_session.peer.v2."));
    expect(peerKeys.length).toBeLessThanOrEqual(64);
    expect(window.localStorage.getItem("shortpulse.browser_session.peer.v2.malformed")).toBeNull();
    expect(
      window.localStorage.getItem("shortpulse.browser_session.peer.v2.expired.expired-session")
    ).toBeNull();
    cleanup();
  });

  it("lets AI Studio pressure telemetry update the active session row", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    vi.mocked(fetch).mockClear();

    reportBrowserSessionHealthEvent("pressure_snapshot", {
      pressure_level: 2,
      max_input_stall_ms: 1400,
    });
    await flushPromises();

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toEqual(
      expect.objectContaining({
        eventType: "pressure_snapshot",
        metadata: expect.objectContaining({
          pressure_level: 2,
          max_input_stall_ms: 1400,
        }),
      })
    );
    cleanup();
  });

  it("persists the latest causal media counters with the next session event", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    logMediaPerf("media.grid.memory.sample", {
      surface: "reference-grid",
      tracked_video_node_count: 23,
      attached_video_source_count: 3,
    });

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    const sessionStart = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
      .find((body) => body.eventType === "session_start");
    expect(sessionStart?.metadata).toEqual(
      expect.objectContaining({
        media_grid_tracked_video_node_count: 23,
        media_grid_attached_video_source_count: 3,
      })
    );
    cleanup();
  });

  it("does not report hidden-tab timer throttling as a main-thread stall", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T21:39:00.000Z"));
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    vi.mocked(fetch).mockClear();

    setDocumentVisibility("hidden", true);
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    vi.mocked(fetch).mockClear();

    vi.setSystemTime(new Date("2026-07-07T21:40:01.000Z"));
    vi.advanceTimersByTime(1000);
    await flushPromises();

    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
    expect(bodies.some((body) => body.eventType === "main_thread_stall")).toBe(false);
    cleanup();
  });

  it("writes redacted CrashReportContext values for browser-delivered crash reports", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    logMediaPerf("media.grid.memory.sample", {
      surface: "reference-grid",
      tracked_video_node_count: 23,
    });
    const initializeMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn();
    const deleteMock = vi.fn();
    window.crashReport = {
      initialize: initializeMock,
      set: setMock,
      delete: deleteMock,
    };

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();

    expect(initializeMock).toHaveBeenCalledWith(1024);
    expect(setMock).toHaveBeenCalledWith("shortpulse_browser_session_id", expect.any(String));
    expect(setMock).toHaveBeenCalledWith("shortpulse_route", "/ai-studio?projectId");
    expect(setMock).toHaveBeenCalledWith("shortpulse_media_grid_tracked_video_nodes", "23");

    setMock.mockClear();
    reportBrowserSessionHealthEvent("pressure_snapshot", {
      pressure_level: 2,
      max_input_stall_ms: 1400,
    });
    await flushPromises();

    expect(setMock).toHaveBeenCalledWith("shortpulse_pressure_level", "2");
    expect(setMock).toHaveBeenCalledWith("shortpulse_max_input_stall_ms", "1400");

    cleanup();
    expect(deleteMock).toHaveBeenCalledWith("shortpulse_browser_session_id");
  });
});
