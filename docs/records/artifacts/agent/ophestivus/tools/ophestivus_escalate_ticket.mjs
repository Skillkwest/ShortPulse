#!/usr/bin/env node
/* global console */

/**
 * Ophestivus escalate-ticket helper.
 *
 * Updates one active board ticket with a compact Human Review handoff and
 * returns it to Backlog. This keeps escalation wording consistent and avoids
 * manual detail-length compaction during SOP runs.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "../../../../../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "../../../../../../scripts/lib/load_local_env.mjs";

const ACTOR_EMAIL = "ophestivus@local.agent";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DETAILS_MAX_LENGTH = 1000;
const HUMAN_REVIEW_TITLE_PREFIX = "[HUMAN REVIEW]";
const TICKET_SELECT_COLUMNS =
  "id,title,details,status,sort_order,created_at,updated_at,created_by,updated_by,archived_at";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:escalate-ticket -- --ticket <item-id> --issue <plain title> --type <label> --why <text> --checked <text> --tried <text> --evidence <text> --unresolved <text> --risk <text> --human-action <text> --resume <text> --owner <text> --dry-run",
      "  npm run ophestivus:escalate-ticket -- --ticket <item-id> --issue <plain title> --type <label> --why <text> --checked <text> --tried <text> --evidence <text> --unresolved <text> --risk <text> --human-action <text> --resume <text> --owner <text>",
      "",
      "Options:",
      "  --ticket <id>          Active board item id.",
      "  --issue <text>         Plain issue title without the human-review prefix.",
      "  --type <text>          Escalation type label.",
      "  --why <text>           Why I stopped.",
      "  --checked <text>       What I checked.",
      "  --tried <text>         What I tried.",
      "  --evidence <text>      Current evidence summary.",
      "  --unresolved <text>    What remains unresolved.",
      "  --risk <text>          Risk if continued by agent.",
      "  --human-action <text>  Human action needed.",
      "  --resume <text>        Resume condition.",
      "  --owner <text>         Suggested owner.",
      "  --from-status <status> Optional stale-state guard. Defaults to current active status when omitted.",
      "  --dry-run              Show planned title/details and backlog move without mutating Supabase.",
      "  --json                 Print JSON only.",
      "  --env-file <path>      Load an explicit env file. Can be repeated.",
      "  --help                 Show this help.",
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

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (value, maxLength) => {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, Math.max(0, maxLength));
  return `${text.slice(0, maxLength - 3)}...`;
};

const requireTextOption = (name) => {
  const value = readOption(name);
  const normalized = normalizeText(value);
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
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

const buildHumanReviewTitle = (issueTitle) => {
  const plain = normalizeText(issueTitle).replace(/^\[HUMAN REVIEW\]\s*/i, "");
  if (!plain) throw new Error("--issue is required.");
  return truncate(`${HUMAN_REVIEW_TITLE_PREFIX} ${plain}`, 140);
};

const detailField = (label, value, maxLength) => `${label}: ${truncate(value, maxLength)}`;

const buildEscalationDetails = ({
  type,
  why,
  checked,
  tried,
  evidence,
  unresolved,
  risk,
  humanAction,
  resume,
  owner,
}) => {
  const lines = [
    "*** HUMAN REVIEW REQUIRED ***",
    detailField("Escalation type", type, 40),
    detailField("Why I stopped", why, 70),
    detailField("What I checked", checked, 80),
    detailField("What I tried", tried, 80),
    detailField("Current evidence", evidence, 75),
    detailField("What remains unresolved", unresolved, 65),
    detailField("Risk if continued by agent", risk, 65),
    detailField("Human action needed", humanAction, 85),
    detailField("Resume condition", resume, 60),
    detailField("Suggested owner", owner, 40),
  ];
  const details = lines.join("\n");
  if (details.length > DETAILS_MAX_LENGTH) {
    throw new Error(
      `Escalation note would exceed ${DETAILS_MAX_LENGTH} characters even after compaction. Shorten the inputs.`
    );
  }
  return details;
};

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:escalate-ticket] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:escalate-ticket] ${payload.status}`);
  console.log(`Ticket: ${payload.ticket.id} (${payload.ticket.status})`);
  console.log(`Title: ${payload.ticket.title}`);
  console.log(`Details length: ${payload.ticket.details.length}/${DETAILS_MAX_LENGTH}`);
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

const updateTicket = async (supabase, ticketId, title, details) => {
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

const moveTicketToBacklog = async (supabase, ticketId) => {
  const { data, error } = await supabase.rpc("move_admin_kanban_item", {
    p_item_id: ticketId,
    p_status: "backlog",
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });

  if (error) throw error;
  return toTicket(data);
};

const assertTicketMutable = (ticket, fromStatus) => {
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.archivedAt) throw new Error("Ticket is archived.");
  if (fromStatus && ticket.status !== fromStatus) {
    throw new Error(`Ticket status is ${ticket.status}, expected ${fromStatus}.`);
  }
  if (ticket.status === "published") {
    throw new Error("Published tickets are human-controlled and cannot be escalated by this helper.");
  }
};

const run = async () => {
  const dryRun = hasFlag("--dry-run");
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const ticketId = readOption("--ticket");
  if (!ticketId || !UUID_PATTERN.test(ticketId)) {
    throw new Error("--ticket must be a UUID.");
  }

  const title = buildHumanReviewTitle(requireTextOption("--issue"));
  const details = buildEscalationDetails({
    type: requireTextOption("--type"),
    why: requireTextOption("--why"),
    checked: requireTextOption("--checked"),
    tried: requireTextOption("--tried"),
    evidence: requireTextOption("--evidence"),
    unresolved: requireTextOption("--unresolved"),
    risk: requireTextOption("--risk"),
    humanAction: requireTextOption("--human-action"),
    resume: requireTextOption("--resume"),
    owner: requireTextOption("--owner"),
  });
  const fromStatus = normalizeText(readOption("--from-status")) || null;

  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: ["../.env.agent.local", ".env.development.local", ".env.local", "../.env.local"],
  });

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const ticket = await readTicket(supabase, ticketId);
  assertTicketMutable(ticket, fromStatus);

  const plannedTicket = {
    ...ticket,
    title,
    details,
    status: "backlog",
  };

  if (dryRun) {
    emit(
      {
        ok: true,
        status: "dry_run_would_escalate_ticket",
        ticket: plannedTicket,
        nextAction: "Run without --dry-run to write the escalation handoff and move the ticket to Backlog.",
      },
      { jsonOnly }
    );
    return;
  }

  const freshTicket = await readTicket(supabase, ticketId);
  assertTicketMutable(freshTicket, fromStatus || ticket.status);
  if (
    freshTicket.title !== ticket.title ||
    freshTicket.details !== ticket.details ||
    freshTicket.status !== ticket.status
  ) {
    throw new Error("Ticket changed before escalation; rerun dry-run from the current state.");
  }

  const updatedTicket = await updateTicket(supabase, ticketId, title, details);
  const movedTicket =
    updatedTicket.status === "backlog" ? updatedTicket : await moveTicketToBacklog(supabase, ticketId);

  emit(
    {
      ok: true,
      status: "escalated_ticket",
      ticket: movedTicket,
      nextAction: "Rerun intake when you want the next bounded incident.",
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
        nextAction: "Fix the blocker, then rerun npm run ophestivus:escalate-ticket.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export { DETAILS_MAX_LENGTH, buildEscalationDetails, buildHumanReviewTitle };
