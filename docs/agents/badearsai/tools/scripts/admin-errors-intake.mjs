#!/usr/bin/env node

/**
 * Badearsai Admin Errors helper.
 *
 * Defaults to read-only production queue readback using the same non-actionable
 * message filters as frontend/pages/api/admin/errors.ts. The update command
 * changes only one reviewed incident through the canonical
 * admin_update_app_error_status RPC and requires an explicit note.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../../../../scripts/lib/load_local_env.mjs";

const DEFAULT_ENV_FILES = [
  ".env.agent.local",
  "frontend/.vercel/.env.production.local",
  "frontend/.env.local",
  ".env.local",
];

const VALID_STATUSES = new Set(["open", "resolved", "ignored", "all"]);
const VALID_STATUS_WRITES = new Set(["open", "resolved", "ignored"]);
const MAX_LIMIT = 100;
const MAX_NOTE_LENGTH = 400;
const DEFAULT_ADMIN_USER_ID = "746a3c1a-4a1c-4223-9cc9-85b15c2ad5b5";
const DEFAULT_ADMIN_EMAIL = "badearsai@shortpulse.ai";

const ADMIN_QUEUE_NON_ACTIONABLE_MESSAGE_PATTERNS = [
  "%flagged%as%sensitive%",
  "%content%polic%",
  "%content%not%allowed%",
  "%unsafe%content%",
  "%safety%policy%",
  "%safety%system%",
  "%safety%filter%",
  "%Fetched%media%exceeds%size%limit%",
  "%layer%images%are%unavailable%",
  "%layer%images%expired%",
  "%API%429%response%from%/api/kie/upload-url%",
  "%API%429%response%from%/api/media/prepare-upload%",
  "%API%429%response%from%/api/media/finalize-upload%",
  "%reference%preparation%failed:%Too%many%requests%",
  "%too%many%active%generations%",
  "%max%active%generations%",
];

const usage = () => {
  console.log(`Usage:
  node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs queue [options]
  node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs status --incident <id> [--incident <id> ...] [options]
  node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs update --incident <id> --status <open|resolved|ignored> --note <text> [options]

Queue options:
  --status <value>           open | resolved | ignored | all. Default: open.
  --source <text>            Exact source filter.
  --endpoint <text>          Exact endpoint filter.
  --search <text>            Case-insensitive substring over message/email/route/endpoint/request/fingerprint.
  --limit <number>           Default: 20, max: 100.
  --include-non-actionable   Do not apply Admin Queue non-actionable message filters.
  --json                     Emit JSON.
  --show-identifiers         Print full emails/user ids. Default redacts them.
  --env-file <path>          Optional env file. Repeatable.

Status options:
  --incident <id>            Required. Repeatable.
  --json                     Emit JSON.
  --show-identifiers         Print full emails/user ids.

Update options:
  --incident <id>            Required app_error_logs incident id.
  --status <value>           Required: open | resolved | ignored.
  --note <text>              Required rationale, max 400 chars.
  --watch                    Requires --status resolved.
  --admin-id <uuid>          Defaults to Badearsai admin id.
  --admin-email <email>      Defaults to badearsai@shortpulse.ai.
  --json                     Emit JSON.

Required env:
  SHORTPULSE_PRODUCTION_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and
  SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY.

Secret values are never printed.`);
};

const parseArgs = (argv) => {
  const parsed = {
    command: "queue",
    incidents: [],
    status: "open",
    source: null,
    endpoint: null,
    search: null,
    limit: 20,
    includeNonActionable: false,
    json: false,
    showIdentifiers: false,
    note: null,
    watch: false,
    adminId: DEFAULT_ADMIN_USER_ID,
    adminEmail: DEFAULT_ADMIN_EMAIL,
    help: false,
  };

  if (argv[0] && !argv[0].startsWith("--")) {
    parsed.command = argv[0];
    argv = argv.slice(1);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    const requireValue = () => {
      if (!next || next.startsWith("--"))
        throw new Error(`${arg} requires a value.`);
      index += 1;
      return next;
    };

    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--incident" || arg === "--id")
      parsed.incidents.push(requireValue().trim());
    else if (arg === "--status")
      parsed.status = requireValue().trim().toLowerCase();
    else if (arg === "--source") parsed.source = requireValue().trim();
    else if (arg === "--endpoint") parsed.endpoint = requireValue().trim();
    else if (arg === "--search") parsed.search = requireValue().trim();
    else if (arg === "--limit")
      parsed.limit = Number.parseInt(requireValue(), 10);
    else if (arg === "--note") parsed.note = requireValue().trim();
    else if (arg === "--admin-id") parsed.adminId = requireValue().trim();
    else if (arg === "--admin-email") parsed.adminEmail = requireValue().trim();
    else if (arg === "--include-non-actionable")
      parsed.includeNonActionable = true;
    else if (arg === "--watch") parsed.watch = true;
    else if (arg === "--json") parsed.json = true;
    else if (arg === "--show-identifiers") parsed.showIdentifiers = true;
    else if (arg === "--env-file") requireValue();
    else throw new Error(`Unknown option: ${arg}`);
  }

  parsed.incidents = parsed.incidents.filter(Boolean);
  return parsed;
};

const normalizeSupabaseUrl = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\/+$/, "");

const readSupabaseConfig = () => {
  const supabaseUrl = normalizeSupabaseUrl(
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL,
  );
  const serviceRoleKey = String(
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "",
  ).trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase URL or service-role key. Load canonical local env; secret values are never printed.",
    );
  }
  if (!supabaseUrl.includes(".supabase.co")) {
    throw new Error(
      "Supabase URL appears invalid. Expected hosted Supabase URL.",
    );
  }
  return { supabaseUrl, serviceRoleKey };
};

const restHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const redactEmail = (email) => {
  const [local = "", domain = ""] = String(email ?? "").split("@");
  if (!local || !domain) return null;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
};

const redactId = (value) => {
  const text = String(value ?? "");
  if (text.length < 14) return text || null;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
};

const metadataObject = (metadata) =>
  metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};

const compactMetadata = (metadata) => {
  const value = metadataObject(metadata);
  return {
    keys: Object.keys(value).sort(),
    appRelease: value.app_release ?? null,
    clientRelease: value.client_release ?? null,
    buildId: value.build_id ?? null,
    sessionId: value.session_id ?? null,
    generation: {
      generationId:
        value.generation_id ?? value.generation?.generationId ?? null,
      outputId: value.output_id ?? value.generation?.outputId ?? null,
      provider: value.provider ?? value.generation?.provider ?? null,
      model: value.model ?? value.generation?.model ?? null,
      taskId: value.task_id ?? value.generation?.taskId ?? null,
      taskState: value.task_state ?? value.generation?.taskState ?? null,
      failureReasonCode:
        value.failure_reason_code ??
        value.generation?.failureReasonCode ??
        null,
    },
    exception: {
      name: value.exception_name ?? null,
      stage: value.stage ?? null,
      routeLabel: value.route_label ?? null,
      authVerificationUnavailable:
        value.request_auth_verification_unavailable ?? null,
    },
    watchItem:
      value.watch_item === true ||
      value.watch === true ||
      value.admin_watch_item === true,
  };
};

const normalizeRow = (row, options) => ({
  id: row.id,
  fingerprint: row.fingerprint,
  status: row.status,
  severity: row.severity,
  source: row.source,
  scope: row.scope,
  message: row.message,
  route: row.route,
  endpoint: row.endpoint,
  requestId: row.request_id,
  httpStatus: row.http_status,
  userId: options.showIdentifiers ? row.user_id : redactId(row.user_id),
  userEmail: options.showIdentifiers
    ? row.user_email
    : redactEmail(row.user_email),
  firstSeenAt: row.first_seen_at,
  lastSeenAt: row.last_seen_at,
  occurrencesCount: row.occurrences_count,
  updatedAt: row.updated_at,
  metadata: compactMetadata(row.metadata),
});

const appendQueueFilters = (url, args) => {
  url.searchParams.set(
    "select",
    [
      "id",
      "fingerprint",
      "source",
      "scope",
      "severity",
      "status",
      "message",
      "route",
      "endpoint",
      "request_id",
      "http_status",
      "user_id",
      "user_email",
      "metadata",
      "first_seen_at",
      "last_seen_at",
      "occurrences_count",
      "updated_at",
    ].join(","),
  );
  if (args.status !== "all")
    url.searchParams.set("status", `eq.${args.status}`);
  if (args.source) url.searchParams.set("source", `eq.${args.source}`);
  if (args.endpoint) url.searchParams.set("endpoint", `eq.${args.endpoint}`);
  if (args.search) {
    const pattern = `*${args.search.replace(/[,%()]/g, " ").replace(/\s+/g, "*")}*`;
    url.searchParams.set(
      "or",
      [
        `message.ilike.${pattern}`,
        `user_email.ilike.${pattern}`,
        `endpoint.ilike.${pattern}`,
        `route.ilike.${pattern}`,
        `request_id.ilike.${pattern}`,
        `source.ilike.${pattern}`,
        `fingerprint.ilike.${pattern}`,
      ].join(","),
    );
  }
  if (!args.includeNonActionable) {
    for (const pattern of ADMIN_QUEUE_NON_ACTIONABLE_MESSAGE_PATTERNS) {
      url.searchParams.append("message", `not.ilike.${pattern}`);
    }
  }
  url.searchParams.set("order", "last_seen_at.desc");
  url.searchParams.set("limit", String(args.limit));
};

const fetchRows = async (config, args) => {
  if (!VALID_STATUSES.has(args.status))
    throw new Error(`Invalid --status: ${args.status}`);
  if (
    !Number.isFinite(args.limit) ||
    args.limit < 1 ||
    args.limit > MAX_LIMIT
  ) {
    throw new Error(`--limit must be between 1 and ${MAX_LIMIT}.`);
  }

  const url = new URL(`${config.supabaseUrl}/rest/v1/app_error_logs`);
  appendQueueFilters(url, args);
  const response = await fetch(url, {
    headers: restHeaders(config.serviceRoleKey),
  });
  if (!response.ok) {
    throw new Error(
      `Admin Errors read failed: ${response.status} ${await response.text()}`,
    );
  }
  const rows = await response.json();
  if (!Array.isArray(rows))
    throw new Error("Admin Errors read returned a non-array payload.");
  return rows.map((row) => normalizeRow(row, args));
};

const fetchIncidentStatuses = async (config, args) => {
  if (!args.incidents.length)
    throw new Error("status requires --incident <id>.");
  const url = new URL(`${config.supabaseUrl}/rest/v1/app_error_logs`);
  url.searchParams.set(
    "select",
    "id,fingerprint,source,scope,severity,status,message,route,endpoint,request_id,http_status,user_id,user_email,metadata,first_seen_at,last_seen_at,occurrences_count,updated_at",
  );
  url.searchParams.set("id", `in.(${args.incidents.join(",")})`);
  url.searchParams.set("order", "last_seen_at.desc");
  const response = await fetch(url, {
    headers: restHeaders(config.serviceRoleKey),
  });
  if (!response.ok) {
    throw new Error(
      `Admin Errors status read failed: ${response.status} ${await response.text()}`,
    );
  }
  const rows = await response.json();
  if (!Array.isArray(rows))
    throw new Error("Status read returned a non-array payload.");
  return rows.map((row) => normalizeRow(row, args));
};

const truncateNote = (value) =>
  String(value ?? "")
    .trim()
    .slice(0, MAX_NOTE_LENGTH);

const updateIncident = async (config, args) => {
  if (args.incidents.length !== 1)
    throw new Error("update requires exactly one --incident <id>.");
  if (!VALID_STATUS_WRITES.has(args.status)) {
    throw new Error("update --status must be open, resolved, or ignored.");
  }
  if (args.watch && args.status !== "resolved") {
    throw new Error("--watch requires --status resolved.");
  }
  const note = truncateNote(args.note);
  if (!note)
    throw new Error(
      "update requires --note with the classification rationale.",
    );
  if (!args.adminId || !args.adminEmail) {
    throw new Error("update requires --admin-id and --admin-email.");
  }

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/rpc/admin_update_app_error_status`,
    {
      method: "POST",
      headers: restHeaders(config.serviceRoleKey),
      body: JSON.stringify({
        p_error_id: args.incidents[0],
        p_event_id: null,
        p_status: args.status,
        p_note: note,
        p_admin_user_id: args.adminId,
        p_admin_user_email: args.adminEmail,
        p_watch_item: args.watch,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Admin Errors update failed: ${response.status} ${await response.text()}`,
    );
  }
  const payload = await response.json();
  const normalized = Array.isArray(payload) ? payload[0] : payload;
  if (!normalized?.incident_id)
    throw new Error("Status RPC returned no incident id.");
  return normalized;
};

const printTextRows = (rows, label) => {
  console.log(`Badearsai Admin Errors ${label}: ${rows.length} row(s)`);
  for (const row of rows) {
    console.log("");
    console.log(`- ${row.id}`);
    console.log(
      `  status: ${row.status}${row.metadata.watchItem ? " watch=true" : ""}; severity: ${row.severity}; source: ${row.source}`,
    );
    console.log(
      `  message: ${String(row.message ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 220)}`,
    );
    console.log(`  route: ${row.route ?? "(none)"}`);
    console.log(`  endpoint: ${row.endpoint ?? "(none)"}`);
    console.log(
      `  request_id: ${row.requestId ?? "(none)"}; http_status: ${row.httpStatus ?? "(none)"}`,
    );
    console.log(
      `  user: ${row.userEmail ?? "(unknown)"}; occurrences: ${row.occurrencesCount}`,
    );
    console.log(
      `  seen: ${row.firstSeenAt ?? "(unknown)"} -> ${row.lastSeenAt ?? "(unknown)"}`,
    );
    console.log(
      `  release: app=${row.metadata.appRelease ?? "(unknown)"}; client=${row.metadata.clientRelease ?? "(unknown)"}; build=${row.metadata.buildId ?? "(unknown)"}`,
    );
    const generation = row.metadata.generation;
    const generationBits = [
      generation.provider ? `provider=${generation.provider}` : null,
      generation.model ? `model=${generation.model}` : null,
      generation.generationId ? `generation=${generation.generationId}` : null,
      generation.outputId ? `output=${generation.outputId}` : null,
      generation.taskId ? `task=${generation.taskId}` : null,
      generation.taskState ? `task_state=${generation.taskState}` : null,
      generation.failureReasonCode
        ? `reason=${generation.failureReasonCode}`
        : null,
    ].filter(Boolean);
    if (generationBits.length)
      console.log(`  generation: ${generationBits.join("; ")}`);
    const exception = row.metadata.exception;
    const exceptionBits = [
      exception.name ? `name=${exception.name}` : null,
      exception.stage ? `stage=${exception.stage}` : null,
      exception.routeLabel ? `route_label=${exception.routeLabel}` : null,
      exception.authVerificationUnavailable
        ? `auth_unavailable=${exception.authVerificationUnavailable}`
        : null,
    ].filter(Boolean);
    if (exceptionBits.length)
      console.log(`  exception: ${exceptionBits.join("; ")}`);
    console.log(`  metadata_keys: ${row.metadata.keys.join(", ") || "(none)"}`);
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: DEFAULT_ENV_FILES,
  });
  const config = readSupabaseConfig();

  if (args.command === "queue" || args.command === "list") {
    const rows = await fetchRows(config, args);
    if (args.json) console.log(JSON.stringify({ rows }, null, 2));
    else printTextRows(rows, "queue");
    return;
  }

  if (args.command === "status") {
    const rows = await fetchIncidentStatuses(config, args);
    if (args.json) console.log(JSON.stringify({ rows }, null, 2));
    else printTextRows(rows, "status");
    return;
  }

  if (args.command === "update") {
    const result = await updateIncident(config, args);
    if (args.json) console.log(JSON.stringify({ ok: true, result }, null, 2));
    else {
      console.log(
        `Updated ${result.incident_id}: status=${result.status}; watch=${args.watch ? "true" : "false"}`,
      );
    }
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `[badearsai-admin-errors] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}

export {
  ADMIN_QUEUE_NON_ACTIONABLE_MESSAGE_PATTERNS,
  appendQueueFilters,
  compactMetadata,
  normalizeRow,
};
