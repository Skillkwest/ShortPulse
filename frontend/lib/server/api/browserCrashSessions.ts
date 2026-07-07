/**
 * Browser crash-session persistence helpers.
 * Owns server-side sanitization, session upserts, abandoned-session marking,
 * and admin list normalization for browser freeze/crash forensics.
 */
import type { NextApiRequest } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedApiUser } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type BrowserCrashSessionStatus =
  | "active"
  | "clean_closed"
  | "possible_ungraceful_exit"
  | "probable_freeze_or_crash"
  | "confirmed_crash";

export type BrowserCrashSessionConfidence = "none" | "low" | "medium" | "high";
export type BrowserCrashSessionReviewStatus = "open" | "resolved" | "ignored";

export type BrowserSessionEventType =
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

export type BrowserSessionEventRequest = {
  eventType?: string;
  sessionId?: string;
  previousSessionId?: string | null;
  route?: string | null;
  occurredAt?: string | null;
  metadata?: JsonObject;
};

export type BrowserCrashReportIngestResult = {
  received: number;
  processed: number;
  skipped: number;
  sessionIds: string[];
};

export type BrowserCrashSessionListFilters = {
  page: number;
  limit: number;
  status: BrowserCrashSessionStatus | "all" | "needs_review";
  reviewStatus: BrowserCrashSessionReviewStatus | "reviewed" | "all";
  search: string;
};

export type BrowserCrashSessionReviewStatusRequest = {
  sessionId?: string;
  status?: string;
  note?: string | null;
};

const MAX_TEXT_LENGTH = 240;
const MAX_ROUTE_LENGTH = 320;
const MAX_SESSION_ID_LENGTH = 160;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_METADATA_KEYS = 48;
const MAX_METADATA_KEY_LENGTH = 80;
const MAX_REVIEW_NOTE_LENGTH = 400;
const MAX_CRASH_REPORTS_PER_REQUEST = 16;
const MAX_CRASH_REPORT_AGE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STALE_AFTER_MS = 10 * 60 * 1000;

const BROWSER_SESSION_EVENT_TYPES = new Set<BrowserSessionEventType>([
  "session_start",
  "heartbeat",
  "visibility_hidden",
  "visibility_visible",
  "pagehide",
  "pageshow",
  "freeze",
  "resume",
  "clean_close",
  "main_thread_stall",
  "pressure_snapshot",
  "previous_session_abandoned",
  "crash_report",
]);

const ALLOWED_METADATA_KEYS = new Set([
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
  "document_hidden",
  "document_was_discarded",
  "dom_audios",
  "dom_canvases",
  "dom_images",
  "dom_nodes",
  "dom_videos",
  "extension_roots",
  "hardware_concurrency",
  "heap_used_to_limit_ratio",
  "heap_used_to_total_ratio",
  "heap_usage_ratio",
  "heartbeat_interval_ms",
  "is_secure_context",
  "js_heap_size_limit",
  "last_heartbeat_age_ms",
  "last_pressure_snapshot_at",
  "long_task_p95_ms",
  "max_input_stall_ms",
  "max_heap_used_to_limit_ratio",
  "max_heap_used_to_total_ratio",
  "max_pressure_level",
  "navigation_type",
  "pagehide_persisted",
  "pageshow_persisted",
  "pressure_event_count",
  "pressure_level",
  "pressure_reason",
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
  "stall_duration_ms",
  "storage_estimate_available_bytes",
  "storage_estimate_quota_bytes",
  "storage_estimate_usage_bytes",
  "storage_estimate_usage_to_quota_ratio",
  "status_reason",
  "total_js_heap_size",
  "total_item_count",
  "used_js_heap_size",
  "viewport_height",
  "viewport_width",
  "visibility_state",
  "abandonment_detected_build_id",
  "abandonment_detected_client_release",
  "abandonment_detected_client_environment",
  "abandonment_detected_visibility_state",
  "abandonment_detected_document_hidden",
  "abandonment_detected_document_was_discarded",
]);

const STORAGE_ESTIMATE_METADATA_KEYS = [
  "storage_estimate_available_bytes",
  "storage_estimate_quota_bytes",
  "storage_estimate_usage_bytes",
  "storage_estimate_usage_to_quota_ratio",
] as const;

const PREVIOUS_SESSION_ABANDONED_METADATA_KEYS = [
  "last_heartbeat_age_ms",
  "previous_last_seen_at",
  "status_reason",
] as const;

const ABANDONMENT_DETECTOR_METADATA_KEYS = [
  ["build_id", "abandonment_detected_build_id"],
  ["client_release", "abandonment_detected_client_release"],
  ["client_environment", "abandonment_detected_client_environment"],
  ["visibility_state", "abandonment_detected_visibility_state"],
  ["document_hidden", "abandonment_detected_document_hidden"],
  ["document_was_discarded", "abandonment_detected_document_was_discarded"],
] as const;

const sanitizeText = (value: unknown, maxLength = MAX_TEXT_LENGTH): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const readHeaderValue = (value: string | string[] | undefined, maxLength = MAX_TEXT_LENGTH) => {
  const raw = Array.isArray(value) ? value[0] : value;
  return sanitizeText(raw, maxLength);
};

const normalizeOccurredAt = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
};

const redactRoute = (value: unknown): string | null => {
  const text = sanitizeText(value, MAX_ROUTE_LENGTH);
  if (!text) return null;
  const splitIndex = text.indexOf("?");
  if (splitIndex === -1) return text;
  const path = text.slice(0, splitIndex);
  const keys = text
    .slice(splitIndex + 1)
    .split("&")
    .map((part) => sanitizeText(part.split("=")[0], 40))
    .filter((part): part is string => Boolean(part))
    .slice(0, 12);
  return keys.length ? `${path}?${keys.join("&")}` : path;
};

const sanitizeMetadataValue = (value: unknown): string | number | boolean | null | undefined => {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return sanitizeText(value, MAX_TEXT_LENGTH) ?? undefined;
};

const sanitizeMetadata = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: JsonObject = {};
  for (const [rawKey, rawValue] of Object.entries(value as JsonObject).slice(
    0,
    MAX_METADATA_KEYS
  )) {
    const key = sanitizeText(rawKey, MAX_METADATA_KEY_LENGTH);
    if (!key || !ALLOWED_METADATA_KEYS.has(key)) continue;
    const sanitized = sanitizeMetadataValue(rawValue);
    if (sanitized === undefined) continue;
    output[key] = sanitized;
  }
  return output;
};

const isJsonObject = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assignSanitizedMetadataValue = (output: JsonObject, key: string, value: unknown): void => {
  if (!ALLOWED_METADATA_KEYS.has(key)) return;
  const sanitized = sanitizeMetadataValue(value);
  if (sanitized === undefined) return;
  output[key] = sanitized;
};

const mergePreviousSessionAbandonedMetadata = (
  previousMetadata: unknown,
  abandonmentMetadata: JsonObject
): JsonObject => {
  const evidence: JsonObject = {};
  for (const key of PREVIOUS_SESSION_ABANDONED_METADATA_KEYS) {
    assignSanitizedMetadataValue(evidence, key, abandonmentMetadata[key]);
  }
  for (const [sourceKey, targetKey] of ABANDONMENT_DETECTOR_METADATA_KEYS) {
    assignSanitizedMetadataValue(evidence, targetKey, abandonmentMetadata[sourceKey]);
  }

  const preserved = sanitizeMetadata(previousMetadata);
  for (const [key, value] of Object.entries(preserved)) {
    if (Object.prototype.hasOwnProperty.call(evidence, key)) continue;
    if (Object.keys(evidence).length >= MAX_METADATA_KEYS) break;
    evidence[key] = value;
  }
  return evidence;
};

const metadataNumber = (metadata: JsonObject, key: string): number | null => {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const maxMetadataNumber = (...values: Array<unknown>): number | null => {
  const numericValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  return numericValues.length ? Math.max(...numericValues) : null;
};

const positiveIntegerMetadata = (metadata: JsonObject, key: string): number => {
  const value = metadataNumber(metadata, key);
  return value !== null ? Math.max(0, Math.trunc(value)) : 0;
};

const resolveLegacyAdaptiveHeapUsageRatio = (metadata: JsonObject): number | null => {
  const hasPressureContext =
    metadataNumber(metadata, "pressure_level") !== null ||
    metadataNumber(metadata, "max_pressure_level") !== null;
  return hasPressureContext ? metadataNumber(metadata, "heap_usage_ratio") : null;
};

const resolveHeapLimitUsageRatio = (metadata: JsonObject): number | null => {
  const explicitRatio = metadataNumber(metadata, "heap_used_to_limit_ratio");
  if (explicitRatio !== null) return explicitRatio;
  const usedJsHeapSize = metadataNumber(metadata, "used_js_heap_size");
  const jsHeapSizeLimit = metadataNumber(metadata, "js_heap_size_limit");
  if (usedJsHeapSize === null || jsHeapSizeLimit === null || jsHeapSizeLimit <= 0) return null;
  return usedJsHeapSize / jsHeapSizeLimit;
};

const hasSevereFreezeEvidence = (metadata: JsonObject): boolean => {
  const pressureLevel = maxMetadataNumber(metadata.pressure_level, metadata.max_pressure_level);
  const stallDurationMs = metadataNumber(metadata, "stall_duration_ms");
  const maxInputStallMs = metadataNumber(metadata, "max_input_stall_ms");
  const heapPressureRatio = maxMetadataNumber(
    metadata.heap_used_to_total_ratio,
    metadata.max_heap_used_to_total_ratio,
    resolveLegacyAdaptiveHeapUsageRatio(metadata)
  );
  const heapLimitUsageRatio = maxMetadataNumber(
    resolveHeapLimitUsageRatio(metadata),
    metadata.max_heap_used_to_limit_ratio
  );
  const longTaskP95Ms = metadataNumber(metadata, "long_task_p95_ms");
  return (
    (pressureLevel !== null && pressureLevel >= 2) ||
    (stallDurationMs !== null && stallDurationMs >= 2000) ||
    (maxInputStallMs !== null && maxInputStallMs >= 1000) ||
    (heapPressureRatio !== null && heapPressureRatio >= 0.86) ||
    (heapLimitUsageRatio !== null && heapLimitUsageRatio >= 0.86) ||
    (longTaskP95Ms !== null && longTaskP95Ms >= 250)
  );
};

const resolveEventType = (value: unknown): BrowserSessionEventType => {
  const normalized = sanitizeText(value, 80);
  return normalized && BROWSER_SESSION_EVENT_TYPES.has(normalized as BrowserSessionEventType)
    ? (normalized as BrowserSessionEventType)
    : "heartbeat";
};

const resolveSessionStatus = (
  eventType: BrowserSessionEventType,
  metadata: JsonObject
): { status: BrowserCrashSessionStatus; confidence: BrowserCrashSessionConfidence } => {
  if (eventType === "crash_report") return { status: "confirmed_crash", confidence: "high" };
  if (eventType === "previous_session_abandoned") {
    return {
      status: "probable_freeze_or_crash",
      confidence: hasSevereFreezeEvidence(metadata) ? "high" : "medium",
    };
  }
  if (eventType === "clean_close") return { status: "clean_closed", confidence: "none" };
  return { status: "active", confidence: "none" };
};

const resolveBuildMetadata = (metadata: JsonObject) => ({
  build_id: sanitizeText(metadata.build_id, 120),
  client_release: sanitizeText(metadata.client_release, 120),
  client_environment: sanitizeText(metadata.client_environment, 80),
});

const resolveReviewStatus = (value: unknown): BrowserCrashSessionReviewStatus | null => {
  const normalized = sanitizeText(value, 24)?.toLowerCase();
  if (normalized === "open" || normalized === "resolved" || normalized === "ignored") {
    return normalized;
  }
  return null;
};

const resolveSessionStartedAt = (eventType: BrowserSessionEventType, occurredAt: string) =>
  eventType === "session_start" ? occurredAt : undefined;

const normalizeFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeReportAgeMs = (value: unknown): number | null => {
  const numeric = normalizeFiniteNumber(value);
  if (numeric === null || numeric < 0 || numeric > MAX_CRASH_REPORT_AGE_MS) return null;
  return Math.round(numeric);
};

const normalizeOccurredAtFromReport = (report: JsonObject): string => {
  const ageMs = normalizeReportAgeMs(report.age);
  if (ageMs === null) return new Date().toISOString();
  return new Date(Date.now() - ageMs).toISOString();
};

const redactReportUrlPath = (value: unknown): string | null => {
  const text = sanitizeText(value, 2000);
  if (!text) return null;
  try {
    const url = new URL(text);
    const keys = Array.from(url.searchParams.keys())
      .map((key) => sanitizeText(key, 40))
      .filter((key): key is string => Boolean(key))
      .slice(0, 12);
    const route = keys.length ? `${url.pathname}?${keys.join("&")}` : url.pathname;
    return sanitizeText(route, MAX_ROUTE_LENGTH);
  } catch {
    return redactRoute(text);
  }
};

const normalizeCrashReportPayload = (payload: unknown): JsonObject[] => {
  let normalizedPayload = payload;
  if (typeof payload === "string" && payload.trim()) {
    try {
      normalizedPayload = JSON.parse(payload);
    } catch {
      normalizedPayload = null;
    }
  }
  const reports = Array.isArray(normalizedPayload)
    ? normalizedPayload
    : isJsonObject(normalizedPayload) && Array.isArray(normalizedPayload.reports)
      ? normalizedPayload.reports
      : [normalizedPayload];
  return reports.filter(isJsonObject).slice(0, MAX_CRASH_REPORTS_PER_REQUEST);
};

const readCrashReportContext = (report: JsonObject): JsonObject => {
  const body = isJsonObject(report.body) ? report.body : {};
  const context = body.crash_report_api;
  return isJsonObject(context) ? context : {};
};

const readCrashReportSessionId = (report: JsonObject): string | null => {
  const context = readCrashReportContext(report);
  for (const key of [
    "shortpulse_browser_session_id",
    "shortpulse_session_id",
    "browser_session_id",
    "browserSessionId",
    "session_id",
    "sessionId",
  ]) {
    const sessionId = sanitizeText(context[key], MAX_SESSION_ID_LENGTH);
    if (sessionId) return sessionId;
  }
  return null;
};

const normalizeCrashReportMetadata = (
  report: JsonObject
): { metadata: JsonObject; route: string | null } => {
  const body = isJsonObject(report.body) ? report.body : {};
  const context = readCrashReportContext(report);
  const metadata: JsonObject = {
    crash_report_source: "reporting_api",
  };

  assignSanitizedMetadataValue(metadata, "crash_report_type", report.type);
  assignSanitizedMetadataValue(metadata, "crash_report_url_path", redactReportUrlPath(report.url));
  assignSanitizedMetadataValue(metadata, "crash_report_age_ms", normalizeReportAgeMs(report.age));
  assignSanitizedMetadataValue(metadata, "crash_report_reason", body.reason);
  assignSanitizedMetadataValue(metadata, "crash_report_visibility_state", body.visibility_state);
  assignSanitizedMetadataValue(metadata, "crash_report_is_top_level", body.is_top_level);

  assignSanitizedMetadataValue(metadata, "build_id", context.shortpulse_build_id);
  assignSanitizedMetadataValue(metadata, "client_release", context.shortpulse_client_release);
  assignSanitizedMetadataValue(
    metadata,
    "client_environment",
    context.shortpulse_client_environment
  );
  assignSanitizedMetadataValue(
    metadata,
    "pressure_level",
    normalizeFiniteNumber(context.shortpulse_pressure_level)
  );
  assignSanitizedMetadataValue(
    metadata,
    "max_input_stall_ms",
    normalizeFiniteNumber(context.shortpulse_max_input_stall_ms)
  );
  assignSanitizedMetadataValue(
    metadata,
    "long_task_p95_ms",
    normalizeFiniteNumber(context.shortpulse_long_task_p95_ms)
  );
  assignSanitizedMetadataValue(
    metadata,
    "heap_used_to_total_ratio",
    normalizeFiniteNumber(context.shortpulse_heap_used_to_total_ratio)
  );
  assignSanitizedMetadataValue(
    metadata,
    "heap_used_to_limit_ratio",
    normalizeFiniteNumber(context.shortpulse_heap_used_to_limit_ratio)
  );

  return {
    metadata: sanitizeMetadata(metadata),
    route: redactRoute(context.shortpulse_route),
  };
};

const mergeSessionEventMetadata = (params: {
  previousMetadata: unknown;
  metadata: JsonObject;
  eventType: BrowserSessionEventType;
  occurredAt: string;
}): JsonObject => {
  const previous = sanitizeMetadata(params.previousMetadata);
  const incoming = sanitizeMetadata(params.metadata);
  const merged: JsonObject = {
    ...previous,
    ...incoming,
  };

  for (const key of STORAGE_ESTIMATE_METADATA_KEYS) {
    if (incoming[key] !== null) continue;
    if (previous[key] !== undefined) {
      merged[key] = previous[key];
    } else {
      delete merged[key];
    }
  }

  const maxPressureLevel = maxMetadataNumber(
    previous.max_pressure_level,
    previous.pressure_level,
    incoming.pressure_level
  );
  if (maxPressureLevel !== null) merged.max_pressure_level = maxPressureLevel;

  const maxHeapUsedToTotalRatio = maxMetadataNumber(
    previous.max_heap_used_to_total_ratio,
    previous.heap_used_to_total_ratio,
    resolveLegacyAdaptiveHeapUsageRatio(previous),
    incoming.heap_used_to_total_ratio,
    resolveLegacyAdaptiveHeapUsageRatio(incoming)
  );
  if (maxHeapUsedToTotalRatio !== null) {
    merged.max_heap_used_to_total_ratio = maxHeapUsedToTotalRatio;
  }

  const maxHeapUsedToLimitRatio = maxMetadataNumber(
    previous.max_heap_used_to_limit_ratio,
    previous.heap_used_to_limit_ratio,
    incoming.heap_used_to_limit_ratio,
    resolveHeapLimitUsageRatio(incoming)
  );
  if (maxHeapUsedToLimitRatio !== null) {
    merged.max_heap_used_to_limit_ratio = maxHeapUsedToLimitRatio;
  }

  if (params.eventType === "pressure_snapshot") {
    merged.pressure_event_count = positiveIntegerMetadata(previous, "pressure_event_count") + 1;
    merged.last_pressure_snapshot_at = params.occurredAt;
  } else if (previous.pressure_event_count !== undefined) {
    merged.pressure_event_count = previous.pressure_event_count;
  }
  if (
    params.eventType !== "pressure_snapshot" &&
    previous.last_pressure_snapshot_at !== undefined
  ) {
    merged.last_pressure_snapshot_at = previous.last_pressure_snapshot_at;
  }

  return Object.fromEntries(Object.entries(merged).slice(0, MAX_METADATA_KEYS));
};

const buildSessionUpsert = (params: {
  user: AuthenticatedApiUser;
  req: NextApiRequest;
  eventType: BrowserSessionEventType;
  sessionId: string;
  route: string | null;
  metadata: JsonObject;
  previousMetadata?: unknown;
  occurredAt: string;
}) => {
  const metadata = mergeSessionEventMetadata({
    previousMetadata: params.previousMetadata,
    metadata: params.metadata,
    eventType: params.eventType,
    occurredAt: params.occurredAt,
  });
  const status =
    params.eventType === "previous_session_abandoned"
      ? { status: "active" as const, confidence: "none" as const }
      : resolveSessionStatus(params.eventType, metadata);
  const release = resolveBuildMetadata(metadata);
  return {
    browser_session_id: params.sessionId,
    user_id: params.user.id,
    user_email: sanitizeText(params.user.email, 320),
    status: status.status,
    confidence: status.confidence,
    last_event: params.eventType,
    route: params.route,
    build_id: release.build_id,
    client_release: release.client_release,
    client_environment: release.client_environment,
    user_agent: readHeaderValue(params.req.headers["user-agent"], MAX_USER_AGENT_LENGTH),
    host: readHeaderValue(params.req.headers.host),
    vercel_id: readHeaderValue(params.req.headers["x-vercel-id"], 160),
    metadata,
    review_status: params.eventType === "session_start" ? "open" : undefined,
    started_at: resolveSessionStartedAt(params.eventType, params.occurredAt),
    last_seen_at: params.occurredAt,
    ended_at: params.eventType === "clean_close" ? params.occurredAt : null,
    suspected_at:
      status.status === "probable_freeze_or_crash" || status.status === "confirmed_crash"
        ? params.occurredAt
        : null,
    updated_at: params.occurredAt,
  };
};

const compactUpsert = (value: Record<string, unknown>): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw !== undefined) output[key] = raw;
  }
  return output;
};

const readExistingSessionMetadata = async (params: {
  supabaseAdmin: SupabaseClient;
  user: AuthenticatedApiUser;
  sessionId: string;
}): Promise<unknown> => {
  const { data, error } = await params.supabaseAdmin
    .from("browser_crash_sessions")
    .select("metadata")
    .eq("browser_session_id", params.sessionId)
    .eq("user_id", params.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JsonObject | null)?.metadata;
};

const markPreviousSessionAbandoned = async (params: {
  supabaseAdmin: SupabaseClient;
  user: AuthenticatedApiUser;
  previousSessionId: string | null;
  occurredAt: string;
  metadata: JsonObject;
}): Promise<string | null> => {
  if (!params.previousSessionId) return null;
  const { data: existing, error: selectError } = await params.supabaseAdmin
    .from("browser_crash_sessions")
    .select("id, metadata")
    .eq("browser_session_id", params.previousSessionId)
    .eq("user_id", params.user.id)
    .maybeSingle();
  if (selectError) throw new Error(selectError.message);
  if (!existing || typeof existing.id !== "string") return null;

  const metadata = mergePreviousSessionAbandonedMetadata(existing.metadata, params.metadata);
  const confidence = hasSevereFreezeEvidence(metadata) ? "high" : "medium";
  const { data, error } = await params.supabaseAdmin
    .from("browser_crash_sessions")
    .update({
      status: "probable_freeze_or_crash",
      confidence,
      last_event: "previous_session_abandoned",
      metadata,
      suspected_at: params.occurredAt,
      updated_at: params.occurredAt,
    })
    .eq("id", existing.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.id === "string" ? data.id : null;
};

/**
 * Records one authenticated browser session-health event.
 */
export const recordBrowserSessionEvent = async (params: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  payload: BrowserSessionEventRequest;
}): Promise<{ sessionId: string; previousSessionId: string | null; eventType: string }> => {
  const sessionId = sanitizeText(params.payload.sessionId, MAX_SESSION_ID_LENGTH);
  if (!sessionId) throw new Error("A browser session id is required.");

  const eventType = resolveEventType(params.payload.eventType);
  const previousSessionId = sanitizeText(params.payload.previousSessionId, MAX_SESSION_ID_LENGTH);
  const occurredAt = normalizeOccurredAt(params.payload.occurredAt);
  const metadata = sanitizeMetadata(params.payload.metadata);
  const route = redactRoute(params.payload.route);
  const supabaseAdmin = getSupabaseAdmin();

  const previousId = await markPreviousSessionAbandoned({
    supabaseAdmin,
    user: params.user,
    previousSessionId: eventType === "previous_session_abandoned" ? previousSessionId : null,
    occurredAt,
    metadata,
  });

  if (eventType === "previous_session_abandoned") {
    return { sessionId, previousSessionId: previousId, eventType };
  }

  const previousMetadata =
    eventType === "session_start"
      ? null
      : await readExistingSessionMetadata({
          supabaseAdmin,
          user: params.user,
          sessionId,
        });

  const upsertPayload = compactUpsert(
    buildSessionUpsert({
      user: params.user,
      req: params.req,
      eventType,
      sessionId,
      route,
      metadata,
      previousMetadata,
      occurredAt,
    })
  );

  const { error } = await supabaseAdmin
    .from("browser_crash_sessions")
    .upsert(upsertPayload, { onConflict: "user_id,browser_session_id" });
  if (error) throw new Error(error.message);

  return { sessionId, previousSessionId: previousId, eventType };
};

/**
 * Records browser-delivered Reporting API crash reports.
 * The endpoint is unauthenticated by browser design, so it only updates an
 * existing authenticated session row that already knows the browser session id.
 */
export const recordBrowserCrashReports = async (params: {
  payload: unknown;
}): Promise<BrowserCrashReportIngestResult> => {
  const reports = normalizeCrashReportPayload(params.payload);
  const result: BrowserCrashReportIngestResult = {
    received: reports.length,
    processed: 0,
    skipped: 0,
    sessionIds: [],
  };
  const candidates = reports.filter((report) => sanitizeText(report.type, 80) === "crash");
  if (!candidates.length) {
    result.skipped = reports.length;
    return result;
  }

  let supabaseAdmin: SupabaseClient | null = null;
  const processedSessionIds = new Set<string>();

  for (const report of candidates) {
    const sessionId = readCrashReportSessionId(report);
    if (!sessionId) {
      result.skipped += 1;
      continue;
    }
    supabaseAdmin ??= getSupabaseAdmin();

    const { data: existing, error: selectError } = await supabaseAdmin
      .from("browser_crash_sessions")
      .select("id, metadata, route")
      .eq("browser_session_id", sessionId)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);
    if (!existing || typeof existing.id !== "string") {
      result.skipped += 1;
      continue;
    }

    const occurredAt = normalizeOccurredAtFromReport(report);
    const { metadata: incomingMetadata, route } = normalizeCrashReportMetadata(report);
    const metadata = mergeSessionEventMetadata({
      previousMetadata: existing.metadata,
      metadata: incomingMetadata,
      eventType: "crash_report",
      occurredAt,
    });
    const release = resolveBuildMetadata(metadata);
    const { error: updateError } = await supabaseAdmin
      .from("browser_crash_sessions")
      .update({
        status: "confirmed_crash",
        confidence: "high",
        last_event: "crash_report",
        route: route ?? (typeof existing.route === "string" ? existing.route : null),
        build_id: release.build_id,
        client_release: release.client_release,
        client_environment: release.client_environment,
        metadata,
        last_seen_at: occurredAt,
        ended_at: occurredAt,
        suspected_at: occurredAt,
        updated_at: occurredAt,
      })
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);

    result.processed += 1;
    processedSessionIds.add(sessionId);
  }

  result.skipped += reports.length - candidates.length;
  result.sessionIds = Array.from(processedSessionIds);
  return result;
};

/**
 * Updates operator review state for one crash-session row without deleting evidence.
 */
export const updateBrowserCrashSessionReviewStatus = async (params: {
  user: AuthenticatedApiUser;
  payload: BrowserCrashSessionReviewStatusRequest;
}): Promise<{
  id: string;
  review_status: BrowserCrashSessionReviewStatus;
  reviewed_at: string | null;
}> => {
  const sessionId = sanitizeText(params.payload.sessionId, MAX_SESSION_ID_LENGTH);
  if (!sessionId) throw new Error("A browser crash session id is required.");
  const reviewStatus = resolveReviewStatus(params.payload.status);
  if (!reviewStatus) throw new Error("status must be one of open, resolved, ignored.");

  const now = new Date().toISOString();
  const reviewPayload =
    reviewStatus === "open"
      ? {
          review_status: reviewStatus,
          reviewed_at: null,
          reviewed_by: null,
          reviewed_by_email: null,
          review_note: sanitizeText(params.payload.note, MAX_REVIEW_NOTE_LENGTH),
          updated_at: now,
        }
      : {
          review_status: reviewStatus,
          reviewed_at: now,
          reviewed_by: params.user.id,
          reviewed_by_email: sanitizeText(params.user.email, 320),
          review_note: sanitizeText(params.payload.note, MAX_REVIEW_NOTE_LENGTH),
          updated_at: now,
        };

  const { data, error } = await getSupabaseAdmin()
    .from("browser_crash_sessions")
    .update(reviewPayload)
    .eq("id", sessionId)
    .select("id, review_status, reviewed_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || typeof data.id !== "string") throw new Error("Crash session not found.");

  return {
    id: data.id,
    review_status: resolveReviewStatus(data.review_status) ?? reviewStatus,
    reviewed_at: asIso(data.reviewed_at),
  };
};

const asIso = (value: unknown): string | null => (typeof value === "string" ? value : null);

const resolveEffectiveStatus = (row: JsonObject, nowMs: number) => {
  const status = row.status as BrowserCrashSessionStatus;
  const lastSeenAt = asIso(row.last_seen_at);
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : Number.NaN;
  const stale =
    status === "active" && Number.isFinite(lastSeenMs)
      ? nowMs - lastSeenMs > ACTIVE_STALE_AFTER_MS
      : false;
  return {
    effective_status: stale ? "possible_ungraceful_exit" : status,
    effective_confidence: stale ? "low" : (row.confidence as BrowserCrashSessionConfidence),
    is_stale: stale,
  };
};

/**
 * Fetches paged crash sessions for the Admin Crash Logs tab.
 */
export const fetchBrowserCrashSessions = async (
  filters: BrowserCrashSessionListFilters
): Promise<{
  sessions: JsonObject[];
  pagination: { page: number; perPage: number; totalCount: number; totalPages: number };
}> => {
  const supabaseAdmin = getSupabaseAdmin();
  const page = Math.max(1, Math.trunc(filters.page));
  const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit)));
  const offset = (page - 1) * limit;
  const staleCutoff = new Date(Date.now() - ACTIVE_STALE_AFTER_MS).toISOString();
  let query = supabaseAdmin
    .from("browser_crash_sessions")
    .select("*", { count: "exact" })
    .order("last_seen_at", { ascending: false });

  if (filters.status === "needs_review") {
    query = query.in("status", ["probable_freeze_or_crash", "confirmed_crash"]);
  } else if (filters.status === "possible_ungraceful_exit") {
    query = query.or(
      `status.eq.possible_ungraceful_exit,and(status.eq.active,last_seen_at.lt.${staleCutoff})`
    );
  } else if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.reviewStatus === "reviewed") {
    query = query.in("review_status", ["resolved", "ignored"]);
  } else if (filters.reviewStatus !== "all") {
    query = query.eq("review_status", filters.reviewStatus);
  }
  if (filters.search.trim()) {
    const pattern = `%${filters.search.trim().replace(/\s+/g, "%")}%`;
    query = query.or(
      [
        `browser_session_id.ilike.${pattern}`,
        `user_email.ilike.${pattern}`,
        `route.ilike.${pattern}`,
        `user_agent.ilike.${pattern}`,
      ].join(",")
    );
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const now = Date.now();
  const sessions = ((data ?? []) as JsonObject[]).map((row) => ({
    ...row,
    ...resolveEffectiveStatus(row, now),
  }));
  const totalCount = Math.max(0, Number(count ?? 0));
  return {
    sessions,
    pagination: {
      page,
      perPage: limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    },
  };
};
