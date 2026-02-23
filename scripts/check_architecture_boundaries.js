// Architecture boundary checks for AI agent and reference-grid modularization.
// Run with: node scripts/check_architecture_boundaries.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const AI_STUDIO_ROOT = path.join(FRONTEND_ROOT, "features", "ai-studio");
const AGENT_FEATURE_ROOT = path.join(FRONTEND_ROOT, "features", "ai-agent");
const AGENT_CORE_ROOT = path.join(FRONTEND_ROOT, "features", "agent-core");
const AGENT_RUNTIME_ROOT = path.join(FRONTEND_ROOT, "features", "agent-runtime");
const MEDIA_LIBRARY_ROOT = path.join(FRONTEND_ROOT, "features", "media-library");
const REFERENCE_DOMAIN_ROOT = path.join(AI_STUDIO_ROOT, "reference-domain");
const REFERENCE_INGESTION_ROOT = path.join(AI_STUDIO_ROOT, "reference-ingestion");
const REFERENCE_PROJECTIONS_ROOT = path.join(AI_STUDIO_ROOT, "reference-projections");
const REFERENCE_DND_ROOT = path.join(AI_STUDIO_ROOT, "reference-dnd");
const REFERENCE_FOUNDATION_ROOTS = [
  REFERENCE_DOMAIN_ROOT,
  REFERENCE_INGESTION_ROOT,
  REFERENCE_PROJECTIONS_ROOT,
  REFERENCE_DND_ROOT,
];
const REFERENCE_FOUNDATION_FORBIDDEN_IMPORT_ROOTS = [
  path.join(FRONTEND_ROOT, "pages"),
  path.join(AI_STUDIO_ROOT, "components"),
  path.join(AI_STUDIO_ROOT, "hooks"),
  path.join(MEDIA_LIBRARY_ROOT, "components"),
  path.join(MEDIA_LIBRARY_ROOT, "hooks"),
];
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

function resolveMode(inputMode, fallbackMode = "warn") {
  if (inputMode === "warn" || inputMode === "enforce") {
    return inputMode;
  }
  if (inputMode) {
    console.warn(`Unknown mode '${inputMode}'. Falling back to '${fallbackMode}'.`);
  }
  return fallbackMode;
}

function collectAgentBoundaryErrors() {
  const errors = [];
  const filesToCheck = [
    ...walk(AGENT_FEATURE_ROOT),
    ...walk(AGENT_CORE_ROOT),
    ...walk(AGENT_RUNTIME_ROOT),
    ...AGENT_API_ROUTES,
  ];

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

  return errors;
}

function collectReferenceFoundationErrors() {
  const errors = [];
  const filesToCheck = REFERENCE_FOUNDATION_ROOTS.flatMap((root) => walk(root));

  for (const filePath of filesToCheck) {
    const imports = readImports(filePath);
    for (const specifier of imports) {
      const resolved = resolveImportPath(filePath, specifier);
      if (!resolved) continue;
      const forbiddenRoot = REFERENCE_FOUNDATION_FORBIDDEN_IMPORT_ROOTS.find((root) =>
        isInside(resolved, root)
      );
      if (!forbiddenRoot) continue;
      const relFile = toPosix(path.relative(REPO_ROOT, filePath));
      const relForbidden = toPosix(path.relative(REPO_ROOT, forbiddenRoot));
      errors.push(
        `${relFile} imports forbidden UI/runtime path (${specifier}) under ${relForbidden}.`
      );
    }
  }

  return errors;
}

function printErrors(header, errors) {
  if (!errors.length) return;
  console.error(header);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
}

function checkBoundaries() {
  const hardErrors = [];
  const referenceGridMode = resolveMode(process.env.REFERENCE_GRID_BOUNDARY_MODE, "warn");
  const agentErrors = collectAgentBoundaryErrors();
  const referenceFoundationErrors = collectReferenceFoundationErrors();

  if (agentErrors.length) {
    printErrors("Architecture boundary checks failed (agent boundaries):", agentErrors);
    hardErrors.push(...agentErrors);
  }

  if (referenceFoundationErrors.length) {
    if (referenceGridMode === "enforce") {
      printErrors(
        "Architecture boundary checks failed (reference-grid boundaries):",
        referenceFoundationErrors
      );
      hardErrors.push(...referenceFoundationErrors);
    } else {
      console.warn("Reference-grid boundary checks failed in warn mode:");
      for (const error of referenceFoundationErrors) {
        console.warn(`- ${error}`);
      }
    }
  }

  if (hardErrors.length) {
    process.exit(1);
  }

  console.log("Architecture boundary checks passed.");
}

checkBoundaries();
