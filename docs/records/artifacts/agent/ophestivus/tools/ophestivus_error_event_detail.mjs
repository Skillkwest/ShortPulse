#!/usr/bin/env node
/* global console */

/**
 * Ophestivus Admin Errors event-detail helper.
 *
 * Reads the latest event details for an incident or ticket and prints a
 * redacted stack/metadata summary for root-cause inspection.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "../../../../../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "../../../../../../scripts/lib/load_local_env.mjs";

const INCIDENT_SELECT_COLUMNS =
  "id,fingerprint,source,scope,severity,status,message,route,endpoint,first_seen_at,last_seen_at,occurrences_count";
const EVENT_SELECT_COLUMNS =
  "id,incident_id,fingerprint,source,scope,severity,message,stack,route,endpoint,request_id,http_status,metadata,occurred_at,created_at";
const TICKET_SELECT_COLUMNS = "id,title,details,status,updated_at,archived_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INCIDENT_ID_PATTERN =
  /Incident:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const DEFAULT_EVENT_LIMIT = 3;
const DEFAULT_STACK_LINES = 8;

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:error-event-detail -- --incident <incident-id>",
      "  npm run ophestivus:error-event-detail -- --ticket <ticket-id>",
      "",
      "Options:",
      "  --incident <id>       Read latest events for an incident.",
      "  --ticket <id>         Read incident id from a board ticket, then read latest events.",
      "  --limit <number>      Number of latest events to print. Defaults to 3.",
      "  --stack-lines <n>     Redacted stack lines per event. Defaults to 8.",
      "  --json                Print JSON only.",
      "  --env-file <path>     Load an explicit env file. Can be repeated.",
      "  --help                Show this help.",
      "",
      "Required env:",
      "  NEXT_PUBLIC_SUPABASE_URL",
      "  SUPABASE_SERVICE_ROLE_KEY",
    ].join("\n")
  );
};

const hasFlag = (flag) => process.argv.includes(flag);

const readOption = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
};

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const normalizePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : fallback;
};

const normalizeText = (value, maxLength = 400) => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
};

const redactText = (value, maxLength = 800) => {
  const text = normalizeText(value, maxLength);
  if (!text) return null;
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\bBearer\s+[^?&\s]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:access_token|token|key|apikey|api_key|secret)=)[^&\s]+/gi, "$1[redacted]")
    .replace(
      /((?:access_token|token|key|apikey|api_key|secret)[=:]\s*)[^\s,;}&]+/gi,
      "$1[redacted]"
    );
};

const redactedStackLines = (stack, maxLines = DEFAULT_STACK_LINES) => {
  if (typeof stack !== "string") return [];
  return stack
    .split("\n")
    .map((line) => redactText(line, 500))
    .filter(Boolean)
    .slice(0, maxLines);
};

const parseBreadcrumbData = (value) => {
  if (!value || typeof value !== "object") return {};
  const data = value.data;
  if (typeof data !== "string") return {};
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const summarizeBreadcrumbs = (metadata) => {
  if (!metadata || typeof metadata !== "object" || !Array.isArray(metadata.breadcrumbs)) return [];

  return metadata.breadcrumbs.slice(-5).map((breadcrumb) => {
    const data = parseBreadcrumbData(breadcrumb);
    return {
      type: normalizeText(breadcrumb.type, 80),
      level: normalizeText(breadcrumb.level, 80),
      message: normalizeText(breadcrumb.message, 120),
      endpoint: redactText(data.endpoint, 240),
      method: normalizeText(data.method, 20),
      status: typeof data.status === "number" ? data.status : null,
      durationMs: typeof data.duration_ms === "number" ? data.duration_ms : null,
    };
  });
};

const redactedMetadataSummary = (metadata) => {
  if (!metadata || typeof metadata !== "object") {
    return {
      host: null,
      appEnvironment: null,
      clientEnvironment: null,
      visibilityState: null,
      buildId: null,
      filename: null,
      release: null,
      branch: null,
      breadcrumbCount: 0,
      breadcrumbs: [],
    };
  }

  return {
    host: normalizeText(metadata.host, 160),
    appEnvironment: normalizeText(metadata.app_environment, 80),
    clientEnvironment: normalizeText(metadata.client_environment, 80),
    visibilityState: normalizeText(metadata.visibility_state, 40),
    buildId: normalizeText(metadata.build_id, 120),
    filename: redactText(metadata.filename, 280),
    release:
      normalizeText(metadata.client_release, 120) ?? normalizeText(metadata.app_release, 120),
    branch: normalizeText(metadata.app_branch, 120),
    breadcrumbCount: Array.isArray(metadata.breadcrumbs) ? metadata.breadcrumbs.length : 0,
    breadcrumbs: summarizeBreadcrumbs(metadata),
  };
};

const toIncident = (incident) => ({
  id: incident.id,
  fingerprint: incident.fingerprint,
  source: incident.source,
  scope: incident.scope,
  severity: incident.severity,
  status: incident.status,
  message: incident.message,
  route: incident.route,
  endpoint: incident.endpoint,
  firstSeenAt: incident.first_seen_at,
  lastSeenAt: incident.last_seen_at,
  hits: incident.occurrences_count ?? 0,
});

const toTicket = (ticket) => ({
  id: ticket.id,
  title: ticket.title,
  details: ticket.details ?? "",
  status: ticket.status,
  updatedAt: ticket.updated_at,
  archivedAt: ticket.archived_at ?? null,
});

const toEventDetail = (event, { stackLines }) => ({
  id: event.id,
  incidentId: event.incident_id,
  fingerprint: event.fingerprint,
  source: event.source,
  scope: event.scope,
  severity: event.severity,
  message: redactText(event.message, 600),
  route: redactText(event.route, 300),
  endpoint: redactText(event.endpoint, 300),
  requestId: normalizeText(event.request_id, 120),
  httpStatus: event.http_status ?? null,
  occurredAt: event.occurred_at,
  createdAt: event.created_at,
  stackFirstLines: redactedStackLines(event.stack, stackLines),
  metadata: redactedMetadataSummary(event.metadata),
});

const parseIncidentIdFromDetails = (details) => {
  const match = String(details ?? "").match(INCIDENT_ID_PATTERN);
  return match?.[1] ?? null;
};

const readTicket = async (supabase, ticketId) => {
  const { data, error } = await supabase
    .from("admin_kanban_items")
    .select(TICKET_SELECT_COLUMNS)
    .eq("id", ticketId)
    .maybeSingle();

  if (error) throw error;
  return data ? toTicket(data) : null;
};

const readIncidentById = async (supabase, incidentId) => {
  const { data, error } = await supabase
    .from("app_error_logs")
    .select(INCIDENT_SELECT_COLUMNS)
    .eq("id", incidentId)
    .maybeSingle();

  if (error) throw error;
  return data ? toIncident(data) : null;
};

const readLatestEvents = async (supabase, incidentId, limit) => {
  const { data, error } = await supabase
    .from("app_error_events")
    .select(EVENT_SELECT_COLUMNS)
    .eq("incident_id", incidentId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
};

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:error-event-detail] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log("[ophestivus:error-event-detail] read_error_event_detail");
  if (payload.ticket) {
    console.log(`Ticket: ${payload.ticket.id} (${payload.ticket.status})`);
    console.log(`Title: ${payload.ticket.title}`);
  }
  console.log(`Incident: ${payload.incident.id} (${payload.incident.status})`);
  console.log(`Fingerprint: ${payload.incident.fingerprint}`);
  console.log(`Latest events: ${payload.events.length}`);

  for (const event of payload.events) {
    console.log("");
    console.log(`Event: ${event.id}`);
    console.log(`Occurred: ${event.occurredAt}`);
    console.log(`Source: ${event.source} / ${event.scope} / ${event.severity}`);
    console.log(`Route: ${event.route ?? "n/a"}`);
    console.log(`Endpoint: ${event.endpoint ?? "n/a"}`);
    console.log(`Message: ${event.message ?? "n/a"}`);
    console.log(
      `Environment: host=${event.metadata.host ?? "n/a"} client=${event.metadata.clientEnvironment ?? "n/a"} app=${event.metadata.appEnvironment ?? "n/a"} visibility=${event.metadata.visibilityState ?? "n/a"} build=${event.metadata.buildId ?? "n/a"}`
    );
    if (event.stackFirstLines.length) {
      console.log("Stack:");
      for (const line of event.stackFirstLines) console.log(`  ${line}`);
    }
    if (event.metadata.breadcrumbs.length) {
      console.log(`Breadcrumbs: ${event.metadata.breadcrumbCount} total; showing latest ${event.metadata.breadcrumbs.length}.`);
    }
  }

  if (payload.nextAction) console.log(`Next: ${payload.nextAction}`);
};

const run = async () => {
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const incidentArg = readOption("--incident");
  const ticketArg = readOption("--ticket");
  const limit = normalizePositiveInteger(readOption("--limit"), DEFAULT_EVENT_LIMIT);
  const stackLines = normalizePositiveInteger(readOption("--stack-lines"), DEFAULT_STACK_LINES);

  if (incidentArg && !UUID_PATTERN.test(incidentArg)) {
    throw new Error("--incident must be a UUID.");
  }
  if (ticketArg && !UUID_PATTERN.test(ticketArg)) {
    throw new Error("--ticket must be a UUID.");
  }
  if (!incidentArg && !ticketArg) {
    throw new Error("Provide --incident <id> or --ticket <id>.");
  }

  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: ["../.env.agent.local", ".env.development.local", ".env.local", "../.env.local"],
  });

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const ticket = ticketArg ? await readTicket(supabase, ticketArg) : null;
  if (ticketArg && !ticket) throw new Error(`Ticket not found: ${ticketArg}`);

  const incidentId = incidentArg ?? parseIncidentIdFromDetails(ticket?.details);
  if (!incidentId) {
    throw new Error("Ticket details do not include an Incident: <uuid> line.");
  }

  const [incident, rawEvents] = await Promise.all([
    readIncidentById(supabase, incidentId),
    readLatestEvents(supabase, incidentId, limit),
  ]);

  if (!incident) throw new Error(`Incident not found: ${incidentId}`);

  const events = rawEvents.map((event) => toEventDetail(event, { stackLines }));

  emit(
    {
      ok: true,
      status: "read_error_event_detail",
      ticket,
      incident,
      events,
      nextAction:
        events.length > 0
          ? "Use redacted stack/metadata as root-cause evidence; verify recurrence separately with ophestivus:error-status."
          : "No events found for this incident; inspect the incident row and admin error ingestion path.",
    },
    { jsonOnly }
  );
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run().catch((error) => {
    emit(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        nextAction:
          "Fix the input or environment, then rerun npm run ophestivus:error-event-detail.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export {
  parseIncidentIdFromDetails,
  redactText,
  redactedMetadataSummary,
  redactedStackLines,
  toEventDetail,
};
