// Validates explicit vitest file-path arguments in npm scripts.
// Usage: node scripts/check_npm_script_paths.js <package-json-path> [scriptName ...]

const fs = require("fs");
const path = require("path");

const [, , packageJsonArg, ...scriptNames] = process.argv;
const packageJsonPath = packageJsonArg
  ? path.resolve(process.cwd(), packageJsonArg)
  : path.resolve(process.cwd(), "frontend/package.json");

if (!fs.existsSync(packageJsonPath)) {
  console.error(`[check_npm_script_paths] package.json not found: ${packageJsonPath}`);
  process.exit(1);
}

const packageDir = path.dirname(packageJsonPath);
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const scripts = packageJson.scripts ?? {};

const selectedScriptNames =
  scriptNames.length > 0
    ? scriptNames
    : Object.keys(scripts).filter((name) => String(scripts[name]).includes("vitest run"));

const tokenize = (command) => command.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];

const stripQuotes = (token) => {
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  return token;
};

const isFilePathCandidate = (token) => {
  if (!token || token.startsWith("-")) return false;
  if (token.includes("*")) return false;
  return /\.(test\.)?(ts|tsx|js|jsx|mjs|cjs)$/.test(token);
};

const splitSegments = (command) => command.split("&&").map((segment) => segment.trim());

const missing = [];

for (const scriptName of selectedScriptNames) {
  const command = scripts[scriptName];
  if (typeof command !== "string" || command.trim().length === 0) continue;

  for (const segment of splitSegments(command)) {
    if (!segment.includes("vitest run")) continue;
    const tokens = tokenize(segment).map(stripQuotes);
    const vitestIndex = tokens.findIndex((token) => token === "vitest");
    if (vitestIndex < 0 || tokens[vitestIndex + 1] !== "run") continue;

    const candidateTokens = tokens.slice(vitestIndex + 2).filter(isFilePathCandidate);
    for (const candidate of candidateTokens) {
      const absolutePath = path.resolve(packageDir, candidate);
      if (!fs.existsSync(absolutePath)) {
        missing.push({ scriptName, path: candidate });
      }
    }
  }
}

if (missing.length > 0) {
  console.error("[check_npm_script_paths] Missing file paths referenced by vitest scripts:");
  for (const entry of missing) {
    console.error(`  - ${entry.scriptName}: ${entry.path}`);
  }
  process.exit(1);
}

console.log(
  `[check_npm_script_paths] OK (${selectedScriptNames.length} script${selectedScriptNames.length === 1 ? "" : "s"} checked)`
);
