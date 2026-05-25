#!/usr/bin/env node
/* global console */

/**
 * Ophestivus run-log helper.
 *
 * Writes a local markdown SOP run report under the Ophestivus artifact folder.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_REPORTS_DIR = "../docs/records/artifacts/agent/ophestivus/reports";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:run-log -- --title <text> --summary <text> --dry-run",
      "  npm run ophestivus:run-log -- --ticket <id> --incident <id> --title <text> --summary <text>",
      "",
      "Options:",
      "  --title <text>       Report title.",
      "  --summary <text>     Short summary.",
      "  --ticket <id>        Optional kanban ticket id.",
      "  --incident <id>      Optional Admin Errors incident id.",
      "  --status <text>      Final status. Defaults to complete.",
      "  --changes <text>     Change summary.",
      "  --validation <text>  Validation summary.",
      "  --risk <text>        Residual risk summary.",
      "  --output <path>      Optional markdown output path.",
      "  --dry-run            Print the planned file without writing.",
      "  --json               Print JSON only.",
      "  --help               Show this help.",
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

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "ophestivus-run";

const requireText = (optionName) => {
  const value = normalizeText(readOption(optionName));
  if (!value) throw new Error(`${optionName} is required.`);
  return value;
};

const normalizeOptionalUuid = (value, optionName) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (!UUID_PATTERN.test(normalized)) throw new Error(`${optionName} must be a UUID.`);
  return normalized;
};

const buildRunLogMarkdown = ({
  title,
  ticketId,
  incidentId,
  status = "complete",
  summary,
  changes,
  validation,
  risk,
  createdAt,
}) =>
  [
    `# ${title}`,
    "",
    `- Created: ${createdAt}`,
    `- Status: ${status}`,
    ticketId ? `- Ticket: ${ticketId}` : null,
    incidentId ? `- Incident: ${incidentId}` : null,
    "",
    "## Summary",
    "",
    summary || "No summary provided.",
    "",
    "## Changes",
    "",
    changes || "No repo changes recorded.",
    "",
    "## Validation",
    "",
    validation || "No validation recorded.",
    "",
    "## Residual Risk",
    "",
    risk || "None recorded.",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

const finalizeRunLogMarkdown = ({
  markdown,
  status = "complete",
  boardStatus = "complete",
  finalizedAt,
}) => {
  const lines = String(markdown ?? "").split("\n");
  const statusLine = `- Status: ${status}`;
  const boardStatusLine = `- Final board status: ${boardStatus}`;
  const finalizedLine = finalizedAt ? `- Finalized: ${finalizedAt}` : null;

  const statusIndex = lines.findIndex((line) => line.startsWith("- Status:"));
  if (statusIndex >= 0) {
    lines[statusIndex] = statusLine;
  } else {
    lines.splice(1, 0, "", statusLine);
  }

  const resolvedStatusIndex = lines.findIndex((line) => line === statusLine);
  const boardStatusIndex = lines.findIndex((line) => line.startsWith("- Final board status:"));
  if (boardStatusIndex >= 0) {
    lines[boardStatusIndex] = boardStatusLine;
  } else {
    lines.splice(resolvedStatusIndex + 1, 0, boardStatusLine);
  }

  if (finalizedLine) {
    const finalizedIndex = lines.findIndex((line) => line.startsWith("- Finalized:"));
    const insertIndex = lines.findIndex((line) => line === boardStatusLine);
    if (finalizedIndex >= 0) {
      lines[finalizedIndex] = finalizedLine;
    } else {
      lines.splice(insertIndex + 1, 0, finalizedLine);
    }
  }

  return lines.join("\n");
};

const resolveOutputPath = ({ output, title, ticketId, incidentId, createdAt }) => {
  if (output) return path.resolve(process.cwd(), output);
  const datePrefix = createdAt.slice(0, 10);
  const suffix = [ticketId?.slice(0, 8), incidentId?.slice(0, 8)].filter(Boolean).join("-");
  const filename = `${datePrefix}-${slugify(title)}${suffix ? `-${suffix}` : ""}.md`;
  return path.resolve(process.cwd(), DEFAULT_REPORTS_DIR, filename);
};

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:run-log] ${payload.error}`);
    if (payload.nextAction) console.error(`Next: ${payload.nextAction}`);
    return;
  }

  console.log(`[ophestivus:run-log] ${payload.status}`);
  console.log(`Path: ${payload.path}`);
  if (payload.nextAction) console.log(`Next: ${payload.nextAction}`);
};

const run = async () => {
  const dryRun = hasFlag("--dry-run");
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const title = requireText("--title");
  const ticketId = normalizeOptionalUuid(readOption("--ticket"), "--ticket");
  const incidentId = normalizeOptionalUuid(readOption("--incident"), "--incident");
  const createdAt = new Date().toISOString();
  const markdown = buildRunLogMarkdown({
    title,
    ticketId,
    incidentId,
    status: normalizeText(readOption("--status")) || "complete",
    summary: normalizeText(readOption("--summary")),
    changes: normalizeText(readOption("--changes")),
    validation: normalizeText(readOption("--validation")),
    risk: normalizeText(readOption("--risk")),
    createdAt,
  });
  const outputPath = resolveOutputPath({
    output: readOption("--output"),
    title,
    ticketId,
    incidentId,
    createdAt,
  });

  if (dryRun) {
    emit(
      {
        ok: true,
        status: "dry_run_would_write_run_log",
        path: outputPath,
        markdown,
        nextAction: "Run without --dry-run to write the run log.",
      },
      { jsonOnly }
    );
    return;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");
  emit(
    {
      ok: true,
      status: "wrote_run_log",
      path: outputPath,
      markdownLength: markdown.length,
      nextAction: "Reference this local report alongside the kanban ticket when useful.",
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
        nextAction: "Fix the input, then rerun npm run ophestivus:run-log.",
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  });
}

export {
  DEFAULT_REPORTS_DIR,
  buildRunLogMarkdown,
  finalizeRunLogMarkdown,
  resolveOutputPath,
  slugify,
};
