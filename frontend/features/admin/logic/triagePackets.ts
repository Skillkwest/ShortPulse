/**
 * Builds compact, stable clipboard payloads for admin incident triage.
 */

import type { AdminErrorEventRow, AdminErrorLogRow } from "../types";

const MAX_BREADCRUMBS = 12;
const MAX_BREADCRUMB_DATA_CHARS = 400;
const MAX_STACK_CHARS = 8000;
const MAX_COMPONENT_STACK_CHARS = 4000;
const MAX_TRIAGE_VALUE_CHARS = 400;
const MAX_TRIAGE_KEY_CHARS = 120;
const MAX_TRIAGE_KEYS = 40;

type TriageBreadcrumb = {
  t: number | null;
  type: string | null;
  level: string | null;
  message: string | null;
  data: string | null;
};

type TriageMetadata = {
  host: string | null;
  method: string | null;
  filename: string | null;
  lineno: number | null;
  colno: number | null;
  buildId: string | null;
  appRelease: string | null;
  appEnvironment: string | null;
  clientRelease: string | null;
  clientEnvironment: string | null;
  sessionId: string | null;
  visibilityState: string | null;
  userAgent: string | null;
  reactComponentStack: string | null;
  generation: TriageGenerationMetadata | null;
  breadcrumbs: TriageBreadcrumb[];
  metadataKeys: string[];
};

type TriageGenerationMetadata = {
  outputId: string | null;
  model: string | null;
  modelId: string | null;
  provider: string | null;
  taskId: string | null;
  taskState: string | null;
  generationId: string | null;
  failureReasonCode: string | null;
  providerState: string | null;
  pollAttempt: number | null;
  noMediaAttempt: number | null;
  elapsedMs: number | null;
  maxWaitMs: number | null;
  errorPayload: TriageErrorPayloadSummary | null;
};

type TriageErrorPayloadSummary = {
  status: string | null;
  state: string | null;
  code: string | null;
  errorCode: string | null;
  error: string | null;
  failCode: string | null;
  failMsg: string | null;
  keys: string[];
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  return value;
};

const truncate = (value: string | null, maxLength: number): string | null => {
  if (!value) return null;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
};

const asTriageString = (value: unknown): string | null =>
  truncate(asString(value), MAX_TRIAGE_VALUE_CHARS);

const extractKeyNames = (record: Record<string, unknown>): string[] =>
  Object.keys(record)
    .sort()
    .slice(0, MAX_TRIAGE_KEYS)
    .map((key) => truncate(key, MAX_TRIAGE_KEY_CHARS) ?? "");

const extractErrorPayloadSummary = (value: unknown): TriageErrorPayloadSummary | null => {
  const raw = asRecord(value);
  if (!raw) return null;
  const nestedError = asRecord(raw.error);
  const summary: TriageErrorPayloadSummary = {
    status: asTriageString(raw.status),
    state: asTriageString(raw.state),
    code: asTriageString(raw.code),
    errorCode: asTriageString(raw.error_code) ?? asTriageString(raw.errorCode),
    error:
      asTriageString(raw.error) ??
      asTriageString(nestedError?.message) ??
      asTriageString(nestedError?.code),
    failCode: asTriageString(raw.failCode) ?? asTriageString(raw.fail_code),
    failMsg: asTriageString(raw.failMsg) ?? asTriageString(raw.fail_msg),
    keys: extractKeyNames(raw),
  };
  const hasValue = Object.entries(summary).some(([key, entry]) =>
    key === "keys" ? Array.isArray(entry) && entry.length > 0 : entry !== null
  );
  return hasValue ? summary : null;
};

const extractGenerationMetadata = (
  metadata: Record<string, unknown>
): TriageGenerationMetadata | null => {
  const generation: TriageGenerationMetadata = {
    outputId: asTriageString(metadata.output_id),
    model: asTriageString(metadata.model),
    modelId: asTriageString(metadata.model_id),
    provider: asTriageString(metadata.provider),
    taskId: asTriageString(metadata.task_id),
    taskState: asTriageString(metadata.task_state),
    generationId: asTriageString(metadata.generation_id),
    failureReasonCode: asTriageString(metadata.failure_reason_code),
    providerState: asTriageString(metadata.provider_state),
    pollAttempt: asFiniteNumber(metadata.poll_attempt),
    noMediaAttempt: asFiniteNumber(metadata.no_media_attempt),
    elapsedMs: asFiniteNumber(metadata.elapsed_ms),
    maxWaitMs: asFiniteNumber(metadata.max_wait_ms),
    errorPayload: extractErrorPayloadSummary(metadata.error_payload),
  };
  const hasValue = Object.values(generation).some((entry) => entry !== null);
  return hasValue ? generation : null;
};

const normalizeBreadcrumb = (value: unknown): TriageBreadcrumb | null => {
  const raw = asRecord(value);
  if (!raw) return null;
  const breadcrumb: TriageBreadcrumb = {
    t: asFiniteNumber(raw.t),
    type: asString(raw.type),
    level: asString(raw.level),
    message: asString(raw.message),
    data: truncate(asString(raw.data), MAX_BREADCRUMB_DATA_CHARS),
  };
  const hasValue = Object.values(breadcrumb).some((entry) => entry !== null);
  return hasValue ? breadcrumb : null;
};

const extractTriageMetadata = (metadata: Record<string, unknown> | null): TriageMetadata => {
  const raw = asRecord(metadata) ?? {};
  const breadcrumbRows = Array.isArray(raw.breadcrumbs) ? raw.breadcrumbs : [];
  const breadcrumbs = breadcrumbRows
    .map((entry) => normalizeBreadcrumb(entry))
    .filter((entry): entry is TriageBreadcrumb => Boolean(entry))
    .slice(-MAX_BREADCRUMBS);

  return {
    host: asString(raw.host),
    method: asString(raw.method),
    filename: asString(raw.filename),
    lineno: asFiniteNumber(raw.lineno),
    colno: asFiniteNumber(raw.colno),
    buildId: asString(raw.build_id),
    appRelease: asString(raw.app_release),
    appEnvironment: asString(raw.app_environment),
    clientRelease: asString(raw.client_release),
    clientEnvironment: asString(raw.client_environment),
    sessionId: asString(raw.session_id),
    visibilityState: asString(raw.visibility_state),
    userAgent: asString(raw.user_agent),
    reactComponentStack: truncate(asString(raw.react_component_stack), MAX_COMPONENT_STACK_CHARS),
    generation: extractGenerationMetadata(raw),
    breadcrumbs,
    metadataKeys: extractKeyNames(raw),
  };
};

/**
 * Build a compact grouped-incident packet for operator handoff and chat triage.
 */
export const buildIncidentTriagePacket = (row: AdminErrorLogRow): string =>
  JSON.stringify(
    {
      shortpulseIncidentVersion: 3,
      packetType: "triage",
      copiedAt: new Date().toISOString(),
      incident: {
        id: row.id,
        fingerprint: row.fingerprint,
        status: row.status,
        severity: row.severity,
        source: row.source,
        scope: row.scope,
        message: row.message,
        stack: truncate(row.stack, MAX_STACK_CHARS),
        route: row.route,
        endpoint: row.endpoint,
        requestId: row.requestId,
        httpStatus: row.httpStatus,
        userId: row.userId,
        userEmail: row.userEmail,
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        occurrencesCount: row.occurrencesCount,
        triage: extractTriageMetadata(row.metadata),
      },
    },
    null,
    2
  );

/**
 * Build a compact single-event packet for operator handoff and chat triage.
 */
export const buildEventTriagePacket = (row: AdminErrorEventRow): string =>
  JSON.stringify(
    {
      shortpulseEventVersion: 2,
      packetType: "triage",
      copiedAt: new Date().toISOString(),
      event: {
        id: row.id,
        incidentId: row.incidentId,
        incidentStatus: row.incidentStatus,
        fingerprint: row.fingerprint,
        source: row.source,
        scope: row.scope,
        severity: row.severity,
        message: row.message,
        stack: truncate(row.stack, MAX_STACK_CHARS),
        route: row.route,
        endpoint: row.endpoint,
        requestId: row.requestId,
        httpStatus: row.httpStatus,
        userId: row.userId,
        userEmail: row.userEmail,
        occurredAt: row.occurredAt,
        createdAt: row.createdAt,
        triage: extractTriageMetadata(row.metadata),
      },
    },
    null,
    2
  );
