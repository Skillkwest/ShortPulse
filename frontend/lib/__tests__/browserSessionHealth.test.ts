import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installBrowserSessionHealthMonitor,
  reportBrowserSessionHealthEvent,
  resetBrowserSessionHealthMonitorForTests,
} from "../browserSessionHealth";

const readCachedSupabaseAccessTokenMock = vi.hoisted(() => vi.fn());

type ReportingObserverCallback = (reports: Array<{ type?: string; url?: string }>) => void;

vi.mock("../supabaseAccessTokenHints", () => ({
  readCachedSupabaseAccessToken: () => readCachedSupabaseAccessTokenMock(),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
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
    (window as Partial<Window>).ReportingObserver = undefined;
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
        route: "/ai-studio?projectId=secret",
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

  it("does not report previous sessions still active in another tab", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    const now = Date.now();
    window.localStorage.setItem(
      "shortpulse.browser_session.last.v1",
      JSON.stringify({
        sessionId: "previous-session",
        updatedAt: now - 120_000,
        cleanClosedAt: null,
        route: "/dashboard",
        tabId: "other-tab",
      })
    );
    window.localStorage.setItem(
      "shortpulse.browser_session.active_tabs.v1",
      JSON.stringify({
        "other-tab": {
          sessionId: "previous-session",
          updatedAt: now,
        },
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

  it("reports supplemental browser crash reports when ReportingObserver supports them", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue("token-1");
    let reportingCallback: ReportingObserverCallback | null = null;
    const disconnectMock = vi.fn();
    window.ReportingObserver = function MockReportingObserver(callback: ReportingObserverCallback) {
      reportingCallback = callback;
      return {
        observe: vi.fn(),
        disconnect: disconnectMock,
      };
    } as never;

    const cleanup = installBrowserSessionHealthMonitor();
    await flushPromises();
    vi.mocked(fetch).mockClear();

    const callback = reportingCallback as unknown as ReportingObserverCallback | null;
    expect(callback).not.toBeNull();
    if (!callback) throw new Error("ReportingObserver callback was not installed.");
    callback([
      {
        type: "crash",
        url: "https://www.shortpulse.ai/ai-studio?projectId=secret&mode=standard",
      },
    ]);
    await flushPromises();

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toEqual(
      expect.objectContaining({
        eventType: "crash_report",
        metadata: expect.objectContaining({
          crash_report_type: "crash",
          crash_report_url_path: "/ai-studio?projectId&mode",
        }),
      })
    );

    cleanup();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
