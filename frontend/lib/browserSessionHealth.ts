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
  tabId: string | null;
};

type ActiveTabSessionRecord = {
  sessionId: string;
  updatedAt: number;
};

type BrowserSessionMonitorState = {
  sessionId: string;
  tabId: string;
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
    crashReport?: {
      initialize?: (maxIndividualValueSizeBytes: number) => Promise<void>;
      set?: (key: string, value: string) => void;
      delete?: (key: string) => void;
    };
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
const ABANDONED_SESSION_MIN_AGE_MS = HEARTBEAT_INTERVAL_MS * 3;
const ABANDONED_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_TAB_STALE_AFTER_MS = HEARTBEAT_INTERVAL_MS * 2 + 5000;
const CURRENT_SESSION_STORAGE_KEY = "shortpulse.browser_session.current.v1";
const LAST_SESSION_STORAGE_KEY = "shortpulse.browser_session.last.v1";
const TAB_ID_STORAGE_KEY = "shortpulse.browser_session.tab_id.v1";
const ACTIVE_TABS_STORAGE_KEY = "shortpulse.browser_session.active_tabs.v1";
const TERMINAL_SESSION_EVENTS = new Set<BrowserSessionEventType>([
  "visibility_hidden",
  "pagehide",
  "clean_close",
]);

let activeMonitor: BrowserSessionMonitorState | null = null;
let crashReportContextInitialized = false;
let crashReportContextInitialization: Promise<void> | null = null;
let pendingCrashReportContext: { sessionId: string; metadata: JsonObject } | null = null;
let latestBrowserStorageEstimateMetadata: JsonObject = {};
let browserStorageEstimateRefreshInFlight: Promise<void> | null = null;

const nowMs = (): number => Date.now();

const createSessionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sp_browser_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const readOrCreateTabId = (): string => {
  if (typeof window === "undefined") return createSessionId();
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (existing?.trim()) return existing;
    const next = createSessionId();
    window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
};

const currentRoute = (): string | null => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 320);
};

const redactedCurrentRoute = (): string | null => {
  const route = currentRoute();
  return route ? redactedPathFromUrl(route) : null;
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

const writeCrashReportContextValue = (key: string, value: unknown): void => {
  if (typeof window === "undefined" || typeof window.crashReport?.set !== "function") return;
  const normalized =
    typeof value === "number" || typeof value === "boolean" ? String(value) : value;
  if (typeof normalized !== "string" || !normalized.trim()) {
    try {
      window.crashReport.delete?.(key);
    } catch {
      // CrashReportContext is diagnostic-only.
    }
    return;
  }
  try {
    window.crashReport.set(key, normalized.trim().slice(0, 240));
  } catch {
    // CrashReportContext is diagnostic-only.
  }
};

const canWriteCrashReportContext = (): boolean => {
  if (typeof window === "undefined" || typeof window.crashReport?.set !== "function") return false;
  const crashReport = window.crashReport;
  if (crashReportContextInitialized) return true;
  if (typeof crashReport.initialize !== "function") return true;
  if (!crashReportContextInitialization) {
    crashReportContextInitialization = crashReport
      .initialize(1024)
      .then(() => {
        crashReportContextInitialized = true;
        if (pendingCrashReportContext) {
          syncCrashReportContext(
            pendingCrashReportContext.sessionId,
            pendingCrashReportContext.metadata
          );
        }
      })
      .catch(() => undefined);
  }
  return false;
};

const clearCrashReportContext = (): void => {
  pendingCrashReportContext = null;
  if (!canWriteCrashReportContext()) return;
  if (typeof window === "undefined" || typeof window.crashReport?.delete !== "function") return;
  for (const key of [
    "shortpulse_browser_session_id",
    "shortpulse_route",
    "shortpulse_build_id",
    "shortpulse_client_release",
    "shortpulse_client_environment",
    "shortpulse_pressure_level",
    "shortpulse_max_input_stall_ms",
    "shortpulse_long_task_p95_ms",
    "shortpulse_heap_used_to_total_ratio",
    "shortpulse_heap_used_to_limit_ratio",
  ]) {
    try {
      window.crashReport.delete(key);
    } catch {
      // CrashReportContext is diagnostic-only.
    }
  }
};

const syncCrashReportContext = (sessionId: string, metadata: JsonObject): void => {
  if (typeof window === "undefined") return;
  pendingCrashReportContext = { sessionId, metadata };
  if (!canWriteCrashReportContext()) return;
  writeCrashReportContextValue("shortpulse_browser_session_id", sessionId);
  writeCrashReportContextValue("shortpulse_route", redactedCurrentRoute());
  writeCrashReportContextValue("shortpulse_build_id", metadata.build_id);
  writeCrashReportContextValue("shortpulse_client_release", metadata.client_release);
  writeCrashReportContextValue("shortpulse_client_environment", metadata.client_environment);
  writeCrashReportContextValue("shortpulse_pressure_level", metadata.pressure_level);
  writeCrashReportContextValue("shortpulse_max_input_stall_ms", metadata.max_input_stall_ms);
  writeCrashReportContextValue("shortpulse_long_task_p95_ms", metadata.long_task_p95_ms);
  writeCrashReportContextValue(
    "shortpulse_heap_used_to_total_ratio",
    metadata.heap_used_to_total_ratio
  );
  writeCrashReportContextValue(
    "shortpulse_heap_used_to_limit_ratio",
    metadata.heap_used_to_limit_ratio
  );
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
      tabId: typeof parsed.tabId === "string" ? parsed.tabId : null,
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

const readActiveTabRecords = (): Record<string, ActiveTabSessionRecord> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACTIVE_TABS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<ActiveTabSessionRecord>>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const output: Record<string, ActiveTabSessionRecord> = {};
    for (const [tabId, record] of Object.entries(parsed)) {
      if (
        typeof tabId === "string" &&
        typeof record?.sessionId === "string" &&
        typeof record.updatedAt === "number"
      ) {
        output[tabId] = {
          sessionId: record.sessionId,
          updatedAt: record.updatedAt,
        };
      }
    }
    return output;
  } catch {
    return {};
  }
};

const writeActiveTabRecords = (records: Record<string, ActiveTabSessionRecord>): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_TABS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Best-effort cross-tab coordination only.
  }
};

const pruneActiveTabRecords = (
  records: Record<string, ActiveTabSessionRecord>,
  updatedAt: number
): Record<string, ActiveTabSessionRecord> => {
  const output: Record<string, ActiveTabSessionRecord> = {};
  for (const [tabId, record] of Object.entries(records)) {
    const ageMs = updatedAt - record.updatedAt;
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= ACTIVE_TAB_STALE_AFTER_MS) {
      output[tabId] = record;
    }
  }
  return output;
};

const touchActiveTabRecord = (tabId: string, sessionId: string, updatedAt: number): void => {
  writeActiveTabRecords({
    ...pruneActiveTabRecords(readActiveTabRecords(), updatedAt),
    [tabId]: { sessionId, updatedAt },
  });
};

const clearActiveTabRecord = (tabId: string, updatedAt: number): void => {
  const records = pruneActiveTabRecords(readActiveTabRecords(), updatedAt);
  delete records[tabId];
  writeActiveTabRecords(records);
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
    heap_used_to_limit_ratio:
      typeof limit === "number" && limit > 0 ? Math.round((used / limit) * 1000) / 1000 : null,
    heap_usage_ratio:
      typeof limit === "number" && limit > 0 ? Math.round((used / limit) * 1000) / 1000 : null,
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

const roundMetadataRatio = (value: number): number => Math.round(value * 1000) / 1000;

const buildBrowserStorageEstimateMetadata = (estimate: StorageEstimate): JsonObject => {
  const output: JsonObject = {};
  const usage =
    typeof estimate.usage === "number" && Number.isFinite(estimate.usage)
      ? Math.max(0, Math.round(estimate.usage))
      : null;
  const quota =
    typeof estimate.quota === "number" && Number.isFinite(estimate.quota)
      ? Math.max(0, Math.round(estimate.quota))
      : null;

  if (usage !== null) output.storage_estimate_usage_bytes = usage;
  if (quota !== null) output.storage_estimate_quota_bytes = quota;
  if (usage !== null && quota !== null) {
    output.storage_estimate_available_bytes = Math.max(0, Math.round(quota - usage));
    if (quota > 0) output.storage_estimate_usage_to_quota_ratio = roundMetadataRatio(usage / quota);
  }
  return output;
};

const refreshBrowserStorageEstimateMetadata = async (): Promise<void> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return;
  }
  if (browserStorageEstimateRefreshInFlight) return browserStorageEstimateRefreshInFlight;

  browserStorageEstimateRefreshInFlight = navigator.storage
    .estimate()
    .then((estimate) => {
      latestBrowserStorageEstimateMetadata = buildBrowserStorageEstimateMetadata(estimate);
    })
    .catch(() => undefined)
    .finally(() => {
      browserStorageEstimateRefreshInFlight = null;
    });
  return browserStorageEstimateRefreshInFlight;
};

const maybeRefreshBrowserStorageEstimateMetadata = (eventType: BrowserSessionEventType): void => {
  if (!TERMINAL_SESSION_EVENTS.has(eventType)) {
    void refreshBrowserStorageEstimateMetadata();
  }
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
  maybeRefreshBrowserStorageEstimateMetadata(params.eventType);

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
        ...latestBrowserStorageEstimateMetadata,
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
    tabId: activeMonitor.tabId,
  });
  if (eventType === "clean_close") {
    clearActiveTabRecord(activeMonitor.tabId, updatedAt);
  } else {
    touchActiveTabRecord(activeMonitor.tabId, activeMonitor.sessionId, updatedAt);
  }
  syncCrashReportContext(activeMonitor.sessionId, {
    ...readRuntimeMetadata(),
    ...metadata,
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
  currentTabId: string,
  previous: BrowserSessionRecord | null
): void => {
  if (!previous || previous.cleanClosedAt !== null) return;
  if (previous.sessionId === currentSessionId) return;
  if (previous.tabId && previous.tabId !== currentTabId) {
    const previousTab = readActiveTabRecords()[previous.tabId];
    if (previousTab?.sessionId === previous.sessionId) return;
  }
  const ageMs = nowMs() - previous.updatedAt;
  if (
    !Number.isFinite(ageMs) ||
    ageMs < ABANDONED_SESSION_MIN_AGE_MS ||
    ageMs > ABANDONED_SESSION_MAX_AGE_MS
  ) {
    return;
  }
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
  const tabId = readOrCreateTabId();
  const previousSession = readStoredSessionRecord();
  writeCurrentSessionId(sessionId);

  const state: BrowserSessionMonitorState = {
    sessionId,
    tabId,
    heartbeatId: null,
    stallProbeId: null,
    lastStallTickMs: nowMs(),
    lastStallReportMs: 0,
    cleanup: () => undefined,
  };
  activeMonitor = state;

  reportEvent("session_start");
  maybeReportPreviousAbandonedSession(sessionId, tabId, previousSession);

  const cleanupLifecycle = installLifecycleListeners();
  const cleanupCrashReportObserver = installCrashReportObserver();
  state.heartbeatId = installHeartbeat();
  state.stallProbeId = installStallProbe(state);
  state.cleanup = () => {
    cleanupLifecycle();
    cleanupCrashReportObserver();
    if (state.heartbeatId !== null) window.clearInterval(state.heartbeatId);
    if (state.stallProbeId !== null) window.clearInterval(state.stallProbeId);
    clearCrashReportContext();
    if (activeMonitor === state) activeMonitor = null;
  };
  return state.cleanup;
};

export const resetBrowserSessionHealthMonitorForTests = (): void => {
  if (activeMonitor) activeMonitor.cleanup();
  activeMonitor = null;
  crashReportContextInitialized = false;
  crashReportContextInitialization = null;
  pendingCrashReportContext = null;
  latestBrowserStorageEstimateMetadata = {};
  browserStorageEstimateRefreshInFlight = null;
};
