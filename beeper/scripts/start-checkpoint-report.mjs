#!/usr/bin/env node

/**
 * Creates a detailed Beeper checkpoint report inside beeper/reports/.
 * This keeps frequent testing checkpoints easy to capture and preserve.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const usage = () => {
  console.log(`Usage:
  node beeper/scripts/start-checkpoint-report.mjs --slug <name> [options]

Options:
  --slug <name>          Required short checkpoint label
  --title <text>         Optional report title
  --environment <name>   Optional environment label. Default: local
  --workflow <text>      Optional workflow label
  --help                 Show this message.
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
  return { yyyy, mm, dd };
};

const buildTemplate = ({
  dateLabel,
  title,
  environment,
  workflow,
}) => `# ${title}

Purpose: detailed Beeper checkpoint record for one testing stop.

## Checkpoint Metadata

- Date: ${dateLabel}
- Environment: ${environment}
- Workflow: ${workflow}
- Base URL:
- Runtime project ref:
- Audit user:

## What Beeper Tried

1. 
2. 
3. 

## What Worked

- 

## What Did Not Work

- 

## UI / UX Friction

- 

## Workflow Bottlenecks

- 

## Behavior Notes

- Expected:
- Actual:
- Surprise points:

## Evidence

- JSON:
- Screenshots:
- Related run packet:

## Next Questions

- 

## Follow-Up Direction

- Keep testing:
- Hand off:
- Fix ideas:
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
  if (!slug)
    throw new Error("Slug must contain at least one alphanumeric character.");

  const environment = parseFlagValue(argv, "--environment") ?? "local";
  const workflow =
    parseFlagValue(argv, "--workflow") ?? slug.replace(/-/g, " ");
  const now = new Date();
  const { yyyy, mm, dd } = formatDateParts(now);
  const dateLabel = `${yyyy}-${mm}-${dd}`;
  const title =
    parseFlagValue(argv, "--title") ?? `Beeper Checkpoint - ${slug}`;
  const reportPath = path.join(
    repoRoot,
    "beeper",
    "reports",
    `${dateLabel}-${slug}.md`,
  );

  ensureDirectory(path.dirname(reportPath));
  const created = writeIfMissing(
    reportPath,
    buildTemplate({ dateLabel, title, environment, workflow }),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        environment,
        workflow,
        reportPath,
        created,
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
