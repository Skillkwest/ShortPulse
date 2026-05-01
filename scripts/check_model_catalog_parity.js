// Model catalog parity checks for API docs and runtime governance.
// Run with: node scripts/check_model_catalog_parity.js
// Optional env:
// - SHORTPULSE_MODEL_CATALOG_MAX_STALE_DAYS=45
// - SHORTPULSE_MODEL_CATALOG_STALE_MODE=warn|enforce
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = process.cwd();
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const MODEL_CATALOG_PATH = path.join(
  FRONTEND_ROOT,
  "lib",
  "model-runtime",
  "modelCatalog.ts",
);
const MODEL_REGISTRY_PATH = path.join(
  FRONTEND_ROOT,
  "lib",
  "model-runtime",
  "modelRegistry.ts",
);
const PROVIDER_MODEL_IDS_PATH = path.join(
  FRONTEND_ROOT,
  "lib",
  "model-runtime",
  "providerModelIds.ts",
);
const FAL_ROUTES_DIR = path.join(FRONTEND_ROOT, "pages", "api", "fal");
const DOCS_API_DIR = path.join(REPO_ROOT, "docs", "api");
const DOCS_API_INDEX = path.join(DOCS_API_DIR, "README.md");
const DOCS_ROOT_INDEX = path.join(REPO_ROOT, "docs", "README.md");
const MAX_STALE_DAYS = Number(process.env.SHORTPULSE_MODEL_CATALOG_MAX_STALE_DAYS || 45);
const STALE_MODE_RAW = String(process.env.SHORTPULSE_MODEL_CATALOG_STALE_MODE || "warn")
  .trim()
  .toLowerCase();
const STALE_MODE = STALE_MODE_RAW === "enforce" ? "enforce" : "warn";
const PROVIDER_SOURCE_HOST_ALLOWLIST = {
  fal: ["fal.ai"],
  kie: ["docs.kie.ai", "kie.ai"],
  openai: ["platform.openai.com", "openai.com"],
};

const RETIRED_FAL_SUBMIT_ROUTE_MODEL_IDS = new Set([
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/pro/image-to-video",
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/image-to-video",
  "fal-ai/veo3.1/first-last-frame-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
]);

const MODEL_DOC_MAP = {
  "fal-ai/flux-2/klein/9b": "api-fal-flux-2-klein-9b.md",
  "fal-ai/flux-pro/v1/fill": "api-fal-flux-pro-fill.md",
  "fal-ai/flux-kontext-lora/inpaint": "api-fal-flux-kontext-inpaint.md",
  "fal-ai/bria/background/remove": "api-fal-bria-background-remove.md",
  "fal-ai/nano-banana": "api-fal-nano-banana.md",
  "fal-ai/nano-banana/edit": "api-fal-nano-banana-edit.md",
  "fal-ai/nano-banana-2": "api-fal-nano-banana-2.md",
  "fal-ai/nano-banana-2/edit": "api-fal-nano-banana-2-edit.md",
  "fal-ai/nano-banana-pro": "api-fal-nano-banana-pro.md",
  "fal-ai/nano-banana-pro/edit": "api-fal-nano-banana-pro-edit.md",
  "fal-ai/bytedance/seedream/v4.5/text-to-image": "api-fal-seedream-4-5.md",
  "fal-ai/bytedance/seedream/v4.5/edit": "api-fal-seedream-4-5-edit.md",
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": "api-fal-seedream-5-lite.md",
  "fal-ai/bytedance/seedream/v5/lite/edit": "api-fal-seedream-5-lite-edit.md",
  "fal-ai/kling-video/v3/pro/text-to-video": "api-fal-kling-3-pro-text-to-video.md",
  "fal-ai/kling-video/v3/pro/image-to-video": "api-fal-kling-3-pro-image-to-video.md",
  "fal-ai/veo3.1": "api-fal-veo3.md",
  "fal-ai/veo3.1/image-to-video": "api-fal-veo3-image-to-video.md",
  "fal-ai/veo3.1/first-last-frame-to-video": "api-fal-veo3-first-last-frame.md",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": "api-fal-seedance-1-5-pro.md",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": "api-fal-seedance-1-5-pro-i2v.md",
  "kie-ai/veo-3.1-fast-i2v": "api-kie-veo-3-1-fast-image-to-video.md",
  "kie-ai/kling-3.0": "api-kie-kling-3-0.md",
  "kie-ai/seedance-1.5-pro": "api-kie-seedance-1-5-pro.md",
  "kie-ai/seedance-2": "api-kie-seedance-2.md",
  "kie-ai/seedance-2-fast": "api-kie-seedance-2-fast.md",
  "gpt-image-2": "api-openai-gpt-image-2.md",
  music_v1: "api-elevenlabs-audio-models.md",
  eleven_text_to_sound_v2: "api-elevenlabs-audio-models.md",
  eleven_multilingual_v2: "api-elevenlabs-audio-models.md",
  eleven_multilingual_sts_v2: "api-elevenlabs-audio-models.md",
  eleven_multilingual_ttv_v2: "api-elevenlabs-audio-models.md",
  "gpt-5.4": "api-responses.md",
  "gpt-5.4-mini": "api-responses.md",
  "gpt-5.4-nano": "api-responses.md",
};

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const tsModuleCache = new Map();

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
        throw new Error(`Cannot resolve module '${requestPath}' from '${normalizedPath}'`);
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

  new vm.Script(transpiled, { filename: normalizedPath }).runInNewContext(sandbox);
  tsModuleCache.set(normalizedPath, sandbox.module.exports);
  return sandbox.module.exports;
}

function daysBetween(startIso, endIso) {
  const ms = endIso.getTime() - startIso.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseSourceHost(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    return String(parsed.hostname || "").toLowerCase().trim();
  } catch {
    return null;
  }
}

function hostMatchesAllowlist(hostname, allowedHosts) {
  return allowedHosts.some((allowedHost) => {
    const normalizedHost = String(allowedHost || "").toLowerCase().trim();
    return hostname === normalizedHost || hostname.endsWith(`.${normalizedHost}`);
  });
}

function listFalSubmitRouteModelIds() {
  const files = fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((name) => name.endsWith("-submit.ts") || name === "submit.ts");

  const modelIds = new Set();
  for (const fileName of files) {
    const content = readText(path.join(FAL_ROUTES_DIR, fileName));
    const match = content.match(/modelId:\s*"([^"]+)"/);
    if (!match) continue;
    modelIds.add(match[1]);
  }
  return modelIds;
}

function listFalSubmitRouteDefinitions() {
  const files = fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((name) => name.endsWith("-submit.ts") || name === "submit.ts");

  return files.map((fileName) => {
    const content = readText(path.join(FAL_ROUTES_DIR, fileName));
    const modelIdMatch = content.match(/modelId:\s*"([^"]+)"/);
    const validatePayloadMatch = content.match(/validatePayload\s*:\s*([A-Za-z0-9_()."'\s-]+)/);
    const helperValidatorMatch = content.match(
      /validatePayload\s*:\s*validateFalPayloadForModel\("([^"]+)"\)/
    );

    return {
      fileName,
      modelId: modelIdMatch ? modelIdMatch[1] : null,
      hasValidatePayload: Boolean(validatePayloadMatch),
      helperValidatorModelId: helperValidatorMatch ? helperValidatorMatch[1] : null,
    };
  });
}

function run() {
  const errors = [];
  const warnings = [];
  const today = new Date();

  if (STALE_MODE_RAW && STALE_MODE_RAW !== "warn" && STALE_MODE_RAW !== "enforce") {
    warnings.push(
      `Unknown SHORTPULSE_MODEL_CATALOG_STALE_MODE='${STALE_MODE_RAW}', defaulting to 'warn'.`,
    );
  }

  const modelCatalogModule = loadTsModule(MODEL_CATALOG_PATH);
  const modelRegistryModule = loadTsModule(MODEL_REGISTRY_PATH);
  const providerModelIdsModule = loadTsModule(PROVIDER_MODEL_IDS_PATH);
  const listModelCatalogEntries = modelCatalogModule.listModelCatalogEntries;
  const listModelConfigs = modelRegistryModule.listModelConfigs;
  if (typeof listModelCatalogEntries !== "function") {
    throw new Error("listModelCatalogEntries export missing from modelCatalog.ts");
  }
  if (typeof listModelConfigs !== "function") {
    throw new Error("listModelConfigs export missing from modelRegistry.ts");
  }
  const kieSupportedModelIds = Array.isArray(providerModelIdsModule.KIE_SUPPORTED_MODEL_IDS)
    ? providerModelIdsModule.KIE_SUPPORTED_MODEL_IDS
    : null;
  if (!kieSupportedModelIds || !kieSupportedModelIds.length) {
    throw new Error("KIE_SUPPORTED_MODEL_IDS export missing from providerModelIds.ts");
  }

  const entries = listModelCatalogEntries();
  const registryEntries = listModelConfigs();
  if (!Array.isArray(entries) || !entries.length) {
    errors.push("Model catalog is empty.");
  }
  if (!Array.isArray(registryEntries) || !registryEntries.length) {
    errors.push("Model registry is empty.");
  }

  const seenIds = new Set();
  const registryById = new Map(
    registryEntries.map((entry) => [String(entry.id || "").trim(), entry]),
  );
  for (const entry of entries) {
    const modelId = String(entry.modelId || "").trim();
    if (!modelId) {
      errors.push("Encountered catalog entry without modelId.");
      continue;
    }
    if (seenIds.has(modelId)) {
      errors.push(`Duplicate modelId in catalog: ${modelId}`);
    }
    seenIds.add(modelId);

    const registryEntry = registryById.get(modelId);
    if (!registryEntry) {
      errors.push(`Catalog model missing from runtime model registry: ${modelId}`);
    } else if (String(registryEntry.provider || "").trim() !== String(entry.provider || "").trim()) {
      errors.push(
        `Provider mismatch between catalog and registry for ${modelId}: catalog='${entry.provider}' registry='${registryEntry.provider}'`,
      );
    }

    const sourceUrl = String(entry.sourceUrl || "").trim();
    if (!/^https?:\/\//i.test(sourceUrl)) {
      errors.push(`Catalog sourceUrl missing/invalid for ${modelId}`);
    } else {
      const sourceHost = parseSourceHost(sourceUrl);
      if (!sourceHost) {
        errors.push(`Catalog sourceUrl hostname is invalid for ${modelId}: ${sourceUrl}`);
      } else {
        const allowedHosts = PROVIDER_SOURCE_HOST_ALLOWLIST[entry.provider];
        if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
          if (!hostMatchesAllowlist(sourceHost, allowedHosts)) {
            errors.push(
              `Catalog sourceUrl host mismatch for ${modelId}: provider='${entry.provider}' host='${sourceHost}' allowed='${allowedHosts.join(", ")}'`,
            );
          }
        }
      }
    }

    const verifiedAt = String(entry.verifiedAt || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
      errors.push(`verifiedAt must be YYYY-MM-DD for ${modelId}`);
    } else {
      const parsed = new Date(`${verifiedAt}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.push(`verifiedAt is not a valid date for ${modelId}: ${verifiedAt}`);
      } else {
        const ageDays = daysBetween(parsed, today);
        if (ageDays > MAX_STALE_DAYS) {
          const staleMessage = `Catalog verification is stale for ${modelId}: ${verifiedAt} (${ageDays} days old; max ${MAX_STALE_DAYS}).`;
          if (STALE_MODE === "enforce") {
            errors.push(staleMessage);
          } else {
            warnings.push(staleMessage);
          }
        }
      }
    }

    const defaultAspect = String(entry.defaultAspect || "").trim();
    const allowedAspects = Array.isArray(entry.allowedAspects) ? entry.allowedAspects : [];
    if (entry.submitAspectField !== "none") {
      if (!allowedAspects.length) {
        errors.push(`allowedAspects missing for ${modelId}`);
      } else if (!allowedAspects.includes(defaultAspect)) {
        errors.push(`defaultAspect is not included in allowedAspects for ${modelId}`);
      }
    }

    const allowedDurations = Array.isArray(entry.allowedDurations) ? entry.allowedDurations : [];
    if (allowedDurations.length) {
      const defaultDuration = Number(entry.defaultDurationSeconds);
      if (!Number.isFinite(defaultDuration)) {
        errors.push(`defaultDurationSeconds missing/invalid when allowedDurations is set for ${modelId}`);
      } else if (!allowedDurations.includes(defaultDuration)) {
        errors.push(`defaultDurationSeconds must be present in allowedDurations for ${modelId}`);
      }
    }

    if (entry.provider === "fal") {
      if (!String(entry.falSubmitUrl || "").trim()) {
        errors.push(`falSubmitUrl missing for Fal model ${modelId}`);
      }
      if (!Array.isArray(entry.falStatusBaseUrls) || entry.falStatusBaseUrls.length === 0) {
        errors.push(`falStatusBaseUrls missing for Fal model ${modelId}`);
      }
      if (!entry.payloadValidation) {
        errors.push(`payloadValidation missing for Fal model ${modelId}`);
      }
    }
    if (entry.provider === "kie") {
      if (!entry.payloadValidation) {
        errors.push(`payloadValidation missing for Kie model ${modelId}`);
      }
      if (!allowedDurations.length) {
        errors.push(`allowedDurations missing for Kie model ${modelId}`);
      }
      if (!String(entry.kieSubmitUrl || "").trim()) {
        errors.push(`kieSubmitUrl missing for Kie model ${modelId}`);
      }
      if (!Array.isArray(entry.kieStatusBaseUrls) || entry.kieStatusBaseUrls.length === 0) {
        errors.push(`kieStatusBaseUrls missing for Kie model ${modelId}`);
      }
    }

    const mappedDoc = MODEL_DOC_MAP[modelId];
    if (!mappedDoc) {
      errors.push(`Missing MODEL_DOC_MAP entry for ${modelId}`);
      continue;
    }

    const docPath = path.join(DOCS_API_DIR, mappedDoc);
    if (!fs.existsSync(docPath)) {
      errors.push(`Missing mapped API doc for ${modelId}: docs/api/${mappedDoc}`);
      continue;
    }

    const docText = readText(docPath);
    if (!docText.includes(modelId) && !docText.includes(sourceUrl)) {
      errors.push(
        `Mapped doc docs/api/${mappedDoc} does not reference model id or source URL for ${modelId}`,
      );
    }
  }

  const falSubmitModelIds = listFalSubmitRouteModelIds();
  const falSubmitRouteDefinitions = listFalSubmitRouteDefinitions();
  for (const modelId of falSubmitModelIds) {
    if (!seenIds.has(modelId)) {
      errors.push(`Fal submit route references unknown catalog model id: ${modelId}`);
    }
  }

  const falCatalogModelIds = entries
    .filter(
      (entry) =>
        entry.provider === "fal" &&
        String(entry.falSubmitUrl || "").trim().length > 0 &&
        !RETIRED_FAL_SUBMIT_ROUTE_MODEL_IDS.has(String(entry.modelId || ""))
    )
    .map((entry) => entry.modelId);

  for (const modelId of falCatalogModelIds) {
    if (!falSubmitModelIds.has(modelId)) {
      errors.push(`Catalog Fal model missing submit route coverage: ${modelId}`);
    }
  }

  for (const registryEntry of registryEntries) {
    const modelId = String(registryEntry.id || "").trim();
    if (!modelId) {
      errors.push("Encountered runtime model registry entry without id.");
      continue;
    }
    if (!seenIds.has(modelId)) {
      errors.push(`Runtime model registry model missing from catalog: ${modelId}`);
    }
  }

  const kieModelIdSet = new Set(kieSupportedModelIds.map((modelId) => String(modelId)));
  const kieCatalogEntries = entries.filter((entry) => entry.provider === "kie");
  const kieCatalogModelIds = new Set(kieCatalogEntries.map((entry) => String(entry.modelId || "")));
  const kieRegistryEntries = registryEntries.filter((entry) => entry.provider === "kie");
  const kieRegistryModelIds = new Set(kieRegistryEntries.map((entry) => String(entry.id || "")));

  for (const modelId of kieModelIdSet) {
    if (!seenIds.has(modelId)) {
      errors.push(`Canonical Kie model id missing from model catalog: ${modelId}`);
      continue;
    }
    if (!kieCatalogModelIds.has(modelId)) {
      errors.push(`Canonical Kie model id is not marked provider='kie' in catalog: ${modelId}`);
    }
    if (!MODEL_DOC_MAP[modelId]) {
      errors.push(`Canonical Kie model id missing MODEL_DOC_MAP entry: ${modelId}`);
    }
    if (!kieRegistryModelIds.has(modelId)) {
      errors.push(`Canonical Kie model id missing from model registry: ${modelId}`);
    }
  }

  for (const modelId of kieCatalogModelIds) {
    if (!kieModelIdSet.has(modelId)) {
      errors.push(`Catalog Kie model id missing from canonical KIE_SUPPORTED_MODEL_IDS: ${modelId}`);
    }
  }

  for (const modelId of Object.keys(MODEL_DOC_MAP)) {
    if (!modelId.startsWith("kie-ai/")) continue;
    if (!kieModelIdSet.has(modelId)) {
      errors.push(`Kie MODEL_DOC_MAP entry missing canonical KIE_SUPPORTED_MODEL_IDS mapping: ${modelId}`);
    }
  }

  for (const modelId of kieRegistryModelIds) {
    if (!kieModelIdSet.has(modelId)) {
      errors.push(`Model registry Kie model id missing from canonical KIE_SUPPORTED_MODEL_IDS: ${modelId}`);
    }
  }

  for (const route of falSubmitRouteDefinitions) {
    const routeLabel = `frontend/pages/api/fal/${route.fileName}`;
    if (!route.modelId) {
      errors.push(`${routeLabel} missing modelId in createFalSubmitHandler config.`);
      continue;
    }
    if (!route.hasValidatePayload) {
      errors.push(`${routeLabel} missing validatePayload in createFalSubmitHandler config.`);
      continue;
    }
    if (route.helperValidatorModelId && route.helperValidatorModelId !== route.modelId) {
      errors.push(
        `${routeLabel} validateFalPayloadForModel id mismatch: modelId='${route.modelId}' validate='${route.helperValidatorModelId}'.`,
      );
    }
  }

  const apiIndexText = readText(DOCS_API_INDEX);
  const docsRootText = readText(DOCS_ROOT_INDEX);
  const mappedDocs = new Set(Object.values(MODEL_DOC_MAP));

  for (const fileName of mappedDocs) {
    if (!apiIndexText.includes(`docs/api/${fileName}`)) {
      errors.push(`docs/api/README.md missing entry for docs/api/${fileName}`);
    }
    if (!docsRootText.includes(`docs/api/${fileName}`)) {
      errors.push(`docs/README.md missing entry for docs/api/${fileName}`);
    }
  }

  if (warnings.length) {
    console.warn("Model catalog parity warnings:");
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error("Model catalog parity checks failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Model catalog parity checks passed.");
}

run();
