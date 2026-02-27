#!/usr/bin/env node

/**
 * Loads local env files for repo scripts without overriding explicitly-exported env vars.
 * Supports repeated `--env-file <path>` CLI args; otherwise falls back to default paths.
 */

import fs from "node:fs";
import path from "node:path";

const stripWrappingQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
  const eqIndex = withoutExport.indexOf("=");
  if (eqIndex <= 0) return null;

  const key = withoutExport.slice(0, eqIndex).trim();
  const rawValue = withoutExport.slice(eqIndex + 1);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  return {
    key,
    value: stripWrappingQuotes(rawValue),
  };
};

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .filter(Boolean);
};

const parseCliEnvFiles = (argv) => {
  const explicit = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--env-file") continue;
    const value = argv[index + 1];
    if (value) {
      explicit.push(value.trim());
      index += 1;
    }
  }
  return explicit;
};

/**
 * Loads env variables from local files. Exported shell vars win over file values.
 * @param {{ argv?: string[], defaultPaths?: string[] }} options
 * @returns {string[]} loaded absolute file paths
 */
export const loadLocalEnv = ({ argv = [], defaultPaths = [] } = {}) => {
  const explicitPaths = parseCliEnvFiles(argv);
  const candidatePaths = explicitPaths.length > 0 ? explicitPaths : defaultPaths;
  const loadedFiles = [];

  for (const candidate of candidatePaths) {
    if (!candidate) continue;
    const resolved = path.resolve(process.cwd(), candidate);
    const parsed = readEnvFile(resolved);
    if (parsed.length === 0) continue;

    for (const entry of parsed) {
      if (process.env[entry.key] === undefined || process.env[entry.key] === "") {
        process.env[entry.key] = entry.value;
      }
    }
    loadedFiles.push(resolved);
  }

  return loadedFiles;
};
