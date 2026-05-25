#!/usr/bin/env node
/* global console */

/**
 * Ophestivus complete-error-ticket helper.
 *
 * Closes an in-progress Admin Errors board ticket by verifying recurrence,
 * writing a full local report, resolving the incident, writing a compact board
 * summary, and moving the item to Review.
 */

import process from "node:process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "../../../../../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "../../../../../../scripts/lib/load_local_env.mjs";
import {
  readFreshEvents,
  readIncidentById,
  readIncidentsByFingerprint,
} from "./ophestivus_error_status.mjs";
import {
  DEFAULT_APPROVAL_RESERVE,
  DETAILS_MAX_LENGTH,
  buildCompactTicketReport,
  validateCompactTicketReportEvidence,
} from "./ophestivus_ticket_report.mjs";
import { buildRunLogMarkdown, resolveOutputPath } from "./ophestivus_run_log.mjs";

const ACTOR_EMAIL = "ophestivus@local.agent";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET_SELECT_COLUMNS =
  "id,title,details,status,sort_order,created_at,updated_at,created_by,updated_by,archived_at";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:complete-error-ticket -- --ticket <item-id> --incident <incident-id> --after <iso> --resolution-type <type> --issue <text> --repo-changes <text> --validation <text> --verification-class <class> --risk-class <class> --risk <text>",
      "",
      "Options:",
      "  --ticket <id>              In-progress Ophestivus board item id.",
      "  --incident <id>            Admin Errors incident id.",
      "  --after <timestamp>        Fix/verification timestamp used for fresh-event recurrence check.",
      "  --title <text>             Review ticket title. Defaults to incident message.",
      "  --issue <text>             Short issue summary. Defaults to incident message.",
      "  --resolution-type <type>   new-code | verified-existing-fix | no-code | config | data.",
      "  --repo-changes <text>      Code/data/doc change summary.",
      "  --validation <text>        Test/check summary.",
      "  --verification-class <class> live-route-verified | tests-and-data-verified | telemetry-filter-verified | blocked-live-verification.",
      "  --recurrence <text>        Override recurrence summary.",
      "  --risk-class <class>       accepted | monitor | follow-up | human-review.",
      "  --risk <text>              Residual risk text.",
      "  --report-output <path>     Optional output path for the full local Ophestivus report.",
      "  --local-dev-note           Add stale local bundle/dev server note.",
      "  --dry-run                  Verify and print planned updates without mutating Supabase.",
      "  --json                     Print JSON only.",
      "  --env-file <path>          Load an explicit env file. Can be repeated.",
      "  --help                     Show this help.",
      "",
      "Required env:",
      "  NEXT_PUBLIC_SUPABASE_URL",
      "  SUPABASE_SERVICE_ROLE_KEY",
      "  SHORTPULSE_ADMIN_EMAILS",
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

const requireUuidOption = (name) => {
  const value = readOption(name);
  if (!value || !UUID_PATTERN.test(value)) {
    throw new Error(`${name} must be a UUID.`);
  }
  return value;
};

const requireTextOption = (name) => {
  const value = readOption(name)?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const normalizeTimestamp = (value) => {
  if (!value) throw new Error("--after is required.");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("--after must be a valid timestamp.");
  return parsed.toISOString();
};

const toTicket = (item) => ({
  id: item.id,
  title: item.title,
  status: item.status,
  details: item.details ?? "",
  sortOrder: item.sort_order ?? 0,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  archivedAt: item.archived_at ?? null,
});

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:complete-error-ticket] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:complete-error-ticket] ${payload.status}`);
  console.log(`Ticket: ${payload.ticket.id} (${payload.ticket.status})`);
  console.log(`Incident: ${payload.incident.id} (${payload.incident.status})`);
  console.log(`Report length: ${payload.report.detailsLength}/${payload.report.maxLength}`);
  if (payload.nextAction) console.log(`Next: ${payload.nextAction}`);
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

const repoRelativePath = (outputPath) => {
  const repoRoot = path.resolve(process.cwd(), "..");
  const relative = path.relative(repoRoot, outputPath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }
  return outputPath;
};

const writeLocalReport = async (outputPath, markdown) => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");
};

const assertLocalReportExists = async (outputPath) => {
  const stats = await fs.stat(outputPath);
  if (!stats.isFile() || stats.size <= 0) {
    throw new Error("Local Ophestivus report was not written before Review.");
  }
};

const assertReviewEvidenceReady = ({ report, reportPathForTicket, localReportMarkdown }) => {
  const validation = validateCompactTicketReportEvidence(report, {
    requiredReportPath: reportPathForTicket,
    approvalReserve: DEFAULT_APPROVAL_RESERVE,
  });
  const errors = [...validation.errors];

  if (!localReportMarkdown.trim()) {
    errors.push("Local Ophestivus report markdown is empty.");
  }

  if (errors.length > 0) {
    throw new Error(`Pre-Review evidence validation failed: ${errors.join(" ")}`);
  }
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

const readCleanRecurrenceState = async (
  supabase,
  incident,
  after,
  { allowedOpenIncidentIds = [] } = {}
) => {
  const allowedOpenIds = new Set(allowedOpenIncidentIds);
  const [incidents, freshEvents] = await Promise.all([
    readIncidentsByFingerprint(supabase, incident.fingerprint),
    readFreshEvents(supabase, incident.fingerprint, after),
  ]);
  const openIncidents = incidents.filter(
    (candidate) => candidate.status === "open" && !allowedOpenIds.has(candidate.id)
  );
  if (openIncidents.length > 0) {
    throw new Error(
      `Same-fingerprint incidents still open: ${openIncidents.map((candidate) => candidate.id).join(", ")}`
    );
  }
  if (freshEvents.length > 0) {
    throw new Error(`Fresh same-fingerprint events found after ${after}: ${freshEvents.length}`);
  }

  return {
    incidents,
    freshEvents,
    summary: {
      incidentCount: incidents.length,
      openCount: incidents.filter((candidate) => candidate.status === "open").length,
      blockingOpenCount: openIncidents.length,
      resolvedCount: incidents.filter((candidate) => candidate.status === "resolved").length,
      ignoredCount: incidents.filter((candidate) => candidate.status === "ignored").length,
      freshEventCount: freshEvents.length,
    },
  };
};

const resolveIncident = async (supabase, incidentId, ticketId, adminUser) => {
  const { error } = await supabase.rpc("admin_update_app_error_status", {
    p_error_id: incidentId,
    p_event_id: null,
    p_status: "resolved",
    p_note: `Verified by Ophestivus complete-error-ticket helper; ticket ${ticketId} moved to Review.`,
    p_admin_user_id: adminUser.id,
    p_admin_user_email: adminUser.email ?? null,
  });
  if (error) throw error;
};

const updateTicketReport = async (supabase, ticketId, title, details) => {
  const { data, error } = await supabase.rpc("update_admin_kanban_item", {
    p_item_id: ticketId,
    p_title: title,
    p_details: details,
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });

  if (error) throw error;
  return toTicket(data);
};

const moveTicketToReview = async (supabase, ticketId) => {
  const { data, error } = await supabase.rpc("move_admin_kanban_item", {
    p_item_id: ticketId,
    p_status: "review",
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });

  if (error) throw error;
  return toTicket(data);
};

const assertTicketStillInProgress = (initialTicket, currentTicket) => {
  if (!currentTicket) throw new Error("Ticket no longer exists.");
  if (currentTicket.archivedAt) throw new Error("Ticket was archived during closeout.");
  if (currentTicket.id !== initialTicket.id)
    throw new Error("Ticket identity changed during closeout.");
  if (currentTicket.status !== "in_progress") {
    throw new Error(`Ticket is no longer in progress; current status is ${currentTicket.status}.`);
  }
  if (
    currentTicket.title !== initialTicket.title ||
    currentTicket.details !== initialTicket.details
  ) {
    throw new Error(
      "Ticket title or details changed during closeout; restart from the current state."
    );
  }
};

const run = async () => {
  const dryRun = hasFlag("--dry-run");
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const ticketId = requireUuidOption("--ticket");
  const incidentId = requireUuidOption("--incident");
  const after = normalizeTimestamp(readOption("--after"));
  const riskClass = requireTextOption("--risk-class");
  if (riskClass.toLowerCase() === "human-review") {
    throw new Error(
      "Human Review residual risk cannot be moved to Review. Use the Backlog escalation path."
    );
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

  const [ticket, incident] = await Promise.all([
    readTicket(supabase, ticketId),
    readIncidentById(supabase, incidentId),
  ]);
  if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
  if (!incident) throw new Error(`Incident not found: ${incidentId}`);
  if (ticket.status !== "in_progress") {
    throw new Error(`Expected ticket to be in_progress before closeout; got ${ticket.status}.`);
  }
  if (ticket.archivedAt) throw new Error("Ticket is archived.");
  if (!incident.fingerprint) throw new Error("Incident does not include a fingerprint.");

  const recurrenceBefore = await readCleanRecurrenceState(supabase, incident, after, {
    allowedOpenIncidentIds: [incident.id],
  });
  const title = readOption("--title")?.trim() || incident.message || ticket.title;
  const recurrence =
    readOption("--recurrence")?.trim() ||
    `0 open same-fingerprint incidents; 0 fresh events after ${after}.`;
  const issue = readOption("--issue")?.trim() || incident.message || "Admin Errors incident";
  const resolutionType = requireTextOption("--resolution-type");
  const repoChanges = requireTextOption("--repo-changes");
  const validation = requireTextOption("--validation");
  const verificationClass = readOption("--verification-class")?.trim() || "tests-and-data-verified";
  const residualRisk = requireTextOption("--risk");
  const reportCreatedAt = new Date().toISOString();
  const localReportPath = resolveOutputPath({
    output: readOption("--report-output"),
    title,
    ticketId,
    incidentId,
    createdAt: reportCreatedAt,
  });
  const reportPathForTicket = repoRelativePath(localReportPath);
  const localReportMarkdown = buildRunLogMarkdown({
    title,
    ticketId,
    incidentId,
    status: "review-ready",
    summary: issue,
    changes: repoChanges,
    validation: `${validation}\n\nVerification class: ${verificationClass}\n\nRecurrence: ${recurrence}`,
    risk: `${riskClass}: ${residualRisk}`,
    createdAt: reportCreatedAt,
  });
  const report = buildCompactTicketReport({
    incidentId,
    issue,
    resolutionType,
    repoChanges,
    validation,
    verificationClass,
    recurrence,
    riskClass,
    residualRisk,
    reportPath: reportPathForTicket,
    includeLocalDevNote: hasFlag("--local-dev-note"),
    maxLength: DETAILS_MAX_LENGTH,
    approvalReserve: DEFAULT_APPROVAL_RESERVE,
  });
  assertReviewEvidenceReady({ report, reportPathForTicket, localReportMarkdown });

  if (dryRun) {
    emit(
      {
        ok: true,
        status: "dry_run_would_complete_error_ticket",
        ticket,
        incident,
        recurrence: recurrenceBefore.summary,
        report,
        localReport: {
          path: localReportPath,
          ticketPath: reportPathForTicket,
          markdownLength: localReportMarkdown.length,
        },
        nextAction:
          "Run without --dry-run to write the local report, resolve the incident, write the compact ticket summary, and move the ticket to Review.",
      },
      { jsonOnly }
    );
    return;
  }

  const adminUser = await readConfiguredAdminUser(supabase);
  const ticketBeforeMutation = await readTicket(supabase, ticket.id);
  assertTicketStillInProgress(ticket, ticketBeforeMutation);

  await writeLocalReport(localReportPath, localReportMarkdown);
  await assertLocalReportExists(localReportPath);
  await resolveIncident(supabase, incidentId, ticketId, adminUser);
  const resolvedIncident = await readIncidentById(supabase, incidentId);
  if (resolvedIncident?.status !== "resolved") {
    throw new Error("Incident was not confirmed resolved after status update.");
  }
  const recurrenceAfter = await readCleanRecurrenceState(supabase, resolvedIncident, after);

  const freshTicket = await readTicket(supabase, ticket.id);
  assertTicketStillInProgress(ticket, freshTicket);

  const updatedTicket = await updateTicketReport(supabase, ticket.id, title, report.details);
  if (!updatedTicket || updatedTicket.status !== "in_progress") {
    throw new Error("Ticket report update was not confirmed on the In progress ticket.");
  }
  assertReviewEvidenceReady({
    report: {
      ...report,
      details: updatedTicket.details,
      detailsLength: updatedTicket.details.length,
      remainingForApproval: DETAILS_MAX_LENGTH - updatedTicket.details.length,
    },
    reportPathForTicket,
    localReportMarkdown,
  });

  const movedTicket = await moveTicketToReview(supabase, ticket.id);
  emit(
    {
      ok: true,
      status: "completed_error_ticket_to_review",
      ticket: movedTicket,
      incident: resolvedIncident,
      recurrence: recurrenceAfter.summary,
      report,
      localReport: {
        path: localReportPath,
        ticketPath: reportPathForTicket,
        markdownLength: localReportMarkdown.length,
      },
      nextAction: "Ticket moved to Review. Run the Review SOP before moving it to Complete.",
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
        nextAction: "Fix the blocker, then rerun npm run ophestivus:complete-error-ticket.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export { readCleanRecurrenceState };
