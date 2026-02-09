/**
 * Centralized app-error logging helpers.
 * Normalizes payloads, filters non-actionable cases, and deduplicates repeated incidents.
 */
import { createHash } from "crypto";
import type { NextApiRequest } from "next";
import type { AuthenticatedApiUser } from "./auth";
import { getOptionalApiUser } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type AppErrorScope = "app" | "generation";
export type AppErrorSeverity = "low" | "medium" | "high";

export type AppErrorLogInput = {
  source: string;
  scope?: AppErrorScope;
  severity?: AppErrorSeverity;
  message: string;
  stack?: string | null;
  route?: string | null;
  endpoint?: string | null;
  requestId?: string | null;
  statusCode?: number | null;
  userId?: string | null;
  userEmail?: string | null;
  metadata?: JsonObject;
  occurredAt?: string | null;
};

type AppErrorWriteResult = {
  ok: boolean;
  skipped: boolean;
  id: string | null;
};

type ApiExceptionOptions = {
  req: NextApiRequest;
  error: unknown;
  routeLabel: string;
  metadata?: JsonObject;
  scope?: AppErrorScope;
  user?: AuthenticatedApiUser | null;
};

type ExistingOpenLogRow = {
  id: string | null;
  occurrences_count: number | null;
};

const MAX_MESSAGE_LENGTH = 600;
const MAX_STACK_LENGTH = 6000;
const MAX_TEXT_FIELD_LENGTH = 300;
const MAX_METADATA_ENTRIES = 40;
const MAX_METADATA_TEXT_LENGTH = 300;

const toTrimmedString = (value: unknown, maxLength = MAX_TEXT_FIELD_LENGTH): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const sanitizeMessage = (value: unknown): string => {
  const text = toTrimmedString(value, MAX_MESSAGE_LENGTH);
  return text ?? "Unknown application error";
};

const sanitizeStack = (value: unknown): string | null => {
  const text = toTrimmedString(value, MAX_STACK_LENGTH);
  return text ?? null;
};

const sanitizeStatusCode = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  if (normalized < 100 || normalized > 599) return null;
  return normalized;
};

const sanitizeSeverity = (value: unknown, statusCode: number | null): AppErrorSeverity => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  if (statusCode !== null && statusCode >= 502) return "high";
  return "medium";
};

const sanitizeScope = (value: unknown): AppErrorScope => {
  return String(value ?? "").toLowerCase() === "generation" ? "generation" : "app";
};

const sanitizeMetadata = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as JsonObject).slice(0, MAX_METADATA_ENTRIES);
  const output: JsonObject = {};
  for (const [key, raw] of entries) {
    if (!key.trim()) continue;
    if (raw === null || raw === undefined) {
      output[key] = null;
      continue;
    }
    if (typeof raw === "string") {
      output[key] = raw.slice(0, MAX_METADATA_TEXT_LENGTH);
      continue;
    }
    if (typeof raw === "number" || typeof raw === "boolean") {
      output[key] = raw;
      continue;
    }
    if (Array.isArray(raw)) {
      output[key] = raw.slice(0, 10).map((item) => {
        if (typeof item === "string") return item.slice(0, MAX_METADATA_TEXT_LENGTH);
        if (typeof item === "number" || typeof item === "boolean" || item === null) return item;
        return String(item).slice(0, MAX_METADATA_TEXT_LENGTH);
      });
      continue;
    }
    output[key] = String(raw).slice(0, MAX_METADATA_TEXT_LENGTH);
  }
  return output;
};

const normalizeOccurredAt = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const buildFingerprint = (params: {
  source: string;
  scope: AppErrorScope;
  message: string;
  stack: string | null;
  route: string | null;
  endpoint: string | null;
  statusCode: number | null;
}): string => {
  const stackFirstLine = params.stack?.split("\n")[0]?.trim() ?? "";
  const fingerprintSeed = [
    params.source.toLowerCase(),
    params.scope,
    params.message.toLowerCase(),
    stackFirstLine.toLowerCase(),
    params.route ?? "",
    params.endpoint ?? "",
    String(params.statusCode ?? ""),
  ].join("|");
  return createHash("sha256").update(fingerprintSeed).digest("hex");
};

const shouldSkipLog = (params: {
  scope: AppErrorScope;
  source: string;
  statusCode: number | null;
  endpoint: string | null;
  message: string;
}): boolean => {
  if (params.scope !== "app") return true;
  if (params.statusCode !== null && params.statusCode < 500) return true;
  if (params.endpoint?.includes("/api/log/client-error")) return true;
  if (params.source === "client.api_network" && /aborterror|aborted/i.test(params.message)) return true;
  return false;
};

const requestHeaderValue = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") return toTrimmedString(value);
  if (Array.isArray(value) && value[0]) return toTrimmedString(value[0]);
  return null;
};

/**
 * Persists one app error entry, or increments an existing open incident fingerprint.
 */
export const writeAppErrorLog = async (input: AppErrorLogInput): Promise<AppErrorWriteResult> => {
  const source = toTrimmedString(input.source, 80) ?? "client.runtime";
  const statusCode = sanitizeStatusCode(input.statusCode);
  const scope = sanitizeScope(input.scope);
  const message = sanitizeMessage(input.message);
  const stack = sanitizeStack(input.stack);
  const route = toTrimmedString(input.route);
  const endpoint = toTrimmedString(input.endpoint);
  const requestId = toTrimmedString(input.requestId, 120);
  const severity = sanitizeSeverity(input.severity, statusCode);
  const metadata = sanitizeMetadata(input.metadata);
  const userId = toTrimmedString(input.userId, 120);
  const userEmail = toTrimmedString(input.userEmail, 320);
  const occurredAt = normalizeOccurredAt(input.occurredAt) ?? new Date().toISOString();

  if (shouldSkipLog({ scope, source, statusCode, endpoint, message })) {
    return { ok: true, skipped: true, id: null };
  }

  const fingerprint = buildFingerprint({
    source,
    scope,
    message,
    stack,
    route,
    endpoint,
    statusCode,
  });

  const supabaseAdmin = getSupabaseAdmin();
  const adminDb = supabaseAdmin as any;

  let existingQuery = adminDb
    .from("app_error_logs")
    .select("id, occurrences_count")
    .eq("fingerprint", fingerprint)
    .eq("status", "open")
    .limit(1)
    .order("last_seen_at", { ascending: false });

  if (userId) {
    existingQuery = existingQuery.eq("user_id", userId);
  } else {
    existingQuery = existingQuery.is("user_id", null);
  }

  const { data: existingRaw, error: findError } = await existingQuery.maybeSingle();
  const existing = (existingRaw as ExistingOpenLogRow | null) ?? null;
  if (findError) {
    console.error("[appErrorLogs] failed to find existing log", findError.message);
  }

  if (existing && existing.id) {
    const nextCount = Math.max(1, Number(existing.occurrences_count ?? 1)) + 1;
    const { error: updateError } = await adminDb
      .from("app_error_logs")
      .update({
        last_seen_at: occurredAt,
        occurrences_count: nextCount,
        message,
        stack,
        route,
        endpoint,
        request_id: requestId,
        http_status: statusCode,
        severity,
        metadata,
        user_email: userEmail,
      })
      .eq("id", existing.id);
    if (updateError) {
      console.error("[appErrorLogs] failed to update existing log", updateError.message);
      return { ok: false, skipped: false, id: null };
    }
    return { ok: true, skipped: false, id: existing.id as string };
  }

  const { data: inserted, error: insertError } = await adminDb
    .from("app_error_logs")
    .insert({
      fingerprint,
      source,
      scope,
      severity,
      message,
      stack,
      route,
      endpoint,
      request_id: requestId,
      http_status: statusCode,
      user_id: userId,
      user_email: userEmail,
      metadata,
      first_seen_at: occurredAt,
      last_seen_at: occurredAt,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("[appErrorLogs] failed to insert log", insertError.message);
    return { ok: false, skipped: false, id: null };
  }

  return { ok: true, skipped: false, id: (inserted?.id as string | undefined) ?? null };
};

/**
 * Helper for API-route catch blocks to write structured server exceptions.
 */
export const logApiRouteException = async ({
  req,
  error,
  routeLabel,
  metadata = {},
  scope = "app",
  user = null,
}: ApiExceptionOptions): Promise<void> => {
  try {
    const resolvedUser = user ?? (await getOptionalApiUser(req));
    const message = error instanceof Error ? error.message : String(error ?? "Unknown API exception");
    const stack = error instanceof Error ? error.stack ?? null : null;
    const requestId = requestHeaderValue(req.headers["x-shortpulse-request-id"]);

    await writeAppErrorLog({
      source: "api.exception",
      scope,
      severity: "high",
      message,
      stack,
      route: routeLabel,
      endpoint: req.url ?? null,
      requestId,
      userId: resolvedUser?.id ?? null,
      userEmail: resolvedUser?.email ?? null,
      metadata: {
        method: req.method ?? null,
        route_label: routeLabel,
        ...metadata,
      },
    });
  } catch (loggingError) {
    console.error("[appErrorLogs] API exception log write failed", loggingError);
  }
};
