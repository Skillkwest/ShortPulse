#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../../scripts/lib/load_local_env.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const FRONTEND_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const SUPABASE_ROOT = path.join(REPO_ROOT, "supabase");

const LOADED_ENV_FILES = loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [
    path.join(REPO_ROOT, ".env.agent.local"),
    path.join(FRONTEND_ROOT, ".env.local"),
    path.join(REPO_ROOT, ".env.local"),
  ],
});

const DEFAULT_OUTPUT_FILE = path.join(
  os.tmpdir(),
  "media-library-diagnostics-readiness.latest.md"
);

const LIVE_APP_ENV_KEYS = [
  "SHORTPULSE_STAGING_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
];

const TOKEN_ENV_KEYS = [
  "SHORTPULSE_MEDIA_LIBRARY_BEARER_TOKEN",
  "SHORTPULSE_STAGING_BEARER_TOKEN",
  "SHORTPULSE_USER_BEARER_TOKEN",
];

const SQL_DIAGNOSTICS = [
  "sql/check_media_preview_variant_coverage_and_size.sql",
  "sql/check_media_derivative_processing_backlog.sql",
  "sql/check_media_derivative_terminal_failures.sql",
  "sql/check_media_all_media_completeness_drift.sql",
];

const PHASE0_COMMANDS = [
  "npm -C frontend run media:phase0",
  "npm -C frontend run media:phase0:probe -- --preset route --base-url <url> --token <token>",
  "npm -C frontend run test:e2e:media-library-runtime",
];

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

const readArgValue = (argv, flag) => {
  const prefixed = `${flag}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === flag) return argv[index + 1] ?? "";
    if (token.startsWith(prefixed)) return token.slice(prefixed.length);
  }
  return "";
};

export const parseArgs = (argv) => ({
  help: argv.includes("--help") || argv.includes("-h"),
  output: normalizeString(readArgValue(argv, "--output")) || DEFAULT_OUTPUT_FILE,
  writeFile: !argv.includes("--no-write"),
  jsonStdout: argv.includes("--json"),
});

export const resolveFirstEnvValue = (keys, env = process.env) => {
  for (const key of keys) {
    const value = normalizeString(env[key]);
    if (value) return { key, value };
  }
  return null;
};

const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
};

const readTrimmedFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
};

export const detectLocalReadiness = ({ repoRoot = REPO_ROOT, frontendRoot = FRONTEND_ROOT } = {}) => {
  const supabaseTempRoot = path.join(repoRoot, "supabase", ".temp");
  const linkedProjectRef = readTrimmedFile(path.join(supabaseTempRoot, "project-ref"));
  const linkedProjectJsonPath = path.join(supabaseTempRoot, "linked-project.json");
  const linkedProjectJson = fileExists(linkedProjectJsonPath)
    ? JSON.parse(fs.readFileSync(linkedProjectJsonPath, "utf8"))
    : null;

  return {
    frontendPackageJsonPresent: fileExists(path.join(frontendRoot, "package.json")),
    linkedProjectRef,
    linkedProjectName:
      linkedProjectJson && typeof linkedProjectJson.name === "string" ? linkedProjectJson.name : "",
    linkedProjectOrg:
      linkedProjectJson && typeof linkedProjectJson.organization_slug === "string"
        ? linkedProjectJson.organization_slug
        : "",
    linkedProjectConfigured: Boolean(linkedProjectRef),
    sqlDiagnosticsPresent: SQL_DIAGNOSTICS.every((relativePath) =>
      fileExists(path.join(repoRoot, relativePath))
    ),
  };
};

export const runCommandProbe = ({ command, args, cwd, timeoutMs = 12_000 }) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: normalizeString(result.stdout),
    stderr: normalizeString(result.stderr),
    error: result.error ? String(result.error.message || result.error) : "",
  };
};

export const detectToolingReadiness = ({ repoRoot = REPO_ROOT } = {}) => {
  const supabaseVersion = runCommandProbe({
    command: "supabase",
    args: ["--version"],
    cwd: repoRoot,
    timeoutMs: 8_000,
  });
  const psqlVersion = runCommandProbe({
    command: "psql",
    args: ["--version"],
    cwd: repoRoot,
    timeoutMs: 8_000,
  });
  const linkedInspectCalls = runCommandProbe({
    command: "supabase",
    args: ["inspect", "db", "calls", "--linked", "-o", "json"],
    cwd: repoRoot,
    timeoutMs: 15_000,
  });

  return {
    supabaseCliAvailable: supabaseVersion.ok,
    supabaseVersion:
      supabaseVersion.ok && supabaseVersion.stdout
        ? supabaseVersion.stdout.split("\n").pop() ?? supabaseVersion.stdout
        : "",
    psqlAvailable: psqlVersion.ok,
    linkedInspectCallsOk: linkedInspectCalls.ok,
    linkedInspectCallsError:
      linkedInspectCalls.ok
        ? ""
        : linkedInspectCalls.stderr || linkedInspectCalls.error || linkedInspectCalls.stdout,
  };
};

export const buildReadinessModel = ({
  env = process.env,
  repoRoot = REPO_ROOT,
  frontendRoot = FRONTEND_ROOT,
  localDetector = detectLocalReadiness,
  toolingDetector = detectToolingReadiness,
} = {}) => {
  const local = localDetector({ repoRoot, frontendRoot });
  const tooling = toolingDetector({ repoRoot });
  const baseUrl = resolveFirstEnvValue(LIVE_APP_ENV_KEYS, env);
  const token = resolveFirstEnvValue(TOKEN_ENV_KEYS, env);

  const liveProbeReady = Boolean(baseUrl?.value && token?.value);
  const linkedDbReady = local.linkedProjectConfigured && tooling.supabaseCliAvailable;

  const blockers = [];
  if (!baseUrl?.value) blockers.push("No staging/base URL env is available for authenticated phase0 probes.");
  if (!token?.value) blockers.push("No bearer token env is available for authenticated phase0 probes.");
  if (!local.linkedProjectConfigured) blockers.push("No linked Supabase project context was found under supabase/.temp.");
  if (!tooling.supabaseCliAvailable) blockers.push("Supabase CLI is not available.");
  if (!tooling.psqlAvailable) blockers.push("psql is not installed, so raw SQL diagnostics are not directly runnable.");
  if (linkedDbReady && !tooling.linkedInspectCallsOk) {
    blockers.push(
      `Linked Supabase inspect calls are not healthy: ${tooling.linkedInspectCallsError || "unknown error"}`
    );
  }

  let recommendedLane = "Continue static repo/code audits until live measurement access is restored.";
  if (tooling.linkedInspectCallsOk && !liveProbeReady) {
    recommendedLane =
      "Use linked Supabase inspect + repo diagnostics to validate derivative health while waiting on app probe credentials.";
  } else if (liveProbeReady) {
    recommendedLane =
      "Run the phase0 live probe packet first, then choose between resolver extraction and derivative canonicalization based on the probe results.";
  }

  return {
    loadedEnvFiles: LOADED_ENV_FILES,
    local,
    tooling,
    liveProbe: {
      baseUrlKey: baseUrl?.key ?? "",
      tokenKey: token?.key ?? "",
      ready: liveProbeReady,
    },
    linkedDb: {
      ready: linkedDbReady,
      inspectCallsHealthy: tooling.linkedInspectCallsOk,
    },
    blockers,
    recommendedLane,
  };
};

export const renderMarkdown = (model) => {
  const lines = [];
  lines.push("# Media Library Diagnostics Readiness");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Status");
  lines.push(
    `- Local repo diagnostics: ${model.local.frontendPackageJsonPresent && model.local.sqlDiagnosticsPresent ? "ready" : "partial"}`
  );
  lines.push(`- Live app phase0 probe: ${model.liveProbe.ready ? "ready" : "blocked"}`);
  lines.push(
    `- Linked Supabase inspect: ${model.linkedDb.ready ? (model.linkedDb.inspectCallsHealthy ? "ready" : "partial") : "blocked"}`
  );
  lines.push(`- Raw SQL shell path: ${model.tooling.psqlAvailable ? "ready" : "blocked"}`);
  lines.push("");
  lines.push("## Local Context");
  lines.push(`- Linked project ref: ${model.local.linkedProjectRef || "missing"}`);
  lines.push(`- Linked project name: ${model.local.linkedProjectName || "unknown"}`);
  lines.push(`- Linked organization: ${model.local.linkedProjectOrg || "unknown"}`);
  lines.push(
    `- SQL diagnostics present: ${model.local.sqlDiagnosticsPresent ? "yes" : "no"}`
  );
  lines.push(`- Loaded env files: ${model.loadedEnvFiles.length ? model.loadedEnvFiles.join(", ") : "none"}`);
  lines.push("");
  lines.push("## Tooling");
  lines.push(
    `- Supabase CLI: ${model.tooling.supabaseCliAvailable ? model.tooling.supabaseVersion || "available" : "missing"}`
  );
  lines.push(`- psql: ${model.tooling.psqlAvailable ? "available" : "missing"}`);
  lines.push(
    `- Linked inspect calls: ${model.tooling.linkedInspectCallsOk ? "healthy" : "failing"}`
  );
  if (!model.tooling.linkedInspectCallsOk && model.tooling.linkedInspectCallsError) {
    lines.push(`- Linked inspect error: ${model.tooling.linkedInspectCallsError}`);
  }
  lines.push("");
  lines.push("## Live Probe Inputs");
  lines.push(`- Base URL env: ${model.liveProbe.baseUrlKey || "missing"}`);
  lines.push(`- Bearer token env: ${model.liveProbe.tokenKey || "missing"}`);
  lines.push("");
  lines.push("## Blockers");
  if (model.blockers.length === 0) {
    lines.push("- none");
  } else {
    for (const blocker of model.blockers) {
      lines.push(`- ${blocker}`);
    }
  }
  lines.push("");
  lines.push("## Available Commands");
  for (const command of PHASE0_COMMANDS) {
    lines.push(`- \`${command}\``);
  }
  for (const relativePath of SQL_DIAGNOSTICS) {
    lines.push(`- \`${relativePath}\``);
  }
  lines.push("");
  lines.push("## Recommended Next Lane");
  lines.push(`- ${model.recommendedLane}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/media_library_diagnostics_readiness.mjs [options]",
      "",
      "Options:",
      `  --output <path>   Markdown output path. Default: ${DEFAULT_OUTPUT_FILE}.`,
      "  --no-write        Print summary only; do not write a markdown file.",
      "  --json            Print JSON to stdout after the markdown summary.",
      "  --help            Show this message.",
      "",
    ].join("\n")
  );
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const model = buildReadinessModel();
  const markdown = renderMarkdown(model);
  process.stdout.write(markdown);
  if (args.writeFile) {
    fs.writeFileSync(args.output, markdown, "utf8");
  }
  if (args.jsonStdout) {
    process.stdout.write(`${JSON.stringify(model, null, 2)}\n`);
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
