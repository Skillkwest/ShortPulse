#!/usr/bin/env node

/**
 * Badearsai crash-log helper.
 *
 * Defaults to read-only listing of production browser crash-session rows.
 * The review command updates only review fields on one row after SOP
 * classification.
 */

import process from "node:process";
import { loadLocalEnv } from "../../../../../scripts/lib/load_local_env.mjs";

const DEFAULT_ENV_FILES = [
  "frontend/.vercel/.env.production.local",
  "frontend/.env.local",
  ".env.local",
];

const SELECT_COLUMNS = [
  "id",
  "browser_session_id",
  "user_id",
  "user_email",
  "status",
  "confidence",
  "last_event",
  "route",
  "build_id",
  "client_release",
  "client_environment",
  "user_agent",
  "host",
  "vercel_id",
  "metadata",
  "review_status",
  "reviewed_at",
  "reviewed_by",
  "reviewed_by_email",
  "review_note",
  "started_at",
  "last_seen_at",
  "ended_at",
  "suspected_at",
  "created_at",
  "updated_at",
].join(",");

const VALID_STATUSES = new Set([
  "all",
  "needs_review",
  "active",
  "clean_closed",
  "possible_ungraceful_exit",
  "probable_freeze_or_crash",
  "confirmed_crash",
]);
const VALID_REVIEW_STATUSES = new Set([
  "open",
  "resolved",
  "ignored",
  "reviewed",
  "all",
]);
const VALID_REVIEW_WRITES = new Set(["open", "resolved", "ignored"]);
const STALE_AFTER_MS = 10 * 60 * 1000;

const usage = () => {
  console.log(`Usage:
  node docs/agents/badearsai/tools/scripts/crash-log-intake.mjs list [options]
  node docs/agents/badearsai/tools/scripts/crash-log-intake.mjs review --session <id> --status <open|resolved|ignored> --note <text> --reviewer-email <email> [options]

List options:
  --status <value>           all | needs_review | active | clean_closed | possible_ungraceful_exit | probable_freeze_or_crash | confirmed_crash
                             Default: needs_review
  --review-status <value>    open | resolved | ignored | reviewed | all. Default: open
  --session <id>             Filter to one browser_crash_sessions row id.
  --route <text>             Case-insensitive route substring.
  --limit <number>           Default: 20, max: 100.
  --json                     Emit JSON.
  --show-identifiers         Print full emails/session ids/user ids. Default redacts them.
  --env-file <path>          Optional env file. Repeatable.

Review options:
  --session <id>             Required browser_crash_sessions row id.
  --status <value>           Required: open | resolved | ignored.
  --note <text>              Required review rationale, max 400 chars.
  --reviewer-email <email>   Required reviewer/operator email for audit field.
  --reviewer-id <uuid>       Optional auth user id for audit field.
  --json                     Emit JSON.

Required env:
  SHORTPULSE_PRODUCTION_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and
  SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY.

Secret values are never printed.`);
};

const parseArgs = (argv) => {
  const parsed = {
    command: "list",
    status: "needs_review",
    reviewStatus: "open",
    session: null,
    route: null,
    limit: 20,
    json: false,
    showIdentifiers: false,
    note: null,
    reviewerEmail: null,
    reviewerId: null,
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
    else if (arg === "--status") parsed.status = requireValue().trim();
    else if (arg === "--review-status")
      parsed.reviewStatus = requireValue().trim();
    else if (arg === "--session" || arg === "--id")
      parsed.session = requireValue().trim();
    else if (arg === "--route") parsed.route = requireValue().trim();
    else if (arg === "--limit")
      parsed.limit = Number.parseInt(requireValue(), 10);
    else if (arg === "--note") parsed.note = requireValue().trim();
    else if (arg === "--reviewer-email")
      parsed.reviewerEmail = requireValue().trim();
    else if (arg === "--reviewer-id") parsed.reviewerId = requireValue().trim();
    else if (arg === "--json") parsed.json = true;
    else if (arg === "--show-identifiers") parsed.showIdentifiers = true;
    else if (arg === "--env-file") requireValue();
    else throw new Error(`Unknown option: ${arg}`);
  }

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

const numberOrNull = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const metadataSummary = (metadata) => {
  const value =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  return {
    keys: Object.keys(value).sort(),
    pressure: {
      level: numberOrNull(value.pressure_level),
      maxLevel: numberOrNull(value.max_pressure_level),
      eventCount: numberOrNull(value.pressure_event_count),
      heapUsedToLimitRatio: numberOrNull(value.heap_used_to_limit_ratio),
      maxHeapUsedToLimitRatio: numberOrNull(value.max_heap_used_to_limit_ratio),
      heapUsedToTotalRatio: numberOrNull(value.heap_used_to_total_ratio),
      maxHeapUsedToTotalRatio: numberOrNull(value.max_heap_used_to_total_ratio),
      longTaskP95Ms: numberOrNull(value.long_task_p95_ms),
      maxInputStallMs: numberOrNull(value.max_input_stall_ms),
      stallDurationMs: numberOrNull(value.stall_duration_ms),
    },
    crashReport: {
      source: value.crash_report_source ?? null,
      type: value.crash_report_type ?? null,
      reason: value.crash_report_reason ?? null,
      urlPath: value.crash_report_url_path ?? null,
      ageMs: numberOrNull(value.crash_report_age_ms),
      visibilityState: value.crash_report_visibility_state ?? null,
      isTopLevel:
        typeof value.crash_report_is_top_level === "boolean"
          ? value.crash_report_is_top_level
          : null,
    },
    lifecycle: {
      visibilityState: value.visibility_state ?? null,
      documentHidden:
        typeof value.document_hidden === "boolean"
          ? value.document_hidden
          : null,
      documentWasDiscarded:
        typeof value.document_was_discarded === "boolean"
          ? value.document_was_discarded
          : null,
      lastHeartbeatAgeMs: numberOrNull(value.last_heartbeat_age_ms),
      statusReason: value.status_reason ?? null,
      previousLastSeenAt: value.previous_last_seen_at ?? null,
    },
  };
};

const effectiveStatus = (row) => {
  const lastSeenMs = row.last_seen_at
    ? new Date(row.last_seen_at).getTime()
    : Number.NaN;
  const isStale =
    row.status === "active" &&
    Number.isFinite(lastSeenMs) &&
    Date.now() - lastSeenMs > STALE_AFTER_MS;
  return {
    effectiveStatus: isStale ? "possible_ungraceful_exit" : row.status,
    effectiveConfidence: isStale ? "low" : row.confidence,
    isStale,
  };
};

const normalizeRow = (row, options) => ({
  id: row.id,
  browserSessionId: options.showIdentifiers
    ? row.browser_session_id
    : redactId(row.browser_session_id),
  userId: options.showIdentifiers ? row.user_id : redactId(row.user_id),
  userEmail: options.showIdentifiers
    ? row.user_email
    : redactEmail(row.user_email),
  status: row.status,
  confidence: row.confidence,
  ...effectiveStatus(row),
  lastEvent: row.last_event,
  route: row.route,
  buildId: row.build_id,
  clientRelease: row.client_release,
  clientEnvironment: row.client_environment,
  reviewStatus: row.review_status,
  reviewedAt: row.reviewed_at,
  reviewedByEmail: options.showIdentifiers
    ? row.reviewed_by_email
    : redactEmail(row.reviewed_by_email),
  reviewNote: row.review_note,
  timeline: {
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    endedAt: row.ended_at,
    suspectedAt: row.suspected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  },
  request: {
    host: row.host,
    vercelId: row.vercel_id,
    userAgent: row.user_agent,
  },
  metadata: metadataSummary(row.metadata),
});

const appendFilter = (url, key, value) => {
  url.searchParams.append(key, value);
};

const buildListUrl = ({ config, args }) => {
  const url = new URL(`${config.supabaseUrl}/rest/v1/browser_crash_sessions`);
  url.searchParams.set("select", SELECT_COLUMNS);
  url.searchParams.set("order", "last_seen_at.desc");
  url.searchParams.set("limit", String(args.limit));

  if (args.session) appendFilter(url, "id", `eq.${args.session}`);
  if (args.status === "needs_review") {
    appendFilter(
      url,
      "status",
      "in.(probable_freeze_or_crash,confirmed_crash)",
    );
  } else if (args.status === "possible_ungraceful_exit") {
    const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    url.searchParams.set(
      "or",
      `(status.eq.possible_ungraceful_exit,and(status.eq.active,last_seen_at.lt.${staleCutoff}))`,
    );
  } else if (args.status !== "all") {
    appendFilter(url, "status", `eq.${args.status}`);
  }
  if (args.reviewStatus === "reviewed") {
    appendFilter(url, "review_status", "in.(resolved,ignored)");
  } else if (args.reviewStatus !== "all") {
    appendFilter(url, "review_status", `eq.${args.reviewStatus}`);
  }
  if (args.route)
    appendFilter(url, "route", `ilike.*${args.route.replaceAll("*", "")}*`);
  return url;
};

const listRows = async (config, args) => {
  if (!VALID_STATUSES.has(args.status))
    throw new Error(`Invalid --status: ${args.status}`);
  if (!VALID_REVIEW_STATUSES.has(args.reviewStatus)) {
    throw new Error(`Invalid --review-status: ${args.reviewStatus}`);
  }
  if (!Number.isFinite(args.limit) || args.limit < 1 || args.limit > 100) {
    throw new Error("--limit must be between 1 and 100.");
  }

  const response = await fetch(buildListUrl({ config, args }), {
    headers: restHeaders(config.serviceRoleKey, { Prefer: "count=exact" }),
  });
  if (!response.ok) {
    throw new Error(
      `Supabase list failed: ${response.status} ${await response.text()}`,
    );
  }
  const rows = await response.json();
  return rows.map((row) => normalizeRow(row, args));
};

const printTextRows = (rows) => {
  console.log(`Badearsai crash-log intake: ${rows.length} row(s)`);
  for (const row of rows) {
    console.log("");
    console.log(`- ${row.id}`);
    console.log(
      `  evidence: ${row.status}/${row.confidence}; effective: ${row.effectiveStatus}/${row.effectiveConfidence}; review: ${row.reviewStatus}`,
    );
    console.log(`  route: ${row.route ?? "(unknown)"}`);
    console.log(
      `  last_event: ${row.lastEvent}; last_seen: ${row.timeline.lastSeenAt ?? "(unknown)"}`,
    );
    console.log(
      `  release: ${row.clientRelease ?? "(unknown)"}; build: ${row.buildId ?? "(unknown)"}`,
    );
    console.log(
      `  user: ${row.userEmail ?? "(unknown)"}; browser_session: ${row.browserSessionId ?? "(unknown)"}`,
    );
    console.log(`  metadata_keys: ${row.metadata.keys.join(", ") || "(none)"}`);
    const pressure = row.metadata.pressure;
    const pressureBits = [
      pressure.maxLevel !== null ? `max_pressure=${pressure.maxLevel}` : null,
      pressure.maxInputStallMs !== null
        ? `max_input_stall_ms=${pressure.maxInputStallMs}`
        : null,
      pressure.longTaskP95Ms !== null
        ? `long_task_p95_ms=${pressure.longTaskP95Ms}`
        : null,
      pressure.maxHeapUsedToLimitRatio !== null
        ? `max_heap_limit_ratio=${pressure.maxHeapUsedToLimitRatio}`
        : null,
    ].filter(Boolean);
    if (pressureBits.length)
      console.log(`  pressure: ${pressureBits.join("; ")}`);
    const crash = row.metadata.crashReport;
    if (crash.source || crash.type || crash.reason || crash.urlPath) {
      console.log(
        `  crash_report: source=${crash.source ?? "(unknown)"}; type=${crash.type ?? "(unknown)"}; reason=${crash.reason ?? "(unknown)"}; path=${crash.urlPath ?? "(unknown)"}`,
      );
    }
    if (row.reviewNote) console.log(`  review_note: ${row.reviewNote}`);
  }
};

const truncateNote = (value) =>
  String(value ?? "")
    .trim()
    .slice(0, 400);

const reviewRow = async (config, args) => {
  if (!args.session) throw new Error("review requires --session <id>.");
  if (!VALID_REVIEW_WRITES.has(args.status)) {
    throw new Error("review --status must be open, resolved, or ignored.");
  }
  const note = truncateNote(args.note);
  if (!note)
    throw new Error(
      "review requires --note with the classification rationale.",
    );
  const reviewerEmail = String(args.reviewerEmail ?? "").trim();
  if (args.status !== "open" && !reviewerEmail) {
    throw new Error(
      "review requires --reviewer-email for resolved/ignored rows.",
    );
  }

  const now = new Date().toISOString();
  const payload =
    args.status === "open"
      ? {
          review_status: args.status,
          reviewed_at: null,
          reviewed_by: null,
          reviewed_by_email: null,
          review_note: note,
          updated_at: now,
        }
      : {
          review_status: args.status,
          reviewed_at: now,
          reviewed_by: args.reviewerId || null,
          reviewed_by_email: reviewerEmail,
          review_note: note,
          updated_at: now,
        };

  const url = new URL(`${config.supabaseUrl}/rest/v1/browser_crash_sessions`);
  url.searchParams.set("id", `eq.${args.session}`);
  url.searchParams.set("select", "id,review_status,reviewed_at,review_note");
  const response = await fetch(url, {
    method: "PATCH",
    headers: restHeaders(config.serviceRoleKey, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(
      `Supabase review update failed: ${response.status} ${await response.text()}`,
    );
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("Crash session not found or update was ambiguous.");
  }
  return rows[0];
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

  if (args.command === "list") {
    const rows = await listRows(config, args);
    if (args.json) console.log(JSON.stringify({ rows }, null, 2));
    else printTextRows(rows);
    return;
  }

  if (args.command === "review") {
    const result = await reviewRow(config, args);
    if (args.json) console.log(JSON.stringify({ ok: true, result }, null, 2));
    else {
      console.log(
        `Updated ${result.id}: review_status=${result.review_status}; reviewed_at=${result.reviewed_at ?? "null"}`,
      );
    }
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
};

main().catch((error) => {
  console.error(
    `[badearsai-crash-log] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
