/**
 * Browser session-health monitor.
 * Sends authenticated heartbeat/lifecycle/freeze evidence to the server-owned
 * crash-session table without changing visible app behavior.
 */
import { readCachedSupabaseAccessToken } from "./supabaseAccessTokenHints";

type BrowserSessionEventType =
  | "session_start"
  | "heartbeat"
  | "visibility_hidden"
  | "visibility_visible"
  | "pagehide"
  | "pageshow"
  | "freeze"
  | "resume"
  | "clean_close"
  | "main_thread_stall"
  | "pressure_snapshot"
  | "previous_session_abandoned"
  | "crash_report";

type BrowserSessionRecord = {
  sessionId: string;
  updatedAt: number;
  cleanClosedAt: number | null;
  route: string | null;
};

type BrowserSessionMonitorState = {
  sessionId: string;
  heartbeatId: number | null;
  stallProbeId: number | null;
  lastStallTickMs: number;
  lastStallReportMs: number;
  cleanup: () => void;
};

type JsonObject = Record<string, unknown>;

declare global {
  interface Document {
    wasDiscarded?: boolean;
  }

  interface Window {
    ReportingObserver?: new (
      callback: (
        reports: Array<{
          type?: string;
          url?: string;
        }>
      ) => void,
      options?: { types?: string[]; buffered?: boolean }
    ) => {
      observe: () => void;
      disconnect: () => void;
    };
  }
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const STALL_PROBE_INTERVAL_MS = 1000;
const MAIN_THREAD_STALL_THRESHOLD_MS = 2000;
const STALL_REPORT_COOLDOWN_MS = 60_000;
const ABANDONED_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CURRENT_SESSION_STORAGE_KEY = "shortpulse.browser_session.current.v1";
const LAST_SESSION_STORAGE_KEY = "shortpulse.browser_session.last.v1";

let activeMonitor: BrowserSessionMonitorState | null = null;

const nowMs = (): number => Date.now();

const createSessionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sp_browser_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const currentRoute = (): string | null => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 320);
};

const redactedPathFromUrl = (value: string | undefined): string | null => {
  if (typeof window === "undefined" || !value) return null;
  try {
    const url = new URL(value, window.location.origin);
    const keys = Array.from(url.searchParams.keys()).slice(0, 12);
    return keys.length ? `${url.pathname}?${keys.join("&")}` : url.pathname;
  } catch {
    return null;
  }
};

const readStoredSessionRecord = (): BrowserSessionRecord | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrowserSessionRecord>;
    if (typeof parsed.sessionId !== "string" || typeof parsed.updatedAt !== "number") return null;
    return {
      sessionId: parsed.sessionId,
      updatedAt: parsed.updatedAt,
      cleanClosedAt: typeof parsed.cleanClosedAt === "number" ? parsed.cleanClosedAt : null,
      route: typeof parsed.route === "string" ? parsed.route : null,
    };
  } catch {
    return null;
  }
};

const writeStoredSessionRecord = (record: BrowserSessionRecord): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Best-effort local recovery marker only.
  }
};

const writeCurrentSessionId = (sessionId: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CURRENT_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Diagnostic correlation only.
  }
};

const readBrowserMemoryMetadata = (): JsonObject => {
  if (typeof performance === "undefined") return {};
  const memory = (
    performance as Performance & {
      memory?: {
        usedJSHeapSize?: number;
        totalJSHeapSize?: number;
        jsHeapSizeLimit?: number;
      };
    }
  ).memory;
  const used = memory?.usedJSHeapSize;
  const total = memory?.totalJSHeapSize;
  const limit = memory?.jsHeapSizeLimit;
  if (typeof used !== "number" || typeof total !== "number" || total <= 0) return {};
  return {
    used_js_heap_size: Math.round(used),
    total_js_heap_size: Math.round(total),
    js_heap_size_limit: typeof limit === "number" ? Math.round(limit) : null,
    heap_usage_ratio: Math.round((used / total) * 1000) / 1000,
  };
};

const readDeviceMetadata = (): JsonObject => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  };
  return {
    screen_width: window.screen?.width ?? null,
    screen_height: window.screen?.height ?? null,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio,
    hardware_concurrency: navigator.hardwareConcurrency ?? null,
    device_memory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    connection_effective_type: nav.connection?.effectiveType ?? null,
    connection_downlink: nav.connection?.downlink ?? null,
    connection_rtt: nav.connection?.rtt ?? null,
    connection_save_data: nav.connection?.saveData ?? null,
  };
};

const readRuntimeMetadata = (): JsonObject => {
  const nextData =
    typeof window === "undefined"
      ? null
      : (window as unknown as { __NEXT_DATA__?: { buildId?: unknown } }).__NEXT_DATA__;
  return {
    build_id: typeof nextData?.buildId === "string" ? nextData.buildId : null,
    client_release:
      process.env.NEXT_PUBLIC_SHORTPULSE_RELEASE ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
      null,
    client_environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    visibility_state: typeof document !== "undefined" ? document.visibilityState : null,
    document_hidden: typeof document !== "undefined" ? document.hidden : null,
    document_was_discarded: typeof document !== "undefined" ? Boolean(document.wasDiscarded) : null,
    is_secure_context:
      typeof window !== "undefined" && typeof window.isSecureContext === "boolean"
        ? window.isSecureContext
        : null,
    ...readBrowserMemoryMetadata(),
    ...readDeviceMetadata(),
  };
};

const sendBrowserSessionEvent = async (params: {
  eventType: BrowserSessionEventType;
  sessionId: string;
  previousSessionId?: string | null;
  metadata?: JsonObject;
}): Promise<void> => {
  const token = readCachedSupabaseAccessToken();
  if (!token) return;

  await fetch("/api/log/browser-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      eventType: params.eventType,
      sessionId: params.sessionId,
      previousSessionId: params.previousSessionId ?? null,
      route: currentRoute(),
      occurredAt: new Date().toISOString(),
      metadata: {
        ...readRuntimeMetadata(),
        ...(params.metadata ?? {}),
      },
    }),
    keepalive: true,
  });
};

const reportEvent = (
  eventType: BrowserSessionEventType,
  metadata: JsonObject = {},
  previousSessionId: string | null = null
): void => {
  if (!activeMonitor) return;
  const updatedAt = nowMs();
  const cleanClosedAt = eventType === "clean_close" ? updatedAt : null;
  writeStoredSessionRecord({
    sessionId: activeMonitor.sessionId,
    updatedAt,
    cleanClosedAt,
    route: currentRoute(),
  });
  void sendBrowserSessionEvent({
    eventType,
    sessionId: activeMonitor.sessionId,
    previousSessionId,
    metadata,
  }).catch(() => undefined);
};

const maybeReportPreviousAbandonedSession = (
  currentSessionId: string,
  previous: BrowserSessionRecord | null
): void => {
  if (!previous || previous.cleanClosedAt !== null) return;
  if (previous.sessionId === currentSessionId) return;
  const ageMs = nowMs() - previous.updatedAt;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > ABANDONED_SESSION_MAX_AGE_MS) return;
  reportEvent(
    "previous_session_abandoned",
    {
      last_heartbeat_age_ms: ageMs,
      previous_last_seen_at: new Date(previous.updatedAt).toISOString(),
      status_reason: "previous_session_missing_clean_close",
    },
    previous.sessionId
  );
};

const installLifecycleListeners = (): (() => void) => {
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      reportEvent("visibility_hidden");
      return;
    }
    reportEvent("visibility_visible");
  };
  const onPageHide = (event: PageTransitionEvent) => {
    reportEvent(event.persisted ? "pagehide" : "clean_close", {
      pagehide_persisted: event.persisted,
    });
  };
  const onPageShow = (event: PageTransitionEvent) => {
    reportEvent("pageshow", { pageshow_persisted: event.persisted });
  };
  const onFreeze = () => reportEvent("freeze");
  const onResume = () => reportEvent("resume");

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("freeze", onFreeze);
  document.addEventListener("resume", onResume);
  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("freeze", onFreeze);
    document.removeEventListener("resume", onResume);
  };
};

const installHeartbeat = (): number | null => {
  if (typeof window === "undefined") return null;
  return window.setInterval(() => {
    reportEvent("heartbeat", { heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS });
  }, HEARTBEAT_INTERVAL_MS);
};

const installStallProbe = (state: BrowserSessionMonitorState): number | null => {
  if (typeof window === "undefined") return null;
  state.lastStallTickMs = nowMs();
  return window.setInterval(() => {
    const current = nowMs();
    const stallDurationMs = current - state.lastStallTickMs - STALL_PROBE_INTERVAL_MS;
    state.lastStallTickMs = current;
    if (stallDurationMs < MAIN_THREAD_STALL_THRESHOLD_MS) return;
    if (current - state.lastStallReportMs < STALL_REPORT_COOLDOWN_MS) return;
    state.lastStallReportMs = current;
    reportEvent("main_thread_stall", {
      stall_duration_ms: Math.round(stallDurationMs),
    });
  }, STALL_PROBE_INTERVAL_MS);
};

const installCrashReportObserver = (): (() => void) => {
  if (typeof window === "undefined" || typeof window.ReportingObserver !== "function") {
    return () => undefined;
  }
  try {
    const observer = new window.ReportingObserver(
      (reports) => {
        reports.forEach((report) => {
          if (report.type !== "crash") return;
          reportEvent("crash_report", {
            crash_report_type: report.type,
            crash_report_url_path: redactedPathFromUrl(report.url),
          });
        });
      },
      { types: ["crash"], buffered: true }
    );
    observer.observe();
    return () => observer.disconnect();
  } catch {
    return () => undefined;
  }
};

/**
 * Reports extra low-cardinality pressure evidence for the active browser session.
 */
export const reportBrowserSessionHealthEvent = (
  eventType: "pressure_snapshot" | "main_thread_stall",
  metadata: JsonObject = {}
): void => {
  reportEvent(eventType, metadata);
};

/**
 * Installs the browser session-health monitor for the current page document.
 */
export const installBrowserSessionHealthMonitor = (): (() => void) => {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;
  if (activeMonitor) return activeMonitor.cleanup;

  const sessionId = createSessionId();
  const previousSession = readStoredSessionRecord();
  writeCurrentSessionId(sessionId);

  const state: BrowserSessionMonitorState = {
    sessionId,
    heartbeatId: null,
    stallProbeId: null,
    lastStallTickMs: nowMs(),
    lastStallReportMs: 0,
    cleanup: () => undefined,
  };
  activeMonitor = state;

  reportEvent("session_start");
  maybeReportPreviousAbandonedSession(sessionId, previousSession);

  const cleanupLifecycle = installLifecycleListeners();
  const cleanupCrashReportObserver = installCrashReportObserver();
  state.heartbeatId = installHeartbeat();
  state.stallProbeId = installStallProbe(state);
  state.cleanup = () => {
    cleanupLifecycle();
    cleanupCrashReportObserver();
    if (state.heartbeatId !== null) window.clearInterval(state.heartbeatId);
    if (state.stallProbeId !== null) window.clearInterval(state.stallProbeId);
    if (activeMonitor === state) activeMonitor = null;
  };
  return state.cleanup;
};

export const resetBrowserSessionHealthMonitorForTests = (): void => {
  if (activeMonitor) activeMonitor.cleanup();
  activeMonitor = null;
};
