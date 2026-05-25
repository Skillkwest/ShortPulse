#!/usr/bin/env node
/* global console */

/**
 * Ophestivus Admin Errors status helper.
 *
 * Reads one incident or fingerprint family from Supabase and reports linked
 * incident statuses, open same-fingerprint count, and optional fresh events
 * after a verification timestamp.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "../../../../../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "../../../../../../scripts/lib/load_local_env.mjs";

const INCIDENT_SELECT_COLUMNS =
  "id,fingerprint,source,scope,severity,status,message,route,endpoint,first_seen_at,last_seen_at,occurrences_count";
const EVENT_SELECT_COLUMNS = "id,incident_id,message,route,endpoint,occurred_at,created_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[0-9a-f]{32,128}$/i;

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:error-status -- --incident <incident-id> [--after <iso-timestamp>]",
      "  npm run ophestivus:error-status -- --fingerprint <fingerprint> [--after <iso-timestamp>]",
      "",
      "Options:",
      "  --incident <id>       Read an incident and inspect its same-fingerprint family.",
      "  --fingerprint <fp>    Inspect all incidents with this fingerprint.",
      "  --after <timestamp>   Count/list matching events after this ISO timestamp.",
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

const toEvent = (event) => ({
  id: event.id,
  incidentId: event.incident_id,
  message: event.message,
  route: event.route,
  endpoint: event.endpoint,
  occurredAt: event.occurred_at,
  createdAt: event.created_at,
});

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:error-status] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:error-status] ${payload.status}`);
  console.log(`Fingerprint: ${payload.fingerprint ?? "n/a"}`);
  console.log(`Incidents: ${payload.summary.incidentCount}`);
  console.log(`Open same-fingerprint incidents: ${payload.summary.openCount}`);
  console.log(`Resolved: ${payload.summary.resolvedCount}`);
  console.log(`Ignored: ${payload.summary.ignoredCount}`);
  console.log(`Latest last_seen_at: ${payload.summary.latestLastSeenAt ?? "n/a"}`);
  if (payload.after) {
    console.log(`Fresh events after ${payload.after}: ${payload.summary.freshEventCount}`);
  } else {
    console.log("Fresh events after timestamp: not checked; pass --after <iso-timestamp>.");
  }
  if (payload.incidents.length) {
    console.log("Incident statuses:");
    for (const incident of payload.incidents) {
      console.log(`- ${incident.id}: ${incident.status} (${incident.hits} hits) ${incident.route ?? ""}`);
    }
  }
  if (payload.nextAction) console.log(`Next: ${payload.nextAction}`);
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

const readIncidentsByFingerprint = async (supabase, fingerprint) => {
  const { data, error } = await supabase
    .from("app_error_logs")
    .select(INCIDENT_SELECT_COLUMNS)
    .eq("fingerprint", fingerprint)
    .order("last_seen_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toIncident);
};

const readFreshEvents = async (supabase, fingerprint, after) => {
  if (!after) return [];
  const afterDate = new Date(after);
  if (Number.isNaN(afterDate.getTime())) {
    throw new Error("--after must be a valid timestamp.");
  }

  const { data, error } = await supabase
    .from("app_error_events")
    .select(EVENT_SELECT_COLUMNS)
    .eq("fingerprint", fingerprint)
    .gte("occurred_at", afterDate.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []).map(toEvent);
};

const run = async () => {
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const incidentId = readOption("--incident");
  const fingerprintArg = readOption("--fingerprint");
  const after = readOption("--after");

  if (incidentId && !UUID_PATTERN.test(incidentId)) {
    throw new Error("--incident must be a UUID.");
  }
  if (fingerprintArg && !FINGERPRINT_PATTERN.test(fingerprintArg)) {
    throw new Error("--fingerprint must look like a hex fingerprint.");
  }
  if (!incidentId && !fingerprintArg) {
    throw new Error("Provide --incident <id> or --fingerprint <fingerprint>.");
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

  const selectedIncident = incidentId ? await readIncidentById(supabase, incidentId) : null;
  if (incidentId && !selectedIncident) {
    throw new Error(`Incident not found: ${incidentId}`);
  }

  const fingerprint = fingerprintArg ?? selectedIncident?.fingerprint;
  if (!fingerprint) {
    throw new Error("Selected incident does not include a fingerprint.");
  }

  const [incidents, freshEvents] = await Promise.all([
    readIncidentsByFingerprint(supabase, fingerprint),
    readFreshEvents(supabase, fingerprint, after),
  ]);

  const openCount = incidents.filter((incident) => incident.status === "open").length;
  const resolvedCount = incidents.filter((incident) => incident.status === "resolved").length;
  const ignoredCount = incidents.filter((incident) => incident.status === "ignored").length;

  emit(
    {
      ok: true,
      status: "read_error_status",
      targetIncidentId: incidentId ?? null,
      fingerprint,
      after: after ?? null,
      summary: {
        incidentCount: incidents.length,
        openCount,
        resolvedCount,
        ignoredCount,
        latestLastSeenAt: incidents[0]?.lastSeenAt ?? null,
        freshEventCount: freshEvents.length,
      },
      selectedIncident,
      incidents,
      freshEvents,
      nextAction:
        openCount === 0 && after && freshEvents.length === 0
          ? "Status check is clean for this fingerprint."
          : openCount === 0 && !after
            ? "Pass --after <verification-timestamp> to check for fresh matching events."
          : "Investigate open incidents or fresh matching events before approving resolution.",
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
        nextAction: "Fix the input or environment, then rerun npm run ophestivus:error-status.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export { readFreshEvents, readIncidentById, readIncidentsByFingerprint };
