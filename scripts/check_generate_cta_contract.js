#!/usr/bin/env node
// Guardrail for the Generate CTA contract.
// Active Generate buttons must stay visibly ready; progress belongs outside the button.
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const scanRoots = [
  path.join(repoRoot, "frontend", "features", "ai-studio"),
  path.join(repoRoot, "frontend", "prefabs", "agent"),
];

const sourceExtensions = new Set([".ts", ".tsx"]);
const generateButtonTextPattern = /\bGenerate(?:\s+(?:Voice|music))?\b/i;
const forbiddenButtonPatterns = [
  {
    pattern: /\baria-busy\b/,
    reason: "Generate button must not expose aria-busy",
  },
  {
    pattern: /\bis-busy\b/,
    reason: "Generate button must not render an is-busy class",
  },
  {
    pattern: /\bGenerating(?:\.\.\.|…)?\b/i,
    reason: "Generate button must not swap its label to a busy label",
  },
  {
    pattern:
      /\bdisabled\s*=\s*{[^}]*\b(?:isGenerating|isBusy|isSubmitting|isPending|isLoading|loading|pending|submitting|inFlight)\b[^}]*}/i,
    reason: "Generate button must not disable purely from in-flight/busy state",
  },
];

const generateComponentPattern =
  /<(AgentGenerateButton|AgentResponseInlineGenerateButton|MiniGenerateButton)\b[\s\S]*?(?:\/>|<\/\1>)/g;

function walk(directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(fullPath, out);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}

function lineNumberForOffset(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

const failures = [];

for (const root of scanRoots) {
  if (!fs.existsSync(root)) continue;

  for (const filePath of walk(root)) {
    const source = fs.readFileSync(filePath, "utf8");
    const rel = relative(filePath);

    const nativeButtonPattern = /<button\b[\s\S]*?<\/button>/g;
    for (const match of source.matchAll(nativeButtonPattern)) {
      const block = match[0];
      if (!generateButtonTextPattern.test(block)) continue;

      for (const check of forbiddenButtonPatterns) {
        if (check.pattern.test(block)) {
          failures.push(
            `${rel}:${lineNumberForOffset(source, match.index)} ${check.reason}`,
          );
        }
      }
    }

    for (const match of source.matchAll(generateComponentPattern)) {
      const block = match[0];
      for (const check of forbiddenButtonPatterns) {
        if (check.pattern.test(block)) {
          failures.push(
            `${rel}:${lineNumberForOffset(source, match.index)} ${check.reason}`,
          );
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Generate CTA contract check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Generate CTA contract check passed.");
