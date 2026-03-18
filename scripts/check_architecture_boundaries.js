// Architecture boundary checks for AI agent and reference-grid modularization.
// Run with: node scripts/check_architecture_boundaries.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const AI_STUDIO_ROOT = path.join(FRONTEND_ROOT, "features", "ai-studio");
const SERVER_RUNTIME_ROOT = path.join(FRONTEND_ROOT, "lib", "server");
const API_ROUTES_ROOT = path.join(FRONTEND_ROOT, "pages", "api");
const AGENT_FEATURE_ROOT = path.join(FRONTEND_ROOT, "features", "ai-agent");
const AGENT_CORE_ROOT = path.join(FRONTEND_ROOT, "features", "agent-core");
const AGENT_RUNTIME_ROOT = path.join(FRONTEND_ROOT, "features", "agent-runtime");
const MEDIA_LIBRARY_ROOT = path.join(FRONTEND_ROOT, "features", "media-library");
const ADAPTIVE_MEDIA_ROOT = path.join(FRONTEND_ROOT, "lib", "adaptive-media");
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
const EXPERT_EDIT_ROOT = path.join(AI_STUDIO_ROOT, "components", "edit");
const CHARACTER_MANAGER_ROOT = path.join(FRONTEND_ROOT, "features", "character-manager");
const ADMIN_PAGE_ROOT = path.join(FRONTEND_ROOT, "pages", "admin");
const ADMIN_API_ROOT = path.join(FRONTEND_ROOT, "pages", "api", "admin");
const ADMIN_HEALTH_SERVER_ROOT = path.join(FRONTEND_ROOT, "lib", "server", "adminUserHealth");
const LANE_B_BOUNDARY_RULES = [
  {
    name: "expert-edit",
    modeEnv: "EXPERT_EDIT_BOUNDARY_MODE",
    fileRoots: [EXPERT_EDIT_ROOT],
    forbiddenRoots: [path.join(FRONTEND_ROOT, "pages")],
  },
  {
    name: "character-manager",
    modeEnv: "CHARACTER_MANAGER_BOUNDARY_MODE",
    fileRoots: [CHARACTER_MANAGER_ROOT],
    forbiddenRoots: [path.join(FRONTEND_ROOT, "pages", "api")],
  },
  {
    name: "admin-health",
    modeEnv: "ADMIN_HEALTH_BOUNDARY_MODE",
    fileRoots: [ADMIN_PAGE_ROOT, ADMIN_API_ROOT, ADMIN_HEALTH_SERVER_ROOT],
    forbiddenRoots: [
      path.join(AI_STUDIO_ROOT, "components", "edit"),
      path.join(FRONTEND_ROOT, "features", "character-manager", "components"),
    ],
  },
];
const LANE_B_CYCLE_RULES = [
  {
    name: "expert-edit",
    modeEnv: "EXPERT_EDIT_CYCLE_MODE",
    roots: [EXPERT_EDIT_ROOT],
  },
  {
    name: "character-manager",
    modeEnv: "CHARACTER_MANAGER_CYCLE_MODE",
    roots: [CHARACTER_MANAGER_ROOT],
  },
  {
    name: "admin-health",
    modeEnv: "ADMIN_HEALTH_CYCLE_MODE",
    roots: [ADMIN_PAGE_ROOT, ADMIN_API_ROOT, ADMIN_HEALTH_SERVER_ROOT],
  },
];
const MEDIA_RENDERING_BOUNDARY_RULES = [
  {
    name: "media-rendering",
    modeEnv: "MEDIA_RENDERING_BOUNDARY_MODE",
    fileRoots: [ADAPTIVE_MEDIA_ROOT, path.join(MEDIA_LIBRARY_ROOT, "logic")],
    forbiddenRoots: [
      path.join(FRONTEND_ROOT, "pages"),
      path.join(AI_STUDIO_ROOT, "components"),
      path.join(AI_STUDIO_ROOT, "hooks"),
      path.join(MEDIA_LIBRARY_ROOT, "components"),
      path.join(MEDIA_LIBRARY_ROOT, "hooks"),
      path.join(CHARACTER_MANAGER_ROOT, "components"),
    ],
  },
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
  IMPORT_RE.lastIndex = 0;
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
  if (specifier.startsWith("@/")) {
    return path.resolve(FRONTEND_ROOT, specifier.slice(2));
  }
  if (specifier.startsWith("frontend/")) {
    return path.resolve(REPO_ROOT, specifier);
  }
  if (specifier.startsWith("features/")) {
    return path.resolve(FRONTEND_ROOT, specifier);
  }
  return null;
}

function resolveImportFilePath(fromFile, specifier) {
  const resolved = resolveImportPath(fromFile, specifier);
  if (!resolved) return null;

  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.mjs`,
    `${resolved}.cjs`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
    path.join(resolved, "index.mjs"),
    path.join(resolved, "index.cjs"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    if (!TS_FILE_PATTERN.test(candidate)) continue;
    return path.resolve(candidate);
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

function collectServerAiStudioBoundaryErrors() {
  const errors = [];
  const filesToCheck = [...walk(SERVER_RUNTIME_ROOT), ...walk(API_ROUTES_ROOT)];

  for (const filePath of filesToCheck) {
    const imports = readImports(filePath);
    for (const specifier of imports) {
      const resolved = resolveImportPath(filePath, specifier);
      if (!resolved) continue;
      if (!isInside(resolved, AI_STUDIO_ROOT)) continue;
      const relFile = toPosix(path.relative(REPO_ROOT, filePath));
      errors.push(
        `${relFile} imports AI Studio feature internals (${specifier}). Move shared logic to frontend/lib/model-runtime/* and keep feature layer UI-owned.`
      );
    }
  }

  return errors;
}

function collectLaneBImportBoundaryErrors(fileRoots, forbiddenRoots) {
  const errors = [];
  const filesToCheck = fileRoots.flatMap((root) => walk(root));

  for (const filePath of filesToCheck) {
    const imports = readImports(filePath);
    for (const specifier of imports) {
      const resolved = resolveImportPath(filePath, specifier);
      if (!resolved) continue;
      const forbiddenRoot = forbiddenRoots.find((root) => isInside(resolved, root));
      if (!forbiddenRoot) continue;
      const relFile = toPosix(path.relative(REPO_ROOT, filePath));
      const relForbidden = toPosix(path.relative(REPO_ROOT, forbiddenRoot));
      errors.push(`${relFile} imports forbidden path (${specifier}) under ${relForbidden}.`);
    }
  }

  return errors;
}

function findCycles(adjacency) {
  const state = new Map();
  const stack = [];
  const stackIndex = new Map();
  const cycles = [];
  const cycleKeys = new Set();
  const nodes = Array.from(adjacency.keys());
  const MAX_CYCLES = 25;

  function addCycle(cycleNodes) {
    if (cycles.length >= MAX_CYCLES) return;
    const normalized = cycleNodes.map((node) => toPosix(path.relative(REPO_ROOT, node)));
    const anchor = [...normalized].sort()[0] || normalized[0];
    const anchorIndex = normalized.indexOf(anchor);
    const ordered =
      anchorIndex > -1
        ? [...normalized.slice(anchorIndex), ...normalized.slice(0, anchorIndex)]
        : normalized;
    const key = ordered.join(" -> ");
    if (cycleKeys.has(key)) return;
    cycleKeys.add(key);
    cycles.push(ordered);
  }

  function dfs(node) {
    state.set(node, 1);
    stackIndex.set(node, stack.length);
    stack.push(node);

    const neighbors = adjacency.get(node) || [];
    for (const next of neighbors) {
      const nextState = state.get(next) || 0;
      if (nextState === 0) {
        dfs(next);
      } else if (nextState === 1) {
        const startIndex = stackIndex.get(next);
        if (startIndex === undefined) continue;
        const cyclePath = stack.slice(startIndex);
        cyclePath.push(next);
        addCycle(cyclePath);
      }
      if (cycles.length >= MAX_CYCLES) break;
    }

    stack.pop();
    stackIndex.delete(node);
    state.set(node, 2);
  }

  for (const node of nodes) {
    if ((state.get(node) || 0) !== 0) continue;
    dfs(node);
    if (cycles.length >= MAX_CYCLES) break;
  }

  return cycles.map((cycle) => cycle.join(" -> "));
}

function collectCycleErrors(roots) {
  const fileSet = new Set(roots.flatMap((root) => walk(root).map((file) => path.resolve(file))));
  const adjacency = new Map();
  for (const filePath of fileSet) {
    adjacency.set(filePath, []);
  }

  for (const filePath of fileSet) {
    const imports = readImports(filePath);
    const neighbors = adjacency.get(filePath);
    for (const specifier of imports) {
      const resolvedFile = resolveImportFilePath(filePath, specifier);
      if (!resolvedFile) continue;
      if (!fileSet.has(resolvedFile)) continue;
      if (!neighbors.includes(resolvedFile)) {
        neighbors.push(resolvedFile);
      }
    }
  }

  return findCycles(adjacency).map((cycle) => `Dependency cycle detected: ${cycle}`);
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
  const architectureMode = resolveMode(process.env.ARCHITECTURE_BOUNDARY_MODE, "warn");
  const referenceGridMode = resolveMode(process.env.REFERENCE_GRID_BOUNDARY_MODE, "warn");
  const agentErrors = collectAgentBoundaryErrors();
  const referenceFoundationErrors = collectReferenceFoundationErrors();
  const serverAiStudioBoundaryErrors = collectServerAiStudioBoundaryErrors();

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

  if (serverAiStudioBoundaryErrors.length) {
    if (architectureMode === "enforce") {
      printErrors(
        "Architecture boundary checks failed (server/runtime cannot import AI Studio feature internals):",
        serverAiStudioBoundaryErrors
      );
      hardErrors.push(...serverAiStudioBoundaryErrors);
    } else {
      console.warn("Server/runtime AI Studio boundary checks failed in warn mode:");
      for (const error of serverAiStudioBoundaryErrors) {
        console.warn(`- ${error}`);
      }
    }
  }

  for (const rule of LANE_B_BOUNDARY_RULES) {
    const mode = resolveMode(process.env[rule.modeEnv], "warn");
    const errors = collectLaneBImportBoundaryErrors(rule.fileRoots, rule.forbiddenRoots);
    if (!errors.length) continue;
    if (mode === "enforce") {
      printErrors(`Architecture boundary checks failed (${rule.name} boundaries):`, errors);
      hardErrors.push(...errors);
    } else {
      console.warn(`${rule.name} boundary checks failed in warn mode:`);
      for (const error of errors) {
        console.warn(`- ${error}`);
      }
    }
  }

  for (const rule of MEDIA_RENDERING_BOUNDARY_RULES) {
    const mode = resolveMode(process.env[rule.modeEnv], "warn");
    const errors = collectLaneBImportBoundaryErrors(rule.fileRoots, rule.forbiddenRoots);
    if (!errors.length) continue;
    if (mode === "enforce") {
      printErrors(`Architecture boundary checks failed (${rule.name} boundaries):`, errors);
      hardErrors.push(...errors);
    } else {
      console.warn(`${rule.name} boundary checks failed in warn mode:`);
      for (const error of errors) {
        console.warn(`- ${error}`);
      }
    }
  }

  for (const rule of LANE_B_CYCLE_RULES) {
    const mode = resolveMode(process.env[rule.modeEnv], "warn");
    const errors = collectCycleErrors(rule.roots);
    if (!errors.length) continue;
    if (mode === "enforce") {
      printErrors(`Architecture boundary checks failed (${rule.name} cycles):`, errors);
      hardErrors.push(...errors);
    } else {
      console.warn(`${rule.name} cycle checks failed in warn mode:`);
      for (const error of errors) {
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
