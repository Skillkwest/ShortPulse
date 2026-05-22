#!/usr/bin/env node
/**
 * Gear Ball worktree grouping helper.
 * Summarizes `git status --short` by top-level area so mixed worktrees are
 * faster to classify into likely lanes during leftover audits.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function printHelp() {
  console.log(`Usage:
  node scripts/ops/gear_ball_status_groups.mjs

Purpose:
  Print the current worktree grouped by top-level area so mixed Gear Ball runs can
  spot likely lane boundaries faster.
`);
}

function fail(message) {
  console.error(`gear-ball status groups: ${message}`);
  process.exit(1);
}

function normalizePath(value) {
  return value
    .replaceAll(path.sep, "/")
    .replace(/^\.\/+/, "")
    .trim();
}

function classifyGroup(filePath) {
  const parts = filePath.split("/");
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

function parseStatusLine(line) {
  if (!line.trim()) return null;
  if (line.startsWith("?? ")) {
    return {
      staged: "?",
      unstaged: "?",
      path: normalizePath(line.slice(3)),
    };
  }

  const staged = line[0] ?? " ";
  const unstaged = line[1] ?? " ";
  const payload = line.slice(3).trim();
  const renamedParts = payload.split(" -> ");
  const filePath = normalizePath(renamedParts.at(-1) ?? payload);

  return {
    staged,
    unstaged,
    path: filePath,
  };
}

function getStatusEntries() {
  const result = spawnSync("git", ["status", "--short"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    fail(result.stderr || "failed to read git status");
  }

  return result.stdout.split(/\r?\n/).map(parseStatusLine).filter(Boolean);
}

function formatBucket(entries) {
  if (entries.length === 0) return ["  (none)"];
  return entries.map((entry) => {
    const state = `${entry.staged}${entry.unstaged}`.replaceAll(" ", ".");
    return `  [${state}] ${entry.path}`;
  });
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const entries = getStatusEntries();
if (entries.length === 0) {
  console.log("gear-ball status groups\n\nworktree is clean");
  process.exit(0);
}

const grouped = new Map();
for (const entry of entries) {
  const group = classifyGroup(entry.path);
  const bucket = grouped.get(group) ?? [];
  bucket.push(entry);
  grouped.set(group, bucket);
}

const sortedGroups = [...grouped.entries()].sort(
  (left, right) =>
    right[1].length - left[1].length || left[0].localeCompare(right[0]),
);

const output = [
  "gear-ball status groups",
  "",
  `total entries: ${entries.length}`,
  "",
];
for (const [group, groupEntries] of sortedGroups) {
  output.push(`${group} (${groupEntries.length})`);
  output.push(...formatBucket(groupEntries));
  output.push("");
}

console.log(output.join("\n").trimEnd());
