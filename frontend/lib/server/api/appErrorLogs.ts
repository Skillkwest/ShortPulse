/**
 * Centralized app-error logging helpers.
 * Normalizes payloads, records immutable per-occurrence events, and maintains deduplicated incidents.
 */
import { createHash } from "crypto";
import type { NextApiRequest } from "next";
import type { AuthenticatedApiUser } from "./auth";
import { getOptionalApiUser } from "./auth";
import { isTelemetrySource } from "./errorTelemetryPolicy";
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
  req?: NextApiRequest;
  error: unknown;
  routeLabel: string;
  metadata?: JsonObject;
  scope?: AppErrorScope;
  user?: AuthenticatedApiUser | null;
};

type GenerationFailureLogOptions = {
  req?: NextApiRequest;
  routeLabel: string;
  message: string;
  statusCode?: number | null;
  source?: string;
  severity?: AppErrorSeverity;
  stack?: string | null;
  metadata?: JsonObject;
  userId?: string | null;
  userEmail?: string | null;
};

type ExistingOpenLogRow = {
  id: string | null;
  occurrences_count: number | null;
  metadata: JsonObject | null;
};

type AppErrorLogsQuery = {
  eq: (column: string, value: unknown) => AppErrorLogsQuery;
  is: (column: string, value: unknown) => AppErrorLogsQuery;
  limit: (count: number) => AppErrorLogsQuery;
  order: (column: string, options: { ascending: boolean }) => AppErrorLogsQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
};

type AppErrorLogsMutation = {
  eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
};

type AppErrorLogsInsert = {
  select: (columns: string) => {
    maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message: string } | null }>;
  };
};

type AppErrorLogsTable = {
  select: (columns: string) => AppErrorLogsQuery;
  update: (values: Record<string, unknown>) => AppErrorLogsMutation;
  insert: (values: Record<string, unknown>) => AppErrorLogsInsert;
};

type AppErrorEventsMutation = {
  eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
};

type AppErrorEventsInsert = {
  select: (columns: string) => {
    maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message: string } | null }>;
  };
};

type AppErrorEventsTable = {
  insert: (values: Record<string, unknown>) => AppErrorEventsInsert;
  update: (values: Record<string, unknown>) => AppErrorEventsMutation;
};

const MAX_MESSAGE_LENGTH = 600;
const MAX_STACK_LENGTH = 6000;
const MAX_TEXT_FIELD_LENGTH = 300;
const MAX_METADATA_ENTRIES = 40;
const MAX_METADATA_TEXT_LENGTH = 300;
const MAX_METADATA_NESTED_ENTRIES = 20;
let warnedSupabaseUnavailable = false;

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

const sanitizeMetadataValue = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, MAX_METADATA_TEXT_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2) {
      try {
        return JSON.stringify(value).slice(0, MAX_METADATA_TEXT_LENGTH);
      } catch {
        return String(value).slice(0, MAX_METADATA_TEXT_LENGTH);
      }
    }
    const output: JsonObject = {};
    const entries = Object.entries(value as JsonObject).slice(0, MAX_METADATA_NESTED_ENTRIES);
    for (const [key, nestedValue] of entries) {
      if (!key.trim()) continue;
      output[key] = sanitizeMetadataValue(nestedValue, depth + 1);
    }
    return output;
  }

  return String(value).slice(0, MAX_METADATA_TEXT_LENGTH);
};

const sanitizeMetadata = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as JsonObject).slice(0, MAX_METADATA_ENTRIES);
  const output: JsonObject = {};
  for (const [key, raw] of entries) {
    if (!key.trim()) continue;
    output[key] = sanitizeMetadataValue(raw, 0);
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
  severity: AppErrorSeverity;
  route: string | null;
  statusCode: number | null;
  endpoint: string | null;
  message: string;
  stack: string | null;
  metadata: JsonObject;
}): boolean => {
  const metadata = sanitizeMetadata(params.metadata);
  const getMetadataText = (value: unknown): string[] => {
    if (typeof value === "string") return [value.toLowerCase()];
    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.toLowerCase());
    }
    return [];
  };
  const hostValues = getMetadataText(metadata.host);
  const appEnvironmentValues = getMetadataText(metadata.app_environment);
  const clientEnvironmentValues = getMetadataText(metadata.client_environment);
  const isLocalHost = hostValues.some(
    (host) => host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0")
  );
  const isDevelopmentClientEnvironment =
    appEnvironmentValues.includes("development") || clientEnvironmentValues.includes("development");
  const routeText = (params.route ?? "").toLowerCase();
  const isAiStudioRoute = routeText.includes("/ai-studio");
  const isAiStudioClientSource = params.source.startsWith("client.ai_studio.");
  const isServerFailure = params.statusCode !== null && params.statusCode >= 500;
  const isActionableLocalClientEvent =
    isAiStudioClientSource ||
    isAiStudioRoute ||
    params.scope === "generation" ||
    params.severity === "high" ||
    isServerFailure;

  // Local development client telemetry is useful in browser/devtools, but it should not pollute
  // operator-facing incident queues. Keep actionable AI Studio/runtime failures visible.
  if (
    params.source.startsWith("client.") &&
    isLocalHost &&
    isDevelopmentClientEnvironment &&
    !isActionableLocalClientEvent
  ) {
    return true;
  }

  const stackText = (params.stack ?? "").toLowerCase();
  const messageText = params.message.toLowerCase();
  const hasReactRefreshFrames =
    stackText.includes("performreactrefresh") ||
    stackText.includes("schedulerefresh") ||
    stackText.includes("react-refresh");
  const isReferenceNameError = /is not defined/.test(messageText);

  if (
    params.source.startsWith("client.") &&
    isReferenceNameError &&
    hasReactRefreshFrames &&
    (isDevelopmentClientEnvironment || process.env.NODE_ENV === "development") &&
    !isActionableLocalClientEvent
  ) {
    return true;
  }

  if (params.endpoint?.includes("/api/log/client-error")) return true;
  if (params.statusCode !== null) {
    if (params.scope === "app" && params.statusCode < 400) return true;
    if (
      params.scope === "generation" &&
      params.statusCode < 400 &&
      !isTelemetrySource(params.source)
    ) {
      return true;
    }
  }
  if (
    params.scope === "app" &&
    params.source === "client.api_network" &&
    /aborterror|aborted/i.test(params.message)
  ) {
    return true;
  }
  return false;
};

const requestHeaderValue = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") return toTrimmedString(value);
  if (Array.isArray(value) && value[0]) return toTrimmedString(value[0]);
  return null;
};

const reportSupabaseUnavailable = (reason: unknown) => {
  if (process.env.NODE_ENV === "test") return;
  if (warnedSupabaseUnavailable) return;
  warnedSupabaseUnavailable = true;
  if (reason instanceof Error) {
    console.error("[appErrorLogs] Supabase admin unavailable for error logging", reason.message);
    return;
  }
  console.error("[appErrorLogs] Supabase admin unavailable for error logging");
};

const getTable = <T>(tableName: string): T | null => {
  try {
    const supabaseAdmin = getSupabaseAdmin() as { from?: (name: string) => unknown };
    if (typeof supabaseAdmin.from !== "function") {
      reportSupabaseUnavailable("missing from()");
      return null;
    }
    return supabaseAdmin.from(tableName) as T;
  } catch (error) {
    reportSupabaseUnavailable(error);
    return null;
  }
};

const getRequestHeader = (
  req: NextApiRequest | undefined,
  headerName: string
): string | string[] | undefined => {
  const headers = req && typeof req === "object" ? (req as { headers?: unknown }).headers : null;
  if (!headers || typeof headers !== "object") return undefined;
  return (headers as Record<string, string | string[] | undefined>)[headerName];
};

const jsonValueEquals = (left: unknown, right: unknown): boolean => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const mergeMetadataValue = (existingValue: unknown, incomingValue: unknown): unknown => {
  if (existingValue === undefined) return incomingValue;
  if (jsonValueEquals(existingValue, incomingValue)) return existingValue;

  const existingList = Array.isArray(existingValue) ? existingValue : [existingValue];
  const mergedList = [...existingList];
  const incomingList = Array.isArray(incomingValue) ? incomingValue : [incomingValue];

  for (const entry of incomingList) {
    const alreadyPresent = mergedList.some((current) => jsonValueEquals(current, entry));
    if (!alreadyPresent) {
      mergedList.push(entry);
    }
  }

  return mergedList.slice(0, 10);
};

const mergeIncidentMetadata = (existingRaw: unknown, incomingRaw: unknown): JsonObject => {
  const existing = sanitizeMetadata(existingRaw);
  const incoming = sanitizeMetadata(incomingRaw);
  const merged: JsonObject = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = mergeMetadataValue(merged[key], value);
  }
  return sanitizeMetadata(merged);
};

const resolveReleaseMetadata = (): JsonObject => {
  const release =
    toTrimmedString(process.env.SHORTPULSE_RELEASE, 120) ??
    toTrimmedString(process.env.VERCEL_GIT_COMMIT_SHA, 120) ??
    toTrimmedString(process.env.VERCEL_DEPLOYMENT_ID, 120) ??
    null;
  const branch =
    toTrimmedString(process.env.VERCEL_GIT_COMMIT_REF, 120) ??
    toTrimmedString(process.env.VERCEL_GIT_COMMIT_BRANCH, 120) ??
    null;
  const environment =
    toTrimmedString(process.env.VERCEL_ENV, 80) ??
    toTrimmedString(process.env.NODE_ENV, 80) ??
    null;
  const metadata: JsonObject = {
    app_release: release,
    app_branch: branch,
    app_environment: environment,
  };
  return sanitizeMetadata(metadata);
};

const writeAppErrorEvent = async (params: {
  source: string;
  fingerprint: string;
  scope: AppErrorScope;
  severity: AppErrorSeverity;
  message: string;
  stack: string | null;
  route: string | null;
  endpoint: string | null;
  requestId: string | null;
  statusCode: number | null;
  userId: string | null;
  userEmail: string | null;
  metadata: JsonObject;
  occurredAt: string;
}): Promise<string | null> => {
  try {
    const appErrorEventsTable = getTable<AppErrorEventsTable>("app_error_events");
    if (!appErrorEventsTable) return null;
    const { data, error } = await appErrorEventsTable
      .insert({
        fingerprint: params.fingerprint,
        source: params.source,
        scope: params.scope,
        severity: params.severity,
        message: params.message,
        stack: params.stack,
        route: params.route,
        endpoint: params.endpoint,
        request_id: params.requestId,
        http_status: params.statusCode,
        user_id: params.userId,
        user_email: params.userEmail,
        metadata: params.metadata,
        occurred_at: params.occurredAt,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[appErrorLogs] failed to insert error event", error.message);
      return null;
    }
    return (data?.id as string | undefined) ?? null;
  } catch (error) {
    console.error("[appErrorLogs] failed to write error event", error);
    return null;
  }
};

const attachEventToIncident = async (eventId: string | null, incidentId: string | null) => {
  if (!eventId || !incidentId) return;
  try {
    const appErrorEventsTable = getTable<AppErrorEventsTable>("app_error_events");
    if (!appErrorEventsTable) return;
    const { error } = await appErrorEventsTable
      .update({ incident_id: incidentId })
      .eq("id", eventId);
    if (error) {
      console.error("[appErrorLogs] failed to attach event to incident", error.message);
    }
  } catch (error) {
    console.error("[appErrorLogs] failed to attach event to incident", error);
  }
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
  const metadata = mergeIncidentMetadata(input.metadata, resolveReleaseMetadata());
  const userId = toTrimmedString(input.userId, 120);
  const userEmail = toTrimmedString(input.userEmail, 320);
  const occurredAt = normalizeOccurredAt(input.occurredAt) ?? new Date().toISOString();

  if (
    shouldSkipLog({
      scope,
      source,
      severity,
      route,
      statusCode,
      endpoint,
      message,
      stack,
      metadata,
    })
  ) {
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

  const eventId = await writeAppErrorEvent({
    source,
    fingerprint,
    scope,
    severity,
    message,
    stack,
    route,
    endpoint,
    requestId,
    statusCode,
    userId,
    userEmail,
    metadata,
    occurredAt,
  });

  if (isTelemetrySource(source)) {
    return { ok: true, skipped: false, id: null };
  }

  const appErrorLogsTable = getTable<AppErrorLogsTable>("app_error_logs");
  if (!appErrorLogsTable) {
    return { ok: false, skipped: false, id: null };
  }

  let existingQuery = appErrorLogsTable
    .select("id, occurrences_count, metadata")
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
    const mergedMetadata = mergeIncidentMetadata(existing.metadata, metadata);
    const { error: updateError } = await appErrorLogsTable
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
        metadata: mergedMetadata,
        user_email: userEmail,
      })
      .eq("id", existing.id);
    if (updateError) {
      console.error("[appErrorLogs] failed to update existing log", updateError.message);
      return { ok: false, skipped: false, id: null };
    }
    await attachEventToIncident(eventId, existing.id as string);
    return { ok: true, skipped: false, id: existing.id as string };
  }

  const { data: inserted, error: insertError } = await appErrorLogsTable
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

  const insertedId = (inserted?.id as string | undefined) ?? null;
  await attachEventToIncident(eventId, insertedId);
  return { ok: true, skipped: false, id: insertedId };
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
    const resolvedUser = user ?? (req ? await getOptionalApiUser(req) : null);
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown API exception");
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    const requestId = requestHeaderValue(getRequestHeader(req, "x-shortpulse-request-id"));

    await writeAppErrorLog({
      source: "api.exception",
      scope,
      severity: "high",
      message,
      stack,
      route: routeLabel,
      endpoint: req?.url ?? null,
      requestId,
      userId: resolvedUser?.id ?? null,
      userEmail: resolvedUser?.email ?? null,
      metadata: {
        method: req?.method ?? null,
        route_label: routeLabel,
        ...metadata,
      },
    });
  } catch (loggingError) {
    console.error("[appErrorLogs] API exception log write failed", loggingError);
  }
};

/**
 * Writes a handled generation/API failure without throwing.
 */
export const logGenerationFailure = async ({
  req,
  routeLabel,
  message,
  statusCode = null,
  source = "api.generation_failure",
  severity,
  stack = null,
  metadata = {},
  userId = null,
  userEmail = null,
}: GenerationFailureLogOptions): Promise<void> => {
  try {
    let resolvedUserId = toTrimmedString(userId, 120);
    let resolvedUserEmail = toTrimmedString(userEmail, 320);

    if (!resolvedUserId && !resolvedUserEmail && req) {
      const resolvedUser = await getOptionalApiUser(req);
      resolvedUserId = toTrimmedString(resolvedUser?.id, 120);
      resolvedUserEmail = toTrimmedString(resolvedUser?.email, 320);
    }

    const normalizedStatusCode = sanitizeStatusCode(statusCode);
    const resolvedSeverity =
      severity ??
      (normalizedStatusCode !== null && normalizedStatusCode >= 500 ? "high" : "medium");
    const requestId = requestHeaderValue(getRequestHeader(req, "x-shortpulse-request-id"));

    await writeAppErrorLog({
      source: toTrimmedString(source, 80) ?? "api.generation_failure",
      scope: "generation",
      severity: resolvedSeverity,
      message,
      stack,
      route: routeLabel,
      endpoint: req?.url ?? null,
      requestId,
      statusCode: normalizedStatusCode,
      userId: resolvedUserId,
      userEmail: resolvedUserEmail,
      metadata: {
        method: req?.method ?? null,
        route_label: routeLabel,
        ...metadata,
      },
    });
  } catch (loggingError) {
    console.error("[appErrorLogs] generation failure log write failed", loggingError);
  }
};
