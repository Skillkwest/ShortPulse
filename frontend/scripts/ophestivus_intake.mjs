#!/usr/bin/env node
/* global console */

/**
 * Ophestivus intake helper.
 *
 * Checks the admin kanban backlog first. If no backlog item exists, pulls the next
 * open Admin Errors incident, creates a backlog ticket, and transitions the
 * incident out of `open` so the error page does not keep showing work that is
 * already tracked on the board.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "../../scripts/lib/load_local_env.mjs";

const ACTOR_EMAIL = "ophestivus@local.agent";
const HUMAN_REVIEW_TITLE_PREFIX = "[HUMAN REVIEW]";
const HUMAN_REVIEW_BANNER = "*** HUMAN REVIEW REQUIRED ***";
const INCIDENT_SELECT_COLUMNS =
  "id,fingerprint,source,scope,severity,status,message,route,endpoint,first_seen_at,last_seen_at,occurrences_count";
const INCIDENT_ID_PATTERN =
  /Incident:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const PRIORITY_SEVERITIES = ["high", "medium", "low"];

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:intake",
      "  npm run ophestivus:intake -- --dry-run",
      "",
      "Options:",
      "  --dry-run             Show the next intake action without mutating Supabase.",
      "  --json                Print JSON only.",
      "  --env-file <path>     Load an explicit env file. Can be repeated.",
      "  --help                Show this help.",
      "",
      "Required env:",
      "  NEXT_PUBLIC_SUPABASE_URL",
      "  SUPABASE_SERVICE_ROLE_KEY",
      "  SHORTPULSE_ADMIN_EMAILS",
    ].join("\n")
  );
};

const hasFlag = (flag) => process.argv.includes(flag);

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:intake] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:intake] ${payload.status}`);
  if (payload.ticket) {
    console.log(`Ticket: ${payload.ticket.id} (${payload.ticket.status})`);
    console.log(`Title: ${payload.ticket.title}`);
  }
  if (payload.incident) {
    console.log(`Incident: ${payload.incident.id}`);
    console.log(`Error: ${payload.incident.message}`);
    console.log(`Severity: ${payload.incident.severity}`);
  }
  if (payload.handoff) {
    console.log(`Removed open incidents: ${payload.handoff.removedIncidentIds.length}`);
  }
  if (payload.nextAction) console.log(`Next: ${payload.nextAction}`);
};

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const truncate = (value, maxLength) => {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const parseIncidentIdFromDetails = (details) => {
  const match = String(details ?? "").match(INCIDENT_ID_PATTERN);
  return match?.[1] ?? null;
};

const toTicket = (item) => ({
  id: item.id,
  title: item.title,
  status: item.status,
  details: item.details ?? "",
  sortOrder: item.sort_order ?? 0,
  updatedAt: item.updated_at,
});

const isHumanReviewTicket = (ticket) => {
  const title = String(ticket?.title ?? "").trim();
  const details = String(ticket?.details ?? "");
  return title.startsWith(HUMAN_REVIEW_TITLE_PREFIX) || details.includes(HUMAN_REVIEW_BANNER);
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

const selectOpenIncidents = (supabase) =>
  supabase.from("app_error_logs").select(INCIDENT_SELECT_COLUMNS).eq("status", "open");

const orderIncidentPriority = (query, limit) =>
  query
    .order("last_seen_at", { ascending: false })
    .order("occurrences_count", { ascending: false })
    .limit(limit);

const readBacklogTicket = async (supabase) => {
  const { data, error } = await supabase
    .from("admin_kanban_items")
    .select("id,title,details,status,sort_order,updated_at,created_at")
    .eq("status", "backlog")
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  const tickets = (data ?? []).map(toTicket);
  return tickets.find((ticket) => !isHumanReviewTicket(ticket)) ?? null;
};

const readIncident = async (supabase, incidentId) => {
  if (!incidentId) return null;
  const { data, error } = await supabase
    .from("app_error_logs")
    .select(INCIDENT_SELECT_COLUMNS)
    .eq("id", incidentId)
    .maybeSingle();

  if (error) throw error;
  return data ? toIncident(data) : null;
};

const readNextOpenIncident = async (supabase) => {
  for (const severity of PRIORITY_SEVERITIES) {
    const { data, error } = await orderIncidentPriority(
      selectOpenIncidents(supabase).eq("severity", severity),
      1
    );

    if (error) throw error;
    if (data?.[0]) return toIncident(data[0]);
  }

  const { data, error } = await orderIncidentPriority(
    selectOpenIncidents(supabase).not("severity", "in", `(${PRIORITY_SEVERITIES.join(",")})`),
    1
  );

  if (error) throw error;
  return data?.[0] ? toIncident(data[0]) : null;
};

const readOpenIncidentsByFingerprint = async (supabase, fingerprint) => {
  if (!fingerprint) return [];
  const { data, error } = await orderIncidentPriority(
    selectOpenIncidents(supabase).eq("fingerprint", fingerprint),
    500
  );

  if (error) throw error;
  return (data ?? []).map(toIncident);
};

const readOpenIncidentsForHandoff = async (supabase, incident) => {
  const incidents = await readOpenIncidentsByFingerprint(supabase, incident.fingerprint);
  if (incidents.length === 0 && incident.status === "open") return [incident];
  if (incidents.some((candidate) => candidate.id === incident.id)) return incidents;
  return incident.status === "open" ? [incident, ...incidents] : incidents;
};

const readExistingTicketForIncident = async (supabase, incidentId) => {
  const { data, error } = await supabase
    .from("admin_kanban_items")
    .select("id,title,details,status,sort_order,updated_at,created_at")
    .is("archived_at", null)
    .ilike("details", `%${incidentId}%`)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ? toTicket(data[0]) : null;
};

const readConfiguredAdminUser = async (supabase) => {
  const emails = requireEnv("SHORTPULSE_ADMIN_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) throw new Error("SHORTPULSE_ADMIN_EMAILS does not include an email.");

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const found = (data.users ?? []).find((user) =>
      emails.includes(String(user.email ?? "").toLowerCase())
    );
    if (found) return found;
    if (!data.users || data.users.length < 100) break;
  }

  throw new Error("Configured admin user was not found.");
};

const createTicketDetails = (incident) =>
  truncate(
    [
      `Incident: ${incident.id}`,
      `Severity: ${incident.severity}`,
      `Status: ${incident.status}`,
      `Route/endpoint: ${incident.route ?? "n/a"} / ${incident.endpoint ?? "n/a"}`,
      `Message: ${incident.message ?? "n/a"}`,
      `First seen: ${incident.firstSeenAt ?? "n/a"}`,
      `Last seen: ${incident.lastSeenAt ?? "n/a"}`,
      `Hits: ${incident.hits ?? 0}`,
      "Evidence source: ophestivus:intake",
      "Initial theory: needs audit.",
    ].join("\n"),
    1000
  );

const createBacklogTicket = async (supabase, incident) => {
  const { data, error } = await supabase.rpc("create_admin_kanban_item", {
    p_title: truncate(`Ophestivus: ${incident.message || incident.source || "Admin Error"}`, 140),
    p_details: createTicketDetails(incident),
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });

  if (error) throw error;
  return toTicket(data);
};

const updateTicketWithBlocker = async (supabase, ticket, incident, error) => {
  const details = truncate(
    [
      `Blocked by: intake removal failed`,
      `Escalation needed: Human admin`,
      `What Ophestivus checked: board ticket exists for incident ${incident.id}.`,
      `What Ophestivus tried: attempted to transition the incident and same-fingerprint open duplicates out of open after kanban intake.`,
      `What remains unresolved: Admin Errors incident or same-fingerprint duplicates may still be open.`,
      `Why continuing would be unsafe/low value: SOP requires error-page handoff before active work.`,
      `Human action needed: remove incident ${incident.id} and same-fingerprint duplicates from open Admin Errors or grant working admin status context.`,
      `Resume condition: incident and same-fingerprint duplicates are no longer open in Admin Errors.`,
      `Failure: ${error.message}`,
    ].join("\n"),
    1000
  );

  await supabase.rpc("update_admin_kanban_item", {
    p_item_id: ticket.id,
    p_title: ticket.title,
    p_details: details,
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });
};

const removeIncidentsFromOpenErrors = async (supabase, incident, ticket, adminUser) => {
  const openIncidents = await readOpenIncidentsForHandoff(supabase, incident);
  const removedIncidentIds = [];

  for (const openIncident of openIncidents) {
    const { error } = await supabase.rpc("admin_update_app_error_status", {
      p_error_id: openIncident.id,
      p_event_id: null,
      p_status: "ignored",
      p_note: `Tracked on Ophestivus board ticket ${ticket.id}; removed from open Admin Errors during intake.`,
      p_admin_user_id: adminUser.id,
      p_admin_user_email: adminUser.email ?? null,
    });
    if (error) throw error;

    const verify = await readIncident(supabase, openIncident.id);
    if (verify?.status === "open") {
      throw new Error(`Incident ${openIncident.id} is still open after intake handoff.`);
    }
    removedIncidentIds.push(openIncident.id);
  }

  const remaining = incident.fingerprint
    ? await readOpenIncidentsByFingerprint(supabase, incident.fingerprint)
    : [];
  if (remaining.length > 0) {
    throw new Error(
      `Same-fingerprint incidents still open after intake handoff: ${remaining
        .map((candidate) => candidate.id)
        .join(", ")}`
    );
  }

  return { removedIncidentIds };
};

const completeOpenIncidentHandoff = async (supabase, incident, ticket) => {
  const adminUser = await readConfiguredAdminUser(supabase);
  try {
    return await removeIncidentsFromOpenErrors(supabase, incident, ticket, adminUser);
  } catch (error) {
    await updateTicketWithBlocker(supabase, ticket, incident, error);
    throw error;
  }
};

const createDryRunHandoff = async (supabase, incident) => {
  const openIncidents = await readOpenIncidentsForHandoff(supabase, incident);
  return { removedIncidentIds: openIncidents.map((candidate) => candidate.id) };
};

const run = async () => {
  const dryRun = hasFlag("--dry-run");
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
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

  const backlogTicket = await readBacklogTicket(supabase);
  if (backlogTicket) {
    const incident = await readIncident(supabase, parseIncidentIdFromDetails(backlogTicket.details));
    if (incident?.status === "open") {
      const handoff = dryRun
        ? await createDryRunHandoff(supabase, incident)
        : await completeOpenIncidentHandoff(supabase, incident, backlogTicket);
      emit(
        {
          ok: true,
          status: dryRun
            ? "backlog_ticket_found_would_remove_open_error"
            : "backlog_ticket_found_and_removed_error",
          ticket: backlogTicket,
          incident,
          handoff,
          nextAction: dryRun
            ? "Run without --dry-run to remove the incident and same-fingerprint duplicates from open Admin Errors."
            : "Move this ticket to In progress and audit it.",
        },
        { jsonOnly }
      );
      return;
    }

    emit(
      {
        ok: true,
        status: "backlog_ticket_found",
        ticket: backlogTicket,
        incident,
        nextAction: "Move this ticket to In progress and audit it.",
      },
      { jsonOnly }
    );
    return;
  }

  const incident = await readNextOpenIncident(supabase);
  if (!incident) {
    emit(
      {
        ok: true,
        status: "no_backlog_or_open_errors",
        ticket: null,
        incident: null,
        nextAction: "No intake work found.",
      },
      { jsonOnly }
    );
    return;
  }

  const existingTicket = await readExistingTicketForIncident(supabase, incident.id);
  if (existingTicket) {
    const handoff = dryRun
      ? await createDryRunHandoff(supabase, incident)
      : await completeOpenIncidentHandoff(supabase, incident, existingTicket);
    emit(
      {
        ok: true,
        status: dryRun
          ? "existing_ticket_found_would_remove_open_error"
          : "existing_ticket_found_and_removed_error",
        ticket: existingTicket,
        incident,
        handoff,
        nextAction: dryRun
          ? "Run without --dry-run to remove the incident and same-fingerprint duplicates from open Admin Errors."
          : "Review existing ticket state before continuing.",
      },
      { jsonOnly }
    );
    return;
  }

  if (dryRun) {
    emit(
      {
        ok: true,
        status: "dry_run_would_create_ticket_and_ignore_incident",
        ticket: null,
        incident,
        handoff: await createDryRunHandoff(supabase, incident),
        nextAction: "Run without --dry-run to create the backlog ticket and remove the incident from open Admin Errors.",
      },
      { jsonOnly }
    );
    return;
  }

  const ticket = await createBacklogTicket(supabase, incident);
  const handoff = await completeOpenIncidentHandoff(supabase, incident, ticket);

  emit(
    {
      ok: true,
      status: "created_backlog_ticket_and_removed_error",
      ticket,
      incident,
      handoff,
      nextAction: "Move this ticket to In progress and audit it.",
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
        nextAction: "Fix the blocker, then rerun npm run ophestivus:intake.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export {
  completeOpenIncidentHandoff,
  isHumanReviewTicket,
  readNextOpenIncident,
  readOpenIncidentsByFingerprint,
  removeIncidentsFromOpenErrors,
  readBacklogTicket,
};
