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

export type BrowserCrashSessionListFilters = {
  page: number;
  limit: number;
  status: BrowserCrashSessionStatus | "all";
  search: string;
};

const MAX_TEXT_LENGTH = 240;
const MAX_ROUTE_LENGTH = 320;
const MAX_SESSION_ID_LENGTH = 160;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_METADATA_KEYS = 48;
const MAX_METADATA_KEY_LENGTH = 80;
const ACTIVE_STALE_AFTER_MS = 2 * 60 * 1000;

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
  "crash_report_type",
  "crash_report_url_path",
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
  "heap_usage_ratio",
  "heartbeat_interval_ms",
  "is_secure_context",
  "js_heap_size_limit",
  "last_heartbeat_age_ms",
  "long_task_p95_ms",
  "max_input_stall_ms",
  "navigation_type",
  "pagehide_persisted",
  "pageshow_persisted",
  "pressure_level",
  "previous_last_seen_at",
  "resource_api_count",
  "resource_decoded_bytes",
  "resource_fetch_count",
  "resource_count",
  "resource_transfer_bytes",
  "screen_height",
  "screen_width",
  "session_age_ms",
  "stall_duration_ms",
  "status_reason",
  "total_js_heap_size",
  "used_js_heap_size",
  "viewport_height",
  "viewport_width",
  "visibility_state",
]);

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

const metadataNumber = (metadata: JsonObject, key: string): number | null => {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const hasSevereFreezeEvidence = (metadata: JsonObject): boolean => {
  const pressureLevel = metadataNumber(metadata, "pressure_level");
  const stallDurationMs = metadataNumber(metadata, "stall_duration_ms");
  const maxInputStallMs = metadataNumber(metadata, "max_input_stall_ms");
  const heapUsageRatio = metadataNumber(metadata, "heap_usage_ratio");
  const longTaskP95Ms = metadataNumber(metadata, "long_task_p95_ms");
  return (
    (pressureLevel !== null && pressureLevel >= 2) ||
    (stallDurationMs !== null && stallDurationMs >= 2000) ||
    (maxInputStallMs !== null && maxInputStallMs >= 1000) ||
    (heapUsageRatio !== null && heapUsageRatio >= 0.86) ||
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

const resolveSessionStartedAt = (eventType: BrowserSessionEventType, occurredAt: string) =>
  eventType === "session_start" ? occurredAt : undefined;

const buildSessionUpsert = (params: {
  user: AuthenticatedApiUser;
  req: NextApiRequest;
  eventType: BrowserSessionEventType;
  sessionId: string;
  route: string | null;
  metadata: JsonObject;
  occurredAt: string;
}) => {
  const status = resolveSessionStatus(params.eventType, params.metadata);
  const release = resolveBuildMetadata(params.metadata);
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
    metadata: params.metadata,
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

const markPreviousSessionAbandoned = async (params: {
  supabaseAdmin: SupabaseClient;
  user: AuthenticatedApiUser;
  previousSessionId: string | null;
  occurredAt: string;
  metadata: JsonObject;
}): Promise<string | null> => {
  if (!params.previousSessionId) return null;
  const confidence = hasSevereFreezeEvidence(params.metadata) ? "high" : "medium";
  const { data, error } = await params.supabaseAdmin
    .from("browser_crash_sessions")
    .update({
      status: "probable_freeze_or_crash",
      confidence,
      last_event: "previous_session_abandoned",
      metadata: params.metadata,
      suspected_at: params.occurredAt,
      updated_at: params.occurredAt,
    })
    .eq("browser_session_id", params.previousSessionId)
    .eq("user_id", params.user.id)
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

  const upsertPayload = compactUpsert(
    buildSessionUpsert({
      user: params.user,
      req: params.req,
      eventType,
      sessionId,
      route,
      metadata,
      occurredAt,
    })
  );

  const { error } = await supabaseAdmin
    .from("browser_crash_sessions")
    .upsert(upsertPayload, { onConflict: "user_id,browser_session_id" });
  if (error) throw new Error(error.message);

  return { sessionId, previousSessionId: previousId, eventType };
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
  let query = supabaseAdmin
    .from("browser_crash_sessions")
    .select("*", { count: "exact" })
    .order("last_seen_at", { ascending: false });

  if (filters.status !== "all") query = query.eq("status", filters.status);
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
