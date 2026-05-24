#!/usr/bin/env node

/**
 * Creates a dated Beeper training packet and retained-report skeleton.
 * This keeps supervised run logging mechanical instead of ad hoc.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const usage = () => {
  console.log(`Usage:
  node docs/agents/beeper/workspace/scripts/start-training-run.mjs --slug <name> [options]

Options:
  --slug <name>            Required short run name, e.g. dashboard-audit
  --task <text>            Optional one-line task summary for the generated templates
  --environment <name>     Optional environment label. Default: local
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

const buildNotesTemplate = ({
  dateLabel,
  task,
  environment,
}) => `# Beeper Training Run Notes

Purpose: chronological scratch log for one supervised Beeper run.

## Run Metadata

- Date: ${dateLabel}
- Task: ${task}
- Environment: ${environment}
- Base URL:
- Runtime project ref:

## Chronological Log

1. Startup context loaded:
2. Route or surface opened:
3. Interaction performed:
4. Evidence captured:
5. Issue noticed:
6. Code/doc surface inspected:
7. Handoff note drafted:

## Raw Findings

- Blockers:
- Functional issues:
- UI / UX notes:

## End Of Run

- Retained report path:
- Redacted evidence manifest:
- Local raw evidence cache:
- Training-history update needed:
`;

const buildReportTemplate = ({ dateLabel, slug, task, environment }) =>
  `# Beeper Run Report - ${dateLabel} - ${slug}

Purpose: ${task}.

## Task

- Requested work: ${task}
- Environment: ${environment}
- Base URL:
- Runtime project ref:
- Audit user:

## Scope

- Routes covered:
- Primary user journey:
- What was intentionally skipped:

## Action Log

| Step | Surface | Action | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | \`<route or tool>\` | \`<what Beeper did>\` | \`<what happened>\` | \`<screenshot/json/code>\` |

## Findings

### Blockers

- None yet.

### Functional Issues

- None yet.

### UI / UX Notes

- None yet.

## Code Follow-Up

- Probable code surfaces:
- Supporting docs or tests inspected:
- What another agent should inspect first:

## Evidence Packet

- Redacted evidence manifest:
- Local raw evidence cache:
- Console / runtime signals:
- Local code references:

## Self Audit

- Score out of 10:
- What felt strong:
- What slipped:
- What assumptions were made:
- Smallest improvement for the next run:

## Training Record

- New helper or script needed?: <yes/no and why>
- Existing helper update needed?: <yes/no and why>
- SOP / checklist update needed?: <yes/no and why>
- Memory / training-history update needed?: <yes/no and why>
`;

const buildEvidenceManifestTemplate = ({
  dateLabel,
  task,
  environment,
  rawEvidenceDir,
}) => `# Beeper Evidence Manifest

Purpose: redacted tracked reference for one Beeper run's raw evidence.

## Run Metadata

- Date: ${dateLabel}
- Task: ${task}
- Environment: ${environment}
- Local raw evidence cache: ${rawEvidenceDir}

## Redacted Inventory

| Artifact | Type | Why it was captured | Sensitivity | Keep tracked? |
| --- | --- | --- | --- | --- |
| \`<name>\` | \`<png/json/etc>\` | \`<proof purpose>\` | \`<none/user-id/signed-url/token>\` | \`no\` |

## Durable Product Signal

- Validated behavior:
- Failure or friction preserved:
- Best human-readable report:
- D-Bug handoff:
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
  const now = new Date();
  const { yyyy, mm, dd, hh, min, ss } = formatDateParts(now);
  const dateLabel = `${yyyy}-${mm}-${dd}`;
  const timestampLabel = `${yyyy}-${mm}-${dd}-${hh}${min}${ss}`;

  const runDir = path.join(
    repoRoot,
    "docs",
    "agents",
    "beeper",
    "workspace",
    "runs",
    `${timestampLabel}-${slug}`,
  );
  const evidenceManifestPath = path.join(runDir, "evidence-manifest.md");
  const rawEvidenceDir = path.join(
    repoRoot,
    "docs",
    "agents",
    "beeper",
    "workspace",
    "evidence-cache",
    `${timestampLabel}-${slug}`,
  );
  const notesPath = path.join(runDir, "notes.md");
  const reportPath = path.join(
    repoRoot,
    "docs",
    "records",
    "artifacts",
    "agent",
    "beeper",
    "reports",
    `${dateLabel}-${slug}.md`,
  );

  ensureDirectory(runDir);
  ensureDirectory(rawEvidenceDir);
  ensureDirectory(path.dirname(reportPath));

  const createdNotes = writeIfMissing(
    notesPath,
    buildNotesTemplate({ dateLabel, task, environment }),
  );
  const createdReport = writeIfMissing(
    reportPath,
    buildReportTemplate({ dateLabel, slug, task, environment }),
  );
  const createdEvidenceManifest = writeIfMissing(
    evidenceManifestPath,
    buildEvidenceManifestTemplate({
      dateLabel,
      task,
      environment,
      rawEvidenceDir,
    }),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        task,
        environment,
        runDir,
        evidenceManifestPath,
        rawEvidenceDir,
        notesPath,
        reportPath,
        createdNotes,
        createdReport,
        createdEvidenceManifest,
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
