#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function printHelp() {
  console.log(`Usage:
  node scripts/ops/gear_ball_manifest.mjs --batch-name "<name>" --reason "<reason>" --risk "<risk>" --validation "<checks>" [--write <path>] [--commit <hash>] [--push-status <status>] [--files <paths...>]

Defaults:
  - If --files is omitted, the current staged file list is used.
  - If --write is omitted, the markdown block is printed to stdout.
`);
}

function fail(message) {
  console.error(`gear-ball manifest: ${message}`);
  process.exit(1);
}

function normalizePath(value) {
  return value
    .replaceAll(path.sep, "/")
    .replace(/^\.\/+/, "")
    .trim();
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

function collectSingleValue(args, flag) {
  const values = collectFlagValues(args, flag);
  return values.length > 0 ? values.join(" ") : "";
}

function getStagedFiles() {
  const result = spawnSync("git", ["diff", "--cached", "--name-only"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) fail(result.stderr || "failed to read staged files");
  return result.stdout.split(/\r?\n/).map(normalizePath).filter(Boolean);
}

function groupFiles(files) {
  const counts = new Map();
  for (const file of files) {
    const parts = file.split("/");
    const group = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([group, count]) => `${group} (${count})`);
}

function toMarkdown({
  batchName,
  reason,
  risk,
  validation,
  files,
  commitHash,
  pushStatus,
}) {
  const groups = groupFiles(files);
  const lines = [
    `## ${batchName}`,
    "",
    `- Commit: ${commitHash || "`pending`"}`,
    `- Reason: ${reason || "Pending"}`,
    `- Risk: ${risk || "Pending"}`,
    `- Validation: ${validation || "Pending"}`,
    `- Push status: ${pushStatus || "Pending"}`,
    `- File groups: ${groups.length ? groups.join(", ") : "None"}`,
    `- Files (${files.length}):`,
    ...files.map((file) => `  - \`${file}\``),
    "",
  ];
  return lines.join("\n");
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const batchName = collectSingleValue(args, "--batch-name");
if (!batchName) fail("--batch-name is required");

const reason = collectSingleValue(args, "--reason");
const risk = collectSingleValue(args, "--risk");
const validation = collectSingleValue(args, "--validation");
const writeTarget = collectSingleValue(args, "--write");
const commitHash = collectSingleValue(args, "--commit");
const pushStatus = collectSingleValue(args, "--push-status");
const filesArg = collectFlagValues(args, "--files").map(normalizePath);
const files = filesArg.length > 0 ? filesArg : getStagedFiles();

if (files.length === 0) fail("no files available for manifest");

const markdown = toMarkdown({
  batchName,
  reason,
  risk,
  validation,
  files,
  commitHash,
  pushStatus,
});

if (!writeTarget) {
  console.log(markdown);
  process.exit(0);
}

const absoluteWriteTarget = path.isAbsolute(writeTarget)
  ? writeTarget
  : path.join(repoRoot, writeTarget);
const prefix = fs.existsSync(absoluteWriteTarget) ? "\n" : "";
fs.appendFileSync(absoluteWriteTarget, `${prefix}${markdown}`);
console.log(
  `wrote manifest to ${normalizePath(path.relative(repoRoot, absoluteWriteTarget))}`,
);
