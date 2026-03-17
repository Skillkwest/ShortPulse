// Scoped AI Studio style-literal guard for Lane B convergence.
// Run with: node scripts/check_ai_studio_style_literals.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();

const RESIDUAL_LITERAL_GUARDS = [
  {
    file: "frontend/styles/ai-studio-edit-expert.css",
    label: "expert muted title literal",
    literal: "rgba(225, 232, 242, 0.9)",
    maxOccurrences: 1,
  },
  {
    file: "frontend/styles/ai-studio-edit-expert.css",
    label: "expert themed-video neutral surface literal",
    literal: "rgba(37, 41, 47, 0.64)",
    maxOccurrences: 1,
  },
  {
    file: "frontend/styles/ai-studio-edit-expert.css",
    label: "expert strong neutral border literal",
    literal: "rgba(92, 96, 104, 0.9)",
    maxOccurrences: 4,
  },
  {
    file: "frontend/styles/ai-studio-edit-expert.css",
    label: "retired strong neutral text literal",
    literal: "#eef2f8",
    maxOccurrences: 0,
  },
  {
    file: "frontend/styles/ai-studio-edit-expert.css",
    label: "retired neutral soft surface literal",
    literal: "rgba(201, 205, 214, 0.02)",
    maxOccurrences: 0,
  },
];

function resolveMode(inputMode, fallbackMode = "enforce") {
  if (inputMode === "warn" || inputMode === "enforce") {
    return inputMode;
  }
  if (inputMode) {
    console.warn(`Unknown style literal guard mode '${inputMode}'. Falling back to '${fallbackMode}'.`);
  }
  return fallbackMode;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text, literal) {
  const matches = text.match(new RegExp(escapeRegExp(literal), "g"));
  return matches ? matches.length : 0;
}

function run() {
  const mode = resolveMode(process.env.AI_STUDIO_STYLE_LITERAL_GUARD_MODE, "enforce");
  const violations = [];

  for (const guard of RESIDUAL_LITERAL_GUARDS) {
    const fullPath = path.join(REPO_ROOT, guard.file);
    if (!fs.existsSync(fullPath)) {
      violations.push(`Missing guarded file: ${guard.file}`);
      continue;
    }

    const text = fs.readFileSync(fullPath, "utf8");
    const occurrences = countOccurrences(text, guard.literal);
    if (occurrences > guard.maxOccurrences) {
      violations.push(
        `${guard.file} exceeds residual literal cap for ${guard.label} ` +
          `(${occurrences} > ${guard.maxOccurrences}) [${guard.literal}]`
      );
    }
  }

  if (!violations.length) {
    console.log("AI Studio style literal guard passed.");
    return;
  }

  if (mode === "warn") {
    console.warn("AI Studio style literal guard failed in warn mode:");
    for (const violation of violations) {
      console.warn(`- ${violation}`);
    }
    return;
  }

  console.error("AI Studio style literal guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

run();
