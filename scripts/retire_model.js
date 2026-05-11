// Validates and prints a safe retirement plan for one catalog-backed model.
// Non-destructive: this script only prints the recommended catalog patch and
// validation checklist.
//
// Example:
//   node scripts/retire_model.js \
//     --model-id fal-ai/example/model \
//     --replacement-model-id fal-ai/example/replacement \
//     --lifecycle deprecated

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FRONTEND_ROOT, resolveFrontendPath } = require("./lib/repo_paths");

const MODEL_CATALOG_PATH = resolveFrontendPath(
  "lib",
  "model-runtime",
  "modelCatalog.ts",
);

const ALLOWED_LIFECYCLES = new Set(["deprecated", "disabled", "retired"]);
const tsModuleCache = new Map();

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function requireArg(args, key) {
  const value = String(args[key] || "").trim();
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function resolveLocalModule(fromFilePath, requestPath) {
  const base = path.resolve(path.dirname(fromFilePath), requestPath);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function loadTsModule(filePath) {
  const normalizedPath = path.resolve(filePath);
  if (tsModuleCache.has(normalizedPath)) {
    return tsModuleCache.get(normalizedPath);
  }

  const ts = require(path.join(FRONTEND_ROOT, "node_modules", "typescript"));
  const source = readText(normalizedPath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: normalizedPath,
  }).outputText;

  const moduleRecord = { exports: {} };
  tsModuleCache.set(normalizedPath, moduleRecord.exports);

  const localRequire = (requestPath) => {
    if (typeof requestPath === "string" && requestPath.startsWith(".")) {
      const resolved = resolveLocalModule(normalizedPath, requestPath);
      if (!resolved) {
        throw new Error(
          `Cannot resolve module '${requestPath}' from '${normalizedPath}'`,
        );
      }
      if (resolved.endsWith(".ts")) {
        return loadTsModule(resolved);
      }
      return require(resolved);
    }
    return require(requestPath);
  };

  const sandbox = {
    module: moduleRecord,
    exports: moduleRecord.exports,
    require: localRequire,
    __dirname: path.dirname(normalizedPath),
    __filename: normalizedPath,
    process,
    console,
  };

  new vm.Script(transpiled, { filename: normalizedPath }).runInNewContext(
    sandbox,
  );
  tsModuleCache.set(normalizedPath, sandbox.module.exports);
  return sandbox.module.exports;
}

function printList(title, items) {
  if (!items.length) return;
  console.log(`${title}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
  console.log("");
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const modelId = requireArg(args, "model-id");
  const replacementModelId = requireArg(args, "replacement-model-id");
  const lifecycle = String(args.lifecycle || "deprecated").trim();

  if (!ALLOWED_LIFECYCLES.has(lifecycle)) {
    throw new Error(
      `lifecycle must be one of: ${Array.from(ALLOWED_LIFECYCLES).join(", ")} (received '${lifecycle}')`,
    );
  }

  const catalogModule = loadTsModule(MODEL_CATALOG_PATH);
  const getModelCatalogEntry = catalogModule.getModelCatalogEntry;
  if (typeof getModelCatalogEntry !== "function") {
    throw new Error("getModelCatalogEntry export missing from modelCatalog.ts");
  }

  const currentEntry = getModelCatalogEntry(modelId);
  const replacementEntry = getModelCatalogEntry(replacementModelId);

  if (!currentEntry) {
    throw new Error(`Model not found in catalog: ${modelId}`);
  }
  if (!replacementEntry) {
    throw new Error(`Replacement model not found in catalog: ${replacementModelId}`);
  }
  if (currentEntry.modelId === replacementEntry.modelId) {
    throw new Error("Replacement model must differ from the retired model.");
  }
  if (replacementEntry.lifecycle !== "active") {
    throw new Error(
      `Replacement model must be active: ${replacementModelId} is '${replacementEntry.lifecycle}'`,
    );
  }
  if (currentEntry.mediaType !== replacementEntry.mediaType) {
    throw new Error(
      `Replacement model must preserve mediaType: ${modelId} (${currentEntry.mediaType}) -> ${replacementModelId} (${replacementEntry.mediaType})`,
    );
  }

  const warnings = [];
  const currentSurfaces = Array.isArray(currentEntry.surfaces)
    ? currentEntry.surfaces
    : [];
  const replacementSurfaces = Array.isArray(replacementEntry.surfaces)
    ? replacementEntry.surfaces
    : [];

  if (currentEntry.lifecycle !== "active") {
    warnings.push(
      `${modelId} is already '${currentEntry.lifecycle}'. This tool assumes the first lifecycle transition from active.`,
    );
  }
  if (
    currentEntry.submitHandler &&
    replacementEntry.submitHandler &&
    currentEntry.submitHandler !== replacementEntry.submitHandler
  ) {
    warnings.push(
      `submitHandler changes from '${currentEntry.submitHandler}' to '${replacementEntry.submitHandler}'. Validate restore and submission expectations carefully.`,
    );
  }
  if (
    currentEntry.executionMode &&
    replacementEntry.executionMode &&
    currentEntry.executionMode !== replacementEntry.executionMode
  ) {
    warnings.push(
      `executionMode changes from '${currentEntry.executionMode}' to '${replacementEntry.executionMode}'. Validate route/runtime continuity carefully.`,
    );
  }
  if (
    currentSurfaces.includes("picker") &&
    !replacementSurfaces.includes("picker")
  ) {
    warnings.push(
      `Replacement model is not picker-visible while ${modelId} is picker-visible.`,
    );
  }
  if (
    currentEntry.pairedModelId &&
    replacementEntry.pairedModelId &&
    currentEntry.pairedModelId !== replacementEntry.pairedModelId
  ) {
    warnings.push(
      `pairedModelId changes from '${currentEntry.pairedModelId}' to '${replacementEntry.pairedModelId}'. Check create/edit pairing policy before applying.`,
    );
  }

  console.log("Retirement summary:\n");
  console.log(`- Model: ${modelId}`);
  console.log(`- Current lifecycle: ${currentEntry.lifecycle}`);
  console.log(`- Replacement: ${replacementModelId}`);
  console.log(`- Target lifecycle: ${lifecycle}`);
  console.log(`- Media type: ${currentEntry.mediaType}`);
  console.log(`- Surfaces: ${(currentSurfaces || []).join(", ") || "(none)"}`);
  console.log("");

  printList("Warnings", warnings);

  console.log("Suggested catalog patch:\n");
  console.log(`${JSON.stringify(modelId)}: {`);
  console.log("  // existing entry fields...");
  console.log(`  lifecycle: ${JSON.stringify(lifecycle)},`);
  console.log(`  replacementModelId: ${JSON.stringify(replacementModelId)},`);
  console.log("},\n");

  console.log("Validation checklist:");
  console.log("- Run `npm -C frontend run model:doctor`.");
  console.log(
    "- Run focused restore tests: `npm -C frontend exec vitest run features/ai-studio/logic/__tests__/modelRestorePolicy.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`.",
  );
  console.log("- Verify any picker/default behavior tied to this model remains unchanged or intentionally migrates.");
  console.log("- If the model still has provider routes or docs, keep them until the compatibility window is complete.");
  console.log("- After the compatibility window, remove route/docs/runtime residue in a separate cleanup pass.");
}

try {
  run();
} catch (error) {
  console.error(
    `[retire-model] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
