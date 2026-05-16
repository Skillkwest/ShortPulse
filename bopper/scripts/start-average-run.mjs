#!/usr/bin/env node

/**
 * Creates a dated Bopper run packet and report shells.
 * This keeps average-user run logging mechanical instead of ad hoc.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const usage = () => {
  console.log(`Usage:
  node bopper/scripts/start-average-run.mjs --slug <name> [options]

Options:
  --slug <name>            Required short run name, e.g. dashboard-first-click
  --task <text>            Optional one-line task summary for the generated templates
  --environment <name>     Optional environment label. Default: local
  --base-url <url>         Optional base URL for the generated templates
  --help                   Show this message.
`);
};

const parseFlagValue = (argv, flag, required = false) => {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value.`);
    }
    return value.trim();
  }
  if (required) {
    throw new Error(`${flag} is required.`);
  }
  return null;
};

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ensureDirectory = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const writeIfMissing = (filePath, content) => {
  if (fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, content);
  return true;
};

const formatDateParts = (date) => {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return { yyyy, mm, dd, hh, min, ss };
};

const buildNotesTemplate = ({ dateLabel, task, environment, baseUrl }) => `# Bopper Run Notes

Purpose: chronological scratch log for one supervised Bopper run.

## Run Metadata

- Date: ${dateLabel}
- Task: ${task}
- Environment: ${environment}
- Base URL: ${baseUrl}
- Interaction fidelity:
- Audit user:

## Chronological Log

1. Startup context loaded:
2. Visible route entered:
3. First click:
4. Next obvious action:
5. Confusion noticed:
6. Abandonment point:
7. Evidence captured:
8. Code/doc surface inspected:

## Raw Findings

- Blockers:
- Functional issues:
- UI / UX notes:

## End Of Run

- Detailed report path:
- Checkpoint summary path:
- Retained report path:
- D-Bug handoff path:
- Training-history update needed:
`;

const buildDetailedReportTemplate = ({ dateLabel, slug, task, environment, baseUrl }) =>
  `# Bopper Report - ${dateLabel} - ${slug}

Purpose: ${task}.

## Task

- Requested work: ${task}
- Environment: ${environment}
- Base URL: ${baseUrl}
- Interaction fidelity:

## Naive-User Path

- Entry route:
- First click:
- Next obvious action:
- What Bopper expected:
- What Bopper ignored:

## Findings

### Blockers

- None yet.

### Functional Issues

- None yet.

### UI / UX Notes

- None yet.

## Evidence

- Screenshots:
- Runtime signals:
- Code/doc surfaces:
`;

const buildCheckpointSummaryTemplate = ({ dateLabel, task, environment }) =>
  `# Bopper Checkpoint Summary - ${dateLabel}

Purpose: short trainer-facing summary for the Bopper run: ${task}.

## Snapshot

- Environment: ${environment}
- Tried:
- Worked:
- Failed:
- Abandonment point:
- Detailed report:
- Retained report:
- D-Bug handoff:
`;

const buildRetainedReportTemplate = ({ dateLabel, slug, task, environment, baseUrl }) =>
  `# Bopper Run Report - ${dateLabel} - ${slug}

Purpose: ${task}.

## Task

- Requested work: ${task}
- Environment: ${environment}
- Base URL: ${baseUrl}
- Runtime project ref:
- Audit user:
- Trainer directives consulted:
- Tools used:

## Scope

- Routes covered:
- Primary naive-user journey:
- What was intentionally skipped:
- Route success target:

## Action Log

| Step | Surface | Action | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | \`<route or tool>\` | \`<what Bopper clicked>\` | \`<what happened>\` | \`<screenshot/json/code>\` |

## Findings

### Blockers

- None yet.

### Functional Issues

- None yet.

### UI / UX Notes

- None yet.

## Average-User Lens

- first click:
- what Bopper expected:
- what actually happened:
- what Bopper ignored:
- what Bopper misunderstood:
- abandonment point:

## Code Follow-Up

- Probable code surfaces:
- Supporting docs or tests inspected:
- What another agent should inspect first:

## Evidence Packet

- JSON packet:
- Screenshots:
- Console / runtime signals:
- Local code references:

## Self Audit

- Score out of 10:
- Confidence tag:
- Hard gate triggered:
- What felt strong:
- What slipped:
- Weakest category:
- Next-run drill:

## Training Record

- Memory / training-history update needed?: <yes/no and why>
`;

const main = async () => {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    return;
  }

  const repoRoot = process.cwd();
  const rawSlug = parseFlagValue(argv, "--slug", true);
  const slug = slugify(rawSlug);
  if (!slug) {
    throw new Error("Slug must contain at least one alphanumeric character.");
  }

  const task = parseFlagValue(argv, "--task") ?? slug.replace(/-/g, " ");
  const environment = parseFlagValue(argv, "--environment") ?? "local";
  const baseUrl = parseFlagValue(argv, "--base-url") ?? "http://localhost:3000";
  const now = new Date();
  const { yyyy, mm, dd, hh, min, ss } = formatDateParts(now);
  const dateLabel = `${yyyy}-${mm}-${dd}`;
  const timestampLabel = `${yyyy}-${mm}-${dd}-${hh}${min}${ss}`;
  const datedSlug = `${dateLabel}-${environment}-${slug}`;

  const runDir = path.join(repoRoot, "bopper", "runs", `${timestampLabel}-${slug}`);
  const evidenceDir = path.join(runDir, "evidence");
  const notesPath = path.join(runDir, "notes.md");
  const detailedReportPath = path.join(repoRoot, "bopper", "reports", `${datedSlug}.md`);
  const checkpointSummaryPath = path.join(
    repoRoot,
    "bopper",
    "checkpoint-summaries",
    `${datedSlug}-summary.md`
  );
  const retainedReportPath = path.join(
    repoRoot,
    "docs",
    "records",
    "artifacts",
    "agent",
    "bopper",
    "reports",
    `${datedSlug}.md`
  );

  ensureDirectory(evidenceDir);
  ensureDirectory(path.dirname(detailedReportPath));
  ensureDirectory(path.dirname(checkpointSummaryPath));
  ensureDirectory(path.dirname(retainedReportPath));

  const templateParams = { dateLabel, slug, task, environment, baseUrl };

  const createdNotes = writeIfMissing(notesPath, buildNotesTemplate(templateParams));
  const createdDetailedReport = writeIfMissing(
    detailedReportPath,
    buildDetailedReportTemplate(templateParams)
  );
  const createdCheckpointSummary = writeIfMissing(
    checkpointSummaryPath,
    buildCheckpointSummaryTemplate(templateParams)
  );
  const createdRetainedReport = writeIfMissing(
    retainedReportPath,
    buildRetainedReportTemplate(templateParams)
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        task,
        environment,
        baseUrl,
        runDir,
        evidenceDir,
        notesPath,
        detailedReportPath,
        checkpointSummaryPath,
        retainedReportPath,
        createdNotes,
        createdDetailedReport,
        createdCheckpointSummary,
        createdRetainedReport,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
