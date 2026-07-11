#!/usr/bin/env node

/**
 * Syncs docs/planning/backlog.md into the admin Ophestivus Kanban board.
 *
 * The Markdown backlog remains canonical. This command parses it, then calls
 * the service-role-only sync RPC in dry-run or apply mode so the board is a
 * typed mirror with audit history.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "./lib/load_local_env.mjs";
import {
  DEFAULT_BACKLOG_SOURCE_PATH,
  parsePlanningBacklogMarkdown,
} from "./lib/planning_backlog_parser.mjs";

const ACTOR_EMAIL = "admin-kanban-backlog-sync@local.script";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm -C frontend run admin-kanban:sync-backlog -- --dry-run",
      "  npm -C frontend run admin-kanban:sync-backlog -- --apply",
      "",
      "Options:",
      "  --dry-run          Parse and ask the sync RPC for planned changes.",
      "  --apply            Apply the sync through the admin Kanban sync RPC.",
      "  --json             Print JSON only.",
      "  --backlog <path>   Backlog Markdown path. Defaults to docs/planning/backlog.md.",
      "  --env-file <path>  Load a local env file. Can be repeated.",
      "  --help            Show this help.",
      "",
      "Required env for RPC dry-run/apply:",
      "  NEXT_PUBLIC_SUPABASE_URL",
      "  SUPABASE_SERVICE_ROLE_KEY",
    ].join("\n"),
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

const formatError = (error) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message =
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : null;
    const details =
      typeof error.details === "string" && error.details.trim()
        ? error.details.trim()
        : null;
    const hint =
      typeof error.hint === "string" && error.hint.trim()
        ? error.hint.trim()
        : null;
    const code =
      typeof error.code === "string" && error.code.trim()
        ? error.code.trim()
        : null;
    return [message, details, hint, code ? `code=${code}` : null]
      .filter(Boolean)
      .join(" ");
  }
  return String(error);
};

const resolveRepoPath = (repoRelativePath) =>
  path.resolve(process.cwd(), repoRelativePath);

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[admin-kanban:sync-backlog] ${payload.error}`);
    if (payload.errors?.length) {
      for (const error of payload.errors) console.error(`- ${error}`);
    }
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[admin-kanban:sync-backlog] ${payload.status}`);
  console.log(`Parsed items: ${payload.parsedCount}`);
  if (payload.summary) {
    console.log(`Created: ${payload.summary.created ?? 0}`);
    console.log(`Updated: ${payload.summary.updated ?? 0}`);
    console.log(`Unchanged: ${payload.summary.unchanged ?? 0}`);
    console.log(`Skipped archived: ${payload.summary.skippedArchived ?? 0}`);
    console.log(`Marked missing: ${payload.summary.markedMissing ?? 0}`);
  }
};

const callSyncRpc = async ({ items, apply }) => {
  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: [".env.agent.local", "frontend/.env.local", ".env.local"],
  });
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase.rpc(
    "sync_admin_kanban_planning_backlog_items",
    {
      p_items: items,
      p_actor_user_id: null,
      p_actor_email: ACTOR_EMAIL,
      p_dry_run: !apply,
    },
  );
  if (error) throw error;
  return data;
};

const run = async () => {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const apply = hasFlag("--apply");
  const dryRun = hasFlag("--dry-run") || !apply;
  const jsonOnly = hasFlag("--json");
  const backlogPath = readOption("--backlog") ?? DEFAULT_BACKLOG_SOURCE_PATH;
  const absoluteBacklogPath = resolveRepoPath(backlogPath);

  if (!fs.existsSync(absoluteBacklogPath)) {
    throw new Error(`Backlog file not found: ${backlogPath}`);
  }
  if (apply && hasFlag("--dry-run")) {
    throw new Error("Choose either --dry-run or --apply, not both.");
  }

  const markdown = fs.readFileSync(absoluteBacklogPath, "utf8");
  const parsed = parsePlanningBacklogMarkdown(markdown, {
    sourcePath: backlogPath,
  });
  if (parsed.errors.length > 0) {
    emit(
      {
        ok: false,
        error: "Backlog parser failed.",
        errors: parsed.errors,
        nextAction:
          "Add or repair kanban id comments in docs/planning/backlog.md.",
      },
      { jsonOnly },
    );
    process.exitCode = 1;
    return;
  }

  const summary = await callSyncRpc({ items: parsed.items, apply });
  emit(
    {
      ok: true,
      status: dryRun ? "dry_run_complete" : "sync_applied",
      parsedCount: parsed.items.length,
      summary,
    },
    { jsonOnly },
  );
};

run().catch((error) => {
  emit(
    {
      ok: false,
      error: formatError(error),
    },
    { jsonOnly: hasFlag("--json") },
  );
  process.exitCode = 1;
});
