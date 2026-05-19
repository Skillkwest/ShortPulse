#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const frontendRoot = path.join(repoRoot, "frontend");
const frontendNodeBin = path.join(frontendRoot, "node_modules", ".bin");
const nodeBin = process.execPath;
const prettierBin = path.join(frontendNodeBin, "prettier");
const eslintBin = path.join(frontendNodeBin, "eslint");
const vitestBin = path.join(frontendNodeBin, "vitest");
const DOCS_CHECK_SCRIPTS = [
  "scripts/check_docs_links.js",
  "scripts/check_docs_semantic_drift.js",
  "scripts/check_migration_doc_parity.js",
  "scripts/check_archive_manifest.js",
  "scripts/check_model_catalog_parity.js",
  "scripts/check_naming_canonical_drift.js",
  "scripts/check_operator_map_drift.js",
];

const GENERATED_PATH_PATTERNS = [
  /^frontend\/\.next\//,
  /^frontend\/coverage\//,
  /^frontend\/playwright-report\//,
  /^frontend\/test-results\//,
  /^frontend\/node_modules\//,
  /^node_modules\//,
  /^dist\//,
  /^build\//,
];

const SECRET_PATH_PATTERNS = [
  /^\.env$/,
  /^\.env\./,
  /^frontend\/\.env$/,
  /^frontend\/\.env\./,
];

const SECRET_PATH_EXCEPTION_PATTERNS = [
  /^\.env(?:\.[^/]+)*\.example$/,
  /^frontend\/\.env(?:\.[^/]+)*\.example$/,
];

const SHARED_RISK_RULES = [
  {
    pattern: "frontend/pages/ai-studio.tsx",
    note: "Shared page shell. Adapt manually and validate with AI Studio targeted tests.",
  },
  {
    pattern: "frontend/styles/admin.module.css",
    note: "Shared admin surface. Stage by hunk or pair with a dominant admin batch.",
  },
  {
    pattern: "README.md",
    note: "Shared repo index. Prefer final docs reconciliation batch.",
  },
  {
    pattern: "docs/routes.md",
    note: "Shared route index. Keep with route/docs parity validation.",
  },
  {
    pattern: "docs/README.md",
    note: "Shared docs index. Prefer final docs reconciliation batch.",
  },
  {
    pattern: "frontend/tests/pages/admin.agent-instructions.test.tsx",
    note: "Suite-hot page test. Re-run in isolation before the final full suite when touched.",
  },
  {
    pattern: "frontend/tests/api/error-logging-coverage.test.ts",
    note: "Suite-hot guardrail test. Re-run in isolation before the final full suite when touched.",
  },
];

const SUITE_HOT_RULES = [
  {
    when: [
      "frontend/tests/pages/admin.agent-instructions.test.tsx",
      "frontend/pages/admin/agent-instructions.tsx",
      "frontend/features/admin/components/AdminAgentInstructionsSection.tsx",
      "frontend/pages/api/admin/agent-instructions/style-extract-prompt.ts",
    ],
    tests: ["tests/pages/admin.agent-instructions.test.tsx"],
  },
  {
    when: [
      "frontend/tests/api/error-logging-coverage.test.ts",
      "frontend/pages/api/media/copy-from-url.ts",
      "frontend/lib/server/api/appErrorLogs.ts",
    ],
    tests: ["tests/api/error-logging-coverage.test.ts"],
  },
  {
    when: [
      "frontend/tests/api/generation-billing.reservations.test.ts",
      "frontend/lib/model-runtime/providerModelIds.ts",
      "frontend/lib/server/providerIntegration/kieModelContracts.ts",
      "frontend/pages/api/kie/upload-url.ts",
    ],
    tests: ["tests/api/generation-billing.reservations.test.ts"],
  },
];

const CONTRACT_FANOUT_RULES = [
  {
    name: "preview-delivery-contract",
    note: "Preview/signing changes should pull the downstream media preview API contract tests into the first manifest.",
    matchers: [
      "frontend/pages/api/media/sign-batch.ts",
      "frontend/pages/api/media/resolve-previews.ts",
      /^frontend\/.*preview/i,
      /^frontend\/.*sign-batch/i,
      /^frontend\/.*transform.*profile/i,
    ],
    tests: [
      "tests/api/media-sign-batch.test.ts",
      "tests/api/media-resolve-previews.test.ts",
    ],
  },
  {
    name: "media-panel-kpi-contract",
    note: "Media panel KPI packet changes should pull the capture/score script tests into the first manifest.",
    matchers: [/^frontend\/scripts\/media_panel_kpi_/i],
    tests: [
      "scripts/__tests__/media_panel_kpi_capture.test.ts",
      "scripts/__tests__/media_panel_kpi_score.test.ts",
    ],
  },
  {
    name: "character-panel-layout-contract",
    note: "Character panel layout and embedded library changes should pull the shared layout contract test into the first manifest.",
    matchers: [
      "frontend/styles/character-manager-embedded.css",
      /^frontend\/features\/ai-studio\/logic\/.*characterPanelLayout/i,
      /^frontend\/features\/character-manager\//,
      /^frontend\/pages\/character(?:\.tsx)?$/i,
    ],
    tests: [
      "features/ai-studio/logic/__tests__/characterPanelLayoutContract.test.ts",
    ],
  },
];

function printHelp() {
  console.log(`Usage:
  node scripts/ops/gear_ball_preflight.mjs --files <paths...> [--files-from <path>] [--tests <tests...>] [--tests-from <path>] [--include-suite-hot] [--print-test-manifest] [--dry-run]
  node scripts/ops/gear_ball_preflight.mjs --staged [--tests <tests...>] [--tests-from <path>] [--include-suite-hot] [--print-test-manifest] [--dry-run]

Options:
  --files              Repo-relative file paths to preflight.
  --files-from         Read repo-relative file paths from a newline-delimited manifest file.
  --staged             Use the current staged file list.
  --tests              Additional vitest paths to run. Accepts either frontend-relative or repo-relative frontend test paths.
  --tests-from         Read additional Vitest paths from a newline-delimited manifest file.
  --include-suite-hot  Add suite-hot targeted tests when touched paths match known risk rules.
  --print-test-manifest  Print the normalized frontend-relative Vitest target list before running checks.
  --dry-run            Print planned checks without executing them.
  --help               Show this message.

Behavior:
  Known shared-contract files auto-add downstream dependent tests for preview delivery, media KPI packets, and character panel layout contracts.
`);
}

function fail(message) {
  console.error(`gear-ball preflight: ${message}`);
  process.exit(1);
}

function normalizePath(value) {
  return value
    .replaceAll(path.sep, "/")
    .replace(/^\.\/+/, "")
    .trim();
}

function toFrontendRelativeTestPath(value) {
  const normalized = normalizePath(value);
  if (!normalized) return normalized;
  return normalized.startsWith("frontend/")
    ? normalized.slice("frontend/".length)
    : normalized;
}

function collectFlagValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) continue;
    for (let cursor = index + 1; cursor < args.length; cursor += 1) {
      const candidate = args[cursor];
      if (!candidate || candidate.startsWith("--")) break;
      values.push(candidate);
    }
  }
  return values;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function collectSingleFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] && !args[index + 1].startsWith("--")
    ? args[index + 1]
    : null;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result;
}

function getStagedFiles() {
  const result = run("git", ["diff", "--cached", "--name-only"], {
    stdio: "pipe",
  });
  return result.stdout.split(/\r?\n/).map(normalizePath).filter(Boolean);
}

function readManifestFile(filePath, mapper = normalizePath) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(repoRoot, filePath);
  const result = run("node", [
    "-e",
    `
const fs = require("node:fs");
const contents = fs.readFileSync(process.argv[1], "utf8");
process.stdout.write(contents);
`,
    absolutePath,
  ]);

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter(Boolean)
    .map(mapper);
}

function repoFileExists(file) {
  return fs.existsSync(path.join(repoRoot, file));
}

function isGeneratedPath(file) {
  return GENERATED_PATH_PATTERNS.some((pattern) => pattern.test(file));
}

function isSecretPath(file) {
  if (SECRET_PATH_EXCEPTION_PATTERNS.some((pattern) => pattern.test(file)))
    return false;
  return SECRET_PATH_PATTERNS.some((pattern) => pattern.test(file));
}

function deriveSuiteHotTests(files) {
  const touched = new Set(files);
  const derived = new Set();
  for (const rule of SUITE_HOT_RULES) {
    if (rule.when.some((candidate) => touched.has(candidate))) {
      for (const testPath of rule.tests) derived.add(testPath);
    }
  }
  return [...derived];
}

function getSharedRiskWarnings(files) {
  const warnings = [];
  for (const rule of SHARED_RISK_RULES) {
    if (files.includes(rule.pattern)) {
      warnings.push(`${rule.pattern}: ${rule.note}`);
    }
  }
  return warnings;
}

function matchesRule(file, matcher) {
  if (typeof matcher === "string") return file === matcher;
  return matcher.test(file);
}

function deriveContractFanout(files) {
  const matches = [];
  for (const rule of CONTRACT_FANOUT_RULES) {
    if (
      files.some((file) =>
        rule.matchers.some((matcher) => matchesRule(file, matcher)),
      )
    ) {
      matches.push(rule);
    }
  }
  return matches;
}

function needsDocsCheck(files) {
  return files.some(
    (file) =>
      file === "README.md" ||
      file.startsWith("docs/") ||
      file.startsWith("sql/") ||
      file.startsWith("frontend/pages/") ||
      file.startsWith("frontend/pages/api/") ||
      file.startsWith("frontend/lib/model-runtime/") ||
      file.startsWith("scripts/"),
  );
}

function formatCommand(command, args, cwd) {
  const rendered = [command, ...args].join(" ");
  return cwd ? `(cd ${cwd} && ${rendered})` : rendered;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

const args = process.argv.slice(2);

if (hasFlag(args, "--help")) {
  printHelp();
  process.exit(0);
}

const dryRun = hasFlag(args, "--dry-run");
const includeSuiteHot = hasFlag(args, "--include-suite-hot");
const printTestManifest = hasFlag(args, "--print-test-manifest");
const filesArg = collectFlagValues(args, "--files").map(normalizePath);
const filesFromArg = collectSingleFlagValue(args, "--files-from");
const testsArg = collectFlagValues(args, "--tests").map(
  toFrontendRelativeTestPath,
);
const testsFromArg = collectSingleFlagValue(args, "--tests-from");
const manifestFiles = filesFromArg
  ? readManifestFile(filesFromArg, normalizePath)
  : [];
const manifestTests = testsFromArg
  ? readManifestFile(testsFromArg, toFrontendRelativeTestPath)
  : [];
const staged =
  hasFlag(args, "--staged") ||
  (filesArg.length === 0 && manifestFiles.length === 0);

const files = [
  ...new Set(
    (staged ? getStagedFiles() : [...filesArg, ...manifestFiles]).filter(
      Boolean,
    ),
  ),
];
if (files.length === 0) fail("no files to preflight");

const existingFiles = files.filter(repoFileExists);
const deletedOnlyFiles = files.filter((file) => !repoFileExists(file));

const generatedFiles = existingFiles.filter(isGeneratedPath);
if (generatedFiles.length > 0) {
  fail(
    `generated/build artifacts are not allowed in a batch:\n- ${generatedFiles.join("\n- ")}`,
  );
}

const secretFiles = existingFiles.filter(isSecretPath);
if (secretFiles.length > 0) {
  fail(
    `secret-bearing env files are not allowed in a batch:\n- ${secretFiles.join("\n- ")}`,
  );
}

const sharedRiskWarnings = getSharedRiskWarnings(existingFiles);
const contractFanoutRules = deriveContractFanout(existingFiles);
const frontendLintFiles = existingFiles
  .filter((file) => /^frontend\/.+\.(?:[jt]sx?)$/.test(file))
  .map((file) => path.relative(frontendRoot, path.join(repoRoot, file)));
const prettierFiles = existingFiles.filter((file) =>
  /\.(?:[jt]sx?|json|md|css|mjs)$/.test(file),
);
const targetedTests = [
  ...new Set([
    ...testsArg,
    ...manifestTests,
    ...contractFanoutRules.flatMap((rule) =>
      rule.tests.map(toFrontendRelativeTestPath),
    ),
    ...(includeSuiteHot
      ? deriveSuiteHotTests(existingFiles).map(toFrontendRelativeTestPath)
      : []),
  ]),
];

const checks = [];
if (prettierFiles.length > 0) {
  checks.push({
    label: "prettier",
    command: prettierBin,
    args: ["--check", ...prettierFiles],
    cwd: repoRoot,
  });
}
if (frontendLintFiles.length > 0) {
  checks.push({
    label: "eslint",
    command: eslintBin,
    args: [
      "--config",
      "eslint.config.mjs",
      "--max-warnings",
      "0",
      ...frontendLintFiles,
    ],
    cwd: frontendRoot,
  });
}
if (needsDocsCheck(files)) {
  for (const script of DOCS_CHECK_SCRIPTS) {
    checks.push({
      label: `docs:${path.basename(script, ".js").replace(/^check_/, "")}`,
      command: nodeBin,
      args: [script],
      cwd: repoRoot,
    });
  }
}
if (targetedTests.length > 0) {
  const vitestShellCommand = [
    "./node_modules/.bin/vitest",
    "run",
    ...targetedTests,
  ]
    .map(shellQuote)
    .join(" ");
  checks.push({
    label: "vitest",
    command: "zsh",
    args: ["-lc", vitestShellCommand],
    cwd: frontendRoot,
    displayCommand: formatCommand(
      vitestBin,
      ["run", ...targetedTests],
      "frontend",
    ),
  });
}

console.log("gear-ball preflight");
console.log(`files: ${files.length}`);
if (deletedOnlyFiles.length > 0) {
  console.log(
    `deleted/absent paths skipped for direct file checks: ${deletedOnlyFiles.length}`,
  );
}
if (sharedRiskWarnings.length > 0) {
  console.log("shared-risk warnings:");
  for (const warning of sharedRiskWarnings) {
    console.log(`- ${warning}`);
  }
}
if (contractFanoutRules.length > 0) {
  console.log("shared-contract fan-out:");
  for (const rule of contractFanoutRules) {
    console.log(`- ${rule.name}: ${rule.note}`);
    for (const test of rule.tests.map(toFrontendRelativeTestPath)) {
      console.log(`  - adds ${test}`);
    }
  }
}
if (checks.length === 0) {
  console.log("checks: none");
  process.exit(0);
}

if (printTestManifest && targetedTests.length > 0) {
  console.log("vitest target manifest:");
  for (const target of targetedTests) {
    console.log(`- ${target}`);
  }
}

console.log("planned checks:");
for (const check of checks) {
  console.log(
    `- ${check.label}: ${check.displayCommand ?? formatCommand(check.command, check.args, check.cwd === repoRoot ? null : "frontend")}`,
  );
}

if (dryRun) process.exit(0);

for (const check of checks) {
  console.log(`running ${check.label}...`);
  run(check.command, check.args, { cwd: check.cwd, stdio: "inherit" });
}

console.log("gear-ball preflight passed");
