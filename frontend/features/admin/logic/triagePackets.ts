/**
 * Builds compact, stable clipboard payloads for admin incident triage.
 */

import type { AdminErrorEventRow, AdminErrorLogRow } from "../types";

const MAX_BREADCRUMBS = 12;
const MAX_BREADCRUMB_DATA_CHARS = 400;
const MAX_STACK_CHARS = 8000;
const MAX_COMPONENT_STACK_CHARS = 4000;

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
  breadcrumbs: TriageBreadcrumb[];
  metadataKeys: string[];
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
    breadcrumbs,
    metadataKeys: Object.keys(raw).sort(),
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
