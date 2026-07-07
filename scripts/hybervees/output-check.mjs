#!/usr/bin/env node

/**
 * Checks Hybervees owner summaries, backlog items, and report mirrors.
 */

import fs from "node:fs";
import path from "node:path";
import {
  fail,
  parseArgs,
  repoRoot,
  repoRelativePath,
  requireExistingRepoFile,
  resolveRepoPath,
} from "./common.mjs";

const FORBIDDEN_SUMMARY_PATTERNS = [
  /^##\s+Do Not Overreact\b/im,
  /^##\s+Best Next Owner\b/im,
  /\bBest Next Owner\b/i,
  /\bDo Not Overreact\b/i,
  /^##\s+Owner Routing\b/im,
  /^##\s+Routing\b/im,
  /^##\s+Lane Assignment\b/im,
];

const REQUIRED_SUMMARY_HEADINGS = [
  /^##\s+Short Version\b/im,
  /^##\s+What This Means\b/im,
  /^##\s+Do This\b/im,
];

const REQUIRED_BACKLOG_FIELDS = [
  "Problem:",
  "Why it matters:",
  "First action:",
  "Acceptance criteria:",
  "Validation:",
  "Non-goals:",
];

const usage = () => {
  console.log(`Usage:
  node scripts/hybervees/output-check.mjs [--summary <path>] [--backlog-source <path>] [--mirror <source:target>]

Options:
  --summary <path>        Owner-summary file to check. Repeatable.
                          Defaults to all Hybervees owner summaries.
  --backlog-source <path> Check the backlog line that cites this source path. Repeatable.
  --mirror <src:dst>      Require two files to exist and match exactly. Repeatable.
  --help                  Show this message.
`);
};

function listDefaultSummaries() {
  const roots = [
    "docs/records/artifacts/agent/hybervees/reports",
    "docs/agents/hybervees/workspace/reports",
  ];
  const summaries = [];
  for (const root of roots) {
    const absoluteRoot = resolveRepoPath(root);
    if (!fs.existsSync(absoluteRoot)) continue;
    for (const entry of fs.readdirSync(absoluteRoot)) {
      if (entry.endsWith("-owner-summary.md")) {
        summaries.push(path.join(root, entry));
      }
    }
  }
  return summaries.sort();
}

function checkSummary(filePath, failures) {
  const resolved = requireExistingRepoFile(filePath, "summary");
  const content = fs.readFileSync(resolved, "utf8");
  const relPath = repoRelativePath(resolved);

  for (const pattern of FORBIDDEN_SUMMARY_PATTERNS) {
    if (pattern.test(content)) {
      failures.push(
        `${relPath}: contains forbidden owner-summary section or phrase (${pattern})`,
      );
    }
  }

  for (const heading of REQUIRED_SUMMARY_HEADINGS) {
    if (!heading.test(content)) {
      failures.push(
        `${relPath}: missing required owner-summary heading (${heading})`,
      );
    }
  }
}

function checkBacklogSource(sourcePath, failures) {
  const backlogPath = "docs/planning/backlog.md";
  const backlog = fs.readFileSync(resolveRepoPath(backlogPath), "utf8");
  const normalizedSource = repoRelativePath(sourcePath);
  const line = backlog
    .split(/\r?\n/)
    .find((candidate) => candidate.includes(normalizedSource));
  if (!line) {
    failures.push(`${backlogPath}: no backlog item cites ${normalizedSource}`);
    return;
  }

  for (const field of REQUIRED_BACKLOG_FIELDS) {
    if (!line.includes(field)) {
      failures.push(
        `${backlogPath}: backlog item for ${normalizedSource} missing ${field}`,
      );
    }
  }
  if (!line.includes("Source:") && !line.includes("Sources:")) {
    failures.push(
      `${backlogPath}: backlog item for ${normalizedSource} missing Source/Sources`,
    );
  }
}

function checkMirror(value, failures) {
  const [source, target, extra] = value.split(":");
  if (!source || !target || extra !== undefined) {
    failures.push(`Invalid --mirror value: ${value}. Use source:target`);
    return;
  }
  const sourcePath = requireExistingRepoFile(source, "mirror source");
  const targetPath = requireExistingRepoFile(target, "mirror target");
  const sourceContent = fs.readFileSync(sourcePath, "utf8");
  const targetContent = fs.readFileSync(targetPath, "utf8");
  if (sourceContent !== targetContent) {
    failures.push(
      `${repoRelativePath(source)} and ${repoRelativePath(target)} do not match`,
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("--help")) {
    usage();
    return;
  }

  const failures = [];
  const summaries = args.repeated.get("--summary") || listDefaultSummaries();
  const backlogSources = args.repeated.get("--backlog-source") || [];
  const mirrors = args.repeated.get("--mirror") || [];

  for (const summary of summaries) {
    checkSummary(summary, failures);
  }
  for (const source of backlogSources) {
    checkBacklogSource(source, failures);
  }
  for (const mirror of mirrors) {
    checkMirror(mirror, failures);
  }

  if (failures.length > 0) {
    console.error("[hybervees-output-check] failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `[hybervees-output-check] ok summaries=${summaries.length} backlogSources=${backlogSources.length} mirrors=${mirrors.length}`,
  );
}

try {
  main();
} catch (error) {
  fail(error.message);
}
