// Architecture boundary checks for AI agent modularization.
// Run with: node scripts/check_architecture_boundaries.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const AI_STUDIO_ROOT = path.join(FRONTEND_ROOT, "features", "ai-studio");
const AGENT_FEATURE_ROOT = path.join(FRONTEND_ROOT, "features", "ai-agent");
const AGENT_CORE_ROOT = path.join(FRONTEND_ROOT, "features", "agent-core");
const AGENT_API_ROUTES = [
  path.join(FRONTEND_ROOT, "pages", "api", "ai", "studio-agent.ts"),
  path.join(FRONTEND_ROOT, "pages", "api", "ai", "generate-prompt.ts"),
  path.join(FRONTEND_ROOT, "pages", "api", "ai", "describe-image.ts"),
];

const TS_FILE_PATTERN = /\.(ts|tsx)$/;
const IMPORT_RE = /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (TS_FILE_PATTERN.test(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function readImports(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const imports = [];
  let match = IMPORT_RE.exec(text);
  while (match) {
    imports.push(match[1].trim());
    match = IMPORT_RE.exec(text);
  }
  return imports;
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, "/");
}

function resolveImportPath(fromFile, specifier) {
  if (!specifier) return null;
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), specifier);
  }
  if (specifier.startsWith("frontend/")) {
    return path.resolve(REPO_ROOT, specifier);
  }
  if (specifier.startsWith("features/")) {
    return path.resolve(FRONTEND_ROOT, specifier);
  }
  return null;
}

function isInside(targetPath, parentPath) {
  const normalizedTarget = toPosix(path.resolve(targetPath));
  const normalizedParent = toPosix(path.resolve(parentPath));
  return normalizedTarget === normalizedParent || normalizedTarget.startsWith(`${normalizedParent}/`);
}

function checkBoundaries() {
  const errors = [];
  const filesToCheck = [...walk(AGENT_FEATURE_ROOT), ...walk(AGENT_CORE_ROOT), ...AGENT_API_ROUTES];

  for (const filePath of filesToCheck) {
    if (!fs.existsSync(filePath)) continue;
    const imports = readImports(filePath);
    for (const specifier of imports) {
      const resolved = resolveImportPath(filePath, specifier);
      if (!resolved) continue;
      if (isInside(resolved, AI_STUDIO_ROOT)) {
        const relFile = toPosix(path.relative(REPO_ROOT, filePath));
        errors.push(
          `${relFile} imports AI Studio internals (${specifier}). Move shared logic to agent-core/shared modules.`
        );
      }
    }
  }

  if (errors.length) {
    console.error("Architecture boundary checks failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Architecture boundary checks passed.");
}

checkBoundaries();
