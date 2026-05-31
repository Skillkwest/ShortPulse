#!/usr/bin/env node
/**
 * Filters repo-wide TypeScript diagnostics down to the files in the current lane.
 * This keeps local packet validation useful while broader test-suite type debt exists.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, "..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const printUsage = () => {
  console.log(`Usage:
  node scripts/typecheck_changed_files.mjs [options]

Options:
  --path <path>         File or directory to match diagnostics against. Repeatable.
                        Defaults to changed and untracked frontend TS/TSX files.
  --all                Print all type-check diagnostics and preserve tsc exit code.
  --help               Show this message.
`);
};

const normalizePath = (value) =>
  value
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/^frontend\//, "");

export const filterDiagnosticsForPaths = ({ output, paths }) => {
  const normalizedPaths = paths.map(normalizePath).filter(Boolean);
  if (normalizedPaths.length === 0) return [];

  const lines = output.split(/\r?\n/);
  const matched = [];
  let currentBlock = null;

  const flush = () => {
    if (currentBlock?.matched) matched.push(...currentBlock.lines);
    currentBlock = null;
  };

  for (const line of lines) {
    const diagnosticMatch = line.match(
      /^([^:(]+(?:\.[cm]?[tj]sx?|\.tsx?))\((\d+),(\d+)\):\s+error\s+TS\d+:/,
    );
    if (diagnosticMatch) {
      flush();
      const diagnosticPath = normalizePath(diagnosticMatch[1] ?? "");
      const matchedPath = normalizedPaths.some(
        (target) =>
          diagnosticPath === target ||
          diagnosticPath.startsWith(`${target}/`) ||
          target.startsWith(`${diagnosticPath}/`),
      );
      currentBlock = {
        matched: matchedPath,
        lines: [line],
      };
      continue;
    }

    if (
      currentBlock &&
      line.trim().length > 0 &&
      !/^[^:(]+\(\d+,\d+\):\s+error\s+TS\d+:/.test(line)
    ) {
      currentBlock.lines.push(line);
      continue;
    }

    flush();
  }
  flush();

  return matched;
};

const runCommand = ({ command, args, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

const collectGitPaths = async () => {
  const changed = await runCommand({
    command: "git",
    args: ["diff", "--name-only", "--diff-filter=ACMRTUXB"],
    cwd: REPO_ROOT,
  });
  const staged = await runCommand({
    command: "git",
    args: ["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"],
    cwd: REPO_ROOT,
  });
  const untracked = await runCommand({
    command: "git",
    args: ["ls-files", "--others", "--exclude-standard"],
    cwd: REPO_ROOT,
  });

  return [
    ...changed.stdout.split(/\r?\n/),
    ...staged.stdout.split(/\r?\n/),
    ...untracked.stdout.split(/\r?\n/),
  ]
    .map((value) => value.trim())
    .filter((value) => /^frontend\/.+\.tsx?$/.test(value))
    .map(normalizePath);
};

export const parseArgs = (argv) => {
  const parsed = {
    paths: [],
    all: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--all") {
      parsed.all = true;
      continue;
    }
    if (arg === "--path") {
      const value = argv[index + 1]?.trim();
      if (!value) throw new Error("--path requires a value");
      parsed.paths.push(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const paths =
    args.paths.length > 0
      ? args.paths.map(normalizePath)
      : await collectGitPaths();
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = await runCommand({
    command: npmCommand,
    args: ["run", "type-check", "--", "--pretty", "false"],
    cwd: FRONTEND_ROOT,
  });
  const output = `${result.stdout}${result.stderr}`;

  if (args.all) {
    process.stdout.write(output);
    process.exitCode = result.code;
    return;
  }

  const filtered = filterDiagnosticsForPaths({ output, paths });
  if (filtered.length > 0) {
    console.error(
      "[typecheck_changed_files] TypeScript diagnostics in touched paths:",
    );
    console.error(filtered.join("\n"));
    process.exitCode = 1;
    return;
  }

  if (result.code === 0) {
    console.log("[typecheck_changed_files] OK: repo type-check passed.");
    return;
  }

  console.log(
    `[typecheck_changed_files] OK: no diagnostics matched ${paths.length} touched frontend TS path${paths.length === 1 ? "" : "s"}. Repo-wide type-check still has unrelated diagnostics.`,
  );
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(
      "[typecheck_changed_files] Failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
