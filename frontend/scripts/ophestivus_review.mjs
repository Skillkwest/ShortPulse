#!/usr/bin/env node
/* global console */

/**
 * Ophestivus review helper.
 *
 * Reads the first Review-column ticket or a named ticket, shows its details and
 * activity, and can append an approval note before moving it to Complete.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "../../scripts/lib/load_local_env.mjs";

const ACTOR_EMAIL = "ophestivus@local.agent";
const TICKET_SELECT_COLUMNS =
  "id,title,details,status,sort_order,created_at,updated_at,created_by,updated_by,archived_at";
const ACTIVITY_SELECT_COLUMNS =
  "id,item_id,action,from_status,to_status,note,actor_user_id,actor_email,created_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DETAILS_MAX_LENGTH = 1000;

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:review -- --dry-run",
      "  npm run ophestivus:review -- --ticket <item-id> --dry-run",
      "  npm run ophestivus:review -- --ticket <item-id> --approve",
      "",
      "Options:",
      "  --ticket <id>         Review a specific board item instead of the first Review item.",
      "  --approve             Append approval note and move the item to Complete.",
      "  --dry-run             Show what would happen without mutating Supabase.",
      "  --json                Print JSON only.",
      "  --reviewed-by <text>  Approval note reviewer label. Defaults to Ophestivus.",
      "  --validation <text>   Approval note validation summary.",
      "  --incident <text>     Approval note incident/data verification summary.",
      "  --risk <text>         Approval note residual risk summary.",
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

const truncate = (value, maxLength) => {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
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

const toActivity = (activity) => ({
  id: activity.id,
  itemId: activity.item_id,
  action: activity.action,
  fromStatus: activity.from_status,
  toStatus: activity.to_status,
  note: activity.note,
  actorUserId: activity.actor_user_id,
  actorEmail: activity.actor_email,
  createdAt: activity.created_at,
});

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:review] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:review] ${payload.status}`);
  if (payload.ticket) {
    console.log(`Ticket: ${payload.ticket.id} (${payload.ticket.status})`);
    console.log(`Title: ${payload.ticket.title}`);
    console.log(`Details length: ${payload.ticket.details.length}/${DETAILS_MAX_LENGTH}`);
  }
  if (payload.approval) {
    console.log(`Approval note length: ${payload.approval.note.length}`);
    console.log(
      `Details length after note: ${payload.approval.nextDetailsLength}/${DETAILS_MAX_LENGTH}`
    );
  }
  if (payload.activity?.length) {
    console.log(`Activity entries: ${payload.activity.length}`);
  }
  if (payload.nextAction) console.log(`Next: ${payload.nextAction}`);
};

const readFirstReviewTicket = async (supabase) => {
  const { data, error } = await supabase
    .from("admin_kanban_items")
    .select(TICKET_SELECT_COLUMNS)
    .eq("status", "review")
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ? toTicket(data[0]) : null;
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

const readTicketActivity = async (supabase, ticketId) => {
  const { data, error } = await supabase
    .from("admin_kanban_activity")
    .select(ACTIVITY_SELECT_COLUMNS)
    .eq("item_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toActivity);
};

const appendApprovalNote = (details, note) => {
  const normalizedDetails = String(details ?? "").trim();
  const nextDetails = normalizedDetails ? `${normalizedDetails}\n\n${note}` : note;
  if (nextDetails.length > DETAILS_MAX_LENGTH) {
    throw new Error(
      `Approval note would exceed ${DETAILS_MAX_LENGTH} characters. Shorten ticket details or approval fields before moving to Complete.`
    );
  }
  return nextDetails;
};

const firstDetailLineValue = (details, label) => {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, "i");
  for (const line of String(details ?? "").split(/\r?\n/)) {
    const match = line.trim().match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const inferResidualRiskFromDetails = (details) => {
  const riskClassification = firstDetailLineValue(details, "Residual risk classification");
  const residualRiskText = firstDetailLineValue(details, "Residual risk");
  const riskText = residualRiskText ?? firstDetailLineValue(details, "Risk");
  if (riskClassification && riskText) return `${riskClassification} - ${riskText}`;
  return riskClassification ?? residualRiskText ?? riskText;
};

const buildApprovalNote = ({
  reviewedBy,
  validation,
  incidentVerification,
  residualRisk,
  ticketDetails,
}) => {
  const resolvedResidualRisk =
    residualRisk ?? inferResidualRiskFromDetails(ticketDetails) ?? "None identified in review.";
  return [
    "Approval:",
    `Reviewed by: ${truncate(reviewedBy || "Ophestivus", 120)}`,
    "What was checked: Ticket details, latest activity, claimed validation, and applicable incident/data evidence.",
    `Validation: ${truncate(validation || "Review evidence accepted.", 180)}`,
    `Incident/data verification: ${truncate(incidentVerification || "No unresolved issue found in review evidence.", 180)}`,
    `Residual risk: ${truncate(resolvedResidualRisk, 180)}`,
    "Decision: moved to Complete.",
  ].join("\n");
};

const updateTicketDetails = async (supabase, ticket, details) => {
  const { data, error } = await supabase.rpc("update_admin_kanban_item", {
    p_item_id: ticket.id,
    p_title: ticket.title,
    p_details: details,
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });

  if (error) throw error;
  return toTicket(data);
};

const moveTicketToComplete = async (supabase, ticketId) => {
  const { data, error } = await supabase.rpc("move_admin_kanban_item", {
    p_item_id: ticketId,
    p_status: "complete",
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });

  if (error) throw error;
  return toTicket(data);
};

const assertTicketStillPromotable = (initialTicket, currentTicket) => {
  if (!currentTicket) throw new Error("Ticket no longer exists.");
  if (currentTicket.archivedAt) throw new Error("Ticket was archived during review.");
  if (currentTicket.id !== initialTicket.id)
    throw new Error("Ticket identity changed during review.");
  if (currentTicket.status !== "review") {
    throw new Error(`Ticket is no longer in Review; current status is ${currentTicket.status}.`);
  }
  if (
    currentTicket.title !== initialTicket.title ||
    currentTicket.details !== initialTicket.details
  ) {
    throw new Error(
      "Ticket title or details changed during review; restart from the current state."
    );
  }
};

const run = async () => {
  const dryRun = hasFlag("--dry-run");
  const approve = hasFlag("--approve");
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const ticketId = readOption("--ticket");
  if (ticketId && !UUID_PATTERN.test(ticketId)) {
    throw new Error("--ticket must be a UUID.");
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

  const ticket = ticketId
    ? await readTicket(supabase, ticketId)
    : await readFirstReviewTicket(supabase);
  if (!ticket) {
    emit(
      {
        ok: true,
        status: ticketId ? "ticket_not_found" : "no_review_tickets",
        ticket: null,
        activity: [],
        nextAction: ticketId
          ? "Check the ticket id or board state."
          : "No Review tickets are ready for approval.",
      },
      { jsonOnly }
    );
    return;
  }

  const activity = await readTicketActivity(supabase, ticket.id);
  if (ticket.status !== "review") {
    emit(
      {
        ok: true,
        status: "ticket_not_in_review",
        ticket,
        activity,
        nextAction: "Do not approve this ticket unless it returns to Review.",
      },
      { jsonOnly }
    );
    return;
  }

  const approvalNote = buildApprovalNote({
    reviewedBy: readOption("--reviewed-by"),
    validation: readOption("--validation"),
    incidentVerification: readOption("--incident"),
    residualRisk: readOption("--risk"),
    ticketDetails: ticket.details,
  });
  let nextDetails = null;
  let approvalError = null;
  try {
    nextDetails = appendApprovalNote(ticket.details, approvalNote);
  } catch (error) {
    approvalError = error instanceof Error ? error.message : String(error);
  }

  if (!approve || dryRun) {
    emit(
      {
        ok: true,
        status:
          approve && approvalError
            ? "dry_run_approval_note_blocked"
            : approve
              ? "dry_run_would_approve_review_ticket"
              : "review_ticket_found",
        ticket,
        activity,
        approval: {
          note: approvalNote,
          canAppend: !approvalError,
          error: approvalError,
          nextDetailsLength: nextDetails?.length ?? null,
        },
        nextAction: approve
          ? approvalError
            ? "Shorten ticket details or approval fields before moving to Complete."
            : "Run without --dry-run to append the approval note and move to Complete."
          : "Audit the evidence, then rerun with --approve when the ticket is ready for Complete.",
      },
      { jsonOnly }
    );
    return;
  }

  if (approvalError || !nextDetails) {
    throw new Error(approvalError ?? "Approval note could not be appended.");
  }

  const freshBeforeUpdate = await readTicket(supabase, ticket.id);
  assertTicketStillPromotable(ticket, freshBeforeUpdate);

  const updatedTicket = await updateTicketDetails(supabase, ticket, nextDetails);
  if (
    !updatedTicket ||
    updatedTicket.status !== "review" ||
    !updatedTicket.details.includes("Decision: moved to Complete.")
  ) {
    throw new Error("Approval note was not confirmed on the Review ticket.");
  }

  const movedTicket = await moveTicketToComplete(supabase, ticket.id);
  const finalActivity = await readTicketActivity(supabase, ticket.id);

  emit(
    {
      ok: true,
      status: "approved_review_ticket",
      ticket: movedTicket,
      activity: finalActivity,
      approval: {
        note: approvalNote,
        nextDetailsLength: updatedTicket.details.length,
      },
      nextAction:
        "Ticket moved to Complete. Leave Published untouched unless explicitly instructed.",
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
        nextAction: "Fix the blocker, then rerun npm run ophestivus:review.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export {
  appendApprovalNote,
  buildApprovalNote,
  inferResidualRiskFromDetails,
  readFirstReviewTicket,
  readTicket,
};
