// Model platform validation command.
// Aggregates existing parity checks with additional no-behavior-change
// policy/governance checks for the manifest-backed model system.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const {
  FRONTEND_ROOT,
  REPO_ROOT,
  resolveFrontendPath,
  resolveRepoPath,
} = require("./lib/repo_paths");

const MODEL_CATALOG_PATH = resolveFrontendPath(
  "lib",
  "model-runtime",
  "modelCatalog.ts",
);
const CREATE_CHARACTER_MODE_MAPPING_PATH = resolveFrontendPath(
  "features",
  "ai-studio",
  "logic",
  "createCharacterModeModelMapping.ts",
);
const CHARACTER_CONSTANTS_PATH = resolveFrontendPath(
  "features",
  "character",
  "constants.ts",
);
const CHARACTER_TYPES_PATH = resolveFrontendPath(
  "features",
  "character",
  "types.ts",
);
const EDIT_PROMPT_POLICY_PATH = resolveFrontendPath(
  "features",
  "ai-studio",
  "logic",
  "editPromptPolicy.ts",
);
const MODEL_SELECTION_POLICY_PATH = resolveFrontendPath(
  "features",
  "ai-studio",
  "logic",
  "modelSelectionPolicy.ts",
);
const AI_STUDIO_CONSTANTS_PATH = resolveFrontendPath(
  "features",
  "ai-studio",
  "constants.ts",
);
const STATE_PARSERS_PATH = resolveFrontendPath(
  "features",
  "ai-studio",
  "logic",
  "stateParsers.ts",
);
const MODEL_MODAL_PATH = resolveFrontendPath(
  "features",
  "ai-studio",
  "components",
  "ModelModal.tsx",
);
const MODEL_MODAL_PRESENTATION_PATH = resolveFrontendPath(
  "features",
  "ai-studio",
  "logic",
  "modelModalPresentation.ts",
);
const GENERATION_ADMISSION_TIERS_PATH = resolveFrontendPath(
  "lib",
  "model-runtime",
  "generationAdmissionTiers.ts",
);
const MODEL_WORKFLOW_TYPE_PATH = resolveFrontendPath(
  "lib",
  "model-runtime",
  "modelWorkflowType.ts",
);
const PROVIDER_RUNTIME_CONFIG_PATH = resolveFrontendPath(
  "lib",
  "server",
  "providerIntegration",
  "providerRuntimeConfig.ts",
);
const ELEVENLABS_MUSIC_ROUTE_PATH = resolveFrontendPath(
  "pages",
  "api",
  "elevenlabs",
  "music.ts",
);
const ELEVENLABS_SOUND_EFFECTS_ROUTE_PATH = resolveFrontendPath(
  "pages",
  "api",
  "elevenlabs",
  "sound-effects.ts",
);
const ELEVENLABS_TEXT_TO_SPEECH_ROUTE_PATH = resolveFrontendPath(
  "pages",
  "api",
  "elevenlabs",
  "text-to-speech.ts",
);
const ELEVENLABS_SPEECH_TO_SPEECH_ROUTE_PATH = resolveFrontendPath(
  "pages",
  "api",
  "elevenlabs",
  "speech-to-speech.ts",
);
const CHECK_MODEL_CATALOG_PARITY_PATH = resolveRepoPath(
  "scripts",
  "check_model_catalog_parity.js",
);
const CHECK_FAL_ROUTE_WRAPPERS_PATH = resolveRepoPath(
  "scripts",
  "sync_fal_route_wrappers.js",
);
const FAL_ROUTE_INVENTORY_PATH = resolveRepoPath(
  "scripts",
  "lib",
  "fal_route_inventory.js",
);
const DIRECT_PROVIDER_ROUTE_INVENTORY_PATH = resolveRepoPath(
  "scripts",
  "lib",
  "direct_provider_route_inventory.js",
);
const PACKAGE_JSON_PATH = resolveFrontendPath("package.json");
const DOCS_INDEX_PATH = resolveRepoPath("docs", "README.md");
const DOCS_SOPS_INDEX_PATH = resolveRepoPath("docs", "sops", "README.md");
const DOCS_ADR_INDEX_PATH = resolveRepoPath("docs", "adr", "README.md");
const MODEL_RETIREMENT_SOP_PATH = resolveRepoPath(
  "docs",
  "sops",
  "sop_model_retirement.md",
);
const MODEL_INVENTORY_ADR_PATH = resolveRepoPath(
  "docs",
  "adr",
  "0076-model-inventory-operator-only-and-server-allowlisted.md",
);
const SUBMISSION_ADAPTER_METADATA_PATH = resolveFrontendPath(
  "lib",
  "model-runtime",
  "submissionAdapterMetadata.ts",
);
const TOOLING_BUNDLE_PATHS = [
  "scripts/model_doctor.js",
  "scripts/scaffold_model.js",
  "scripts/retire_model.js",
  "scripts/lib/fal_route_inventory.js",
  "scripts/lib/direct_provider_route_inventory.js",
  "scripts/lib/repo_paths.js",
  "scripts/sync_fal_route_wrappers.js",
  "docs/sops/sop_model_retirement.md",
  "docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md",
];
const ALLOWED_DIRECT_ROUTE_KINDS = new Set([
  "create",
  "edit",
  "audio-generate",
  "metadata-preview",
]);
const ALLOWED_DIRECT_ROUTE_AUTHORITIES = new Set([
  "server-constant",
  "catalog-default-role-allowlist",
  "catalog-default-role-server-default",
]);

const tsModuleCache = new Map();

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
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

function runExistingParityCheck() {
  const result = spawnSync("node", [CHECK_MODEL_CATALOG_PARITY_PATH], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  return result.status === 0;
}

function runFalRouteWrapperCheck() {
  const result = spawnSync("node", [CHECK_FAL_ROUTE_WRAPPERS_PATH, "--check"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  return result.status === 0;
}

function validateToolingBundle(errors) {
  for (const relativePath of TOOLING_BUNDLE_PATHS) {
    const absolutePath = resolveRepoPath(relativePath);
    if (!fs.existsSync(absolutePath)) {
      errors.push(
        `Required model-platform tooling bundle file is missing: ${relativePath}`,
      );
    }
  }

  const packageJson = JSON.parse(readText(PACKAGE_JSON_PATH));
  const scripts = packageJson.scripts || {};
  const requiredScriptEntries = {
    "fal:routes:sync": "node scripts/sync_fal_route_wrappers.js --write",
    "fal:routes:check": "node scripts/sync_fal_route_wrappers.js --check",
    "model:doctor": "node scripts/model_doctor.js",
    "model:scaffold": "node scripts/scaffold_model.js",
    "model:retire": "node scripts/retire_model.js",
  };

  for (const [scriptName, requiredSnippet] of Object.entries(
    requiredScriptEntries,
  )) {
    const scriptValue = String(scripts[scriptName] || "");
    if (!scriptValue.includes(requiredSnippet)) {
      errors.push(
        `frontend/package.json script '${scriptName}' must include '${requiredSnippet}'`,
      );
    }
  }

  const docsIndexText = readText(DOCS_INDEX_PATH);
  const docsSopsIndexText = readText(DOCS_SOPS_INDEX_PATH);
  const docsAdrIndexText = readText(DOCS_ADR_INDEX_PATH);

  if (!docsIndexText.includes("docs/sops/sop_model_retirement.md")) {
    errors.push("docs/README.md must index docs/sops/sop_model_retirement.md");
  }
  if (
    !docsIndexText.includes(
      "docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md",
    )
  ) {
    errors.push(
      "docs/README.md must index docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md",
    );
  }
  if (!docsSopsIndexText.includes("docs/sops/sop_model_retirement.md")) {
    errors.push(
      "docs/sops/README.md must index docs/sops/sop_model_retirement.md",
    );
  }
  if (
    !docsAdrIndexText.includes(
      "docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md",
    )
  ) {
    errors.push(
      "docs/adr/README.md must index docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md",
    );
  }

  const retirementSopText = readText(MODEL_RETIREMENT_SOP_PATH);
  if (!retirementSopText.includes("npm -C frontend run model:retire")) {
    errors.push(
      "docs/sops/sop_model_retirement.md must document npm -C frontend run model:retire",
    );
  }

  const modelInventoryAdrText = readText(MODEL_INVENTORY_ADR_PATH);
  if (!modelInventoryAdrText.includes("model:doctor")) {
    errors.push(
      "docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md must mention model:doctor as an enforcement follow-up",
    );
  }
}

function run() {
  const errors = [];
  const warnings = [];

  validateToolingBundle(errors);

  const catalogModule = loadTsModule(MODEL_CATALOG_PATH);
  const createCharacterModeModule = loadTsModule(
    CREATE_CHARACTER_MODE_MAPPING_PATH,
  );
  const characterConstantsModule = loadTsModule(CHARACTER_CONSTANTS_PATH);
  const editPromptPolicyModule = loadTsModule(EDIT_PROMPT_POLICY_PATH);
  const generationAdmissionTierModule = loadTsModule(
    GENERATION_ADMISSION_TIERS_PATH,
  );
  const submissionAdapterMetadataModule = loadTsModule(
    SUBMISSION_ADAPTER_METADATA_PATH,
  );
  const { FAL_ROUTE_INVENTORY = [] } = require(FAL_ROUTE_INVENTORY_PATH);
  const { DIRECT_PROVIDER_ROUTE_INVENTORY = [] } = require(
    DIRECT_PROVIDER_ROUTE_INVENTORY_PATH,
  );
  const listModelCatalogEntries = catalogModule.listModelCatalogEntries;
  const listCreateCharacterModeModelIds =
    catalogModule.listCreateCharacterModeModelIds;
  const getModelSubmissionAdapterKey =
    catalogModule.getModelSubmissionAdapterKey;
  const getModelDefaultRoles = catalogModule.getModelDefaultRoles;
  const getReplacementModelId = catalogModule.getReplacementModelId;
  const resolveModelIdForDefaultRole =
    catalogModule.resolveModelIdForDefaultRole;
  const getCreateCharacterModeAllowedModels =
    createCharacterModeModule.getCreateCharacterModeAllowedModels;
  const defaultCharacterTextModel =
    characterConstantsModule.defaultCharacterTextModel;
  const defaultCharacterEditModel =
    characterConstantsModule.defaultCharacterEditModel;
  const characterModelOptions = characterConstantsModule.characterModelOptions;
  const resolveEditPromptRequirement =
    editPromptPolicyModule.resolveEditPromptRequirement;
  const resolveGenerationAdmissionTier =
    generationAdmissionTierModule.resolveGenerationAdmissionTier;
  const submissionAdapterKeysByHandler =
    submissionAdapterMetadataModule.submissionAdapterKeysByHandler;
  if (typeof listModelCatalogEntries !== "function") {
    throw new Error(
      "listModelCatalogEntries export missing from modelCatalog.ts",
    );
  }

  const entries = listModelCatalogEntries();
  const entryById = new Map(
    entries.map((entry) => [String(entry.modelId || "").trim(), entry]),
  );

  const createCharacterModeEntries = entries
    .filter((entry) => typeof entry.createCharacterModeOrder === "number")
    .sort(
      (a, b) =>
        (a.createCharacterModeOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.createCharacterModeOrder ?? Number.MAX_SAFE_INTEGER),
    );
  const seenCharacterModeOrders = new Set();
  const seenDefaultRoleAssignments = new Map();
  const seenApiRouteSlugs = new Map();
  const falRouteInventoryByModelId = new Map(
    FAL_ROUTE_INVENTORY.map((entry) => [entry.modelId, entry]),
  );
  const falRouteInventoryByFileBase = new Map(
    FAL_ROUTE_INVENTORY.map((entry) => [entry.fileBase, entry]),
  );
  const directRouteInventoryByModelId = new Map();
  const seenDirectRoutePaths = new Set();
  const seenDirectRouteKindKeys = new Set();
  for (const entry of DIRECT_PROVIDER_ROUTE_INVENTORY) {
    const existing = directRouteInventoryByModelId.get(entry.modelId) ?? [];
    existing.push(entry);
    directRouteInventoryByModelId.set(entry.modelId, existing);
  }
  const requiredDefaultRoleExpectations = {
    "create-startup": {
      surface: "picker",
      lane: "text-to-image",
      mediaType: "image",
    },
    "create-character-mode-startup": {
      surface: "picker",
      lane: "image-to-image",
      mediaType: "image",
    },
    "edit-startup": {
      surface: "picker",
      lane: "image-to-image",
      mediaType: "image",
    },
    "audio-music": {
      surface: "audio_tool",
      lane: "music",
      mediaType: "audio",
    },
    "audio-sfx": {
      surface: "audio_tool",
      lane: "sfx",
      mediaType: "audio",
    },
    "audio-voiceover": {
      surface: "audio_tool",
      lane: "text-to-speech",
      mediaType: "audio",
    },
    "audio-voice-changer": {
      surface: "audio_tool",
      lane: "speech-to-speech",
      mediaType: "audio",
    },
    "audio-voice-design": {
      surface: "metadata",
      lane: "voice-design",
      mediaType: "audio",
    },
    "ai-studio-text-prompt": {
      surface: "internal_helper",
      lane: "text",
      mediaType: "text",
    },
    "studio-agent-chat": {
      surface: "internal_helper",
      lane: "text",
      mediaType: "text",
    },
    "studio-agent-vision": {
      surface: "internal_helper",
      lane: "text",
      mediaType: "text",
    },
    "style-extraction-vision": {
      surface: "internal_helper",
      lane: "text",
      mediaType: "text",
    },
    "style-extraction-fallback": {
      surface: "internal_helper",
      lane: "text",
      mediaType: "text",
    },
  };

  for (const entry of entries) {
    const modelId = String(entry.modelId || "").trim();
    if (!modelId) continue;

    const pairedModelId =
      typeof entry.pairedModelId === "string" ? entry.pairedModelId.trim() : "";
    const replacementModelId =
      typeof getReplacementModelId === "function"
        ? getReplacementModelId(modelId)
        : typeof entry.replacementModelId === "string"
          ? entry.replacementModelId.trim()
          : "";
    if (pairedModelId) {
      const pairedEntry = entryById.get(pairedModelId);
      if (!pairedEntry) {
        errors.push(
          `pairedModelId points at missing catalog model: ${modelId} -> ${pairedModelId}`,
        );
      } else if (String(pairedEntry.pairedModelId || "").trim() !== modelId) {
        errors.push(
          `pairedModelId must be symmetric: ${modelId} -> ${pairedModelId} but reverse is '${String(pairedEntry.pairedModelId || "").trim()}'`,
        );
      }
    }

    if (replacementModelId) {
      const replacementEntry = entryById.get(replacementModelId);
      if (!replacementEntry) {
        errors.push(
          `replacementModelId points at missing catalog model: ${modelId} -> ${replacementModelId}`,
        );
      } else {
        if (replacementEntry.lifecycle !== "active") {
          errors.push(
            `replacementModelId must point at an active model: ${modelId} -> ${replacementModelId}`,
          );
        }
        if (entry.mediaType && replacementEntry.mediaType !== entry.mediaType) {
          errors.push(
            `replacementModelId should preserve mediaType: ${modelId} (${entry.mediaType}) -> ${replacementModelId} (${replacementEntry.mediaType ?? "unknown"})`,
          );
        }
      }
    }

    if (typeof entry.createCharacterModeOrder === "number") {
      if (seenCharacterModeOrders.has(entry.createCharacterModeOrder)) {
        errors.push(
          `Duplicate createCharacterModeOrder: ${entry.createCharacterModeOrder}`,
        );
      }
      seenCharacterModeOrders.add(entry.createCharacterModeOrder);

      if (!pairedModelId && entry.supportsTextToImage !== true) {
        errors.push(
          `createCharacterModeOrder requires pairedModelId: ${modelId}`,
        );
      }
      if (entry.supportsImageToImage !== true) {
        errors.push(
          `createCharacterModeOrder requires supportsImageToImage=true: ${modelId}`,
        );
      }
      if (
        !Array.isArray(entry.surfaces) ||
        !entry.surfaces.includes("picker")
      ) {
        errors.push(
          `createCharacterModeOrder model must be picker-visible: ${modelId}`,
        );
      }
    }

    if (entry.promptPolicy) {
      if (entry.supportsImageToImage !== true) {
        errors.push(
          `promptPolicy requires supportsImageToImage=true: ${modelId}`,
        );
      }
      const resolvedPromptPolicy = resolveEditPromptRequirement(modelId);
      if (resolvedPromptPolicy !== entry.promptPolicy) {
        errors.push(
          `promptPolicy parity mismatch for ${modelId}: manifest='${entry.promptPolicy}' selector='${resolvedPromptPolicy}'`,
        );
      }
    }

    if (entry.admissionTier) {
      const resolvedAdmissionTier = resolveGenerationAdmissionTier(modelId);
      if (resolvedAdmissionTier !== entry.admissionTier) {
        errors.push(
          `admissionTier parity mismatch for ${modelId}: manifest='${entry.admissionTier}' selector='${resolvedAdmissionTier}'`,
        );
      }
    }

    if (entry.alwaysOnProviderRuntime === true && entry.provider !== "kie") {
      errors.push(
        `alwaysOnProviderRuntime is only supported for Kie models: ${modelId}`,
      );
    }

    if (
      (entry.lifecycle === "deprecated" ||
        entry.lifecycle === "disabled" ||
        entry.lifecycle === "retired") &&
      Array.isArray(entry.surfaces) &&
      (entry.surfaces.includes("picker") ||
        entry.surfaces.includes("runtime")) &&
      !replacementModelId
    ) {
      errors.push(
        `replacementModelId required for non-active picker/runtime model: ${modelId} (${entry.lifecycle})`,
      );
    }

    if (typeof getModelDefaultRoles === "function") {
      const defaultRoles = getModelDefaultRoles(modelId);
      if (!Array.isArray(defaultRoles)) {
        errors.push(
          `defaultRoles resolver must return an array for ${modelId}`,
        );
      } else {
        for (const role of defaultRoles) {
          const existingModelId = seenDefaultRoleAssignments.get(role);
          if (existingModelId) {
            errors.push(
              `default role '${role}' is assigned to multiple models: ${existingModelId}, ${modelId}`,
            );
          } else {
            seenDefaultRoleAssignments.set(role, modelId);
          }
        }
      }
    }

    const submitHandler =
      typeof entry.submitHandler === "string" ? entry.submitHandler : null;
    const apiRouteSlug =
      typeof entry.apiRouteSlug === "string" ? entry.apiRouteSlug.trim() : "";
    const manifestSubmissionAdapterKey =
      typeof getModelSubmissionAdapterKey === "function"
        ? getModelSubmissionAdapterKey(modelId)
        : (entry.submissionAdapterKey ?? null);
    if (
      submitHandler === "default" ||
      submitHandler === "image" ||
      submitHandler === "video"
    ) {
      if (!manifestSubmissionAdapterKey) {
        errors.push(
          `submissionAdapterKey missing for ${submitHandler} handler model: ${modelId}`,
        );
      }
      const allowedSubmissionAdapterKeys =
        submissionAdapterKeysByHandler?.[submitHandler];
      if (!allowedSubmissionAdapterKeys) {
        errors.push(
          `submission adapter key set missing for handler '${submitHandler}'`,
        );
      } else if (
        manifestSubmissionAdapterKey &&
        !allowedSubmissionAdapterKeys.includes(manifestSubmissionAdapterKey)
      ) {
        errors.push(
          `submissionAdapterKey is invalid for ${submitHandler} handler model ${modelId}: '${manifestSubmissionAdapterKey}'`,
        );
      }
    } else if (manifestSubmissionAdapterKey && submitHandler !== "audio") {
      errors.push(
        `submissionAdapterKey should be omitted for non-default/image/video handlers: ${modelId}`,
      );
    }

    if (apiRouteSlug) {
      const existingModelId = seenApiRouteSlugs.get(apiRouteSlug);
      if (existingModelId) {
        errors.push(
          `apiRouteSlug must be unique: '${apiRouteSlug}' is assigned to both ${existingModelId} and ${modelId}`,
        );
      } else {
        seenApiRouteSlugs.set(apiRouteSlug, modelId);
      }
    }

    const isQueuedFalOrKieModel =
      entry.executionMode === "queued" &&
      (entry.provider === "fal" || entry.provider === "kie");
    const isQueuedFalOrKieRuntimeModel =
      isQueuedFalOrKieModel &&
      entry.lifecycle === "active" &&
      Array.isArray(entry.surfaces) &&
      entry.surfaces.includes("runtime");
    const isQueuedFalOrKieCompatibilityRouteModel =
      isQueuedFalOrKieModel &&
      entry.lifecycle !== "active" &&
      Boolean(entry.replacementModelId);

    if (
      isQueuedFalOrKieRuntimeModel ||
      isQueuedFalOrKieCompatibilityRouteModel
    ) {
      if (!apiRouteSlug) {
        errors.push(
          `Queued ${entry.provider} route-owned model is missing apiRouteSlug: ${modelId}`,
        );
      } else {
        const routeInventoryEntry = falRouteInventoryByModelId.get(modelId);
        if (!routeInventoryEntry) {
          errors.push(
            `Queued ${entry.provider} runtime model is missing Fal/Kie route inventory entry: ${modelId}`,
          );
        } else {
          if (routeInventoryEntry.provider !== entry.provider) {
            errors.push(
              `Fal/Kie route inventory provider mismatch for ${modelId}: inventory='${routeInventoryEntry.provider}' catalog='${entry.provider}'`,
            );
          }
          if (routeInventoryEntry.fileBase !== apiRouteSlug) {
            errors.push(
              `Fal/Kie route inventory fileBase must match apiRouteSlug for ${modelId}: inventory='${routeInventoryEntry.fileBase}' catalog='${apiRouteSlug}'`,
            );
          }
        }
      }
    } else if (apiRouteSlug) {
      errors.push(
        `apiRouteSlug should be reserved for active queued fal/kie runtime models or deprecated compatibility routes: ${modelId}`,
      );
    }

    const isDirectProviderRuntimeModel =
      entry.lifecycle === "active" &&
      Array.isArray(entry.surfaces) &&
      entry.surfaces.includes("runtime") &&
      entry.executionMode === "direct" &&
      (entry.provider === "openai" || entry.provider === "elevenlabs");

    if (isDirectProviderRuntimeModel) {
      const directRouteEntries =
        directRouteInventoryByModelId.get(modelId) ?? [];
      if (!directRouteEntries.length) {
        errors.push(
          `Direct provider runtime model is missing direct route inventory entry: ${modelId}`,
        );
      }
    }
  }

  for (const routeEntry of FAL_ROUTE_INVENTORY) {
    const catalogEntry = entryById.get(routeEntry.modelId);
    if (!catalogEntry) {
      errors.push(
        `Fal/Kie route inventory points at missing catalog model: ${routeEntry.modelId}`,
      );
      continue;
    }
    const isCompatibilityRouteModel =
      catalogEntry.lifecycle !== "active" &&
      Boolean(catalogEntry.replacementModelId);

    if (catalogEntry.lifecycle !== "active" && !isCompatibilityRouteModel) {
      errors.push(
        `Fal/Kie route inventory model must stay active or declare compatibility replacement: ${routeEntry.modelId} is '${catalogEntry.lifecycle}'`,
      );
    }
    if (
      catalogEntry.lifecycle === "active" &&
      !catalogEntry.surfaces?.includes("runtime")
    ) {
      errors.push(
        `Fal/Kie route inventory model must include runtime surface: ${routeEntry.modelId}`,
      );
    }
    if (catalogEntry.executionMode !== "queued") {
      errors.push(
        `Fal/Kie route inventory model must stay queued: ${routeEntry.modelId}`,
      );
    }
    if (catalogEntry.provider !== routeEntry.provider) {
      errors.push(
        `Fal/Kie route inventory provider drift for ${routeEntry.modelId}: inventory='${routeEntry.provider}' catalog='${catalogEntry.provider}'`,
      );
    }
    if (catalogEntry.apiRouteSlug !== routeEntry.fileBase) {
      errors.push(
        `Fal/Kie route inventory fileBase drift for ${routeEntry.modelId}: inventory='${routeEntry.fileBase}' catalog='${catalogEntry.apiRouteSlug ?? ""}'`,
      );
    }
    const expectedRouteTimeoutMs =
      routeEntry.provider === "kie"
        ? catalogEntry.kieTimeoutMs
        : catalogEntry.falTimeoutMs;
    if (Number.isFinite(expectedRouteTimeoutMs)) {
      if (routeEntry.submitTimeoutMs !== expectedRouteTimeoutMs) {
        errors.push(
          `Fal/Kie route inventory submitTimeoutMs drift for ${routeEntry.modelId}: inventory='${routeEntry.submitTimeoutMs}' catalog='${expectedRouteTimeoutMs}'`,
        );
      }
      if (routeEntry.statusTimeoutMs !== expectedRouteTimeoutMs) {
        errors.push(
          `Fal/Kie route inventory statusTimeoutMs drift for ${routeEntry.modelId}: inventory='${routeEntry.statusTimeoutMs}' catalog='${expectedRouteTimeoutMs}'`,
        );
      }
    }
  }

  for (const [fileBase, routeEntry] of falRouteInventoryByFileBase.entries()) {
    const existingModelId = seenApiRouteSlugs.get(fileBase);
    if (!existingModelId) {
      errors.push(
        `Fal/Kie route inventory entry '${fileBase}' is not owned by any active queued fal/kie runtime model or deprecated compatibility route`,
      );
      continue;
    }
    if (existingModelId !== routeEntry.modelId) {
      errors.push(
        `Fal/Kie route inventory ownership mismatch for '${fileBase}': inventory='${routeEntry.modelId}' catalog='${existingModelId}'`,
      );
    }
  }

  const directInventoryModelIds = new Set();
  for (const routeEntry of DIRECT_PROVIDER_ROUTE_INVENTORY) {
    if (!routeEntry.routePath || typeof routeEntry.routePath !== "string") {
      errors.push(
        `Direct provider route inventory entry for ${routeEntry.modelId} is missing routePath`,
      );
      continue;
    }
    if (seenDirectRoutePaths.has(routeEntry.routePath)) {
      errors.push(
        `Direct provider route inventory routePath must be unique: ${routeEntry.routePath}`,
      );
    } else {
      seenDirectRoutePaths.add(routeEntry.routePath);
    }

    if (!ALLOWED_DIRECT_ROUTE_KINDS.has(routeEntry.directRouteKind)) {
      errors.push(
        `Direct provider route inventory has invalid directRouteKind '${routeEntry.directRouteKind}' for ${routeEntry.modelId}`,
      );
    }
    if (!ALLOWED_DIRECT_ROUTE_AUTHORITIES.has(routeEntry.authority)) {
      errors.push(
        `Direct provider route inventory has invalid authority '${routeEntry.authority}' for ${routeEntry.modelId}`,
      );
    }

    const directRouteKindKey = `${routeEntry.modelId}::${routeEntry.directRouteKind}`;
    if (seenDirectRouteKindKeys.has(directRouteKindKey)) {
      errors.push(
        `Direct provider route inventory must not duplicate model/kind pair '${directRouteKindKey}'`,
      );
    } else {
      seenDirectRouteKindKeys.add(directRouteKindKey);
    }

    if (
      !Array.isArray(routeEntry.requiredSymbols) ||
      routeEntry.requiredSymbols.length === 0
    ) {
      errors.push(
        `Direct provider route inventory entry must define requiredSymbols: ${routeEntry.modelId}`,
      );
    } else if (
      routeEntry.requiredSymbols.some(
        (symbol) => typeof symbol !== "string" || !symbol.trim(),
      )
    ) {
      errors.push(
        `Direct provider route inventory requiredSymbols must be non-empty strings: ${routeEntry.modelId}`,
      );
    }

    if (
      routeEntry.authority === "catalog-default-role-allowlist" &&
      (!routeEntry.requiredSymbols?.includes("ALLOWED_MODEL_IDS") ||
        !routeEntry.requiredSymbols?.includes("ALLOWED_MODEL_IDS.has(modelId)"))
    ) {
      errors.push(
        `Allowlist direct provider route must enforce ALLOWED_MODEL_IDS membership: ${routeEntry.modelId}`,
      );
    }
    if (
      routeEntry.authority === "catalog-default-role-server-default" &&
      !routeEntry.requiredSymbols?.some((symbol) =>
        symbol.startsWith("DEFAULT_"),
      )
    ) {
      errors.push(
        `Server-default direct provider route must declare a DEFAULT_* symbol: ${routeEntry.modelId}`,
      );
    }

    directInventoryModelIds.add(routeEntry.modelId);
    const catalogEntry = entryById.get(routeEntry.modelId);
    if (!catalogEntry) {
      errors.push(
        `Direct provider route inventory points at missing catalog model: ${routeEntry.modelId}`,
      );
      continue;
    }
    if (catalogEntry.lifecycle !== "active") {
      errors.push(
        `Direct provider route inventory model must stay active: ${routeEntry.modelId} is '${catalogEntry.lifecycle}'`,
      );
    }
    if (!catalogEntry.surfaces?.includes("runtime")) {
      errors.push(
        `Direct provider route inventory model must include runtime surface: ${routeEntry.modelId}`,
      );
    }
    if (catalogEntry.executionMode !== "direct") {
      errors.push(
        `Direct provider route inventory model must stay direct: ${routeEntry.modelId}`,
      );
    }
    if (catalogEntry.provider !== routeEntry.provider) {
      errors.push(
        `Direct provider route inventory provider drift for ${routeEntry.modelId}: inventory='${routeEntry.provider}' catalog='${catalogEntry.provider}'`,
      );
    }
    const routePath = path.join(REPO_ROOT, routeEntry.routePath);
    if (!fs.existsSync(routePath)) {
      errors.push(
        `Direct provider route inventory path is missing: ${routeEntry.routePath}`,
      );
      continue;
    }
    const source = readText(routePath);
    for (const requiredSymbol of routeEntry.requiredSymbols ?? []) {
      if (!source.includes(requiredSymbol)) {
        errors.push(
          `Direct provider route policy drift in ${routeEntry.routePath}: missing ${requiredSymbol}`,
        );
      }
    }
  }

  const activeDirectProviderRuntimeModelIds = new Set(
    entries
      .filter(
        (entry) =>
          entry.lifecycle === "active" &&
          entry.surfaces?.includes("runtime") &&
          entry.executionMode === "direct" &&
          (entry.provider === "openai" || entry.provider === "elevenlabs"),
      )
      .map((entry) => entry.modelId),
  );

  for (const modelId of activeDirectProviderRuntimeModelIds) {
    if (!directInventoryModelIds.has(modelId)) {
      errors.push(
        `Active direct provider runtime model is missing from direct route inventory: ${modelId}`,
      );
    }
  }

  if (typeof resolveModelIdForDefaultRole === "function") {
    for (const [role, expectation] of Object.entries(
      requiredDefaultRoleExpectations,
    )) {
      const resolvedModelId = resolveModelIdForDefaultRole(role);
      if (!resolvedModelId) {
        errors.push(`Missing default role assignment for ${role}`);
        continue;
      }
      const entry = entryById.get(resolvedModelId);
      if (!entry) {
        errors.push(
          `Default role ${role} resolves to missing model ${resolvedModelId}`,
        );
        continue;
      }
      if (!entry.surfaces?.includes(expectation.surface)) {
        errors.push(
          `Default role ${role} model ${resolvedModelId} must include surface '${expectation.surface}'`,
        );
      }
      if (entry.mediaType !== expectation.mediaType) {
        errors.push(
          `Default role ${role} model ${resolvedModelId} must use mediaType '${expectation.mediaType}'`,
        );
      }
      if (!entry.generationLanes?.includes(expectation.lane)) {
        errors.push(
          `Default role ${role} model ${resolvedModelId} must include generation lane '${expectation.lane}'`,
        );
      }
    }
  }

  const requiredCreateStartupModelId =
    typeof catalogModule.resolveRequiredCreateStartupModelId === "function"
      ? catalogModule.resolveRequiredCreateStartupModelId()
      : null;
  const requiredCreateCharacterModeStartupModelId =
    typeof catalogModule.resolveRequiredCreateCharacterModeStartupModelId ===
    "function"
      ? catalogModule.resolveRequiredCreateCharacterModeStartupModelId()
      : null;
  const requiredEditStartupModelId =
    typeof catalogModule.resolveRequiredEditStartupModelId === "function"
      ? catalogModule.resolveRequiredEditStartupModelId()
      : null;

  if (
    requiredCreateStartupModelId &&
    defaultCharacterTextModel !== requiredCreateStartupModelId
  ) {
    errors.push(
      `Character text default drifted from create startup default: character='${defaultCharacterTextModel}' startup='${requiredCreateStartupModelId}'`,
    );
  }
  if (
    requiredEditStartupModelId &&
    defaultCharacterEditModel !== requiredEditStartupModelId
  ) {
    errors.push(
      `Character edit default drifted from edit startup default: character='${defaultCharacterEditModel}' startup='${requiredEditStartupModelId}'`,
    );
  }
  if (
    !Array.isArray(characterModelOptions) ||
    characterModelOptions.length !== 2
  ) {
    errors.push("Character model options must contain exactly two entries.");
  } else {
    const optionValues = characterModelOptions.map((option) => option?.value);
    if (
      requiredCreateStartupModelId &&
      optionValues[0] !== requiredCreateStartupModelId
    ) {
      errors.push(
        `First Character model option must match create startup default: found '${optionValues[0]}' expected '${requiredCreateStartupModelId}'`,
      );
    }
    if (
      requiredEditStartupModelId &&
      optionValues[1] !== requiredEditStartupModelId
    ) {
      errors.push(
        `Second Character model option must match edit startup default: found '${optionValues[1]}' expected '${requiredEditStartupModelId}'`,
      );
    }
  }

  const modelModalSource = readText(MODEL_MODAL_PATH);
  const modelModalPresentationSource = readText(MODEL_MODAL_PRESENTATION_PATH);
  if (
    requiredCreateStartupModelId &&
    !modelModalSource.includes(requiredCreateStartupModelId) &&
    !modelModalSource.includes("MODEL_MODAL_TEXT_IMAGE_STARTUP_MODEL_ID")
  ) {
    errors.push(
      `ModelModal ordering metadata must include create startup model '${requiredCreateStartupModelId}'`,
    );
  }
  if (
    requiredCreateCharacterModeStartupModelId &&
    !modelModalSource.includes(requiredCreateCharacterModeStartupModelId) &&
    !modelModalSource.includes("MODEL_MODAL_EDIT_IMAGE_STARTUP_MODEL_ID")
  ) {
    errors.push(
      `ModelModal ordering metadata must include character-mode startup model '${requiredCreateCharacterModeStartupModelId}'`,
    );
  }
  if (
    requiredEditStartupModelId &&
    !modelModalSource.includes(requiredEditStartupModelId) &&
    !modelModalSource.includes("MODEL_MODAL_EDIT_IMAGE_STARTUP_MODEL_ID")
  ) {
    errors.push(
      `ModelModal ordering metadata must include edit startup model '${requiredEditStartupModelId}'`,
    );
  }

  if (!modelModalSource.includes("../logic/modelModalPresentation")) {
    errors.push(
      "ModelModal must import shared presentation helpers from ../logic/modelModalPresentation",
    );
  }

  const forbiddenLocalModalPresentationSymbols = [
    "const modelMeta",
    "const modelFamilyMeta",
    "function resolveModelFamilyKey",
    "const SECTION_LOGOS",
    "const TOOLTIP_TAG_PRIORITY",
    "const CONTEXT_TOOLTIP_TAG_MAP",
  ];

  for (const symbol of forbiddenLocalModalPresentationSymbols) {
    if (modelModalSource.includes(symbol)) {
      errors.push(
        `ModelModal should not redefine shared presentation symbol '${symbol}' locally`,
      );
    }
  }

  const requiredModalPresentationExports = [
    "MODEL_MODAL_FAMILY_META",
    "MODEL_MODAL_PRESENTATION_META",
    "resolveModelModalFamilyKey",
    "resolveModelModalContextTooltipTag",
    "resolveModelModalTooltipTags",
    "resolveModelModalLogo",
  ];

  for (const symbol of requiredModalPresentationExports) {
    if (!modelModalPresentationSource.includes(symbol)) {
      errors.push(
        `modelModalPresentation.ts must define shared presentation export '${symbol}'`,
      );
    }
  }

  if (typeof listCreateCharacterModeModelIds === "function") {
    const manifestCharacterModeIds = listCreateCharacterModeModelIds();
    const expectedCharacterModeIds = createCharacterModeEntries.map(
      (entry) => entry.modelId,
    );
    if (
      JSON.stringify(manifestCharacterModeIds) !==
      JSON.stringify(expectedCharacterModeIds)
    ) {
      errors.push(
        `listCreateCharacterModeModelIds drifted from catalog order: manifest=${JSON.stringify(manifestCharacterModeIds)} expected=${JSON.stringify(expectedCharacterModeIds)}`,
      );
    }
  }

  if (typeof getCreateCharacterModeAllowedModels === "function") {
    const selectorIds = getCreateCharacterModeAllowedModels();
    const expectedIds = createCharacterModeEntries.map(
      (entry) => entry.modelId,
    );
    if (JSON.stringify(selectorIds) !== JSON.stringify(expectedIds)) {
      errors.push(
        `getCreateCharacterModeAllowedModels drifted from catalog order: selector=${JSON.stringify(selectorIds)} expected=${JSON.stringify(expectedIds)}`,
      );
    }
  }

  const elevenLabsRouteChecks = [
    {
      filePath: ELEVENLABS_MUSIC_ROUTE_PATH,
      required: [
        "resolveRequiredAudioMusicModelId",
        "ALLOWED_MODEL_IDS",
        "ALLOWED_MODEL_IDS.has(modelId)",
      ],
    },
    {
      filePath: ELEVENLABS_SOUND_EFFECTS_ROUTE_PATH,
      required: [
        "resolveRequiredAudioSoundEffectsModelId",
        "ALLOWED_MODEL_IDS",
        "ALLOWED_MODEL_IDS.has(modelId)",
      ],
    },
    {
      filePath: ELEVENLABS_TEXT_TO_SPEECH_ROUTE_PATH,
      required: [
        "resolveRequiredAudioVoiceoverModelId",
        "ALLOWED_MODEL_IDS",
        "ALLOWED_MODEL_IDS.has(modelId)",
      ],
    },
    {
      filePath: ELEVENLABS_SPEECH_TO_SPEECH_ROUTE_PATH,
      required: [
        "resolveRequiredAudioVoiceChangerModelId",
        "ALLOWED_MODEL_IDS",
        "ALLOWED_MODEL_IDS.has(modelId)",
      ],
    },
  ];

  for (const check of elevenLabsRouteChecks) {
    const source = readText(check.filePath);
    for (const required of check.required) {
      if (!source.includes(required)) {
        errors.push(
          `ElevenLabs route policy drift in ${path.relative(REPO_ROOT, check.filePath)}: missing ${required}`,
        );
      }
    }
  }

  const residueChecks = [
    {
      filePath: EDIT_PROMPT_POLICY_PATH,
      forbidden: [
        "REQUIRED_EDIT_PROMPT_MODEL_IDS",
        "OPTIONAL_EDIT_PROMPT_MODEL_IDS",
      ],
    },
    {
      filePath: GENERATION_ADMISSION_TIERS_PATH,
      forbidden: ["IMAGE_HEAVY_MODEL_IDS"],
    },
    {
      filePath: PROVIDER_RUNTIME_CONFIG_PATH,
      forbidden: ["ALWAYS_ON_KIE_MODEL_IDS"],
    },
    {
      filePath: MODEL_WORKFLOW_TYPE_PATH,
      forbidden: [
        "TEXT_TO_VIDEO_MODEL_IDS",
        "IMAGE_TO_VIDEO_MODEL_IDS",
        "IMAGE_TO_IMAGE_MODEL_IDS",
      ],
    },
    {
      filePath: CREATE_CHARACTER_MODE_MAPPING_PATH,
      forbidden: [
        "resolveCreateStartupModelId() ??",
        "resolveCreateCharacterModeStartupModelId() ??",
      ],
    },
    {
      filePath: CHARACTER_CONSTANTS_PATH,
      forbidden: [
        "resolveCreateStartupModelId() ??",
        "resolveEditStartupModelId() ??",
      ],
    },
    {
      filePath: MODEL_SELECTION_POLICY_PATH,
      forbidden: ["resolveEditStartupModelId() ??"],
    },
    {
      filePath: AI_STUDIO_CONSTANTS_PATH,
      forbidden: [
        'getModelAllowedAspects("fal-ai/nano-banana-pro/edit", [',
        'getModelAllowedAspects(KIE_KLING_30_MODEL_ID, ["16:9", "9:16", "1:1"])',
      ],
    },
    {
      filePath: STATE_PARSERS_PATH,
      forbidden: [
        'resolveEffectiveAspectForModel("fal-ai/nano-banana-2", value, "auto")',
        'resolveEffectiveAspectForModel("fal-ai/nano-banana-pro", value, "4:5")',
        'resolveEffectiveAspectForModel(KIE_KLING_30_MODEL_ID, value, "16:9")',
      ],
    },
    {
      filePath: MODEL_MODAL_PATH,
      forbidden: [
        '"kie-ai/veo-3.1-fast-i2v": {',
        '"kie-ai/kling-3.0": {',
        '"kie-ai/seedance-2": {',
        '"kie-ai/seedance-2-fast": {',
        '"reference-video": ["kie-ai/veo-3.1-fast-i2v", "kie-ai/kling-3.0"]',
        '"reference-keyframes": ["kie-ai/veo-3.1-fast-i2v"]',
      ],
    },
    {
      filePath: CHARACTER_TYPES_PATH,
      forbidden: [
        '"fal-ai/bytedance/seedream/v4.5/text-to-image"',
        '"fal-ai/bytedance/seedream/v4.5/edit"',
      ],
    },
  ];

  for (const check of residueChecks) {
    const source = readText(check.filePath);
    for (const forbidden of check.forbidden) {
      if (source.includes(forbidden)) {
        errors.push(
          `Duplicate policy residue remains in ${path.relative(REPO_ROOT, check.filePath)}: ${forbidden}`,
        );
      }
    }
  }

  const existingParityOk = runExistingParityCheck();
  if (!existingParityOk) {
    errors.push(
      "scripts/check_model_catalog_parity.js failed. Fix parity issues above before continuing.",
    );
  }
  const falRouteWrapperOk = runFalRouteWrapperCheck();
  if (!falRouteWrapperOk) {
    errors.push(
      "scripts/sync_fal_route_wrappers.js --check failed. Sync generated Fal/Kie route wrappers before continuing.",
    );
  }

  if (warnings.length > 0) {
    console.log("[model-doctor] Warnings:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("[model-doctor] Errors:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[model-doctor] OK (${entries.length} catalog entries checked, ${createCharacterModeEntries.length} Character Mode models verified)`,
  );
}

run();
