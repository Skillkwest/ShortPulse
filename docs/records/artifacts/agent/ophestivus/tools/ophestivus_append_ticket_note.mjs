#!/usr/bin/env node
/* global console */

/**
 * Ophestivus append-ticket-note helper.
 *
 * Appends a compact note to one kanban ticket, predicts board length, and can
 * safely compact the note when requested.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "../../../../../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "../../../../../../scripts/lib/load_local_env.mjs";

const ACTOR_EMAIL = "ophestivus@local.agent";
const DETAILS_MAX_LENGTH = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET_SELECT_COLUMNS =
  "id,title,details,status,sort_order,created_at,updated_at,created_by,updated_by,archived_at";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:append-ticket-note -- --ticket <item-id> --note <text> --dry-run",
      "  npm run ophestivus:append-ticket-note -- --ticket <item-id> --label <label> --note <text> --compact",
      "",
      "Options:",
      "  --ticket <id>          Kanban item id.",
      "  --note <text>          Note body to append.",
      "  --label <text>         Optional note label. Defaults to Note.",
      "  --from-status <status> Optional stale-state guard; fail if current status differs.",
      "  --compact             Truncate the note to fit when possible.",
      "  --dry-run             Show length prediction without mutating Supabase.",
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

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, Math.max(0, maxLength));
  return `${text.slice(0, maxLength - 3)}...`;
};

const buildNote = ({ label = "Note", note }) => {
  const cleanLabel = normalizeText(label || "Note").slice(0, 80) || "Note";
  const cleanNote = normalizeText(note);
  if (!cleanNote) throw new Error("--note is required.");
  return `${cleanLabel}:\n${cleanNote}`;
};

const buildAppendedDetails = (
  details,
  note,
  { compact = false, maxLength = DETAILS_MAX_LENGTH } = {}
) => {
  const normalizedDetails = String(details ?? "").trim();
  const separator = normalizedDetails ? "\n\n" : "";
  const availableNoteLength = maxLength - normalizedDetails.length - separator.length;

  if (availableNoteLength < 24) {
    return {
      ok: false,
      details: normalizedDetails,
      note,
      compacted: false,
      currentLength: normalizedDetails.length,
      nextLength: normalizedDetails.length + separator.length + note.length,
      maxLength,
      error: `Ticket details leave only ${Math.max(0, availableNoteLength)} characters for a note.`,
    };
  }

  const nextNote = compact ? truncate(note, availableNoteLength) : note;
  const nextDetails = `${normalizedDetails}${separator}${nextNote}`;
  if (nextDetails.length > maxLength) {
    return {
      ok: false,
      details: nextDetails,
      note,
      compacted: false,
      currentLength: normalizedDetails.length,
      nextLength: nextDetails.length,
      maxLength,
      error: `Appended note would exceed ${maxLength} characters. Pass --compact or shorten the note.`,
    };
  }

  return {
    ok: true,
    details: nextDetails,
    note: nextNote,
    compacted: nextNote !== note,
    currentLength: normalizedDetails.length,
    nextLength: nextDetails.length,
    maxLength,
    remaining: maxLength - nextDetails.length,
    error: null,
  };
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
    console.error(`[ophestivus:append-ticket-note] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:append-ticket-note] ${payload.status}`);
  console.log(`Ticket: ${payload.ticket.id} (${payload.ticket.status})`);
  console.log(
    `Details length: ${payload.note.currentLength} -> ${payload.note.nextLength}/${payload.note.maxLength}`
  );
  if (payload.note.compacted) console.log("Note compacted to fit.");
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

const updateTicket = async (supabase, ticket, details) => {
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
  const fromStatus = readOption("--from-status")?.trim() || null;
  const note = buildNote({ label: readOption("--label") ?? "Note", note: readOption("--note") });

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

  const appendResult = buildAppendedDetails(ticket.details, note, {
    compact: hasFlag("--compact"),
    maxLength: DETAILS_MAX_LENGTH,
  });

  if (!appendResult.ok) {
    emit(
      {
        ok: false,
        error: appendResult.error,
        ticket,
        note: appendResult,
        nextAction: "Shorten the note, pass --compact, or compact existing ticket details first.",
      },
      { jsonOnly }
    );
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    emit(
      {
        ok: true,
        status: "dry_run_would_append_ticket_note",
        ticket,
        note: appendResult,
        nextAction: "Run without --dry-run to append the note.",
      },
      { jsonOnly }
    );
    return;
  }

  const freshTicket = await readTicket(supabase, ticket.id);
  if (!freshTicket) throw new Error("Ticket no longer exists.");
  if (freshTicket.archivedAt) throw new Error("Ticket was archived before note append.");
  if (freshTicket.status !== ticket.status || freshTicket.details !== ticket.details) {
    throw new Error("Ticket changed before note append; rerun dry-run from the current state.");
  }

  const updatedTicket = await updateTicket(supabase, ticket, appendResult.details);
  emit(
    {
      ok: true,
      status: "appended_ticket_note",
      ticket: updatedTicket,
      note: appendResult,
      nextAction: "Continue the active SOP with the updated ticket details.",
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
        nextAction: "Fix the blocker, then rerun npm run ophestivus:append-ticket-note.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export { DETAILS_MAX_LENGTH, buildAppendedDetails, buildNote };
