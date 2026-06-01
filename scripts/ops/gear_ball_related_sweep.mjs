#!/usr/bin/env node
/**
 * Gear Ball sibling-surface sweep helper.
 * Ranks likely adjacent files for a seed set before the first validation pass so
 * Gear Ball can widen the first manifest without over-reading the whole repo.
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
  console.error(`gear-ball related sweep: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  node scripts/ops/gear_ball_related_sweep.mjs --files <paths...>
  node scripts/ops/gear_ball_related_sweep.mjs --files-from <manifest>

Options:
  --threshold <n>   Minimum relation score to print (default: 5)
  --limit <n>       Maximum candidates to print (default: 40)

Purpose:
  Print likely sibling files for the supplied seed paths so Gear Ball can do one
  focused adjacent-surface sweep before the first validation pass.
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

function repoFiles() {
  const result = spawnSync("rg", ["--files"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) fail(result.stderr || "failed to read repo files");
  return result.stdout.split(/\r?\n/).map(normalizePath).filter(Boolean);
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const explicitFiles = collectFlagValues(args, "--files").map(normalizePath);
const filesFrom = singleFlagValue(args, "--files-from");
const seedFiles = [
  ...explicitFiles,
  ...(filesFrom ? readManifest(filesFrom) : []),
].filter(Boolean);

if (seedFiles.length === 0) fail("no seed files supplied");

const threshold = Number.parseInt(
  singleFlagValue(args, "--threshold", "5"),
  10,
);
const limit = Number.parseInt(singleFlagValue(args, "--limit", "40"), 10);
const candidates = rankCandidates(seedFiles, repoFiles())
  .filter((entry) => !seedFiles.includes(entry.candidate))
  .filter((entry) => entry.score >= threshold)
  .slice(0, limit);

if (candidates.length === 0) {
  console.log(
    "gear-ball related sweep\n\nno likely sibling files crossed the current threshold",
  );
  process.exit(0);
}

const lines = [
  "gear-ball related sweep",
  "",
  `seed files: ${seedFiles.length}`,
  `threshold: ${threshold}`,
  `results: ${candidates.length}`,
  "",
];

for (const entry of candidates) {
  lines.push(`[score ${entry.score}] ${entry.candidate}`);
  if (entry.via) lines.push(`  via: ${entry.via}`);
}

console.log(lines.join("\n"));
