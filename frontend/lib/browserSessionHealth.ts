/**
 * Browser session-health monitor.
 * Sends authenticated heartbeat/lifecycle/freeze evidence to the server-owned
 * crash-session table without changing visible app behavior.
 */
import { readCachedSupabaseAccessToken } from "./supabaseAccessTokenHints";
import { readMediaPerfCrashEvidence } from "./mediaPerfTelemetry";

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
  | "previous_session_abandoned";

type BrowserSessionRecord = {
  sessionId: string;
  updatedAt: number;
  cleanClosedAt: number | null;
  route: string | null;
  tabId: string | null;
};

type PeerBrowserSessionRecord = {
  version: 2;
  tabId: string;
  sessionId: string;
  updatedAt: number;
  cleanClosedAt: number | null;
  bfcacheSuspended: boolean;
  route: string | null;
  visibilityState: DocumentVisibilityState | null;
  abandonmentReportedAt: number | null;
};

type BrowserSessionMonitorState = {
  sessionId: string;
  tabId: string;
  heartbeatId: number | null;
  peerScanId: number | null;
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
  }
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const PEER_SCAN_INTERVAL_MS = 15_000;
const STALL_PROBE_INTERVAL_MS = 1000;
const MAIN_THREAD_STALL_THRESHOLD_MS = 2000;
const STALL_REPORT_COOLDOWN_MS = 60_000;
const ABANDONED_SESSION_MIN_AGE_MS = HEARTBEAT_INTERVAL_MS * 3;
const ABANDONED_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const VISIBLE_PEER_STALE_AFTER_MS = HEARTBEAT_INTERVAL_MS * 2 + 5000;
const HIDDEN_PEER_STALE_AFTER_MS = 10 * 60 * 1000;
const CURRENT_SESSION_STORAGE_KEY = "shortpulse.browser_session.current.v1";
const LAST_SESSION_STORAGE_KEY = "shortpulse.browser_session.last.v1";
const TAB_ID_STORAGE_KEY = "shortpulse.browser_session.tab_id.v1";
const ACTIVE_TABS_STORAGE_KEY = "shortpulse.browser_session.active_tabs.v1";
const PEER_SESSION_STORAGE_PREFIX = "shortpulse.browser_session.peer.v2.";
const MAX_PEER_SESSION_RECORDS = 64;
const MAX_PEER_SESSION_KEYS_SCANNED = 128;
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
const abandonmentReportsInFlight = new Set<string>();
const cleanCloseReportsInFlight = new Set<string>();

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
  return redactedPathFromUrl(`${window.location.pathname}${window.location.search}`);
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
    "shortpulse_media_grid_tracked_video_nodes",
    "shortpulse_media_grid_attached_video_sources",
    "shortpulse_media_canvas_attached_video_sources",
    "shortpulse_media_duration_probe_inflight",
    "shortpulse_media_duration_probe_queued",
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
  writeCrashReportContextValue(
    "shortpulse_media_grid_tracked_video_nodes",
    metadata.media_grid_tracked_video_node_count
  );
  writeCrashReportContextValue(
    "shortpulse_media_grid_attached_video_sources",
    metadata.media_grid_attached_video_source_count
  );
  writeCrashReportContextValue(
    "shortpulse_media_canvas_attached_video_sources",
    metadata.media_canvas_attached_video_source_count
  );
  writeCrashReportContextValue(
    "shortpulse_media_duration_probe_inflight",
    metadata.media_duration_probe_inflight_count
  );
  writeCrashReportContextValue(
    "shortpulse_media_duration_probe_queued",
    metadata.media_duration_probe_queued_count
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

const peerSessionStorageKey = (tabId: string, sessionId: string): string =>
  `${PEER_SESSION_STORAGE_PREFIX}${tabId}.${sessionId}`;

const parsePeerSessionRecord = (raw: string | null): PeerBrowserSessionRecord | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PeerBrowserSessionRecord>;
    if (
      value.version !== 2 ||
      typeof value.tabId !== "string" ||
      typeof value.sessionId !== "string" ||
      typeof value.updatedAt !== "number"
    ) {
      return null;
    }
    return {
      version: 2,
      tabId: value.tabId,
      sessionId: value.sessionId,
      updatedAt: value.updatedAt,
      cleanClosedAt: typeof value.cleanClosedAt === "number" ? value.cleanClosedAt : null,
      bfcacheSuspended: value.bfcacheSuspended === true,
      route: typeof value.route === "string" ? value.route : null,
      visibilityState:
        value.visibilityState === "visible" || value.visibilityState === "hidden"
          ? value.visibilityState
          : null,
      abandonmentReportedAt:
        typeof value.abandonmentReportedAt === "number" ? value.abandonmentReportedAt : null,
    };
  } catch {
    return null;
  }
};

const readPeerSessionRecord = (
  tabId: string,
  sessionId: string
): PeerBrowserSessionRecord | null => {
  if (typeof window === "undefined") return null;
  try {
    return parsePeerSessionRecord(
      window.localStorage.getItem(peerSessionStorageKey(tabId, sessionId))
    );
  } catch {
    return null;
  }
};

const writePeerSessionRecord = (record: PeerBrowserSessionRecord): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      peerSessionStorageKey(record.tabId, record.sessionId),
      JSON.stringify(record)
    );
  } catch {
    // Best-effort per-tab recovery evidence only.
  }
};

const clearPeerSessionRecord = (tabId: string, sessionId: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(peerSessionStorageKey(tabId, sessionId));
  } catch {
    // Best-effort per-tab recovery evidence only.
  }
};

const listPeerSessionRecords = (): PeerBrowserSessionRecord[] => {
  if (typeof window === "undefined") return [];
  const records: PeerBrowserSessionRecord[] = [];
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index)
    ).filter((key): key is string => Boolean(key?.startsWith(PEER_SESSION_STORAGE_PREFIX)));
    const currentTime = nowMs();
    for (const [index, key] of keys.entries()) {
      if (index >= MAX_PEER_SESSION_KEYS_SCANNED) {
        window.localStorage.removeItem(key);
        continue;
      }
      const record = parsePeerSessionRecord(window.localStorage.getItem(key));
      const ageMs = record ? currentTime - record.updatedAt : Number.POSITIVE_INFINITY;
      if (
        !record ||
        record.abandonmentReportedAt !== null ||
        !Number.isFinite(ageMs) ||
        ageMs < 0 ||
        ageMs > ABANDONED_SESSION_MAX_AGE_MS
      ) {
        window.localStorage.removeItem(key);
        continue;
      }
      records.push(record);
    }
    records.sort((left, right) => right.updatedAt - left.updatedAt);
    for (const record of records.slice(MAX_PEER_SESSION_RECORDS)) {
      clearPeerSessionRecord(record.tabId, record.sessionId);
    }
  } catch {
    return [];
  }
  return records.slice(0, MAX_PEER_SESSION_RECORDS);
};

const clearLegacySessionMarkers = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_TABS_STORAGE_KEY);
  } catch {
    // One-release legacy marker retirement is best effort.
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

const readCurrentSessionId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(CURRENT_SESSION_STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
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
    heap_used_to_total_ratio: Math.round((used / total) * 1000) / 1000,
    heap_used_to_limit_ratio:
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
    ...readMediaPerfCrashEvidence(),
    ...readDeviceMetadata(),
  };
};

const sendBrowserSessionEvent = async (params: {
  eventType: BrowserSessionEventType;
  sessionId: string;
  previousSessionId?: string | null;
  metadata?: JsonObject;
  route?: string | null;
  occurredAt?: string;
  includeRuntimeMetadata?: boolean;
}): Promise<boolean> => {
  const token = readCachedSupabaseAccessToken();
  if (!token) return false;
  maybeRefreshBrowserStorageEstimateMetadata(params.eventType);

  const response = await fetch("/api/log/browser-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      eventType: params.eventType,
      sessionId: params.sessionId,
      previousSessionId: params.previousSessionId ?? null,
      route: params.route === undefined ? currentRoute() : params.route,
      occurredAt: params.occurredAt ?? new Date().toISOString(),
      metadata: {
        ...(params.includeRuntimeMetadata === false ? {} : readRuntimeMetadata()),
        ...(params.includeRuntimeMetadata === false ? {} : latestBrowserStorageEstimateMetadata),
        ...(params.metadata ?? {}),
      },
    }),
    keepalive: true,
  });
  return response.ok;
};

const reportEvent = (
  eventType: BrowserSessionEventType,
  metadata: JsonObject = {},
  previousSessionId: string | null = null
): void => {
  if (!activeMonitor) return;
  const monitor = activeMonitor;
  const updatedAt = nowMs();
  const previousRecord = readPeerSessionRecord(monitor.tabId, monitor.sessionId);
  const cleanClosedAt =
    eventType === "clean_close" ? updatedAt : (previousRecord?.cleanClosedAt ?? null);
  const bfcacheSuspended =
    eventType === "pagehide"
      ? metadata.pagehide_persisted === true
      : eventType === "pageshow" || eventType === "clean_close"
        ? false
        : (previousRecord?.bfcacheSuspended ?? false);
  writePeerSessionRecord({
    version: 2,
    tabId: monitor.tabId,
    sessionId: monitor.sessionId,
    updatedAt,
    cleanClosedAt,
    bfcacheSuspended,
    route: currentRoute(),
    visibilityState: document.visibilityState,
    abandonmentReportedAt:
      previousRecord?.sessionId === activeMonitor.sessionId
        ? previousRecord.abandonmentReportedAt
        : null,
  });
  syncCrashReportContext(monitor.sessionId, {
    ...readRuntimeMetadata(),
    ...metadata,
  });
  void sendBrowserSessionEvent({
    eventType,
    sessionId: monitor.sessionId,
    previousSessionId,
    metadata,
  })
    .then((sent) => {
      if (!sent || eventType !== "clean_close") return;
      const current = readPeerSessionRecord(monitor.tabId, monitor.sessionId);
      if (current?.cleanClosedAt === cleanClosedAt) {
        clearPeerSessionRecord(current.tabId, current.sessionId);
      }
    })
    .catch(() => undefined);
};

const reportCleanClosedPeerSession = (record: PeerBrowserSessionRecord): void => {
  if (!activeMonitor || record.cleanClosedAt === null) return;
  if (record.sessionId === activeMonitor.sessionId) return;
  if (cleanCloseReportsInFlight.has(record.sessionId)) return;
  cleanCloseReportsInFlight.add(record.sessionId);
  void sendBrowserSessionEvent({
    eventType: "clean_close",
    sessionId: record.sessionId,
    route: record.route,
    occurredAt: new Date(record.cleanClosedAt).toISOString(),
    includeRuntimeMetadata: false,
  })
    .then((sent) => {
      if (!sent) return;
      const current = readPeerSessionRecord(record.tabId, record.sessionId);
      if (current?.cleanClosedAt === record.cleanClosedAt) {
        clearPeerSessionRecord(record.tabId, record.sessionId);
      }
    })
    .catch(() => undefined)
    .finally(() => cleanCloseReportsInFlight.delete(record.sessionId));
};

const reportAbandonedPeerSession = (
  record: PeerBrowserSessionRecord,
  options: { sameTabReplacement?: boolean } = {}
): void => {
  if (
    !activeMonitor ||
    record.cleanClosedAt !== null ||
    record.bfcacheSuspended ||
    record.abandonmentReportedAt !== null
  )
    return;
  if (record.sessionId === activeMonitor.sessionId) return;
  const ageMs = nowMs() - record.updatedAt;
  const staleAfterMs =
    record.visibilityState === "hidden" ? HIDDEN_PEER_STALE_AFTER_MS : VISIBLE_PEER_STALE_AFTER_MS;
  if (
    !Number.isFinite(ageMs) ||
    ageMs < (options.sameTabReplacement ? 0 : staleAfterMs) ||
    ageMs > ABANDONED_SESSION_MAX_AGE_MS
  ) {
    return;
  }
  if (abandonmentReportsInFlight.has(record.sessionId)) return;
  abandonmentReportsInFlight.add(record.sessionId);
  const metadata = {
    last_heartbeat_age_ms: Math.max(0, ageMs),
    previous_last_seen_at: new Date(record.updatedAt).toISOString(),
    previous_visibility_state: record.visibilityState,
    abandonment_detection_source: options.sameTabReplacement ? "same_tab_replacement" : "peer_scan",
    status_reason: "previous_session_missing_clean_close",
  };
  void sendBrowserSessionEvent({
    eventType: "previous_session_abandoned",
    sessionId: activeMonitor.sessionId,
    previousSessionId: record.sessionId,
    metadata,
  })
    .then((sent) => {
      if (!sent) return;
      const current = readPeerSessionRecord(record.tabId, record.sessionId);
      if (current?.sessionId === record.sessionId) {
        writePeerSessionRecord({ ...current, abandonmentReportedAt: nowMs() });
      }
    })
    .catch(() => undefined)
    .finally(() => abandonmentReportsInFlight.delete(record.sessionId));
};

const scanAbandonedPeerSessions = (): void => {
  if (!activeMonitor) return;
  for (const record of listPeerSessionRecords()) {
    if (record.sessionId === activeMonitor.sessionId) continue;
    if (record.cleanClosedAt !== null) {
      reportCleanClosedPeerSession(record);
      continue;
    }
    reportAbandonedPeerSession(record, {
      sameTabReplacement: record.tabId === activeMonitor.tabId,
    });
  }
};

const maybeReportLegacyAbandonedSession = (previous: BrowserSessionRecord | null): void => {
  if (!activeMonitor || !previous || previous.cleanClosedAt !== null) return;
  if (previous.sessionId === activeMonitor.sessionId) return;
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
      abandonment_detection_source: "legacy_marker_migration",
      status_reason: "previous_session_missing_clean_close",
    },
    previous.sessionId
  );
};

const resetStallProbeTick = (state: BrowserSessionMonitorState): void => {
  state.lastStallTickMs = nowMs();
};

const installLifecycleListeners = (state: BrowserSessionMonitorState): (() => void) => {
  const onVisibilityChange = () => {
    resetStallProbeTick(state);
    if (document.visibilityState === "hidden") {
      reportEvent("visibility_hidden");
      return;
    }
    reportEvent("visibility_visible");
  };
  const onPageHide = (event: PageTransitionEvent) => {
    resetStallProbeTick(state);
    reportEvent(event.persisted ? "pagehide" : "clean_close", {
      pagehide_persisted: event.persisted,
    });
  };
  const onPageShow = (event: PageTransitionEvent) => {
    resetStallProbeTick(state);
    reportEvent("pageshow", { pageshow_persisted: event.persisted });
  };
  const onFreeze = () => {
    resetStallProbeTick(state);
    reportEvent("freeze");
  };
  const onResume = () => {
    resetStallProbeTick(state);
    reportEvent("resume");
  };

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
    scanAbandonedPeerSessions();
  }, HEARTBEAT_INTERVAL_MS);
};

const installPeerScan = (): number | null => {
  if (typeof window === "undefined") return null;
  return window.setInterval(scanAbandonedPeerSessions, PEER_SCAN_INTERVAL_MS);
};

const installStallProbe = (state: BrowserSessionMonitorState): number | null => {
  if (typeof window === "undefined") return null;
  state.lastStallTickMs = nowMs();
  return window.setInterval(() => {
    const current = nowMs();
    if (document.hidden || document.visibilityState !== "visible") {
      state.lastStallTickMs = current;
      return;
    }
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
  const previousSessionId = readCurrentSessionId();
  const previousSameTabSession = previousSessionId
    ? readPeerSessionRecord(tabId, previousSessionId)
    : (listPeerSessionRecords().find((record) => record.tabId === tabId) ?? null);
  const previousLegacySession = readStoredSessionRecord();
  writeCurrentSessionId(sessionId);

  const state: BrowserSessionMonitorState = {
    sessionId,
    tabId,
    heartbeatId: null,
    peerScanId: null,
    stallProbeId: null,
    lastStallTickMs: nowMs(),
    lastStallReportMs: 0,
    cleanup: () => undefined,
  };
  activeMonitor = state;

  reportEvent("session_start");
  if (previousSameTabSession) {
    reportAbandonedPeerSession(previousSameTabSession, { sameTabReplacement: true });
  }
  maybeReportLegacyAbandonedSession(previousLegacySession);
  clearLegacySessionMarkers();
  scanAbandonedPeerSessions();

  const cleanupLifecycle = installLifecycleListeners(state);
  state.heartbeatId = installHeartbeat();
  state.peerScanId = installPeerScan();
  state.stallProbeId = installStallProbe(state);
  state.cleanup = () => {
    cleanupLifecycle();
    if (state.heartbeatId !== null) window.clearInterval(state.heartbeatId);
    if (state.peerScanId !== null) window.clearInterval(state.peerScanId);
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
  abandonmentReportsInFlight.clear();
  cleanCloseReportsInFlight.clear();
};
