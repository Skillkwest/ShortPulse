/* global process */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_TRAINING_DATA_DIR = path.resolve(
  __dirname,
  "../../docs/records/artifacts/agent/create-workflow/training-data"
);

const DATASET_FILES = {
  incidents: "incident-cases.jsonl",
  decisions: "decision-episodes.jsonl",
  attempts: "attempt-ledger.jsonl",
  patterns: "failure-patterns.jsonl",
};

const REQUIRED_FIELDS = {
  incidents: [
    "incident_id",
    "agent",
    "surface",
    "source_surfaces",
    "modes_affected",
    "symptoms",
    "pattern_tags",
    "local_validation_status",
    "production_status",
    "evidence_status",
    "current_best_hypothesis",
    "next_step",
    "source_report",
  ],
  decisions: [
    "episode_id",
    "incident_id",
    "category",
    "context",
    "observed_evidence",
    "options_considered",
    "chosen_action",
    "reasoning",
    "outcome",
    "lesson",
  ],
  attempts: [
    "attempt_id",
    "incident_id",
    "hypothesis",
    "intervention",
    "validation",
    "local_result",
    "production_result",
    "verdict",
    "lesson",
  ],
  patterns: [
    "pattern_id",
    "name",
    "description",
    "symptoms",
    "misleading_signals",
    "confirming_evidence",
    "standard_next_capture",
  ],
};

const readJsonlFile = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL in ${filePath} at line ${index + 1}: ${error.message}`);
      }
    });
};

export const loadTrainingDataset = async (baseDir = DEFAULT_TRAINING_DATA_DIR) => {
  const [incidents, decisions, attempts, patterns] = await Promise.all([
    readJsonlFile(path.join(baseDir, DATASET_FILES.incidents)),
    readJsonlFile(path.join(baseDir, DATASET_FILES.decisions)),
    readJsonlFile(path.join(baseDir, DATASET_FILES.attempts)),
    readJsonlFile(path.join(baseDir, DATASET_FILES.patterns)),
  ]);

  return { baseDir, incidents, decisions, attempts, patterns };
};

const validateRequiredFields = (rows, requiredFields, datasetName) => {
  const issues = [];
  rows.forEach((row, index) => {
    requiredFields.forEach((field) => {
      const value = row[field];
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim().length === 0);
      if (missing) {
        issues.push(`${datasetName}[${index}] missing required field "${field}"`);
      }
    });
  });
  return issues;
};

const validateUniqueField = (rows, field, datasetName) => {
  const issues = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    const value = row[field];
    if (typeof value !== "string" || value.length === 0) return;
    if (seen.has(value)) {
      issues.push(`${datasetName}[${index}] duplicate ${field} "${value}"`);
      return;
    }
    seen.add(value);
  });
  return issues;
};

export const validateTrainingDataset = (dataset) => {
  const issues = [
    ...validateRequiredFields(dataset.incidents, REQUIRED_FIELDS.incidents, "incidents"),
    ...validateRequiredFields(dataset.decisions, REQUIRED_FIELDS.decisions, "decisions"),
    ...validateRequiredFields(dataset.attempts, REQUIRED_FIELDS.attempts, "attempts"),
    ...validateRequiredFields(dataset.patterns, REQUIRED_FIELDS.patterns, "patterns"),
    ...validateUniqueField(dataset.incidents, "incident_id", "incidents"),
    ...validateUniqueField(dataset.decisions, "episode_id", "decisions"),
    ...validateUniqueField(dataset.attempts, "attempt_id", "attempts"),
    ...validateUniqueField(dataset.patterns, "pattern_id", "patterns"),
  ];

  const incidentIds = new Set(dataset.incidents.map((incident) => incident.incident_id));

  dataset.decisions.forEach((decision, index) => {
    if (!incidentIds.has(decision.incident_id)) {
      issues.push(`decisions[${index}] references unknown incident_id "${decision.incident_id}"`);
    }
  });

  dataset.attempts.forEach((attempt, index) => {
    if (!incidentIds.has(attempt.incident_id)) {
      issues.push(`attempts[${index}] references unknown incident_id "${attempt.incident_id}"`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
};

const countBy = (rows, key) => {
  const counts = new Map();
  rows.forEach((row) => {
    const value = row[key] ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Object.fromEntries(Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)));
};

const countByArray = (rows, key) => {
  const counts = new Map();
  rows.forEach((row) => {
    const values = Array.isArray(row[key]) ? row[key] : [];
    values.forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });
  return Object.fromEntries(Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)));
};

export const buildTrainingDatasetSummary = (dataset) => {
  const validation = validateTrainingDataset(dataset);
  const unresolvedIncidents = dataset.incidents
    .filter((incident) => String(incident.production_status).toLowerCase().includes("unresolved"))
    .map((incident) => incident.incident_id);

  return {
    baseDir: dataset.baseDir,
    valid: validation.valid,
    issueCount: validation.issues.length,
    incidentCount: dataset.incidents.length,
    decisionCount: dataset.decisions.length,
    attemptCount: dataset.attempts.length,
    patternCount: dataset.patterns.length,
    decisionCategories: countBy(dataset.decisions, "category"),
    attemptVerdicts: countBy(dataset.attempts, "verdict"),
    incidentPatternTags: countByArray(dataset.incidents, "pattern_tags"),
    unresolvedIncidents,
  };
};

export const buildIncidentBrief = (dataset, incidentId) => {
  const incident = dataset.incidents.find((item) => item.incident_id === incidentId);
  if (!incident) {
    throw new Error(`Unknown incident_id "${incidentId}"`);
  }

  const decisions = dataset.decisions.filter((item) => item.incident_id === incidentId);
  const attempts = dataset.attempts.filter((item) => item.incident_id === incidentId);

  const lines = [
    `# Incident Brief: ${incidentId}`,
    "",
    `- Surface: ${incident.surface}`,
    `- Source surfaces: ${incident.source_surfaces.join(", ")}`,
    `- Modes affected: ${incident.modes_affected.join(", ")}`,
    `- Pattern tags: ${incident.pattern_tags.join(", ")}`,
    `- Production status: ${incident.production_status}`,
    `- Evidence status: ${incident.evidence_status}`,
    `- Current best hypothesis: ${incident.current_best_hypothesis}`,
    `- Next step: ${incident.next_step}`,
    "",
    "## Symptoms",
    ...incident.symptoms.map((symptom) => `- ${symptom}`),
    "",
    "## Decision Pivots",
    ...decisions.map(
      (decision) => `- [${decision.category}] ${decision.chosen_action}: ${decision.lesson}`
    ),
    "",
    "## Attempt Ledger",
    ...attempts.map(
      (attempt) => `- [${attempt.verdict}] ${attempt.hypothesis} -> ${attempt.lesson}`
    ),
    "",
    `Source report: ${incident.source_report}`,
    "",
  ];

  return lines.join("\n");
};

export const parseArgs = (argv) => {
  const args = new Set(argv);
  const incidentIdIndex = argv.indexOf("--incident-id");
  const incidentId =
    incidentIdIndex >= 0 && incidentIdIndex < argv.length - 1 ? argv[incidentIdIndex + 1] : null;

  if (args.has("--validate")) {
    return { mode: "validate", incidentId: null };
  }
  if (args.has("--brief")) {
    return { mode: "brief", incidentId };
  }
  return { mode: "summary", incidentId: null };
};

const renderSummary = (summary) => {
  const lines = [
    "# Create Workflow Training Data Summary",
    "",
    `- Dataset valid: ${summary.valid ? "yes" : "no"}`,
    `- Issue count: ${summary.issueCount}`,
    `- Incident count: ${summary.incidentCount}`,
    `- Decision count: ${summary.decisionCount}`,
    `- Attempt count: ${summary.attemptCount}`,
    `- Pattern count: ${summary.patternCount}`,
    "",
    "## Decision Categories",
    ...Object.entries(summary.decisionCategories).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Attempt Verdicts",
    ...Object.entries(summary.attemptVerdicts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Incident Pattern Tags",
    ...Object.entries(summary.incidentPatternTags).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Unresolved Incidents",
    ...(summary.unresolvedIncidents.length
      ? summary.unresolvedIncidents.map((value) => `- ${value}`)
      : ["- none"]),
    "",
  ];
  return lines.join("\n");
};

const renderValidation = (validation) => {
  if (validation.valid) {
    return "# Create Workflow Training Data Validation\n\n- valid\n";
  }
  return [
    "# Create Workflow Training Data Validation",
    "",
    ...validation.issues.map((issue) => `- ${issue}`),
    "",
  ].join("\n");
};

const maybeRunCli = async () => {
  if (import.meta.url !== `file://${process.argv[1]}`) {
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const dataset = await loadTrainingDataset();

  if (args.mode === "validate") {
    const validation = validateTrainingDataset(dataset);
    process.stdout.write(renderValidation(validation));
    process.exitCode = validation.valid ? 0 : 1;
    return;
  }

  if (args.mode === "brief") {
    if (!args.incidentId) {
      throw new Error("Missing required --incident-id for --brief mode");
    }
    process.stdout.write(buildIncidentBrief(dataset, args.incidentId));
    return;
  }

  process.stdout.write(renderSummary(buildTrainingDatasetSummary(dataset)));
};

await maybeRunCli();
