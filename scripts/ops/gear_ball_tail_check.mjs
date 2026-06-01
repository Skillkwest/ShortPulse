#!/usr/bin/env node
/**
 * Gear Ball post-commit tail checker.
 * Compares the live `git status --short` against a just-committed lane manifest
 * and ranks remaining files by likely relation so late tails are easier to fold
 * back into the right lane before push.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath, rankCandidates } from "./gear_ball_path_relations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function fail(message) {
  console.error(`gear-ball tail check: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  node scripts/ops/gear_ball_tail_check.mjs --files <paths...>
  node scripts/ops/gear_ball_tail_check.mjs --files-from <manifest>

Options:
  --threshold <n>   Score at or above this value is treated as likely related (default: 4)

Purpose:
  Rank the remaining live worktree files against a just-validated lane so Gear
  Ball can tell "fold this back in" from "new lane" faster during convergence.
`);
}

function collectFlagValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) continue;
    for (let cursor = index + 1; cursor < args.length; cursor += 1) {
      const candidate = args[cursor];
      if (!candidate || candidate.startsWith("--")) break;
      values.push(candidate);
    }
  }
  return values;
}

function singleFlagValue(args, flag, fallback = "") {
  const values = collectFlagValues(args, flag);
  return values[0] ?? fallback;
}

function readManifest(filePath) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(repoRoot, filePath);
  if (!fs.existsSync(absolutePath)) fail(`manifest not found: ${filePath}`);
  return fs
    .readFileSync(absolutePath, "utf8")
    .split(/\r?\n/)
    .map(normalizePath)
    .filter(Boolean);
}

function parseStatusLine(line) {
  if (!line.trim()) return null;
  if (line.startsWith("?? ")) {
    return { state: "??", path: normalizePath(line.slice(3)) };
  }
  const state = `${line[0] ?? " "}${line[1] ?? " "}`.replaceAll(" ", ".");
  const payload = line.slice(3).trim();
  const renamedParts = payload.split(" -> ");
  const filePath = normalizePath(renamedParts.at(-1) ?? payload);
  return { state, path: filePath };
}

function liveStatusEntries() {
  const result = spawnSync("git", ["status", "--short"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) fail(result.stderr || "failed to read git status");
  return result.stdout.split(/\r?\n/).map(parseStatusLine).filter(Boolean);
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const explicitFiles = collectFlagValues(args, "--files").map(normalizePath);
const filesFrom = singleFlagValue(args, "--files-from");
const laneFiles = [
  ...explicitFiles,
  ...(filesFrom ? readManifest(filesFrom) : []),
].filter(Boolean);
if (laneFiles.length === 0) fail("no lane files supplied");

const threshold = Number.parseInt(
  singleFlagValue(args, "--threshold", "4"),
  10,
);
const statusEntries = liveStatusEntries();
if (statusEntries.length === 0) {
  console.log("gear-ball tail check\n\nworktree is clean");
  process.exit(0);
}

const ranked = rankCandidates(
  laneFiles,
  statusEntries.map((entry) => entry.path),
).map((entry) => ({
  ...entry,
  state:
    statusEntries.find((statusEntry) => statusEntry.path === entry.candidate)
      ?.state ?? "..",
}));

const likelyRelated = ranked.filter((entry) => entry.score >= threshold);
const likelySeparate = ranked.filter((entry) => entry.score < threshold);

const lines = [
  "gear-ball tail check",
  "",
  `lane files: ${laneFiles.length}`,
  `live tails: ${statusEntries.length}`,
  `related threshold: ${threshold}`,
  "",
];

if (likelyRelated.length > 0) {
  lines.push("likely related");
  for (const entry of likelyRelated) {
    lines.push(`  [${entry.state}] score ${entry.score} ${entry.candidate}`);
    if (entry.via) lines.push(`    via: ${entry.via}`);
  }
  lines.push("");
}

if (likelySeparate.length > 0) {
  lines.push("likely separate lane");
  for (const entry of likelySeparate) {
    lines.push(`  [${entry.state}] score ${entry.score} ${entry.candidate}`);
    if (entry.via) lines.push(`    via: ${entry.via}`);
  }
}

console.log(lines.join("\n").trimEnd());
