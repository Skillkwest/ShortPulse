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

const writeJsonIfMissing = (filePath, value) => {
  if (fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
- Persona lens:

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

- Run brief path:
- Detailed report path:
- Checkpoint summary path:
- Retained report path:
- D-Bug handoff path:
- Training-history update needed:
`;

const buildRunBriefTemplate = ({ dateLabel, task, environment, baseUrl }) => `# Bopper Run Brief

Purpose: define why this lane is worth testing and what Bopper expects before the run starts.

## Run Metadata

- Date: ${dateLabel}
- Task: ${task}
- Environment: ${environment}
- Base URL: ${baseUrl}

## Why This Lane

- Lane choice rationale:
- Coverage gap or retest reason:
- Why this is high ROI right now:

## Persona Lens

- ICP pressure points in scope:
- Business goal in this route:
- Credit-risk concern:
- Support-dependence concern:
- Low-effort / payoff concern:

## Expected User Path

- Entry route:
- First likely click:
- Next likely click:
- Why those controls will look right to Bopper:

## Expected Outcomes

- What would count as intuitive:
- What would count as confusing:
- What would count as abandon-worthy:
- What would count as a strong business-use signal:

## Guardrails

- What Bopper should avoid because it would be too smart:
- What shortcuts would change the run label:
`;

const buildClickLogTemplate = ({ dateLabel, task }) => `# Bopper Click Log

Purpose: capture what Bopper clicked, why he clicked it, and whether that choice felt intuitive.

## Run

- Date: ${dateLabel}
- Task: ${task}

| Step | Surface | Visible options noticed | Clicked / input | Why Bopper chose it | Expected result | Actual result | Did it feel intuitive? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | \`<route or surface>\` | \`<what looked available>\` | \`<what Bopper clicked>\` | \`<why this looked like the right move>\` | \`<expected>\` | \`<actual>\` | \`<yes/no/partial and why>\` | \`<screenshot/json/code>\` |
`;

const buildDecisionLogTemplate = ({ dateLabel, task }) => `# Bopper Decision Log

Purpose: capture the ICP's judgments and conclusions during the run.

## Run

- Date: ${dateLabel}
- Task: ${task}

## Step Judgments

| Step | Surface | What Bopper concluded | Did he know what to do next? | Did he feel credit risk? | Did he feel he needed admin help? | Did this feel worth the effort? | Likely keep going or abandon? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | \`<route or surface>\` | \`<user conclusion>\` | \`<yes/no/partial>\` | \`<low/medium/high>\` | \`<yes/no/partial>\` | \`<yes/no/partial>\` | \`<keep going/retry/change route/abandon>\` |

## End-State Conclusion

- Did the UI feel intuitive overall?:
- What was Bopper struggling with most?:
- What part felt most support-dependent?:
- What part felt most credit-risky?:
- What part felt like too much work for the payoff?:
- What would Bopper likely say about the app after this run?:
`;

const buildEvidenceManifestTemplate = ({ dateLabel, task }) => `# Bopper Evidence Manifest

Purpose: keep the run packet self-contained by naming what evidence exists and what each artifact proves.

## Run

- Date: ${dateLabel}
- Task: ${task}

## Expected Artifacts

- UI screenshots:
- Runtime/network captures:
- Console captures:
- Any copied API payloads or IDs:

## Artifact Notes

- What each artifact proves:
- Missing evidence to capture before closeout:
`;

const buildDetailedReportTemplate = ({ dateLabel, slug, task, environment, baseUrl }) =>
  `# Bopper Report - ${dateLabel} - ${slug}

Purpose: ${task}.

## Task

- Requested work: ${task}
- Environment: ${environment}
- Base URL: ${baseUrl}
- Interaction fidelity:
- Persona lens:

## Naive-User Path

- Entry route:
- First click:
- Next obvious action:
- Why those clicks looked right:
- What Bopper expected:
- What Bopper ignored:

## Findings

### Blockers

- None yet.

### Functional Issues

- None yet.

### UI / UX Notes

- None yet.

## ICP Judgments

- Did the UI feel intuitive?:
- What was Bopper struggling with?:
- Did Bopper know what to do next without admin help?:
- Did this feel risky from a credit perspective?:
- Did this feel worth what he pays for Studio?:
- Did this feel like too much work for the expected payoff?:

## Evidence

- Run brief:
- Click log:
- Decision log:
- Screenshots:
- Runtime signals:
- Code/doc surfaces:
`;

const buildCheckpointSummaryTemplate = ({ dateLabel, task, environment }) =>
  `# Bopper Checkpoint Summary - ${dateLabel}

## Bottom Line
I should say in one blunt sentence whether the route worked, failed, or stayed mixed.

## What I Tried
I tested:
I ran this in the ${environment} environment.

## What Worked
I could:

## What Broke
I got stuck because:

## My Take
I would / would not keep going because:
I felt:
> "What I would likely say or believe after this run."

Handoff:
Read next:
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
- Persona lens:
- Business intent:

## Scope

- Routes covered:
- Interaction fidelity:
- Primary naive-user journey:
- What was intentionally skipped:
- Route success target:
- Retest-debt item:
- Lane choice rationale:
- ICP pressure points in scope:

## Action Log

| Step | Surface | Action | Why Bopper clicked it | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | \`<route or tool>\` | \`<what Bopper clicked>\` | \`<why this looked right to the ICP>\` | \`<what Bopper thought would happen>\` | \`<what happened>\` | \`<screenshot/json/code>\` |

## Findings

### Blockers

- None yet.

### Functional Issues

- None yet.

### UI / UX Notes

- None yet.

## Average-User Lens

- first click:
- next obvious click:
- what Bopper expected:
- what actually happened:
- what Bopper ignored:
- what Bopper misunderstood:
- abandonment point:

## ICP Judgments

- Did the UI feel intuitive?:
- What was Bopper struggling with?:
- Did Bopper know what to do next without admin help?:
- Did this feel risky from a credit perspective?:
- Did this feel worth what he pays for \`Studio\`?:
- Did this feel like too much work for the expected payoff?:
- What conclusion would Bopper likely make about ShortPulse after this run?:

## Code Follow-Up

- Probable code surfaces:
- Supporting docs or tests inspected:
- What another agent should inspect first:

## Evidence Packet

- JSON packet:
- Run brief:
- Click log:
- Decision log:
- Screenshots:
- Console / runtime signals:
- Local code references:

## Self Audit

- Score out of 10:
- Confidence tag:
- Hard gate triggered:
- Score breakdown:
- What felt strong:
- What slipped:
- Weakest category:
- Next-run drill:
- ROI gained:

## Training Record

- Memory / training-history update needed?: <yes/no and why>
- Coverage update needed?: <yes/no and why>
- Retest-debt update needed?: <yes/no and why>
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
  const packetPath = path.join(runDir, "packet.json");
  const runBriefPath = path.join(runDir, "run-brief.md");
  const notesPath = path.join(runDir, "notes.md");
  const clickLogPath = path.join(runDir, "click-log.md");
  const decisionLogPath = path.join(runDir, "decision-log.md");
  const evidenceManifestPath = path.join(evidenceDir, "README.md");
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

  const packetData = {
    ok: true,
    slug,
    task,
    environment,
    baseUrl,
    dateLabel,
    timestampLabel,
    datedSlug,
    runDir,
    evidenceDir,
    evidenceManifestPath,
    packetPath,
    runBriefPath,
    notesPath,
    clickLogPath,
    decisionLogPath,
    detailedReportPath,
    checkpointSummaryPath,
    retainedReportPath,
  };

  const createdPacket = writeJsonIfMissing(packetPath, packetData);
  const createdRunBrief = writeIfMissing(runBriefPath, buildRunBriefTemplate(templateParams));
  const createdNotes = writeIfMissing(notesPath, buildNotesTemplate(templateParams));
  const createdClickLog = writeIfMissing(clickLogPath, buildClickLogTemplate(templateParams));
  const createdDecisionLog = writeIfMissing(
    decisionLogPath,
    buildDecisionLogTemplate(templateParams)
  );
  const createdEvidenceManifest = writeIfMissing(
    evidenceManifestPath,
    buildEvidenceManifestTemplate(templateParams)
  );
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
        ...packetData,
        runBriefPath,
        notesPath,
        clickLogPath,
        decisionLogPath,
        detailedReportPath,
        checkpointSummaryPath,
        retainedReportPath,
        createdPacket,
        createdRunBrief,
        createdNotes,
        createdClickLog,
        createdDecisionLog,
        createdEvidenceManifest,
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
