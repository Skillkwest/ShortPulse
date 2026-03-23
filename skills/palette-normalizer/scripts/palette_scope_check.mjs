#!/usr/bin/env node

/**
 * Palette scope/freshness gate for AI Studio palette normalization.
 * Compares inventory metadata to current AI Studio stylesheet scope.
 */

import fs from "node:fs";
import path from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const opts = {
    inventory: "docs/design/ai-studio-style-inventory.md",
    stylesRoot: "frontend/styles",
    maxAgeDays: 30,
    json: false,
    failOnWarn: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--inventory") {
      opts.inventory = argv[++i];
    } else if (arg === "--styles-root") {
      opts.stylesRoot = argv[++i];
    } else if (arg === "--max-age-days") {
      opts.maxAgeDays = Number(argv[++i]);
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--fail-on-warn") {
      opts.failOnWarn = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!Number.isFinite(opts.maxAgeDays) || opts.maxAgeDays < 0) {
    throw new Error("--max-age-days must be a non-negative number");
  }

  return opts;
}

function printHelp() {
  process.stdout.write(`Usage:
  node skills/palette-normalizer/scripts/palette_scope_check.mjs [options]

Options:
  --inventory <path>       Inventory markdown path (default: docs/design/ai-studio-style-inventory.md)
  --styles-root <path>     AI Studio stylesheet root (default: frontend/styles)
  --max-age-days <n>       Freshness threshold in days (default: 30)
  --json                   Print JSON output
  --fail-on-warn           Exit non-zero when status is WARN
  -h, --help               Show this help
`);
}

function findInventoryDate(content) {
  const match = content.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/i);
  return match ? match[1] : null;
}

function findDeclaredCssCount(content) {
  const match = content.match(/ai-studio-\*\.css` files \((\d+) total\)/i);
  return match ? Number(match[1]) : null;
}

function listAiStudioCssFiles(stylesRoot) {
  const entries = fs.readdirSync(stylesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^ai-studio-.*\.css$/i.test(entry.name))
    .map((entry) => path.join(stylesRoot, entry.name))
    .sort();
}

function getAgeDays(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  return Math.floor((todayUtc - targetUtc) / DAY_MS);
}

function buildReport(opts) {
  const issues = [];
  const warnings = [];

  if (!fs.existsSync(opts.inventory)) {
    return {
      status: "FAIL",
      issues: [`Inventory file not found: ${opts.inventory}`],
      warnings,
      inventory: opts.inventory,
      stylesRoot: opts.stylesRoot,
      maxAgeDays: opts.maxAgeDays,
    };
  }

  if (!fs.existsSync(opts.stylesRoot)) {
    return {
      status: "FAIL",
      issues: [`Styles root not found: ${opts.stylesRoot}`],
      warnings,
      inventory: opts.inventory,
      stylesRoot: opts.stylesRoot,
      maxAgeDays: opts.maxAgeDays,
    };
  }

  const content = fs.readFileSync(opts.inventory, "utf8");
  const lastUpdated = findInventoryDate(content);
  const declaredCssCount = findDeclaredCssCount(content);
  const aiStudioCssFiles = listAiStudioCssFiles(opts.stylesRoot);
  const actualCssCount = aiStudioCssFiles.length;
  const ageDays = lastUpdated ? getAgeDays(lastUpdated) : null;

  if (!lastUpdated) {
    warnings.push("Inventory is missing a 'Last updated: YYYY-MM-DD' field.");
  } else if (ageDays == null) {
    warnings.push(`Inventory date is invalid: ${lastUpdated}`);
  } else if (ageDays > opts.maxAgeDays) {
    warnings.push(`Inventory is stale: ${ageDays} days old (threshold ${opts.maxAgeDays}).`);
  }

  if (declaredCssCount == null) {
    warnings.push("Inventory is missing declared ai-studio CSS file count.");
  } else if (declaredCssCount !== actualCssCount) {
    warnings.push(`Inventory scope mismatch: declared ${declaredCssCount}, actual ${actualCssCount}.`);
  }

  const status = warnings.length > 0 ? "WARN" : "PASS";
  return {
    status,
    issues,
    warnings,
    inventory: opts.inventory,
    stylesRoot: opts.stylesRoot,
    maxAgeDays: opts.maxAgeDays,
    lastUpdated,
    ageDays,
    declaredCssCount,
    actualCssCount,
    aiStudioCssFiles,
  };
}

function printText(report) {
  const lines = [];
  lines.push("Palette scope check");
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Inventory: ${report.inventory}`);
  lines.push(`- Styles root: ${report.stylesRoot}`);
  lines.push(`- Last updated: ${report.lastUpdated ?? "missing"}`);
  lines.push(`- Inventory age (days): ${report.ageDays ?? "unknown"}`);
  lines.push(`- Declared ai-studio CSS files: ${report.declaredCssCount ?? "missing"}`);
  lines.push(`- Actual ai-studio CSS files: ${report.actualCssCount ?? "unknown"}`);

  if (report.warnings.length > 0) {
    lines.push("- Warnings:");
    for (const warning of report.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  if (report.issues.length > 0) {
    lines.push("- Issues:");
    for (const issue of report.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const report = buildReport(opts);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printText(report);
  }

  if (report.status === "FAIL") {
    process.exit(2);
  }

  if (opts.failOnWarn && report.status === "WARN") {
    process.exit(3);
  }
}

main();
