#!/usr/bin/env node
/* global console */

/**
 * Ophestivus board move helper.
 *
 * Moves one active kanban ticket between allowed workflow columns with a
 * dry-run first path and a guard around Published.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "../../../../../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "../../../../../../scripts/lib/load_local_env.mjs";

const ACTOR_EMAIL = "ophestivus@local.agent";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["backlog", "in_progress", "review", "complete", "published"]);
const DEFAULT_ALLOWED_TARGETS = new Set(["backlog", "in_progress", "review", "complete"]);
const TICKET_SELECT_COLUMNS =
  "id,title,details,status,sort_order,created_at,updated_at,created_by,updated_by,archived_at";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:move-ticket -- --ticket <item-id> --status <status> --dry-run",
      "  npm run ophestivus:move-ticket -- --ticket <item-id> --status <status>",
      "",
      "Options:",
      "  --ticket <id>         Kanban item id.",
      "  --status <status>     backlog | in_progress | review | complete. Published requires --allow-published.",
      "  --from-status <status> Optional stale-state guard; fail if the current status differs.",
      "  --allow-published     Permit moving to published when explicitly authorized by the user.",
      "  --dry-run             Show the planned move without mutating Supabase.",
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

const normalizeStatus = (value, optionName) => {
  const status = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!STATUSES.has(status)) {
    throw new Error(`${optionName} must be one of: ${Array.from(STATUSES).join(", ")}.`);
  }
  return status;
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
    console.error(`[ophestivus:move-ticket] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:move-ticket] ${payload.status}`);
  console.log(`Ticket: ${payload.ticket.id} (${payload.ticket.status})`);
  console.log(`Title: ${payload.ticket.title}`);
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

const moveTicket = async (supabase, ticketId, status) => {
  const { data, error } = await supabase.rpc("move_admin_kanban_item", {
    p_item_id: ticketId,
    p_status: status,
    p_actor_user_id: null,
    p_actor_email: ACTOR_EMAIL,
  });

  if (error) throw error;
  return toTicket(data);
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
  const targetStatus = normalizeStatus(readOption("--status"), "--status");
  const fromStatusRaw = readOption("--from-status");
  const fromStatus = fromStatusRaw ? normalizeStatus(fromStatusRaw, "--from-status") : null;
  if (!DEFAULT_ALLOWED_TARGETS.has(targetStatus) && !hasFlag("--allow-published")) {
    throw new Error(
      "Moving to published requires --allow-published and explicit user authorization."
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

  const ticket = await readTicket(supabase, ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
  if (ticket.archivedAt) throw new Error("Ticket is archived.");
  if (fromStatus && ticket.status !== fromStatus) {
    throw new Error(`Ticket status is ${ticket.status}, expected ${fromStatus}.`);
  }

  if (dryRun || ticket.status === targetStatus) {
    emit(
      {
        ok: true,
        status:
          ticket.status === targetStatus
            ? "ticket_already_in_target_status"
            : "dry_run_would_move_ticket",
        ticket,
        targetStatus,
        nextAction:
          ticket.status === targetStatus
            ? "No move needed."
            : "Run without --dry-run to move the ticket.",
      },
      { jsonOnly }
    );
    return;
  }

  const freshTicket = await readTicket(supabase, ticketId);
  if (!freshTicket) throw new Error("Ticket no longer exists.");
  if (freshTicket.archivedAt) throw new Error("Ticket was archived before move.");
  if (freshTicket.status !== ticket.status) {
    throw new Error(
      `Ticket status changed from ${ticket.status} to ${freshTicket.status}; rerun dry-run.`
    );
  }

  const movedTicket = await moveTicket(supabase, ticketId, targetStatus);
  emit(
    {
      ok: true,
      status: "moved_ticket",
      ticket: movedTicket,
      previousStatus: ticket.status,
      targetStatus,
      nextAction: "Continue the active SOP from the new board status.",
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
        nextAction: "Fix the blocker, then rerun npm run ophestivus:move-ticket.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export { DEFAULT_ALLOWED_TARGETS, STATUSES, normalizeStatus };
